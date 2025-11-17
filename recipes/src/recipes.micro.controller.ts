import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RecipeService } from './recipes/recipes.service';
import { RecipeMediaService } from './recipes/recipes-media.service';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { RecipesLabelsService } from './recipes/recipes-labels.service';
import { CreateRecipeDto } from './recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from './recipes/dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './recipes/dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './recipes/dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './recipes/dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './recipes/dto/update-recipe-product.dto';
import { CreateRecipeMediaDto } from './recipes/dto/create-recipe-media.dto';
import { CreateRecipePreparationDto } from './recipes/dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './recipes/dto/update-recipe-preparation.dto';
import { CreateRecipeLabelDto } from './recipes/dto/create-recipe-label.dto';

@Controller()
export class RecipesMicroController {
  constructor(
    private readonly service: RecipeService,
    private readonly mediaService: RecipeMediaService,
    private readonly prepService: RecipePreparationsService,
    private readonly labelsService: RecipesLabelsService,
  ) {}

  // Categories
  @MessagePattern('recipes.categories.create')
  createCategory(@Payload() dto: CreateRecipeCategoryDto) {
    return this.service.createCategory(dto);
  }

  @MessagePattern('recipes.categories.findAll')
  findAllCategories(
    @Payload() payload: { page?: number; limit?: number; search?: string },
  ) {
    return this.service.findAllCategories({
      page: payload.page || 1,
      limit: payload.limit || 10,
      search: payload.search
    });
  }

  @MessagePattern('recipes.categories.findOne')
  findCategory(@Payload() id: number) {
    return this.service.findOneCategory(id);
  }

  @MessagePattern('recipes.categories.update')
  updateCategory(@Payload() payload: { id: number; dto: UpdateRecipeCategoryDto }) {
    return this.service.updateCategory(payload.id, payload.dto);
  }

  @MessagePattern('recipes.categories.delete')
  deleteCategory(@Payload() id: number) {
    return this.service.removeCategory(id);
  }

  // Recipes
  @MessagePattern('recipes.create')
  create(@Payload() dto: CreateRecipeDto) {
    return this.service.create(dto);
  }

  @MessagePattern('recipes.findAll')
  findAllRecipes(
    @Payload() payload: { page?: number; limit?: number; search?: string; category_id?: number },
  ) {
    return this.service.findAll({
      page: payload.page || 1,
      limit: payload.limit || 10,
      search: payload.search,
      category_id: payload.category_id
    });
  }

  @MessagePattern('recipes.findOne')
  findOne(@Payload() id: number) {
    return this.service.findOne(id);
  }

  @MessagePattern('recipes.update')
  update(@Payload() payload: { id: number; dto: UpdateRecipeDto }) {
    return this.service.update(payload.id, payload.dto);
  }

  @MessagePattern('recipes.delete')
  delete(@Payload() id: number) {
    return this.service.remove(id);
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
    return this.service.removeRecipeProduct(id);
  }

  // Recipe Media
  @MessagePattern('recipes.media.create')
  createMedia(@Payload() dto: CreateRecipeMediaDto) {
    return this.mediaService.createMedia(dto);
  }

  @MessagePattern('recipes.media.findByRecipe')
  findMediaByRecipe(@Payload() recipe_id: number) {
    return this.mediaService.findMediaByRecipe(recipe_id);
  }

  // Statistics
  @MessagePattern('recipes.statistics')
  statistics() {
    return this.service.getStatistics();
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
  updatePrep(@Payload() payload: { id: number; dto: UpdateRecipePreparationDto }) {
    const dto: any = { ...payload.dto };
    if (dto.produced_at && typeof dto.produced_at === 'string') {
      dto.produced_at = new Date(dto.produced_at) as any;
    }
    return this.prepService.update(payload.id, dto);
  }

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
  labelCreate(@Payload() payload: CreateRecipeLabelDto | { dto: CreateRecipeLabelDto; user?: any }) {
    // Poate primi doar DTO sau DTO + user
    if ('dto' in payload) {
      return this.labelsService.create(payload.dto, payload.user);
    }
    return this.labelsService.create(payload);
  }

  @MessagePattern('recipe-labels.delete')
  labelDelete(@Payload() id: number) { return this.labelsService.remove(id); }
}