import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { LockMode } from "@medusajs/framework/mikro-orm/core"
import { randomUUID } from "node:crypto"
import { CatalogEntry } from "./models/catalog-entry"
import { CatalogSnapshot } from "./models/catalog-snapshot"

export type CatalogEntryInput = Omit<
  InferTypeOf<typeof CatalogEntry>,
  "id" | "created_at" | "updated_at" | "deleted_at" | "raw_price"
>
export type PublishCatalogInput = {
  context_key: string
  generation: string
  revision: string
  entries: CatalogEntryInput[]
}

class CatalogIndexModuleService extends MedusaService({
  CatalogEntry,
  CatalogSnapshot,
}) {
  @InjectManager()
  async prepareSnapshot(
    contextKey: string,
    @MedusaContext() context: Context = {},
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const [existing] = await this.listCatalogSnapshots(
        { context_key: contextKey },
        { take: 1 },
        context,
      )
      if (!existing) {
        try {
          await this.createCatalogSnapshots(
            {
              context_key: contextKey,
              generation: "empty",
              expires_at: new Date(0),
              revision: randomUUID(),
            },
            context,
          )
        } catch (error) {
          // Another process may create the unique pointer first. This read is
          // outside the failed create transaction; other failures still surface.
          const [concurrent] = await this.listCatalogSnapshots(
            { context_key: contextKey },
            { take: 1 },
            context,
          )
          if (!concurrent) throw error
        }
      }
      const prepared = await this.prepareSnapshot_(contextKey, context)
      if (prepared) return prepared
      // Cleanup may delete an aged pointer between the two reads. Recreate it
      // rather than dereferencing a missing row; never retry indefinitely.
    }
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Catalog preparation raced cache cleanup. Retry the request.",
    )
  }

  @InjectTransactionManager()
  protected async prepareSnapshot_(
    contextKey: string,
    @MedusaContext() context: Context = {},
  ) {
    const [snapshot] = await this.listCatalogSnapshots(
      { context_key: contextKey },
      { take: 1, options: { lockMode: LockMode.PESSIMISTIC_WRITE } },
      context,
    )
    if (!snapshot) return null
    // Force a touch so cleanup cannot prune a pointer during its rebuild.
    return await this.updateCatalogSnapshots(
      { id: snapshot.id, revision: randomUUID() },
      context,
    )
  }

  @InjectManager()
  async invalidateSnapshots(@MedusaContext() context: Context = {}) {
    return await this.invalidateSnapshots_(context)
  }

  @InjectTransactionManager()
  protected async invalidateSnapshots_(@MedusaContext() context: Context = {}) {
    // Waiters and writes share this transaction's connection. Advisory locks
    // around a different module connection would starve the shared DB pool.
    const snapshots = await this.listCatalogSnapshots(
      {},
      {
        order: { id: "ASC" },
        options: { lockMode: LockMode.PESSIMISTIC_WRITE },
      },
      context,
    )
    if (snapshots.length)
      await this.updateCatalogSnapshots(
        snapshots.map((snapshot) => ({
          id: snapshot.id,
          expires_at: new Date(0),
          revision: randomUUID(),
        })),
        context,
      )
  }

  @InjectManager()
  async publishSnapshot(
    input: PublishCatalogInput,
    @MedusaContext() context: Context = {},
  ) {
    const snapshot = await this.publishSnapshot_(input, context)
    // Pruning is outside the publisher's locked transaction to avoid two
    // contexts holding their own pointer and then waiting to delete the other.
    await this.pruneSnapshots_(context)
    return snapshot
  }

  @InjectTransactionManager()
  protected async publishSnapshot_(
    input: PublishCatalogInput,
    @MedusaContext() context: Context = {},
  ) {
    const [previous] = await this.listCatalogSnapshots(
      { context_key: input.context_key },
      { take: 1, options: { lockMode: LockMode.PESSIMISTIC_WRITE } },
      context,
    )
    for (let offset = 0; offset < input.entries.length; offset += 100) {
      await this.createCatalogEntries(
        input.entries.slice(offset, offset + 100),
        context,
      )
    }
    // If invalidation arrived during the rebuild, don't mark those rows fresh.
    const expiresAt =
      previous && previous.revision !== input.revision
        ? new Date(0)
        : new Date(Date.now() + 60_000)
    const data = {
      context_key: input.context_key,
      generation: input.generation,
      expires_at: expiresAt,
      revision: previous?.revision || input.revision,
    }
    // All callers prepare the pointer first, including the initial rebuild.
    if (!previous)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Catalog snapshot must be prepared before publication",
      )
    const snapshot = await this.updateCatalogSnapshots(
      { id: previous.id, ...data },
      context,
    )
    // Keep recent generations for concurrent readers. Remove abandoned/stale
    // projections from all contexts so group/region caches cannot grow forever.
    await this.deleteCatalogEntries(
      { created_at: { $lt: new Date(Date.now() - 3_600_000) } },
      context,
    )
    return snapshot
  }

  @InjectTransactionManager()
  protected async pruneSnapshots_(@MedusaContext() context: Context = {}) {
    const aged = await this.listCatalogSnapshots(
      { updated_at: { $lt: new Date(Date.now() - 3_600_000) } },
      {
        order: { id: "ASC" },
        options: { lockMode: LockMode.PESSIMISTIC_WRITE },
      },
      context,
    )
    if (aged.length)
      await this.deleteCatalogSnapshots(
        aged.map((snapshot) => snapshot.id),
        context,
      )
  }
}

export default CatalogIndexModuleService
