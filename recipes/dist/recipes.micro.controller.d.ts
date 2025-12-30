import { RecipeService } from './recipes/recipes.service';
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
export declare class RecipesMicroController {
    private readonly service;
    private readonly mediaService;
    private readonly prepService;
    private readonly labelsService;
    constructor(service: RecipeService, mediaService: RecipeMediaService, prepService: RecipePreparationsService, labelsService: RecipesLabelsService);
    createCategory(dto: CreateRecipeCategoryDto): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    findAllCategories(payload: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        categories: import("./recipes/entities/recipe-category.entity").RecipeCategory[];
        total: number;
        totalPages: number;
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
        recipes: import("./recipes/entities/recipe.entity").Recipe[];
        total: number;
        totalPages: number;
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
    createMedia(dto: CreateRecipeMediaDto): Promise<import("./recipes/entities/recipe-media.entity").RecipeMedia>;
    findMediaByRecipe(recipe_id: number): Promise<import("./recipes/entities/recipe-media.entity").RecipeMedia[]>;
    statistics(): Promise<any>;
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
    labelsFindAll(): Promise<any[]>;
    labelFindOne(id: number): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelCreate(payload: CreateRecipeLabelDto | {
        dto: CreateRecipeLabelDto;
        user?: any;
    }): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelDelete(id: number): Promise<void>;
}
