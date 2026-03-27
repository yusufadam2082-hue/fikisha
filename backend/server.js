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
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';

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
  ASSIGNED: 'ASSIGNED',
  DRIVER_ACCEPTED: 'DRIVER_ACCEPTED',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

const ACTIVE_DRIVER_STATUSES = [
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.DRIVER_ACCEPTED,
  ORDER_STATUS.OUT_FOR_DELIVERY
];

const SETTLEMENT_TYPE = {
  MERCHANT: 'MERCHANT_SETTLEMENT',
  DRIVER: 'DRIVER_PAYOUT'
};

const PAYMENT_PROVIDER = {
  MOCK: 'MOCK',
  STRIPE: 'STRIPE',
  MPESA: 'MPESA'
};

const PAYMENT_INTENT_STATUS = {
  REQUIRES_ACTION: 'REQUIRES_ACTION',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

const ORDER_STATUS_ALIASES = {
  PENDING: ORDER_STATUS.PENDING,
  CONFIRMED: ORDER_STATUS.CONFIRMED,
  PREPARING: ORDER_STATUS.PREPARING,
  ASSIGNED: ORDER_STATUS.ASSIGNED,
  DRIVERACCEPTED: ORDER_STATUS.DRIVER_ACCEPTED,
  DRIVER_ACCEPTED: ORDER_STATUS.DRIVER_ACCEPTED,
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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY || '';
const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
const mpesaShortcode = process.env.MPESA_SHORTCODE || '';
const mpesaPasskey = process.env.MPESA_PASSKEY || '';
const mpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
const paymentReconciliationIntervalMs = Math.max(30_000, Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS || 120_000));

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
  } else if (normalizedStatus === ORDER_STATUS.ASSIGNED || normalizedStatus === ORDER_STATUS.READY_FOR_PICKUP) {
    statusAdjustment = -9;
  } else if (normalizedStatus === ORDER_STATUS.DRIVER_ACCEPTED) {
    statusAdjustment = -11;
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

const stringifyJsonField = (value) => {
  if (value == null) {
    return null;
  }

  return JSON.stringify(value);
};

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const normalizePaymentProvider = (provider) => {
  const normalized = String(provider || PAYMENT_PROVIDER.MOCK).trim().toUpperCase();
  if (normalized === PAYMENT_PROVIDER.STRIPE || normalized === 'CARD') {
    return PAYMENT_PROVIDER.STRIPE;
  }

  if (normalized === PAYMENT_PROVIDER.MPESA || normalized === 'M-PESA' || normalized === 'M_PESA') {
    return PAYMENT_PROVIDER.MPESA;
  }

  return PAYMENT_PROVIDER.MOCK;
};

const normalizeCurrency = (currency) => String(currency || 'KES').trim().toUpperCase() || 'KES';

const toMinorUnits = (amount, currency) => {
  const zeroDecimalCurrencies = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
  const multiplier = zeroDecimalCurrencies.has(normalizeCurrency(currency)) ? 1 : 100;
  return Math.round(Number(amount || 0) * multiplier);
};

const buildFrontendBaseUrl = (req, overrideUrl) => {
  const candidate = String(overrideUrl || req.body?.returnUrlBase || req.headers.origin || configuredCorsOrigins[0] || 'http://localhost:5173');
  return candidate.replace(/\/+$/, '');
};

const buildBackendBaseUrl = (req) => {
  const explicit = (process.env.BACKEND_PUBLIC_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().split(',')[0].trim();
  return `${protocol}://${host}`.replace(/\/+$/, '');
};

const normalizePhoneNumber = (rawPhone) => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('254')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  return digits;
};

const paymentIntentToOrderPaymentStatus = (status) => {
  if (status === PAYMENT_INTENT_STATUS.SUCCEEDED) {
    return 'PAID';
  }

  if (status === PAYMENT_INTENT_STATUS.FAILED || status === PAYMENT_INTENT_STATUS.CANCELLED) {
    return 'FAILED';
  }

  if (status === PAYMENT_INTENT_STATUS.PROCESSING || status === PAYMENT_INTENT_STATUS.REQUIRES_ACTION) {
    return 'PENDING';
  }

  return 'UNPAID';
};

const parsePaymentMetadata = (value) => {
  const parsed = parseJsonField(value, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const buildPaymentAction = (intent) => {
  const metadata = parsePaymentMetadata(intent?.metadata);
  const provider = normalizePaymentProvider(intent?.provider);

  if (provider === PAYMENT_PROVIDER.STRIPE) {
    return {
      type: 'REDIRECT',
      url: metadata.checkoutUrl || null,
      sessionId: metadata.checkoutSessionId || intent?.providerRef || null,
      message: metadata.message || 'Complete payment in Stripe Checkout.'
    };
  }

  if (provider === PAYMENT_PROVIDER.MPESA) {
    return {
      type: 'STK_PUSH',
      checkoutRequestId: metadata.checkoutRequestId || intent?.providerRef || null,
      merchantRequestId: metadata.merchantRequestId || null,
      phoneNumber: metadata.phoneNumber || null,
      message: metadata.message || 'Confirm the M-Pesa prompt on your phone to complete payment.'
    };
  }

  return resolvePaymentAction(provider, intent);
};

const adminPaymentIntentInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  order: {
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      status: true,
      total: true,
      createdAt: true,
      store: { select: { id: true, name: true } }
    }
  }
};

const serializePaymentIntentForAdmin = (intent) => {
  if (!intent) {
    return null;
  }

  const metadata = parsePaymentMetadata(intent.metadata);
  const adminNotes = Array.isArray(metadata.adminNotes) ? metadata.adminNotes : [];
  return {
    ...intent,
    metadata,
    action: buildPaymentAction(intent),
    retrySourceIntentId: metadata.retriedFromIntentId || null,
    retryCount: Number(metadata.retryCount || 0),
    adminNotes,
    linkedOrderNumber: intent.order?.orderNumber || null,
    customerName: intent.customer?.name || null,
    customerPhone: intent.customer?.phone || null,
    storeName: intent.order?.store?.name || null
  };
};

const loadAdminPaymentIntentById = (id) => {
  return prisma.paymentIntent.findUnique({
    where: { id },
    include: adminPaymentIntentInclude
  });
};

const buildAdminPaymentRetryHistory = async (intent) => {
  if (!intent) {
    return [];
  }

  const candidates = await prisma.paymentIntent.findMany({
    where: {
      customerId: intent.customerId,
      amount: intent.amount,
      currency: intent.currency
    },
    orderBy: { createdAt: 'asc' },
    include: adminPaymentIntentInclude
  });

  const serializedCandidates = candidates.map(serializePaymentIntentForAdmin);
  const itemsById = new Map(serializedCandidates.map((entry) => [entry.id, entry]));
  const childIdsByParent = new Map();

  serializedCandidates.forEach((entry) => {
    if (!entry.retrySourceIntentId) {
      return;
    }

    if (!childIdsByParent.has(entry.retrySourceIntentId)) {
      childIdsByParent.set(entry.retrySourceIntentId, []);
    }
    childIdsByParent.get(entry.retrySourceIntentId).push(entry.id);
  });

  let rootId = intent.id;
  const upwardSeen = new Set();
  while (itemsById.has(rootId) && itemsById.get(rootId)?.retrySourceIntentId && !upwardSeen.has(rootId)) {
    upwardSeen.add(rootId);
    const parentId = itemsById.get(rootId).retrySourceIntentId;
    if (!itemsById.has(parentId)) {
      break;
    }
    rootId = parentId;
  }

  const ordered = [];
  const walk = (intentId, depth = 0, lineageSeen = new Set()) => {
    if (!itemsById.has(intentId) || lineageSeen.has(intentId)) {
      return;
    }

    lineageSeen.add(intentId);
    const current = itemsById.get(intentId);
    ordered.push({
      ...current,
      retryDepth: depth,
      isSelected: current.id === intent.id
    });

    const childIds = (childIdsByParent.get(intentId) || []).sort((leftId, rightId) => {
      const left = itemsById.get(leftId);
      const right = itemsById.get(rightId);
      return new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime();
    });

    childIds.forEach((childId) => walk(childId, depth + 1, new Set(lineageSeen)));
  };

  walk(rootId);

  if (!ordered.some((entry) => entry.id === intent.id)) {
    ordered.push({
      ...serializePaymentIntentForAdmin(intent),
      retryDepth: 0,
      isSelected: true
    });
  }

  return ordered;
};

const escapeCsvValue = (value) => {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const buildPaymentIntentAdminWhere = (query = {}) => {
  const { search, status, provider, linkedOnly, attentionOnly } = query;
  const where = {};

  if (status) {
    where.status = String(status).toUpperCase();
  }
  if (provider) {
    where.provider = normalizePaymentProvider(provider);
  }
  if (String(linkedOnly || '').toLowerCase() === 'true') {
    where.orderId = { not: null };
  }
  if (search) {
    where.OR = [
      { id: { contains: String(search) } },
      { providerRef: { contains: String(search) } },
      { order: { is: { orderNumber: { contains: String(search) } } } },
      { order: { is: { store: { name: { contains: String(search) } } } } },
      { customer: { is: { name: { contains: String(search) } } } },
      { customer: { is: { phone: { contains: String(search) } } } }
    ];
  }

  if (String(attentionOnly || '').toLowerCase() === 'true') {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const attentionClauses = [
      { status: PAYMENT_INTENT_STATUS.FAILED },
      { status: PAYMENT_INTENT_STATUS.CANCELLED },
      {
        status: { in: [PAYMENT_INTENT_STATUS.PROCESSING, PAYMENT_INTENT_STATUS.REQUIRES_ACTION] },
        createdAt: { lte: staleThreshold }
      }
    ];

    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: attentionClauses }
      ];
      delete where.OR;
    } else {
      where.OR = attentionClauses;
    }
  }

  return where;
};

const getMpesaBaseUrl = () => (mpesaEnvironment === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke');

const buildMpesaTimestamp = () => {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ];

  return parts.join('');
};

