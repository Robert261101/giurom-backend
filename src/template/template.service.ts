import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskTemplate } from './entity/task-template.entity';
import { TaskElement } from './entity/task-element.entity';
import { TemplateLocation } from './entity/template-location.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(TaskTemplate)
    private templateRepository: Repository<TaskTemplate>,
    @InjectRepository(TaskElement)
    private elementRepository: Repository<TaskElement>,
    @InjectRepository(TemplateLocation)
    private templateLocationRepository: Repository<TemplateLocation>,
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

    // Creează relația template-locație în tabela templates_locations
    if (createTemplateDto.locationId) {
      const templateLocation = this.templateLocationRepository.create({
        taskTemplateId: savedTemplate.id,
        idLocation: createTemplateDto.locationId
      });
      
      await this.templateLocationRepository.save(templateLocation);
      console.log(`🔗 DEBUG Template-Location:`, {
        templateId: savedTemplate.id,
        locationId: createTemplateDto.locationId
      });
    }

    // Returnează template-ul cu elementele (fără verificare locație la creare)
    return this.findOneWithoutLocationCheck(savedTemplate.id);
  }

  async findAll(locationId: number): Promise<TaskTemplate[]> {
    console.log('🔍 DEBUG TemplateService.findAll - locationId (OBLIGATORIU):', locationId);
    
    if (!locationId) {
      console.log('❌ DEBUG TemplateService.findAll - locationId este obligatoriu!');
      throw new Error('locationId este obligatoriu pentru a obține template-urile');
    }
    
    console.log('🔍 DEBUG TemplateService.findAll - Filtering by locationId:', locationId);
    // Găsește template-urile pentru o locație specifică
    const templateLocations = await this.templateLocationRepository.find({
      where: { idLocation: locationId },
      relations: ['template', 'template.elements'],
      order: { createdAt: 'DESC' }
    });

    console.log('🔍 DEBUG TemplateService.findAll - Found templateLocations:', templateLocations.length);
    const templates = templateLocations.map(tl => tl.template);
    console.log('🔍 DEBUG TemplateService.findAll - Returning templates:', templates.length);
    return templates;
  }

  async findOne(id: number, locationId: number): Promise<TaskTemplate> {
    console.log('🔍 DEBUG TemplateService.findOne - id:', id, 'locationId (OBLIGATORIU):', locationId);
    
    if (!locationId) {
      console.log('❌ DEBUG TemplateService.findOne - locationId este obligatoriu!');
      throw new Error('locationId este obligatoriu pentru a obține template-ul');
    }
    
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

    // Verifică dacă template-ul este disponibil în locația specificată
    console.log('🔍 DEBUG TemplateService.findOne - Checking location availability for template:', id, 'in location:', locationId);
    
    const templateLocation = await this.templateLocationRepository.findOne({
      where: { 
        taskTemplateId: id,
        idLocation: locationId 
      }
    });

    if (!templateLocation) {
      console.log('❌ DEBUG TemplateService.findOne - Template not available in location');
      throw new NotFoundException(`Template cu ID ${id} nu este disponibil în locația specificată`);
    }
    
    console.log('✅ DEBUG TemplateService.findOne - Template available in location');
    return template;
  }

  // Metodă privată pentru a găsi un template fără verificare de locație (folosită intern)
  private async findOneWithoutLocationCheck(id: number): Promise<TaskTemplate> {
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
    const template = await this.findOneWithoutLocationCheck(id);

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

    // Returnează template-ul actualizat (fără verificare locație la update)
    return this.findOneWithoutLocationCheck(id);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOneWithoutLocationCheck(id);
    
    // Șterge toate elementele template-ului
    await this.elementRepository.delete({ template_id: id });
    
    // Șterge toate relațiile template-locație
    await this.templateLocationRepository.delete({ taskTemplateId: id });
    
    // Șterge template-ul
    await this.templateRepository.remove(template);
  }

}