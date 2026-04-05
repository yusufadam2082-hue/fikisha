import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { getPermissionCatalog, getDefaultRoleCatalog } from '../adminRbac.js';

const prisma = new PrismaClient();

function slugifyUsername(value = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return normalized || `admin.${Date.now().toString().slice(-6)}`;
}

async function ensureUniqueUsername(base) {
  let username = base;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
    username = `${base}.${suffix}`;
    suffix += 1;
  }

  return username;
}

async function seedPermissionsAndRoles() {
  const permissionRecords = new Map();

  for (const permission of getPermissionCatalog()) {
    const record = await prisma.adminPermission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        description: permission.description || null
      },
      create: {
        key: permission.key,
        name: permission.name,
        description: permission.description || null
      }
    });
    permissionRecords.set(permission.key, record.id);
  }

  const roleCatalog = getDefaultRoleCatalog();

  for (const [roleName, permissionKeys] of Object.entries(roleCatalog)) {
    const role = await prisma.adminRole.upsert({
      where: { name: roleName },
      update: {
        description: `${roleName} system role`,
        isSystemRole: true
      },
      create: {
        name: roleName,
        description: `${roleName} system role`,
        isSystemRole: true
      }
    });

    const desiredIds = permissionKeys
      .map((key) => permissionRecords.get(key))
      .filter(Boolean);

    await prisma.adminRolePermission.deleteMany({ where: { roleId: role.id } });
    if (desiredIds.length > 0) {
      await prisma.adminRolePermission.createMany({
        data: desiredIds.map((permissionId) => ({
          roleId: role.id,
          permissionId
        })),
        skipDuplicates: true
      });
    }
  }
}

async function bootstrap() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@mtaaexpress.local').trim().toLowerCase();
  const phone = String(process.env.ADMIN_PHONE || '+255700000099').trim();
  const fullName = String(process.env.ADMIN_FULL_NAME || 'System Administrator').trim();
  const rawPassword = String(process.env.ADMIN_PASSWORD || '').trim();

  if (!rawPassword) {
    throw new Error('ADMIN_PASSWORD is required for bootstrap');
  }

  await seedPermissionsAndRoles();

  const superRole = await prisma.adminRole.findUnique({ where: { name: 'Super Admin' }, select: { id: true } });
  if (!superRole) {
    throw new Error('Super Admin role not found after seeding');
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      fullName,
      phone,
      roleId: superRole.id,
      passwordHash,
      isActive: true,
      notes: 'Bootstrap/reset by scripts/bootstrap-admin.mjs'
    },
    create: {
      fullName,
      email,
      phone,
      roleId: superRole.id,
      passwordHash,
      isActive: true,
      notes: 'Bootstrap by scripts/bootstrap-admin.mjs'
    },
    select: {
      id: true,
      userId: true,
      email: true,
      phone: true,
      fullName: true
    }
  });

  let userId = admin.userId;

  if (!userId) {
    const baseUsername = slugifyUsername(email || phone || fullName);
    const username = await ensureUniqueUsername(baseUsername);

    const user = await prisma.user.create({
      data: {
        username,
        password: passwordHash,
        role: 'ADMIN',
        name: fullName,
        email,
        phone,
        banned: false
      },
      select: { id: true }
    });

    userId = user.id;

    await prisma.admin.update({
      where: { id: admin.id },
      data: { userId }
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        role: 'ADMIN',
        name: fullName,
        email,
        phone,
        banned: false
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log('Super Admin bootstrap complete');
  // eslint-disable-next-line no-console
  console.log(`Identifier (email): ${email}`);
  // eslint-disable-next-line no-console
  console.log(`Identifier (phone): ${phone}`);
  // eslint-disable-next-line no-console
  console.log('Password: value from ADMIN_PASSWORD env');
}

bootstrap()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
