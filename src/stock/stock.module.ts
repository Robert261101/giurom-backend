import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Product } from './entities/product.entity';
import { Stock } from './entities/stock.entity';
import { StockTransaction } from './entities/stock-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Stock, StockTransaction]),
    ClientsModule.register([
      {
        name: 'STOCK_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.STOCK_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.STOCK_MS_PORT || '4004', 10),
        },
      },
    ]),
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {} 