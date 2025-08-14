import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskTemplate } from '../../template/entity/task-template.entity';

@ValidatorConstraint({ name: 'templateExists', async: true })
@Injectable()
export class TemplateExistsValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(TaskTemplate)
    private taskTemplateRepository: Repository<TaskTemplate>
  ) {}

  async validate(value: any, args: ValidationArguments) {
    if (!value) {
      return false;
    }

    const template = await this.taskTemplateRepository.findOne({
      where: { id: value }
    });

    return !!template;
  }

  defaultMessage(args: ValidationArguments) {
    return `Template-ul cu ID-ul ${args.value} nu există în baza de date`;
  }
} 