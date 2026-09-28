import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260920134318 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_taxonomy" add column if not exists "original_name" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_taxonomy" drop column if exists "original_name";`);
  }

}
