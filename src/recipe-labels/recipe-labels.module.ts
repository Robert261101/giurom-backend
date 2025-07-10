import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipeLabelsService } from './recipe-labels.service';
import { RecipeLabelsController } from './recipe-labels.controller';
import { RecipePreparation } from '../recipe-preparations/entities/recipe-preparation.entity';
import { Recipe } from '../recipes/entities/recipe.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecipeLabel, RecipePreparation, Recipe])],
  providers: [RecipeLabelsService],
  controllers: [RecipeLabelsController],
  exports: [RecipeLabelsService],
})
export class RecipeLabelsModule {} 