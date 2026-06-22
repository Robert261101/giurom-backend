export type SupplierProductImageFields = {
  image_url: string | null;
  linked_product_photo: string | null;
  resolved_image_url: string | null;
};

function normalizeStoredImageUrl(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Fallback la citire: image_url → stock.products.photo (linked). Nu scrie în DB. */
export function buildSupplierProductImageFields(
  imageUrl: string | null | undefined,
  linkedProductPhoto: string | null | undefined,
): SupplierProductImageFields {
  const own = normalizeStoredImageUrl(imageUrl);
  const linked = normalizeStoredImageUrl(linkedProductPhoto);
  const resolved = own ?? linked;
  return {
    image_url: own,
    linked_product_photo: linked,
    resolved_image_url: resolved,
  };
}
