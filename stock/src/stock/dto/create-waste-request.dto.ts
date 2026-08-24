export class CreateWasteRequestDto {
  product_id?: number;
  recipe_preparation_id?: number;
  quantity?: number;
  unit?: string;
  reason?: string;
  photos?: string[];
  location_id?: number;
  /**
   * Gestiunea din giurom 2.0 din care se aruncă. Ignorată dacă locația nu e legată.
   * Nu schimbă nimic în stocul App1 — e doar eticheta de rutare.
   */
  giurom2_zone_id?: number | null;
}
