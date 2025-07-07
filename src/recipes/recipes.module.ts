import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Recipe,
      RecipeCategory,
      Ingredient,
      RecipeIngredient,
    ]),
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService, TypeOrmModule],
})
export class RecipesModule {}
