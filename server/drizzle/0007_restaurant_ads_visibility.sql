ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "ads_enabled" boolean;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "subscription_start_date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "subscription_end_date" timestamp with time zone;
