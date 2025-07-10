import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { CreateRecipePreparationDto } from './dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './dto/update-recipe-preparation.dto';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Employee } from '../employee/entity/employee.entity';
import { RecipeLabelsService } from '../recipe-labels/recipe-labels.service';

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

    if (dto.is_labeled) {
      await this.labelsService.generateForPreparation(saved.id);
    }

    return saved;
  }

  findAll(): Promise<RecipePreparation[]> {
    return this.prepRepo.find({ relations: ['recipe', 'produced_by'] });
  }

  async findOne(id: number): Promise<RecipePreparation> {
    const prep = await this.prepRepo.findOne({ where: { id }, relations: ['recipe', 'produced_by'] });
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