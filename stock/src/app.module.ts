import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Product } from './stock/entities/product.entity';
import { Stock } from './stock/entities/stock.entity';
import { StockTransaction } from './stock/entities/stock-transaction.entity';
import { WasteRecord } from './stock/entities/waste-record.entity';
import { Category } from './stock/entities/category.entity';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
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
      entities: [Product, Stock, StockTransaction, WasteRecord, Category],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        charset: 'utf8mb4',
      },
    }),
    TypeOrmModule.forFeature([Product, Stock, StockTransaction, WasteRecord, Category]),
  ],
  controllers: [StockMicroController, StockHttpController, StockHealthController, CategoryController],
  providers: [
    StockService,
    CategoryService,
    InternalServiceGuard,
    { provide: APP_GUARD, useClass: InternalServiceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}