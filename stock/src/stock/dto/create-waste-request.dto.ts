export class CreateWasteRequestDto {
  product_id?: number;
  recipe_preparation_id?: number;
  quantity?: number;
  unit?: string;
  reason?: string;
  photos?: string[];
  location_id?: number;
}
