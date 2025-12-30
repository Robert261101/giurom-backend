import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from './entities/recipe.entity';
export declare class RecipePreparationsService {
    private readonly prepRepo;
    private readonly recipeRepo;
    private readonly notificationsClient;
    private readonly httpService;
    private readonly configService;
    private readonly stockServiceUrl;
    constructor(prepRepo: Repository<RecipePreparation>, recipeRepo: Repository<Recipe>, notificationsClient: ClientProxy, httpService: HttpService, configService: ConfigService);
    private sendPreparationNotification;
    findAll(page?: number, limit?: number, locationId?: number): Promise<RecipePreparation[]>;
    findOne(id: number): Promise<RecipePreparation>;
    create(dto: {
        recipe_id: number;
        employee_id?: number;
        location_id?: number;
        quantity: number;
        produced_at?: string;
    }): Promise<RecipePreparation>;
    private consumeRecipeIngredients;
    update(id: number, dto: Partial<RecipePreparation>): Promise<RecipePreparation>;
    remove(id: number): Promise<void>;
    prepareWithStock(dto: {
        recipe_id: number;
        quantity: number;
        employee_id?: number;
        location_id?: number;
        produced_at?: string;
    }): Promise<{
        preparation: RecipePreparation;
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
}
