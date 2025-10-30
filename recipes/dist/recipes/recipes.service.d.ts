import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';
import { RecipeMediaService } from './recipes-media.service';
export declare class RecipesService {
    private recipesRepository;
    private categoriesRepository;
    private recipeProductsRepository;
    private recipeMediaService;
    private readonly httpService;
    constructor(recipesRepository: Repository<Recipe>, categoriesRepository: Repository<RecipeCategory>, recipeProductsRepository: Repository<RecipeProduct>, recipeMediaService: RecipeMediaService, httpService: HttpService);
    create(createRecipeDto: CreateRecipeDto): Promise<Recipe>;
    findAll(params: {
        page?: number;
        limit?: number;
        search?: string;
        category_id?: number;
        difficulty?: 'easy' | 'medium' | 'hard';
        max_cooking_time?: number;
    }): Promise<{
        recipes: Recipe[];
        total: number;
        totalPages: number;
    }>;
    findOne(id: number): Promise<Recipe>;
    update(id: number, updateRecipeDto: UpdateRecipeDto): Promise<Recipe>;
    remove(id: number): Promise<void>;
    createCategory(createCategoryDto: CreateRecipeCategoryDto): Promise<RecipeCategory>;
    findAllCategories(params: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        categories: RecipeCategory[];
        total: number;
        totalPages: number;
    }>;
    findOneCategory(id: number): Promise<RecipeCategory>;
    updateCategory(id: number, updateCategoryDto: UpdateRecipeCategoryDto): Promise<RecipeCategory>;
    removeCategory(id: number): Promise<void>;
    addProductToRecipe(createRecipeProductDto: CreateRecipeProductDto): Promise<RecipeProduct>;
    findRecipeProducts(recipe_id: number): Promise<RecipeProduct[]>;
    updateRecipeProduct(id: number, updateRecipeProductDto: UpdateRecipeProductDto): Promise<RecipeProduct>;
    removeRecipeProduct(id: number): Promise<void>;
    getStatistics(): Promise<any>;
}
