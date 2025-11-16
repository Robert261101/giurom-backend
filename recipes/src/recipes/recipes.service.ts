import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan, LessThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom } from 'rxjs';
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
import { ProductRef } from '../external/product-ref.entity';

@Injectable()
export class RecipeService {
  private readonly stockServiceUrl: string;

  constructor(
    @InjectRepository(Recipe)
    private recipesRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory)
    private categoriesRepository: Repository<RecipeCategory>,
    @InjectRepository(RecipeProduct)
    private recipeProductsRepository: Repository<RecipeProduct>,
    private recipeMediaService: RecipeMediaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {
    this.stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
  }

  private async sendRecipeNotification(
    type: string,
    title: string,
    description: string,
    recipeId: number,
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'recipes.notification' }, {
          type,
          title,
          description,
          entity_id: recipeId,
          entity_type: 'recipe',
          metadata,
          priority: 'medium',
        })
      );
    } catch (error) {
      console.error('Failed to send recipe notification:', error);
    }
  }

  // ==================== RECIPES METHODS ====================

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const recipe = this.recipesRepository.create(createRecipeDto);
    const savedRecipe = await this.recipesRepository.save(recipe);
    
    // Send notification for new recipe
    await this.sendRecipeNotification(
      'recipe_created',
      'Reteta noua creata',
      `A fost creata o noua reteta: ${savedRecipe.name}`,
      savedRecipe.id,
      { recipeName: savedRecipe.name }
    );
    
    return savedRecipe;
  }

  async findAll(params: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    category_id?: number;
    location_id?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    max_cooking_time?: number;
  }): Promise<{ recipes: Recipe[]; total: number; totalPages: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.recipesRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('recipe.recipe_products', 'recipe_products');
    
    // Add search filter
    if (params.search) {
      queryBuilder.andWhere('recipe.name LIKE :search', { search: `%${params.search}%` });
    }
    
    // Add category filter
    if (params.category_id) {
      queryBuilder.andWhere('recipe.category_id = :category_id', { category_id: params.category_id });
    }
    
    // FILTRARE OBLIGATORIE - afișează DOAR recipes cu location_id setat
    queryBuilder.andWhere('recipe.location_id IS NOT NULL');
    
    // Add location filter
    if (params.location_id !== undefined) {
      queryBuilder.andWhere('recipe.location_id = :location_id', { location_id: params.location_id });
      console.log('🔍 [RecipesService] Filtrăm recipes după location_id:', params.location_id);
    }
    
    const offset = (page - 1) * limit;
    const [recipes, total] = await queryBuilder
      .orderBy('recipe.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    
    // Populate product data for each recipe
    for (const recipe of recipes) {
      if (recipe.recipe_products && recipe.recipe_products.length > 0) {
        for (const recipeProduct of recipe.recipe_products) {
          if (recipeProduct.product_id) {
            try {
              const response = await lastValueFrom(
                this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                  headers: {
                    'x-internal-service': 'recipes',
                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                  }
                })
              );
              recipeProduct.product = response.data;
            } catch (error) {
              // Handle case where product might not exist
              recipeProduct.product = null;
            }
          }
        }
      }
    }
    
    const totalPages = Math.ceil(total / limit);
    
    return { recipes, total, totalPages };
  }

  async findOne(id: number): Promise<Recipe> {
    const recipe = await this.recipesRepository.findOne({
      where: { id },
      relations: ['category', 'recipe_products', 'recipeMedia'],
    });
    
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    
    // Populate product data
    if (recipe.recipe_products && recipe.recipe_products.length > 0) {
      for (const recipeProduct of recipe.recipe_products) {
        if (recipeProduct.product_id) {
          try {
            const response = await lastValueFrom(
              this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
                headers: {
                  'x-internal-service': 'recipes',
                  'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
                }
              })
            );
            recipeProduct.product = response.data;
          } catch (error) {
            // Handle case where product might not exist
            recipeProduct.product = null;
          }
        }
      }
    }
    
    return recipe;
  }

  async update(id: number, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    const recipe = await this.findOne(id);
    const oldName = recipe.name;
    Object.assign(recipe, updateRecipeDto);
    const updatedRecipe = await this.recipesRepository.save(recipe);
    
    // Send notification for updated recipe
    await this.sendRecipeNotification(
      'recipe_updated',
      'Reteta modificata',
      `Reteta ${oldName} a fost modificata`,
      updatedRecipe.id,
      { 
        oldName,
        newName: updatedRecipe.name,
        updatedFields: Object.keys(updateRecipeDto)
      }
    );
    
    return updatedRecipe;
  }

  async remove(id: number): Promise<void> {
    const recipe = await this.findOne(id);
    const recipeName = recipe.name;
    await this.recipesRepository.remove(recipe);
    
    // Send notification for deleted recipe
    await this.sendRecipeNotification(
      'recipe_deleted',
      'Reteta stearsa',
      `Reteta ${recipeName} a fost stearsa`,
      id,
      { recipeName }
    );
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
    
    // Verify product exists via HTTP call
    try {
      const productUrl = `${this.stockServiceUrl}/stock/products/${createRecipeProductDto.product_id}`;
      const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
      const headers = {
        'x-internal-service': 'recipes',
        'x-service-secret': serviceSecret
      };
      
      console.log(`🔍 [RecipesService] Verifying product ${createRecipeProductDto.product_id} at: ${productUrl}`);
      console.log(`🔑 [RecipesService] Using service secret: ${serviceSecret.substring(0, 5)}...`);
      console.log(`📤 [RecipesService] Headers:`, headers);
      
      const response = await lastValueFrom(
        this.httpService.get(productUrl, { headers })
      );
      console.log(`✅ [RecipesService] Product ${createRecipeProductDto.product_id} verified:`, response.data);
    } catch (error: any) {
      console.error(`❌ [RecipesService] Error verifying product ${createRecipeProductDto.product_id}:`, error?.response?.data || error?.message);
      console.error(`❌ [RecipesService] Full error:`, error?.response?.status, error?.response?.statusText);
      throw new BadRequestException(`Product with ID ${createRecipeProductDto.product_id} not found`);
    }
    
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
    
    const recipeProducts = await this.recipeProductsRepository.find({
      where: { recipe_id },
      relations: ['recipe'],
    });
    
    // Populate product data
    for (const recipeProduct of recipeProducts) {
      if (recipeProduct.product_id) {
        try {
          const response = await lastValueFrom(
            this.httpService.get(`${this.stockServiceUrl}/stock/products/${recipeProduct.product_id}`, {
              headers: {
                'x-internal-service': 'recipes',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
              }
            })
          );
          recipeProduct.product = response.data;
        } catch (error) {
          // Handle case where product might not exist
          recipeProduct.product = null;
        }
      }
    }
    
    return recipeProducts;
  }

  async updateRecipeProduct(id: number, updateRecipeProductDto: UpdateRecipeProductDto): Promise<RecipeProduct> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
      relations: ['recipe'],
    });
    
    if (!recipeProduct) {
      throw new NotFoundException(`Recipe product with ID ${id} not found`);
    }
    
    // If product_id is being updated, verify the new product exists
    if (updateRecipeProductDto.product_id && updateRecipeProductDto.product_id !== recipeProduct.product_id) {
      try {
        await lastValueFrom(
          this.httpService.get(`${this.stockServiceUrl}/stock/products/${updateRecipeProductDto.product_id}`, {
            headers: {
              'x-internal-service': 'recipes',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
            }
          })
        );
      } catch (error) {
        throw new BadRequestException(`Product with ID ${updateRecipeProductDto.product_id} not found`);
      }
    }
    
    Object.assign(recipeProduct, updateRecipeProductDto);
    return await this.recipeProductsRepository.save(recipeProduct);
  }

  async removeRecipeProduct(id: number): Promise<void> {
    const recipeProduct = await this.recipeProductsRepository.findOne({
      where: { id },
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