DO $$ BEGIN
    CREATE TYPE "public"."ad_status" AS ENUM('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."ads_visibility_status" AS ENUM('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."order_item_status" AS ENUM('PENDING', 'ACCEPTED', 'UNAVAILABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'INACTIVE';