const getMpesaAccessToken = async () => {
  const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');
  const response = await fetch(`${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.errorMessage || payload.error_description || 'Failed to authenticate with M-Pesa');
  }

  return payload.access_token;
};

const isMpesaConfigured = () => Boolean(mpesaConsumerKey && mpesaConsumerSecret && mpesaShortcode && mpesaPasskey);

const createStripeCheckoutSession = async ({ req, intent, customer, description }) => {
  if (!stripe) {
    const fallbackIntent = {
      ...intent,
      provider: PAYMENT_PROVIDER.MOCK,
      providerRef: createPaymentProviderRef(PAYMENT_PROVIDER.MOCK)
    };

    return {
      providerRef: fallbackIntent.providerRef,
      provider: PAYMENT_PROVIDER.STRIPE,
      status: PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
      metadata: {
        mode: 'fallback',
        checkoutUrl: `/mock-pay/${intent.id}`,
        checkoutSessionId: fallbackIntent.providerRef,
        message: 'Stripe is not configured. Using the mock checkout route until STRIPE_SECRET_KEY is set.'
      },
      action: {
        type: 'REDIRECT',
        url: `/mock-pay/${intent.id}`,
        sessionId: fallbackIntent.providerRef,
        message: 'Stripe is not configured. Using the mock checkout route until STRIPE_SECRET_KEY is set.'
      }
    };
  }

  const frontendBaseUrl = buildFrontendBaseUrl(req);
  const successUrl = `${frontendBaseUrl}/customer/tracking?payment_intent=${encodeURIComponent(intent.id)}&payment_status=success`;
  const cancelUrl = `${frontendBaseUrl}/customer/tracking?payment_intent=${encodeURIComponent(intent.id)}&payment_status=cancelled`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: intent.id,
    customer_email: customer?.email || undefined,
    metadata: {
      intentId: intent.id,
      customerId: intent.customerId
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: intent.currency.toLowerCase(),
          unit_amount: toMinorUnits(intent.amount, intent.currency),
          product_data: {
            name: description || `Fikisha order payment ${intent.id.slice(0, 8)}`
          }
        }
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl
  });

  return {
    providerRef: session.id,
    provider: PAYMENT_PROVIDER.STRIPE,
    status: PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
    metadata: {
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      successUrl,
      cancelUrl,
      message: 'Complete payment in Stripe Checkout.'
    },
    action: {
      type: 'REDIRECT',
      url: session.url,
      sessionId: session.id,
      message: 'Complete payment in Stripe Checkout.'
    }
  };
};

const createMpesaPaymentRequest = async ({ req, intent, phoneNumber, description }) => {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhoneNumber) {
    const error = new Error('A valid phone number is required for M-Pesa checkout');
    error.statusCode = 400;
    throw error;
  }

  if (!isMpesaConfigured()) {
    const mockProviderRef = createPaymentProviderRef(PAYMENT_PROVIDER.MPESA);
    return {
      providerRef: mockProviderRef,
      provider: PAYMENT_PROVIDER.MPESA,
      status: PAYMENT_INTENT_STATUS.PROCESSING,
      metadata: {
        mode: 'fallback',
        phoneNumber: normalizedPhoneNumber,
        checkoutRequestId: mockProviderRef,
        message: 'M-Pesa credentials are not configured. Using a simulated STK push until MPESA_* env vars are set.'
      },
      action: {
        type: 'STK_PUSH',
        checkoutRequestId: mockProviderRef,
        phoneNumber: normalizedPhoneNumber,
        message: 'M-Pesa credentials are not configured. Using a simulated STK push until MPESA_* env vars are set.'
      }
    };
  }

  const timestamp = buildMpesaTimestamp();
  const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString('base64');
  const callbackUrl = (process.env.MPESA_CALLBACK_URL || `${buildBackendBaseUrl(req)}/api/payments/webhooks/mpesa`).replace(/\/+$/, '');
  const accessToken = await getMpesaAccessToken();
  const response = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.max(1, Math.round(intent.amount)),
      PartyA: normalizedPhoneNumber,
      PartyB: mpesaShortcode,
      PhoneNumber: normalizedPhoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: `FK-${intent.id.slice(0, 8).toUpperCase()}`,
      TransactionDesc: description || 'Fikisha order payment'
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || String(payload.ResponseCode || '') !== '0') {
    const error = new Error(payload.errorMessage || payload.ResponseDescription || 'Failed to start M-Pesa payment');
    error.statusCode = 502;
    throw error;
  }

  return {
    providerRef: payload.CheckoutRequestID,
    provider: PAYMENT_PROVIDER.MPESA,
    status: PAYMENT_INTENT_STATUS.PROCESSING,
    metadata: {
      phoneNumber: normalizedPhoneNumber,
      merchantRequestId: payload.MerchantRequestID || null,
      checkoutRequestId: payload.CheckoutRequestID || null,
      message: payload.CustomerMessage || 'Confirm the payment prompt on your phone.'
    },
    action: {
      type: 'STK_PUSH',
      checkoutRequestId: payload.CheckoutRequestID || null,
      merchantRequestId: payload.MerchantRequestID || null,
      phoneNumber: normalizedPhoneNumber,
      message: payload.CustomerMessage || 'Confirm the payment prompt on your phone.'
    }
  };
};

const createProviderPayment = async ({ req, intent, customer, phoneNumber, description }) => {
  const provider = normalizePaymentProvider(intent.provider);
  if (provider === PAYMENT_PROVIDER.STRIPE) {
    return createStripeCheckoutSession({ req, intent, customer, description });
  }

  if (provider === PAYMENT_PROVIDER.MPESA) {
    return createMpesaPaymentRequest({ req, intent, phoneNumber, description });
  }

  const providerRef = createPaymentProviderRef(provider);
  const mockIntent = {
    ...intent,
    provider,
    providerRef
  };

  return {
    providerRef,
    provider,
    status: PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
    metadata: {
      mode: 'mock',
      message: resolvePaymentAction(provider, mockIntent).message
    },
    action: resolvePaymentAction(provider, mockIntent)
  };
};

const syncOrderPaymentFromIntent = async (intent) => {
  if (!intent?.orderId) {
    return;
  }

  await prisma.order.update({
    where: { id: intent.orderId },
    data: {
      paymentStatus: paymentIntentToOrderPaymentStatus(intent.status),
      paymentProvider: intent.provider,
      paymentIntentRef: intent.id
    }
  }).catch(() => {});
};

const updateIntentStatus = async (intent, nextStatus, extraData = {}) => {
  const nextIntent = await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: nextStatus,
      providerRef: extraData.providerRef || intent.providerRef || null,
      metadata: extraData.metadata ? stringifyJsonField(extraData.metadata) : intent.metadata
    }
  });

  await syncOrderPaymentFromIntent(nextIntent);
  return nextIntent;
};

const mapStripeSessionStatus = (session) => {
  if (session?.payment_status === 'paid') {
    return PAYMENT_INTENT_STATUS.SUCCEEDED;
  }

  if (session?.status === 'expired') {
    return PAYMENT_INTENT_STATUS.CANCELLED;
  }

  if (session?.status === 'complete') {
    return PAYMENT_INTENT_STATUS.PROCESSING;
  }

  return PAYMENT_INTENT_STATUS.REQUIRES_ACTION;
};

const reconcileStripeIntent = async (intent) => {
  if (!stripe || !intent?.providerRef) {
    return intent;
  }

  const session = await stripe.checkout.sessions.retrieve(intent.providerRef);
  const nextStatus = mapStripeSessionStatus(session);
  const metadata = {
    ...parsePaymentMetadata(intent.metadata),
    checkoutUrl: session.url || parsePaymentMetadata(intent.metadata).checkoutUrl || null,
    checkoutSessionId: session.id,
    lastReconciledAt: new Date().toISOString()
  };

  return updateIntentStatus(intent, nextStatus, {
    providerRef: session.id,
    metadata
  });
};

const reconcileMpesaIntent = async (intent) => {
  if (!isMpesaConfigured() || !intent?.providerRef) {
    return intent;
  }

  const timestamp = buildMpesaTimestamp();
  const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString('base64');
  const accessToken = await getMpesaAccessToken();
  const response = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: intent.providerRef
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.errorMessage || payload.ResponseDescription || 'Failed to query M-Pesa transaction status');
  }

  let nextStatus = PAYMENT_INTENT_STATUS.PROCESSING;
  if (String(payload.ResultCode || '') === '0') {
    nextStatus = PAYMENT_INTENT_STATUS.SUCCEEDED;
  } else if (payload.ResultCode != null) {
    nextStatus = PAYMENT_INTENT_STATUS.FAILED;
  }

  return updateIntentStatus(intent, nextStatus, {
    providerRef: payload.CheckoutRequestID || intent.providerRef,
    metadata: {
      ...parsePaymentMetadata(intent.metadata),
      mpesaReceiptNumber: payload.MpesaReceiptNumber || null,
      resultCode: payload.ResultCode ?? null,
      resultDescription: payload.ResultDesc || payload.ResponseDescription || null,
      lastReconciledAt: new Date().toISOString()
    }
  });
};

const reconcilePaymentIntent = async (intent) => {
  const provider = normalizePaymentProvider(intent?.provider);
  if (provider === PAYMENT_PROVIDER.STRIPE) {
    return reconcileStripeIntent(intent);
  }

  if (provider === PAYMENT_PROVIDER.MPESA) {
    return reconcileMpesaIntent(intent);
  }

  if (!intent) {
    return intent;
  }

  const intentAgeMs = Date.now() - new Date(intent.createdAt).getTime();
  if (intentAgeMs > 30 * 60 * 1000 && intent.status !== PAYMENT_INTENT_STATUS.SUCCEEDED) {
    return updateIntentStatus(intent, PAYMENT_INTENT_STATUS.CANCELLED, {
      metadata: {
        ...parsePaymentMetadata(intent.metadata),
        lastReconciledAt: new Date().toISOString(),
        expiredByReconciler: true
      }
    });
  }

  return intent;
};

const verifyStripeWebhook = (req) => {
  if (!stripe) {
    const error = new Error('Stripe is not configured');
    error.statusCode = 503;
    throw error;
  }

  if (!stripeWebhookSecret) {
    return req.body;
  }

  const signature = (req.headers['stripe-signature'] || '').toString();
  if (!signature) {
    const error = new Error('Missing Stripe signature');
    error.statusCode = 401;
    throw error;
  }

  return stripe.webhooks.constructEvent(req.rawBody || Buffer.from(JSON.stringify(req.body || {})), signature, stripeWebhookSecret);
};

const verifyMpesaWebhook = (req) => {
  const mpesaWebhookSecret = (process.env.MPESA_WEBHOOK_SECRET || '').trim();
  if (!mpesaWebhookSecret) {
    return req.body;
  }

  const signature = (req.headers['x-mpesa-signature'] || '').toString().trim();
  const expected = createHmac('sha256', mpesaWebhookSecret)
    .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
    .digest('hex');

  if (!safeCompare(signature, expected)) {
    const error = new Error('Invalid M-Pesa signature');
    error.statusCode = 401;
    throw error;
  }

  return req.body;
};

const parseWebhookPayload = (provider, payload) => {
  if (provider === PAYMENT_PROVIDER.STRIPE) {
    const event = payload;
    const session = event?.data?.object;
    const intentId = session?.metadata?.intentId || session?.client_reference_id || null;
    let status = PAYMENT_INTENT_STATUS.PROCESSING;

    if (event?.type === 'checkout.session.completed' || event?.type === 'checkout.session.async_payment_succeeded') {
      status = session?.payment_status === 'paid' ? PAYMENT_INTENT_STATUS.SUCCEEDED : PAYMENT_INTENT_STATUS.PROCESSING;
    } else if (event?.type === 'checkout.session.expired') {
      status = PAYMENT_INTENT_STATUS.CANCELLED;
    } else if (event?.type === 'checkout.session.async_payment_failed') {
      status = PAYMENT_INTENT_STATUS.FAILED;
    }

    return {
      providerEventId: event?.id || null,
      eventType: event?.type || 'UNKNOWN',
      intentId,
      providerRef: session?.id || null,
      status,
      payload: event
    };
  }

  if (provider === PAYMENT_PROVIDER.MPESA) {
    const callback = payload?.Body?.stkCallback || payload?.stkCallback || payload?.body?.stkCallback || {};
    const checkoutRequestId = callback.CheckoutRequestID || payload?.CheckoutRequestID || null;
    const metadataItems = Array.isArray(callback.CallbackMetadata?.Item)
      ? callback.CallbackMetadata.Item
      : [];
    const metadataMap = Object.fromEntries(metadataItems.map((item) => [item.Name, item.Value]));
    const resultCode = Number(callback.ResultCode ?? payload?.ResultCode ?? -1);

    return {
      providerEventId: `${checkoutRequestId || 'mpesa'}:${resultCode}:${metadataMap.MpesaReceiptNumber || 'event'}`,
      eventType: 'mpesa.stk_callback',
      intentId: payload?.intentId || null,
      providerRef: checkoutRequestId,
      status: resultCode === 0 ? PAYMENT_INTENT_STATUS.SUCCEEDED : PAYMENT_INTENT_STATUS.FAILED,
      payload,
      metadata: {
        resultCode,
        resultDescription: callback.ResultDesc || payload?.ResultDesc || null,
        mpesaReceiptNumber: metadataMap.MpesaReceiptNumber || null,
        phoneNumber: metadataMap.PhoneNumber || null,
        transactionDate: metadataMap.TransactionDate || null,
        amount: metadataMap.Amount || null
      }
    };
  }

  return {
    providerEventId: (payload?.providerEventId || payload?.id || '').toString().trim() || null,
    eventType: (payload?.eventType || payload?.type || 'UNKNOWN').toString().trim(),
    intentId: (payload?.intentId || '').toString().trim() || null,
    providerRef: (payload?.providerRef || '').toString().trim() || null,
    status: (payload?.status || PAYMENT_INTENT_STATUS.PROCESSING).toString().trim().toUpperCase(),
    payload
  };
};

const verifyAndParseWebhook = (provider, req) => {
  if (provider === PAYMENT_PROVIDER.STRIPE) {
    return parseWebhookPayload(provider, verifyStripeWebhook(req));
  }

  if (provider === PAYMENT_PROVIDER.MPESA) {
    return parseWebhookPayload(provider, verifyMpesaWebhook(req));
  }

  return parseWebhookPayload(provider, req.body || {});
};

const runPaymentReconciliationPass = async () => {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      status: {
        in: [PAYMENT_INTENT_STATUS.REQUIRES_ACTION, PAYMENT_INTENT_STATUS.PROCESSING]
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 25
  });

  for (const intent of intents) {
    try {
      await reconcilePaymentIntent(intent);
    } catch (error) {
      console.error(`Payment reconciliation failed for intent ${intent.id}:`, error?.message || error);
    }
  }
};

const startPaymentReconciliationLoop = () => {
  if (process.env.PAYMENT_RECONCILIATION_DISABLED === 'true') {
    return;
  }

  setInterval(() => {
    runPaymentReconciliationPass().catch((error) => {
      console.error('Payment reconciliation pass failed:', error?.message || error);
    });
  }, paymentReconciliationIntervalMs);
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

const serializeOrder = (order, options = {}) => {
  const { paymentSettled = false } = options;
  const normalizedStatus = normalizeOrderStatus(order.status);
  const serialized = {
    ...order,
    orderNumber: order.orderNumber || buildLegacyOrderNumber(order),
    customerInfo: parseJsonField(order.customerInfo, {}),
    deliveryAddress: parseJsonField(order.deliveryAddress, null),
    deliveryOtpRequired: normalizedStatus === ORDER_STATUS.OUT_FOR_DELIVERY,
    deliveryOtpVerified: Boolean(order.deliveryOtpVerifiedAt),
    paymentSettled,
    assignedDriverId: order.driverId || null,
    assignedDriverName: order.driver?.name || null,
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

const createPaymentProviderRef = (provider) => {
  const prefix = String(provider || 'MOCK').toUpperCase();
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
};

const resolvePaymentAction = (provider, intent) => {
  const normalized = String(provider || '').toUpperCase();
  if (normalized === 'MPESA') {
    return {
      type: 'STK_PUSH',
      checkoutRequestId: intent.providerRef,
      message: 'Mock M-Pesa STK push initiated. Confirm from webhook endpoint to complete payment.'
    };
  }

  return {
    type: 'REDIRECT',
    url: `/mock-pay/${intent.id}`,
    message: 'Mock redirect payment flow created. Confirm from webhook endpoint to complete payment.'
  };
};

const getSettlementCycleKey = (order) => {
  const referenceDate = new Date(order?.updatedAt || order?.createdAt || Date.now());
  return referenceDate.toISOString().slice(0, 10);
};

const getSettledOrderIds = async (orderIds) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return new Set();
  }

  const ledger = await readAccountingPayoutLedger();
  return new Set(
    ledger
      .filter((entry) => entry?.orderId && orderIds.includes(entry.orderId))
      .map((entry) => entry.orderId)
  );
};

const appendSettlementRecordsForOrder = async (order, actor = {}) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.DELIVERED) {
    return [];
  }

  const ledger = await readAccountingPayoutLedger();
  const existingEntries = ledger.filter((entry) => entry?.orderId === order.id);
  const nextEntries = [];
  const cycleKey = getSettlementCycleKey(order);
  const merchantAmount = Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0) - Number(order.tax || 0));
  const driverAmount = Math.max(0, Number(order.deliveryFee || 0));

  if (!existingEntries.some((entry) => entry.type === SETTLEMENT_TYPE.MERCHANT) && merchantAmount > 0) {
    nextEntries.push({
      id: randomUUID(),
      type: SETTLEMENT_TYPE.MERCHANT,
      orderId: order.id,
      storeId: order.storeId,
      storeName: order.store?.name || 'Unknown store',
      cycleKey,
      amount: merchantAmount,
      note: 'Auto-settled merchant balance after OTP-confirmed delivery',
      actorUserId: actor.userId || null,
      actorRole: actor.role || 'SYSTEM',
      createdAt: new Date().toISOString()
    });
  }

  if (order.driverId && !existingEntries.some((entry) => entry.type === SETTLEMENT_TYPE.DRIVER) && driverAmount > 0) {
    nextEntries.push({
      id: randomUUID(),
      type: SETTLEMENT_TYPE.DRIVER,
      orderId: order.id,
      storeId: order.storeId,
      storeName: order.store?.name || 'Unknown store',
      driverId: order.driverId,
      driverName: order.driver?.name || 'Assigned driver',
      cycleKey,
      amount: driverAmount,
      note: 'Auto-settled driver payout after successful delivery',
      actorUserId: actor.userId || null,
      actorRole: actor.role || 'SYSTEM',
      createdAt: new Date().toISOString()
    });
  }

  if (nextEntries.length === 0) {
    return existingEntries;
  }

  await writeAccountingPayoutLedger([...ledger, ...nextEntries]);

  await prisma.payoutLedger.createMany({
    data: nextEntries.map((entry) => ({
      type: entry.type,
      orderId: entry.orderId || null,
      storeId: entry.storeId || null,
      storeName: entry.storeName || null,
      driverId: entry.driverId || null,
      driverName: entry.driverName || null,
      cycleKey: entry.cycleKey || null,
      amount: Number(entry.amount || 0),
      note: entry.note || null,
      actorUserId: entry.actorUserId || null,
      actorRole: entry.actorRole || null,
      source: 'AUTO'
    }))
  }).catch(() => {});

  return [...existingEntries, ...nextEntries];
};

const parseCoordinatePair = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) {
      return null;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude, longitude };
    }

    return null;
  }

  if (typeof value === 'object') {
    const directLat = Number(value.lat ?? value.latitude);
    const directLng = Number(value.lng ?? value.longitude ?? value.lon);
    if (Number.isFinite(directLat) && Number.isFinite(directLng) && Math.abs(directLat) <= 90 && Math.abs(directLng) <= 180) {
      return { latitude: directLat, longitude: directLng };
    }

    const nested = value.coords || value.location || value.geometry || value.position;
    if (nested) {
      return parseCoordinatePair(nested);
    }

    return parseCoordinatePair(value.city || value.address || value.street || null);
  }

  return null;
};

const haversineKm = (a, b) => {
  if (!a || !b) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * centralAngle;
};

const extractOrderCoordinates = (order) => {
  return (
    parseCoordinatePair(parseOrderAddress(order))
    || parseCoordinatePair(parseJsonField(order?.customerInfo, null))
    || null
  );
};

const findAssignableDriver = async (order) => {
  const deliveryCoords = extractOrderCoordinates(order);

  const candidates = await prisma.driver.findMany({
    where: {
      available: true,
      user: {
        banned: false
      }
    },
    include: {
      user: {
        select: { id: true, name: true }
      },
      orders: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          createdAt: true,
          deliveryAddress: true,
          customerInfo: true
        },
        orderBy: { updatedAt: 'desc' },
        take: 30
      }
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  const now = Date.now();
  const ranked = candidates
    .map((driver) => {
      const activeCount = driver.orders.filter((o) => ACTIVE_DRIVER_STATUSES.includes(normalizeOrderStatus(o.status))).length;
      const recent24hCount = driver.orders.filter((o) => (now - new Date(o.updatedAt).getTime()) <= 24 * 60 * 60 * 1000).length;
      const latestCoords = driver.orders.map(extractOrderCoordinates).find(Boolean) || null;
      const distanceKm = deliveryCoords && latestCoords ? haversineKm(latestCoords, deliveryCoords) : null;
      const latestActivity = driver.orders[0]?.updatedAt ? new Date(driver.orders[0].updatedAt).getTime() : new Date(driver.updatedAt).getTime();
      const idleHours = Math.max(0, (now - latestActivity) / (1000 * 60 * 60));

      const ratingScore = Number(driver.rating || 0) * 20;
      const workloadPenalty = activeCount * 80 + recent24hCount * 4;
      const distancePenalty = distanceKm != null ? distanceKm * 1.8 : 12;
      const idleBonus = Math.min(16, idleHours * 0.8);
      const score = ratingScore + idleBonus - workloadPenalty - distancePenalty;

      return {
        driver,
        score,
        distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(2)),
        activeCount,
        recent24hCount
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.driver || null;
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
app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  }
}));

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
      console.error('[auth/login] Failed login request:', {
        username: req.body?.username,
        message: error?.message,
        stack: error?.stack
      });
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

// Payment intent APIs are additive and can coexist with legacy checkout payloads.
app.post('/api/payments/intents',
  authMiddleware,
  roleMiddleware('CUSTOMER'),
  body('amount').isFloat({ gt: 0 }),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }),
  body('provider').optional().trim().isLength({ min: 2, max: 32 }),
  body('phoneNumber').optional({ nullable: true }).trim(),
  body('description').optional({ nullable: true }).trim(),
  validate,
  async (req, res) => {
    try {
      const idempotencyKey = (req.headers['x-idempotency-key'] || req.body.idempotencyKey || '').toString().trim() || null;
      const provider = normalizePaymentProvider(req.body.provider || PAYMENT_PROVIDER.MOCK);
      const currency = normalizeCurrency(req.body.currency || 'KES');
      const amount = Number(req.body.amount || 0);

      if (idempotencyKey) {
        const existing = await prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
        if (existing && existing.customerId === req.user.id) {
          return res.json({
            intent: existing,
            action: buildPaymentAction(existing)
          });
        }
      }

      const customer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, phone: true, name: true }
      });

      const seedIntent = await prisma.paymentIntent.create({
        data: {
          customerId: req.user.id,
          provider,
          providerRef: null,
          status: PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
          amount,
          currency,
          idempotencyKey,
          metadata: stringifyJsonField(req.body.metadata || null)
        }
      });

      const providerResult = await createProviderPayment({
        req,
        intent: seedIntent,
        customer,
        phoneNumber: req.body.phoneNumber || customer?.phone || null,
        description: req.body.description || null
      });

      const intent = await prisma.paymentIntent.update({
        where: { id: seedIntent.id },
        data: {
          provider: providerResult.provider || provider,
          providerRef: providerResult.providerRef || seedIntent.providerRef,
          status: providerResult.status || PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
          metadata: stringifyJsonField({
            ...parsePaymentMetadata(seedIntent.metadata),
            ...providerResult.metadata,
            amount,
            currency
          })
        }
      });

      return res.status(201).json({
        intent,
        action: providerResult.action || buildPaymentAction(intent)
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create payment intent' });
    }
  }
);

app.get('/api/payments/intents/:id', authMiddleware, async (req, res) => {
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (!intent) return res.status(404).json({ error: 'Payment intent not found' });
    if (req.user.role !== 'ADMIN' && intent.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({
      intent,
      action: buildPaymentAction(intent)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payment intent' });
  }
});

app.post('/api/payments/intents/:id/reconcile', authMiddleware, async (req, res) => {
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (!intent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    if (req.user.role !== 'ADMIN' && intent.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reconciledIntent = await reconcilePaymentIntent(intent);
    return res.json({
      intent: reconciledIntent,
      action: buildPaymentAction(reconciledIntent)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to reconcile payment intent' });
  }
});

app.post('/api/payments/intents/:id/retry', authMiddleware, roleMiddleware('CUSTOMER'), async (req, res) => {
  try {
    const existingIntent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (!existingIntent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    if (existingIntent.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existingIntent.status === PAYMENT_INTENT_STATUS.SUCCEEDED) {
      return res.status(409).json({ error: 'Payment is already completed for this intent' });
    }

    if ([PAYMENT_INTENT_STATUS.REQUIRES_ACTION, PAYMENT_INTENT_STATUS.PROCESSING].includes(existingIntent.status)) {
      const refreshedIntent = await reconcilePaymentIntent(existingIntent).catch(() => existingIntent);
      return res.json({
        intent: refreshedIntent,
        action: buildPaymentAction(refreshedIntent)
      });
    }

    const customer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, phone: true, name: true }
    });

    let linkedOrder = null;
    if (existingIntent.orderId) {
      linkedOrder = await prisma.order.findUnique({
        where: { id: existingIntent.orderId },
        include: {
          store: {
            select: { id: true, name: true }
          }
        }
      });

      if (!linkedOrder || linkedOrder.customerId !== req.user.id) {
        return res.status(404).json({ error: 'Linked order not found' });
      }

      if (String(linkedOrder.paymentStatus || '').toUpperCase() === 'PAID') {
        return res.status(409).json({ error: 'Order payment is already settled' });
      }
    }

    const existingMetadata = parsePaymentMetadata(existingIntent.metadata);
    const seedIntent = await prisma.paymentIntent.create({
      data: {
        customerId: existingIntent.customerId,
        provider: existingIntent.provider,
        providerRef: null,
        status: PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
        amount: existingIntent.amount,
        currency: existingIntent.currency,
        metadata: stringifyJsonField({
          ...existingMetadata,
          retriedFromIntentId: existingIntent.id,
          retriedAt: new Date().toISOString()
        })
      }
    });

    const providerResult = await createProviderPayment({
      req,
      intent: seedIntent,
      customer,
      phoneNumber: req.body.phoneNumber || existingMetadata.phoneNumber || customer?.phone || null,
      description: req.body.description
        || existingMetadata.description
        || (linkedOrder ? `Retry payment for order ${linkedOrder.orderNumber || linkedOrder.id.slice(-6).toUpperCase()} at ${linkedOrder.store?.name || 'Fikisha'}` : null)
    });

    const retriedIntent = await prisma.paymentIntent.update({
      where: { id: seedIntent.id },
      data: {
        provider: providerResult.provider || existingIntent.provider,
        providerRef: providerResult.providerRef || null,
        status: providerResult.status || PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
        metadata: stringifyJsonField({
          ...parsePaymentMetadata(seedIntent.metadata),
          ...providerResult.metadata,
          amount: existingIntent.amount,
            currency: existingIntent.currency,
            retryCount: Number(existingMetadata.retryCount || 0) + 1
        })
      }
    });

    if (linkedOrder) {
      await prisma.paymentIntent.update({
        where: { id: existingIntent.id },
        data: { orderId: null }
      }).catch(() => {});

      await prisma.paymentIntent.update({
        where: { id: retriedIntent.id },
        data: { orderId: linkedOrder.id }
      }).catch(() => {});

      await prisma.order.update({
        where: { id: linkedOrder.id },
        data: {
          paymentStatus: paymentIntentToOrderPaymentStatus(retriedIntent.status),
          paymentProvider: retriedIntent.provider,
          paymentIntentRef: retriedIntent.id
        }
      }).catch(() => {});
    }

    return res.status(201).json({
      intent: {
        ...retriedIntent,
        orderId: linkedOrder?.id || retriedIntent.orderId || null
      },
      action: providerResult.action || buildPaymentAction(retriedIntent)
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to retry payment intent' });
  }
});

app.post('/api/payments/webhooks/:provider', async (req, res) => {
  try {
    const provider = normalizePaymentProvider(req.params.provider);
    const webhook = verifyAndParseWebhook(provider, req);
    const providerEventId = webhook.providerEventId;
    const eventType = webhook.eventType;
    const status = webhook.status;

    if (!providerEventId) {
      return res.status(400).json({ error: 'providerEventId is required' });
    }

    try {
      await prisma.paymentEvent.create({
        data: {
          provider,
          providerEventId,
          eventType,
          payload: stringifyJsonField(webhook.payload || {}),
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.json({ received: true, duplicate: true });
      }
      throw error;
    }

    const nextStatus = Object.values(PAYMENT_INTENT_STATUS).includes(status)
      ? status
      : PAYMENT_INTENT_STATUS.PROCESSING;

    let intent = null;
    if (webhook.intentId) {
      intent = await prisma.paymentIntent.findUnique({ where: { id: webhook.intentId } });
    }

    if (!intent && webhook.providerRef) {
      intent = await prisma.paymentIntent.findFirst({
        where: {
          provider,
          providerRef: webhook.providerRef
        }
      });
    }

    if (intent) {
      const updatedIntent = await updateIntentStatus(intent, nextStatus, {
        providerRef: webhook.providerRef || intent.providerRef,
        metadata: {
          ...parsePaymentMetadata(intent.metadata),
          ...(webhook.metadata || {}),
          lastWebhookEventAt: new Date().toISOString(),
          lastWebhookEventType: eventType
        }
      });

      if (nextStatus === PAYMENT_INTENT_STATUS.PROCESSING) {
        await reconcilePaymentIntent(updatedIntent).catch(() => {});
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to process payment webhook' });
  }
});

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
      const dbRows = await prisma.payoutLedger.findMany({
        where: cycleKey ? { cycleKey: String(cycleKey) } : undefined,
        orderBy: { createdAt: 'desc' }
      });

      if (dbRows.length > 0) {
        return res.json(dbRows);
      }

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

      await prisma.payoutLedger.create({
        data: {
          type: SETTLEMENT_TYPE.MERCHANT,
          orderId: null,
          storeId,
          storeName,
          driverId: null,
          driverName: null,
          cycleKey: cycleKey || null,
          amount: Number(amount),
          note: note || 'Settled merchant balance',
          actorUserId: req.user.id,
          actorRole: req.user.role,
          source: 'MANUAL'
        }
      }).catch(() => {});

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

      await prisma.payoutLedger.deleteMany({
        where: cycleKey
          ? { cycleKey: String(cycleKey) }
          : {}
      }).catch(() => {});

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

      where = { driverId };
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

    const settledOrderIds = await getSettledOrderIds(orders.map((order) => order.id));

    res.json(orders.map((order) => {
      const serialized = serializeOrder(order, {
        paymentSettled: settledOrderIds.has(order.id)
      });
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

    const settledOrderIds = await getSettledOrderIds([order.id]);
    const serialized = serializeOrder(order, {
      paymentSettled: settledOrderIds.has(order.id)
    });
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
    const { storeId, items, customerInfo, deliveryAddress, paymentIntentId } = req.body;

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

    let paymentIntent = null;
    if (paymentIntentId) {
      paymentIntent = await prisma.paymentIntent.findUnique({ where: { id: String(paymentIntentId) } });
      if (!paymentIntent || paymentIntent.customerId !== req.user.id) {
        return res.status(400).json({ error: 'Invalid payment intent' });
      }

      if ([PAYMENT_INTENT_STATUS.FAILED, PAYMENT_INTENT_STATUS.CANCELLED].includes(paymentIntent.status)) {
        return res.status(409).json({ error: 'Payment intent is no longer payable. Start checkout again.' });
      }

      if (paymentIntent.orderId) {
        return res.status(409).json({ error: 'Payment intent already linked to an order' });
      }
    }

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
            paymentStatus: paymentIntent
              ? (paymentIntent.status === PAYMENT_INTENT_STATUS.SUCCEEDED ? 'PAID' : 'PENDING')
              : 'UNPAID',
            paymentProvider: paymentIntent?.provider || null,
            paymentIntentRef: paymentIntent?.id || null,
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

    if (paymentIntent?.id) {
      await prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: { orderId: order.id }
      }).catch(() => {});
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

      const currentStatus = normalizeOrderStatus(existingOrder.status) || ORDER_STATUS.PENDING;
      let resolvedDriverId = existingOrder.driverId;
      const updateData = {
        status: normalizedStatus,
        driverId: resolvedDriverId,
        pickedUpAt: undefined,
        deliveredAt: undefined
      };

      if (req.user.role === 'MERCHANT') {
        if (normalizedStatus === ORDER_STATUS.ASSIGNED || normalizedStatus === ORDER_STATUS.READY_FOR_PICKUP) {
          if (currentStatus !== ORDER_STATUS.PREPARING && currentStatus !== ORDER_STATUS.READY_FOR_PICKUP) {
            return res.status(409).json({ error: 'Only prepared orders can be assigned to a driver.' });
          }

          const assignedDriver = await findAssignableDriver(existingOrder);
          if (!assignedDriver) {
            return res.status(409).json({ error: 'No available drivers can be assigned right now.' });
          }

          resolvedDriverId = assignedDriver.id;
          updateData.status = ORDER_STATUS.ASSIGNED;
          updateData.driverId = assignedDriver.id;

          await prisma.driver.update({
            where: { id: assignedDriver.id },
            data: { available: false }
          });
        }

        if (normalizedStatus === ORDER_STATUS.CANCELLED && existingOrder.driverId) {
          await prisma.driver.update({
            where: { id: existingOrder.driverId },
            data: { available: true }
          }).catch(() => {});
        }
      } else if (req.user.role === 'DRIVER') {
        const driverId = await resolveDriverIdForUser(req.user);
        if (!driverId) {
          return res.status(403).json({ error: 'Driver profile not found' });
        }

        const ownedByCurrentDriver = await isOrderOwnedByDriver({
          orderDriverId: existingOrder.driverId,
          driverId,
          userId: req.user.id
        });

        if (!ownedByCurrentDriver) {
          return res.status(403).json({ error: 'Access denied' });
        }

        if (normalizedStatus === ORDER_STATUS.DRIVER_ACCEPTED) {
          if (currentStatus !== ORDER_STATUS.ASSIGNED && currentStatus !== ORDER_STATUS.READY_FOR_PICKUP) {
            return res.status(409).json({ error: 'Only assigned delivery jobs can be accepted.' });
          }

          resolvedDriverId = driverId;
          updateData.driverId = driverId;
          updateData.status = ORDER_STATUS.DRIVER_ACCEPTED;
        } else if (normalizedStatus === ORDER_STATUS.OUT_FOR_DELIVERY) {
          if (currentStatus !== ORDER_STATUS.DRIVER_ACCEPTED) {
            return res.status(409).json({ error: 'Driver must accept the job before pickup.' });
          }

          updateData.deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
          updateData.deliveryOtpVerifiedAt = null;
          updateData.status = ORDER_STATUS.OUT_FOR_DELIVERY;
          updateData.pickedUpAt = new Date();
        } else if (normalizedStatus === ORDER_STATUS.DELIVERED) {
          if (!existingOrder.deliveryOtp) {
            return res.status(409).json({ error: 'Delivery code not generated yet. Mark pickup first.' });
          }
          if (!existingOrder.deliveryOtpVerifiedAt) {
            return res.status(423).json({ error: 'Complete Delivery is locked until OTP is verified.' });
          }

          updateData.deliveredAt = new Date();

          await prisma.driver.update({
            where: { id: driverId },
            data: { available: true }
          }).catch(() => {});
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

      if (normalizeOrderStatus(updatedOrder.status) === ORDER_STATUS.DELIVERED) {
        await appendSettlementRecordsForOrder(updatedOrder, {
          userId: req.user.id,
          role: req.user.role
        });
      }

      const settledOrderIds = await getSettledOrderIds([updatedOrder.id]);
      res.json(serializeOrder(updatedOrder, {
        paymentSettled: settledOrderIds.has(updatedOrder.id)
      }));
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN COMMAND CENTER — NEW ENDPOINTS (backward-compatible additions)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Audit logging helper ──────────────────────────────────────────────────────
async function auditLog({ adminId, action, entityType, entityId, before, after, note, req }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        entityType,
        entityId: entityId || null,
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
        note: note || null,
        ip: req?.ip || null,
      },
    });
  } catch (e) {
    console.error('Audit log failed (non-fatal):', e.message);
  }
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────
app.get('/api/admin/dashboard', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders, todayOrders, weekOrders, monthOrders,
      ordersByStatus, deliveredOrders, cancelledOrders,
      refundedOrders, totalCustomers, activeDrivers,
      totalStores, activeStores,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart  } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.order.findMany({ where: { status: 'DELIVERED' }, select: { total: true, deliveryFee: true, deliveredAt: true, pickedUpAt: true, createdAt: true } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.aggregate({ where: { refundedAt: { not: null } }, _sum: { refundAmount: true }, _count: { id: true } }),
      prisma.user.count({ where: { role: 'CUSTOMER', banned: false } }),
      prisma.driver.count({ where: { available: true } }),
      prisma.store.count(),
      prisma.store.count({ where: { isActive: true, isOpen: true } }),
    ]);

    // Revenue metrics (delivered orders only)
    const gmv = deliveredOrders.reduce((s, o) => s + o.total, 0);
    const deliveryFeeRevenue = deliveredOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
    const completionRate = totalOrders > 0 ? ((deliveredOrders.length / totalOrders) * 100).toFixed(1) : 0;
    const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;

    // Average delivery time (minutes)
    let avgDeliveryMins = 0;
    const timed = deliveredOrders.filter(o => o.deliveredAt && o.createdAt);
    if (timed.length) {
      const totalMs = timed.reduce((s, o) => s + (new Date(o.deliveredAt) - new Date(o.createdAt)), 0);
      avgDeliveryMins = Math.round(totalMs / timed.length / 60000);
    }

    const statusMap = {};
    ordersByStatus.forEach(s => { statusMap[s.status] = s._count.id; });

    res.json({
      orders: { total: totalOrders, today: todayOrders, week: weekOrders, month: monthOrders, byStatus: statusMap },
      revenue: { gmv, deliveryFeeRevenue, refundVolume: refundedOrders._sum.refundAmount || 0 },
      rates: { completionRate: parseFloat(completionRate), cancellationRate: parseFloat(cancellationRate), refundCount: refundedOrders._count.id },
      operations: { avgDeliveryMins, activeDrivers, totalCustomers, totalStores, activeStores },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/payments/intents', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 40 } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (currentPage - 1) * take;
    const where = buildPaymentIntentAdminWhere(req.query);

    const [items, total, aggregates, groupedByStatus, groupedByProvider] = await Promise.all([
      prisma.paymentIntent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: adminPaymentIntentInclude
      }),
      prisma.paymentIntent.count({ where }),
      prisma.paymentIntent.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
      prisma.paymentIntent.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.paymentIntent.groupBy({ by: ['provider'], where, _count: { id: true }, _sum: { amount: true } })
    ]);

    return res.json({
      summary: {
        totalIntents: aggregates._count.id,
        totalVolume: Number(aggregates._sum.amount || 0),
        byStatus: groupedByStatus.reduce((acc, row) => {
          acc[row.status] = row._count.id;
          return acc;
        }, {}),
        byProvider: groupedByProvider.reduce((acc, row) => {
          acc[row.provider] = {
            count: row._count.id,
            volume: Number(row._sum.amount || 0)
          };
          return acc;
        }, {})
      },
      items: items.map(serializePaymentIntentForAdmin),
      total,
      pages: Math.ceil(total / take),
      page: currentPage
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load payment intents' });
  }
});

app.get('/api/admin/payments/intents/:id', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const intent = await loadAdminPaymentIntentById(req.params.id);
    if (!intent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    const eventWhere = {
      provider: intent.provider,
      ...(intent.providerRef
        ? {
            OR: [
              { providerEventId: intent.providerRef },
              { payload: { contains: intent.id } },
              { payload: { contains: intent.providerRef } }
            ]
          }
        : {
            payload: { contains: intent.id }
          })
    };

    const [retryHistory, providerEvents] = await Promise.all([
      buildAdminPaymentRetryHistory(intent),
      prisma.paymentEvent.findMany({
        where: eventWhere,
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);

    return res.json({
      intent: serializePaymentIntentForAdmin(intent),
      retryHistory,
      providerEvents: providerEvents.map((event) => ({
        id: event.id,
        provider: event.provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        processedAt: event.processedAt,
        createdAt: event.createdAt
      }))
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load payment intent detail' });
  }
});

app.get('/api/admin/payments/intents/export', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const where = buildPaymentIntentAdminWhere(req.query);
    const intents = await prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: adminPaymentIntentInclude
    });

    const rows = intents.map((intent) => {
      const serialized = serializePaymentIntentForAdmin(intent);
      return [
        serialized.id,
        serialized.createdAt,
        serialized.provider,
        serialized.status,
        serialized.amount,
        serialized.currency,
        serialized.providerRef,
        serialized.linkedOrderNumber || serialized.orderId || '',
        serialized.customerName || '',
        serialized.customerPhone || '',
        serialized.storeName || '',
        serialized.retrySourceIntentId || '',
        serialized.retryCount || 0,
        serialized.adminNotes.map((note) => `${note.createdAt || ''} ${note.authorName || note.adminId || ''}: ${note.note || ''}`).join(' | ')
      ].map(escapeCsvValue).join(',');
    });

    const header = [
      'intentId',
      'createdAt',
      'provider',
      'status',
      'amount',
      'currency',
      'providerRef',
      'orderReference',
      'customerName',
      'customerPhone',
      'storeName',
      'retrySourceIntentId',
      'retryCount',
      'adminNotes'
    ].join(',');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payment-intents-${Date.now()}.csv"`);
    return res.status(200).send([header, ...rows].join('\n'));
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to export payment intents' });
  }
});

