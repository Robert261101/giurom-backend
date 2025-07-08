import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipePreparationsService } from './recipe-preparations.service';
import { RecipePreparationsController } from './recipe-preparations.controller';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Employee } from '../employee/entity/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecipePreparation, Recipe, Employee])],
  controllers: [RecipePreparationsController],
  providers: [RecipePreparationsService],
  exports: [RecipePreparationsService],
})
export class RecipePreparationsModule {} 