import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Recipe, DifficultyLevel } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateRecipeIngredientDto } from './dto/create-recipe-ingredient.dto';
import { UpdateRecipeIngredientDto } from './dto/update-recipe-ingredient.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeCategory)
    private readonly categoryRepository: Repository<RecipeCategory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
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

  // INGREDIENT METHODS
  async createIngredient(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    // Verifică unicitatea numelui
    const existingIngredient = await this.ingredientRepository.findOne({
      where: { name: createIngredientDto.name },
    });

    if (existingIngredient) {
      throw new ConflictException(`Ingredientul "${createIngredientDto.name}" există deja`);
    }

    const ingredient = this.ingredientRepository.create(createIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async findAllIngredients(
    page: number = 1,
    limit: number = 10,
    search?: string,
    category?: string,
  ): Promise<{ data: Ingredient[]; total: number; page: number; limit: number }> {
    const where: any = {};
    if (search) where.name = Like(`%${search}%`);
    if (category) where.category = category;

    const [data, total] = await this.ingredientRepository.findAndCount({
      where,
      relations: ['recipe_ingredients', 'recipe_ingredients.recipe'],
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async findIngredientById(id: number): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
      relations: ['recipe_ingredients', 'recipe_ingredients.recipe'],
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingredientul cu ID-ul ${id} nu a fost găsit`);
    }

    return ingredient;
  }

  async updateIngredient(id: number, updateIngredientDto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findIngredientById(id);

    // Verifică unicitatea numelui dacă se schimbă
    if (updateIngredientDto.name && updateIngredientDto.name !== ingredient.name) {
      const existingIngredient = await this.ingredientRepository.findOne({
        where: { name: updateIngredientDto.name },
      });

      if (existingIngredient) {
        throw new ConflictException(`Ingredientul "${updateIngredientDto.name}" există deja`);
      }
    }

    Object.assign(ingredient, updateIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async deleteIngredient(id: number): Promise<void> {
    const ingredient = await this.findIngredientById(id);

    // Verifică dacă ingredientul este folosit în rețete
    const usageCount = await this.recipeIngredientRepository.count({ where: { ingredient_id: id } });
    if (usageCount > 0) {
      throw new BadRequestException(`Nu se poate șterge ingredientul. Este folosit în ${usageCount} rețete`);
    }

    await this.ingredientRepository.remove(ingredient);
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
      .leftJoinAndSelect('recipe.recipe_ingredients', 'recipe_ingredients')
      .leftJoinAndSelect('recipe_ingredients.ingredient', 'ingredient');

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
      relations: ['category', 'recipe_ingredients', 'recipe_ingredients.ingredient'],
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

  // RECIPE INGREDIENT METHODS
  async addIngredientToRecipe(createRecipeIngredientDto: CreateRecipeIngredientDto): Promise<RecipeIngredient> {
    // Verifică dacă rețeta există
    const recipe = await this.recipeRepository.findOne({ where: { id: createRecipeIngredientDto.recipe_id } });
    if (!recipe) {
      throw new NotFoundException(`Rețeta cu ID-ul ${createRecipeIngredientDto.recipe_id} nu a fost găsită`);
    }

    // Verifică dacă ingredientul există
    const ingredient = await this.ingredientRepository.findOne({ where: { id: createRecipeIngredientDto.ingredient_id } });
    if (!ingredient) {
      throw new NotFoundException(`Ingredientul cu ID-ul ${createRecipeIngredientDto.ingredient_id} nu a fost găsit`);
    }

    // Verifică dacă ingredientul nu este deja adăugat în rețetă
    const existingRecipeIngredient = await this.recipeIngredientRepository.findOne({
      where: {
        recipe_id: createRecipeIngredientDto.recipe_id,
        ingredient_id: createRecipeIngredientDto.ingredient_id,
      },
    });

    if (existingRecipeIngredient) {
      throw new ConflictException(`Ingredientul "${ingredient.name}" este deja adăugat în rețeta "${recipe.name}"`);
    }

    const recipeIngredient = this.recipeIngredientRepository.create(createRecipeIngredientDto);
    return await this.recipeIngredientRepository.save(recipeIngredient);
  }

  async findRecipeIngredients(recipe_id: number): Promise<RecipeIngredient[]> {
    return await this.recipeIngredientRepository.find({
      where: { recipe_id },
      relations: ['recipe', 'ingredient'],
      order: { created_at: 'ASC' },
    });
  }

  async updateRecipeIngredient(id: number, updateRecipeIngredientDto: UpdateRecipeIngredientDto): Promise<RecipeIngredient> {
    const recipeIngredient = await this.recipeIngredientRepository.findOne({
      where: { id },
      relations: ['recipe', 'ingredient'],
    });

    if (!recipeIngredient) {
      throw new NotFoundException(`Asocierea rețetă-ingredient cu ID-ul ${id} nu a fost găsită`);
    }

    Object.assign(recipeIngredient, updateRecipeIngredientDto);
    return await this.recipeIngredientRepository.save(recipeIngredient);
  }

  async removeIngredientFromRecipe(id: number): Promise<void> {
    const recipeIngredient = await this.recipeIngredientRepository.findOne({ where: { id } });

    if (!recipeIngredient) {
      throw new NotFoundException(`Asocierea rețetă-ingredient cu ID-ul ${id} nu a fost găsită`);
    }

    await this.recipeIngredientRepository.remove(recipeIngredient);
  }

  // STATISTICS AND REPORTS
  async getRecipeStatistics(): Promise<any> {
    const [totalRecipes, totalCategories, totalIngredients, recipesByDifficulty] = await Promise.all([
      this.recipeRepository.count(),
      this.categoryRepository.count(),
      this.ingredientRepository.count(),
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

    const mostUsedIngredients = await this.recipeIngredientRepository
      .createQueryBuilder('ri')
      .leftJoin('ri.ingredient', 'ingredient')
      .select('ingredient.name', 'name')
      .addSelect('COUNT(*)', 'usage_count')
      .groupBy('ri.ingredient_id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalRecipes,
      totalCategories,
      totalIngredients,
      avgCookingTime: avgCookingTime?.avg ? Math.round(avgCookingTime.avg) : 0,
      recipesByDifficulty,
      mostUsedIngredients,
    };
  }
}
