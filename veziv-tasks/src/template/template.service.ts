import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskTemplate } from './entity/task-template.entity';
import { TaskElement } from './entity/task-element.entity';
import { TemplatesLocations } from './entity/templates-locations.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(TaskTemplate)
    private templateRepository: Repository<TaskTemplate>,
    @InjectRepository(TaskElement)
    private elementRepository: Repository<TaskElement>,
    @InjectRepository(TemplatesLocations)
    private templatesLocationsRepository: Repository<TemplatesLocations>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto): Promise<TaskTemplate> {
    // Creează template-ul
    const template = this.templateRepository.create({
      template_name: createTemplateDto.template_name,
      template_type: createTemplateDto.template_type,
    });
    
    const savedTemplate = await this.templateRepository.save(template);

    // Creează elementele pentru template
    if (createTemplateDto.elements && createTemplateDto.elements.length > 0) {
      const elements = createTemplateDto.elements.map(elementDto => {
        console.log(`🔧 DEBUG Template Element:`, {
          type: elementDto.element_type,
          finish_at: elementDto.finish_at
        });
        
        return this.elementRepository.create({
          ...elementDto,
          template_id: savedTemplate.id,
        });
      });
      
      await this.elementRepository.save(elements);
    }

    // Returnează template-ul cu elementele
    return this.findOne(savedTemplate.id);
  }

  async findAll(): Promise<TaskTemplate[]> {
    return this.templateRepository.find({
      relations: ['elements'],
      order: {
        created_at: 'DESC',
        elements: {
          sort_order: 'ASC'
        }
      }
    });
  }

  async findOne(id: number): Promise<TaskTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['elements'],
      order: {
        elements: {
          sort_order: 'ASC'
        }
      }
    });

    if (!template) {
      throw new NotFoundException(`Template cu ID ${id} nu a fost găsit`);
    }

    return template;
  }

  async update(id: number, updateTemplateDto: UpdateTemplateDto): Promise<TaskTemplate> {
    const template = await this.findOne(id);

    // Actualizează template-ul dacă este specificat
    if (updateTemplateDto.template_name || updateTemplateDto.template_type) {
    if (updateTemplateDto.template_name) {
      template.template_name = updateTemplateDto.template_name;
      }
      if (updateTemplateDto.template_type) {
        template.template_type = updateTemplateDto.template_type;
      }
      await this.templateRepository.save(template);
    }

    // Actualizează elementele dacă sunt specificate
    if (updateTemplateDto.elements) {
      // Șterge toate elementele existente
      await this.elementRepository.delete({ template_id: id });

      // Creează elementele noi
      if (updateTemplateDto.elements.length > 0) {
        const elements = updateTemplateDto.elements.map(elementDto => 
          this.elementRepository.create({
            ...elementDto,
            template_id: id,
          })
        );
        
        await this.elementRepository.save(elements);
      }
    }

    // Returnează template-ul actualizat
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepository.remove(template);
  }

  // === TEMPLATES LOCATIONS METHODS ===
  async assignTemplateToLocation(templateId: number, locationId: number): Promise<TemplatesLocations> {
    // Verify template exists
    await this.findOne(templateId);
    
    // Check if assignment already exists
    const existingAssignment = await this.templatesLocationsRepository.findOne({
      where: { task_templates_id: templateId, id_location: locationId }
    });
    
    if (existingAssignment) {
      throw new NotFoundException('Template-ul este deja atribuit la această locație');
    }
    
    const assignment = this.templatesLocationsRepository.create({
      task_templates_id: templateId,
      id_location: locationId,
    });
    
    return await this.templatesLocationsRepository.save(assignment);
  }

  async findTemplateLocations(templateId: number): Promise<TemplatesLocations[]> {
    await this.findOne(templateId);
    return await this.templatesLocationsRepository.find({
      where: { task_templates_id: templateId },
      relations: ['taskTemplate', 'workLocation'],
    });
  }

  async findLocationTemplates(locationId: number): Promise<TemplatesLocations[]> {
    return await this.templatesLocationsRepository.find({
      where: { id_location: locationId },
      relations: ['taskTemplate', 'workLocation'],
    });
  }

  async removeTemplateFromLocation(templateId: number, locationId: number): Promise<void> {
    const assignment = await this.templatesLocationsRepository.findOne({
      where: { task_templates_id: templateId, id_location: locationId }
    });
    
    if (!assignment) {
      throw new NotFoundException('Asocierea nu a fost găsită');
    }
    
    await this.templatesLocationsRepository.remove(assignment);
  }
}
