import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class AssignCategoryDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  category_ids?: number[];
}