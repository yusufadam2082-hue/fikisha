import express from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// Core server and environment wiring.
const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const configuredCorsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'merchant123';

if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_SECURITY_LOG_PATH = path.join(__dirname, 'store-security-logs.json');
const ACCOUNTING_PAYOUT_LEDGER_PATH = path.join(__dirname, 'accounting-payout-ledger.json');

// Order statuses are normalized centrally so the rest of the API can accept legacy variants safely.
const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

const ORDER_STATUS_ALIASES = {
  PENDING: ORDER_STATUS.PENDING,
  CONFIRMED: ORDER_STATUS.CONFIRMED,
  PREPARING: ORDER_STATUS.PREPARING,
  READYFORPICKUP: ORDER_STATUS.READY_FOR_PICKUP,
  READY_FOR_PICKUP: ORDER_STATUS.READY_FOR_PICKUP,
  OUTFORDELIVERY: ORDER_STATUS.OUT_FOR_DELIVERY,
  OUT_FOR_DELIVERY: ORDER_STATUS.OUT_FOR_DELIVERY,
  INTRANSIT: ORDER_STATUS.OUT_FOR_DELIVERY,
  IN_TRANSIT: ORDER_STATUS.OUT_FOR_DELIVERY,
  ONTHEWAY: ORDER_STATUS.OUT_FOR_DELIVERY,
  ON_THE_WAY: ORDER_STATUS.OUT_FOR_DELIVERY,
  DELIVERED: ORDER_STATUS.DELIVERED,
  CANCELLED: ORDER_STATUS.CANCELLED,
  CANCELED: ORDER_STATUS.CANCELLED
};

// Small utility helpers support scoring, ETA estimates, and consistent response shaping.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const scoreToRiskLevel = (score) => {
  if (score >= 70) {
    return 'HIGH';
  }

  if (score >= 40) {
    return 'MEDIUM';
  }

  return 'LOW';
};

const estimateEtaFromSignals = ({ itemCount = 1, distanceKm = 3, status = ORDER_STATUS.PENDING }) => {
  const safeItemCount = clamp(Number(itemCount) || 1, 1, 40);
  const safeDistance = clamp(Number(distanceKm) || 3, 0.3, 30);
  const normalizedStatus = normalizeOrderStatus(status) || ORDER_STATUS.PENDING;

  const prepMinutes = 8 + safeItemCount * 1.8;
  const travelMinutes = 5 + safeDistance * 3.2;

  let statusAdjustment = 0;
  if (normalizedStatus === ORDER_STATUS.PREPARING) {
    statusAdjustment = -3;
  } else if (normalizedStatus === ORDER_STATUS.READY_FOR_PICKUP) {
    statusAdjustment = -9;
  } else if (normalizedStatus === ORDER_STATUS.OUT_FOR_DELIVERY) {
    statusAdjustment = -12;
  } else if (normalizedStatus === ORDER_STATUS.DELIVERED) {
    statusAdjustment = -100;
  }

  const etaMinutes = Math.max(0, Math.round(prepMinutes + travelMinutes + statusAdjustment));
  const variance = Math.max(3, Math.round(etaMinutes * 0.2));
  const minEta = Math.max(0, etaMinutes - variance);
  const maxEta = etaMinutes + variance;

  return {
    etaMinutes,
    minEta,
    maxEta,
    confidence: clamp(Math.round(88 - safeDistance * 1.5 - safeItemCount * 0.8), 45, 94)
  };
};

// Orders may store the delivery address in more than one JSON field, so this helper checks both formats.
const parseOrderAddress = (order) => {
  const fromDeliveryAddress = parseJsonField(order?.deliveryAddress, null);
  if (fromDeliveryAddress && typeof fromDeliveryAddress === 'object') {
    return fromDeliveryAddress;
  }

  const fromCustomerInfo = parseJsonField(order?.customerInfo, null);
  if (fromCustomerInfo && typeof fromCustomerInfo === 'object') {
    return fromCustomerInfo.deliveryAddress || fromCustomerInfo.address || null;
  }

  return null;
};

// Fraud scoring is heuristic-based for now: it highlights suspicious patterns for admin review.
const computeOrderFraudSignals = async (order) => {
  const signals = [];
  let score = 0;

  if (!order) {
    return {
      score: 100,
      level: 'HIGH',
      signals: ['Order not found']
    };
  }

  const highValueThreshold = 120;
  if (Number(order.total || 0) >= highValueThreshold) {
    score += 24;
    signals.push(`High-value order (>= ${highValueThreshold})`);
  }

  const createdAt = new Date(order.createdAt);
  const customerCreatedAt = new Date(order.customer?.createdAt || order.createdAt);
  const accountAgeHours = (createdAt.getTime() - customerCreatedAt.getTime()) / (1000 * 60 * 60);
  if (accountAgeHours <= 24) {
    score += 28;
    signals.push('Very new customer account');
  } else if (accountAgeHours <= 72) {
    score += 16;
    signals.push('New customer account');
  }

  const rapidOrdersWindowStart = new Date(createdAt.getTime() - 15 * 60 * 1000);
  const rapidOrdersCount = await prisma.order.count({
    where: {
      customerId: order.customerId,
      createdAt: {
        gte: rapidOrdersWindowStart,
        lte: createdAt
      }
    }
  });

  if (rapidOrdersCount >= 3) {
    score += 22;
    signals.push('Multiple orders placed quickly');
  }

  const hour = createdAt.getHours();
  if (hour <= 4) {
    score += 12;
    signals.push('Late-night ordering pattern');
  }

  const address = parseOrderAddress(order);
  if (!address) {
    score += 12;
    signals.push('Missing structured delivery address');
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    score += 8;
    signals.push('Order was cancelled');
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);
  return {
    score: normalizedScore,
    level: scoreToRiskLevel(normalizedScore),
    signals
  };
};

// Normalize free-form status input into one of the server-supported status constants.
const normalizeOrderStatus = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalizedKey = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return ORDER_STATUS_ALIASES[normalizedKey] || null;
};

const parseJsonField = (value, fallback = null) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Convert order rows into API responses that are easier for the frontend to consume directly.
const buildStoreCode = (store) => {
  const source = `${store?.name || ''}${store?.address ? ` ${store.address}` : ''}`.trim() || 'ORD';
  const code = source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return (code || 'ORD').padEnd(3, 'X');
};

const formatOrderNumber = (storeCode, sequence) => `FK-${storeCode}-${String(sequence).padStart(4, '0')}`;

