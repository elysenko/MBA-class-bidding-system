'use strict';
/**
 * Production seed — runs with plain `node`, no TypeScript toolchain needed.
 *
 *   node prisma/seed/seed.js        (also wired to `npx prisma db seed`)
 *
 * Idempotent: every run re-asserts the demo passwords, so the credentials
 * printed as SEED_CRED always match what is stored.
 */
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes } = require('crypto');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function derivePassword(seedKey) {
  return createHash('sha256')
    .update(seedKey + (process.env.SEED_SECRET || 'colossus-seed'))
    .digest('hex')
    .slice(0, 16);
}

const ROOT_USERNAME = (process.env.ROOT_ADMIN_USERNAME || 'registrar').trim().toLowerCase();
const ROOT_EMAIL = (process.env.ROOT_ADMIN_EMAIL || 'registrar@example.edu').trim().toLowerCase();
const ROOT_PASSWORD = process.env.ROOT_ADMIN_PASSWORD || derivePassword(ROOT_EMAIL);

const DEMO_STUDENTS = [
  { email: 'priya.raghunathan@mba.example.edu', name: 'Priya Raghunathan' },
  { email: 'tomas.delacroix@mba.example.edu', name: 'Tomas Delacroix' },
  { email: 'amara.nwosu@mba.example.edu', name: 'Amara Nwosu' },
  { email: 'jonas.lindberg@mba.example.edu', name: 'Jonas Lindberg' },
  { email: 'wenli.zhang@mba.example.edu', name: 'Wen Li Zhang' },
];

const DEMO_CLASSES = [
  { name: 'Advanced Corporate Valuation', code: 'FIN-641', faculty: 'Prof. E. Marchetti', seatCap: 30 },
  { name: 'Negotiation & Influence', code: 'MGT-512', faculty: 'Prof. D. Okonjo', seatCap: 24 },
  { name: 'Data-Driven Marketing Strategy', code: 'MKT-528', faculty: 'Prof. L. Hartmann', seatCap: 40 },
  { name: 'Private Equity & Buyouts', code: 'FIN-702', faculty: 'Prof. S. Vandermeer', seatCap: 18 },
  { name: 'Operations & Supply Chain Analytics', code: 'OPS-544', faculty: 'Prof. R. Nakamura', seatCap: 35 },
  { name: 'Entrepreneurial Finance', code: 'ENT-611', faculty: 'Prof. A. Bekele', seatCap: 30 },
  { name: 'Behavioural Economics for Managers', code: 'ECO-533', faculty: 'Prof. C. Lindqvist', seatCap: 45 },
  { name: 'Global Macro & Policy', code: 'ECO-708', faculty: 'Prof. M. Alvarez', seatCap: 30 },
];

const TERM = process.env.SEED_TERM || 'Spring 2026';

async function seedRootAdmin() {
  // The hash is re-asserted on update as well as create so redeploys never
  // drift from the credential this run prints.
  const passwordHash = await bcrypt.hash(ROOT_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ROOT_EMAIL },
    update: {
      passwordHash,
      username: ROOT_USERNAME,
      role: 'ADMIN',
      isRoot: true,
      name: 'Registrar (root)',
    },
    create: {
      email: ROOT_EMAIL,
      username: ROOT_USERNAME,
      name: 'Registrar (root)',
      passwordHash,
      role: 'ADMIN',
      isRoot: true,
      pointBalance: 0,
    },
  });
  console.log(`SEED_CRED ADMIN ${ROOT_EMAIL} ${ROOT_PASSWORD}`);
  console.log(`SEED_NOTE admin sign-in username: ${ROOT_USERNAME} (the email above also works)`);
}

async function seedStudents() {
  for (const student of DEMO_STUDENTS) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: { name: student.name, role: 'USER' },
      create: {
        email: student.email,
        name: student.name,
        role: 'USER',
        pointBalance: 1000,
      },
    });

    // A fresh, unexpired sign-in token so a demo student can always get in.
    const existing = await prisma.loginToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!existing) {
      const token = randomBytes(32).toString('base64url');
      await prisma.loginToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          delivered: true,
        },
      });
      console.log(`SEED_TOKEN USER ${student.email} ${token}`);
    }
  }
}

async function seedClasses() {
  for (const klass of DEMO_CLASSES) {
    const existing = await prisma.class.findFirst({ where: { name: klass.name } });
    if (existing) {
      await prisma.class.update({
        where: { id: existing.id },
        data: { code: klass.code, faculty: klass.faculty, term: TERM },
      });
    } else {
      await prisma.class.create({ data: { ...klass, term: TERM } });
    }
  }
}

async function seedWindow() {
  const opensAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.biddingWindow.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, opensAt, closesAt },
  });
}

async function main() {
  await seedRootAdmin();
  await seedStudents();
  await seedClasses();
  await seedWindow();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
