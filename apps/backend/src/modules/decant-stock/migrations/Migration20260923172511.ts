import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260923172511 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "decant_allocation" ("id" text not null, "cart_id" text not null, "order_id" text null, "source_product_id" text not null, "decant_variant_id" text not null, "bottle_kind" text check ("bottle_kind" in ('open', 'planned')) not null, "bottle_id" text not null, "volume_ml" real not null, "status" text check ("status" in ('reserved', 'prepared', 'released')) not null default 'reserved', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "decant_allocation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_allocation_deleted_at" ON "decant_allocation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_allocation_cart_id_status" ON "decant_allocation" ("cart_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_allocation_order_id_status" ON "decant_allocation" ("order_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_allocation_bottle_kind_bottle_id_status" ON "decant_allocation" ("bottle_kind", "bottle_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_allocation_source_product_id_status" ON "decant_allocation" ("source_product_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "decant_planned_bottle" ("id" text not null, "source_product_id" text not null, "source_variant_id" text not null, "source_volume_ml" real not null, "usable_ml" real not null, "inventory_item_id" text not null, "location_id" text not null, "reservation_id" text not null, "opened_bottle_id" text null, "status" text check ("status" in ('planned', 'opened', 'released')) not null default 'planned', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "decant_planned_bottle_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_planned_bottle_deleted_at" ON "decant_planned_bottle" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_decant_planned_bottle_source_product_id_status" ON "decant_planned_bottle" ("source_product_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_decant_planned_bottle_reservation_id_unique" ON "decant_planned_bottle" ("reservation_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "decant_allocation" cascade;`);

    this.addSql(`drop table if exists "decant_planned_bottle" cascade;`);
  }

}
