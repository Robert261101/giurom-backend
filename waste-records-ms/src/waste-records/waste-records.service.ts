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
      this.notificationsClient.emit({ cmd: 'waste-records.notification' }, {
        type: 'waste_record_created',
        title: 'Înregistrare deșeu nouă',
        message: `S-a înregistrat un deșeu: ${dto.quantity} ${dto.unit}${dto.reason ? ` - ${dto.reason}` : ''}`,
        data: { wasteRecordId: saved.id, ...dto }
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


