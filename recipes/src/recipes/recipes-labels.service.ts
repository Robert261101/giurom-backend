import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { RecipePreparation } from './entities/recipe-preparation.entity';

@Injectable()
export class RecipesLabelsService {
  constructor(
    @InjectRepository(RecipeLabel) private readonly labelRepo: Repository<RecipeLabel>,
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @Inject('NOTIFICATIONS_RMQ') private readonly rmq: ClientProxy,
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

  @Cron(CronExpression.EVERY_MINUTE)
  async emitExpiringLabelsNotifications(): Promise<void> {
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Join to preparation -> recipe to compute expiration
    const labels = await this.labelRepo
      .createQueryBuilder('label')
      .leftJoinAndSelect('label.preparation', 'prep')
      .leftJoinAndSelect('prep.recipe', 'recipe')
      .where('prep.produced_at IS NOT NULL')
      .getMany();

    for (const label of labels) {
      const producedAt = label.preparation?.produced_at as unknown as Date;
      const expHours = (label.preparation?.recipe as any)?.expiration_days || 48;
      if (!producedAt) continue;
      const expirationAt = new Date(producedAt);
      expirationAt.setHours(expirationAt.getHours() + expHours);

      if (expirationAt > now && expirationAt <= inTwoHours) {
        try {
          this.rmq.emit({ cmd: 'labels.expiring-soon' }, {
            labelId: label.id,
            labelCode: label.label_code,
            preparationId: label.recipe_preparation_id,
            expiresAt: expirationAt.toISOString(),
          });
        } catch {
          // Ignore transient RMQ errors
        }
      }
    }
  }
}


