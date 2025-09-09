import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class RecipePreparationsService {
  constructor(
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
  ) {}

  async findAll(page = 1, limit = 50) {
    const [rows] = await Promise.all([
      this.prepRepo.find({
        relations: ['recipe', 'recipe.category'],
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
      relations: ['recipe', 'recipe.category', 'recipe.recipe_products'] 
    });
    if (!p) throw new NotFoundException('Preparation not found');
    return p;
  }

  async create(dto: { recipe_id: number; employee_id?: number; quantity: number; produced_at?: string }) {
    const recipe = await this.recipeRepo.findOne({ 
      where: { id: dto.recipe_id },
      relations: ['recipe_products']
    });
    if (!recipe) throw new NotFoundException('Rețeta nu a fost găsită');
    
    const p = this.prepRepo.create({
      recipe_id: dto.recipe_id,
      produced_by: dto.employee_id,
      quantity: dto.quantity as any,
      produced_at: dto.produced_at ? (new Date(dto.produced_at) as any) : (new Date() as any),
      is_labeled: false,
    } as any);
    
    const saved: RecipePreparation = (await this.prepRepo.save(p as any)) as RecipePreparation;

    // Integrate with stock microservice for stock consumption
    await this.consumeStockForPreparation(recipe, dto.quantity);
    
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

  // Integrate with stock microservice to consume ingredients
  private async consumeStockForPreparation(recipe: Recipe, preparationQuantity: number) {
    console.log(`🔄 Starting stock consumption for recipe: ${recipe.name}, quantity: ${preparationQuantity}`);
    
    try {
      // Calculate scaling factor
      const originalRecipeQuantity = recipe.quantity || 1000; // Default 1000g if not set
      const scalingFactor = preparationQuantity / originalRecipeQuantity;
      
      console.log(`📊 Recipe original quantity: ${originalRecipeQuantity}g, preparation quantity: ${preparationQuantity}g, scaling factor: ${scalingFactor.toFixed(2)}x`);

      // Process each ingredient
      for (const ingredient of recipe.recipe_products || []) {
        const scaledQuantity = ingredient.quantity * scalingFactor;
        
        console.log(`🥄 Processing ingredient: product_id=${ingredient.product_id}, original=${ingredient.quantity}, scaled=${scaledQuantity.toFixed(2)}`);
        console.log(`🥄 Ingredient details:`, JSON.stringify(ingredient, null, 2));
        
        // Use the consume endpoint which handles FIFO logic automatically
        const consumeData = {
          product_id: ingredient.product_id,
          quantity: scaledQuantity,
          target: `Preparare rețetă: ${recipe.name}`
        };

        console.log(`📤 Sending consume request to stock service:`, consumeData);

        // Call stock microservice to consume product
        const response = await axios.post('http://localhost:3005/stock/consume', consumeData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log(`✅ Stock service response:`, response.status, response.data);
        console.log(`✅ Consumed ${scaledQuantity} units of product ${ingredient.product_id} for recipe ${recipe.name}`);
      }
    } catch (error: any) {
      console.error('❌ Failed to consume stock for preparation:', error);
      if (error.response) {
        console.error('❌ Stock service error response:', error.response.status, error.response.data);
      }
      // Don't throw error to avoid breaking the preparation creation
      // In production, you might want to implement a retry mechanism or rollback
    }
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


