import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260922100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "decant_adjustment" add column if not exists "order_id" text null;`)
    this.addSql(`create index if not exists "IDX_decant_adjustment_order_id" on "decant_adjustment" ("order_id") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_decant_adjustment_order_id";`)
    this.addSql(`alter table "decant_adjustment" drop column if exists "order_id";`)
  }
}
