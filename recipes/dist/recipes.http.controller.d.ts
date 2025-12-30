import { RecipeService } from './recipes/recipes.service';
import { RecipeMediaService } from './recipes/recipes-media.service';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { RecipesLabelsService } from './recipes/recipes-labels.service';
import { RecipesPrinterService } from './recipes/recipes-printer.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
export declare class RecipesHttpController {
    private readonly recipes;
    private readonly media;
    private readonly preps;
    private readonly labels;
    private readonly printer;
    private readonly httpService;
    private readonly configService;
    constructor(recipes: RecipeService, media: RecipeMediaService, preps: RecipePreparationsService, labels: RecipesLabelsService, printer: RecipesPrinterService, httpService: HttpService, configService: ConfigService);
    findAll(q: any): Promise<{
        data: import("./recipes/entities/recipe.entity").Recipe[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    }>;
    create(dto: CreateRecipeDto): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    categoriesFindAll(q: any): Promise<{
        data: import("./recipes/entities/recipe-category.entity").RecipeCategory[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    }>;
    categoryFindOne(id: string): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    categoryCreate(dto: CreateRecipeCategoryDto): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    categoryUpdate(id: string, dto: UpdateRecipeCategoryDto): Promise<import("./recipes/entities/recipe-category.entity").RecipeCategory>;
    categoryRemove(id: string): Promise<void>;
    addRecipeProduct(dto: CreateRecipeProductDto): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct>;
    updateRecipeProduct(id: string, dto: UpdateRecipeProductDto): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct>;
    removeRecipeProduct(id: string): Promise<void>;
    getRecipeProducts(id: string): Promise<import("./recipes/entities/recipe-product.entity").RecipeProduct[]>;
    uploadMedia(id: string, dto: CreateRecipeMediaDto): Promise<import("./recipes/entities/recipe-media.entity").RecipeMedia>;
    getRecipeMedia(id: string): Promise<import("./recipes/entities/recipe-media.entity").RecipeMedia[]>;
    serveMedia(mediaId: string): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
    }>;
    deleteMedia(mediaId: string): Promise<{
        message: string;
    }>;
    addRecipeIngredient(recipeId: string, body: {
        ingredient_recipe_id: number;
        quantity: number;
        notes?: string;
    }): Promise<import("./recipes/entities/recipe-recipe.entity").RecipeRecipe>;
    getRecipeIngredients(id: string): Promise<import("./recipes/entities/recipe-recipe.entity").RecipeRecipe[]>;
    updateRecipeIngredient(id: string, body: {
        quantity: number;
        notes?: string;
    }): Promise<import("./recipes/entities/recipe-recipe.entity").RecipeRecipe>;
    removeRecipeIngredient(id: string): Promise<void>;
    findOne(id: string): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    update(id: string, dto: UpdateRecipeDto): Promise<import("./recipes/entities/recipe.entity").Recipe>;
    remove(id: string): Promise<void>;
    getPreparations(page?: string, limit?: string, locationId?: string, req?: any): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation[]> | never[];
    getPreparation(id: string): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    createPreparation(dto: CreateRecipePreparationDto): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    updatePreparation(id: string, dto: UpdateRecipePreparationDto): Promise<import("./recipes/entities/recipe-preparation.entity").RecipePreparation>;
    removePreparation(id: string): Promise<void>;
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
    labelsAll(): Promise<any[]>;
    labelsOne(id: string): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelsCreate(dto: CreateRecipeLabelDto, req: any): Promise<import("./recipes/entities/recipe-label.entity").RecipeLabel>;
    labelsRemove(id: string): Promise<void>;
    printLabel(id: string, body: {
        copies?: number;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    testPrinter(): Promise<{
        success: boolean;
        message: string;
        foundPort: number;
    } | {
        success: boolean;
        message: string;
        foundPort?: undefined;
    }>;
}
