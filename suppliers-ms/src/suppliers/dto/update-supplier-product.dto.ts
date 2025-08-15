import { PartialType } from '@nestjs/swagger';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

export class UpdateSupplierProductDto extends PartialType(CreateSupplierProductDto) {}