app.post('/api/admin/payments/intents/:id/notes', authMiddleware, roleMiddleware('ADMIN'), body('note').trim().isLength({ min: 2, max: 1000 }), validate, async (req, res) => {
  try {
    const intent = await loadAdminPaymentIntentById(req.params.id);
    if (!intent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    const metadata = parsePaymentMetadata(intent.metadata);
    const adminNotes = Array.isArray(metadata.adminNotes) ? metadata.adminNotes : [];
    const nextNote = {
      id: randomUUID(),
      note: req.body.note.trim(),
      adminId: req.user.id,
      authorName: req.user.name || req.user.username || 'Admin',
      createdAt: new Date().toISOString()
    };

    const updated = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        metadata: stringifyJsonField({
          ...metadata,
          adminNotes: [nextNote, ...adminNotes].slice(0, 20)
        })
      },
      include: adminPaymentIntentInclude
    });

    await auditLog({
      adminId: req.user.id,
      action: 'PAYMENT_INTENT_NOTE_ADDED',
      entityType: 'PAYMENT_INTENT',
      entityId: intent.id,
      before: { notesCount: adminNotes.length },
      after: { notesCount: adminNotes.length + 1 },
      note: req.body.note.trim(),
      req
    });

    return res.status(201).json({ intent: serializePaymentIntentForAdmin(updated) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to add payment note' });
  }
});

