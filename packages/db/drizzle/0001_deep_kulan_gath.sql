CREATE TABLE "ger_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"slot" varchar(24) NOT NULL,
	"era_id" integer,
	"rarity" varchar(16) DEFAULT 'common' NOT NULL,
	"emoji" varchar(16),
	"description" text NOT NULL,
	"source_ref" text NOT NULL,
	"unlock_level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_ger_items" (
	"user_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ger_items" ADD CONSTRAINT "ger_items_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ger_items" ADD CONSTRAINT "user_ger_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ger_items" ADD CONSTRAINT "user_ger_items_item_id_ger_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ger_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_ger_items_uq" ON "user_ger_items" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "user_ger_equipped_idx" ON "user_ger_items" USING btree ("user_id","equipped");