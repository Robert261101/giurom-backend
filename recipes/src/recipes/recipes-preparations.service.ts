import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from './entities/recipe.entity';
import { StockRef, StockStatusRef } from '../external/stock-ref.entity';
import { StockTransactionRef, TransactionTypeRef } from '../external/stock-transaction-ref.entity';

@Injectable()
export class RecipePreparationsService {
  constructor(
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(StockRef) private readonly stockRepo: Repository<StockRef>,
    @InjectRepository(StockTransactionRef) private readonly txRepo: Repository<StockTransactionRef>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendPreparationNotification(
    type: string,
    title: string,
    description: string,
    preparationId: number,
    recipeId: number,
    metadata?: any
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
        })
      );
    } catch (error) {
      console.error('Failed to send preparation notification:', error);
    }
  }

  async findAll(page = 1, limit = 50) {
    const [rows] = await Promise.all([
      this.prepRepo.find({
        relations: ['recipe', 'recipe.category', 'labels'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
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

  async create(dto: { recipe_id: number; employee_id?: number; quantity: number; produced_at?: string }) {
    const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
    if (!recipe) throw new NotFoundException('Rețeta nu a fost găsită');
    const p = this.prepRepo.create({
      recipe_id: dto.recipe_id,
      produced_by: dto.employee_id,
      quantity: dto.quantity as any,
      produced_at: dto.produced_at ? (new Date(dto.produced_at) as any) : (new Date() as any),
      is_labeled: false,
    } as any);
    const saved: RecipePreparation = (await this.prepRepo.save(p as any)) as RecipePreparation;

    // Send notification for new preparation
    await this.sendPreparationNotification(
      'recipe_preparation_created',
      'Preparat realizat',
      `A fost realizat un nou preparat pentru rețeta: ${recipe.name}`,
      saved.id,
      recipe.id,
      { 
        recipeName: recipe.name,
        quantity: dto.quantity,
        producedBy: dto.employee_id
      }
    );

    // After saving, consume stock FIFO by expiration for each ingredient
    try {
      const fullRecipe = await this.recipeRepo.findOne({
        where: { id: dto.recipe_id },
        relations: ['recipe_products', 'recipe_products.product'],
      });
      if (fullRecipe && Array.isArray(fullRecipe.recipe_products)) {
        // Compute scaling factor relative to recipe base quantity (in grams)
        const baseQty = Number(fullRecipe.quantity) || 1;
        const factor = Number(dto.quantity) / baseQty;
        for (const rp of fullRecipe.recipe_products) {
          const neededTotal = Number(rp.quantity) * factor; // grams
          if (!rp.product_id || !Number.isFinite(neededTotal) || neededTotal <= 0) continue;
          let remaining = neededTotal;
          const stocks = await this.stockRepo.find({
            where: { product_id: rp.product_id, status: StockStatusRef.VALID, quantity: MoreThan(0) },
            order: { expiration_date: 'ASC', entry_date: 'ASC' } as any,
          });
          const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
          if (totalAvailable < neededTotal) {
            throw new Error(`Cantitate insuficientă în stoc pentru produs ${rp.product_id}. Disponibil ${totalAvailable}, necesar ${neededTotal}`);
          }
          for (const s of stocks) {
            if (remaining <= 0) break;
            const available = Number(s.quantity);
            const toConsume = Math.min(available, remaining);
            // create transaction
            const tx = this.txRepo.create({
              stock_id: s.id,
              type: TransactionTypeRef.EXIT,
              quantity: toConsume as any,
              location: 'production',
              target: `recipe-preparation:${saved.id}`,
              timestamp: new Date() as any,
            });
            await this.txRepo.save(tx);
            // update stock
            s.quantity = (available - toConsume) as any;
            s.last_update = new Date() as any;
            await this.stockRepo.save(s);
            remaining -= toConsume;
          }
        }
      }
    } catch (e) {
      // rollback preparation if stock consumption fails
      try { await this.prepRepo.remove(saved); } catch {}
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
  async prepareWithStock(dto: { recipe_id: number; quantity: number; employee_id?: number; produced_at?: string }) {
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