const buildLegacyOrderNumber = (order) => {
  const compact = String(order?.id || '').replace(/-/g, '').toUpperCase();
  const suffix = (compact.slice(-4) || compact || '0000').padStart(4, '0');
  return formatOrderNumber(buildStoreCode(order?.store), suffix);
};

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

const generateNextOrderNumber = async (store) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const todaysCount = await prisma.order.count({
    where: {
      storeId: store.id,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  return {
    storeCode: buildStoreCode(store),
    nextSequence: todaysCount + 1
  };
};

const serializeOrder = (order) => {
  const normalizedStatus = normalizeOrderStatus(order.status);
  const serialized = {
    ...order,
    orderNumber: order.orderNumber || buildLegacyOrderNumber(order),
    customerInfo: parseJsonField(order.customerInfo, {}),
    deliveryAddress: parseJsonField(order.deliveryAddress, null),
    deliveryOtpRequired: normalizedStatus === ORDER_STATUS.OUT_FOR_DELIVERY,
    deliveryOtpVerified: Boolean(order.deliveryOtpVerifiedAt),
    items: order.items?.map((item) => ({
      ...item,
      name: item.product?.name ?? 'Unknown item'
    })) ?? []
  };

  // Never expose the raw OTP or verification timestamp by default.
  delete serialized.deliveryOtp;
  delete serialized.deliveryOtpVerifiedAt;
  return serialized;
};

const publicUserFields = {
  id: true,
  username: true,
  role: true,
  name: true,
  email: true,
  phone: true,
  storeId: true,
  createdAt: true,
  updatedAt: true
};

// Store mutation routes reuse this access check so merchants can only manage their own store.
const ensureStoreAccess = async (req, storeId) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!store) {
    return { error: { status: 404, body: { error: 'Store not found' } } };
  }

  if (req.user.role !== 'ADMIN' && store.ownerId !== req.user.id) {
    return { error: { status: 403, body: { error: 'Access denied' } } };
  }

  return { store };
};

// Drivers can be referenced by user id or driver id depending on the token payload, so resolve it once here.
const resolveDriverIdForUser = async (user) => {
  if (!user || user.role !== 'DRIVER') {
    return null;
  }

  if (user.driverId) {
    return user.driverId;
  }

  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });

  return driver?.id || null;
};

// Some legacy orders may store driver assignment using a user id instead of Driver.id.
// Treat both forms as valid ownership for the same logged-in driver.
const isOrderOwnedByDriver = async ({ orderDriverId, driverId, userId }) => {
  if (!orderDriverId) {
    return false;
  }

  if (orderDriverId === driverId || orderDriverId === userId) {
    return true;
  }

  const assignedDriver = await prisma.driver.findUnique({
    where: { id: orderDriverId },
    select: { userId: true }
  });

  return assignedDriver?.userId === userId;
};

// Merchants are scoped by their assigned store, not just by their account id.
const resolveMerchantStoreIdForUser = async (user) => {
  if (!user || user.role !== 'MERCHANT') {
    return null;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { storeId: true }
  });

  return currentUser?.storeId || user.storeId || null;
};

