import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './stock/entities/product.entity';
import { Stock } from './stock/entities/stock.entity';
import { StockTransaction } from './stock/entities/stock-transaction.entity';
import { WasteRecord } from './stock/entities/waste-record.entity';
import { Category } from './stock/entities/category.entity';
import { StockService } from './stock/stock.service';
import { CategoryService } from './stock/category.service';
import { StockMicroController } from './stock/stock.micro.controller';
import { StockHttpController } from './stock/stock.http.controller';
import { CategoryController } from './stock/category.controller';

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
  controllers: [StockMicroController, StockHttpController, CategoryController],
  providers: [StockService, CategoryService],
})
export class AppModule {}