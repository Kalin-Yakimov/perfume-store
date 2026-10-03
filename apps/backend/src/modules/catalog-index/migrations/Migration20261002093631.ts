import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002093631 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "catalog_entry" alter column "price" type real using ("price"::real);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "catalog_entry" alter column "price" type integer using ("price"::integer);`);
  }

}
