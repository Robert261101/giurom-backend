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

/** Citire: preferă poza din nomenclator (stock.products.photo), apoi image_url furnizor. */
export function buildSupplierProductImageFields(
  imageUrl: string | null | undefined,
  linkedProductPhoto: string | null | undefined,
): SupplierProductImageFields {
  const own = normalizeStoredImageUrl(imageUrl);
  const linked = normalizeStoredImageUrl(linkedProductPhoto);
  // Catalogul (linked) e sursa de adevăr după upload-ul pe stock-ms.
  // image_url vechi (ex. .webp lipsă de pe disk) nu trebuie să ascundă poza validă.
  const resolved = linked ?? own;
  return {
    image_url: own,
    linked_product_photo: linked,
    resolved_image_url: resolved,
  };
}
