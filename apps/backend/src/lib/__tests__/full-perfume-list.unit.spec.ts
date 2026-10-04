import { FullPerfumeListQuerySchema } from "../../api/admin/full-perfumes/query-schema"
import {
  fullPerfumeListFilters,
  readFullPerfumeList,
} from "../full-perfume-list"
import { readDecantStockProductNames } from "../decant-stock-product-names"

it("bounds pagination and trims search terms", () => {
  expect(FullPerfumeListQuerySchema.parse({ q: " rose " })).toEqual({
    q: "rose",
    limit: 20,
    offset: 0,
  })
  for (const query of [
    { limit: 101 },
    { limit: 0 },
    { offset: -1 },
    { offset: 0.5 },
    { q: "a".repeat(201) },
  ]) {
    expect(FullPerfumeListQuerySchema.safeParse(query).success).toBe(false)
  }
})
it("escapes search wildcards and matches each term in the database", () => {
  const filters = fullPerfumeListFilters("Rose 20%_\\")
  expect(filters.$and).toHaveLength(3)
  expect(filters.$and[2]).toMatchObject({
    $or: [
      { title: { $ilike: "%20\\%\\_\\\\%" } },
      { handle: { $ilike: "%20\\%\\_\\\\%" } },
      { metadata: { brand: { $ilike: "%20\\%\\_\\\\%" } } },
    ],
  })
})
it("only asks for a compact, stably ordered page and preserves count", async () => {
  const graph = jest
    .fn()
    .mockResolvedValue({ data: [{ id: "later" }], metadata: { count: 105 } })
  const container = { resolve: () => ({ graph }) } as never
  expect(
    await readFullPerfumeList(container, { offset: 100, limit: 20, q: "Rose" }),
  ).toEqual({ products: [{ id: "later" }], count: 105, offset: 100, limit: 20 })
  const input = graph.mock.calls[0][0]
  expect(input.pagination).toEqual({
    skip: 100,
    take: 20,
    order: { title: "ASC", id: "ASC" },
  })
  expect(input.fields).not.toContain("description")
  expect(
    input.fields.some((field: string) => field.includes("inventory")),
  ).toBe(false)
})
it("reads stock names by the actual source IDs in bounded batches, not the first 100 products", async () => {
  const ids = Array.from({ length: 105 }, (_, i) => `product_${i}`)
  const graph = jest
    .fn()
    .mockImplementation(async ({ filters }) => ({
      data: filters.id.map((id: string) => ({ id, title: id })),
    }))
  const products = await readDecantStockProductNames(
    { resolve: () => ({ graph }) } as never,
    [...ids, ids[0]],
  )
  expect(products).toHaveLength(105)
  expect(products[104]).toEqual({ id: "product_104", title: "product_104" })
  expect(graph).toHaveBeenCalledTimes(2)
  expect(graph.mock.calls[1][0].filters.id).toEqual(ids.slice(100))
})
