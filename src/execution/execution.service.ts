import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { CreateEmployeeDailyPointsDto } from './dto/create-employee-daily-points.dto';
import { CreateEmployeeDailyTaskPointsDto } from './dto/create-employee-daily-task-points.dto';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(TaskExecution)
    private executionRepository: Repository<TaskExecution>,
    @InjectRepository(TaskExecutionAnswer)
    private answerRepository: Repository<TaskExecutionAnswer>,
    @InjectRepository(EmployeeDailyPoints)
    private employeeDailyPointsRepository: Repository<EmployeeDailyPoints>,
    @InjectRepository(EmployeeDailyTaskPoints)
    private employeeDailyTaskPointsRepository: Repository<EmployeeDailyTaskPoints>,
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
    const executionWithRelations = await this.findOne(savedExecution.id);

    // Dacă execuția este finalizată (completed_at este setat), verifică dacă are elemente cu puncte
    if (executionWithRelations.completed_at) {
      await this.handleTaskCompletion(executionWithRelations);
    }

    return executionWithRelations;
  }

  async findAll(user: any, includeAssignment: boolean = true): Promise<TaskExecution[]> {
    const query = this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .orderBy('execution.created_at', 'DESC');

    if (includeAssignment) {
      query
        .leftJoinAndSelect('execution.task_assignment', 'task_assignment')
        .leftJoinAndSelect('task_assignment.template', 'template')
        .leftJoinAndSelect('task_assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'task_element');
    }

    // execution.read_all - vede toate
    if (user?.permissions?.includes('execution.read_all')) {
      return await query.getMany();
    }

    // execution.read_company - vede după compania din work_location
    if (user?.permissions?.includes('execution.read_company')) {
      // TODO: Implementare când avem legătura cu compania
      return await query.getMany();
    }

    // execution.read_location - vede după work_location
    if (user?.permissions?.includes('execution.read_location')) {
      // TODO: Implementare când avem legătura cu work_location
      return await query.getMany();
    }

    // execution.read_own - vede doar execuțiile lui (employee_id = user.sub)
    if (user?.permissions?.includes('execution.read_own')) {
      return await query
        .where('execution.employee_id = :userId', { userId: user.sub })
        .getMany();
    }

    // Dacă nu are nicio permisiune, returnează array gol
    return [];
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
    const updatedExecution = await this.findOne(id);

    // Dacă execuția este finalizată (completed_at este setat), verifică dacă are elemente cu puncte
    if (updatedExecution.completed_at) {
      await this.handleTaskCompletion(updatedExecution);
    }

    return updatedExecution;
  }

  async remove(id: number): Promise<void> {
    const execution = await this.findOne(id);
    await this.executionRepository.remove(execution);
  }

  // ===== METODE PENTRU PUNCTAJ ZILNIC =====

  async createEmployeeDailyPoints(createDto: CreateEmployeeDailyPointsDto): Promise<EmployeeDailyPoints> {
    // Verifică dacă există deja un punctaj pentru această zi și angajat
    const existingPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: createDto.employee_id,
        work_date: new Date(createDto.work_date)
      }
    });

    if (existingPoints) {
      throw new BadRequestException(`Există deja un punctaj pentru angajatul ${createDto.employee_id} în data ${createDto.work_date}`);
    }

    const dailyPoints = this.employeeDailyPointsRepository.create({
      employee_id: createDto.employee_id,
      work_date: new Date(createDto.work_date),
      total_points: createDto.total_points || 0
    });

    return await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  async getEmployeeDailyPoints(employeeId: number, workDate: string): Promise<EmployeeDailyPoints> {
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: new Date(workDate)
      },
      relations: ['task_points', 'task_points.task_execution']
    });

    if (!dailyPoints) {
      throw new NotFoundException(`Nu există punctaj pentru angajatul ${employeeId} în data ${workDate}`);
    }

    return dailyPoints;
  }

  async addTaskPointsToDailyPoints(createDto: CreateEmployeeDailyTaskPointsDto): Promise<EmployeeDailyTaskPoints> {
    // Verifică dacă punctajul zilnic există
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: { id: createDto.employee_daily_points_id }
    });

    if (!dailyPoints) {
      throw new BadRequestException(`Punctajul zilnic cu ID ${createDto.employee_daily_points_id} nu există`);
    }

    // Verifică dacă execuția task-ului există
    const taskExecution = await this.executionRepository.findOne({
      where: { id: createDto.task_execution_id }
    });

    if (!taskExecution) {
      throw new BadRequestException(`Execuția task-ului cu ID ${createDto.task_execution_id} nu există`);
    }

    // Verifică dacă există deja punctaj pentru această execuție
    const existingTaskPoints = await this.employeeDailyTaskPointsRepository.findOne({
      where: {
        employee_daily_points_id: createDto.employee_daily_points_id,
        task_execution_id: createDto.task_execution_id
      }
    });

    if (existingTaskPoints) {
      throw new BadRequestException(`Există deja punctaj pentru această execuție de task`);
    }

    // Creează punctajul pentru task
    const taskPoints = this.employeeDailyTaskPointsRepository.create({
      employee_daily_points_id: createDto.employee_daily_points_id,
      task_execution_id: createDto.task_execution_id,
      points_awarded: createDto.points_awarded
    });

    const savedTaskPoints = await this.employeeDailyTaskPointsRepository.save(taskPoints);

    // Actualizează punctajul total zilnic
    const totalPoints = await this.employeeDailyTaskPointsRepository
      .createQueryBuilder('taskPoints')
      .select('SUM(taskPoints.points_awarded)', 'total')
      .where('taskPoints.employee_daily_points_id = :dailyPointsId', { dailyPointsId: createDto.employee_daily_points_id })
      .getRawOne();

    dailyPoints.total_points = parseFloat(totalPoints.total) || 0;
    await this.employeeDailyPointsRepository.save(dailyPoints);

    return savedTaskPoints;
  }

  async getEmployeePointsForDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeDailyPoints[]> {
    return await this.employeeDailyPointsRepository
      .createQueryBuilder('dailyPoints')
      .leftJoinAndSelect('dailyPoints.task_points', 'taskPoints')
      .leftJoinAndSelect('taskPoints.task_execution', 'taskExecution')
      .where('dailyPoints.employee_id = :employeeId', { employeeId })
      .andWhere('dailyPoints.work_date >= :startDate', { startDate: new Date(startDate) })
      .andWhere('dailyPoints.work_date <= :endDate', { endDate: new Date(endDate) })
      .orderBy('dailyPoints.work_date', 'ASC')
      .getMany();
  }

  async calculateTotalPointsForEmployee(employeeId: number, startDate: string, endDate: string): Promise<number> {
    const result = await this.employeeDailyPointsRepository
      .createQueryBuilder('dailyPoints')
      .select('SUM(dailyPoints.total_points)', 'total')
      .where('dailyPoints.employee_id = :employeeId', { employeeId })
      .andWhere('dailyPoints.work_date >= :startDate', { startDate: new Date(startDate) })
      .andWhere('dailyPoints.work_date <= :endDate', { endDate: new Date(endDate) })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  // ===== METODĂ PENTRU GESTIONAREA FINALIZĂRII TASK-URILOR CU PUNCTE =====

  private async handleTaskCompletion(execution: TaskExecution): Promise<void> {
    try {
      // Verifică dacă execuția are answers cu puncte
      if (!execution.answers || execution.answers.length === 0) {
        return; // Nu are answers, nu face nimic
      }

      // Obține assignment-ul pentru a verifica finish_at
      const assignment = await this.taskAssignmentRepository.findOne({
        where: { id: execution.task_assignment_id },
        relations: ['elements', 'elements.task_element']
      });

      if (!assignment) {
        console.error(`Assignment-ul cu ID ${execution.task_assignment_id} nu a fost găsit`);
        return;
      }

      // Calculează punctajul pentru task-ul finalizat
      const { points: totalPoints, isOverdue } = this.calculateTaskPoints(execution, assignment);

      // Dacă nu are puncte, nu face nimic
      if (totalPoints === 0) {
        return;
      }

      // Obține data de lucru (ziua din completed_at)
      const workDate = new Date(execution.completed_at);
      workDate.setHours(0, 0, 0, 0); // Setează la începutul zilei

      // Verifică dacă există deja punctaj zilnic pentru această zi
      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: execution.employee_id,
          work_date: workDate
        }
      });

      // Dacă nu există, creează unul nou
      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: execution.employee_id,
          work_date: workDate,
          total_points: 0
        });
        dailyPoints = await this.employeeDailyPointsRepository.save(dailyPoints);
      }

      // Verifică dacă există deja punctaj pentru această execuție
      const existingTaskPoints = await this.employeeDailyTaskPointsRepository.findOne({
        where: {
          employee_daily_points_id: dailyPoints.id,
          task_execution_id: execution.id
        }
      });

      // Dacă nu există, adaugă punctajul pentru această execuție
      if (!existingTaskPoints) {
        const taskPoints = this.employeeDailyTaskPointsRepository.create({
          employee_daily_points_id: dailyPoints.id,
          task_execution_id: execution.id,
          points_awarded: totalPoints
        });
        await this.employeeDailyTaskPointsRepository.save(taskPoints);

        // Actualizează punctajul total zilnic
        const totalDailyPoints = await this.employeeDailyTaskPointsRepository
          .createQueryBuilder('taskPoints')
          .select('SUM(taskPoints.points_awarded)', 'total')
          .where('taskPoints.employee_daily_points_id = :dailyPointsId', { dailyPointsId: dailyPoints.id })
          .getRawOne();

        dailyPoints.total_points = parseFloat(totalDailyPoints.total) || 0;
        await this.employeeDailyPointsRepository.save(dailyPoints);

        const action = isOverdue ? 'scăzut' : 'adăugat';
        console.log(`Punctaj ${action} pentru execuția ${execution.id}: ${totalPoints} puncte pentru angajatul ${execution.employee_id} în data ${workDate.toISOString().split('T')[0]}${isOverdue ? ' (DUPĂ DEADLINE)' : ''}`);
      }
    } catch (error) {
      console.error('Eroare la procesarea finalizării task-ului cu puncte:', error);
      // Nu aruncăm eroarea pentru a nu afecta finalizarea task-ului
    }
  }

  // ===== METODĂ PENTRU PROCESAREA TASK-URILOR ÎNTÂRZIATE =====

  async processOverdueTasks(date: string): Promise<{ processedTasks: number; totalPointsDeducted: number }> {
    try {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      // Găsește toate assignment-urile care au elemente cu finish_at în ziua respectivă
      const assignments = await this.taskAssignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'taskElement')
        .where('taskElement.element_type = :finishAtType', { finishAtType: 'finish_at' })
        .andWhere('elements.value >= :startDate', { startDate: targetDate.toISOString() })
        .andWhere('elements.value < :endDate', { endDate: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString() })
        .andWhere('assignment.status != :completedStatus', { completedStatus: 'completed' })
        .getMany();

      let processedTasks = 0;
      let totalPointsDeducted = 0;

      for (const assignment of assignments) {
        // Verifică dacă există execuții pentru acest assignment
        const executions = await this.executionRepository.find({
          where: { task_assignment_id: assignment.id }
        });

        // Dacă nu există execuții, task-ul nu a fost început
        if (executions.length === 0) {
          const pointsDeducted = await this.deductPointsForUncompletedTask(assignment, targetDate);
          totalPointsDeducted += pointsDeducted;
          processedTasks++;
        }
      }

      console.log(`Procesate ${processedTasks} task-uri întârziate pentru data ${date}, puncte scăzute: ${totalPointsDeducted}`);

      return { processedTasks, totalPointsDeducted };
    } catch (error) {
      console.error('Eroare la procesarea task-urilor întârziate:', error);
      throw error;
    }
  }

  private async deductPointsForUncompletedTask(assignment: TaskAssignment, targetDate: Date): Promise<number> {
    let totalPointsDeducted = 0;

    // Pentru fiecare element cu puncte, scade punctele posibile
    for (const element of assignment.elements || []) {
      if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options ? JSON.parse(element.task_element.scoring_options) : [];
        const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
        totalPointsDeducted += totalPossiblePoints;
      }
    }

    if (totalPointsDeducted > 0) {
      // Creează sau actualizează punctajul zilnic
      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: assignment.assigned_to_id,
          work_date: targetDate
        }
      });

      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: assignment.assigned_to_id,
          work_date: targetDate,
          total_points: -totalPointsDeducted
        });
      } else {
        dailyPoints.total_points -= totalPointsDeducted;
      }

      await this.employeeDailyPointsRepository.save(dailyPoints);

      console.log(`Scăzut ${totalPointsDeducted} puncte pentru task-ul nefinalizat ${assignment.id} al angajatului ${assignment.assigned_to_id}`);
    }

    return totalPointsDeducted;
  }

  // ===== METODĂ PENTRU CALCULAREA PUNCTAJULUI TASK-ULUI =====

  private calculateTaskPoints(execution: TaskExecution, assignment: TaskAssignment): { points: number; isOverdue: boolean } {
    let totalPoints = 0;
    let isOverdue = false;

    // Verifică dacă task-ul are deadline și dacă este finalizat în timp
    const deadlineElement = assignment.elements?.find(el => el.task_element.element_type === 'finish_at');
    if (deadlineElement && execution.completed_at) {
      // Folosește value din assignment element pentru deadline
      const deadline = new Date(deadlineElement.value);
      const completionTime = new Date(execution.completed_at);
      isOverdue = completionTime > deadline;
      
      console.log(`🔍 DEBUG Task ${execution.id}:`);
      console.log(`   📅 Deadline: ${deadline.toISOString()}`);
      console.log(`   ✅ Finalizat: ${completionTime.toISOString()}`);
      console.log(`   ⏰ Este întârziat: ${isOverdue}`);
    }

    // Găsește toate elementele cu puncte din assignment
    const scoringElements = assignment.elements?.filter(el => el.task_element.element_type === 'scoring_boolean') || [];
    
    // Verifică dacă toate elementele cu puncte au fost completate
    const completedScoringElements = scoringElements.filter(element => {
      const answer = execution.answers?.find(a => a.task_element_id === element.task_element_id);
      return answer && answer.score_awarded > 0;
    });

    console.log(`🔍 DEBUG Scoring Elements: ${scoringElements.length} total, ${completedScoringElements.length} completate`);

    // Dacă nu toate elementele cu puncte au fost completate, scade punctele
    if (scoringElements.length > 0 && completedScoringElements.length < scoringElements.length) {
      console.log(`⚠️  Nu toate elementele cu puncte au fost completate!`);
      
      // Calculează punctele totale posibile din toate elementele cu puncte
      for (const element of scoringElements) {
        const scoringOptions = element.task_element.scoring_options ? JSON.parse(element.task_element.scoring_options) : [];
        const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
        totalPoints -= totalPossiblePoints; // Scade toate punctele posibile
      }
    } else {
      // Calculează punctajul normal din answers
      for (const answer of execution.answers) {
        const assignmentElement = assignment.elements?.find(el => el.task_element_id === answer.task_element_id);
        if (!assignmentElement) continue;

        const taskElement = assignmentElement.task_element;
        if (taskElement.element_type === 'scoring_boolean') {
          if (isOverdue) {
            // Dacă este finalizat după deadline, scade punctele din toate opțiunile
            const scoringOptions = taskElement.scoring_options ? JSON.parse(taskElement.scoring_options) : [];
            const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
            totalPoints -= totalPossiblePoints;
          } else {
            // Punctaj normal - doar ce a fost bifat
            totalPoints += answer.score_awarded || 0;
          }
        } else {
          // Pentru alte tipuri de elemente, punctaj normal
          totalPoints += answer.score_awarded || 0;
        }
      }
    }

    return { points: totalPoints, isOverdue };
  }
} 