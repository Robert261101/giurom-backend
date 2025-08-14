import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAssignment } from '../../assignment/entity/task-assignment.entity';

@ValidatorConstraint({ name: 'assignmentExists', async: true })
@Injectable()
export class AssignmentExistsValidator implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(TaskAssignment)
    private taskAssignmentRepository: Repository<TaskAssignment>
  ) {}

  async validate(value: any, args: ValidationArguments) {
    if (!value) {
      return false;
    }

    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id: value }
    });

    return !!assignment;
  }

  defaultMessage(args: ValidationArguments) {
    return `Assignment-ul cu ID-ul ${args.value} nu există în baza de date`;
  }
} 