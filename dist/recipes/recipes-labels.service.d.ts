import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipePreparation } from './entities/recipe-preparation.entity';
export declare class RecipesLabelsService {
    private readonly labelRepo;
    private readonly prepRepo;
    private readonly rmq;
    constructor(labelRepo: Repository<RecipeLabel>, prepRepo: Repository<RecipePreparation>, rmq: ClientProxy);
    findAll(): Promise<RecipeLabel[]>;
    findOne(id: number): Promise<RecipeLabel>;
    private generateCode;
    create(dto: {
        recipe_preparation_id: number;
        label_code?: string;
    }): Promise<RecipeLabel>;
    remove(id: number): Promise<void>;
    emitExpiringLabelsNotifications(): Promise<void>;
}
