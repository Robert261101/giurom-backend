import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCategory } from './entities/event-category.entity';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';

@Injectable()
export class EventCategoryService {
  constructor(
    @InjectRepository(EventCategory)
    private readonly categoryRepo: Repository<EventCategory>,
  ) {}

  async create(dto: CreateEventCategoryDto): Promise<EventCategory> {
    const category = this.categoryRepo.create({
      code: dto.code,
      name: dto.name,
      is_active: dto.is_active ?? true,
    });
    return this.categoryRepo.save(category);
  }

  async findAll(): Promise<EventCategory[]> {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
    });
  }

  async findAllActive(): Promise<EventCategory[]> {
    return this.categoryRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<EventCategory> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoria nu a fost găsită');
    }
    return category;
  }

  async findByCode(code: string): Promise<EventCategory | null> {
    return this.categoryRepo.findOne({ where: { code } });
  }

  async update(id: number, dto: UpdateEventCategoryDto): Promise<EventCategory> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepo.remove(category);
  }
}