app.post('/api/admin/payments/intents/:id/reconcile', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const intent = await loadAdminPaymentIntentById(req.params.id);
    if (!intent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    const reconciled = await reconcilePaymentIntent(intent);
    const refreshed = await loadAdminPaymentIntentById(reconciled.id);

    await auditLog({
      adminId: req.user.id,
      action: 'PAYMENT_INTENT_RECONCILED',
      entityType: 'PAYMENT_INTENT',
      entityId: intent.id,
      before: { status: intent.status, providerRef: intent.providerRef },
      after: { status: refreshed?.status || reconciled.status, providerRef: refreshed?.providerRef || reconciled.providerRef },
      note: `Admin reconciled payment intent ${intent.id}`,
      req
    });

    return res.json({ intent: serializePaymentIntentForAdmin(refreshed || reconciled) });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to reconcile payment intent' });
  }
});

// ── Enhanced Admin Orders List ────────────────────────────────────────────────
app.get('/api/admin/orders', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 40, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(new Date(dateTo).setHours(23,59,59,999));
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { store: { name: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          store:    { select: { id: true, name: true, category: true } },
          customer: { select: { id: true, name: true, phone: true, email: true } },
          driver:   { select: { id: true, name: true, phone: true, vehicle: true } },
          items:    { include: { product: { select: { name: true } } } },
          notes:    { include: { admin: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, pages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Cancel order ───────────────────────────────────────────────────────
app.post('/api/admin/orders/:id/cancel', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Order already cancelled' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancellationReason: reason || 'Cancelled by admin' },
    });
    await auditLog({ adminId: req.user.id, action: 'ORDER_CANCELLED', entityType: 'ORDER', entityId: order.id, before: { status: order.status }, after: { status: 'CANCELLED', cancellationReason: reason }, note: reason, req });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Refund order ───────────────────────────────────────────────────────
app.post('/api/admin/orders/:id/refund', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) return res.status(400).json({ error: 'amount and reason required' });

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.refundedAt) return res.status(400).json({ error: 'Order already refunded' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { refundedAt: new Date(), refundAmount: parseFloat(amount), refundReason: reason },
    });
    await auditLog({ adminId: req.user.id, action: 'REFUND_ISSUED', entityType: 'ORDER', entityId: order.id, before: { refundedAt: null }, after: { refundAmount: amount, refundReason: reason }, note: `Refunded KES ${amount}: ${reason}`, req });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Force-assign driver ────────────────────────────────────────────────
app.post('/api/admin/orders/:id/assign', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });

    const [order, driver] = await Promise.all([
      prisma.order.findUnique({ where: { id: req.params.id } }),
      prisma.driver.findUnique({ where: { id: driverId } }),
    ]);
    if (!order)  return res.status(404).json({ error: 'Order not found' });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { driverId, status: 'ASSIGNED' },
    });
    await auditLog({ adminId: req.user.id, action: 'DRIVER_FORCE_ASSIGNED', entityType: 'ORDER', entityId: order.id, before: { driverId: order.driverId }, after: { driverId }, note: `Force-assigned driver ${driver.name}`, req });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Order notes ────────────────────────────────────────────────────────
