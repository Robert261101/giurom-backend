import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
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
  async findAll(@Query() q: any) {
    const page = Number.parseInt(q.page, 10);
    const limit = Number.parseInt(q.limit, 10);
    const maybeCid = q.category_id !== undefined ? Number(q.category_id) : undefined;
    const category_id = Number.isFinite(maybeCid as number) && (maybeCid as number) > 0 ? (maybeCid as number) : undefined;
    
    const result = await this.recipes.findAll({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      search: q.search,
      category_id
    });
    
    // Return in the format expected by the frontend
    return {
      data: result.recipes,
      total: result.total,
      page: page || 1,
      limit: limit || 50
    };
  }
  
  @Post('recipes')
  create(@Body() dto: CreateRecipeDto) { return this.recipes.create(dto); }

  // Categories
  @Get('recipes/categories')
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
      limit: limit || 50
    };
  }
  
  @Get('recipes/categories/:id')
  categoryFindOne(@Param('id') id: string) { return this.recipes.findOneCategory(Number(id)); }
  
  @Post('recipes/categories')
  categoryCreate(@Body() dto: CreateRecipeCategoryDto) { return this.recipes.createCategory(dto); }
  
  @Patch('recipes/categories/:id')
  categoryUpdate(@Param('id') id: string, @Body() dto: UpdateRecipeCategoryDto) { return this.recipes.updateCategory(Number(id), dto); }
  
  @Delete('recipes/categories/:id')
  categoryRemove(@Param('id') id: string) { return this.recipes.removeCategory(Number(id)); }

  // Recipe products (ingredients)
  @Post('recipes/recipe-products')
  addRecipeProduct(@Body() dto: CreateRecipeProductDto) { return this.recipes.addProductToRecipe(dto); }
  
  @Patch('recipes/recipe-products/:id')
  updateRecipeProduct(@Param('id') id: string, @Body() dto: UpdateRecipeProductDto) { return this.recipes.updateRecipeProduct(Number(id), dto); }
  
  @Delete('recipes/recipe-products/:id')
  removeRecipeProduct(@Param('id') id: string) { return this.recipes.removeRecipeProduct(Number(id)); }

  // Recipe products list for a recipe
  @Get('recipes/:id/products')
  getRecipeProducts(@Param('id') id: string) { return this.recipes.findRecipeProducts(Number(id)); }

  // Recipe by id (placed after static subpaths to avoid matching conflicts)
  @Get('recipes/:id')
  findOne(@Param('id') id: string) { return this.recipes.findOne(Number(id)); }
  
  @Patch('recipes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto) { return this.recipes.update(Number(id), dto); }
  
  @Delete('recipes/:id')
  remove(@Param('id') id: string) { return this.recipes.remove(Number(id)); }

  // Recipe Media
  @Post('recipes/:id/media')
  async uploadRecipeMedia(
    @Param('id') id: string,
    @Body() dto: CreateRecipeMediaDto
  ) {
    // Set the recipe_id from the URL parameter
    dto.recipe_id = Number(id);
    return this.media.createMedia(dto);
  }

  @Get('recipes/:id/media')
  async getRecipeMedia(@Param('id') id: string) {
    return this.media.findMediaByRecipe(Number(id));
  }

  // Preparations
  @Get('recipe-preparations')
  getPreparations(@Query('page') page = '1', @Query('limit') limit = '50') { return this.preps.findAll(Number(page), Number(limit)); }
  
  @Get('recipe-preparations/:id')
  getPreparation(@Param('id') id: string) { return this.preps.findOne(Number(id)); }
  
  @Post('recipe-preparations')
  createPreparation(@Body() dto: CreateRecipePreparationDto) { return this.preps.create(dto); }
  
  @Patch('recipe-preparations/:id')
  updatePreparation(@Param('id') id: string, @Body() dto: UpdateRecipePreparationDto) {
    const payload: any = { ...dto };
    if (payload.produced_at && typeof payload.produced_at === 'string') {
      payload.produced_at = new Date(payload.produced_at) as any;
    }
    return this.preps.update(Number(id), payload);
  }
  
  @Delete('recipe-preparations/:id')
  removePreparation(@Param('id') id: string) { return this.preps.remove(Number(id)); }
  
  @Post('recipe-preparations/prepare-with-stock')
  prepareWithStock(@Body() dto: CreateRecipePreparationDto) { return (this.preps as any).prepareWithStock(dto); }

  // Labels
  @Get('recipe-labels')
  labelsAll() { return this.labels.findAll(); }
  
  @Get('recipe-labels/:id')
  labelsOne(@Param('id') id: string) { return this.labels.findOne(Number(id)); }
  
  @Post('recipe-labels')
  labelsCreate(@Body() dto: CreateRecipeLabelDto) { return this.labels.create(dto); }
  
  @Delete('recipe-labels/:id')
  labelsRemove(@Param('id') id: string) { return this.labels.remove(Number(id)); }
}