-- 1. Add PENDING and REJECTED to restaurant_status enum
ALTER TYPE "public"."restaurant_status" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "public"."restaurant_status" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2. Add rejection_reason column to restaurants
ALTER TABLE "public"."restaurants" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- 3. Add order lifecycle values to order_status enum
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'SERVED';
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'PAID';

-- 4. Create plan_requests table for restaurant plan-change requests
CREATE TABLE IF NOT EXISTS "public"."plan_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL REFERENCES "public"."restaurants"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "public"."plans"("id"),
  "billing_cycle" varchar(50) DEFAULT 'monthly' NOT NULL,
  "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
  "requested_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "rejection_reason" text,
  "createdat" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedat" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "plan_requests_restaurant_idx" ON "public"."plan_requests" ("restaurant_id");
CREATE INDEX IF NOT EXISTS "plan_requests_status_idx" ON "public"."plan_requests" ("status");
