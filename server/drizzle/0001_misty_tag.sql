ALTER TABLE "order_details" ADD COLUMN "app_status" varchar(30) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "order_number" varchar(100);--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "customer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "customer_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "total_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "final_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "payment_status" varchar(30) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "payment_method" varchar(30) DEFAULT 'CASH' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "special_instructions" text;--> statement-breakpoint
ALTER TABLE "order_details" ADD COLUMN "assigned_waiter_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "customizations" text;--> statement-breakpoint
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_assigned_waiter_id_users_id_fk" FOREIGN KEY ("assigned_waiter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_details_app_status_idx" ON "order_details" USING btree ("app_status");--> statement-breakpoint
CREATE INDEX "order_details_order_number_idx" ON "order_details" USING btree ("order_number");