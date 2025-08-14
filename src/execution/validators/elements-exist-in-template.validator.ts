import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAssignment } from '../../assignment/entity/task-assignment.entity';
import { TaskElement } from '../../template/entity/task-element.entity';

@ValidatorConstraint({ name: 'elementsExistInTemplate', async: true })
@Injectable()
export class ElementsExistInTemplateValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(TaskAssignment)
    private taskAssignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskElement)
    private taskElementRepository: Repository<TaskElement>
  ) {}

  async validate(value: any, args: ValidationArguments) {
    const { object } = args;
    const execution = object as any;
    
    if (!execution.task_assignment_id || !value || !Array.isArray(value)) {
      return false;
    }

    // Verifică dacă assignment-ul există și obține template-ul
    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id: execution.task_assignment_id },
      relations: ['template', 'template.elements']
    });

    if (!assignment || !assignment.template) {
      // Dacă assignment-ul sau template-ul nu există, toate elementele sunt invalide
      const allElementIds = value.map((answer: any) => answer.task_element_id);
      (args as any).missingElementIds = allElementIds;
      return false;
    }

    // Obține ID-urile elementelor din template
    const templateElementIds = assignment.template.elements.map(el => el.id);
    
    // Verifică dacă toate elementele din answers există în template
    const missingElementIds: number[] = [];
    for (const answer of value) {
      if (!templateElementIds.includes(answer.task_element_id)) {
        missingElementIds.push(answer.task_element_id);
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
      return `Unul sau mai multe elemente nu există în template-ul assignment-ului (task_element_id: ${missingElementIds.join(', ')})`;
    }
    return 'Unul sau mai multe elemente nu există în template-ul assignment-ului';
  }
} 