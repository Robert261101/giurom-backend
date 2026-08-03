import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { join } from "path";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Supplier } from "./suppliers/entities/supplier.entity";
import { SupplierFolder } from "./suppliers/entities/supplier-folder.entity";
import { SupplierProduct } from "./suppliers/entities/supplier-product.entity";
import { SupplierOrder } from "./suppliers/entities/supplier-order.entity";
import { SupplierOrderItem } from "./suppliers/entities/supplier-order-item.entity";
import { SupplierOrderDocument } from "./suppliers/entities/supplier-order-document.entity";
import { SupplierOrderItemReception } from "./suppliers/entities/supplier-order-item-reception.entity";
import { SupplierOrderCancelledItem } from "./suppliers/entities/supplier-order-cancelled-item.entity";
import { SupplierOrderAssignment } from "./suppliers/entities/supplier-order-assignment.entity";
import { SupplierDocument } from "./suppliers/entities/supplier-document.entity";
import { SupplierLocations } from "./suppliers/entities/supplier-locations.entity";
import { SupplierProductClientMapping } from "./suppliers/entities/supplier-product-client-mapping.entity";
import { SupplierOrderDriverAssignment } from "./suppliers/entities/supplier-order-driver-assignment.entity";
import { SupplierOrderWarehouseReview } from "./suppliers/entities/supplier-order-warehouse-review.entity";
import { SupplierOrderItemChange } from "./suppliers/entities/supplier-order-item-change.entity";
import { SuppliersService } from "./suppliers/suppliers.service";
import { SuppliersExportService } from "./suppliers/suppliers-export.service";
import { EntryDocumentsExportService } from "./suppliers/entry-documents-export.service";
import { StockHttpService } from "./suppliers/stock-http.service";
import { SuppliersMicroController } from "./suppliers.micro.controller";
import { SuppliersHttpController } from "./suppliers/suppliers.http.controller";
import { AuthModule } from "./auth/auth.module";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./permissions/permissions.guard";
import { InternalServiceGuard } from "./auth/internal-service.guard";
import { SupplierProductMeasurementVariant } from './suppliers/entities/supplier-product-measurement-variant.entity';
import { EmployeeSupplier } from './suppliers/entities/employee-supplier.entity';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "..", ".env")],
    }),
    ClientsModule.register([
      {
        name: "NOTIFICATIONS_RMQ",
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || "amqp://localhost:5672"],
          queue: process.env.NOTIFICATIONS_QUEUE || "notifications",
          queueOptions: { durable: false },
        },
      },
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    TypeOrmModule.forRoot({
      type: "mariadb",
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        Supplier,
        SupplierFolder,
        SupplierProduct,
        SupplierProductMeasurementVariant,
        SupplierOrder,
        SupplierOrderItem,
        SupplierOrderDocument,
        SupplierOrderItemReception,
        SupplierOrderCancelledItem,
        SupplierOrderAssignment,
        SupplierOrderDriverAssignment,
        SupplierOrderWarehouseReview,
        SupplierOrderItemChange,
        SupplierDocument,
        SupplierLocations,
        EmployeeSupplier,
        SupplierProductClientMapping,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      logging: process.env.DB_LOGGING === "true",
      charset: "utf8mb4",
      timezone: "+00:00",
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: "utf8mb4",
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          "SET CHARACTER SET utf8mb4",
          "SET character_set_connection=utf8mb4",
        ],
      },
    }),
      TypeOrmModule.forFeature([
        Supplier,
        SupplierFolder,
        SupplierProduct,
        SupplierProductMeasurementVariant,
        SupplierOrder,
        SupplierOrderItem,
        SupplierOrderDocument,
        SupplierOrderItemReception,
        SupplierOrderCancelledItem,
        SupplierOrderAssignment,
        SupplierOrderDriverAssignment,
        SupplierOrderWarehouseReview,
        SupplierOrderItemChange,
        SupplierDocument,
        SupplierLocations,
        EmployeeSupplier,
        SupplierProductClientMapping,
      ]),
  ],
  controllers: [SuppliersMicroController, SuppliersHttpController],
  providers: [
    SuppliersService,
    SuppliersExportService,
    EntryDocumentsExportService,
    StockHttpService,
    InternalServiceGuard,
    { provide: APP_GUARD, useClass: InternalServiceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
