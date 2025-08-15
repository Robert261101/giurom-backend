import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

// NOTE: Placeholder in-memory storage to unblock frontend until real schema exists
export interface Prep {
  id: number;
  recipe_id: number;
  employee_id?: number;
  quantity: number;
  produced_at: string;
  is_labeled: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class RecipePreparationsService {
  private preps: Prep[] = [];
  private seq = 1;

  async findAll(page = 1, limit = 50) {
    const start = (page - 1) * limit;
    const data = this.preps.slice(start, start + limit);
    return data;
  }

  async findOne(id: number) {
    const p = this.preps.find((x) => x.id === id);
    if (!p) throw new NotFoundException('Preparation not found');
    return p;
  }

  async create(dto: { recipe_id: number; employee_id?: number; quantity: number; produced_at?: string }) {
    const now = new Date().toISOString();
    const p: Prep = {
      id: this.seq++,
      recipe_id: dto.recipe_id,
      employee_id: dto.employee_id,
      quantity: dto.quantity,
      produced_at: dto.produced_at || now,
      is_labeled: false,
      created_at: now,
      updated_at: now,
    };
    this.preps.push(p);
    return p;
  }

  async update(id: number, dto: Partial<Prep>) {
    const p = await this.findOne(id);
    Object.assign(p, dto, { updated_at: new Date().toISOString() });
    return p;
  }

  async remove(id: number) {
    const idx = this.preps.findIndex((x) => x.id === id);
    if (idx === -1) throw new NotFoundException('Preparation not found');
    this.preps.splice(idx, 1);
  }

  // Composite: create preparation and return mock stock transactions
  async prepareWithStock(dto: { recipe_id: number; quantity: number; employee_id?: number; produced_at?: string }) {
    const preparation = await this.create(dto);
    // mock stock transactions result for UI
    const stockTransactions = [
      {
        id: Date.now(),
        stock_id: 0,
        type: 'exit',
        quantity: dto.quantity,
        location: 'Bucătărie',
        target: `Preparare rețetă #${preparation.id}`,
        timestamp: new Date().toISOString(),
      },
    ];
    return { preparation, stockTransactions };
  }
}


