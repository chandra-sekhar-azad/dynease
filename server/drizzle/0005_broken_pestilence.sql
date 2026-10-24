CREATE TABLE "customer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"order_status" varchar(30) DEFAULT 'SUBMITTED' NOT NULL,
	"idempotency_key" varchar(255),
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"special_instructions" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_order_details_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "geofence_radius_meters" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "visit_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "requested_quantity" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "accepted_quantity" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_status" varchar(30) DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "modified_by" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "modified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_visit_id_order_details_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."order_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_orders_visit_idx" ON "customer_orders" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "customer_orders_restaurant_idx" ON "customer_orders" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_orders_idempotency_idx" ON "customer_orders" USING btree ("restaurant_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_session_id_table_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "customer_orders" ("id", "restaurant_id", "visit_id", "order_number", "order_status", "subtotal", "createdat", "updatedat")
SELECT "id", "restaurant_id", "id", COALESCE("order_number", 'ORD-' || SUBSTRING("id"::text, 1, 8)), 'COMPLETED', "total_amount", "createdat", "updatedat"
FROM "order_details"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "order_items" SET "visit_id" = "order_id" WHERE "visit_id" IS NULL;--> statement-breakpoint
UPDATE "order_items" SET "requested_quantity" = "quantity", "accepted_quantity" = "quantity" WHERE "requested_quantity" IS NULL;--> statement-breakpoint
UPDATE "order_details" SET "order_status" = 'COMPLETED' WHERE "id" = '8bdcc3e6-cffb-4fa5-8595-14d44c7921d0';--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_visit_id_order_details_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."order_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_modified_by_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_details_session_idx" ON "order_details" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_table_visit_idx" ON "order_details" USING btree ("table_id") WHERE "order_details"."order_status" NOT IN ('COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE INDEX "order_items_visit_idx" ON "order_items" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_restaurant_number_unique" ON "leads" USING btree ("restaurant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "active_table_session_idx" ON "table_session" USING btree ("table_id") WHERE "table_session"."session_status" = 'ACTIVE';