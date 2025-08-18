import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './suppliers/entities/supplier.entity';
import { SupplierFolder } from './suppliers/entities/supplier-folder.entity';
import { SupplierProduct } from './suppliers/entities/supplier-product.entity';
import { SupplierOrder } from './suppliers/entities/supplier-order.entity';
import { SupplierOrderItem } from './suppliers/entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './suppliers/entities/supplier-order-document.entity';
import { SupplierDocument } from './suppliers/entities/supplier-document.entity';
import { SuppliersService } from './suppliers/suppliers.service';
import { SuppliersMicroController } from './suppliers.micro.controller';
import { SuppliersHttpController } from './suppliers/suppliers.http.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['suppliers-ms/.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'eric',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        Supplier,
        SupplierFolder,
        SupplierProduct,
        SupplierOrder,
        SupplierOrderItem,
        SupplierOrderDocument,
        SupplierDocument,
      ],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          'SET CHARACTER SET utf8mb4',
          'SET character_set_connection=utf8mb4',
        ],
      },
    }),
    TypeOrmModule.forFeature([
      Supplier,
      SupplierFolder,
      SupplierProduct,
      SupplierOrder,
      SupplierOrderItem,
      SupplierOrderDocument,
      SupplierDocument,
    ]),
  ],
  controllers: [SuppliersMicroController, SuppliersHttpController],
  providers: [SuppliersService],
})
export class AppModule {}


