CREATE TYPE "public"."session_status" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "ads_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ads_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"ads_visibility_status" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"plan_id" uuid,
	"is_plan_overridden" boolean DEFAULT false NOT NULL,
	"overriden_plan" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"used_tables" integer DEFAULT 0 NOT NULL,
	"used_menu_items" integer DEFAULT 0 NOT NULL,
	"used_staff_accounts" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"lead_id" uuid,
	"session_token" varchar(255) NOT NULL,
	"session_start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"session_end_time" timestamp with time zone,
	"session_status" "session_status" DEFAULT 'ACTIVE' NOT NULL,
	"closed_by" uuid,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN IF NOT EXISTS "type" varchar(50) DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "menu_categories_items" ADD COLUMN IF NOT EXISTS "quantities" jsonb;--> statement-breakpoint
ALTER TABLE "ads_visibility" ADD CONSTRAINT "ads_visibility_ads_id_ads_id_fk" FOREIGN KEY ("ads_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads_visibility" ADD CONSTRAINT "ads_visibility_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_info" ADD CONSTRAINT "restaurant_info_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_info" ADD CONSTRAINT "restaurant_info_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ads_visibility_ads_restaurant_idx" ON "ads_visibility" USING btree ("ads_id","restaurant_id");--> statement-breakpoint
CREATE INDEX "ads_visibility_restaurant_idx" ON "ads_visibility" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ads_visibility_ads_idx" ON "ads_visibility" USING btree ("ads_id");--> statement-breakpoint
CREATE INDEX "ads_visibility_status_idx" ON "ads_visibility" USING btree ("ads_visibility_status");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_info_restaurant_idx" ON "restaurant_info" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "restaurant_info_plan_idx" ON "restaurant_info" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "table_session_restaurant_idx" ON "table_session" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "table_session_table_idx" ON "table_session" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "table_session_lead_idx" ON "table_session" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "table_session_token_idx" ON "table_session" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "table_session_status_idx" ON "table_session" USING btree ("session_status");