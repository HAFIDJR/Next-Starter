ALTER TABLE "task" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "task_user_id_deleted_at_idx" ON "task" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "task_user_id_due_at_idx" ON "task" USING btree ("user_id","due_at");