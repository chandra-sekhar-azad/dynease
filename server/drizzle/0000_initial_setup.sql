CREATE TYPE "public"."user_type" AS ENUM('SYSTEM_ADMIN', 'ADMIN', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."restaurant_status" AS ENUM('ACTIVE', 'PAUSED', 'INACTIVE', 'PENDING', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('ASSIGNED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."table_allocation_mode" AS ENUM('MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."menu_category_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."menu_item_status" AS ENUM('AVAILABLE', 'UNAVAILABLE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."menu_item_type" AS ENUM('VEG', 'NON_VEG');--> statement-breakpoint
CREATE TYPE "public"."item_size" AS ENUM('SMALL', 'MEDIUM', 'LARGE', 'JUMBO', 'FULL', 'HALF');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NO_ORDER', 'ORDERED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('WORKING', 'HOLIDAY', 'LEAVE');--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"url" text,
	"ad_status" boolean DEFAULT true NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid,
	"user_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"table_id" uuid,
	"request_type" varchar(100) NOT NULL,
	"request_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"staff_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(30),
	"password_hash" varchar(255) NOT NULL,
	"restaurant_id" uuid,
	"user_type" "user_type" NOT NULL,
	"user_status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"sessionVersion" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"restaurant_name" varchar(255) NOT NULL,
	"address" text,
	"phone_number" varchar(30),
	"restaurant_status" "restaurant_status" DEFAULT 'ACTIVE' NOT NULL,
	"plan_id" uuid,
	"is_plan_overridden" boolean DEFAULT false NOT NULL,
	"overriden_plan" varchar(100),
	"domain" varchar(255) NOT NULL,
	"table_allocation_mode" "table_allocation_mode" DEFAULT 'MANUAL' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan_status" "plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"table_code" varchar(100) NOT NULL,
	"qr_token" varchar(255) NOT NULL,
	"table_status" "table_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tables_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"assignment_type" "assignment_type" DEFAULT 'MANUAL' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	"released_at" timestamp with time zone,
	"assignment_status" "assignment_status" DEFAULT 'ASSIGNED' NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category" varchar(255) NOT NULL,
	"description" text,
	"menu_category_status" "menu_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_categories_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"menu_item_status" "menu_item_status" DEFAULT 'AVAILABLE' NOT NULL,
	"menu_item_type" "menu_item_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"item_size" "item_size" NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"rating" numeric(3, 2),
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"table_id" uuid,
	"lead_id" uuid,
	"order_status" "order_status" DEFAULT 'NO_ORDER' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"menu_item_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(255),
	"number" varchar(30) NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid,
	"shift_type" "shift_type" DEFAULT 'WORKING' NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" varchar(50) DEFAULT 'monthly' NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"requested_by" uuid,
	"rejection_reason" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories_items" ADD CONSTRAINT "menu_categories_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories_items" ADD CONSTRAINT "menu_categories_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_order_details_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_categories_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_categories_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ads_status_idx" ON "ads" USING btree ("ad_status");--> statement-breakpoint
CREATE INDEX "ads_display_order_idx" ON "ads" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "audit_log_restaurant_idx" ON "audit_log" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("createdat");--> statement-breakpoint
CREATE INDEX "service_requests_restaurant_idx" ON "service_requests" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "service_requests_table_idx" ON "service_requests" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "service_requests_status_idx" ON "service_requests" USING btree ("request_status");--> statement-breakpoint
CREATE INDEX "assignment_events_restaurant_idx" ON "assignment_events" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "assignment_events_assignment_idx" ON "assignment_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "assignment_events_staff_idx" ON "assignment_events" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "users_restaurant_idx" ON "users" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("user_status");--> statement-breakpoint
CREATE INDEX "restaurants_status_idx" ON "restaurants" USING btree ("restaurant_status");--> statement-breakpoint
CREATE INDEX "restaurants_domain_idx" ON "restaurants" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_name_unique" ON "plans" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_restaurant_code_unique" ON "tables" USING btree ("restaurant_id","table_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_qr_token_unique" ON "tables" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "tables_restaurant_idx" ON "tables" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "tables_assignment_restaurant_idx" ON "tables_assignment" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "tables_assignment_table_idx" ON "tables_assignment" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "tables_assignment_staff_idx" ON "tables_assignment" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "tables_assignment_status_idx" ON "tables_assignment" USING btree ("assignment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_categories_restaurant_category_unique" ON "menu_categories" USING btree ("restaurant_id","category");--> statement-breakpoint
CREATE INDEX "menu_categories_restaurant_idx" ON "menu_categories" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_category_name_size_unique" ON "menu_categories_items" USING btree ("category_id","name","item_size");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_categories_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_categories_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "order_details_restaurant_idx" ON "order_details" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "order_details_table_idx" ON "order_details" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "order_details_lead_idx" ON "order_details" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "order_details_status_idx" ON "order_details" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "order_items_restaurant_idx" ON "order_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_menu_item_idx" ON "order_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "leads_restaurant_idx" ON "leads" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "leads_number_idx" ON "leads" USING btree ("number");--> statement-breakpoint
CREATE INDEX "shifts_restaurant_idx" ON "shifts" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rosters_user_date_unique" ON "rosters" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "rosters_restaurant_idx" ON "rosters" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "rosters_shift_idx" ON "rosters" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "plan_requests_restaurant_idx" ON "plan_requests" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "plan_requests_status_idx" ON "plan_requests" USING btree ("status");