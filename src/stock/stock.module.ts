import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { Product } from './entities/product.entity';
import { Locator } from './entities/locator.entity';
import { Stock } from './entities/stock.entity';
import { StockTransaction } from './entities/stock-transaction.entity';
import { RecipeUsage } from './entities/recipe-usage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Locator, Stock, StockTransaction, RecipeUsage])],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {} 