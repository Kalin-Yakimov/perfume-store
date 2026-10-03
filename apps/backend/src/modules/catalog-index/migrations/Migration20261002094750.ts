import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002094750 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "catalog_entry" add column if not exists "raw_price" jsonb null;`);
    this.addSql(`alter table if exists "catalog_entry" alter column "price" type numeric using ("price"::numeric);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "catalog_entry" drop column if exists "raw_price";`);

    this.addSql(`alter table if exists "catalog_entry" alter column "price" type real using ("price"::real);`);
  }

}
