import { PartialType } from '@nestjs/swagger';
import { CreateSupplierProductMeasurementVariantDto } from './create-supplier-product-measurement-variant.dto';

export class UpdateSupplierProductMeasurementVariantDto extends PartialType(CreateSupplierProductMeasurementVariantDto) {}
