import type { IProductModuleService } from "@medusajs/framework/types"
import {
  assertPerfumeTaxonomyUnused,
  assertTaxonomyRenameHasStableReferences,
  usesPerfumeTaxonomy,
} from "../perfume-taxonomy-references"

describe("taxonomy reference safety", () => {
  const designer = { id: "designer_1", kind: "designer", name: "New name" }
  it("uses the ID after a rename, not a copied name", () => {
    expect(
      usesPerfumeTaxonomy(
        { brand: "Old name", perfume_profile: { designer_id: designer.id } },
        designer,
      ),
    ).toBe(true)
    expect(
      usesPerfumeTaxonomy(
        { brand: designer.name, perfume_profile: { designer_id: "different" } },
        designer,
      ),
    ).toBe(false)
  })
  it("finds notes in every layer and accords", () => {
    for (const key of [
      "top_note_ids",
      "heart_note_ids",
      "base_note_ids",
      "accord_ids",
    ]) {
      expect(
        usesPerfumeTaxonomy(
          { perfume_profile: { [key]: ["tax_1"] } },
          {
            id: "tax_1",
            kind: key === "accord_ids" ? "accord" : "note",
            name: "Name",
          },
        ),
      ).toBe(true)
    }
  })
  it("protects name-only legacy references, but respects explicitly cleared IDs", () => {
    expect(
      usesPerfumeTaxonomy(
        { perfume_accords: ["Дървесен"] },
        { id: "accord_1", kind: "accord", name: "Дървесен" },
      ),
    ).toBe(true)
    expect(
      usesPerfumeTaxonomy(
        { perfume_notes: ["Роза"] },
        { id: "note_1", kind: "note", name: "Роза" },
      ),
    ).toBe(true)
    expect(
      usesPerfumeTaxonomy(
        {
          perfume_notes: ["Роза"],
          perfume_profile: {
            top_note_ids: [],
            heart_note_ids: [],
            base_note_ids: [],
          },
        },
        { id: "note_1", kind: "note", name: "Роза" },
      ),
    ).toBe(false)
  })
  it("blocks references after the first page, including hidden/draft products", async () => {
    const listProducts = jest
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, metadata: {} })),
      )
      .mockResolvedValueOnce([
        {
          id: "hidden",
          metadata: { perfume_profile: { designer_id: designer.id } },
        },
      ])
    await expect(
      assertPerfumeTaxonomyUnused(
        { listProducts } as unknown as IProductModuleService,
        designer,
      ),
    ).rejects.toThrow("се използва")
    expect(listProducts).toHaveBeenNthCalledWith(
      2,
      {},
      expect.objectContaining({ skip: 100 }),
    )
  })
  it("allows deletion only after checking every page", async () => {
    const listProducts = jest
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, () => ({ metadata: {} })),
      )
      .mockResolvedValueOnce([])
    await expect(
      assertPerfumeTaxonomyUnused(
        { listProducts } as unknown as IProductModuleService,
        designer,
      ),
    ).resolves.toBeUndefined()
    expect(listProducts).toHaveBeenCalledTimes(2)
  })
  it("requires selecting stable references before renaming legacy name-only records", async () => {
    const listProducts = jest
      .fn()
      .mockResolvedValue([{ metadata: { brand: designer.name } }])
    await expect(
      assertTaxonomyRenameHasStableReferences(
        { listProducts } as unknown as IProductModuleService,
        designer,
      ),
    ).rejects.toThrow("Първо изберете отново")
    listProducts.mockResolvedValue([
      {
        metadata: {
          brand: designer.name,
          perfume_profile: { designer_id: designer.id },
        },
      },
    ])
    await expect(
      assertTaxonomyRenameHasStableReferences(
        { listProducts } as unknown as IProductModuleService,
        designer,
      ),
    ).resolves.toBeUndefined()
  })
})
