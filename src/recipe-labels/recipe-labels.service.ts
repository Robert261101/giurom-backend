import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipeLabel } from './entities/recipe-label.entity';
import { CreateRecipeLabelDto } from './dto/create-recipe-label.dto';
import { RecipePreparation } from '../recipe-preparations/entities/recipe-preparation.entity';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
// pdfkit CommonJS export; use require style to get constructor correctly
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { Recipe } from '../recipes/entities/recipe.entity';

@Injectable()
export class RecipeLabelsService {
  constructor(
    @InjectRepository(RecipeLabel) private readonly labelRepo: Repository<RecipeLabel>,
    @InjectRepository(RecipePreparation) private readonly prepRepo: Repository<RecipePreparation>,
    @InjectRepository(Recipe) private readonly recipeRepo: Repository<Recipe>,
  ) {}

  async generateForPreparation(prepId: number): Promise<RecipeLabel> {
    const prep = await this.prepRepo.findOne({ where: { id: prepId }, relations: ['recipe', 'produced_by'] });
    if (!prep) throw new NotFoundException('Prepararea nu există');

    const label_code = `LBL-${uuidv4()}`;

    // Determine expiration date based on recipe.expiration_days
    const expDays = prep.recipe?.expiration_days || 0;
    const expirationDate = new Date(prep.produced_at);
    expirationDate.setDate(expirationDate.getDate() + expDays);

    // Generate PDF
    const labelsDir = path.join(process.cwd(), 'labels');
    if (!fs.existsSync(labelsDir)) fs.mkdirSync(labelsDir);
    const filePath = path.join(labelsDir, `${label_code}.pdf`);

    await this.generatePdf({
      filePath,
      recipeName: prep.recipe.name,
      producedAt: prep.produced_at.toISOString().split('T')[0],
      expirationAt: expDays ? expirationDate.toISOString().split('T')[0] : 'N/A',
      author: prep.produced_by ? `${prep.produced_by.first_name ?? ''} ${prep.produced_by.last_name ?? ''}` : 'N/A',
    });

    const label = this.labelRepo.create({
      recipe_preparation_id: prep.id,
      label_code,
      label_file_path: filePath,
    });
    return this.labelRepo.save(label);
  }

  async generatePdf({ filePath, recipeName, producedAt, expirationAt, author }: { filePath: string; recipeName: string; producedAt: string; expirationAt: string; author: string; }): Promise<void> {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));
      doc.fontSize(20).text('Etichetă Rețetă', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Rețetă: ${recipeName}`);
      doc.text(`Produs la: ${producedAt}`);
      doc.text(`Expiră la: ${expirationAt}`);
      doc.text(`Produs de: ${author}`);
      doc.end();
      doc.on('finish', () => resolve());
    });
  }

  async createManual(dto: CreateRecipeLabelDto): Promise<RecipeLabel> {
    const prep = await this.prepRepo.findOne({ where: { id: dto.recipe_preparation_id } });
    if (!prep) throw new NotFoundException('Prepararea nu există');

    const label_code = dto.label_code ?? `LBL-${uuidv4()}`;
    const fakePath = `manual/${label_code}.pdf`;

    const label = this.labelRepo.create({
      recipe_preparation_id: prep.id,
      label_code,
      label_file_path: fakePath,
    });
    return this.labelRepo.save(label);
  }

  findAll() {
    return this.labelRepo.find();
  }

  findOne(id: number) {
    return this.labelRepo.findOne({ where: { id } });
  }

  async remove(id: number) {
    const label = await this.findOne(id);
    if (!label) throw new NotFoundException();
    await this.labelRepo.remove(label);
  }
} 