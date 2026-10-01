import { listAllPerfumeTaxonomies } from "../list-all"
import type PerfumeTaxonomyModuleService from "../service"

it("lists taxonomy records beyond the default/first page", async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({ id: `note_${i}` }))
  const listPerfumeTaxonomies = jest
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce([{ id: "last" }])
  const items = await listAllPerfumeTaxonomies(
    { listPerfumeTaxonomies } as unknown as PerfumeTaxonomyModuleService,
    { kind: "note" },
  )
  expect(items).toHaveLength(101)
  expect(items[100].id).toBe("last")
  expect(listPerfumeTaxonomies).toHaveBeenNthCalledWith(
    2,
    { kind: "note" },
    expect.objectContaining({ skip: 100 }),
  )
})
