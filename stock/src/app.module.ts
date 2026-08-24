import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Product } from './stock/entities/product.entity';
import { Stock } from './stock/entities/stock.entity';
import { StockTransaction } from './stock/entities/stock-transaction.entity';
import { WasteRecord } from './stock/entities/waste-record.entity';
import { WasteRequest } from './stock/entities/waste-request.entity';
import { Giurom2Zone } from './stock/entities/giurom2-zone.entity';
import { ConsumptionRecord } from './stock/entities/consumption-record.entity';
import { Category } from './stock/entities/category.entity';
import { OrderList } from './stock/entities/order-list.entity';
import { ProductLocationOverride } from './stock/entities/product-location-override.entity';
import { StockService } from './stock/stock.service';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { InternalServiceGuard } from './auth/internal-service.guard';
import { StockMicroController } from './stock/stock.micro.controller';
import { StockHttpController } from './stock/stock.http.controller';
import { StockHealthController } from './stock/stock.health.controller';
import { CategoryController } from './stock/category.controller';
import { CategoryService } from './stock/category.service';
import { StockSyncCronService } from './stock/cron/stock-sync-cron.service';
import { StockSyncController } from './stock/cron/stock-sync.controller';
import { App2MovementController } from './stock/app2-movement.controller';
import { App2WasteController } from './stock/app2-waste.controller';
import { Giurom2ZonesService } from './stock/giurom2-zones.service';
import { WasteExportService } from './stock/waste-export.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_RMQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
          queueOptions: { durable: false },
        },
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [Product, Stock, StockTransaction, WasteRecord, ConsumptionRecord, Category, OrderList, WasteRequest, ProductLocationOverride, Giurom2Zone],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        charset: 'utf8mb4',
      },
    }),
    TypeOrmModule.forFeature([Product, Stock, StockTransaction, WasteRecord, ConsumptionRecord, Category, OrderList, WasteRequest, ProductLocationOverride, Giurom2Zone]),
  ],
  controllers: [StockMicroController, StockHttpController, StockHealthController, CategoryController, StockSyncController, App2MovementController, App2WasteController],
  providers: [
    StockService,
    CategoryService,
    StockSyncCronService,
    WasteExportService,
    Giurom2ZonesService,
    InternalServiceGuard,
    { provide: APP_GUARD, useClass: InternalServiceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}