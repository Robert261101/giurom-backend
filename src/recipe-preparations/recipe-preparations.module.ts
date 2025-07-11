import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipePreparationsService } from './recipe-preparations.service';
import { RecipePreparationsController } from './recipe-preparations.controller';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity';
import { Employee } from '../employee/entity/employee.entity';
import { RecipeLabelsModule } from '../recipe-labels/recipe-labels.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecipePreparation, Recipe, Employee, RecipeIngredient]), RecipeLabelsModule, StockModule],
  controllers: [RecipePreparationsController],
  providers: [RecipePreparationsService],
  exports: [RecipePreparationsService],
})
export class RecipePreparationsModule {} 