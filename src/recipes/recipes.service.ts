import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory) private readonly categoryRepository: Repository<RecipeCategory>,
    @InjectRepository(RecipeProduct) private readonly recipeProductRepository: Repository<RecipeProduct>,
  ) {}

  async createRecipeCategory(dto: CreateRecipeCategoryDto): Promise<RecipeCategory> {
    const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Categoria există deja');
    const category = this.categoryRepository.create(dto);
    return await this.categoryRepository.save(category);
  }

  async findAllRecipeCategories(page = 1, limit = 10, search?: string) {
    const safePage = Number.isFinite(page as any) && (page as number) > 0 ? (page as number) : 1;
    const safeLimit = Number.isFinite(limit as any) && (limit as number) > 0 ? (limit as number) : 10;
    const where = search ? { name: Like(`%${search}%`) } : {};
    const [data, total] = await this.categoryRepository.findAndCount({
      where,
      relations: ['recipes'],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      order: { name: 'ASC' },
    });
    return { data, total, page: safePage, limit: safeLimit };
  }

  async findRecipeCategoryById(id: number): Promise<RecipeCategory> {
    const category = await this.categoryRepository.findOne({ where: { id }, relations: ['recipes'] });
    if (!category) throw new NotFoundException('Categoria nu a fost găsită');
    return category;
  }

  async updateRecipeCategory(id: number, dto: UpdateRecipeCategoryDto): Promise<RecipeCategory> {
    const category = await this.findRecipeCategoryById(id);
    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Categoria există deja');
    }
    Object.assign(category, dto);
    return await this.categoryRepository.save(category);
  }

  async deleteRecipeCategory(id: number): Promise<void> {
    const category = await this.findRecipeCategoryById(id);
    const recipeCount = await this.recipeRepository.count({ where: { category_id: id } });
    if (recipeCount > 0) throw new BadRequestException('Categoria are rețete asociate');
    await this.categoryRepository.remove(category);
  }

  async createRecipe(dto: CreateRecipeDto): Promise<Recipe> {
    const category = await this.categoryRepository.findOne({ where: { id: dto.category_id } });
    if (!category) throw new NotFoundException('Categoria nu a fost găsită');
    const recipe = this.recipeRepository.create(dto);
    return await this.recipeRepository.save(recipe);
  }

  async findAllRecipes(page = 1, limit = 10, search?: string, category_id?: number) {
    const qb = this.recipeRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('recipe.recipe_products', 'rp');

    if (search) {
      qb.andWhere('recipe.name LIKE :s OR recipe.description LIKE :s', { s: `%${search}%` });
    }

    if (Number.isFinite(category_id as any) && (category_id as number) > 0) {
      qb.andWhere('recipe.category_id = :cid', { cid: category_id });
    }

    const safePage = Number.isFinite(page as any) && (page as number) > 0 ? (page as number) : 1;
    const safeLimit = Number.isFinite(limit as any) && (limit as number) > 0 ? (limit as number) : 10;

    const total = await qb.getCount();
    const data = await qb
      .orderBy('recipe.created_at', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getMany();

    return { data, total, page: safePage, limit: safeLimit };
  }

  async findRecipeById(id: number): Promise<Recipe> {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['category', 'recipe_products'],
    });
    if (!recipe) throw new NotFoundException('Rețeta nu a fost găsită');
    return recipe;
  }

  async updateRecipe(id: number, dto: UpdateRecipeDto): Promise<Recipe> {
    const recipe = await this.findRecipeById(id);
    if (dto.category_id && dto.category_id !== recipe.category_id) {
      const category = await this.categoryRepository.findOne({ where: { id: dto.category_id } });
      if (!category) throw new NotFoundException('Categoria nu a fost găsită');
    }
    Object.assign(recipe, dto);
    return await this.recipeRepository.save(recipe);
  }

  async deleteRecipe(id: number): Promise<void> {
    const recipe = await this.findRecipeById(id);
    await this.recipeRepository.remove(recipe);
  }

  async addProductToRecipe(dto: CreateRecipeProductDto): Promise<RecipeProduct> {
    const recipe = await this.recipeRepository.findOne({ where: { id: dto.recipe_id } });
    if (!recipe) throw new NotFoundException('Rețeta nu a fost găsită');
    // Notă: izolăm de modulul stock; aici nu validăm existența produsului în nomenclator
    const existing = await this.recipeProductRepository.findOne({ where: { recipe_id: dto.recipe_id, product_id: dto.product_id } });
    if (existing) throw new ConflictException('Produsul este deja adăugat în rețetă');
    const rp = this.recipeProductRepository.create(dto);
    return await this.recipeProductRepository.save(rp);
  }

  async findRecipeProducts(recipe_id: number): Promise<RecipeProduct[]> {
    return await this.recipeProductRepository.find({
      where: { recipe_id },
      order: { created_at: 'ASC' },
    });
  }

  async updateRecipeProduct(id: number, dto: UpdateRecipeProductDto): Promise<RecipeProduct> {
    const rp = await this.recipeProductRepository.findOne({ where: { id } });
    if (!rp) throw new NotFoundException('Asocierea nu a fost găsită');
    Object.assign(rp, dto);
    return await this.recipeProductRepository.save(rp);
  }

  async removeProductFromRecipe(id: number): Promise<void> {
    const rp = await this.recipeProductRepository.findOne({ where: { id } });
    if (!rp) throw new NotFoundException('Asocierea nu a fost găsită');
    await this.recipeProductRepository.remove(rp);
  }

  async getRecipeStatistics() {
    const [totalRecipes, totalCategories] = await Promise.all([
      this.recipeRepository.count(),
      this.categoryRepository.count(),
    ]);
    return { totalRecipes, totalCategories };
  }
}