app.get('/api/admin/orders/:id/notes', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const notes = await prisma.orderNote.findMany({
      where: { orderId: req.params.id },
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/orders/:id/notes', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Note text required' });

    const note = await prisma.orderNote.create({
      data: { orderId: req.params.id, adminId: req.user.id, text: text.trim() },
      include: { admin: { select: { name: true } } },
    });
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Audit logs ─────────────────────────────────────────────────────────
app.get('/api/admin/audit-logs', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 50, entityType, action, adminId: filterAdmin } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (entityType)   where.entityType = entityType;
    if (action)       where.action = { contains: action };
    if (filterAdmin)  where.adminId = filterAdmin;

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { name: true, username: true } } },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    res.json({ logs, total, pages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Suspend / reactivate store ────────────────────────────────────────
app.post('/api/admin/stores/:id/suspend', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    const store = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const updated = await prisma.store.update({
      where: { id: req.params.id },
      data: { isActive: !suspend, isOpen: suspend ? false : store.isOpen },
    });
    await auditLog({ adminId: req.user.id, action: suspend ? 'STORE_SUSPENDED' : 'STORE_REACTIVATED', entityType: 'STORE', entityId: store.id, before: { isActive: store.isActive }, after: { isActive: !suspend }, note: reason, req });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Suspend / reactivate driver ───────────────────────────────────────
app.post('/api/admin/drivers/:id/suspend', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const [updatedDriver] = await Promise.all([
      prisma.driver.update({ where: { id: req.params.id }, data: { available: !suspend } }),
      prisma.user.update({ where: { id: driver.userId }, data: { banned: !!suspend } }),
    ]);
    await auditLog({ adminId: req.user.id, action: suspend ? 'DRIVER_SUSPENDED' : 'DRIVER_REACTIVATED', entityType: 'DRIVER', entityId: driver.id, before: { available: driver.available }, after: { available: !suspend }, note: reason, req });
    res.json(updatedDriver);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Reports overview ───────────────────────────────────────────────────
app.get('/api/admin/reports/overview', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(new Date(to).setHours(23,59,59,999));
    const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [allOrders, topStores, driverStats] = await Promise.all([
      prisma.order.findMany({ where, select: { total: true, deliveryFee: true, status: true, refundAmount: true, createdAt: true, store: { select: { name: true, category: true } } } }),
      prisma.order.groupBy({ by: ['storeId'], where: { ...where, status: 'DELIVERED' }, _count: { id: true }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 10 }),
      prisma.driver.findMany({ include: { orders: { where: { ...where }, select: { status: true } }, _count: true } }),
    ]);

    const deliveredOrders = allOrders.filter(o => o.status === 'DELIVERED');
    const cancelledOrders = allOrders.filter(o => o.status === 'CANCELLED');
    const gmv    = deliveredOrders.reduce((s, o) => s + o.total, 0);
    const fees   = deliveredOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
    const refunds = allOrders.reduce((s, o) => s + (o.refundAmount || 0), 0);
    const aov    = deliveredOrders.length ? gmv / deliveredOrders.length : 0;

    // Revenue by day (last 30 days bucketed)
    const dayMap = {};
    deliveredOrders.forEach(o => {
      const day = o.createdAt.toISOString().slice(0,10);
      dayMap[day] = (dayMap[day] || 0) + o.total;
    });

    // Category breakdown
    const catMap = {};
    allOrders.forEach(o => {
      const cat = o.store?.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    // Store names for topStores
    const storeIds = topStores.map(s => s.storeId);
    const storeNames = await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } });
    const storeNameMap = Object.fromEntries(storeNames.map(s => [s.id, s.name]));
    const topStoresResult = topStores.map(s => ({ storeId: s.storeId, name: storeNameMap[s.storeId] || s.storeId, orders: s._count.id, revenue: s._sum.total || 0 }));

    res.json({
      summary: {
        gmv, fees, refunds, aov,
        totalOrders: allOrders.length,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: cancelledOrders.length,
        completionRate: allOrders.length ? (deliveredOrders.length / allOrders.length * 100).toFixed(1) : 0,
        cancellationRate: allOrders.length ? (cancelledOrders.length / allOrders.length * 100).toFixed(1) : 0,
      },
      charts: {
        revenueByDay: Object.entries(dayMap).sort().map(([date, revenue]) => ({ date, revenue })),
        ordersByCategory: Object.entries(catMap).map(([category, count]) => ({ category, count })),
      },
      topStores: topStoresResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Delivery zones & rule controls ───────────────────────────────────
app.get('/api/admin/zones', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        stores: {
          include: {
            store: { select: { id: true, name: true, category: true, isActive: true, isOpen: true } },
          },
        },
      },
    });
    res.json(zones);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/zones', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const {
      name,
      description,
      isActive = true,
      priority = 100,
      minOrderValue,
      baseDeliveryFee = 0,
      perKmFee,
      maxRadiusKm,
      estimatedMinMinutes,
      estimatedMaxMinutes,
      polygon,
      metadata,
      storeIds = [],
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Zone name is required' });

    const zone = await prisma.deliveryZone.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: !!isActive,
        priority: Number(priority) || 100,
        minOrderValue: minOrderValue === undefined || minOrderValue === null || minOrderValue === '' ? null : Number(minOrderValue),
        baseDeliveryFee: Number(baseDeliveryFee) || 0,
        perKmFee: perKmFee === undefined || perKmFee === null || perKmFee === '' ? null : Number(perKmFee),
        maxRadiusKm: maxRadiusKm === undefined || maxRadiusKm === null || maxRadiusKm === '' ? null : Number(maxRadiusKm),
        estimatedMinMinutes: estimatedMinMinutes ? Number(estimatedMinMinutes) : null,
        estimatedMaxMinutes: estimatedMaxMinutes ? Number(estimatedMaxMinutes) : null,
        polygon: polygon ? JSON.stringify(polygon) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    if (Array.isArray(storeIds) && storeIds.length > 0) {
      await prisma.deliveryZoneStore.createMany({
        data: storeIds.map(storeId => ({ zoneId: zone.id, storeId })),
      });
    }

    await auditLog({
      adminId: req.user.id,
      action: 'ZONE_CREATED',
      entityType: 'SYSTEM',
      entityId: zone.id,
      after: { name: zone.name, priority: zone.priority, storeCount: storeIds.length },
      note: `Zone created: ${zone.name}`,
      req,
    });

    const fresh = await prisma.deliveryZone.findUnique({
      where: { id: zone.id },
      include: {
        stores: {
          include: { store: { select: { id: true, name: true, category: true, isActive: true, isOpen: true } } },
        },
      },
    });

    res.status(201).json(fresh);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/zones/:id', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const zoneId = req.params.id;
    const existing = await prisma.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!existing) return res.status(404).json({ error: 'Zone not found' });

    const {
      name,
      description,
      isActive,
      priority,
      minOrderValue,
      baseDeliveryFee,
      perKmFee,
      maxRadiusKm,
      estimatedMinMinutes,
      estimatedMaxMinutes,
      polygon,
      metadata,
    } = req.body;

    const updated = await prisma.deliveryZone.update({
      where: { id: zoneId },
      data: {
        name: name === undefined ? existing.name : (name?.trim() || existing.name),
        description: description === undefined ? existing.description : (description?.trim() || null),
        isActive: isActive === undefined ? existing.isActive : !!isActive,
        priority: priority === undefined ? existing.priority : Number(priority),
        minOrderValue: minOrderValue === undefined ? existing.minOrderValue : (minOrderValue === '' || minOrderValue === null ? null : Number(minOrderValue)),
        baseDeliveryFee: baseDeliveryFee === undefined ? existing.baseDeliveryFee : Number(baseDeliveryFee),
        perKmFee: perKmFee === undefined ? existing.perKmFee : (perKmFee === '' || perKmFee === null ? null : Number(perKmFee)),
        maxRadiusKm: maxRadiusKm === undefined ? existing.maxRadiusKm : (maxRadiusKm === '' || maxRadiusKm === null ? null : Number(maxRadiusKm)),
        estimatedMinMinutes: estimatedMinMinutes === undefined ? existing.estimatedMinMinutes : (estimatedMinMinutes ? Number(estimatedMinMinutes) : null),
        estimatedMaxMinutes: estimatedMaxMinutes === undefined ? existing.estimatedMaxMinutes : (estimatedMaxMinutes ? Number(estimatedMaxMinutes) : null),
        polygon: polygon === undefined ? existing.polygon : (polygon ? JSON.stringify(polygon) : null),
        metadata: metadata === undefined ? existing.metadata : (metadata ? JSON.stringify(metadata) : null),
      },
    });

    await auditLog({
      adminId: req.user.id,
      action: 'ZONE_UPDATED',
      entityType: 'SYSTEM',
      entityId: zoneId,
      before: { name: existing.name, isActive: existing.isActive, priority: existing.priority },
      after: { name: updated.name, isActive: updated.isActive, priority: updated.priority },
      note: `Zone updated: ${updated.name}`,
      req,
    });

    const fresh = await prisma.deliveryZone.findUnique({
      where: { id: zoneId },
      include: {
        stores: {
          include: { store: { select: { id: true, name: true, category: true, isActive: true, isOpen: true } } },
        },
      },
    });
    res.json(fresh);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/zones/:id/stores', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const zoneId = req.params.id;
    const { storeIds = [] } = req.body;
    const zone = await prisma.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    if (!Array.isArray(storeIds)) return res.status(400).json({ error: 'storeIds must be an array' });

    await prisma.$transaction([
      prisma.deliveryZoneStore.deleteMany({ where: { zoneId } }),
      ...(storeIds.length > 0 ? [prisma.deliveryZoneStore.createMany({ data: storeIds.map(storeId => ({ zoneId, storeId })) })] : []),
    ]);

    await auditLog({
      adminId: req.user.id,
      action: 'ZONE_STORES_UPDATED',
      entityType: 'SYSTEM',
      entityId: zoneId,
      after: { storeCount: storeIds.length },
      note: `Zone stores updated: ${zone.name}`,
      req,
    });

    const fresh = await prisma.deliveryZone.findUnique({
      where: { id: zoneId },
      include: {
        stores: {
          include: { store: { select: { id: true, name: true, category: true, isActive: true, isOpen: true } } },
        },
      },
    });

    res.json(fresh);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/zones/:id', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const zone = await prisma.deliveryZone.findUnique({ where: { id: req.params.id } });
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    await prisma.deliveryZone.delete({ where: { id: req.params.id } });
    await auditLog({
      adminId: req.user.id,
      action: 'ZONE_DELETED',
      entityType: 'SYSTEM',
      entityId: zone.id,
      before: { name: zone.name, isActive: zone.isActive },
      note: `Zone deleted: ${zone.name}`,
      req,
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Broadcast notifications ───────────────────────────────────────────
app.get('/api/admin/notifications/audience-stats', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const [customers, stores, drivers, totalUsers] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER', banned: false } }),
      prisma.user.count({ where: { role: 'MERCHANT', banned: false } }),
      prisma.user.count({ where: { role: 'DRIVER', banned: false } }),
      prisma.user.count({ where: { banned: false } }),
    ]);
    res.json({ customers, stores, drivers, totalUsers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/notifications/campaigns', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [campaigns, total] = await Promise.all([
      prisma.broadcastCampaign.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
          _count: { select: { notifications: true } },
        },
      }),
      prisma.broadcastCampaign.count(),
    ]);

    res.json({ campaigns, total, pages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/notifications/broadcast', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const {
      title,
      message,
      audience = 'ALL',
      channel = 'IN_APP',
      userIds = [],
      storeIds = [],
      metadata,
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    let where = { banned: false };
    if (audience === 'CUSTOMERS') where = { ...where, role: 'CUSTOMER' };
    if (audience === 'STORES') where = { ...where, role: 'MERCHANT' };
    if (audience === 'DRIVERS') where = { ...where, role: 'DRIVER' };
    if (audience === 'USER_IDS') where = { ...where, id: { in: Array.isArray(userIds) ? userIds : [] } };
    if (audience === 'STORE_IDS') where = { ...where, role: 'MERCHANT', storeId: { in: Array.isArray(storeIds) ? storeIds : [] } };

    const recipients = await prisma.user.findMany({
      where,
      select: { id: true, role: true, name: true, username: true },
    });

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients matched the selected audience' });
    }

    const campaign = await prisma.broadcastCampaign.create({
      data: {
        createdById: req.user.id,
        title: title.trim(),
        message: message.trim(),
        channel,
        audience,
        audienceMeta: JSON.stringify({ userIds, storeIds }),
        status: 'SENT',
      },
    });

    await prisma.notification.createMany({
      data: recipients.map(r => ({
        userId: r.id,
        campaignId: campaign.id,
        title: title.trim(),
        message: message.trim(),
        channel,
        status: 'SENT',
        metadata: metadata ? JSON.stringify(metadata) : null,
      })),
    });

    await prisma.broadcastCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: recipients.length, failedCount: 0 },
    });

    await auditLog({
      adminId: req.user.id,
      action: 'BROADCAST_SENT',
      entityType: 'SYSTEM',
      entityId: campaign.id,
      after: { audience, sentCount: recipients.length, channel },
      note: `Broadcast sent: ${title.trim()}`,
      req,
    });

    res.status(201).json({
      campaignId: campaign.id,
      sentCount: recipients.length,
      audience,
      sampleRecipients: recipients.slice(0, 5),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/support-tickets', authMiddleware, roleMiddleware('ADMIN'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const status = String(req.query.status || '').trim().toUpperCase();

    const where = {};
    if (status && status !== 'ALL') where.status = status;

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const merchantIds = [...new Set(tickets.map((t) => t.merchantId).filter(Boolean))];
    const merchants = merchantIds.length
      ? await prisma.user.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, name: true, username: true },
      })
      : [];
    const merchantMap = merchants.reduce((acc, merchant) => {
      acc[merchant.id] = merchant;
      return acc;
    }, {});

    const enriched = tickets.map((ticket) => ({
      ...ticket,
      merchant: ticket.merchantId ? (merchantMap[ticket.merchantId] || null) : null,
    }));

    res.json({
      tickets: enriched,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      limit,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MERCHANT PORTAL UPGRADE ENDPOINTS (additive + backward-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/merchant/dashboard', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      store,
      allOrders,
      todaysOrders,
      deliveredToday,
      cancelledToday,
      products,
    ] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.order.findMany({ where: { storeId }, select: { id: true, status: true, total: true, createdAt: true } }),
      prisma.order.findMany({ where: { storeId, createdAt: { gte: dayStart } }, select: { id: true, status: true, total: true, createdAt: true } }),
      prisma.order.findMany({ where: { storeId, status: ORDER_STATUS.DELIVERED, createdAt: { gte: dayStart } }, select: { total: true, createdAt: true, pickedUpAt: true } }),
      prisma.order.count({ where: { storeId, status: ORDER_STATUS.CANCELLED, createdAt: { gte: dayStart } } }),
      prisma.product.findMany({ where: { storeId }, select: { id: true, name: true, available: true, quantityAvailable: true, lowStockThreshold: true } }),
    ]);

    const statusCount = {
      pending: 0,
      accepted: 0,
      preparing: 0,
      readyForPickup: 0,
      pickedUp: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
    };

    for (const o of allOrders) {
      const s = normalizeOrderStatus(o.status);
      if (s === ORDER_STATUS.PENDING || s === ORDER_STATUS.CONFIRMED) statusCount.pending += 1;
      if (s === ORDER_STATUS.PREPARING) { statusCount.accepted += 1; statusCount.preparing += 1; }
      if (s === ORDER_STATUS.ASSIGNED || s === ORDER_STATUS.READY_FOR_PICKUP) statusCount.readyForPickup += 1;
      if (s === ORDER_STATUS.DRIVER_ACCEPTED || s === ORDER_STATUS.OUT_FOR_DELIVERY) statusCount.pickedUp += 1;
      if (s === ORDER_STATUS.DELIVERED) statusCount.completed += 1;
      if (s === ORDER_STATUS.CANCELLED) { statusCount.cancelled += 1; statusCount.rejected += 1; }
    }

    const todaysRevenue = deliveredToday.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const lowStock = products.filter((p) => {
      if (p.quantityAvailable === null || p.quantityAvailable === undefined) return false;
      const threshold = p.lowStockThreshold ?? 5;
      return p.quantityAvailable <= threshold;
    });

    res.json({
      store: {
        id: store?.id,
        name: store?.name,
        isOpen: store?.isOpen,
        isActive: store?.isActive,
        pausedOrders: !!store?.pausedOrders,
        busyMode: !!store?.busyMode,
      },
      kpis: {
        pendingOrders: statusCount.pending,
        acceptedInProgress: statusCount.accepted + statusCount.readyForPickup,
        readyForPickup: statusCount.readyForPickup,
        completedToday: statusCount.completed,
        cancelledToday,
        todaysRevenue,
        averagePrepTimeMinutes: null,
      },
      statuses: statusCount,
      lowStockAlerts: lowStock,
      todayOrderCount: todaysOrders.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/inventory', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { search = '', category = '', availability = '' } = req.query;
    const where = { storeId };
    if (category) where.category = category;
    if (availability === 'in') where.available = true;
    if (availability === 'out') where.available = false;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, category: true, price: true, image: true,
        available: true, quantityAvailable: true, lowStockThreshold: true,
        prepTimeOverride: true, maxQuantityPerOrder: true, sku: true, updatedAt: true,
      },
    });

    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/merchant/inventory/bulk', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { productIds = [], updates = {} } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds is required' });
    }

    const data = {};
    if (updates.available !== undefined) data.available = !!updates.available;
    if (updates.quantityAvailable !== undefined) data.quantityAvailable = updates.quantityAvailable === '' ? null : Number(updates.quantityAvailable);
    if (updates.lowStockThreshold !== undefined) data.lowStockThreshold = updates.lowStockThreshold === '' ? null : Number(updates.lowStockThreshold);
    if (updates.price !== undefined) data.price = Number(updates.price);

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds }, storeId },
      data,
    });

    res.json({ updated: result.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/promotions', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const promotions = await prisma.promotion.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(promotions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/merchant/promotions', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const payload = req.body || {};
    if (!payload.title?.trim() || !payload.subtitle?.trim()) {
      return res.status(400).json({ error: 'title and subtitle are required' });
    }

    const created = await prisma.promotion.create({
      data: {
        storeId,
        title: payload.title.trim(),
        subtitle: payload.subtitle.trim(),
        ctaText: payload.ctaText || 'Order now',
        ctaLink: payload.ctaLink || null,
        bgColor: payload.bgColor || '#FF5A5F',
        image: payload.image || null,
        discountType: payload.discountType || null,
        discountValue: payload.discountValue === '' || payload.discountValue === undefined ? null : Number(payload.discountValue),
        minOrderValue: payload.minOrderValue === '' || payload.minOrderValue === undefined ? null : Number(payload.minOrderValue),
        usageLimit: payload.usageLimit === '' || payload.usageLimit === undefined ? null : Number(payload.usageLimit),
        active: payload.active !== undefined ? !!payload.active : true,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      },
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/merchant/promotions/:id', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const promo = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!promo || promo.storeId !== storeId) return res.status(404).json({ error: 'Promotion not found' });

    const payload = req.body || {};
    const updated = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        title: payload.title,
        subtitle: payload.subtitle,
        ctaText: payload.ctaText,
        ctaLink: payload.ctaLink,
        bgColor: payload.bgColor,
        image: payload.image,
        discountType: payload.discountType,
        discountValue: payload.discountValue === '' ? null : (payload.discountValue === undefined ? undefined : Number(payload.discountValue)),
        minOrderValue: payload.minOrderValue === '' ? null : (payload.minOrderValue === undefined ? undefined : Number(payload.minOrderValue)),
        usageLimit: payload.usageLimit === '' ? null : (payload.usageLimit === undefined ? undefined : Number(payload.usageLimit)),
        active: payload.active,
        startsAt: payload.startsAt === undefined ? undefined : (payload.startsAt ? new Date(payload.startsAt) : null),
        endsAt: payload.endsAt === undefined ? undefined : (payload.endsAt ? new Date(payload.endsAt) : null),
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/merchant/promotions/:id', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const promo = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!promo || promo.storeId !== storeId) return res.status(404).json({ error: 'Promotion not found' });

    await prisma.promotion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/payouts', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const dbRows = await prisma.payoutLedger.findMany({
      where: {
        type: SETTLEMENT_TYPE.MERCHANT,
        storeId,
      },
      orderBy: { createdAt: 'desc' }
    });

    if (dbRows.length > 0) {
      const summaryFromDb = {
        grossSales: dbRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        netEarnings: dbRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        commissions: 0,
        discounts: 0,
        refunds: 0,
        payoutDue: dbRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      };

      return res.json({ summary: summaryFromDb, settlements: dbRows });
    }

    const ledger = await readAccountingPayoutLedger();
    const merchantRows = ledger
      .filter((row) => row.type === SETTLEMENT_TYPE.MERCHANT && row.storeId === storeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const summary = {
      grossSales: merchantRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      netEarnings: merchantRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      commissions: 0,
      discounts: 0,
      refunds: 0,
      payoutDue: merchantRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    };

    res.json({ summary, settlements: merchantRows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/reports/overview', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { from, to } = req.query;
    const where = { storeId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const orders = await prisma.order.findMany({ where, include: { items: { include: { product: true } } } });
    const delivered = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.DELIVERED);
    const cancelled = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.CANCELLED);
    const grossSales = delivered.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgOrderValue = delivered.length ? grossSales / delivered.length : 0;

    const productPerfMap = {};
    for (const order of delivered) {
      for (const item of order.items || []) {
        const key = item.product?.name || item.productId;
        if (!productPerfMap[key]) productPerfMap[key] = { name: key, qty: 0, revenue: 0 };
        productPerfMap[key].qty += Number(item.quantity || 0);
        productPerfMap[key].revenue += Number(item.price || 0) * Number(item.quantity || 0);
      }
    }

    const dailyMap = {};
    for (const order of delivered) {
      const day = new Date(order.createdAt).toISOString().slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + Number(order.total || 0);
    }

    res.json({
      summary: {
        totalOrders: orders.length,
        deliveredOrders: delivered.length,
        cancelledOrders: cancelled.length,
        acceptanceRate: orders.length ? (((orders.length - cancelled.length) / orders.length) * 100).toFixed(1) : '0',
        cancellationRate: orders.length ? ((cancelled.length / orders.length) * 100).toFixed(1) : '0',
        grossSales,
        avgOrderValue,
      },
      salesOverTime: Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total })),
      topProducts: Object.values(productPerfMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/reviews', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { rating, from, to } = req.query;
    const where = {
      storeId,
      rating: { not: null },
    };
    if (rating) where.rating = Number(rating);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const reviews = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        rating: true,
        ratingComment: true,
        merchantResponse: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    });

    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/merchant/reviews/:orderId/respond', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { response } = req.body;
    if (!response?.trim()) return res.status(400).json({ error: 'response is required' });

    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order || order.storeId !== storeId) return res.status(404).json({ error: 'Review not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.orderId },
      data: { merchantResponse: response.trim() },
      select: { id: true, merchantResponse: true },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/support-tickets', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const tickets = await prisma.supportTicket.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/merchant/support-tickets', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const storeId = await resolveMerchantStoreIdForUser(req.user);
    if (!storeId) return res.status(404).json({ error: 'Store not found for merchant' });

    const { subject, description, category = 'GENERAL', priority = 'NORMAL', attachmentUrls } = req.body;
    if (!subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'subject and description are required' });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        storeId,
        merchantId: req.user.id,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'OPEN',
        attachmentUrls: attachmentUrls ? JSON.stringify(attachmentUrls) : null,
      },
    });

    res.status(201).json(ticket);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/merchant/notifications', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/merchant/notifications/:id/read', authMiddleware, roleMiddleware('MERCHANT'), async (req, res) => {
  try {
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ error: 'Notification not found' });

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const startServer = async () => {
  try {
    await initDB();
    startPaymentReconciliationLoop();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
