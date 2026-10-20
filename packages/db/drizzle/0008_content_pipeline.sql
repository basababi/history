ALTER TABLE "questions" ADD COLUMN "content_key" varchar(32);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "reviewed_by" varchar(120);--> statement-breakpoint
CREATE UNIQUE INDEX "questions_content_key_uq" ON "questions" USING btree ("content_key");