import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipePreparation } from './entities/recipe-preparation.entity';
export declare class RecipesLabelsService {
    private readonly labelRepo;
    private readonly prepRepo;
    private readonly rmq;
    private readonly httpService;
    private readonly configService;
    private readonly employeesServiceUrl;
    constructor(labelRepo: Repository<RecipeLabel>, prepRepo: Repository<RecipePreparation>, rmq: ClientProxy, httpService: HttpService, configService: ConfigService);
    findAll(): Promise<any[]>;
    findOne(id: number): Promise<RecipeLabel>;
    private generateCode;
    create(dto: {
        recipe_preparation_id: number;
        label_code?: string;
    }, user?: any): Promise<RecipeLabel>;
    remove(id: number): Promise<void>;
    emitExpiringLabelsNotifications(): Promise<void>;
}
