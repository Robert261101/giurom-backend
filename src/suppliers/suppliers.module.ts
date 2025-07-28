import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { SupplierFolder } from './entities/supplier-folder.entity';
import { SupplierDocument } from './entities/supplier-document.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder } from './entities/supplier-order.entity';
import { SupplierOrderItem } from './entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './entities/supplier-order-document.entity';
import { Product } from '../stock/entities/product.entity';
import { Stock } from '../stock/entities/stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SupplierFolder,
      SupplierDocument,
      SupplierProduct,
      SupplierOrder,
      SupplierOrderItem,
      SupplierOrderDocument,
      Product,
      Stock,
    ]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService, TypeOrmModule],
})
export class SuppliersModule {}
