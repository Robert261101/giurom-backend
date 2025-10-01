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

  async create(createExecutionDto: CreateExecutionDto): Promise<{ execution: TaskExecution; points: number; isOverdue: boolean; message: string }> {
    // Verifică dacă assignment-ul există
    const assignment = await this.taskAssignmentRepository.findOne({ 
      where: { id: createExecutionDto.task_assignment_id } 
    });
    
    if (!assignment) {
      throw new BadRequestException(`Assignment-ul cu ID-ul ${createExecutionDto.task_assignment_id} nu există`);
    }

    // Extrage answers din DTO
    const { answers, ...executionData } = createExecutionDto;
    
    // Setează employee_id cu assigned_to_id din assignment (angajatul căruia i s-a atribuit sarcina)
    executionData.employee_id = assignment.assigned_to_id;
    
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

        // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
        let score_awarded = answerDto.score_awarded || 0;
        
        if (element.element_type === 'scoring_boolean') {
          console.log(`🔍 DEBUG BACKEND scoring_boolean element:`, element.id, element.label)
          console.log(`🔍 DEBUG BACKEND scoring_boolean value:`, answerDto.value)
          console.log(`🔍 DEBUG BACKEND scoring_boolean scoring_options:`, element.scoring_options)
          
          try {
            // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
            const selectedOptions = JSON.parse(answerDto.value || '[]');
            console.log(`🔍 DEBUG BACKEND scoring_boolean parsed options:`, selectedOptions)
            
            if (Array.isArray(selectedOptions)) {
              // Calculează punctajul total din opțiunile selectate
              const scoringOptions = element.scoring_options ? JSON.parse(element.scoring_options) : [
                { name: 'Opțiunea 1', points: 1 },
                { name: 'Opțiunea 2', points: 2 },
                { name: 'Opțiunea 3', points: 3 }
              ];
              console.log(`🔍 DEBUG BACKEND scoring_boolean scoring options:`, scoringOptions)
              
              score_awarded = selectedOptions.reduce((total: number, optionName: string) => {
                const option = scoringOptions.find((opt: any) => opt.name === optionName);
                const points = option ? option.points : 0;
                console.log(`🔍 DEBUG BACKEND scoring_boolean option "${optionName}": ${points} puncte`)
                return total + points;
              }, 0);
              console.log(`🔍 DEBUG BACKEND scoring_boolean total score_awarded:`, score_awarded)
            } else {
              // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
              console.log(`🔍 DEBUG BACKEND scoring_boolean fallback - not array, score_awarded: 0`)
              score_awarded = 0;
            }
          } catch (error) {
            // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
            console.log(`🔍 DEBUG BACKEND scoring_boolean error parsing:`, error.message, `score_awarded: 0`)
            score_awarded = 0;
          }
        } else if (element.element_type === 'scoring_simple') {
          console.log(`🔍 DEBUG BACKEND scoring_simple element:`, element.id, element.label)
          console.log(`🔍 DEBUG BACKEND scoring_simple value:`, answerDto.value)
          console.log(`🔍 DEBUG BACKEND scoring_simple simple_score_points:`, element.simple_score_points)
          
          // Pentru scoring_simple, folosește punctele fixe din element
          // Dacă răspunsul este 'true' sau 'completed', acordă punctele
          if (answerDto.value === 'true' || answerDto.value === 'completed') {
            score_awarded = element.simple_score_points || 0;
            console.log(`🔍 DEBUG BACKEND scoring_simple score_awarded:`, score_awarded)
          } else {
            score_awarded = 0;
            console.log(`🔍 DEBUG BACKEND scoring_simple score_awarded: 0 (value not true/completed)`)
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
    let points = 0;
    let isOverdue = false;
    let message = 'Sarcina a fost finalizată cu succes!';

    if (executionWithRelations.completed_at) {
      // Obține assignment-ul cu elementele pentru calculul punctajului
      const assignmentWithElements = await this.taskAssignmentRepository.findOne({
        where: { id: createExecutionDto.task_assignment_id },
        relations: ['elements', 'elements.task_element']
      });

      if (assignmentWithElements) {
        // Calculează punctajul și verifică dacă este întârziat
        const result = this.calculateTaskPoints(executionWithRelations, assignmentWithElements);
        points = result.points;
        isOverdue = result.isOverdue;

        // Generează mesajul în funcție de situație
        console.log(`🔍 DEBUG BACKEND create - FINAL RESULT: points=${points}, isOverdue=${isOverdue}`);
        
        if (assignmentWithElements.was_postponed === true && points > 0) {
          message = `Sarcina a fost finalizată cu succes! Ai câștigat ${points} puncte.`;
        } else if (isOverdue && points < 0) {
          message = `S-a finalizat sarcina cu succes, dar ai pierdut ${Math.abs(points)} puncte pentru că ai depășit termenul!`;
        } else if (points > 0) {
          message = `Sarcina a fost finalizată cu succes! Ai câștigat ${points} puncte.`;
        } else if (isOverdue && points === 0) {
          message = `S-a finalizat sarcina cu succes, dar ai pierdut puncte pentru că ai depășit termenul!`;
        } else {
          message = 'Sarcina a fost finalizată cu succes!';
        }
      }

      await this.handleTaskCompletion(executionWithRelations);
    }

    return {
      execution: executionWithRelations,
      points,
      isOverdue,
      message
    };
  }

  async findAll(user: any, includeAssignment: boolean = true): Promise<TaskExecution[]> {
    console.log('🔍 [execution.service] findAll - User:', user ? 'EXISTĂ' : 'LIPSEȘTE')
    if (user) {
      console.log('🔍 [execution.service] User ID:', user.sub)
      console.log('🔍 [execution.service] User permissions:', user.permissions)
    }
    
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
      console.log('✅ [execution.service] User are execution.read_all - returnez toate executions')
      const result = await query.getMany();
      console.log('🔍 [execution.service] Rezultat query read_all:', result.length, 'executions')
      return result;
    }

    // execution.read_company - vede după compania din work_location
    if (user?.permissions?.includes('execution.read_company')) {
      console.log('✅ [execution.service] User are execution.read_company - returnez toate executions')
      // TODO: Implementare când avem legătura cu compania
      // Pentru read_company, managerii văd TOATE executions (inclusiv invizibile)
      const result = await query.getMany();
      console.log('🔍 [execution.service] Rezultat query read_company:', result.length, 'executions')
      return result;
    }

    // execution.read_location - vede după work_location
    if (user?.permissions?.includes('execution.read_location')) {
      console.log('✅ [execution.service] User are execution.read_location - returnez toate executions')
      // TODO: Implementare când avem legătura cu work_location
      // Pentru read_location, managerii văd TOATE executions (inclusiv invizibile)
      const result = await query.getMany();
      console.log('🔍 [execution.service] Rezultat query read_location:', result.length, 'executions')
      return result;
    }

    // execution.read_own - vede doar execuțiile lui (employee_id = user.sub)
    if (user?.permissions?.includes('execution.read_own')) {
      console.log('✅ [execution.service] User are execution.read_own - filtrez după employee_id și vizibilitate')
      
      // Dacă are și assignment.create (este manager), poate vedea executions invizibile
      if (user?.permissions?.includes('assignment.create')) {
        console.log('✅ [execution.service] User este manager (are assignment.create) - poate vedea executions invizibile')
        const result = await query.getMany();
        console.log('🔍 [execution.service] Rezultat query read_own (manager):', result.length, 'executions')
        return result;
      } else {
        // Dacă nu este manager, filtrează doar executions vizibile
        console.log('✅ [execution.service] User nu este manager - filtrez doar executions vizibile')
        const result = await query
          .leftJoin('execution.task_assignment', 'assignment')
          .where('execution.employee_id = :userId', { userId: user.sub })
          .andWhere('assignment.is_visible_for_employee = :visible', { visible: true })
          .getMany();
        console.log('🔍 [execution.service] Rezultat query read_own (angajat):', result.length, 'executions')
        return result;
      }
    }

    // Dacă nu are nicio permisiune, returnează array gol
    console.log('❌ [execution.service] User nu are nicio permisiune pentru executions - returnez array gol')
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

          // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
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
          } else if (element.element_type === 'scoring_simple') {
            // Pentru scoring_simple, folosește punctele fixe din element
            // Dacă răspunsul este 'true' sau 'completed', acordă punctele
            if (answerDto.value === 'true' || answerDto.value === 'completed') {
              score_awarded = element.simple_score_points || 0;
            } else {
              score_awarded = 0;
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
    
    // Gestionare puncte zilnice înainte de ștergerea execuției
    await this.handleTaskRemoval(execution);
    
    await this.executionRepository.remove(execution);
  }

  // ===== METODĂ PENTRU GESTIONAREA ȘTERGERII TASK-URILOR CU PUNCTE =====

  private async handleTaskRemoval(execution: TaskExecution): Promise<void> {
    try {
      // Găsește toate punctele zilnice asociate cu această execuție
      const taskPoints = await this.employeeDailyTaskPointsRepository.find({
        where: { task_execution_id: execution.id },
        relations: ['employee_daily_points']
      });

      if (taskPoints.length > 0) {
        console.log(`🔍 DEBUG: Găsite ${taskPoints.length} puncte zilnice pentru execuția ${execution.id}`);

        // Grupează punctele pe daily_points pentru a actualiza totalurile
        const dailyPointsMap = new Map<number, { dailyPoints: EmployeeDailyPoints; pointsToRemove: number }>();

        for (const taskPoint of taskPoints) {
          const dailyPoints = taskPoint.employee_daily_points;
          const dailyPointsId = dailyPoints.id;

          if (!dailyPointsMap.has(dailyPointsId)) {
            dailyPointsMap.set(dailyPointsId, {
              dailyPoints: dailyPoints,
              pointsToRemove: 0
            });
          }

          const entry = dailyPointsMap.get(dailyPointsId)!;
          entry.pointsToRemove += taskPoint.points_awarded;
        }

        // Actualizează totalurile pentru fiecare daily_points
        for (const [dailyPointsId, { dailyPoints, pointsToRemove }] of dailyPointsMap) {
          dailyPoints.total_points = Math.max(0, dailyPoints.total_points - pointsToRemove);
          await this.employeeDailyPointsRepository.save(dailyPoints);
          
          console.log(`✅ DEBUG: Scăzut ${pointsToRemove} puncte din daily_points ${dailyPointsId}, total acum: ${dailyPoints.total_points}`);
        }

        // Șterge toate punctele zilnice pentru această execuție
        await this.employeeDailyTaskPointsRepository.delete({ task_execution_id: execution.id });
        console.log(`✅ DEBUG: Șterse ${taskPoints.length} înregistrări de puncte zilnice pentru execuția ${execution.id}`);
      }
    } catch (error) {
      console.error(`❌ Eroare la gestionarea ștergerii punctelor pentru execuția ${execution.id}:`, error);
      // Nu aruncăm eroarea pentru a nu bloca ștergerea execuției
    }
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
        console.log(`✅ Punctaj ${action} pentru execuția ${execution.id}: ${totalPoints} puncte pentru angajatul ${execution.employee_id} în data ${workDate.toISOString().split('T')[0]}${isOverdue ? ' (DUPĂ DEADLINE)' : ''}`);
      } else {
        console.log(`ℹ️ Punctajul pentru execuția ${execution.id} există deja - nu se salvează din nou`);
      }
    } catch (error) {
      console.error('❌ Eroare la procesarea finalizării task-ului cu puncte:', error);
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
    const finalizedInElement = assignment.elements?.find(el => el.task_element.element_type === 'finalized_in');
    const allowPostponeElement = assignment.elements?.find(el => el.task_element.element_type === 'allow_postpone');
    
    // Verifică dacă există "permite amânarea" - dacă da, anulează efectul deadline-ului
    const hasAllowPostpone = allowPostponeElement && allowPostponeElement.value === 'true';
    
    // Verifică dacă task-ul a fost amânat
    const wasPostponed = assignment.was_postponed === true;
    
    console.log(`🔍 DEBUG calculateTaskPoints - hasAllowPostpone: ${hasAllowPostpone}, wasPostponed: ${wasPostponed}`);
    console.log(`🔍 DEBUG calculateTaskPoints - deadlineElement: ${deadlineElement ? 'found' : 'not found'}, finalizedInElement: ${finalizedInElement ? 'found' : 'not found'}`);
    console.log(`🔍 DEBUG calculateTaskPoints - execution.completed_at: ${execution.completed_at}`);
    
    if ((deadlineElement || finalizedInElement) && execution.completed_at) {
      let deadline: Date | null = null;
      
      // Verifică dacă există finish_at (deadline fix)
      if (deadlineElement && deadlineElement.value && deadlineElement.value.trim() !== '') {
        deadline = new Date(deadlineElement.value.trim());
        console.log(`🔍 DEBUG Task ${execution.id} - finish_at deadline:`, deadlineElement.value);
      }
      // Altfel, verifică dacă există finalized_in (deadline calculat)
      else if (finalizedInElement && finalizedInElement.value && finalizedInElement.value.trim() !== '') {
        try {
          const durationData = JSON.parse(finalizedInElement.value.trim());
          const hours = durationData.hours || 0;
          const minutes = durationData.minutes || 0;
          
          // Calculează deadline-ul bazat pe assigned_at + durata
          deadline = new Date(assignment.assigned_at);
          deadline.setHours(deadline.getHours() + hours);
          deadline.setMinutes(deadline.getMinutes() + minutes);
          
          console.log(`🔍 DEBUG Task ${execution.id} - finalized_in duration:`, { hours, minutes });
          console.log(`🔍 DEBUG Task ${execution.id} - assigned_at:`, assignment.assigned_at);
          console.log(`🔍 DEBUG Task ${execution.id} - calculated deadline:`, deadline.toISOString());
        } catch (e) {
          console.log(`   ❌ Eroare la parsarea finalized_in:`, e);
          deadline = null;
        }
      }
      
      if (deadline && !isNaN(deadline.getTime())) {
        const completionTime = new Date(execution.completed_at);
        
        // Verifică dacă data de finalizare este validă
        if (!isNaN(completionTime.getTime())) {
          isOverdue = completionTime > deadline;
          console.log(`   📅 Deadline: ${deadline.toISOString()}`);
          console.log(`   ✅ Finalizat: ${completionTime.toISOString()}`);
          console.log(`   ⏰ Este întârziat: ${isOverdue}`);
        } else {
          console.log(`   ❌ Data de finalizare invalidă: ${execution.completed_at}`);
          isOverdue = false;
        }
      } else {
        console.log(`   ℹ️ Nu există deadline valid setat`);
        isOverdue = false; // Nu este întârziat dacă nu există deadline
      }
    } else if (wasPostponed) {
      console.log(`   🕐 Task-ul a fost amânat - deadline-ul este anulat`);
      isOverdue = false; // Nu este întârziat dacă a fost amânat
    }

    // Găsește toate elementele cu puncte din assignment (scoring_boolean și scoring_simple)
    const scoringElements = assignment.elements?.filter(el => 
      el.task_element.element_type === 'scoring_boolean' || 
      el.task_element.element_type === 'scoring_simple'
    ) || [];
    
    // Verifică dacă toate elementele cu puncte au fost completate
    const completedScoringElements = scoringElements.filter(element => {
      const answer = execution.answers?.find(a => a.task_element_id === element.task_element_id);
      return answer && answer.score_awarded > 0;
    });

    console.log(`🔍 DEBUG Scoring Elements: ${scoringElements.length} total, ${completedScoringElements.length} completate`);

    // Calculează punctajul pentru fiecare element cu puncte
    console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoringElements count:`, scoringElements.length)
    console.log(`🔍 DEBUG BACKEND calculateTaskPoints - wasPostponed:`, wasPostponed)
    
    for (const element of scoringElements) {
      console.log(`🔍 DEBUG BACKEND calculateTaskPoints - processing element:`, element.task_element.element_type, element.task_element.id)
      const answer = execution.answers?.find(a => a.task_element_id === element.task_element_id);
      console.log(`🔍 DEBUG BACKEND calculateTaskPoints - found answer:`, answer ? `score_awarded: ${answer.score_awarded}` : 'NO ANSWER')
      
      if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options ? JSON.parse(element.task_element.scoring_options) : [];
        
        if (answer && answer.score_awarded > 0) {
          // Elementul a fost completat - adaugă punctele câștigate
          if (wasPostponed) {
            // Dacă task-ul a fost amânat, acordă punctele maxime pentru amânare
            const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
            totalPoints += totalPossiblePoints;
            console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_boolean postponed, awarding max points:`, totalPossiblePoints);
          } else if (isOverdue) {
            // Dacă este finalizat după deadline, scade punctele din toate opțiunile
            const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
            totalPoints -= totalPossiblePoints;
          } else {
            // Punctaj normal - doar ce a fost bifat
            totalPoints += answer.score_awarded || 0;
          }
        }
        // Nu mai scădem punctele dacă nu este completat - scoring_boolean funcționează ca scoring_simple
      } else if (element.task_element.element_type === 'scoring_simple') {
        const simpleScorePoints = element.task_element.simple_score_points || 0;
        console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple simple_score_points:`, simpleScorePoints)
        
        if (answer && answer.score_awarded > 0) {
          console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple answer score_awarded:`, answer.score_awarded)
          // Elementul a fost completat - adaugă punctele fixe
          if (wasPostponed) {
            // Dacă task-ul a fost amânat, acordă punctele maxime pentru amânare
            console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple postponed, awarding max points:`, simpleScorePoints)
            totalPoints += simpleScorePoints;
          } else if (isOverdue) {
            // Dacă este finalizat după deadline, scade punctele fixe
            console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple overdue, subtracting:`, simpleScorePoints)
            totalPoints -= simpleScorePoints;
          } else {
            // Punctaj normal - punctele fixe
            console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple normal, adding:`, simpleScorePoints)
            totalPoints += simpleScorePoints;
          }
        } else {
          console.log(`🔍 DEBUG BACKEND calculateTaskPoints - scoring_simple no answer or score_awarded = 0`)
        }
        // Nu mai scădem punctele dacă nu este completat - scoring_simple este întotdeauna bifat
      }
    }

    // Calculează punctajul pentru elementele non-scoring
    for (const answer of execution.answers) {
      const assignmentElement = assignment.elements?.find(el => el.task_element_id === answer.task_element_id);
      if (!assignmentElement) continue;

      const taskElement = assignmentElement.task_element;
      if (taskElement.element_type !== 'scoring_boolean' && taskElement.element_type !== 'scoring_simple') {
        // Pentru alte tipuri de elemente, punctaj normal
        totalPoints += answer.score_awarded || 0;
      }
    }

    console.log(`🔍 DEBUG BACKEND calculateTaskPoints - FINAL totalPoints:`, totalPoints, `isOverdue:`, isOverdue)
    return { points: totalPoints, isOverdue };
  }
} 