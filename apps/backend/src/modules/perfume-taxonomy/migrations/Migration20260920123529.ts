import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260920123529 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "perfume_taxonomy" drop constraint if exists "perfume_taxonomy_kind_slug_unique";`);
    this.addSql(`create table if not exists "perfume_taxonomy" ("id" text not null, "kind" text check ("kind" in ('designer', 'note')) not null, "name" text not null, "slug" text not null, "image_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "perfume_taxonomy_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_perfume_taxonomy_deleted_at" ON "perfume_taxonomy" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_perfume_taxonomy_kind_slug_unique" ON "perfume_taxonomy" ("kind", "slug") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "perfume_taxonomy" cascade;`);
  }

}
