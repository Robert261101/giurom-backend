import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('recipes')
export class RecipesController {
  constructor(@Inject('RECIPES_SERVICE') private readonly client: ClientProxy) {}

  // Categories
  @Post('categories')
  async createCategory(@Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.categories.create', dto));
  }

  @Get('categories')
  async findAllCategories(@Query('page') page?: number, @Query('limit') limit?: number, @Query('search') search?: string) {
    return await lastValueFrom(this.client.send('recipes.categories.findAll', { page, limit, search }));
  }

  @Get('categories/:id')
  async findCategory(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipes.categories.findOne', id));
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.categories.update', { id, dto }));
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipes.categories.delete', id));
  }

  // Recipes
  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('category_id') category_id?: number,
  ) {
    return await lastValueFrom(this.client.send('recipes.findAll', { page, limit, search, category_id }));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipes.findOne', id));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.update', { id, dto }));
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipes.delete', id));
  }

  // Recipe products
  @Post(':recipeId/products')
  async addProduct(@Param('recipeId', ParseIntPipe) recipeId: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.products.add', { ...dto, recipe_id: recipeId }));
  }

  @Get(':recipeId/products')
  async findRecipeProducts(@Param('recipeId', ParseIntPipe) recipeId: number) {
    return await lastValueFrom(this.client.send('recipes.products.findByRecipe', recipeId));
  }

  @Patch('products/:id')
  async updateRecipeProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('recipes.products.update', { id, dto }));
  }

  @Delete('products/:id')
  async removeRecipeProduct(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('recipes.products.remove', id));
  }

  // Statistics
  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('recipes.statistics', {}));
  }
}


