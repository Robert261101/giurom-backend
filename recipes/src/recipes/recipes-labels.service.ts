import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipePreparation } from './entities/recipe-preparation.entity';

@Injectable()
export class RecipesLabelsService {
  constructor(
    @InjectRepository(RecipeLabel) private readonly labelRepo: Repository<RecipeLabel>,
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
  ) {}

  async findAll(): Promise<RecipeLabel[]> {
    return this.labelRepo.find({ order: { generated_at: 'DESC' } });
  }

  async findOne(id: number): Promise<RecipeLabel> {
    const label = await this.labelRepo.findOne({ where: { id } });
    if (!label) throw new NotFoundException('Label not found');
    return label;
  }

  private generateCode(): string {
    return `LBL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
  }

  async create(dto: { recipe_preparation_id: number; label_code?: string }): Promise<RecipeLabel> {
    const prep = await this.prepRepo.findOne({ where: { id: dto.recipe_preparation_id } });
    if (!prep) throw new NotFoundException('Preparation not found');
    const code = dto.label_code || this.generateCode();
    const path = `/files/recipes/labels/${code}.pdf`;
    const label = this.labelRepo.create({ recipe_preparation_id: prep.id, label_code: code, label_file_path: path });
    return await this.labelRepo.save(label);
  }

  async remove(id: number): Promise<void> {
    const label = await this.labelRepo.findOne({ where: { id } });
    if (!label) throw new NotFoundException('Label not found');
    await this.labelRepo.remove(label);
  }
}


