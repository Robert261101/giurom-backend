import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
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
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendTemplateNotification(
    type: string,
    title: string,
    description: string,
    templateId: number,
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'tasks.notification' }, {
          type,
          title,
          description,
          entity_id: templateId,
          entity_type: 'task_template',
          metadata,
          priority: 'medium',
        })
      );
    } catch (error) {
      console.error('Failed to send template notification:', error);
    }
  }

  async create(createTemplateDto: CreateTemplateDto): Promise<TaskTemplate> {
    // Creează template-ul
    const template = this.templateRepository.create({
      template_name: createTemplateDto.template_name,
    });
    
    const savedTemplate = await this.templateRepository.save(template);

    // Creează elementele pentru template
    if (createTemplateDto.elements && createTemplateDto.elements.length > 0) {
      const elements = createTemplateDto.elements.map(elementDto => {
        
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
    }

    // Trimite notificare pentru creare template
    await this.sendTemplateNotification(
      'template.created',
      'Template creat',
      `Template-ul "${savedTemplate.template_name}" a fost creat cu succes`,
      savedTemplate.id,
      { locationId: createTemplateDto.locationId }
    );

    // Returnează template-ul cu elementele (fără verificare locație la creare)
    return this.findOneWithoutLocationCheck(savedTemplate.id);
  }

  async findAll(locationId: number): Promise<TaskTemplate[]> {
    
    if (!locationId) {
      throw new Error('locationId este obligatoriu pentru a obține template-urile');
    }
    
    // Găsește template-urile pentru o locație specifică
    const templateLocations = await this.templateLocationRepository.find({
      where: { idLocation: locationId },
      relations: ['template', 'template.elements'],
      order: { createdAt: 'DESC' }
    });

    const templates = templateLocations.map(tl => tl.template);
    
    // Debug: afișează elementele pentru primul template
    if (templates.length > 0 && templates[0].elements) {
    }
    
    return templates;
  }

  async findOne(id: number, locationId: number): Promise<TaskTemplate> {
    
    if (!locationId) {
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
    
    const templateLocation = await this.templateLocationRepository.findOne({
      where: { 
        taskTemplateId: id,
        idLocation: locationId 
      }
    });

    if (!templateLocation) {
      throw new NotFoundException(`Template cu ID ${id} nu este disponibil în locația specificată`);
    }
    
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
    if (updateTemplateDto.template_name) {
      if (updateTemplateDto.template_name) {
        template.template_name = updateTemplateDto.template_name;
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

    // Trimite notificare pentru actualizare template
    await this.sendTemplateNotification(
      'template.updated',
      'Template actualizat',
      `Template-ul "${template.template_name}" a fost actualizat`,
      id,
      { templateName: template.template_name }
    );

    // Returnează template-ul actualizat (fără verificare locație la update)
    return this.findOneWithoutLocationCheck(id);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOneWithoutLocationCheck(id);
    const templateName = template.template_name;
    
    // Șterge toate elementele template-ului
    await this.elementRepository.delete({ template_id: id });
    
    // Șterge toate relațiile template-locație
    await this.templateLocationRepository.delete({ taskTemplateId: id });
    
    // Șterge template-ul
    await this.templateRepository.remove(template);

    // Trimite notificare pentru ștergere template
    await this.sendTemplateNotification(
      'template.deleted',
      'Template șters',
      `Template-ul "${templateName}" a fost șters`,
      id,
      { templateName }
    );
  }

  async addLocationToTemplate(templateId: number, locationId: number): Promise<TemplateLocation> {
    // Verifică dacă template-ul există
    const template = await this.templateRepository.findOne({
      where: { id: templateId }
    });

    if (!template) {
      throw new NotFoundException(`Template cu ID ${templateId} nu a fost găsit`);
    }

    // Verifică dacă relația există deja
    const existing = await this.templateLocationRepository.findOne({
      where: {
        taskTemplateId: templateId,
        idLocation: locationId
      }
    });

    if (existing) {
      throw new BadRequestException(`Template-ul este deja asignat la această locație`);
    }

    // Creează relația template-locație
    const templateLocation = this.templateLocationRepository.create({
      taskTemplateId: templateId,
      idLocation: locationId
    });
    
    return await this.templateLocationRepository.save(templateLocation);
  }

}