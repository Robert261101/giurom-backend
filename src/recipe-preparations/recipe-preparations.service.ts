import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { CreateRecipePreparationDto } from './dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './dto/update-recipe-preparation.dto';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Employee } from '../employee/entity/employee.entity';
import { RecipeLabelsService } from '../recipe-labels/recipe-labels.service';
import { RecipeProduct } from '../recipes/entities/recipe-product.entity';
import { StockService } from '../stock/stock.service';

@Injectable()
export class RecipePreparationsService {
  constructor(
    @InjectRepository(RecipePreparation)
    private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly labelsService: RecipeLabelsService,
    @InjectRepository(RecipeProduct)
    private readonly recipeProductRepo: Repository<RecipeProduct>,
    private readonly stockService: StockService,
  ) {}

  private async assertForeignKeys(dto: Partial<CreateRecipePreparationDto>) {
    if (dto.recipe_id) {
      const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
      if (!recipe) throw new NotFoundException(`Rețeta ${dto.recipe_id} nu există`);
    }
    if (dto.employee_id) {
      const employee = await this.employeeRepo.findOne({ where: { id: dto.employee_id } });
      if (!employee) throw new NotFoundException(`Angajatul ${dto.employee_id} nu există`);
    }
  }

  async create(dto: CreateRecipePreparationDto): Promise<RecipePreparation> {
    await this.assertForeignKeys(dto);
    const entity = this.prepRepo.create({
      ...dto,
      produced_at: new Date(dto.produced_at),
    } as Partial<RecipePreparation>);

    const saved = await this.prepRepo.save(entity);

    // Note: Label generation is handled separately to avoid blocking preparation creation
    if (dto.is_labeled) {
      console.log(`Preparation ${saved.id} marked for labeling`);
      // Labels will be created manually via API when needed
    }

    // Consumă produsele din stoc
    const recipeProducts = await this.recipeProductRepo.find({ where: { recipe_id: dto.recipe_id } });
    for (const rp of recipeProducts) {
      const qty = Number(rp.quantity);
      if (qty > 0) {
        await this.stockService.consumeProduct(rp.product_id, qty, `recipe-preparation ${saved.id}`);
      }
    }

    return saved;
  }

  findAll(): Promise<RecipePreparation[]> {
    return this.prepRepo.find({ 
      relations: ['recipe', 'produced_by', 'recipe.recipe_products', 'recipe.recipe_products.product'] 
    });
  }

  async findOne(id: number): Promise<RecipePreparation> {
    const prep = await this.prepRepo.findOne({ 
      where: { id }, 
      relations: ['recipe', 'produced_by', 'recipe.recipe_products', 'recipe.recipe_products.product'] 
    });
    if (!prep) throw new NotFoundException('Prepararea nu a fost găsită');
    return prep;
  }

  async update(id: number, dto: UpdateRecipePreparationDto): Promise<RecipePreparation> {
    const prep = await this.findOne(id);
    await this.assertForeignKeys(dto);
    // Nothing special yet
    Object.assign(prep, dto);
    return this.prepRepo.save(prep);
  }

  async remove(id: number): Promise<void> {
    const prep = await this.findOne(id);
    await this.prepRepo.remove(prep);
  }
} 