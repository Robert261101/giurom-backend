import { RecipesService } from './recipes/recipes.service';
import { CreateRecipeDto } from './recipes/dto/create-recipe.dto';
import { UpdateRecipeDto } from './recipes/dto/update-recipe.dto';
import { CreateRecipeCategoryDto } from './recipes/dto/create-recipe-category.dto';
import { UpdateRecipeCategoryDto } from './recipes/dto/update-recipe-category.dto';
import { CreateRecipeProductDto } from './recipes/dto/create-recipe-product.dto';
import { UpdateRecipeProductDto } from './recipes/dto/update-recipe-product.dto';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { CreateRecipePreparationDto } from './recipes/dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './recipes/dto/update-recipe-preparation.dto';
import { RecipesLabelsService } from './recipes/recipes-labels.service';
import { CreateRecipeLabelDto } from './recipes/dto/create-recipe-label.dto';
export declare class RecipesMicroController {
    private readonly service;
    private readonly prepService;
    private readonly labelsService;
    constructor(service: RecipesService, prepService: RecipePreparationsService, labelsService: RecipesLabelsService);
    createCategory(dto: CreateRecipeCategoryDto): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    findAllCategories(payload: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        data: import("./recipes/entities/recipe-category.entity").RecipeCategory[];
        total: number;
        page: number;
        limit: number;
    }>;
    findCategory(id: number): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    updateCategory(payload: {
        id: number;
        dto: UpdateRecipeCategoryDto;
    }): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    deleteCategory(id: number): Promise<void>;
    create(dto: CreateRecipeDto): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    findAllRecipes(payload: {
        page?: number;
        limit?: number;
        search?: string;
        category_id?: number;
    }): Promise<{
        data: import("./recipes/entities/recipe.entity").Recipe[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: number): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    update(payload: {
        id: number;
        dto: UpdateRecipeDto;
    }): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    delete(id: number): Promise<void>;
    addProduct(dto: CreateRecipeProductDto): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct>;
    findRecipeProducts(recipe_id: number): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct[]>;
    updateRecipeProduct(payload: {
        id: number;
        dto: UpdateRecipeProductDto;
    }): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct>;
    removeRecipeProduct(id: number): Promise<void>;
    statistics(): Promise<{
        totalRecipes: number;
        totalCategories: number;
    }>;
    findAllPreps(payload: {
        page?: number;
        limit?: number;
    }): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation[]>;
    findOnePrep(id: number): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    createPrep(dto: CreateRecipePreparationDto): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    updatePrep(payload: {
        id: number;
        dto: UpdateRecipePreparationDto;
    }): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    deletePrep(id: number): Promise<void>;
    prepareWithStock(dto: CreateRecipePreparationDto): Promise<{
        preparation: import("./recipes/entities/recipe-preparation.entity").RecipePreparation;
        stockTransactions: {
            id: number;
            stock_id: number;
            type: string;
            quantity: number;
            location: string;
            target: string;
            timestamp: string;
        }[];
    }>;
    labelsFindAll(): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel[]>;
    labelFindOne(id: number): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelCreate(dto: CreateRecipeLabelDto): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelDelete(id: number): Promise<void>;
}