// Security and accounting data is persisted in JSON files so the API can append audit records cheaply.
const readStoreSecurityLogs = async () => {
  try {
    const raw = await readFile(STORE_SECURITY_LOG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    console.error('Failed to read store security logs:', error);
    return [];
  }
};

const appendStoreSecurityLog = async ({ storeId, type, actorUserId, actorRole, message, metadata = {} }) => {
  if (!storeId || !type) {
    return;
  }

  const currentLogs = await readStoreSecurityLogs();
  currentLogs.push({
    id: randomUUID(),
    storeId,
    type,
    actorUserId: actorUserId || null,
    actorRole: actorRole || null,
    message: message || '',
    metadata,
    createdAt: new Date().toISOString()
  });

  await writeFile(STORE_SECURITY_LOG_PATH, JSON.stringify(currentLogs, null, 2));
};

const readAccountingPayoutLedger = async () => {
  try {
    const raw = await readFile(ACCOUNTING_PAYOUT_LEDGER_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    console.error('Failed to read accounting payout ledger:', error);
    return [];
  }
};

const writeAccountingPayoutLedger = async (records) => {
  const safeRecords = Array.isArray(records) ? records : [];
  await writeFile(ACCOUNTING_PAYOUT_LEDGER_PATH, JSON.stringify(safeRecords, null, 2));
};

// Security middleware hardens headers, CORS, JSON parsing, and request volume limits.
app.use(helmet());

const corsOriginValidator = (origin, callback) => {
  // Allow non-browser clients and same-origin calls.
  if (!origin) {
    callback(null, true);
    return;
  }

  if (configuredCorsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  // In development, allow localhost ports (e.g. 5173/5174) for Vite fallback ports.
  if (!IS_PRODUCTION && /^http:\/\/localhost:\d+$/.test(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Not allowed by CORS'));
};

app.use(cors({
  origin: corsOriginValidator,
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: IS_PRODUCTION ? 15 * 60 * 1000 : 60 * 1000,
  max: IS_PRODUCTION ? 100 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP' }
});

const authLimiter = rateLimit({
  windowMs: IS_PRODUCTION ? 15 * 60 * 1000 : 60 * 1000,
  max: IS_PRODUCTION ? 5 : 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again shortly.' }
});

app.use('/api/', limiter);
app.post('/api/auth/login', authLimiter);
app.post('/api/drivers/login', authLimiter);

// Authentication middleware resolves the bearer token once and attaches the decoded user to the request.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role middleware keeps authorization rules close to route definitions.
const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Error handler
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
};

// Admin user-management endpoints power the older admin portal screens.
app.get('/api/products', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        store: {
          select: { name: true }
        }
      }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/users', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        name: true,
        email: true,
        phone: true,
        storeId: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('username').trim().notEmpty(),
  body('password').notEmpty().isLength({ min: 6 }),
  body('role').isIn(['ADMIN', 'MERCHANT', 'CUSTOMER', 'DRIVER']),
  validate,
  async (req, res) => {
    try {
      const { username, password, role, name, email, phone } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { username }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role,
          name,
          email: email || null,
          phone: phone || null
        },
        select: {
          id: true,
          username: true,
          role: true,
          name: true,
          email: true,
          phone: true,
          storeId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

app.put('/api/users/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('username').optional().trim().notEmpty(),
  body('password').optional().isLength({ min: 6 }),
  body('role').optional().isIn(['ADMIN', 'MERCHANT', 'CUSTOMER', 'DRIVER']),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role, name, email, phone } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (username && username !== existingUser.username) {
        const duplicateUser = await prisma.user.findUnique({
          where: { username }
        });
        if (duplicateUser) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }

      const updateData = {
        username: username || undefined,
        name: name || undefined,
        email: email || null,
        phone: phone || null,
        role: role || undefined
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          role: true,
          name: true,
          email: true,
          phone: true,
          storeId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

app.delete('/api/users/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.user.delete({
        where: { id }
      });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// ── Customer management endpoints (admin-only) ──────────────────────────────

// List all customers with aggregated order stats.
app.get('/api/customers', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        banned: true,
        createdAt: true,
        orders: {
          select: { id: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const payload = customers.map(c => ({
      id:          c.id,
      username:    c.username,
      name:        c.name,
      email:       c.email,
      phone:       c.phone,
      banned:      c.banned,
      createdAt:   c.createdAt,
      orderCount:  c.orders.length,
      totalSpend:  c.orders.reduce((sum, o) => sum + (o.total || 0), 0),
      lastOrderAt: c.orders[0]?.createdAt ?? null,
    }));

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Fetch a single customer's full order history (admin view).
app.get('/api/customers/:id/orders', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      include: {
        store: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
});

// Toggle a customer's banned status.
app.patch('/api/customers/:id/ban', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, banned: true } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.role !== 'CUSTOMER') return res.status(400).json({ error: 'User is not a customer' });

    const updated = await prisma.user.update({
      where: { id },
      data: { banned: !customer.banned },
      select: { id: true, banned: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ban status' });
  }
});

// Admin edit of a specific customer profile (name, email, phone).
app.patch('/api/customers/:id', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const updated = await prisma.user.update({
      where: { id, role: 'CUSTOMER' },
      data: {
        ...(name  !== undefined && { name }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
      },
      select: { id: true, username: true, name: true, email: true, phone: true, banned: true, createdAt: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// AI utility endpoints expose lightweight recommendations, chat guidance, ETA estimates, and fraud signals.
app.get('/api/ai/recommendations', authMiddleware, async (req, res) => {
  try {
    const limit = clamp(Number(req.query.limit) || 8, 1, 20);
    const customerId = req.user.role === 'CUSTOMER' ? req.user.id : null;

    const [topRatedProducts, recentCustomerOrders] = await Promise.all([
      prisma.product.findMany({
        where: { available: true },
        include: {
          store: {
            select: { id: true, name: true, rating: true }
          }
        },
        take: 40,
        orderBy: { updatedAt: 'desc' }
      }),
      customerId
        ? prisma.order.findMany({
          where: { customerId },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, category: true, storeId: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 30
        })
        : Promise.resolve([])
    ]);

    const categoryAffinity = new Map();
    const storeAffinity = new Map();
    for (const order of recentCustomerOrders) {
      for (const item of order.items || []) {
        const categoryKey = item.product?.category || 'GENERAL';
        const storeKey = item.product?.storeId;
        categoryAffinity.set(categoryKey, (categoryAffinity.get(categoryKey) || 0) + item.quantity);
        if (storeKey) {
          storeAffinity.set(storeKey, (storeAffinity.get(storeKey) || 0) + item.quantity);
        }
      }
    }

    const ranked = topRatedProducts
      .map((product) => {
        const categoryBoost = categoryAffinity.get(product.category || 'GENERAL') || 0;
        const storeBoost = storeAffinity.get(product.storeId) || 0;
        const storeRating = Number(product.store?.rating || 4.5);
        const score = storeRating * 8 + categoryBoost * 3 + storeBoost * 2 + (product.available ? 6 : -20);

        let reason = 'Popular in your area';
        if (categoryBoost >= 2) {
          reason = `Because you often order ${product.category || 'similar'} items`;
        } else if (storeBoost >= 2) {
          reason = `From a store you order from often`;
        }

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          category: product.category,
          storeId: product.store?.id,
          storeName: product.store?.name,
          score,
          reason
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({
      generatedAt: new Date().toISOString(),
      recommendations: ranked
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

const extractOrderLookupToken = (message) => {
  const text = String(message || '').trim();
  if (!text) {
    return null;
  }

  const orderNumberMatch = text.match(/\bFK-[A-Z0-9]{3}-\d{4}\b/i);
  if (orderNumberMatch?.[0]) {
    return { kind: 'orderNumber', value: orderNumberMatch[0].toUpperCase() };
  }

  const uuidMatch = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  if (uuidMatch?.[0]) {
    return { kind: 'id', value: uuidMatch[0] };
  }

  return null;
};

const canUserAccessOrder = async (user, order) => {
  if (!user || !order) {
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role === 'CUSTOMER') {
    return order.customerId === user.id;
  }

  if (user.role === 'MERCHANT') {
    const merchantStoreId = await resolveMerchantStoreIdForUser(user);
    return Boolean(merchantStoreId && merchantStoreId === order.storeId);
  }

  if (user.role === 'DRIVER') {
    const driverId = await resolveDriverIdForUser(user);
    return Boolean(driverId && order.driverId === driverId);
  }

  return false;
};

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const lower = message.toLowerCase();
    const context = Array.isArray(req.body?.context) ? req.body.context.slice(-6) : [];
    const contextText = context
      .map((entry) => String(entry?.text || ''))
      .join(' ')
      .toLowerCase();

    let reply = 'I can help with order tracking, delivery ETA, store discovery, and payment questions. What do you need?';
    let suggestions = ['Track my order', 'Best stores near me', 'Delivery fee explained'];

    const lookup = extractOrderLookupToken(message);
    const asksForLatestOrder =
      lower.includes('latest order')
      || lower.includes('my order')
      || (lower.includes('track') && !lookup)
      || contextText.includes('latest order');

    if (lookup || asksForLatestOrder) {
      let order = null;

      if (lookup?.kind === 'orderNumber') {
        order = await prisma.order.findFirst({
          where: { orderNumber: lookup.value },
          include: {
            store: { select: { name: true } },
            items: { include: { product: { select: { name: true } } } }
          }
        });
      } else if (lookup?.kind === 'id') {
        order = await prisma.order.findUnique({
          where: { id: lookup.value },
          include: {
            store: { select: { name: true } },
            items: { include: { product: { select: { name: true } } } }
          }
        });
      } else {
        const customerScopedWhere = req.user.role === 'CUSTOMER' ? { customerId: req.user.id } : {};
        order = await prisma.order.findFirst({
          where: customerScopedWhere,
          include: {
            store: { select: { name: true } },
            items: { include: { product: { select: { name: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      const allowed = order ? await canUserAccessOrder(req.user, order) : false;
      if (!order || !allowed) {
        reply = 'I could not find an accessible order for that reference. Share a valid order number like FK-ABC-0001 or use the Tracking page.';
        suggestions = ['Open tracking page', 'Use my latest order', 'Contact support'];
      } else {
        const normalizedStatus = normalizeOrderStatus(order.status) || ORDER_STATUS.PENDING;
        const orderNumber = order.orderNumber || buildLegacyOrderNumber(order);
        const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1;
        const estimate = estimateEtaFromSignals({ itemCount, distanceKm: 3, status: normalizedStatus });

        reply = `Order ${orderNumber} from ${order.store?.name || 'your store'} is currently ${normalizedStatus.replaceAll('_', ' ')}. Estimated arrival is about ${estimate.minEta}-${estimate.maxEta} minutes.`;
        suggestions = ['Show OTP instructions', 'How is ETA calculated?', 'Contact courier'];
      }
    } else if (lower.includes('eta') || lower.includes('arrive') || lower.includes('delivery time')) {
      reply = 'ETA depends on item count, prep load, and distance. Share an order number (for example FK-ABC-0001) and I can estimate a tighter range.';
      suggestions = ['Use my latest order', 'Track order now', 'How is ETA calculated?'];
    } else if (lower.includes('recommend') || lower.includes('hungry') || lower.includes('what should i order')) {
      reply = 'I can suggest popular items and stores based on your recent orders. Check the AI Picks section on Home.';
      suggestions = ['Show AI picks', 'Cheap options under 500', 'Fast delivery only'];
    } else if (lower.includes('otp') || lower.includes('code') || lower.includes('verify')) {
      reply = 'Your courier must ask for the 4-digit OTP at drop-off. The driver can only complete delivery after entering the correct OTP in their app.';
      suggestions = ['Where do I see my OTP?', 'Order tracking', 'Report delivery issue'];
    } else if (lower.includes('fee') || lower.includes('charge') || lower.includes('cost')) {
      reply = 'Your final total includes item subtotal plus store delivery fee. Taxes and promotions can adjust the final amount.';
      suggestions = ['How do promos work?', 'View cart total', 'Payment methods'];
    }

    res.json({
      reply,
      suggestions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'AI assistant unavailable' });
  }
});

app.post('/api/ai/eta', authMiddleware, async (req, res) => {
  try {
    const orderId = req.body?.orderId ? String(req.body.orderId) : null;
    let etaPayload = {
      itemCount: Number(req.body?.itemCount) || 1,
      distanceKm: Number(req.body?.distanceKm) || 3,
      status: req.body?.status || ORDER_STATUS.PENDING
    };

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          store: true,
          items: true,
          customer: { select: { id: true } }
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const merchantStoreId = req.user.role === 'MERCHANT' ? await resolveMerchantStoreIdForUser(req.user) : null;
      const canAccess =
        req.user.role === 'ADMIN' ||
        (req.user.role === 'CUSTOMER' && order.customerId === req.user.id) ||
        (req.user.role === 'MERCHANT' && merchantStoreId === order.storeId) ||
        (req.user.role === 'DRIVER' && order.driverId === req.user.driverId);

      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      etaPayload = {
        itemCount: order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1,
        distanceKm: Number(req.body?.distanceKm) || 3,
        status: order.status
      };
    }

    const estimate = estimateEtaFromSignals(etaPayload);
    res.json({
      ...estimate,
      status: normalizeOrderStatus(etaPayload.status) || ORDER_STATUS.PENDING,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to estimate ETA' });
  }
});

app.post('/api/ai/fraud-score', authMiddleware, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true, ownerId: true } },
        customer: { select: { id: true, createdAt: true, name: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'MERCHANT') {
      const merchantStoreId = await resolveMerchantStoreIdForUser(req.user);
      if (!merchantStoreId || merchantStoreId !== order.storeId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (req.user.role === 'DRIVER') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await computeOrderFraudSignals(order);
    res.json({
      orderId,
      riskScore: result.score,
      riskLevel: result.level,
      signals: result.signals,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to score order risk' });
  }
});

app.get('/api/ai/fraud-overview', authMiddleware, roleMiddleware('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const limit = clamp(Number(req.query.limit) || 10, 1, 30);
    const where = {};

    if (req.user.role === 'MERCHANT') {
      const merchantStoreId = await resolveMerchantStoreIdForUser(req.user);
      if (!merchantStoreId) {
        return res.json({ generatedAt: new Date().toISOString(), orders: [] });
      }

      where.storeId = merchantStoreId;
    }

    const recentOrders = await prisma.order.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(limit * 3, 20)
    });

    const scored = await Promise.all(
      recentOrders.map(async (order) => {
        const risk = await computeOrderFraudSignals(order);
        return {
          orderId: order.id,
          total: order.total,
          status: order.status,
          customerName: order.customer?.name || 'Unknown',
          storeName: order.store?.name || 'Unknown',
          createdAt: order.createdAt,
          riskScore: risk.score,
          riskLevel: risk.level,
          signals: risk.signals
        };
      })
    );

    scored.sort((a, b) => b.riskScore - a.riskScore);

    res.json({
      generatedAt: new Date().toISOString(),
      orders: scored.slice(0, limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load fraud overview' });
  }
});

// Drivers CRUD endpoints
app.post('/api/drivers',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('name').trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').trim().notEmpty(),
  body('vehicle').trim().notEmpty(),
  body('license').optional({ nullable: true }).trim(),
  body('userId').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { name, email, phone, vehicle, license, userId } = req.body;

      // Check if user exists and is not already a driver
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role !== 'DRIVER') {
        return res.status(400).json({ error: 'User must have DRIVER role' });
      }

      const existingDriver = await prisma.driver.findUnique({
        where: { userId }
      });

      if (existingDriver) {
        return res.status(409).json({ error: 'User is already a driver' });
      }

      const driver = await prisma.driver.create({
        data: {
          name,
          // Driver.email is required + unique in schema.
          email: (email || user.email || `${user.username}@fikisha.local`).trim(),
          phone,
          vehicle,
          license: license || null,
          userId
        },
        include: {
          user: {
            select: { id: true, username: true, role: true, name: true, email: true, phone: true }
          }
        }
      });

      res.status(201).json(driver);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create driver' });
    }
  }
);

app.put('/api/drivers/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('name').optional().trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').optional().trim(),
  body('vehicle').optional().trim(),
  body('license').optional({ nullable: true }).trim(),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, vehicle, license } = req.body;

      const driver = await prisma.driver.findUnique({
        where: { id }
      });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      const updateData = {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        vehicle: vehicle || undefined,
        license: license === undefined ? undefined : (license || null)
      };

      const updatedDriver = await prisma.driver.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: { id: true, username: true, role: true, name: true, email: true, phone: true }
          }
        }
      });

      res.json(updatedDriver);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update driver' });
    }
  }
);

app.delete('/api/drivers/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.driver.delete({
        where: { id }
      });
      res.json({ message: 'Driver deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete driver' });
    }
  }
);

// Initialize database with seed data
const initDB = async () => {
  try {
    // Create categories
    const categories = [
      { name: 'Restaurants', image: '🍔', slug: 'restaurants' },
      { name: 'Groceries', image: '🛒', slug: 'groceries' },
      { name: 'Pharmacy', image: '💊', slug: 'pharmacy' },
      { name: 'Packages', image: '📦', slug: 'packages' },
    ];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat
      });
    }

    // Create admin user
    const adminPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {
        password: adminPassword,
        role: 'ADMIN',
        name: 'System Administrator'
      },
      create: {
        username: 'admin',
        password: adminPassword,
        role: 'ADMIN',
        name: 'System Administrator'
      }
    });

    // Create merchant user
    const merchantPassword = await bcrypt.hash(MERCHANT_PASSWORD, 12);
    const merchant = await prisma.user.upsert({
      where: { username: 'merchant' },
      update: {
        password: merchantPassword,
        role: 'MERCHANT',
        name: 'Burger Joint Owner'
      },
      create: {
        username: 'merchant',
        password: merchantPassword,
        role: 'MERCHANT',
        name: 'Burger Joint Owner'
      }
    });

    // Create store
    const store = await prisma.store.upsert({
      where: { id: 'store-1' },
      update: {},
      create: {
        id: 'store-1',
        name: 'Burger Joint',
        rating: 4.8,
        time: '15-25 min',
        deliveryFee: 1.99,
        category: 'American',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
        description: 'The best burgers in town.',
        ownerId: merchant.id
      }
    });

    await prisma.user.update({
      where: { id: merchant.id },
      data: { storeId: store.id }
    });

    const customerPassword = await bcrypt.hash(process.env.CUSTOMER_PASSWORD || 'customer123', 12);
    await prisma.user.upsert({
      where: { username: 'customer' },
      update: {
        password: customerPassword,
        role: 'CUSTOMER',
        name: 'Demo Customer'
      },
      create: {
        username: 'customer',
        password: customerPassword,
        role: 'CUSTOMER',
        name: 'Demo Customer'
      }
    });

    const driverUserPassword = await bcrypt.hash(process.env.DRIVER_PASSWORD || 'driver123', 12);
    const driverUser = await prisma.user.upsert({
      where: { username: 'driver' },
      update: {
        password: driverUserPassword,
        role: 'DRIVER',
        name: 'Demo Driver'
      },
      create: {
        username: 'driver',
        password: driverUserPassword,
        role: 'DRIVER',
        name: 'Demo Driver',
        phone: '+255700000001'
      }
    });

    await prisma.driver.upsert({
      where: { userId: driverUser.id },
      update: {
        name: 'Demo Driver',
        phone: '+255700000001',
        vehicle: 'Motorbike'
      },
      create: {
        name: 'Demo Driver',
        email: 'driver@fikisha.local',
        phone: '+255700000001',
        vehicle: 'Motorbike',
        userId: driverUser.id
      }
    });

    // Create products
    const products = [
      {
        id: 'product-1',
        name: 'Classic Cheeseburger',
        description: 'Angus beef with cheese, lettuce, tomato',
        price: 8.99,
        image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80',
        storeId: store.id
      },
      {
        id: 'product-2',
        name: 'French Fries',
        description: 'Crispy golden fries',
        price: 3.99,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=200&q=80',
        storeId: store.id
      }
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: product
      });
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

// Shared catalog and authentication routes back both the customer app and the admin experiences.
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ── Promotions ────────────────────────────────────────────────────────────────

// Public: returns promotions that are active and within their date window.
app.get('/api/promotions', async (req, res) => {
  try {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        active: true,
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// Admin: list all promotions regardless of active/date state.
app.get('/api/admin/promotions', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// Admin: create a promotion.
app.post('/api/admin/promotions',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('title').trim().notEmpty(),
  body('subtitle').trim().notEmpty(),
  body('ctaText').optional().trim(),
  body('ctaLink').optional({ nullable: true }),
  body('bgColor').optional().trim(),
  body('image').optional({ nullable: true }),
  body('active').optional().isBoolean(),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('endsAt').optional({ nullable: true }).isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { title, subtitle, ctaText, ctaLink, bgColor, image, active, startsAt, endsAt } = req.body;
      const promotion = await prisma.promotion.create({
        data: {
          title,
          subtitle,
          ctaText: ctaText || 'Order now',
          ctaLink: ctaLink || null,
          bgColor: bgColor || '#FF5A5F',
          image: image || null,
          active: active !== undefined ? active : true,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });
      res.status(201).json(promotion);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create promotion' });
    }
  }
);

// Admin: update a promotion.
app.put('/api/admin/promotions/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('title').optional().trim().notEmpty(),
  body('subtitle').optional().trim().notEmpty(),
  body('ctaText').optional().trim(),
  body('ctaLink').optional({ nullable: true }),
  body('bgColor').optional().trim(),
  body('image').optional({ nullable: true }),
  body('active').optional().isBoolean(),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('endsAt').optional({ nullable: true }).isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, subtitle, ctaText, ctaLink, bgColor, image, active, startsAt, endsAt } = req.body;
      const promotion = await prisma.promotion.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(subtitle !== undefined && { subtitle }),
          ...(ctaText !== undefined && { ctaText }),
          ...(ctaLink !== undefined && { ctaLink: ctaLink || null }),
          ...(bgColor !== undefined && { bgColor }),
          ...(image !== undefined && { image: image || null }),
          ...(active !== undefined && { active }),
          ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
          ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        },
      });
      res.json(promotion);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update promotion' });
    }
  }
);

// Admin: delete a promotion.
app.delete('/api/admin/promotions/:id', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    await prisma.promotion.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

app.post('/api/auth/login',
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          ...publicUserFields,
          password: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      let validPassword = false;

      // Accept legacy plaintext passwords safely and migrate them to bcrypt on successful login.
      if (typeof user.password === 'string' && user.password.startsWith('$2')) {
        try {
          validPassword = await bcrypt.compare(password, user.password);
        } catch {
          validPassword = false;
        }
      } else if (typeof user.password === 'string' && user.password === password) {
        validPassword = true;

        // Best-effort migration so future logins use bcrypt without requiring a password reset.
        try {
          const migratedHash = await bcrypt.hash(password, 12);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: migratedHash }
          });
        } catch {
          // Ignore migration failures and continue login flow.
        }
      }

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, storeId: user.storeId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({ token, user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: publicUserFields
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/me',
  authMiddleware,
  body('username').optional().trim().notEmpty(),
  body('name').optional().trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').optional({ nullable: true }).trim(),
  body('password').optional({ nullable: true }).isLength({ min: 6 }),
  validate,
  async (req, res) => {
    try {
      const nextData = {
        username: req.body.username,
        name: req.body.name,
        email: req.body.email || null,
        phone: req.body.phone || null
      };

      if (req.body.username) {
        const existingUser = await prisma.user.findUnique({
          where: { username: req.body.username }
        });

        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }

      if (req.body.password) {
        nextData.password = await bcrypt.hash(req.body.password, 12);
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: nextData,
        select: publicUserFields
      });

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Store and product routes serve public catalog browsing plus admin and merchant store management.
app.get('/api/stores', async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      include: {
        products: true,
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            storeId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

app.post('/api/stores',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('name').trim().notEmpty(),
  body('category').trim().notEmpty(),
  body('image').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('ownerName').trim().notEmpty(),
  body('ownerUsername').trim().notEmpty(),
  body('ownerPassword').isLength({ min: 6 }),
  validate,
  async (req, res) => {
    try {
      if (!req.body.ownerName || !req.body.ownerUsername || !req.body.ownerPassword) {
        return res.status(400).json({ error: 'Owner name, username, and password are required' });
      }

      const existingUser = await prisma.user.findUnique({
        where: { username: req.body.ownerUsername }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Merchant username already exists' });
      }

      const owner = await prisma.user.create({
        data: {
          username: req.body.ownerUsername,
          password: await bcrypt.hash(req.body.ownerPassword, 12),
          role: 'MERCHANT',
          name: req.body.ownerName,
          email: req.body.ownerEmail || null,
          phone: req.body.ownerPhone || null
        }
      });

      const store = await prisma.store.create({
        data: {
          name: req.body.name,
          rating: req.body.rating ?? 5,
          time: req.body.time ?? '20-30 min',
          deliveryFee: req.body.deliveryFee ?? 2.99,
          category: req.body.category,
          image: req.body.image,
          description: req.body.description,
          address: req.body.address,
          phone: req.body.phone,
          ownerId: owner.id
        },
        include: {
          products: true,
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              phone: true,
              storeId: true
            }
          }
        }
      });

      await prisma.user.update({
        where: { id: owner.id },
        data: { storeId: store.id }
      });

      await appendStoreSecurityLog({
        storeId: store.id,
        type: 'STORE_CREATED',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        message: `Store created with merchant account ${owner.username}`,
        metadata: { ownerId: owner.id, ownerUsername: owner.username }
      });

      res.status(201).json(store);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create store' });
    }
  }
);

app.put('/api/stores/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'MERCHANT'),
  async (req, res) => {
    try {
      const access = await ensureStoreAccess(req, req.params.id);
      if (access.error) {
        return res.status(access.error.status).json(access.error.body);
      }

      const previousIsOpen = access.store.isOpen;

      const updateData = req.user.role === 'ADMIN'
        ? {
            isOpen: req.body.isOpen,
            isActive: req.body.isActive
          }
        : {
            name: req.body.name,
            rating: req.body.rating,
            time: req.body.time,
            deliveryFee: req.body.deliveryFee,
            category: req.body.category,
            image: req.body.image,
            description: req.body.description,
            address: req.body.address,
            phone: req.body.phone,
            isOpen: req.body.isOpen,
            isActive: req.body.isActive
          };

      const store = await prisma.store.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          products: true,
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              phone: true,
              storeId: true
            }
          }
        }
      });

      if (typeof req.body.isOpen === 'boolean' && req.body.isOpen !== previousIsOpen) {
        await appendStoreSecurityLog({
          storeId: store.id,
          type: req.body.isOpen ? 'STORE_OPENED' : 'STORE_CLOSED',
          actorUserId: req.user.id,
          actorRole: req.user.role,
          message: req.body.isOpen ? 'Store marked as OPEN' : 'Store marked as CLOSED',
          metadata: {
            from: previousIsOpen,
            to: req.body.isOpen
          }
        });
      }

      res.json(store);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update store' });
    }
  }
);

app.put('/api/stores/:id/credentials',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('ownerName').optional().trim().notEmpty(),
  body('ownerUsername').optional().trim().notEmpty(),
  body('ownerEmail').optional({ nullable: true }).isEmail(),
  body('ownerPhone').optional({ nullable: true }).trim(),
  body('ownerPassword').optional({ nullable: true }).isLength({ min: 6 }),
  validate,
  async (req, res) => {
    try {
      const store = await prisma.store.findUnique({
        where: { id: req.params.id },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
              phone: true,
              storeId: true
            }
          }
        }
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      if (req.body.ownerUsername && req.body.ownerUsername !== store.owner.username) {
        const existing = await prisma.user.findUnique({ where: { username: req.body.ownerUsername } });
        if (existing && existing.id !== store.owner.id) {
          return res.status(409).json({ error: 'Merchant username already exists' });
        }
      }

      const ownerUpdateData = {
        name: req.body.ownerName,
        username: req.body.ownerUsername,
        email: req.body.ownerEmail === undefined ? undefined : (req.body.ownerEmail || null),
        phone: req.body.ownerPhone === undefined ? undefined : (req.body.ownerPhone || null)
      };

      if (req.body.ownerPassword) {
        ownerUpdateData.password = await bcrypt.hash(req.body.ownerPassword, 12);
      }

      const owner = await prisma.user.update({
        where: { id: store.owner.id },
        data: ownerUpdateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          phone: true,
          storeId: true
        }
      });

      await appendStoreSecurityLog({
        storeId: store.id,
        type: 'MERCHANT_CREDENTIALS_UPDATED',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        message: `Merchant credentials updated for ${owner.username}`,
        metadata: {
          ownerId: owner.id,
          ownerUsername: owner.username,
          passwordChanged: Boolean(req.body.ownerPassword)
        }
      });

      res.json({
        message: 'Store merchant credentials updated successfully',
        owner
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update merchant credentials' });
    }
  }
);

app.get('/api/stores/:id', async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: {
        products: true,
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            storeId: true
          }
        }
      }
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json(store);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

app.post('/api/stores/:storeId/products',
  authMiddleware,
  roleMiddleware('MERCHANT'),
  body('name').trim().notEmpty(),
  body('price').isFloat({ gt: 0 }),
  validate,
  async (req, res) => {
    try {
      const access = await ensureStoreAccess(req, req.params.storeId);
      if (access.error) {
        return res.status(access.error.status).json(access.error.body);
      }

      const product = await prisma.product.create({
        data: {
          name: req.body.name,
          description: req.body.description || '',
          price: Number(req.body.price),
          image: req.body.image || '',
          category: req.body.category,
          storeId: req.params.storeId
        }
      });

      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

app.put('/api/stores/:storeId/products/:productId',
  authMiddleware,
  roleMiddleware('MERCHANT'),
  async (req, res) => {
    try {
      const access = await ensureStoreAccess(req, req.params.storeId);
      if (access.error) {
        return res.status(access.error.status).json(access.error.body);
      }

      const product = await prisma.product.update({
        where: { id: req.params.productId },
        data: {
          name: req.body.name,
          description: req.body.description,
          price: req.body.price === undefined ? undefined : Number(req.body.price),
          image: req.body.image,
          category: req.body.category,
          available: req.body.available
        }
      });

      res.json(product);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

app.delete('/api/stores/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      return res.status(403).json({ error: 'Store deletion is disabled. Close the store instead.' });
      const storeId = req.params.id;

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true }
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Explicit deletion order avoids FK edge cases when orders/products coexist.
      await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { order: { storeId } } });
        await tx.order.deleteMany({ where: { storeId } });
        await tx.product.deleteMany({ where: { storeId } });
        await tx.user.updateMany({ where: { storeId }, data: { storeId: null } });
        await tx.store.delete({ where: { id: storeId } });
      });

      res.json({ message: 'Store deleted successfully' });
    } catch (error) {
      console.error('Failed to delete store:', error);
      res.status(500).json({ error: 'Failed to delete store' });
    }
  }
);

app.delete('/api/stores/:storeId/products/:productId',
  authMiddleware,
  roleMiddleware('MERCHANT'),
  async (req, res) => {
    try {
      const access = await ensureStoreAccess(req, req.params.storeId);
      if (access.error) {
        return res.status(access.error.status).json(access.error.body);
      }
      await prisma.product.delete({ where: { id: req.params.productId } });
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }
);

app.get('/api/stores/:id/logs',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      const store = await prisma.store.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          name: true,
          isOpen: true
        }
      });

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      const [orders, securityLogs] = await Promise.all([
        prisma.order.findMany({
          where: { storeId: req.params.id },
          include: {
            driver: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        readStoreSecurityLogs()
      ]);

      const orderLogs = orders.map((order) => {
        const customerInfo = parseJsonField(order.customerInfo, {});
        return {
          orderId: order.id,
          status: order.status,
          amount: Number(order.total || 0),
          paymentMethod: customerInfo?.paymentMethod || 'Unknown',
          driverId: order.driver?.id || null,
          driverName: order.driver?.name || 'Unassigned',
          orderedAt: order.createdAt,
          lastUpdatedAt: order.updatedAt
        };
      });

      const storeSecurityLogs = securityLogs
        .filter((entry) => entry.storeId === req.params.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        store,
        generatedAt: new Date().toISOString(),
        openingClosingLogs: storeSecurityLogs.filter((entry) => entry.type === 'STORE_OPENED' || entry.type === 'STORE_CLOSED'),
        credentialLogs: storeSecurityLogs.filter((entry) => entry.type === 'MERCHANT_CREDENTIALS_UPDATED' || entry.type === 'STORE_CREATED'),
        orderLogs,
        securityLogs: storeSecurityLogs
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate store logs' });
    }
  }
);

// Audit and payout routes let admins review store activity and record merchant settlements.
app.get('/api/accounting/payouts',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      const { cycleKey } = req.query;
      const ledger = await readAccountingPayoutLedger();
      const filtered = cycleKey
        ? ledger.filter((entry) => entry.cycleKey === cycleKey)
        : ledger;

      res.json(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch accounting payouts' });
    }
  }
);

app.post('/api/accounting/payouts',
  authMiddleware,
  roleMiddleware('ADMIN'),
  body('storeId').trim().notEmpty(),
  body('storeName').trim().notEmpty(),
  body('cycleKey').optional().trim().notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('note').optional({ nullable: true }).trim(),
  validate,
  async (req, res) => {
    try {
      const { storeId, storeName, cycleKey, amount, note } = req.body;
      const ledger = await readAccountingPayoutLedger();

      const record = {
        id: randomUUID(),
        storeId,
        storeName,
        cycleKey: cycleKey || null,
        amount: Number(amount),
        note: note || 'Settled merchant balance',
        actorUserId: req.user.id,
        actorRole: req.user.role,
        createdAt: new Date().toISOString()
      };

      ledger.push(record);
      await writeAccountingPayoutLedger(ledger);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: 'Failed to record payout' });
    }
  }
);

