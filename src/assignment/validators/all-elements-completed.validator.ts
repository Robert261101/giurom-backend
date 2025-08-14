import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskTemplate } from '../../template/entity/task-template.entity';

@ValidatorConstraint({ name: 'allElementsCompleted', async: true })
@Injectable()
export class AllElementsCompletedValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(TaskTemplate)
    private taskTemplateRepository: Repository<TaskTemplate>
  ) {}

  async validate(value: any, args: ValidationArguments) {
    const { object } = args;
    const assignment = object as any;
    
    if (!assignment.task_template_id) {
      return false;
    }

    // Obține template-ul cu toate elementele
    const template = await this.taskTemplateRepository.findOne({
      where: { id: assignment.task_template_id },
      relations: ['elements']
    });

    if (!template) {
      return false;
    }

    // Verifică toate elementele
    const completedElementIds = assignment.elements?.map(el => el.task_element_id) || [];
    const templateElementIds = template.elements.map(el => el.id);
    
    const allElementsCompleted = templateElementIds.every(id => completedElementIds.includes(id));
    
    return allElementsCompleted;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Toate elementele din template trebuie să fie completate în assignment';
  }
} 