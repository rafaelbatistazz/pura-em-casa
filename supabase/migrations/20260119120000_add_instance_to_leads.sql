-- Add instance_name column to leads table
ALTER TABLE "public"."leads" ADD COLUMN "instance_name" text;

-- Add index for performance in lookups
CREATE INDEX "leads_instance_name_idx" ON "public"."leads" USING btree ("instance_name");

-- Comment on column
COMMENT ON COLUMN "public"."leads"."instance_name" IS 'The WhatsApp instance name assigned to this lead. If null, system uses default.';
