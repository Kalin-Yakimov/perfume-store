import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260920172115 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_taxonomy" drop constraint if exists "perfume_taxonomy_kind_check";`);

    this.addSql(`alter table if exists "perfume_taxonomy" add constraint "perfume_taxonomy_kind_check" check("kind" in ('designer', 'note', 'accord'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "perfume_taxonomy" drop constraint if exists "perfume_taxonomy_kind_check";`);

    this.addSql(`alter table if exists "perfume_taxonomy" add constraint "perfume_taxonomy_kind_check" check("kind" in ('designer', 'note'));`);
  }

}
