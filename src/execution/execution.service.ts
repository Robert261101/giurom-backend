import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(TaskExecution)
    private executionRepository: Repository<TaskExecution>,
    @InjectRepository(TaskExecutionAnswer)
    private answerRepository: Repository<TaskExecutionAnswer>,
    @InjectRepository(TaskAssignment)
    private taskAssignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskElement)
    private taskElementRepository: Repository<TaskElement>,
  ) {}

  async create(createExecutionDto: CreateExecutionDto): Promise<TaskExecution> {
    // Verifică dacă assignment-ul există
    const assignment = await this.taskAssignmentRepository.findOne({ 
      where: { id: createExecutionDto.task_assignment_id } 
    });
    
    if (!assignment) {
      throw new BadRequestException(`Assignment-ul cu ID-ul ${createExecutionDto.task_assignment_id} nu există`);
    }

    // Extrage answers din DTO
    const { answers, ...executionData } = createExecutionDto;
    
    // Creează execuția
    const execution = this.executionRepository.create(executionData);
    const savedExecution = await this.executionRepository.save(execution);

    // Creează answers dacă sunt specificate
    if (answers && answers.length > 0) {
      for (const answerDto of answers) {
        // Verifică dacă elementul există
        const element = await this.taskElementRepository.findOne({
          where: { id: answerDto.task_element_id }
        });
        
        if (!element) {
          throw new BadRequestException(`Elementul cu ID-ul ${answerDto.task_element_id} nu există`);
      }

        // Folosește score_awarded din DTO sau calculează automat pentru scoring_boolean
        let score_awarded = answerDto.score_awarded || 0;
        if (element.element_type === 'scoring_boolean') {
          try {
            // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
            const selectedOptions = JSON.parse(answerDto.value || '[]');
            if (Array.isArray(selectedOptions)) {
              // Calculează punctajul total din opțiunile selectate
              const scoringOptions = element.scoring_options ? JSON.parse(element.scoring_options) : [
                { name: 'Opțiunea 1', points: 1 },
                { name: 'Opțiunea 2', points: 2 },
                { name: 'Opțiunea 3', points: 3 }
              ];
              
              score_awarded = selectedOptions.reduce((total: number, optionName: string) => {
                const option = scoringOptions.find((opt: any) => opt.name === optionName);
                return total + (option ? option.points : 0);
              }, 0);
            } else {
              // Fallback pentru sistemul vechi true/false
              score_awarded = answerDto.value === 'true' ? 10 : 0;
            }
          } catch (error) {
            // Fallback pentru sistemul vechi true/false
            score_awarded = answerDto.value === 'true' ? 10 : 0;
      }
        }

        const answer = this.answerRepository.create({
          task_element_id: answerDto.task_element_id,
          value: answerDto.value || '',
          task_execution_id: savedExecution.id,
          score_awarded: score_awarded
        });
        await this.answerRepository.save(answer);
      }
    }

    // Returnează execuția cu relațiile
    return this.findOne(savedExecution.id);
  }

  async findAll(includeAssignment: boolean = true): Promise<TaskExecution[]> {
    const relations = ['answers'];
    if (includeAssignment) {
      relations.push('task_assignment', 'task_assignment.template', 'task_assignment.elements', 'task_assignment.elements.task_element');
    }

    return this.executionRepository.find({
      relations,
      order: {
        created_at: 'DESC'
      }
    });
  }

  async findOne(id: number): Promise<TaskExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id },
      relations: ['task_assignment', 'answers']
    });
    
    if (!execution) {
      throw new NotFoundException(`Execuția cu ID ${id} nu a fost găsită`);
    }
    
    return execution;
  }

  async update(id: number, updateExecutionDto: UpdateExecutionDto): Promise<TaskExecution> {
    const execution = await this.findOne(id);

    // Extrage answers din DTO
    const { answers, ...executionData } = updateExecutionDto;

    // Verifică dacă assignment-ul există dacă se actualizează
    if (executionData.task_assignment_id) {
      const assignment = await this.taskAssignmentRepository.findOne({ 
        where: { id: executionData.task_assignment_id } 
      });
      
      if (!assignment) {
        throw new BadRequestException(`Assignment-ul cu ID-ul ${executionData.task_assignment_id} nu există`);
      }
    }

    // Actualizează execuția
    Object.assign(execution, executionData);
    await this.executionRepository.save(execution);

    // Actualizează answers dacă sunt specificate
    if (answers) {
      // Șterge answers existente
      await this.answerRepository.delete({ task_execution_id: id });

      // Creează answers noi
      if (answers.length > 0) {
        for (const answerDto of answers) {
    // Verifică dacă elementul există
    const element = await this.taskElementRepository.findOne({
            where: { id: answerDto.task_element_id }
    });
    
    if (!element) {
            throw new BadRequestException(`Elementul cu ID-ul ${answerDto.task_element_id} nu există`);
    }

          // Folosește score_awarded din DTO sau calculează automat pentru scoring_boolean
          let score_awarded = answerDto.score_awarded || 0;
          if (element.element_type === 'scoring_boolean') {
            try {
              // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
              const selectedOptions = JSON.parse(answerDto.value || '[]');
              if (Array.isArray(selectedOptions)) {
                // Calculează punctajul total din opțiunile selectate
                const scoringOptions = element.scoring_options ? JSON.parse(element.scoring_options) : [
                  { name: 'Opțiunea 1', points: 1 },
                  { name: 'Opțiunea 2', points: 2 },
                  { name: 'Opțiunea 3', points: 3 }
                ];
                
                score_awarded = selectedOptions.reduce((total: number, optionName: string) => {
                  const option = scoringOptions.find((opt: any) => opt.name === optionName);
                  return total + (option ? option.points : 0);
                }, 0);
              } else {
                // Fallback pentru sistemul vechi true/false
                score_awarded = answerDto.value === 'true' ? 10 : 0;
  }
            } catch (error) {
              // Fallback pentru sistemul vechi true/false
              score_awarded = answerDto.value === 'true' ? 10 : 0;
            }
          }
          
          const answer = this.answerRepository.create({
            task_element_id: answerDto.task_element_id,
            value: answerDto.value || '',
            task_execution_id: id,
            score_awarded: score_awarded
          });
          await this.answerRepository.save(answer);
  }
      }
    }

    // Returnează execuția actualizată
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const execution = await this.findOne(id);
    await this.executionRepository.remove(execution);
  }
} 