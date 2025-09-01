import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAssignment } from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskAssignmentElement)
    private elementRepository: Repository<TaskAssignmentElement>,
  ) {}

  async create(createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    // Creează assignment-ul
    const assignment = this.assignmentRepository.create({
      template_id: createAssignmentDto.template_id,
      assigned_to_type: createAssignmentDto.assigned_to_type,
      assigned_to_id: createAssignmentDto.assigned_to_id,
      created_by_employee_id: createAssignmentDto.created_by_employee_id,
      total_score: createAssignmentDto.total_score,
      status: createAssignmentDto.status,
      priority: createAssignmentDto.priority,
      assigned_at: new Date(createAssignmentDto.assigned_at),
      due_date: new Date(createAssignmentDto.due_date),
      notes: createAssignmentDto.notes,
      requires_manager_check: createAssignmentDto.requires_manager_check,
    });
    
    const savedAssignment = await this.assignmentRepository.save(assignment);

    // Creează elementele dacă există
    if (createAssignmentDto.elements && createAssignmentDto.elements.length > 0) {
      const elements = createAssignmentDto.elements.map(elementDto => 
        this.elementRepository.create({
          ...elementDto,
          task_assignment_id: savedAssignment.id,
        })
      );
      
      await this.elementRepository.save(elements);
    }

    // Returnează assignment-ul cu toate elementele
    return this.findOne(savedAssignment.id);
  }

  async findAll(): Promise<TaskAssignment[]> {
    return this.assignmentRepository.find({
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        created_at: 'DESC'
      }
    });
  }

  async findOne(id: number): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ['template', 'template.elements', 'elements', 'elements.task_element'],
      order: {
        template: {
          elements: {
            sort_order: 'ASC'
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment cu ID ${id} nu a fost găsit`);
    }

    return assignment;
  }

  async update(id: number, updateAssignmentDto: UpdateAssignmentDto): Promise<TaskAssignment> {
    const assignment = await this.findOne(id);

    // Actualizează câmpurile de bază ale assignment-ului
    const updateData: any = {};
    
    if (updateAssignmentDto.template_id !== undefined) updateData.template_id = updateAssignmentDto.template_id;
    if (updateAssignmentDto.assigned_to_type !== undefined) updateData.assigned_to_type = updateAssignmentDto.assigned_to_type;
    if (updateAssignmentDto.assigned_to_id !== undefined) updateData.assigned_to_id = updateAssignmentDto.assigned_to_id;
    if (updateAssignmentDto.total_score !== undefined) updateData.total_score = updateAssignmentDto.total_score;
    if (updateAssignmentDto.status !== undefined) updateData.status = updateAssignmentDto.status;
    if (updateAssignmentDto.priority !== undefined) updateData.priority = updateAssignmentDto.priority;
    if (updateAssignmentDto.assigned_at !== undefined) updateData.assigned_at = new Date(updateAssignmentDto.assigned_at);
    if (updateAssignmentDto.due_date !== undefined) updateData.due_date = new Date(updateAssignmentDto.due_date);
    if (updateAssignmentDto.completed_at !== undefined) updateData.completed_at = new Date(updateAssignmentDto.completed_at);
    if (updateAssignmentDto.notes !== undefined) updateData.notes = updateAssignmentDto.notes;
    if (updateAssignmentDto.requires_manager_check !== undefined) updateData.requires_manager_check = updateAssignmentDto.requires_manager_check;

    if (Object.keys(updateData).length > 0) {
      await this.assignmentRepository.update(id, updateData);
    }

    // Actualizează elementele dacă sunt specificate
    if (updateAssignmentDto.elements !== undefined) {
      // Șterge toate elementele existente
      await this.elementRepository.delete({ task_assignment_id: id });

      // Creează elementele noi
      if (updateAssignmentDto.elements.length > 0) {
        const elements = updateAssignmentDto.elements.map(elementDto => 
          this.elementRepository.create({
            ...elementDto,
            task_assignment_id: id,
          })
        );
        
        await this.elementRepository.save(elements);
      }
    }

    // Returnează assignment-ul actualizat
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.findOne(id);
    await this.assignmentRepository.remove(assignment);
  }
} 