app.delete('/api/accounting/payouts',
  authMiddleware,
  roleMiddleware('ADMIN'),
  async (req, res) => {
    try {
      const { cycleKey } = req.query;
      const ledger = await readAccountingPayoutLedger();
      const nextLedger = cycleKey
        ? ledger.filter((entry) => entry.cycleKey !== cycleKey)
        : [];

      await writeAccountingPayoutLedger(nextLedger);
      res.json({
        message: cycleKey
          ? `Payout ledger reset for cycle ${cycleKey}`
          : 'Payout ledger reset for all cycles',
        removedRecords: ledger.length - nextLedger.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset payout ledger' });
    }
  }
);

// Driver list/login and order routes coordinate the operational side of fulfillment.
app.get('/api/drivers', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        user: {
          select: { id: true, username: true, role: true, name: true, email: true, phone: true }
        },
        orders: {
          select: { id: true, status: true, total: true }
        }
      }
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

app.post('/api/drivers/login',
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const driver = await prisma.driver.findFirst({
        where: {
          user: { username }
        },
        include: { user: true }
      });

      if (!driver) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, driver.user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: driver.user.id, username: driver.user.username, role: driver.user.role, driverId: driver.id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        driver: {
          id: driver.id,
          userId: driver.user.id,
          username: driver.user.username,
          role: driver.user.role,
          name: driver.user.name
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    let where = {};

    if (req.user.role === 'MERCHANT') {
      const merchantStoreId = await resolveMerchantStoreIdForUser(req.user);
      if (!merchantStoreId) {
        return res.json([]);
      }

      where = { storeId: merchantStoreId };
    } else if (req.user.role === 'DRIVER') {
      const driverId = await resolveDriverIdForUser(req.user);
      if (!driverId) {
        return res.json([]);
      }

      where = {
        OR: [
          {
            status: ORDER_STATUS.READY_FOR_PICKUP,
            OR: [{ driverId: null }, { driverId }]
          },
          { driverId }
        ]
      };
    } else if (req.user.role === 'CUSTOMER') {
      where = { customerId: req.user.id };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, address: true, phone: true } },
        customer: { select: { name: true } },
        driver: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders.map((order) => {
      const serialized = serializeOrder(order);
      if (req.user.role === 'CUSTOMER') {
        return {
          ...serialized,
          deliveryOtp: order.deliveryOtp || null
        };
      }
      return serialized;
    }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        store: { select: { id: true, name: true, ownerId: true, address: true, phone: true } },
        customer: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role === 'MERCHANT') {
      const merchantStoreId = await resolveMerchantStoreIdForUser(req.user);
      if (!merchantStoreId || order.store.id !== merchantStoreId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (req.user.role === 'CUSTOMER' && order.customer.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'DRIVER') {
      const driverId = await resolveDriverIdForUser(req.user);
      if (!driverId || order.driver?.id !== driverId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const serialized = serializeOrder(order);
    if (req.user.role === 'CUSTOMER') {
      return res.json({
        ...serialized,
        deliveryOtp: order.deliveryOtp || null
      });
    }

    return res.json(serialized);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.post('/api/orders', authMiddleware, roleMiddleware('CUSTOMER'), async (req, res) => {
  try {
    const { storeId, items, customerInfo, deliveryAddress } = req.body;

    // Calculate total
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId || item.id }
      });

      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId || item.id} not found` });
      }

      total += product.price * item.quantity;
      orderItems.push({
        productId: item.productId || item.id,
        quantity: item.quantity,
        price: product.price
      });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return res.status(400).json({ error: 'Store not found' });
    }

    total += store.deliveryFee;

    const createInclude = {
      store: { select: { name: true, address: true } },
      customer: { select: { name: true } },
      driver: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true } }
        }
      }
    };

    const { storeCode, nextSequence } = await generateNextOrderNumber(store);
    let order = null;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidateOrderNumber = formatOrderNumber(storeCode, nextSequence + attempt);

      try {
        order = await prisma.order.create({
          data: {
            storeId,
            customerId: req.user.id,
            orderNumber: candidateOrderNumber,
            total,
            deliveryFee: store.deliveryFee,
            customerInfo: JSON.stringify(customerInfo),
            deliveryAddress: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
            items: {
              create: orderItems
            }
          },
          include: createInclude
        });
        break;
      } catch (error) {
        const isOrderNumberConflict =
          error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2002'
          && String(error.meta?.target || '').includes('orderNumber');

        if (!isOrderNumberConflict) {
          throw error;
        }
      }
    }

    if (!order) {
      return res.status(500).json({ error: 'Failed to allocate order number. Please try again.' });
    }

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id/status',
  authMiddleware,
  roleMiddleware('ADMIN', 'MERCHANT', 'DRIVER'),
  body('status').trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const normalizedStatus = normalizeOrderStatus(req.body.status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid order status' });
      }

      const existingOrder = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          store: true,
          items: {
            include: {
              product: { select: { name: true } }
            }
          },
          customer: { select: { name: true } },
          driver: { select: { name: true } }
        }
      });

      if (!existingOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (req.user.role === 'MERCHANT') {
        const merchantStoreId = await resolveMerchantStoreIdForUser(req.user);
        if (!merchantStoreId || existingOrder.store.id !== merchantStoreId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let resolvedDriverId = existingOrder.driverId;
      const updateData = {
        status: normalizedStatus,
        driverId: resolvedDriverId
      };

      if (req.user.role === 'DRIVER') {
        const driverId = await resolveDriverIdForUser(req.user);
        if (!driverId) {
          return res.status(403).json({ error: 'Driver profile not found' });
        }

        if (normalizedStatus === ORDER_STATUS.OUT_FOR_DELIVERY) {
          const ownedByCurrentDriver = await isOrderOwnedByDriver({
            orderDriverId: existingOrder.driverId,
            driverId,
            userId: req.user.id
          });

          if (existingOrder.driverId && !ownedByCurrentDriver) {
            return res.status(403).json({ error: 'Order already assigned to another driver' });
          }
          resolvedDriverId = driverId;
          updateData.driverId = driverId;
          // Generate a fresh 4-digit code when a driver accepts delivery.
          updateData.deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
          updateData.deliveryOtpVerifiedAt = null;
        } else if (normalizedStatus === ORDER_STATUS.DELIVERED) {
          if (!existingOrder.deliveryOtp) {
            return res.status(409).json({ error: 'Delivery code not generated yet. Accept the order first.' });
          }
          if (!existingOrder.deliveryOtpVerifiedAt) {
            return res.status(423).json({ error: 'Complete Delivery is locked until OTP is verified.' });
          }
        } else {
          const ownedByCurrentDriver = await isOrderOwnedByDriver({
            orderDriverId: existingOrder.driverId,
            driverId,
            userId: req.user.id
          });

          if (!ownedByCurrentDriver) {
            return res.status(403).json({ error: 'Access denied' });
          }
        }
      } else if (req.body.driverId) {
        resolvedDriverId = req.body.driverId;
        updateData.driverId = req.body.driverId;
      }

      updateData.driverId = resolvedDriverId;

      const updatedOrder = await prisma.order.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          store: { select: { name: true, ownerId: true } },
          customer: { select: { name: true } },
          driver: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true } }
            }
          }
        }
      });

      res.json(serializeOrder(updatedOrder));
    } catch (error) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  }
);

app.post('/api/orders/:id/otp/verify',
  authMiddleware,
  roleMiddleware('DRIVER'),
  body('otp').trim().matches(/^\d{4}$/),
  validate,
  async (req, res) => {
    try {
      const driverId = await resolveDriverIdForUser(req.user);
      if (!driverId) {
        return res.status(403).json({ error: 'Driver profile not found' });
      }

      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          status: true,
          driverId: true,
          deliveryOtp: true,
          deliveryOtpVerifiedAt: true
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const ownedByCurrentDriver = await isOrderOwnedByDriver({
        orderDriverId: order.driverId,
        driverId,
        userId: req.user.id
      });

      if (!ownedByCurrentDriver) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (normalizeOrderStatus(order.status) !== ORDER_STATUS.OUT_FOR_DELIVERY) {
        return res.status(409).json({ error: 'OTP can only be verified for active deliveries.' });
      }

      if (!order.deliveryOtp) {
        return res.status(409).json({ error: 'Delivery code not generated for this order yet.' });
      }

      if (req.body.otp !== order.deliveryOtp) {
        return res.status(400).json({ error: 'Incorrect OTP. Ask the customer for the correct code.' });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryOtpVerifiedAt: new Date() }
      });

      return res.json({ verified: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify OTP' });
    }
  }
);

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
