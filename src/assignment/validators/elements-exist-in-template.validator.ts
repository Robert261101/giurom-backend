import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskTemplate } from '../../template/entity/task-template.entity';
import { TaskElement } from '../../template/entity/task-element.entity';

@ValidatorConstraint({ name: 'elementsExistInTemplate', async: true })
@Injectable()
export class ElementsExistInTemplateValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(TaskTemplate)
    private taskTemplateRepository: Repository<TaskTemplate>,
    @InjectRepository(TaskElement)
    private taskElementRepository: Repository<TaskElement>
  ) {}

  async validate(value: any, args: ValidationArguments) {
    const { object } = args;
    const assignment = object as any;
    
    if (!assignment.template_id || !value || !Array.isArray(value)) {
      return false;
    }

    // Verifică dacă template-ul există
    const template = await this.taskTemplateRepository.findOne({
      where: { id: assignment.template_id },
      relations: ['elements']
    });

    if (!template) {
      // Dacă template-ul nu există, toate elementele sunt invalide
      const allElementIds = value.map((element: any) => element.task_element_id);
      (args as any).missingElementIds = allElementIds;
      return false;
    }

    // Obține ID-urile elementelor din template
    const templateElementIds = template.elements.map(el => el.id);
    
    // Verifică dacă toate elementele din assignment există în template
    const missingElementIds: number[] = [];
    for (const element of value) {
      if (!templateElementIds.includes(element.task_element_id)) {
        missingElementIds.push(element.task_element_id);
      }
    }
    
    // Dacă există elemente care nu sunt în template, salvează ID-urile pentru mesajul de eroare
    if (missingElementIds.length > 0) {
      (args as any).missingElementIds = missingElementIds;
      return false;
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const missingElementIds = (args as any).missingElementIds;
    if (missingElementIds && missingElementIds.length > 0) {
      return `Unul sau mai multe elemente nu există în template-ul specificat (task_element_id: ${missingElementIds.join(', ')})`;
    }
    return 'Unul sau mai multe elemente nu există în template-ul specificat';
  }
} 