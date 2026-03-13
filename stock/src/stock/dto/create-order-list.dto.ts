import { IsNumber, IsString, IsOptional, IsIn, IsArray } from 'class-validator';

export class CreateOrderListDto {
  work_location_id: number;
  list_date: string; // YYYY-MM-DD
  status?: 'in_asteptare' | 'checked';
  items?: Array<{
    id: string;
    product_id: number;
    name: string;
    unit?: string;
    quantity: number;
    category?: string;
    supplier_id?: number;
    supplier_name?: string;
    price_per_unit?: number;
  }>;
}
