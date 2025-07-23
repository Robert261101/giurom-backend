import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Recipe, DifficultyLevel } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { Product } from '../stock/entities/product.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory)
    private readonly categoryRepository: Repository<RecipeCategory>,
    @InjectRepository(RecipeProduct)
    private readonly recipeProductRepository: Repository<RecipeProduct>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // RECIPE CATEGORY METHODS
  async createRecipeCategory(createCategoryDto: CreateRecipeCategoryDto): Promise<RecipeCategory> {
    // Verifică unicitatea numelui
    const existingCategory = await this.categoryRepository.findOne({
      where: { name: createCategoryDto.name },
    });

    if (existingCategory) {
      throw new ConflictException(`Categoria "${createCategoryDto.name}" există deja`);
    }

    const category = this.categoryRepository.create(createCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async findAllRecipeCategories(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: RecipeCategory[]; total: number; page: number; limit: number }> {
    const where = search ? { name: Like(`%${search}%`) } : {};

    const [data, total] = await this.categoryRepository.findAndCount({
      where,
      relations: ['recipes'],
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async findRecipeCategoryById(id: number): Promise<RecipeCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['recipes'],
    });

    if (!category) {
      throw new NotFoundException(`Categoria cu ID-ul ${id} nu a fost găsită`);
    }

    return category;
  }

  async updateRecipeCategory(id: number, updateCategoryDto: UpdateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = await this.findRecipeCategoryById(id);

    // Verifică unicitatea numelui dacă se schimbă
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name: updateCategoryDto.name },
      });

      if (existingCategory) {
        throw new ConflictException(`Categoria "${updateCategoryDto.name}" există deja`);
      }
    }

    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async deleteRecipeCategory(id: number): Promise<void> {
    const category = await this.findRecipeCategoryById(id);

    // Verifică dacă categoria are rețete asociate
    const recipeCount = await this.recipeRepository.count({ where: { category_id: id } });
    if (recipeCount > 0) {
      throw new BadRequestException(`Nu se poate șterge categoria. Există ${recipeCount} rețete asociate`);
    }

    await this.categoryRepository.remove(category);
  }

  // RECIPE METHODS
  async createRecipe(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    // Verifică dacă categoria există
    const category = await this.categoryRepository.findOne({ where: { id: createRecipeDto.category_id } });
    if (!category) {
      throw new NotFoundException(`Categoria cu ID-ul ${createRecipeDto.category_id} nu a fost găsită`);
    }

    const recipe = this.recipeRepository.create(createRecipeDto);
    return await this.recipeRepository.save(recipe);
  }

  async findAllRecipes(
    page: number = 1,
    limit: number = 10,
    search?: string,
    category_id?: number,
    difficulty?: DifficultyLevel,
    max_cooking_time?: number,
  ): Promise<{ data: Recipe[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.recipeRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('recipe.recipe_products', 'recipe_products')
      .leftJoinAndSelect('recipe_products.product', 'product');

    if (search) {
      queryBuilder.andWhere('recipe.name LIKE :search OR recipe.description LIKE :search', { search: `%${search}%` });
    }

    if (category_id) {
      queryBuilder.andWhere('recipe.category_id = :category_id', { category_id });
    }

    if (difficulty) {
      queryBuilder.andWhere('recipe.difficulty = :difficulty', { difficulty });
    }

    if (max_cooking_time) {
      queryBuilder.andWhere('recipe.cooking_time <= :max_cooking_time', { max_cooking_time });
    }

    const total = await queryBuilder.getCount();
    const data = await queryBuilder
      .orderBy('recipe.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  async findRecipeById(id: number): Promise<Recipe> {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['category', 'recipe_products', 'recipe_products.product'],
    });

    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${id} nu a fost găsită`);
    }

    return recipe;
  }

  async updateRecipe(id: number, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    const recipe = await this.findRecipeById(id);

    // Verifică categoria dacă se schimbă
    if (updateRecipeDto.category_id && updateRecipeDto.category_id !== recipe.category_id) {
      const category = await this.categoryRepository.findOne({ where: { id: updateRecipeDto.category_id } });
      if (!category) {
        throw new NotFoundException(`Categoria cu ID-ul ${updateRecipeDto.category_id} nu a fost găsită`);
      }
    }

    Object.assign(recipe, updateRecipeDto);
    return await this.recipeRepository.save(recipe);
  }

  async deleteRecipe(id: number): Promise<void> {
    const recipe = await this.findRecipeById(id);
    await this.recipeRepository.remove(recipe);
  }

  // RECIPE PRODUCT METHODS
  async addProductToRecipe(createRecipeProductDto: CreateRecipeProductDto): Promise<RecipeProduct> {
    // Verifică dacă rețeta există
    const recipe = await this.recipeRepository.findOne({ where: { id: createRecipeProductDto.recipe_id } });
    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${createRecipeProductDto.recipe_id} nu a fost găsită`);
    }

    // Verifică dacă produsul există
    const product = await this.productRepository.findOne({ where: { id: createRecipeProductDto.product_id } });
    if (!product) {
      throw new NotFoundException(`Produsul cu ID-ul ${createRecipeProductDto.product_id} nu a fost găsit`);
    }

    // Verifică dacă produsul nu este deja adăugat în rețetă
    const existingRecipeProduct = await this.recipeProductRepository.findOne({
      where: {
        recipe_id: createRecipeProductDto.recipe_id,
        product_id: createRecipeProductDto.product_id,
      },
    });

    if (existingRecipeProduct) {
      throw new ConflictException(`Produsul "${product.name}" este deja adăugat în rețeta "${recipe.name}"`);
    }

    const recipeProduct = this.recipeProductRepository.create(createRecipeProductDto);
    return await this.recipeProductRepository.save(recipeProduct);
  }

  async findRecipeProducts(recipe_id: number): Promise<RecipeProduct[]> {
    return await this.recipeProductRepository.find({
      where: { recipe_id },
      relations: ['recipe', 'product'],
      order: { created_at: 'ASC' },
    });
  }

  async updateRecipeProduct(id: number, updateRecipeProductDto: UpdateRecipeProductDto): Promise<RecipeProduct> {
    const recipeProduct = await this.recipeProductRepository.findOne({
      where: { id },
      relations: ['recipe', 'product'],
    });

    if (!recipeProduct) {
      throw new NotFoundException(`Asocierea rețetă-produs cu ID-ul ${id} nu a fost găsită`);
    }

    Object.assign(recipeProduct, updateRecipeProductDto);
    return await this.recipeProductRepository.save(recipeProduct);
  }

  async removeProductFromRecipe(id: number): Promise<void> {
    const recipeProduct = await this.recipeProductRepository.findOne({ where: { id } });

    if (!recipeProduct) {
      throw new NotFoundException(`Asocierea rețetă-produs cu ID-ul ${id} nu a fost găsită`);
    }

    await this.recipeProductRepository.remove(recipeProduct);
  }

  // STATISTICS AND REPORTS
  async getRecipeStatistics(): Promise<any> {
    const [totalRecipes, totalCategories, totalProducts, recipesByDifficulty] = await Promise.all([
      this.recipeRepository.count(),
      this.categoryRepository.count(),
      this.productRepository.count(),
      this.recipeRepository
        .createQueryBuilder('recipe')
        .select('recipe.difficulty', 'difficulty')
        .addSelect('COUNT(*)', 'count')
        .groupBy('recipe.difficulty')
        .getRawMany(),
    ]);

    const avgCookingTime = await this.recipeRepository
      .createQueryBuilder('recipe')
      .select('AVG(recipe.cooking_time)', 'avg')
      .getRawOne();

    const mostUsedProducts = await this.recipeProductRepository
      .createQueryBuilder('rp')
      .leftJoin('rp.product', 'product')
      .select('product.name', 'name')
      .addSelect('COUNT(*)', 'usage_count')
      .groupBy('rp.product_id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalRecipes,
      totalCategories,
      totalProducts,
      avgCookingTime: avgCookingTime?.avg ? Math.round(avgCookingTime.avg) : 0,
      recipesByDifficulty,
      mostUsedProducts,
    };
  }
}