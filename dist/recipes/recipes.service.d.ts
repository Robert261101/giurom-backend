import { Repository } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeProduct } from './entities/recipe-product.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './dto/update-recipe-product.dto';
export declare class RecipesService {
    private readonly recipeRepository;
    private readonly categoryRepository;
    private readonly recipeProductRepository;
    constructor(recipeRepository: Repository<Recipe>, categoryRepository: Repository<RecipeCategory>, recipeProductRepository: Repository<RecipeProduct>);
    createRecipeCategory(dto: CreateRecipeCategoryDto): Promise<RecipeCategory>;
    findAllRecipeCategories(page?: number, limit?: number, search?: string): Promise<{
        data: RecipeCategory[];
        total: number;
        page: number;
        limit: number;
    }>;
    findRecipeCategoryById(id: number): Promise<RecipeCategory>;
    updateRecipeCategory(id: number, dto: UpdateRecipeCategoryDto): Promise<RecipeCategory>;
    deleteRecipeCategory(id: number): Promise<void>;
    createRecipe(dto: CreateRecipeDto): Promise<Recipe>;
    findAllRecipes(page?: number, limit?: number, search?: string, category_id?: number): Promise<{
        data: Recipe[];
        total: number;
        page: number;
        limit: number;
    }>;
    findRecipeById(id: number): Promise<Recipe>;
    updateRecipe(id: number, dto: UpdateRecipeDto): Promise<Recipe>;
    deleteRecipe(id: number): Promise<void>;
    addProductToRecipe(dto: CreateRecipeProductDto): Promise<RecipeProduct>;
    findRecipeProducts(recipe_id: number): Promise<RecipeProduct[]>;
    updateRecipeProduct(id: number, dto: UpdateRecipeProductDto): Promise<RecipeProduct>;
    removeProductFromRecipe(id: number): Promise<void>;
    getRecipeStatistics(): Promise<{
        totalRecipes: number;
        totalCategories: number;
    }>;
}
