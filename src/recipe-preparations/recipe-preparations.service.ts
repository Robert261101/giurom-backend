import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipePreparation } from './entities/recipe-preparation.entity';
import { CreateRecipePreparationDto } from './dto/create-recipe-preparation.dto';
import { UpdateRecipePreparationDto } from './dto/update-recipe-preparation.dto';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Employee } from '../employee/entity/employee.entity';

@Injectable()
export class RecipePreparationsService {
  constructor(
    @InjectRepository(RecipePreparation)
    private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
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

  private validateDates(prod: Date, exp: Date) {
    if (prod >= exp) throw new BadRequestException('expires_at trebuie să fie după produced_at');
  }

  async create(dto: CreateRecipePreparationDto): Promise<RecipePreparation> {
    await this.assertForeignKeys(dto);
    this.validateDates(new Date(dto.produced_at), new Date(dto.expires_at));
    const entity = this.prepRepo.create({
      ...dto,
      produced_at: new Date(dto.produced_at),
      expires_at: new Date(dto.expires_at),
    } as Partial<RecipePreparation>);

    return this.prepRepo.save(entity) as Promise<RecipePreparation>;
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
    if (dto.produced_at || dto.expires_at) {
      const prod = dto.produced_at ? new Date(dto.produced_at) : prep.produced_at;
      const exp = dto.expires_at ? new Date(dto.expires_at) : prep.expires_at;
      this.validateDates(prod, exp);
    }
    Object.assign(prep, dto);
    return this.prepRepo.save(prep);
  }

  async remove(id: number): Promise<void> {
    const prep = await this.findOne(id);
    await this.prepRepo.remove(prep);
  }
} 