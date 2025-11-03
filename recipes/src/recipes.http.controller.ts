import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { Permissions } from './permissions/permissions.decorator';
import { RecipesService } from './recipes/recipes.service';
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
export class RecipesHttpController {
  constructor(
    private readonly recipes: RecipesService,
    private readonly media: RecipeMediaService,
    private readonly preps: RecipePreparationsService,
    private readonly labels: RecipesLabelsService,
  ) {}

  // Recipes
  @Get('recipes')
  @Permissions('recipes.read')
  async findAll(@Query() q: any) {
    const page = Number.parseInt(q.page, 10);
    const limit = Number.parseInt(q.limit, 10);
    const maybeCid = q.category_id !== undefined ? Number(q.category_id) : undefined;
    const category_id = Number.isFinite(maybeCid as number) && (maybeCid as number) > 0 ? (maybeCid as number) : undefined;
    const maybeLid = q.location_id !== undefined ? Number(q.location_id) : undefined;
    const location_id = Number.isFinite(maybeLid as number) && (maybeLid as number) > 0 ? (maybeLid as number) : undefined;
    
    const result = await this.recipes.findAll({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      search: q.search,
      category_id,
      location_id
    });
    
    // Return in the format expected by the frontend
    return {
      data: result.recipes,
      total: result.total,
      page: page || 1,
      totalPages: result.totalPages,
      limit: limit || 50
    };
  }
  
  @Post('recipes')
  @Permissions('recipes.create')
  create(@Body() dto: CreateRecipeDto) { return this.recipes.create(dto); }

  // Categories
  @Get('recipes/categories')
  @Permissions('recipes.read')
  async categoriesFindAll(@Query() q: any) {
    const page = Number.parseInt(q.page, 10);
    const limit = Number.parseInt(q.limit, 10);
    
    const result = await this.recipes.findAllCategories({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      search: q.search
    });
    
    // Return in the format expected by the frontend
    return {
      data: result.categories,
      total: result.total,
      page: page || 1,
      totalPages: result.totalPages,
      limit: limit || 50
    };
  }
  
  @Get('recipes/categories/:id')
  @Permissions('recipes.read')
  categoryFindOne(@Param('id') id: string) { return this.recipes.findOneCategory(Number(id)); }
  @Post('recipes/categories')
  @Permissions('recipes.create')
  categoryCreate(@Body() dto: CreateRecipeCategoryDto) { return this.recipes.createCategory(dto); }
  @Patch('recipes/categories/:id')
  @Permissions('recipes.update')
  categoryUpdate(@Param('id') id: string, @Body() dto: UpdateRecipeCategoryDto) { return this.recipes.updateCategory(Number(id), dto); }
  @Delete('recipes/categories/:id')
  @Permissions('recipes.delete')
  categoryRemove(@Param('id') id: string) { return this.recipes.removeCategory(Number(id)); }

  // Recipe products (ingredients)
  @Post('recipes/recipe-products')
  @Permissions('recipes.update')
  addRecipeProduct(@Body() dto: CreateRecipeProductDto) { return this.recipes.addProductToRecipe(dto); }
  @Patch('recipes/recipe-products/:id')
  @Permissions('recipes.update')
  updateRecipeProduct(@Param('id') id: string, @Body() dto: UpdateRecipeProductDto) { return this.recipes.updateRecipeProduct(Number(id), dto); }
  @Delete('recipes/recipe-products/:id')
  @Permissions('recipes.update')
  removeRecipeProduct(@Param('id') id: string) { return this.recipes.removeRecipeProduct(Number(id)); }

  // Recipe products list for a recipe
  @Get('recipes/:id/products')
  @Permissions('recipes.read')
  getRecipeProducts(@Param('id') id: string) { return this.recipes.findRecipeProducts(Number(id)); }

  // Recipe by id (placed after static subpaths to avoid matching conflicts)
  @Get('recipes/:id')
  @Permissions('recipes.read')
  findOne(@Param('id') id: string) { return this.recipes.findOne(Number(id)); }
  @Patch('recipes/:id')
  @Permissions('recipes.update')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto) { return this.recipes.update(Number(id), dto); }
  @Delete('recipes/:id')
  @Permissions('recipes.delete')
  remove(@Param('id') id: string) { return this.recipes.remove(Number(id)); }

  // Preparations
  @Get('recipe-preparations')
  @Permissions('recipes.read')
  getPreparations(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('location_id') locationId?: string
  ) {
    return this.preps.findAll(Number(page), Number(limit), locationId ? Number(locationId) : undefined);
  }
  
  @Get('recipe-preparations/:id')
  @Permissions('recipes.read')
  getPreparation(@Param('id') id: string) { return this.preps.findOne(Number(id)); }
  
  @Post('recipe-preparations')
  @Permissions('recipes.create')
  createPreparation(@Body() dto: CreateRecipePreparationDto) { return this.preps.create(dto); }
  
  @Patch('recipe-preparations/:id')
  @Permissions('recipes.update')
  updatePreparation(@Param('id') id: string, @Body() dto: UpdateRecipePreparationDto) {
    const payload: any = { ...dto };
    if (payload.produced_at && typeof payload.produced_at === 'string') {
      payload.produced_at = new Date(payload.produced_at) as any;
    }
    return this.preps.update(Number(id), payload);
  }
  
  @Delete('recipe-preparations/:id')
  @Permissions('recipes.delete')
  removePreparation(@Param('id') id: string) { return this.preps.remove(Number(id)); }
  
  @Post('recipe-preparations/prepare-with-stock')
  @Permissions('recipes.create')
  prepareWithStock(@Body() dto: CreateRecipePreparationDto) { return this.preps.prepareWithStock(dto); }

  // Labels
  @Get('recipe-labels')
  @Permissions('recipes.read')
  labelsAll() { return this.labels.findAll(); }
  
  @Get('recipe-labels/:id')
  @Permissions('recipes.read')
  labelsOne(@Param('id') id: string) { return this.labels.findOne(Number(id)); }
  
  @Post('recipe-labels')
  @Permissions('recipes.create')
  labelsCreate(@Body() dto: CreateRecipeLabelDto) { return this.labels.create(dto); }
  
  @Delete('recipe-labels/:id')
  @Permissions('recipes.delete')
  labelsRemove(@Param('id') id: string) { return this.labels.remove(Number(id)); }
}