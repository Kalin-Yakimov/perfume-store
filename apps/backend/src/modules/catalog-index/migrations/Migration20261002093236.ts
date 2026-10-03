import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002093236 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "catalog_snapshot" drop constraint if exists "catalog_snapshot_context_key_unique";`);
    this.addSql(`alter table if exists "catalog_entry" drop constraint if exists "catalog_entry_context_key_generation_product_id_unique";`);
    this.addSql(`create table if not exists "catalog_entry" ("id" text not null, "context_key" text not null, "generation" text not null, "product_id" text not null, "listing_type" text check ("listing_type" in ('full_perfume', 'decant')) not null, "product_created_at" timestamptz not null, "price" integer null, "unavailable" boolean not null, "search_text" text not null, "gender_text" text not null, "season_text" text not null, "brand_text" text not null, "legacy_note_text" text not null, "designer_id" text null, "collection_id" text null, "traits" jsonb not null, "brand_value" text null, "brand_label" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "catalog_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_catalog_entry_deleted_at" ON "catalog_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_catalog_entry_context_key_generation_product_id_unique" ON "catalog_entry" ("context_key", "generation", "product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_catalog_entry_context_key_generation_listing_type_unavailable_price" ON "catalog_entry" ("context_key", "generation", "listing_type", "unavailable", "price") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_catalog_entry_context_key_generation_listing_type_unavailable_product_created_at" ON "catalog_entry" ("context_key", "generation", "listing_type", "unavailable", "product_created_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "catalog_snapshot" ("id" text not null, "context_key" text not null, "generation" text not null, "expires_at" timestamptz not null, "revision" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "catalog_snapshot_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_catalog_snapshot_context_key_unique" ON "catalog_snapshot" ("context_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_catalog_snapshot_deleted_at" ON "catalog_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "catalog_entry" cascade;`);

    this.addSql(`drop table if exists "catalog_snapshot" cascade;`);
  }

}
