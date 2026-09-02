-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_root" BOOLEAN NOT NULL DEFAULT false,
    "point_balance" INTEGER NOT NULL DEFAULT 1000,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "faculty" TEXT NOT NULL DEFAULT '',
    "term" TEXT NOT NULL DEFAULT '',
    "seat_cap" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidding_window" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidding_window_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "login_tokens_token_hash_key" ON "login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "login_tokens_user_id_used_at_idx" ON "login_tokens"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "bids_class_id_amount_idx" ON "bids"("class_id", "amount");

-- CreateIndex
CREATE INDEX "bids_user_id_status_idx" ON "bids"("user_id", "status");

-- AddForeignKey
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Constraints Prisma's schema language cannot express.

-- A class always has at least one seat.
ALTER TABLE "classes" ADD CONSTRAINT "classes_seat_cap_positive" CHECK ("seat_cap" > 0);

-- A bid always commits at least one point.
ALTER TABLE "bids" ADD CONSTRAINT "bids_amount_positive" CHECK ("amount" > 0);

-- At most one ACTIVE bid per (student, class): editing a bid updates in place.
CREATE UNIQUE INDEX "bids_active_unique" ON "bids"("user_id", "class_id") WHERE "status" = 'ACTIVE';

-- Winner selection scans a class's bids highest-first.
CREATE INDEX "bids_class_amount_desc" ON "bids"("class_id", "amount" DESC) WHERE "status" = 'ACTIVE';

-- The window must be a real interval, and there can only ever be one row.
ALTER TABLE "bidding_window" ADD CONSTRAINT "bidding_window_range" CHECK ("closes_at" > "opens_at");
ALTER TABLE "bidding_window" ADD CONSTRAINT "bidding_window_singleton" CHECK ("id" = 1);
