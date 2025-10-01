import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan, LessThan } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { RecipeMedia } from './entities/recipe-media.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';
import { RecipeMediaService } from './recipes-media.service';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private recipesRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory)
    private categoriesRepository: Repository<RecipeCategory>,
    @InjectRepository(RecipeProduct)
    private recipeProductsRepository: Repository<RecipeProduct>,
    private recipeMediaService: RecipeMediaService,
  ) {}

  // ==================== RECIPES METHODS ====================

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const recipe = this.recipesRepository.create(createRecipeDto);
    return await this.recipesRepository.save(recipe);
  }

  async findAll(params: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    category_id?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    max_cooking_time?: number;
  }): Promise<{ recipes: Recipe[]; total: number; totalPages: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.recipesRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('recipe.recipe_products', 'recipe_products')
      .leftJoinAndSelect('recipe_products.product', 'product');
    
    // Add search filter
    if (params.search) {
      queryBuilder.andWhere('recipe.name LIKE :search', { search: `%${params.search}%` });
    }
    
    // Add category filter
    if (params.category_id) {
      queryBuilder.andWhere('recipe.category_id = :category_id', { category_id: params.category_id });
    }
    
    const offset = (page - 1) * limit;
    const [recipes, total] = await queryBuilder
      .orderBy('recipe.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    
    const totalPages = Math.ceil(total / limit);
    
    return { recipes, total, totalPages };
  }

  async findOne(id: number): Promise<Recipe> {
    const recipe = await this.recipesRepository.findOne({
      where: { id },
      relations: ['category', 'recipe_products', 'recipe_products.product', 'recipeMedia'],
    });
    
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    
    return recipe;
  }

  async update(id: number, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    const recipe = await this.findOne(id);
    Object.assign(recipe, updateRecipeDto);
    return await this.recipesRepository.save(recipe);
  }

  async remove(id: number): Promise<void> {
    const recipe = await this.findOne(id);
    await this.recipesRepository.remove(recipe);
  }

  // ==================== CATEGORIES METHODS ====================

  async createCategory(createCategoryDto: CreateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = this.categoriesRepository.create(createCategoryDto);
    return await this.categoriesRepository.save(category);
  }

  async findAllCategories(params: { 
    page?: number; 
    limit?: number; 
    search?: string 
  }): Promise<{ categories: RecipeCategory[]; total: number; totalPages: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.categoriesRepository.createQueryBuilder('category');
    
    // Add search filter
    if (params.search) {
      queryBuilder.andWhere('category.name LIKE :search', { search: `%${params.search}%` });
    }
    
    const offset = (page - 1) * limit;
    const [categories, total] = await queryBuilder
      .orderBy('category.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    
    const totalPages = Math.ceil(total / limit);
    
    return { categories, total, totalPages };
  }

  async findOneCategory(id: number): Promise<RecipeCategory> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['recipes'],
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async updateCategory(id: number, updateCategoryDto: UpdateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = await this.findOneCategory(id);
    Object.assign(category, updateCategoryDto);
    return await this.categoriesRepository.save(category);
  }

  async removeCategory(id: number): Promise<void> {
    const category = await this.findOneCategory(id);
    await this.categoriesRepository.remove(category);
  }

  // ==================== RECIPE PRODUCTS METHODS ====================

  async addProductToRecipe(createRecipeProductDto: CreateRecipeProductDto): Promise<RecipeProduct> {
    // Verify recipe exists
    const recipe = await this.recipesRepository.findOne({
      where: { id: createRecipeProductDto.recipe_id }
    });
    
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${createRecipeProductDto.recipe_id} not found`);
    }
    
    // Verify product exists (assuming product validation is done in the controller)
    const recipeProduct = this.recipeProductsRepository.create(createRecipeProductDto);
    return await this.recipeProductsRepository.save(recipeProduct);
  }

  async findRecipeProducts(recipe_id: number): Promise<RecipeProduct[]> {
    // Verify recipe exists
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipe_id }
    });
    
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${recipe_id} not found`);
    }
    
    return await this.recipeProductsRepository.find({
      where: { recipe_id },
      relations: ['recipe', 'product'],
    });
  }

  async updateRecipeProduct(id: number, updateRecipeProductDto: UpdateRecipeProductDto): Promise<RecipeProduct> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
      relations: ['recipe', 'product'],
    });
    
    if (!recipeProduct) {
      throw new NotFoundException(`Recipe product with ID ${id} not found`);
    }
    
    Object.assign(recipeProduct, updateRecipeProductDto);
    return await this.recipeProductsRepository.save(recipeProduct);
  }

  async removeRecipeProduct(id: number): Promise<void> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
      relations: ['recipe', 'product'],
    });
    
    if (!recipeProduct) {
      throw new NotFoundException(`Recipe product with ID ${id} not found`);
    }
    
    await this.recipeProductsRepository.remove(recipeProduct);
  }

  // ==================== STATISTICS METHODS ====================

  async getStatistics(): Promise<any> {
    const total = await this.recipesRepository.count();
    
    const byCategory = await this.recipesRepository
      .createQueryBuilder('recipe')
      .select('category.name', 'category')
      .addSelect('COUNT(recipe.id)', 'count')
      .leftJoin('recipe.category', 'category')
      .groupBy('category.name')
      .getRawMany();
    
    return {
      total,
      byCategory,
    };
  }
}