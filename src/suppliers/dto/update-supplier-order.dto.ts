import { PartialType } from '@nestjs/swagger';
import { CreateSupplierOrderDto } from './create-supplier-order.dto';

export class UpdateSupplierOrderDto extends PartialType(CreateSupplierOrderDto) {}