export class WarehouseReviewItemDto {
  itemId: number;
  available: boolean;
  availableQuantity?: number;
}

export class WarehouseReviewAdditionalProductDto {
  productId: number;
  quantity: number;
  variantId?: number;
  variantLabel?: string;
  measurementValue?: string;
  units?: number;
  variantWeight?: number;
}

export class WarehouseReviewDto {
  items: WarehouseReviewItemDto[];
  additionalProducts?: WarehouseReviewAdditionalProductDto[];
  /** Optional: magazioner / warehouse employee submitting the review */
  warehouseEmployeeId?: number;
  /** Optional: free-text warehouse notes */
  notes?: string;
}
