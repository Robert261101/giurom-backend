import { IsOptional, IsIn, IsArray } from 'class-validator';

export class UpdateOrderListDto {
  @IsOptional()
  list_date?: string;

  @IsOptional()
  @IsIn(['in_asteptare', 'checked'])
  status?: 'in_asteptare' | 'checked';

  @IsOptional()
  @IsArray()
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
