import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WasteRecord } from './entities/waste-record.entity';
import { WasteRecordsService } from './waste-records.service';
import { WasteRecordsController } from './waste-records.controller';
import { Product } from '../stock/entities/product.entity';
import { Recipe } from '../recipes/entities/recipe.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WasteRecord, Product, Recipe])],
  providers: [WasteRecordsService],
  controllers: [WasteRecordsController],
})
export class WasteRecordsModule {} 