import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './suppliers/entities/supplier.entity';
import { SupplierFolder } from './suppliers/entities/supplier-folder.entity';
import { SupplierProduct } from './suppliers/entities/supplier-product.entity';
import { SupplierOrder } from './suppliers/entities/supplier-order.entity';
import { SupplierOrderItem } from './suppliers/entities/supplier-order-item.entity';
import { SupplierOrderDocument } from './suppliers/entities/supplier-order-document.entity';
import { SupplierDocument } from './suppliers/entities/supplier-document.entity';
import { SupplierLocations, WorkLocation } from './suppliers/entities/supplier-locations.entity';
import { SuppliersService } from './suppliers/suppliers.service';
import { SuppliersMicroController } from './suppliers.micro.controller';
import { SuppliersHttpController } from './suppliers/suppliers.http.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        Supplier,
        SupplierFolder,
        SupplierProduct,
        SupplierOrder,
        SupplierOrderItem,
        SupplierOrderDocument,
        SupplierDocument,
        SupplierLocations,
        WorkLocation,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
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
      SupplierLocations,
      WorkLocation,
    ]),
  ],
  controllers: [SuppliersMicroController, SuppliersHttpController],
  providers: [SuppliersService],
})
export class AppModule {}


