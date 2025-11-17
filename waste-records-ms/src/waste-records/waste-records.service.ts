import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
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
  constructor(
    @InjectRepository(WasteRecord) private readonly repo: Repository<WasteRecord>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  async create(dto: CreateWasteRecordDto) {
    const entity = this.repo.create({
      product_id: dto.product_id ?? null,
      recipe_id: dto.recipe_id ?? null,
      quantity: dto.quantity as any,
      unit: dto.unit,
      reason: dto.reason ?? null,
    } as any);
    const saved = await this.repo.save(entity);
    
    // Send notification
    try {
      // Ensure we're working with a single entity, not an array
      const savedEntity = Array.isArray(saved) ? saved[0] : saved;
      
      this.notificationsClient.emit({ cmd: 'waste-records.notification' }, {
        type: 'waste_record_created',
        title: 'Inregistrare deseu noua',
        description: `S-a inregistrat un deseu: ${dto.quantity} ${dto.unit}${dto.reason ? ` - ${dto.reason}` : ''}`,
        entity_id: savedEntity.id,
        entity_type: 'waste_record',
        metadata: { wasteRecordId: savedEntity.id, ...dto },
        priority: 'medium',
        target_url: `/stoc`, // Add target_url
      });
    } catch (error) {
      console.error('Failed to send waste record notification:', error);
    }
    
    return saved;
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