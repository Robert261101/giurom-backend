import { IsISO8601 } from "class-validator";

export class UpdateOrderDeliveryDateDto {
  @IsISO8601()
  delivery_date: string;
}
