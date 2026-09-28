import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260921101000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "decant_bottle" add column if not exists "source_volume_ml" real not null default 100;`)
    this.addSql(`alter table "decant_bottle" add column if not exists "reserve_ml" real not null default 5;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "decant_bottle" drop column if exists "source_volume_ml";`)
    this.addSql(`alter table "decant_bottle" drop column if exists "reserve_ml";`)
  }
}
