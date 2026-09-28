import type { MedusaContainer } from "@medusajs/framework";
import { MedusaError, Modules } from "@medusajs/framework/utils";

import {
  canPackCartDecants,
  maxAdditionalDecantsForSnapshot,
} from "./cart-planning";
import { readDecantRequests, readStockSnapshot } from "./stock";

export type PreviewCartItem = {
  id?: string;
  product_id?: string | null;
  variant_id?: string | null;
  quantity?: number | null;
};

async function resolveCartItems(
  container: MedusaContainer,
  items: PreviewCartItem[],
): Promise<PreviewCartItem[]> {
  const missingVariantIds = [
    ...new Set(
      items
        .filter((item) => !item.product_id && item.variant_id)
        .map((item) => item.variant_id!),
    ),
  ];
  const variants = missingVariantIds.length
    ? await container.resolve(Modules.PRODUCT).listProductVariants({
        id: missingVariantIds,
      })
    : [];
  const productByVariant = new Map(
    variants.map((variant) => [variant.id, variant.product_id]),
  );
  const resolvedItems = items.map((item) => ({
    ...item,
    product_id:
      item.product_id ||
      (item.variant_id ? productByVariant.get(item.variant_id) : undefined),
  }));
  if (resolvedItems.some((item) => item.variant_id && !item.product_id)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Артикул в кошницата няма валидна продуктова обява.",
    );
  }

  return resolvedItems;
}

/** Preview only. The checkout workflow makes the authoritative reservation. */
export async function canFulfillCartDecants(
  container: MedusaContainer,
  items: PreviewCartItem[],
  salesChannelId?: string | null,
): Promise<boolean> {
  const resolvedItems = await resolveCartItems(container, items);

  const requests = await readDecantRequests(container, resolvedItems);

  const snapshots = new Map(
    await Promise.all(
      requests.map(async (request) => [
        request.sourceProductId,
        await readStockSnapshot(container, request, salesChannelId),
      ] as const),
    ),
  )

  return canPackCartDecants(resolvedItems, requests, snapshots)
}

/** Maximum extra vials of one variant that fit alongside the current cart. */
export async function maxAdditionalDecantQuantity(
  container: MedusaContainer,
  items: PreviewCartItem[],
  productId: string,
  variantId: string,
  salesChannelId?: string | null,
): Promise<number> {
  const resolvedItems = await resolveCartItems(container, items);
  const candidate = {
    product_id: productId,
    variant_id: variantId,
    quantity: 1,
  };
  const requests = await readDecantRequests(container, [
    ...resolvedItems,
    candidate,
  ]);
  const request = requests.find((entry) =>
    entry.units.some((unit) => unit.variantId === variantId),
  );
  if (!request) return 0;

  // The candidate is appended last, after all existing vials of this perfume.
  const snapshot = await readStockSnapshot(container, request, salesChannelId);
  const slots = snapshot.sealedSlots.map((slot) => ({ ...slot }));
  let wholeBottles = resolvedItems.reduce(
    (total, item) =>
      total +
      (item.variant_id === request.sourceVariantId
        ? Number(item.quantity || 0)
        : 0),
    0,
  );
  for (const slot of slots) {
    const taken = Math.min(wholeBottles, slot.availableUnits);
    slot.availableUnits -= taken;
    wholeBottles -= taken;
  }
  if (wholeBottles > 0) return 0;

  const alreadyInCart = resolvedItems.reduce(
    (total, item) =>
      total + (item.variant_id === variantId ? Number(item.quantity || 0) : 0),
    0,
  );
  const candidateUnit = request.units.at(-1)!
  return maxAdditionalDecantsForSnapshot({
    existingUnits: request.units.slice(0, -1),
    variantId,
    candidateVolumeMl: candidateUnit.volumeMl,
    alreadyInCart,
    bottles: snapshot.bottles,
    sealedSlots: slots,
    usableMl: snapshot.usableMl,
  })
}
