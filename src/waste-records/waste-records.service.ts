import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WasteRecord } from './entities/waste-record.entity';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { Product } from '../stock/entities/product.entity';
import { Recipe } from '../recipes/entities/recipe.entity';

@Injectable()
export class WasteRecordsService {
  constructor(
    @InjectRepository(WasteRecord) private readonly repo: Repository<WasteRecord>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
  ) {}

  private async validateFK(dto: Partial<CreateWasteRecordDto>) {
    if (!dto.product_id && !dto.recipe_id) {
      throw new BadRequestException('Trebuie să specifici product_id sau recipe_id');
    }
    if (dto.product_id) {
      const p = await this.productRepo.findOne({ where: { id: dto.product_id } });
      if (!p) throw new NotFoundException('Produsul nu există');
    }
    if (dto.recipe_id) {
      const r = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
      if (!r) throw new NotFoundException('Rețeta nu există');
    }
  }

  async create(dto: CreateWasteRecordDto) {
    await this.validateFK(dto);
    const record = this.repo.create(dto);
    return this.repo.save(record);
  }

  findAll() {
    return this.repo.find({ relations: ['product', 'recipe'] });
  }

  async findOne(id: number) {
    const rec = await this.repo.findOne({ where: { id }, relations: ['product', 'recipe'] });
    if (!rec) throw new NotFoundException();
    return rec;
  }

  async update(id: number, dto: UpdateWasteRecordDto) {
    const rec = await this.findOne(id);
    await this.validateFK(dto);
    Object.assign(rec, dto);
    return this.repo.save(rec);
  }

  async remove(id: number) {
    const rec = await this.findOne(id);
    await this.repo.remove(rec);
  }
} 