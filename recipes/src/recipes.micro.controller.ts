import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RecipesService } from './recipes/recipes.service';
import { CreateRecipeDto } from './recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from './recipes/dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './recipes/dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './recipes/dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './recipes/dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './recipes/dto/update-recipe-product.dto';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { CreateRecipePreparationDto } from './recipes/dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './recipes/dto/update-recipe-preparation.dto';
import { RecipesLabelsService } from './recipes/recipes-labels.service';
import { CreateRecipeLabelDto } from './recipes/dto/create-recipe-label.dto';

@Controller()
export class RecipesMicroController {
  constructor(
    private readonly service: RecipesService,
    private readonly prepService: RecipePreparationsService,
    private readonly labelsService: RecipesLabelsService,
  ) {}

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

  // Temporary recipe preparations endpoints to satisfy frontend routing
  @MessagePattern('recipe-preparations.findAll')
  findAllPreps(@Payload() payload: { page?: number; limit?: number }) {
    return this.prepService.findAll(payload?.page || 1, payload?.limit || 50);
  }

  @MessagePattern('recipe-preparations.findOne')
  findOnePrep(@Payload() id: number) { return this.prepService.findOne(id); }

  @MessagePattern('recipe-preparations.create')
  createPrep(@Payload() dto: CreateRecipePreparationDto) { return this.prepService.create(dto); }

  @MessagePattern('recipe-preparations.update')
  updatePrep(@Payload() payload: { id: number; dto: UpdateRecipePreparationDto }) { return this.prepService.update(payload.id, payload.dto); }

  @MessagePattern('recipe-preparations.delete')
  deletePrep(@Payload() id: number) { return this.prepService.remove(id); }

  @MessagePattern('recipe-preparations.prepareWithStock')
  prepareWithStock(@Payload() dto: CreateRecipePreparationDto) { return this.prepService.prepareWithStock(dto); }

  // Labels
  @MessagePattern('recipe-labels.findAll')
  labelsFindAll() { return this.labelsService.findAll(); }

  @MessagePattern('recipe-labels.findOne')
  labelFindOne(@Payload() id: number) { return this.labelsService.findOne(id); }

  @MessagePattern('recipe-labels.create')
  labelCreate(@Payload() dto: CreateRecipeLabelDto) { return this.labelsService.create(dto); }

  @MessagePattern('recipe-labels.delete')
  labelDelete(@Payload() id: number) { return this.labelsService.remove(id); }
}


