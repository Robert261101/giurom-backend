import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WasteRecord } from './entities/waste-record.entity';

export interface CreateWasteRecordDto {
  product_id?: number;
  recipe_id?: number;
  quantity: number;
  unit: string;
  reason?: string;
}

export interface UpdateWasteRecordDto extends Partial<CreateWasteRecordDto> {}

@Injectable()
export class WasteRecordsService {
  constructor(@InjectRepository(WasteRecord) private readonly repo: Repository<WasteRecord>) {}

  async create(dto: CreateWasteRecordDto) {
    const entity = this.repo.create({
      product_id: dto.product_id ?? null,
      recipe_id: dto.recipe_id ?? null,
      quantity: dto.quantity as any,
      unit: dto.unit,
      reason: dto.reason ?? null,
    } as any);
    return this.repo.save(entity);
  }

  async findAll() {
    return this.repo.find({ order: { created_at: 'DESC' } as any });
  }

  async findOne(id: number) {
    const found = await this.repo.findOne({ where: { id } as any });
    if (!found) throw new NotFoundException('Waste record not found');
    return found;
  }

  async update(id: number, dto: UpdateWasteRecordDto) {
    const found = await this.findOne(id);
    Object.assign(found, dto);
    return this.repo.save(found);
  }

  async remove(id: number) {
    const found = await this.findOne(id);
    await this.repo.remove(found);
    return { id };
  }
}


