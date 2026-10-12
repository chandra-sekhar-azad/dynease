CREATE TYPE "public"."user_type" AS ENUM('SYSTEM_ADMIN', 'ADMIN', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."restaurant_status" AS ENUM('ACTIVE', 'PAUSED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('ASSIGNED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."assignment_type" AS ENUM('MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NO_ORDER', 'ORDERED');--> statement-breakpoint
CREATE TYPE "public"."menu_item_type" AS ENUM('VEG', 'NON_VEG');--> statement-breakpoint
CREATE TYPE "public"."item_size" AS ENUM('SMALL', 'MEDIUM', 'LARGE', 'JUMBO', 'FULL', 'HALF');--> statement-breakpoint
CREATE TYPE "public"."menu_item_status" AS ENUM('AVAILABLE', 'UNAVAILABLE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."menu_category_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."table_allocation_mode" AS ENUM('MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('WORKING', 'HOLIDAY', 'LEAVE');--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"phone_number" varchar(50),
	"restaurant_id" varchar(64),
	"user_type" "user_type" DEFAULT 'STAFF' NOT NULL,
	"user_status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"sessionVersion" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" jsonb,
	"phone_number" varchar(50),
	"restaurant_status" "restaurant_status" DEFAULT 'ACTIVE' NOT NULL,
	"plan_id" varchar(64),
	"is_plan_overridden" boolean DEFAULT false NOT NULL,
	"overriden_plan" jsonb,
	"domain" varchar(255) NOT NULL,
	"table_allocation_mode" "table_allocation_mode" DEFAULT 'MANUAL' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"configuration" jsonb DEFAULT '{}' NOT NULL,
	"plan_status" "plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64),
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"table_code" varchar(50) NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"section" varchar(100),
	"qr_token" varchar(255) NOT NULL,
	"table_status" "table_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64),
	CONSTRAINT "tables_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "tables_assignment" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"table_id" varchar(64) NOT NULL,
	"staff_id" varchar(64) NOT NULL,
	"assignment_type" "assignment_type" DEFAULT 'MANUAL' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" varchar(64),
	"released_at" timestamp with time zone,
	"assignment_status" "assignment_status" DEFAULT 'ASSIGNED' NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdby" varchar(64),
	"updatedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"category" varchar(255) NOT NULL,
	"description" text,
	"menu_category_status" "menu_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "menu_categories_items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"category_id" varchar(64) NOT NULL,
	"menu_item_status" "menu_item_status" DEFAULT 'AVAILABLE' NOT NULL,
	"menu_item_type" "menu_item_type" DEFAULT 'VEG' NOT NULL,
	"name" varchar(255) NOT NULL,
	"item_size" "item_size" DEFAULT 'MEDIUM',
	"description" text,
	"price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.00',
	"preparation_time" integer DEFAULT 15,
	"image" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "order_details" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"table_id" varchar(64) NOT NULL,
	"lead_id" varchar(64),
	"order_status" "order_status" DEFAULT 'ORDERED' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"order_number" varchar(100),
	"customer_name" varchar(255) DEFAULT 'Guest',
	"customer_phone" varchar(50),
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0.00',
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"final_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"payment_status" varchar(50) DEFAULT 'PENDING',
	"payment_method" varchar(50) DEFAULT 'CASH',
	"special_instructions" text,
	"assigned_waiter_id" varchar(64),
	"app_status" varchar(50) DEFAULT 'PENDING',
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdby" varchar(64),
	"updatedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"menu_item_id" varchar(64),
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"customizations" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdby" varchar(64),
	"updatedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"name" varchar(255),
	"number" varchar(50) NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedat" timestamp with time zone,
	"createdby" varchar(64),
	"updatedby" varchar(64),
	"deletedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"name" varchar(100) DEFAULT 'Default Shift',
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdby" varchar(64),
	"updatedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"shift_id" varchar(64),
	"shift_type" "shift_type" DEFAULT 'WORKING' NOT NULL,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL,
	"createdby" varchar(64),
	"updatedby" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64),
	"user_id" varchar(64),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(64),
	"details" jsonb DEFAULT '{}',
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"table_id" varchar(64) NOT NULL,
	"table_number" varchar(50) NOT NULL,
	"type" varchar(50) DEFAULT 'CALL_WAITER' NOT NULL,
	"note" text DEFAULT '',
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"assigned_waiter_id" varchar(64),
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"restaurant_id" varchar(64) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"table_id" varchar(64),
	"table_number" varchar(50),
	"previous_waiter_id" varchar(64),
	"new_waiter_id" varchar(64),
	"assignment_mode" varchar(50) DEFAULT 'HYBRID',
	"action" varchar(50) NOT NULL,
	"actor_id" varchar(64),
	"actor_role" varchar(50),
	"score" varchar(50),
	"score_inputs" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables_assignment" ADD CONSTRAINT "tables_assignment_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories_items" ADD CONSTRAINT "menu_categories_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories_items" ADD CONSTRAINT "menu_categories_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_order_details_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_categories_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_categories_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_waiter_id_users_id_fk" FOREIGN KEY ("assigned_waiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_active" ON "users" USING btree (LOWER("email")) WHERE "users"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_phone_active" ON "users" USING btree ("phone_number") WHERE "users"."is_deleted" = false AND "users"."phone_number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_restaurants_domain_active" ON "restaurants" USING btree (LOWER("domain")) WHERE "restaurants"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tables_restaurant_code_active" ON "tables" USING btree ("restaurant_id","table_code") WHERE "tables"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_table_active_assignment" ON "tables_assignment" USING btree ("table_id") WHERE "tables_assignment"."assignment_status" = 'ASSIGNED';--> statement-breakpoint
CREATE INDEX "idx_tables_assignment_restaurant_staff" ON "tables_assignment" USING btree ("restaurant_id","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_menu_categories_restaurant_name_active" ON "menu_categories" USING btree ("restaurant_id",LOWER("category")) WHERE "menu_categories"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_menu_items_category_name_active" ON "menu_categories_items" USING btree ("category_id",LOWER("name")) WHERE "menu_categories_items"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "idx_menu_items_restaurant_status" ON "menu_categories_items" USING btree ("restaurant_id","menu_item_status");--> statement-breakpoint
CREATE INDEX "idx_order_details_restaurant_date" ON "order_details" USING btree ("restaurant_id","date");--> statement-breakpoint
CREATE INDEX "idx_order_details_restaurant_table" ON "order_details" USING btree ("restaurant_id","table_id");--> statement-breakpoint
CREATE INDEX "idx_order_details_restaurant_lead" ON "order_details" USING btree ("restaurant_id","lead_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_restaurant_order" ON "order_items" USING btree ("restaurant_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_restaurant_menu_item" ON "order_items" USING btree ("restaurant_id","menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leads_restaurant_number" ON "leads" USING btree ("restaurant_id","number");--> statement-breakpoint
CREATE INDEX "idx_shifts_restaurant" ON "shifts" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rosters_restaurant_user_date" ON "rosters" USING btree ("restaurant_id","user_id","date");--> statement-breakpoint
CREATE INDEX "idx_audit_log_restaurant_created" ON "audit_log" USING btree ("restaurant_id","createdat");--> statement-breakpoint
CREATE INDEX "idx_audit_log_restaurant_entity" ON "audit_log" USING btree ("restaurant_id","entity_type","entity_id");