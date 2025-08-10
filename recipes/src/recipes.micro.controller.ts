import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RecipesService } from '@/recipes/recipes.service';
import { CreateRecipeDto } from '@/recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from '@/recipes/dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from '@/recipes/dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from '@/recipes/dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from '@/recipes/dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from '@/recipes/dto/update-recipe-product.dto';

@Controller()
export class RecipesMicroController {
  constructor(private readonly service: RecipesService) {}

  // Categories
  @MessagePattern('recipes.categories.create')
  createCategory(@Payload() dto: CreateRecipeCategoryDto) {
    return this.service.createRecipeCategory(dto);
  }

  @MessagePattern('recipes.categories.findAll')
  findAllCategories(
    @Payload() payload: { page?: number; limit?: number; search?: string },
  ) {
    return this.service.findAllRecipeCategories(payload.page || 1, payload.limit || 10, payload.search);
  }

  @MessagePattern('recipes.categories.findOne')
  findCategory(@Payload() id: number) {
    return this.service.findRecipeCategoryById(id);
  }

  @MessagePattern('recipes.categories.update')
  updateCategory(@Payload() payload: { id: number; dto: UpdateRecipeCategoryDto }) {
    return this.service.updateRecipeCategory(payload.id, payload.dto);
  }

  @MessagePattern('recipes.categories.delete')
  deleteCategory(@Payload() id: number) {
    return this.service.deleteRecipeCategory(id);
  }

  // Recipes
  @MessagePattern('recipes.create')
  create(@Payload() dto: CreateRecipeDto) {
    return this.service.createRecipe(dto);
  }

  @MessagePattern('recipes.findAll')
  findAllRecipes(
    @Payload() payload: { page?: number; limit?: number; search?: string; category_id?: number },
  ) {
    return this.service.findAllRecipes(payload.page || 1, payload.limit || 10, payload.search, payload.category_id);
  }

  @MessagePattern('recipes.findOne')
  findOne(@Payload() id: number) {
    return this.service.findRecipeById(id);
  }

  @MessagePattern('recipes.update')
  update(@Payload() payload: { id: number; dto: UpdateRecipeDto }) {
    return this.service.updateRecipe(payload.id, payload.dto);
  }

  @MessagePattern('recipes.delete')
  delete(@Payload() id: number) {
    return this.service.deleteRecipe(id);
  }

  // Recipe Products
  @MessagePattern('recipes.products.add')
  addProduct(@Payload() dto: CreateRecipeProductDto) {
    return this.service.addProductToRecipe(dto);
  }

  @MessagePattern('recipes.products.findByRecipe')
  findRecipeProducts(@Payload() recipe_id: number) {
    return this.service.findRecipeProducts(recipe_id);
  }

  @MessagePattern('recipes.products.update')
  updateRecipeProduct(@Payload() payload: { id: number; dto: UpdateRecipeProductDto }) {
    return this.service.updateRecipeProduct(payload.id, payload.dto);
  }

  @MessagePattern('recipes.products.remove')
  removeRecipeProduct(@Payload() id: number) {
    return this.service.removeProductFromRecipe(id);
  }

  // Statistics
  @MessagePattern('recipes.statistics')
  statistics() {
    return this.service.getRecipeStatistics();
  }
}


