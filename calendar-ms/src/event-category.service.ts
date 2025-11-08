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

  // Create a new event category
  async create(dto: CreateEventCategoryDto): Promise<EventCategory> {
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  // Get all event categories
  async findAll(): Promise<EventCategory[]> {
    return this.categoryRepo.find({
      order: { name: 'ASC' },
    });
  }

  // Get event category by ID
  async findOne(id: number): Promise<EventCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoria nu a fost găsită');
    }

    return category;
  }

  // Update event category
  async update(id: number, dto: UpdateEventCategoryDto): Promise<EventCategory> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  // Delete event category
  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepo.remove(category);
  }

  // Get default categories (for migration/seeding)
  getDefaultCategories(): CreateEventCategoryDto[] {
    return [
      { name: 'Personal', color: 'purple' },
      { name: 'Work', color: 'blue' },
      { name: 'Health', color: 'green' },
      { name: 'Education', color: 'orange' },
      { name: 'Other', color: 'gray' },
    ];
  }
}