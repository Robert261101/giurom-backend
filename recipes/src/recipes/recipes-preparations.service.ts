import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class RecipePreparationsService {
  private readonly stockServiceUrl: string;

  constructor(
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.stockServiceUrl = this.configService.get<string>('STOCK_HTTP_URL') || 'http://localhost:3006';
  }

  private async sendPreparationNotification(
    type: string,
    title: string,
    description: string,
    preparationId: number,
    recipeId: number,
    metadata?: any,
    target_url?: string  // Add target_url parameter
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'recipes.notification' }, {
          type,
          title,
          description,
          entity_id: preparationId,
          entity_type: 'recipe_preparation',
          metadata: {
            ...metadata,
            recipeId,
          },
          priority: 'medium',
          target_url,  // Add target_url to notification data
        })
      );
    } catch (error) {
      console.error('Failed to send preparation notification:', error);
    }
  }

  async findAll(page = 1, limit = 50, locationId?: number) {
    const queryBuilder = this.prepRepo.createQueryBuilder('preparation')
      .leftJoinAndSelect('preparation.recipe', 'recipe')
      .leftJoinAndSelect('recipe.category', 'category')
      .leftJoinAndSelect('preparation.labels', 'labels');
    
    // Add location filter - if locationId is provided, filter by it
    // if not provided, still filter out preparations without location_id
    if (locationId !== undefined) {
      queryBuilder.andWhere('preparation.location_id = :locationId', { locationId });
      console.log('🔍 [RecipePreparationsService] Filtrăm preparations după location_id:', locationId);
    } else {
      // FILTRARE OBLIGATORIE - afișează DOAR preparations cu location_id setat
      queryBuilder.andWhere('preparation.location_id IS NOT NULL');
    }
    
    const rows = await queryBuilder
      .orderBy('preparation.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return rows;
  }

  async findOne(id: number) {
    const p = await this.prepRepo.findOne({ 
      where: { id }, 
      relations: ['recipe', 'recipe.category', 'labels'] 
    });
    if (!p) throw new NotFoundException('Preparation not found');
    return p;
  }

  async create(dto: { recipe_id: number; employee_id?: number; location_id?: number; quantity: number; produced_at?: string }) {
    const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
    if (!recipe) throw new NotFoundException('Rețeta nu a fost găsită');
    const p = this.prepRepo.create({
      recipe_id: dto.recipe_id,
      produced_by: dto.employee_id,
      location_id: dto.location_id,
      quantity: dto.quantity as any,
      produced_at: dto.produced_at ? (new Date(dto.produced_at) as any) : (new Date() as any),
      is_labeled: false,
      is_consumable: recipe.is_consumable || false,
    } as any);
    const saved: RecipePreparation = (await this.prepRepo.save(p as any)) as RecipePreparation;

    // Send notification for new preparation
    await this.sendPreparationNotification(
      'recipe_preparation_created',
      'Preparat realizat',
      `A fost realizat un nou preparat pentru reteta: ${recipe.name}`,
      saved.id,
      recipe.id,
      { 
        recipeName: recipe.name,
        quantity: dto.quantity,
        producedBy: dto.employee_id
      },
      `/retetar/preparate/${saved.id}`  // Add target_url
    );

    // After saving, consume stock FIFO by expiration for each ingredient via stock service
    try {
      const fullRecipe = await this.recipeRepo.findOne({
        where: { id: dto.recipe_id },
        relations: ['recipe_products'],
      });
      if (fullRecipe && Array.isArray(fullRecipe.recipe_products)) {
        // Compute scaling factor relative to recipe base quantity (in grams)
        const baseQty = Number(fullRecipe.quantity) || 1;
        const factor = Number(dto.quantity) / baseQty;
        
        const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = {
          'x-internal-service': 'recipes',
          'x-service-secret': serviceSecret
        };
        
        for (const rp of fullRecipe.recipe_products) {
          const neededTotal = Number(rp.quantity) * factor; // grams
          if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0) continue;
          
          console.log(`🔍 [RecipePreparationsService] Consuming ${neededTotal} units of product ${rp.product_id} for preparation ${saved.id}`);
          
          try {
            // Use stock service consume endpoint which handles FIFO by expiration
            await lastValueFrom(
              this.httpService.post(
                `${this.stockServiceUrl}/stock/consume`,
                {
                  product_id: rp.product_id,
                  quantity: neededTotal,
                  target: `recipe-preparation:${saved.id}`
                },
                { headers }
              )
            );
            console.log(`✅ [RecipePreparationsService] Successfully consumed ${neededTotal} units of product ${rp.product_id}`);
          } catch (error: any) {
            console.error(`❌ [RecipePreparationsService] Error consuming product ${rp.product_id}:`, error?.response?.data || error?.message);
            
            // Extract error message from stock service response
            const errorMessage = error?.response?.data?.message || error?.message || 'Eroare necunoscută la consumarea stocului';
            throw new BadRequestException(`Cantitate insuficientă în stoc pentru produs ${rp.product_id}. ${errorMessage}`);
          }
        }
      }
    } catch (e) {
      // rollback preparation if stock consumption fails
      console.error(`❌ [RecipePreparationsService] Rolling back preparation ${saved.id} due to stock consumption error`);
      try { 
        await this.prepRepo.remove(saved); 
      } catch (rollbackError) {
        console.error(`❌ [RecipePreparationsService] Error during rollback:`, rollbackError);
      }
      throw e;
    }

    return saved;
  }

  async update(id: number, dto: Partial<RecipePreparation>) {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.prepRepo.save(p);
  }

  async remove(id: number) {
    const p = await this.findOne(id);
    await this.prepRepo.remove(p);
  }

  // Composite: create preparation and return mock stock transactions
  async prepareWithStock(dto: { recipe_id: number; quantity: number; employee_id?: number; location_id?: number; produced_at?: string }) {
    const preparation = await this.create(dto);
    // mock stock transactions result for UI (stock integration can be added later)
    const stockTransactions = [
      {
        id: Date.now(),
        stock_id: 0,
        type: 'exit',
        quantity: dto.quantity,
        location: 'Bucătărie',
        target: `Preparare rețetă #${(preparation as any).id}`,
        timestamp: new Date().toISOString(),
      },
    ];
    return { preparation, stockTransactions };
  }
}



