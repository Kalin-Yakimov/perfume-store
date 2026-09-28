import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260921100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "decant_bottle" ("id" text not null, "source_product_id" text not null, "source_variant_id" text not null, "source_volume_ml" real not null, "reserve_ml" real not null, "initial_ml" real not null, "remaining_ml" real not null, "status" text check ("status" in ('active', 'depleted')) not null default 'active', "opened_at" timestamptz not null, "closed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "decant_bottle_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_decant_bottle_source_product_id_status" on "decant_bottle" ("source_product_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_decant_bottle_deleted_at" on "decant_bottle" ("deleted_at") where "deleted_at" is null;`)
    this.addSql(`create table if not exists "decant_adjustment" ("id" text not null, "bottle_id" text not null, "change_ml" real not null, "reason" text check ("reason" in ('sale', 'sample', 'loss', 'correction')) not null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "decant_adjustment_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_decant_adjustment_bottle_id" on "decant_adjustment" ("bottle_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_decant_adjustment_deleted_at" on "decant_adjustment" ("deleted_at") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "decant_adjustment" cascade;`)
    this.addSql(`drop table if exists "decant_bottle" cascade;`)
  }
}
