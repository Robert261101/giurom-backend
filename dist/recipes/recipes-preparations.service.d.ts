import { Repository } from 'typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from './entities/recipe.entity';
export declare class RecipePreparationsService {
    private readonly prepRepo;
    private readonly recipeRepo;
    constructor(prepRepo: Repository<RecipePreparation>, recipeRepo: Repository<Recipe>);
    findAll(page?: number, limit?: number): Promise<RecipePreparation[]>;
    findOne(id: number): Promise<RecipePreparation>;
    create(dto: {
        recipe_id: number;
        employee_id?: number;
        quantity: number;
        produced_at?: string;
    }): Promise<RecipePreparation>;
    update(id: number, dto: Partial<RecipePreparation>): Promise<RecipePreparation>;
    remove(id: number): Promise<void>;
    private consumeStockForPreparation;
    prepareWithStock(dto: {
        recipe_id: number;
        quantity: number;
        employee_id?: number;
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
