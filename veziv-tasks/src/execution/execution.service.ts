import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, defaultIfEmpty } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { ManagerDailyPayout } from './entity/manager-daily-payout.entity';
import {
  TaskAssignment,
  AssignmentStatus,
} from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { CreateEmployeeDailyPointsDto } from './dto/create-employee-daily-points.dto';
import { CreateEmployeeDailyTaskPointsDto } from './dto/create-employee-daily-task-points.dto';
import { EmployeeAccessService } from '../employee-access/employee-access.service';
import type { EmployeeAccessUser } from '../employee-access/employee-access';
import { isOperationalStaffUser } from '../employee-access/employee-access';
import {
  getCanonicalEmployeeId,
  isFurnizorSupplierAdmin,
} from '../employee-access/employee-access';

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
    @InjectRepository(ManagerDailyPayout)
    private managerDailyPayoutRepository: Repository<ManagerDailyPayout>,
    private httpService: HttpService,
    private employeeAccessService: EmployeeAccessService,
    @Inject('NOTIFICATIONS_RMQ')
    private readonly notificationsClient: ClientProxy,
  ) {}

  private async getEmployeeDisplayName(employeeId?: number | null): Promise<string> {
    if (!employeeId) return 'Un angajat';
    try {
      const response = await this.httpService.axiosRef.get(
        `http://giurom.bitap.ro:3002/employees/${employeeId}`,
        {
          timeout: 5000,
          headers: {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret':
              process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json',
          },
        },
      );
      const data = response?.data?.data ?? response?.data ?? {};
      const firstName = String(data?.first_name ?? '').trim();
      const lastName = String(data?.last_name ?? '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || `Angajat #${employeeId}`;
    } catch {
      return `Angajat #${employeeId}`;
    }
  }

  private async sendExecutionNotification(
    type: string,
    title: string,
    description: string,
    executionId: number,
    metadata?: any,
    work_location_id?: number,
  ): Promise<void> {
    try {
      const payload = {
        type,
        title,
        description,
        entity_id: executionId,
        entity_type: 'task_execution',
        metadata: { ...(metadata ?? {}), ...(work_location_id != null ? { work_location_id } : {}) },
        priority: 'medium',
        target_url: `/sarcini/${metadata?.task_assignment_id ?? ''}`,
      };
      await firstValueFrom(
        this.notificationsClient
          .emit({ cmd: 'tasks.notification' }, payload)
          .pipe(defaultIfEmpty(undefined)),
      );
    } catch (error) {
      console.error('Failed to send execution notification:', error);
    }
  }

  async create(
    createExecutionDto: CreateExecutionDto,
    user?: EmployeeAccessUser,
  ): Promise<{
    execution: TaskExecution;
    points: number;
    isOverdue: boolean;
    message: string;
  }> {
    // Verifică dacă assignment-ul există
    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id: createExecutionDto.task_assignment_id },
    });

    if (!assignment) {
      throw new BadRequestException(
        `Assignment-ul cu ID-ul ${createExecutionDto.task_assignment_id} nu există`,
      );
    }

    if (assignment.status === AssignmentStatus.DEACTIVATED) {
      throw new BadRequestException('Sarcina este anulată');
    }

    if (user) {
      const selfId = getCanonicalEmployeeId(user);
      if (isOperationalStaffUser(user)) {
        this.employeeAccessService.assertIsAssignmentParticipant(
          user,
          assignment,
        );
        if (
          createExecutionDto.employee_id != null &&
          selfId != null &&
          Number(createExecutionDto.employee_id) !== Number(selfId)
        ) {
          throw new ForbiddenException(
            'Nu poți confirma în numele altui participant',
          );
        }
      }
    }

    // Extrage answers din DTO
    const { answers, ...executionData } = createExecutionDto;

    // Reload assignment with template to capture template/assignment name
    const assignmentWithTemplate = await this.taskAssignmentRepository.findOne({
      where: { id: assignment.id },
      relations: ['template'],
    });

    // Setează employee_id din JWT pentru operațional, altfel din assignment
    const selfId = user ? getCanonicalEmployeeId(user) : null;
    executionData.employee_id =
      isOperationalStaffUser(user) && selfId != null
        ? selfId
        : assignment.assigned_to_id;

    // Păstrează numele task-ului (template_name) în execuție pentru consistență istorică
    if (assignmentWithTemplate?.template?.template_name) {
      (executionData as any).assignment_name =
        assignmentWithTemplate.template.template_name;
    } else if ((assignment as any).template?.template_name) {
      (executionData as any).assignment_name = (
        assignment as any
      ).template.template_name;
    }

    // Setează location_id din assignment (obligatoriu pentru Employee_Daily_Points; inclusiv la sarcinile reatribuite)
    if (assignment.location_id != null && assignment.location_id !== undefined) {
      (executionData as any).location_id = assignment.location_id;
    }

    // Creează execuția
    const execution = this.executionRepository.create(executionData);
    const savedExecution = await this.executionRepository.save(execution);

    // Creează answers dacă sunt specificate
    console.log(
      `[ExecutionService.create] Creating execution ${savedExecution.id} with ${answers?.length || 0} answers`,
    );
    if (answers && answers.length > 0) {
      for (const answerDto of answers) {
        console.log(
          `[ExecutionService.create] Processing answer for element ${answerDto.task_element_id} with value:`,
          answerDto.value,
        );

        // Verifică dacă elementul există
        const element = await this.taskElementRepository.findOne({
          where: { id: answerDto.task_element_id },
        });

        if (!element) {
          console.error(
            `[ExecutionService.create] Element ${answerDto.task_element_id} not found`,
          );
          throw new BadRequestException(
            `Elementul cu ID-ul ${answerDto.task_element_id} nu există`,
          );
        }

        // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
        let score_awarded = answerDto.score_awarded || 0;

        if (element.element_type === 'scoring_boolean') {
          try {
            // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
            const selectedOptions = JSON.parse(answerDto.value || '[]');

            if (Array.isArray(selectedOptions)) {
              // Calculează punctajul total din opțiunile selectate
              const scoringOptions = element.scoring_options
                ? JSON.parse(element.scoring_options)
                : [
                    { name: 'Opțiunea 1', points: 1 },
                    { name: 'Opțiunea 2', points: 2 },
                    { name: 'Opțiunea 3', points: 3 },
                  ];

              score_awarded = selectedOptions.reduce(
                (total: number, optionName: string) => {
                  const option = scoringOptions.find(
                    (opt: any) => opt.name === optionName,
                  );
                  const points = option ? option.points : 0;
                  return total + points;
                },
                0,
              );
            } else {
              // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
              score_awarded = 0;
            }
          } catch (error) {
            // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
            score_awarded = 0;
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
          task_execution_id: savedExecution.id,
          score_awarded: score_awarded,
        });
        const savedAnswer = await this.answerRepository.save(answer);
        console.log(
          `[ExecutionService.create] Saved answer ${savedAnswer.id} for element ${answerDto.task_element_id} with value:`,
          answerDto.value,
        );
      }
      console.log(
        `[ExecutionService.create] Saved ${answers.length} answers for execution ${savedExecution.id}`,
      );
    } else {
      console.log(
        `[ExecutionService.create] No answers to save for execution ${savedExecution.id}`,
      );
    }

    // Returnează execuția cu relațiile
    const executionWithRelations = await this.findOne(savedExecution.id);

    // Dacă execuția este finalizată (completed_at este setat), verifică dacă are elemente cu puncte
    let points = 0;
    let isOverdue = false;
    let message = 'Sarcina a fost finalizată cu succes!';

    if (executionWithRelations.completed_at) {
      // Obține assignment-ul cu elementele pentru calculul punctajului
      const assignmentWithElements =
        await this.taskAssignmentRepository.findOne({
          where: { id: createExecutionDto.task_assignment_id },
          relations: ['elements', 'elements.task_element'],
        });

      if (assignmentWithElements) {
        // Calculează punctajul și verifică dacă este întârziat
        const result = this.calculateTaskPoints(
          executionWithRelations,
          assignmentWithElements,
        );
        points = result.points;
        isOverdue = result.isOverdue;

        // Generează mesajul în funcție de situație

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

        // Actualizează status-ul assignment-ului

        if (assignmentWithElements.requires_manager_check) {
          // Dacă are requires_manager_check, schimbă status-ul în waiting_response
          assignmentWithElements.status = AssignmentStatus.WAITING_RESPONSE;
        } else {
          // Dacă nu are requires_manager_check, schimbă status-ul în completed
          assignmentWithElements.status = AssignmentStatus.COMPLETED;
          assignmentWithElements.completed_at = new Date();
        }

        await this.taskAssignmentRepository.save(assignmentWithElements);
      }

      await this.handleTaskCompletion(executionWithRelations);
    }

    const locId = (assignment as any).location_id ?? undefined;
    const taskName =
      (assignmentWithTemplate as any)?.template?.template_name ||
      (executionWithRelations as any)?.assignment_name ||
      `Task #${executionWithRelations.task_assignment_id}`;
    const employeeName = await this.getEmployeeDisplayName(
      executionWithRelations.employee_id ?? assignment.assigned_to_id,
    );
    await this.sendExecutionNotification(
      'execution.created',
      'Execuție creată',
      `${employeeName} a finalizat task-ul "${taskName}"${points > 0 ? ` și a obținut ${points} puncte` : ''}.`,
      executionWithRelations.id,
      {
        assignmentId: executionWithRelations.task_assignment_id,
        assignedToId: executionWithRelations.employee_id ?? assignment.assigned_to_id,
        employeeName,
        taskName,
        points,
        isOverdue,
      },
      locId,
    );

    return {
      execution: executionWithRelations,
      points,
      isOverdue,
      message,
    };
  }

  async findAll(
    user: any,
    includeAssignment: boolean = true,
    locationId?: number,
    startDate?: Date,
    endDate?: Date,
    assignmentId?: number,
    authorization?: string,
  ): Promise<TaskExecution[]> {
    const query = this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .leftJoinAndSelect('answers.task_element', 'answer_task_element')
      .orderBy('execution.created_at', 'DESC');

    if (includeAssignment) {
      query
        .leftJoinAndSelect('execution.task_assignment', 'task_assignment')
        .leftJoinAndSelect('task_assignment.template', 'template')
        .leftJoinAndSelect('task_assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'element_task_element');
    } else {
      // Adaugă join simplu (fără select) pentru a putea accesa câmpurile din assignment pentru filtrare
      query.leftJoin('execution.task_assignment', 'task_assignment');
    }

    // Aplică filtrul după location_id dacă este furnizat
    if (locationId !== undefined) {
      query.andWhere('execution.location_id = :locationId', { locationId });
    }

    // Aplică filtrul după assignment_id dacă este furnizat
    if (assignmentId !== undefined) {
      query.andWhere('execution.task_assignment_id = :assignmentId', {
        assignmentId,
      });
      console.log(
        `🔍 [execution.service] Filtering by assignment_id: ${assignmentId}`,
      );
    }

    // Aplică filtrul după dată dacă este furnizat
    // Pentru executions, folosim completed_at sau data din assignment (scheduled_datetime sau assigned_at)
    // Similar cu assignments - pentru sarcini programate folosim scheduled_datetime, pentru restul assigned_at
    if (startDate && endDate) {
      // Formatează datele ca string-uri YYYY-MM-DD pentru comparație corectă
      const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      console.log('📅 [execution.service] Date filter:', {
        startDate: sdStr,
        endDate: edStr,
        startDateObj: startDate.toISOString(),
        endDateObj: endDate.toISOString(),
      });

      // Filtrează după completed_at (data când a fost finalizată execuția) SAU data din assignment
      // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
      // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
      query.andWhere(
        `(execution.completed_at IS NOT NULL AND DATE(execution.completed_at) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NOT NULL AND DATE(task_assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NULL AND DATE(task_assignment.assigned_at) BETWEEN :sdStr AND :edStr) OR (JSON_UNQUOTE(JSON_EXTRACT(task_assignment.recurrence_settings, '$.enabled')) = 'true' AND task_assignment.parent_recurrence_id IS NULL)`,
        { sdStr, edStr },
      );
    }

    // Filtrare OBLIGATORIE - afișează DOAR executions cu location_id setat
    query.andWhere('execution.location_id IS NOT NULL');

    // Furnizor: numai execuțiile staff-ului propriu (înainte de read_all)
    if (isFurnizorSupplierAdmin(user)) {
      const staffIds =
        await this.employeeAccessService.fetchSupplierStaffEmployeeIds(
          authorization,
        );
      if (staffIds.length === 0) {
        return [];
      }
      query.andWhere('execution.employee_id IN (:...staffIds)', { staffIds });
      if (startDate && endDate) {
        const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        query.andWhere(
          `(execution.completed_at IS NOT NULL AND DATE(execution.completed_at) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NOT NULL AND DATE(task_assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NULL AND DATE(task_assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
          { sdStr, edStr },
        );
      }
      return query.getMany();
    }

    // execution.read_all - vede toate
    if (user?.permissions?.includes('execution.read_all')) {
      // Dacă are și assignment.create (este manager), aplică limitare implicită dacă nu se trimit date
      if (
        user?.permissions?.includes('assignment.create') &&
        !startDate &&
        !endDate
      ) {
        // Limită implicită: ultimele 30 de zile pentru performanță
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const sdStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
        console.log(
          '📅 [execution.service] No date filter provided, using default: last 30 days',
          {
            startDate: sdStr,
          },
        );
        // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
        query.andWhere(
          `(execution.completed_at IS NOT NULL AND DATE(execution.completed_at) >= :sdStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NOT NULL AND DATE(task_assignment.scheduled_datetime) >= :sdStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NULL AND DATE(task_assignment.assigned_at) >= :sdStr) OR (JSON_UNQUOTE(JSON_EXTRACT(task_assignment.recurrence_settings, '$.enabled')) = 'true' AND task_assignment.parent_recurrence_id IS NULL)`,
          { sdStr },
        );
      }
      const result = await query.getMany();
      return result;
    }

    // execution.read_company - vede după compania din work_location
    if (user?.permissions?.includes('execution.read_company')) {
      // TODO: Implementare când avem legătura cu compania
      // Pentru read_company, managerii văd TOATE executions (inclusiv invizibile)
      const result = await query.getMany();
      return result;
    }

    // Extrage employee_id din user - poate fi în sub, employeeId sau employee_id
    const userEmployeeId = user?.employeeId || user?.employee_id || user?.sub;
    
    console.log('🔍 [execution.findAll] User info:', {
      sub: user?.sub,
      employeeId: user?.employeeId,
      employee_id: user?.employee_id,
      resolvedEmployeeId: userEmployeeId,
      permissions: user?.permissions,
      hasAssignmentCreate: user?.permissions?.includes('assignment.create'),
    });

    // execution.read_location - vede după work_location
    if (user?.permissions?.includes('execution.read_location')) {
      // Verifică dacă este manager (are assignment.create) - vede TOATE executions
      if (user?.permissions?.includes('assignment.create')) {
        console.log('🔍 [execution.findAll] Manager cu read_location - returnează toate execuțiile');
        const result = await query.getMany();
        return result;
      }
      // Dacă NU este manager, vede STRICT doar execuțiile proprii
      // Construim un nou query pentru a ne asigura că filtrul de employee_id este aplicat corect
      console.log(`🔍 [execution.findAll] Angajat cu read_location - filtrează pentru employee_id=${userEmployeeId}`);
      
      const employeeQuery = this.executionRepository
        .createQueryBuilder('execution')
        .leftJoinAndSelect('execution.answers', 'answers')
        .leftJoinAndSelect('answers.task_element', 'answer_task_element')
        .leftJoinAndSelect('execution.task_assignment', 'task_assignment')
        .leftJoinAndSelect('task_assignment.template', 'template')
        .leftJoinAndSelect('task_assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'element_task_element')
        .where('execution.employee_id = :userId', { userId: userEmployeeId })
        .andWhere('task_assignment.is_visible_for_employee = :visible', { visible: true })
        .andWhere('execution.location_id IS NOT NULL')
        .orderBy('execution.created_at', 'DESC');
      
      // Aplică filtrul de locație dacă există
      if (locationId !== undefined) {
        employeeQuery.andWhere('execution.location_id = :locationId', { locationId });
      }
      
      // Aplică filtrul de dată dacă există
      if (startDate && endDate) {
        const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        employeeQuery.andWhere(
          `(execution.completed_at IS NOT NULL AND DATE(execution.completed_at) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NOT NULL AND DATE(task_assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NULL AND DATE(task_assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
          { sdStr, edStr },
        );
      }
      
      const result = await employeeQuery.getMany();
      console.log(`🔍 [execution.findAll] Găsite ${result.length} execuții pentru angajat (employee_id=${userEmployeeId})`);
      return result;
    }

    // execution.read_own — sau cont operațional (magazioner/șofer)
    if (
      user?.permissions?.includes('execution.read_own') ||
      isOperationalStaffUser(user)
    ) {
      // Dacă are și assignment.create (este manager), poate vedea TOATE executions
      if (user?.permissions?.includes('assignment.create')) {
        console.log('🔍 [execution.findAll] Manager cu read_own - returnează toate execuțiile');
        const result = await query.getMany();
        return result;
      } else {
        // Dacă nu este manager, filtrează STRICT doar executions proprii
        // IMPORTANT: Folosim where în loc de andWhere pentru a reseta condițiile anterioare
        // și a ne asigura că filtrul de employee_id este aplicat corect
        console.log(`🔍 [execution.findAll] Angajat cu read_own - filtrează pentru employee_id=${userEmployeeId}`);
        
        // Construim un nou query pentru angajați - doar execuțiile lor
        const employeeQuery = this.executionRepository
          .createQueryBuilder('execution')
          .leftJoinAndSelect('execution.answers', 'answers')
          .leftJoinAndSelect('answers.task_element', 'answer_task_element')
          .leftJoinAndSelect('execution.task_assignment', 'task_assignment')
          .leftJoinAndSelect('task_assignment.template', 'template')
          .leftJoinAndSelect('task_assignment.elements', 'elements')
          .leftJoinAndSelect('elements.task_element', 'element_task_element')
          .where('execution.employee_id = :userId', { userId: userEmployeeId })
          .andWhere('task_assignment.is_visible_for_employee = :visible', { visible: true })
          .andWhere('execution.location_id IS NOT NULL')
          .orderBy('execution.created_at', 'DESC');
        
        // Aplică filtrul de locație dacă există
        if (locationId !== undefined) {
          employeeQuery.andWhere('execution.location_id = :locationId', { locationId });
        }
        
        // Aplică filtrul de dată dacă există
        if (startDate && endDate) {
          const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          employeeQuery.andWhere(
            `(execution.completed_at IS NOT NULL AND DATE(execution.completed_at) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NOT NULL AND DATE(task_assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (execution.completed_at IS NULL AND task_assignment.scheduled_datetime IS NULL AND DATE(task_assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
            { sdStr, edStr },
          );
        }
        
        const result = await employeeQuery.getMany();
        console.log(`🔍 [execution.findAll] Găsite ${result.length} execuții pentru angajat (employee_id=${userEmployeeId})`);
        return result;
      }
    }

    // Dacă nu are nicio permisiune, returnează array gol
    return [];
  }

  async findOne(id: number): Promise<TaskExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id },
      relations: [
        'task_assignment',
        'task_assignment.template',
        'task_assignment.elements',
        'task_assignment.elements.task_element',
        'answers',
        'answers.task_element',
      ],
    });

    if (!execution) {
      throw new NotFoundException(`Execuția cu ID ${id} nu a fost găsită`);
    }

    return execution;
  }

  /**
   * OPTIMIZAT: Batch load executions pentru multiple assignments dintr-o dată
   * Elimină problema N+1 prin un singur query cu WHERE IN
   * Folosește indexuri pentru performanță maximă
   */
  async getExecutionsByAssignmentsBatch(
    assignmentIds: number[],
  ): Promise<TaskExecution[]> {
    if (!assignmentIds || assignmentIds.length === 0) {
      return [];
    }

    console.log(
      `🚀 [BATCH EXECUTIONS] Loading executions for ${assignmentIds.length} assignments`,
    );

    // OPTIMIZAT: Folosește select explicit pentru a reduce overhead-ul
    const executions = await this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .leftJoinAndSelect('answers.task_element', 'task_element')
      .where('execution.task_assignment_id IN (:...assignmentIds)', {
        assignmentIds,
      })
      .orderBy('execution.created_at', 'DESC')
      .cache(false) // Dezactivează cache pentru date fresh
      .getMany();

    console.log(`✅ [BATCH EXECUTIONS] Loaded ${executions.length} executions`);
    return executions;
  }

  async getExecutionByAssignment(
    assignmentId: number,
  ): Promise<TaskExecution | null> {
    // Găsește execuția cea mai recentă cu răspunsuri (dacă există), altfel cea mai recentă
    console.log(
      `[ExecutionService.getExecutionByAssignment] Looking for executions for assignment ${assignmentId}`,
    );
    const executions = await this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .leftJoinAndSelect('answers.task_element', 'task_element')
      .where('execution.task_assignment_id = :assignmentId', { assignmentId })
      .orderBy('execution.created_at', 'DESC')
      .getMany();

    if (!executions || executions.length === 0) {
      return null;
    }

    // Log pentru debugging
    console.log(
      `[ExecutionService] Found ${executions.length} executions for assignment ${assignmentId}`,
    );
    executions.forEach((exec, index) => {
      console.log(
        `[ExecutionService] Execution ${index + 1}: ID=${exec.id}, created_at=${exec.created_at}, answers count=${exec.answers?.length || 0}`,
      );
    });

    // Verificare suplimentară: caută toate răspunsurile care ar putea fi asociate cu assignment-ul
    // prin verificarea task_element_id-urilor din template-ul assignment-ului
    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'template.elements'],
    });

    if (assignment && assignment.template && assignment.template.elements) {
      const templateElementIds = assignment.template.elements.map(
        (el) => el.id,
      );
      console.log(
        `[ExecutionService] Assignment ${assignmentId} has template with ${templateElementIds.length} elements: ${templateElementIds.join(', ')}`,
      );

      // Caută răspunsuri care au task_element_id din template-ul assignment-ului
      const allAnswersForTemplate = await this.answerRepository.find({
        where: { task_element_id: In(templateElementIds) },
        relations: ['task_element'],
      });
      console.log(
        `[ExecutionService] Found ${allAnswersForTemplate.length} total answers for template elements`,
      );

      // Grupează răspunsurile după task_execution_id
      const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
      allAnswersForTemplate.forEach((answer) => {
        if (!answersByExecution.has(answer.task_execution_id)) {
          answersByExecution.set(answer.task_execution_id, []);
        }
        answersByExecution.get(answer.task_execution_id)!.push(answer);
      });

      console.log(
        `[ExecutionService] Answers grouped by execution: ${Array.from(answersByExecution.keys()).join(', ')}`,
      );

      // Verifică dacă există răspunsuri pentru execuții care nu sunt în lista de execuții găsite
      for (const [execId, answers] of answersByExecution.entries()) {
        const exec = executions.find((e) => e.id === execId);
        if (!exec) {
          console.log(
            `[ExecutionService] WARNING: Found ${answers.length} answers for execution ${execId} which is not in the executions list for assignment ${assignmentId}`,
          );

          // Verifică dacă execuția există și pentru ce assignment este
          const missingExecution = await this.executionRepository.findOne({
            where: { id: execId },
            relations: ['task_assignment'],
          });

          if (missingExecution) {
            console.log(
              `[ExecutionService] Execution ${execId} belongs to assignment ${missingExecution.task_assignment_id}, not ${assignmentId}`,
            );

            // Dacă execuția are răspunsuri și este pentru un assignment diferit, verifică dacă ar trebui să fie inclusă
            // (poate există o problemă cu datele sau cu logica de căutare)
            if (missingExecution.task_assignment_id !== assignmentId) {
              console.log(
                `[ExecutionService] Execution ${execId} is for assignment ${missingExecution.task_assignment_id}, but we're looking for assignment ${assignmentId}`,
              );
            }
          }
        } else {
          // Dacă execuția este în listă dar nu are răspunsuri încărcate, încarcă-le
          if (!exec.answers || exec.answers.length === 0) {
            exec.answers = answers;
            console.log(
              `[ExecutionService] Loaded ${answers.length} answers for execution ${exec.id} from template elements search`,
            );
          }
        }
      }
    }

    // Verifică manual dacă există răspunsuri pentru fiecare execuție
    for (const exec of executions) {
      // Verifică dacă există răspunsuri direct în DB pentru această execuție
      const answersCount = await this.answerRepository.count({
        where: { task_execution_id: exec.id },
      });
      console.log(
        `[ExecutionService] Execution ${exec.id} has ${answersCount} answers in DB (direct count)`,
      );

      // Verifică și prin query pentru a vedea dacă există răspunsuri
      const answersFromDB = await this.answerRepository.find({
        where: { task_execution_id: exec.id },
        relations: ['task_element'],
      });
      console.log(
        `[ExecutionService] Execution ${exec.id} has ${answersFromDB.length} answers from find query`,
      );

      // Dacă există răspunsuri în DB dar nu sunt încărcate, încarcă-le
      if (answersFromDB.length > 0) {
        exec.answers = answersFromDB;
        console.log(
          `[ExecutionService] Loaded ${answersFromDB.length} answers for execution ${exec.id}`,
        );
      } else if (!exec.answers || exec.answers.length === 0) {
        // Dacă nu există răspunsuri, setează array gol explicit
        exec.answers = [];
      }
    }

    // Găsește prima execuție care are răspunsuri (verifică și după încărcare manuală)
    let executionWithAnswers = executions.find(
      (exec) => exec.answers && exec.answers.length > 0,
    );

    // Dacă nu s-a găsit execuție cu răspunsuri în lista inițială, verifică dacă există răspunsuri
    // pentru execuții care nu sunt în listă (poate există o problemă cu task_assignment_id)
    if (
      !executionWithAnswers &&
      assignment &&
      assignment.template &&
      assignment.template.elements
    ) {
      const templateElementIds = assignment.template.elements.map(
        (el) => el.id,
      );

      // Caută toate execuțiile care au răspunsuri pentru elementele din template
      const allAnswersForTemplate = await this.answerRepository.find({
        where: { task_element_id: In(templateElementIds) },
        relations: ['task_element', 'task_execution'],
      });

      // Grupează răspunsurile după task_execution_id
      const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
      allAnswersForTemplate.forEach((answer) => {
        if (!answersByExecution.has(answer.task_execution_id)) {
          answersByExecution.set(answer.task_execution_id, []);
        }
        answersByExecution.get(answer.task_execution_id)!.push(answer);
      });

      // Verifică dacă există o execuție cu răspunsuri care nu este în lista inițială
      // Sortează execuțiile după data creării (cea mai recentă primul)
      const executionsWithAnswersArray = Array.from(
        answersByExecution.entries(),
      )
        .map(([execId, answers]) => ({
          execId,
          answers,
          count: answers.length,
        }))
        .sort((a, b) => b.count - a.count); // Sortează după numărul de răspunsuri

      for (const { execId, answers } of executionsWithAnswersArray) {
        const exec = executions.find((e) => e.id === execId);
        if (!exec && answers.length > 0) {
          // Găsește execuția din DB
          const foundExecution = await this.executionRepository.findOne({
            where: { id: execId },
            relations: ['task_assignment'],
          });

          if (foundExecution) {
            console.log(
              `[ExecutionService] Found execution ${execId} with ${answers.length} answers, but it belongs to assignment ${foundExecution.task_assignment_id} (not ${assignmentId})`,
            );

            // Dacă execuția este pentru assignment-ul curent, o adaugă în listă
            if (foundExecution.task_assignment_id === assignmentId) {
              foundExecution.answers = answers;
              executions.push(foundExecution);
              executionWithAnswers = foundExecution;
              console.log(
                `[ExecutionService] Added execution ${execId} to the list with ${answers.length} answers`,
              );
              break;
            } else {
              // Dacă execuția nu este pentru assignment-ul curent, dar are răspunsuri pentru elementele din template,
              // verifică dacă ar trebui să fie asociată cu assignment-ul curent (poate există o problemă cu datele)
              console.log(
                `[ExecutionService] Execution ${execId} has ${answers.length} answers but is for assignment ${foundExecution.task_assignment_id}, not ${assignmentId}`,
              );
            }
          }
        }
      }
    }

    // Dacă există execuție cu răspunsuri, o returnează, altfel returnează cea mai recentă
    const result = executionWithAnswers || executions[0];

    // Verificare finală: dacă execuția returnată nu are răspunsuri, verifică din nou în DB
    if (result && (!result.answers || result.answers.length === 0)) {
      const finalAnswersCount = await this.answerRepository.count({
        where: { task_execution_id: result.id },
      });
      console.log(
        `[ExecutionService] Final check: execution ${result.id} has ${finalAnswersCount} answers in DB`,
      );

      if (finalAnswersCount > 0) {
        const answers = await this.answerRepository.find({
          where: { task_execution_id: result.id },
          relations: ['task_element'],
        });
        result.answers = answers;
        console.log(
          `[ExecutionService] Final check: loaded ${answers.length} answers for execution ${result.id}`,
        );
      } else if (
        assignment &&
        assignment.template &&
        assignment.template.elements
      ) {
        // Dacă execuția returnată nu are răspunsuri, caută execuția cea mai recentă cu răspunsuri
        // pentru elementele din template (chiar dacă task_assignment_id nu se potrivește exact)
        const templateElementIds = assignment.template.elements.map(
          (el) => el.id,
        );

        // Caută toate răspunsurile pentru elementele din template
        const allAnswersForTemplate = await this.answerRepository.find({
          where: { task_element_id: In(templateElementIds) },
          relations: ['task_element'],
        });

        // Grupează răspunsurile după task_execution_id și sortează după numărul de răspunsuri
        const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
        allAnswersForTemplate.forEach((answer) => {
          if (!answersByExecution.has(answer.task_execution_id)) {
            answersByExecution.set(answer.task_execution_id, []);
          }
          answersByExecution.get(answer.task_execution_id)!.push(answer);
        });

        // Găsește execuția cu cele mai multe răspunsuri
        let bestExecution: TaskExecution | null = null;
        let maxAnswers = 0;

        for (const [execId, answers] of answersByExecution.entries()) {
          if (answers.length > maxAnswers) {
            const exec = await this.executionRepository.findOne({
              where: { id: execId },
            });

            if (exec) {
              // Verifică dacă execuția este recentă (creată în ultimele 24 de ore)
              const execDate = new Date(exec.created_at);
              const now = new Date();
              const hoursDiff =
                (now.getTime() - execDate.getTime()) / (1000 * 60 * 60);

              if (hoursDiff < 24) {
                // Execuție din ultimele 24 de ore
                bestExecution = exec;
                maxAnswers = answers.length;
                bestExecution.answers = answers;
                console.log(
                  `[ExecutionService] Found better execution ${execId} with ${answers.length} answers (created ${hoursDiff.toFixed(2)} hours ago)`,
                );
              }
            }
          }
        }

        if (
          bestExecution &&
          bestExecution.answers &&
          bestExecution.answers.length > 0
        ) {
          console.log(
            `[ExecutionService] Returning execution ${bestExecution.id} with ${bestExecution.answers.length} answers instead of execution ${result.id}`,
          );
          return bestExecution;
        }
      }
    }

    // Log final pentru debugging
    if (result) {
      console.log(
        `[ExecutionService] Returning execution ${result.id} with ${result.answers?.length || 0} answers`,
      );
    }

    return result;
  }

  async update(
    id: number,
    updateExecutionDto: UpdateExecutionDto,
  ): Promise<TaskExecution> {
    const execution = await this.findOne(id);

    // Extrage answers din DTO
    const { answers, ...executionData } = updateExecutionDto;

    // Verifică dacă assignment-ul există dacă se actualizează
    if (executionData.task_assignment_id) {
      const assignment = await this.taskAssignmentRepository.findOne({
        where: { id: executionData.task_assignment_id },
      });

      if (!assignment) {
        throw new BadRequestException(
          `Assignment-ul cu ID-ul ${executionData.task_assignment_id} nu există`,
        );
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
            where: { id: answerDto.task_element_id },
          });

          if (!element) {
            throw new BadRequestException(
              `Elementul cu ID-ul ${answerDto.task_element_id} nu există`,
            );
          }

          // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
          let score_awarded = answerDto.score_awarded || 0;

          if (element.element_type === 'scoring_boolean') {
            try {
              // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
              const selectedOptions = JSON.parse(answerDto.value || '[]');
              if (Array.isArray(selectedOptions)) {
                // Calculează punctajul total din opțiunile selectate
                const scoringOptions = element.scoring_options
                  ? JSON.parse(element.scoring_options)
                  : [
                      { name: 'Opțiunea 1', points: 1 },
                      { name: 'Opțiunea 2', points: 2 },
                      { name: 'Opțiunea 3', points: 3 },
                    ];

                score_awarded = selectedOptions.reduce(
                  (total: number, optionName: string) => {
                    const option = scoringOptions.find(
                      (opt: any) => opt.name === optionName,
                    );
                    return total + (option ? option.points : 0);
                  },
                  0,
                );
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
            score_awarded: score_awarded,
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

    const assignmentForLoc = await this.taskAssignmentRepository.findOne({
      where: { id: updatedExecution.task_assignment_id },
    });
    const locIdUpdate = (assignmentForLoc as any)?.location_id ?? undefined;
    await this.sendExecutionNotification(
      'execution.updated',
      'Execuție actualizată',
      `Execuția task-ului a fost actualizată`,
      updatedExecution.id,
      {
        assignmentId: updatedExecution.task_assignment_id,
        assignedToId: updatedExecution.employee_id,
        completedAt: updatedExecution.completed_at,
      },
      locIdUpdate,
    );

    return updatedExecution;
  }

  async remove(id: number): Promise<void> {
    const execution = await this.findOne(id);

    // Gestionare puncte zilnice înainte de ștergerea execuției
    await this.handleTaskRemoval(execution);

    await this.executionRepository.remove(execution);
  }

  // ===== REACTIVARE EXECUȚIE (RESPINGERE ȘI REACTIVARE ASSIGNMENT) =====

  async reactivateExecution(
    executionId: number,
  ): Promise<{ message: string; executionId: number; assignmentId: number }> {
    // Găsește execuția
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['task_assignment'],
    });

    if (!execution) {
      throw new NotFoundException(
        `Execuția cu ID-ul ${executionId} nu a fost găsită`,
      );
    }

    if (!execution.task_assignment) {
      throw new BadRequestException(`Execuția nu are un assignment asociat`);
    }

    const assignment = execution.task_assignment;
    const assignmentId = assignment.id;
    const originalAssignedToId = assignment.assigned_to_id;
    const assignmentWithTemplate = await this.taskAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template'],
    });
    const taskName =
      assignmentWithTemplate?.template?.template_name || `Task #${assignmentId}`;

    // Șterge execuția (inclusiv punctele asociate)
    const executionIdToRemove = execution.id;
    await this.handleTaskRemoval(execution);
    await this.executionRepository.remove(execution);

    const locIdDel = (assignment as any).location_id ?? undefined;
    await this.sendExecutionNotification(
      'execution.deleted',
      'Execuție ștearsă',
      `Execuția task-ului a fost ștearsă`,
      executionId,
      { assignmentId, assignedToId: assignment.assigned_to_id },
      locIdDel,
    );

    // Reactivează assignment-ul (schimbă status-ul în 'assigned')
    assignment.status = AssignmentStatus.ASSIGNED;
    assignment.is_visible_for_employee = true; // Fă assignment-ul vizibil pentru angajat

    // IMPORTANT: Pentru task-urile FCFS, păstrăm assigned_to_id original pentru a evita auto-atribuirea
    // Doar pentru task-urile FCFS care au fost acceptate anterior (assigned_to_id != null)
    if (
      assignment.assignment_mode === 'first_come_first_served' &&
      originalAssignedToId !== null
    ) {
      // Nu modificăm assigned_to_id - rămâne valoarea originală
    } else if (
      assignment.assignment_mode === 'first_come_first_served' &&
      originalAssignedToId === null
    ) {
      // Pentru task-urile FCFS care nu au fost acceptate niciodată, rămâne null
    } else {
      // Pentru task-urile non-FCFS, păstrăm assigned_to_id original
    }

    // Incrementează numărul de respingeri
    assignment.rejecting_times = (assignment.rejecting_times || 0) + 1;

    await this.taskAssignmentRepository.save(assignment);

    // Notificare pentru angajat: sarcina a fost reactivată
    try {
      const templateName = (assignment as any).template?.template_name || 'Nou';
      await firstValueFrom(
        this.notificationsClient
          .emit(
            { cmd: 'tasks.notification' },
            {
              type: 'assignment.reactivated',
              title: 'Sarcină reactivată',
              description: `Sarcina "${taskName}" a fost reactivată și trebuie refăcută.`,
              entity_id: assignmentId,
              entity_type: 'task_assignment',
              metadata: {
                assignedToId: assignment.assigned_to_id,
                taskName,
                work_location_id: (assignment as any).location_id ?? null,
              },
              priority: 'medium',
              target_url: `/sarcini/${assignmentId}`,
            },
          )
          .pipe(defaultIfEmpty(undefined)),
      );
    } catch (err) {
      console.error('Failed to send reactivation notification:', err);
    }

    return {
      message:
        'Execuția a fost reactivată cu succes. Assignment-ul a fost reactivat.',
      executionId: executionId,
      assignmentId: assignmentId,
    };
  }

  // ===== APROBARE EXECUȚIE (MARCHEAZĂ ASSIGNMENT-UL CA COMPLETED) =====

  async approveExecution(
    executionId: number,
    user: any,
  ): Promise<{
    message: string;
    executionId: number;
    assignmentId: number;
    approvedBy: string;
  }> {
    // Găsește execuția
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['task_assignment'],
    });

    if (!execution) {
      throw new NotFoundException(
        `Execuția cu ID-ul ${executionId} nu a fost găsită`,
      );
    }

    if (!execution.task_assignment) {
      throw new BadRequestException(`Execuția nu are un assignment asociat`);
    }

    const assignment = execution.task_assignment;
    const assignmentId = assignment.id;
    const assignmentWithTemplate = await this.taskAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template'],
    });
    const taskName =
      assignmentWithTemplate?.template?.template_name || `Task #${assignmentId}`;

    // Verifică dacă assignment-ul este în waiting_response
    if (assignment.status !== AssignmentStatus.WAITING_RESPONSE) {
      throw new BadRequestException(
        `Assignment-ul nu așteaptă aprobare (status actual: ${assignment.status})`,
      );
    }

    // Obține informații despre manager din microserviciul employees
    let managerName = 'Manager';
    try {
      const employeeId = user?.sub; // ID-ul managerului din JWT
      if (employeeId) {
        // Apelează microserviciul employees pentru a obține numele managerului
        const response = await fetch(
          `http://giurom.bitap.ro:3002/employees/${employeeId}`,
        );
        if (response.ok) {
          const managerInfo = await response.json();
          managerName = `${managerInfo.first_name} ${managerInfo.last_name}`;
        }
      }
    } catch (error) {
      console.error(
        `❌ [APPROVE] Eroare la obținerea numelui managerului:`,
        error,
      );
    }

    // Actualizează assignment-ul - marchează ca completed
    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completed_at = new Date();
    // Salvăm informația despre cine a aprobat în câmpul notes (sau putem adăuga un câmp nou approved_by_name)
    assignment.notes = `${assignment.notes ? assignment.notes + '\n\n' : ''}✅ Aprobat de ${managerName} la ${new Date().toLocaleString('ro-RO')}`;

    await this.taskAssignmentRepository.save(assignment);

    const employeeName = await this.getEmployeeDisplayName(
      assignment.assigned_to_id ?? execution.employee_id,
    );
    await this.sendExecutionNotification(
      'assignment.approved',
      'Sarcină aprobată ca finalizată',
      `Managerul a aprobat ca finalizată sarcina "${taskName}" realizată de ${employeeName}.`,
      execution.id,
      {
        assignmentId,
        assignedToId: assignment.assigned_to_id ?? execution.employee_id,
        employeeName,
        taskName,
      },
      (assignment as any).location_id ?? undefined,
    );

    return {
      message: `Execuția a fost aprobată cu succes de ${managerName}`,
      executionId: executionId,
      assignmentId: assignmentId,
      approvedBy: managerName,
    };
  }

  // ===== METODĂ PENTRU GESTIONAREA ȘTERGERII TASK-URILOR CU PUNCTE =====

  private async handleTaskRemoval(execution: TaskExecution): Promise<void> {
    try {
      // Găsește toate punctele zilnice asociate cu această execuție
      const taskPoints = await this.employeeDailyTaskPointsRepository.find({
        where: { task_execution_id: execution.id },
        relations: ['employee_daily_points'],
      });

      if (taskPoints.length > 0) {
        // Grupează punctele pe daily_points pentru a actualiza totalurile
        const dailyPointsMap = new Map<
          number,
          { dailyPoints: EmployeeDailyPoints; pointsToRemove: number }
        >();

        for (const taskPoint of taskPoints) {
          const dailyPoints = taskPoint.employee_daily_points;
          const dailyPointsId = dailyPoints.id;

          if (!dailyPointsMap.has(dailyPointsId)) {
            dailyPointsMap.set(dailyPointsId, {
              dailyPoints: dailyPoints,
              pointsToRemove: 0,
            });
          }

          const entry = dailyPointsMap.get(dailyPointsId)!;
          entry.pointsToRemove += taskPoint.points_awarded;
        }

        // Actualizează totalurile pentru fiecare daily_points
        for (const [
          dailyPointsId,
          { dailyPoints, pointsToRemove },
        ] of dailyPointsMap) {
          dailyPoints.total_points = Math.max(
            0,
            dailyPoints.total_points - pointsToRemove,
          );
          await this.employeeDailyPointsRepository.save(dailyPoints);
        }

        // Șterge toate punctele zilnice pentru această execuție
        await this.employeeDailyTaskPointsRepository.delete({
          task_execution_id: execution.id,
        });
      }
    } catch (error) {
      console.error(
        `❌ Eroare la gestionarea ștergerii punctelor pentru execuția ${execution.id}:`,
        error,
      );
      // Nu aruncăm eroarea pentru a nu bloca ștergerea execuției
    }
  }

  // ===== METODE PENTRU PUNCTAJ ZILNIC =====

  async createEmployeeDailyPoints(
    createDto: CreateEmployeeDailyPointsDto,
  ): Promise<EmployeeDailyPoints> {
    // Verifică dacă există deja un punctaj pentru această zi și angajat.
    // Pentru surse externe (ex. punctualitate din attendance), comportamentul trebuie să fie aditiv:
    // dacă rândul există, adăugăm punctele primite peste totalul existent.
    const existingPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: createDto.employee_id,
        work_date: new Date(createDto.work_date),
      },
    });

    if (existingPoints) {
      const before = Number(existingPoints.total_points || 0);
      const delta = Number(createDto.total_points || 0);
      existingPoints.total_points =
        before + delta;
      if ((existingPoints as any).location_id == null && createDto.location_id != null) {
        (existingPoints as any).location_id = createDto.location_id as any;
      }
      const saved = await this.employeeDailyPointsRepository.save(existingPoints);
      console.log('✅ [daily-points] update aditiv:', {
        employee_id: createDto.employee_id,
        work_date: createDto.work_date,
        location_id: (saved as any).location_id,
        before,
        delta,
        after: Number(saved.total_points || 0),
      });
      return saved;
    }

    const dailyPoints = this.employeeDailyPointsRepository.create({
      employee_id: createDto.employee_id,
      work_date: new Date(createDto.work_date),
      total_points: createDto.total_points || 0,
      location_id: createDto.location_id,
    });

    const saved = await this.employeeDailyPointsRepository.save(dailyPoints);
    console.log('✅ [daily-points] creat nou:', {
      employee_id: createDto.employee_id,
      work_date: createDto.work_date,
      location_id: (saved as any).location_id,
      total_points: Number(saved.total_points || 0),
    });
    return saved;
  }

  async getEmployeeDailyPoints(
    employeeId: number,
    workDate: string,
    user?: EmployeeAccessUser,
    authorization?: string,
  ): Promise<EmployeeDailyPoints> {
    await this.employeeAccessService.assertCanReadEmployeeData(
      user,
      employeeId,
      authorization,
    );
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: new Date(workDate),
      },
      relations: ['task_points', 'task_points.task_execution'],
    });

    if (!dailyPoints) {
      throw new NotFoundException(
        `Nu există punctaj pentru angajatul ${employeeId} în data ${workDate}`,
      );
    }

    // NU resincronizăm total_points doar din task_points – valoarea stocată
    // poate include puncte din surse non-task (ex: inceperea turei mai devreme) care nu
    // au intrări în employee_daily_task_points.
    return dailyPoints;
  }

  async addTaskPointsToDailyPoints(
    createDto: CreateEmployeeDailyTaskPointsDto,
  ): Promise<EmployeeDailyTaskPoints> {
    // Verifică dacă punctajul zilnic există
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: { id: createDto.employee_daily_points_id },
    });

    if (!dailyPoints) {
      throw new BadRequestException(
        `Punctajul zilnic cu ID ${createDto.employee_daily_points_id} nu există`,
      );
    }

    // Verifică dacă execuția task-ului există
    const taskExecution = await this.executionRepository.findOne({
      where: { id: createDto.task_execution_id },
    });

    if (!taskExecution) {
      throw new BadRequestException(
        `Execuția task-ului cu ID ${createDto.task_execution_id} nu există`,
      );
    }

    // Verifică dacă există deja punctaj pentru această execuție
    const existingTaskPoints =
      await this.employeeDailyTaskPointsRepository.findOne({
        where: {
          employee_daily_points_id: createDto.employee_daily_points_id,
          task_execution_id: createDto.task_execution_id,
        },
      });

    if (existingTaskPoints) {
      throw new BadRequestException(
        `Există deja punctaj pentru această execuție de task`,
      );
    }

    // Creează punctajul pentru task
    const taskPoints = this.employeeDailyTaskPointsRepository.create({
      employee_daily_points_id: createDto.employee_daily_points_id,
      task_execution_id: createDto.task_execution_id,
      points_awarded: createDto.points_awarded,
    });

    const savedTaskPoints =
      await this.employeeDailyTaskPointsRepository.save(taskPoints);

    // Setează location_id pe daily_points din execuție dacă lipsește (nu ar trebui cu coloana NOT NULL)
    const execLocId = (taskExecution as any).location_id;
    if (execLocId != null && (dailyPoints as any).location_id == null) {
      (dailyPoints as any).location_id = execLocId;
      await this.employeeDailyPointsRepository.save(dailyPoints);
    }

    // Actualizează punctajul total zilnic păstrând punctele non-task (ex: attendance)
    const sumTaskPoints = await this.employeeDailyTaskPointsRepository
      .createQueryBuilder('taskPoints')
      .select('SUM(taskPoints.points_awarded)', 'total')
      .where('taskPoints.employee_daily_points_id = :dailyPointsId', {
        dailyPointsId: createDto.employee_daily_points_id,
      })
      .getRawOne();

    const taskSum = parseFloat(sumTaskPoints.total) || 0;
    // Recitim rândul din DB pentru a avea valoarea curentă a total_points
    const freshDaily = await this.employeeDailyPointsRepository.findOne({
      where: { id: createDto.employee_daily_points_id },
    });
    const currentTotal = parseFloat(String(freshDaily?.total_points ?? 0)) || 0;
    // Suma anterioară a task-urilor (fără task-ul tocmai adăugat)
    const prevTaskSum = taskSum - createDto.points_awarded;
    // Diferența non-task = total stocat - suma anterioară a task-urilor
    const nonTaskPoints = currentTotal - prevTaskSum;
    dailyPoints.total_points = taskSum + Math.max(nonTaskPoints, 0);
    await this.employeeDailyPointsRepository.save(dailyPoints);

    return savedTaskPoints;
  }

  /**
   * Listă înregistrările din Employee_Daily_Task_Points pentru rapoarte (perioadă și opțional angajat).
   */
  async listDailyTaskPoints(
    startDate?: string,
    endDate?: string,
    employeeId?: number,
    locationId?: number,
  ): Promise<
    Array<{
      id: number;
      employee_id: number;
      work_date: string;
      points_awarded: number;
      task_execution_id: number | null;
      created_at: Date;
      employee_daily_points_id: number;
    }>
  > {
    const qb = this.employeeDailyTaskPointsRepository
      .createQueryBuilder('tp')
      .innerJoin('tp.employee_daily_points', 'edp')
      .select('tp.id', 'id')
      .addSelect('edp.employee_id', 'employee_id')
      .addSelect('DATE(edp.work_date)', 'work_date')
      .addSelect('tp.points_awarded', 'points_awarded')
      .addSelect('tp.task_execution_id', 'task_execution_id')
      .addSelect('tp.created_at', 'created_at')
      .addSelect('tp.employee_daily_points_id', 'employee_daily_points_id')
      .orderBy('edp.work_date', 'DESC')
      .addOrderBy('tp.created_at', 'DESC');

    if (employeeId != null) {
      qb.andWhere('edp.employee_id = :employeeId', { employeeId });
    }
    if (locationId != null) {
      qb.andWhere('edp.location_id = :locationId', { locationId });
    }
    if (startDate && endDate) {
      qb.andWhere('DATE(edp.work_date) >= :startDate', {
        startDate: startDate.replace(/T.*/, ''),
      });
      qb.andWhere('DATE(edp.work_date) <= :endDate', {
        endDate: endDate.replace(/T.*/, ''),
      });
    }

    const rows = await qb.getRawMany<{
      id: number;
      employee_id: number;
      work_date: string;
      points_awarded: string;
      task_execution_id: number | null;
      created_at: Date;
      employee_daily_points_id: number;
    }>();
    const list = rows.map((r) => {
      const pointsAwarded = parseFloat(r.points_awarded || '0');
      return {
        id: r.id,
        employee_id: r.employee_id,
        work_date: r.work_date,
        points_awarded: Number.isFinite(pointsAwarded) ? pointsAwarded : 0,
        task_execution_id: r.task_execution_id,
        created_at: r.created_at,
        employee_daily_points_id: r.employee_daily_points_id,
      };
    });

    // Includem și deducerile care există doar în total_points (fără rând în Employee_Daily_Task_Points)
    const edpQb = this.employeeDailyPointsRepository
      .createQueryBuilder('edp')
      .select('edp.id', 'id')
      .addSelect('edp.employee_id', 'employee_id')
      .addSelect('DATE(edp.work_date)', 'work_date')
      .addSelect('edp.total_points', 'total_points')
      .addSelect('edp.updated_at', 'updated_at')
      .where('edp.total_points < 0');
    if (locationId != null) edpQb.andWhere('edp.location_id = :locationId', { locationId });
    if (employeeId != null) edpQb.andWhere('edp.employee_id = :employeeId', { employeeId });
    if (startDate && endDate) {
      edpQb
        .andWhere('DATE(edp.work_date) >= :startDate', { startDate: startDate.replace(/T.*/, '') })
        .andWhere('DATE(edp.work_date) <= :endDate', { endDate: endDate.replace(/T.*/, '') });
    }
    const edpRows = await edpQb.getRawMany<{ id: number; employee_id: number; work_date: string; total_points: string; updated_at: Date }>();
    for (const edp of edpRows) {
      const edpId = edp.id;
      const sumFromTaskPoints = list
        .filter((x) => x.employee_daily_points_id === edpId)
        .reduce((s, x) => s + x.points_awarded, 0);
      const totalPts = parseFloat(edp.total_points || '0');
      if (!Number.isFinite(totalPts)) continue;
      const missing = totalPts - sumFromTaskPoints;
      if (missing >= 0) continue;
      list.push({
        id: -edpId,
        employee_id: edp.employee_id,
        work_date: edp.work_date,
        points_awarded: missing,
        task_execution_id: null,
        created_at: edp.updated_at,
        employee_daily_points_id: edpId,
      });
    }
    list.sort((a, b) => {
      const d = (new Date(b.work_date).getTime()) - (new Date(a.work_date).getTime());
      if (d !== 0) return d;
      return (new Date(b.created_at).getTime()) - (new Date(a.created_at).getTime());
    });
    return list;
  }

  async getEmployeePointsForDateRange(
    employeeId: number,
    startDate: string,
    endDate: string,
    user?: EmployeeAccessUser,
    authorization?: string,
  ): Promise<EmployeeDailyPoints[]> {
    await this.employeeAccessService.assertCanReadEmployeeData(
      user,
      employeeId,
      authorization,
    );
    // Normalize dates to YYYY-MM-DD format and create Date objects at midnight UTC
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const list = await this.employeeDailyPointsRepository
      .createQueryBuilder('dailyPoints')
      .leftJoinAndSelect('dailyPoints.task_points', 'taskPoints')
      .leftJoinAndSelect('taskPoints.task_execution', 'taskExecution')
      .where('dailyPoints.employee_id = :employeeId', { employeeId })
      .andWhere('DATE(dailyPoints.work_date) >= DATE(:startDate)', {
        startDate: startDate,
      })
      .andWhere('DATE(dailyPoints.work_date) <= DATE(:endDate)', {
        endDate: endDate,
      })
      .orderBy('dailyPoints.work_date', 'ASC')
      .getMany();

    // NU recalculăm total_points – valoarea stocată include și puncte din surse non-task
    // (ex: puncte de pontaj pentru începerea turei cu mai devreme), care nu au intrări
    // în employee_daily_task_points.
    return list;
  }

  async calculateTotalPointsForEmployee(
    employeeId: number,
    startDate: string,
    endDate: string,
    user?: EmployeeAccessUser,
    authorization?: string,
  ): Promise<number> {
    await this.employeeAccessService.assertCanReadEmployeeData(
      user,
      employeeId,
      authorization,
    );
    // Sumă din task_points (inclusiv negative), nu din total_points stocat
    const result = await this.employeeDailyTaskPointsRepository
      .createQueryBuilder('tp')
      .innerJoin('tp.employee_daily_points', 'edp')
      .select('COALESCE(SUM(tp.points_awarded), 0)', 'total')
      .where('edp.employee_id = :employeeId', { employeeId })
      .andWhere('DATE(edp.work_date) >= :startDate', {
        startDate: startDate.replace(/T.*/, ''),
      })
      .andWhere('DATE(edp.work_date) <= :endDate', {
        endDate: endDate.replace(/T.*/, ''),
      })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total || '0') || 0;
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
        relations: ['elements', 'elements.task_element'],
      });

      if (!assignment) {
        console.error(
          `Assignment-ul cu ID ${execution.task_assignment_id} nu a fost găsit`,
        );
        return;
      }

      // Calculează punctajul pentru task-ul finalizat
      const { points: totalPoints, isOverdue } = this.calculateTaskPoints(
        execution,
        assignment,
      );

      // Obține data de lucru (ziua din completed_at)
      const workDate = new Date(execution.completed_at);
      workDate.setHours(0, 0, 0, 0); // Setează la începutul zilei

      // Verifică dacă există deja punctaj zilnic pentru această zi
      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: execution.employee_id,
          work_date: workDate,
        },
      });

      const locationId = (execution as any).location_id ?? (assignment as any)?.location_id;
      if (locationId == null) {
        console.error(
          `❌ [handleTaskCompletion] Execuția ${execution.id} / assignment ${execution.task_assignment_id} fără location_id – nu se creează puncte zilnice`,
        );
        return;
      }

      // Actualizează execuția cu location_id dacă lipsește (ex.: sarcină reatribuită, execuție creată înainte de setare)
      if ((execution as any).location_id == null) {
        await this.executionRepository.update(execution.id, {
          location_id: locationId,
        } as any);
      }

      // Dacă nu există, creează unul nou (cu location_id obligatoriu)
      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: execution.employee_id,
          work_date: workDate,
          total_points: 0,
          location_id: locationId,
        });
        dailyPoints =
          await this.employeeDailyPointsRepository.save(dailyPoints);
      } else if ((dailyPoints as any).location_id == null) {
        (dailyPoints as any).location_id = locationId;
        await this.employeeDailyPointsRepository.save(dailyPoints);
      }

      // Verifică dacă există deja punctaj pentru această execuție
      const existingTaskPoints =
        await this.employeeDailyTaskPointsRepository.findOne({
          where: {
            employee_daily_points_id: dailyPoints.id,
            task_execution_id: execution.id,
          },
        });

      // Dacă nu există, adaugă punctajul pentru această execuție
      if (!existingTaskPoints) {
        const taskPoints = this.employeeDailyTaskPointsRepository.create({
          employee_daily_points_id: dailyPoints.id,
          task_execution_id: execution.id,
          points_awarded: totalPoints,
        });
        await this.employeeDailyTaskPointsRepository.save(taskPoints);

        // Actualizează punctajul total zilnic păstrând punctele non-task (ex: attendance)
        const totalDailyPoints = await this.employeeDailyTaskPointsRepository
          .createQueryBuilder('taskPoints')
          .select('SUM(taskPoints.points_awarded)', 'total')
          .where('taskPoints.employee_daily_points_id = :dailyPointsId', {
            dailyPointsId: dailyPoints.id,
          })
          .getRawOne();

        const taskSum = parseFloat(totalDailyPoints.total) || 0;
        // Recitim rândul din DB pentru total_points curent (include attendance)
        const freshDaily = await this.employeeDailyPointsRepository.findOne({
          where: { id: dailyPoints.id },
        });
        const currentTotal = parseFloat(String(freshDaily?.total_points ?? 0)) || 0;
        // Suma anterioare a task-urilor (fără task-ul tocmai adăugat)
        const prevTaskSum = taskSum - totalPoints;
        // Diferența non-task = total stocat - suma anterioară a task-urilor
        const nonTaskPoints = currentTotal - prevTaskSum;
        dailyPoints.total_points = taskSum + Math.max(nonTaskPoints, 0);
        await this.employeeDailyPointsRepository.save(dailyPoints);

        const action = isOverdue ? 'scăzut' : 'adăugat';

        // Puncte manager: sursă unică manager_daily_payout (la încasare/cron), nu la fiecare task
      } else {
      }
    } catch (error) {
      console.error(
        '❌ Eroare la procesarea finalizării task-ului cu puncte:',
        error,
      );
      // Nu aruncăm eroarea pentru a nu afecta finalizarea task-ului
    }
  }

  // ===== METODĂ PENTRU PROCESAREA TASK-URILOR ÎNTÂRZIATE =====

  async processOverdueTasks(
    date: string,
  ): Promise<{ processedTasks: number; totalPointsDeducted: number }> {
    try {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      // Găsește toate assignment-urile care au elemente cu finish_at în ziua respectivă
      const assignments = await this.taskAssignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'taskElement')
        .where('taskElement.element_type = :finishAtType', {
          finishAtType: 'finish_at',
        })
        .andWhere('elements.value >= :startDate', {
          startDate: targetDate.toISOString(),
        })
        .andWhere('elements.value < :endDate', {
          endDate: new Date(
            targetDate.getTime() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .andWhere('assignment.status != :completedStatus', {
          completedStatus: 'completed',
        })
        .getMany();

      let processedTasks = 0;
      let totalPointsDeducted = 0;

      for (const assignment of assignments) {
        // Verifică dacă există execuții pentru acest assignment
        const executions = await this.executionRepository.find({
          where: { task_assignment_id: assignment.id },
        });

        // Dacă nu există execuții, task-ul nu a fost început
        if (executions.length === 0) {
          const pointsDeducted = await this.deductPointsForUncompletedTask(
            assignment,
            targetDate,
          );
          totalPointsDeducted += pointsDeducted;
          processedTasks++;
        }
      }

      return { processedTasks, totalPointsDeducted };
    } catch (error) {
      console.error('Eroare la procesarea task-urilor întârziate:', error);
      throw error;
    }
  }

  private async deductPointsForUncompletedTask(
    assignment: TaskAssignment,
    targetDate: Date,
  ): Promise<number> {
    let totalPointsDeducted = 0;

    // Pentru fiecare element cu puncte, scade punctele posibile (nefinalizat = pierde punctele)
    for (const element of assignment.elements || []) {
      if (!element?.task_element) continue;
      if (element.task_element.element_type === 'scoring_simple') {
        totalPointsDeducted += element.task_element.simple_score_points || 0;
      } else if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options
          ? JSON.parse(element.task_element.scoring_options)
          : [];
        const totalPossiblePoints = scoringOptions.reduce(
          (sum: number, option: any) => sum + (option.points || 0),
          0,
        );
        totalPointsDeducted += totalPossiblePoints;
      }
    }

    if (totalPointsDeducted > 0) {
      const locationId =
        (assignment as any).location_id != null
          ? Number((assignment as any).location_id)
          : null;
      if (locationId == null) {
        console.warn(
          `⚠️ [deductPoints] Assignment ${assignment.id} nu are location_id – deducerea de puncte nu este înregistrată (Employee_Daily_Points necesită location_id).`,
        );
        return totalPointsDeducted;
      }

      // Ziua de lucru: normalizare la începutul zilei pentru potrivire cu coloana date
      const workDate = new Date(targetDate);
      workDate.setHours(0, 0, 0, 0);

      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: assignment.assigned_to_id,
          work_date: workDate,
        },
      });

      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: assignment.assigned_to_id,
          work_date: workDate,
          total_points: -totalPointsDeducted,
          location_id: locationId,
        });
      } else {
        dailyPoints.total_points = Number(dailyPoints.total_points) - totalPointsDeducted;
        if ((dailyPoints as any).location_id == null) {
          (dailyPoints as any).location_id = locationId;
        }
      }

      dailyPoints = await this.employeeDailyPointsRepository.save(dailyPoints);

      // Înregistrare în EmployeeDailyTaskPoints pentru audit și rapoarte (fără execuție – reatribuire)
      // INSERT cu task_execution_id NULL – necesită coloana să fie INT NULL în DB (migrare run-on-server.sql)
      try {
        await this.employeeDailyTaskPointsRepository
          .createQueryBuilder()
          .insert()
          .into(EmployeeDailyTaskPoints)
          .values({
            employee_daily_points_id: dailyPoints.id,
            task_execution_id: null as any,
            points_awarded: -totalPointsDeducted,
          })
          .execute();
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('task_execution_id') || msg.includes('Data truncated')) {
          console.warn(
            `⚠️ [deductPoints] Nu s-a putut insera Employee_Daily_Task_Points (task_execution_id=NULL). Rulează pe DB: ALTER TABLE Employee_Daily_Task_Points MODIFY COLUMN task_execution_id INT NULL;`,
          );
        } else {
          throw err;
        }
      }
    }

    return totalPointsDeducted;
  }

  /**
   * Public wrapper: scade punctele pentru un assignment nefinalizat (folosit la realocare).
   * Assignment trebuie încărcat cu relations: elements, elements.task_element.
   */
  async deductPointsForUncompletedAssignment(
    assignment: TaskAssignment,
    targetDate: Date,
  ): Promise<number> {
    return this.deductPointsForUncompletedTask(assignment, targetDate);
  }

  // ===== METODĂ PENTRU CALCULAREA PUNCTAJULUI TASK-ULUI =====

  private calculateTaskPoints(
    execution: TaskExecution,
    assignment: TaskAssignment,
  ): { points: number; isOverdue: boolean } {
    let totalPoints = 0;
    let isOverdue = false;

    // Verifică dacă task-ul are deadline și dacă este finalizat în timp
    const deadlineElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'finish_at',
    );
    const finalizedInElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'finalized_in',
    );
    const allowPostponeElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'allow_postpone',
    );

    // Verifică dacă există "permite amânarea" - dacă da, anulează efectul deadline-ului
    const hasAllowPostpone =
      allowPostponeElement && allowPostponeElement.value === 'true';

    // Verifică dacă task-ul a fost amânat
    const wasPostponed = assignment.was_postponed === true;
    // Task realocat (a doua persoană): termen = până la introducerea încasării – nu se penalizează la finalizare
    const isReallocated = (assignment as any).reallocation_trigger != null;

    if ((deadlineElement || finalizedInElement) && execution.completed_at && !isReallocated) {
      let deadline: Date | null = null;

      // Verifică dacă există finish_at (deadline fix)
      if (
        deadlineElement &&
        deadlineElement.value &&
        deadlineElement.value.trim() !== ''
      ) {
        deadline = new Date(deadlineElement.value.trim());
      }
      // Altfel, verifică dacă există finalized_in (deadline calculat)
      else if (
        finalizedInElement &&
        finalizedInElement.value &&
        finalizedInElement.value.trim() !== ''
      ) {
        try {
          const durationData = JSON.parse(finalizedInElement.value.trim());
          const hours = durationData.hours || 0;
          const minutes = durationData.minutes || 0;

          // Calculează deadline-ul bazat pe assigned_at + durata
          deadline = new Date(assignment.assigned_at);
          deadline.setHours(deadline.getHours() + hours);
          deadline.setMinutes(deadline.getMinutes() + minutes);
        } catch (e) {
          deadline = null;
        }
      }

      if (deadline && !isNaN(deadline.getTime())) {
        const completionTime = new Date(execution.completed_at);

        // Verifică dacă data de finalizare este validă
        if (!isNaN(completionTime.getTime())) {
          isOverdue = completionTime > deadline;
        } else {
          isOverdue = false;
        }
      } else {
        isOverdue = false; // Nu este întârziat dacă nu există deadline
      }
    } else if (wasPostponed || isReallocated) {
      isOverdue = false; // Nu este întârziat dacă a fost amânat sau e task realocat (termen = la încasare)
    }

    // Găsește toate elementele cu puncte din assignment (scoring_boolean și scoring_simple)
    const scoringElements =
      assignment.elements?.filter(
        (el) =>
          el.task_element.element_type === 'scoring_boolean' ||
          el.task_element.element_type === 'scoring_simple',
      ) || [];

    // Verifică dacă toate elementele cu puncte au fost completate
    const completedScoringElements = scoringElements.filter((element) => {
      const answer = execution.answers?.find(
        (a) => a.task_element_id === element.task_element_id,
      );
      return answer && answer.score_awarded > 0;
    });

    // Calculează punctajul pentru fiecare element cu puncte
    // Reguli: finalizat în timp util → +puncte; finalizat după termen sau nefinalizat → -puncte
    // scoring_boolean: puncte = (opțiuni bifate) - (opțiuni nebifate), ex. doar opt2 (2 pct) → +2 -1 -3 = -2

    for (const element of scoringElements) {
      const answer = execution.answers?.find(
        (a) => a.task_element_id === element.task_element_id,
      );

      if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options
          ? JSON.parse(element.task_element.scoring_options)
          : [];
        const totalPossiblePoints = scoringOptions.reduce(
          (sum: number, option: any) => sum + (option.points || 0),
          0,
        );
        const selectedPoints = answer?.score_awarded ?? 0;
        const nonSelectedPoints = totalPossiblePoints - selectedPoints;
        // Puncte = ce a bifat minus ce nu a bifat (ex: opt2=2 bifat, opt1=1 și opt3=3 nebifate → 2 - 1 - 3 = -2)
        totalPoints += selectedPoints - nonSelectedPoints;
      } else if (element.task_element.element_type === 'scoring_simple') {
        const simpleScorePoints = element.task_element.simple_score_points || 0;
        const completed = answer && (answer.score_awarded ?? 0) > 0;

        if (completed) {
          if (wasPostponed) {
            totalPoints += simpleScorePoints;
          } else if (isOverdue) {
            totalPoints -= simpleScorePoints;
          } else {
            totalPoints += simpleScorePoints;
          }
        } else {
          totalPoints -= simpleScorePoints;
        }
      }
    }

    // Calculează punctajul pentru elementele non-scoring
    for (const answer of execution.answers) {
      const assignmentElement = assignment.elements?.find(
        (el) => el.task_element_id === answer.task_element_id,
      );
      if (!assignmentElement) continue;

      const taskElement = assignmentElement.task_element;
      if (
        taskElement.element_type !== 'scoring_boolean' &&
        taskElement.element_type !== 'scoring_simple'
      ) {
        // Pentru alte tipuri de elemente, punctaj normal
        totalPoints += answer.score_awarded || 0;
      }
    }

    return { points: totalPoints, isOverdue };
  }

  // ===== AGREGAȚI PUNCTE PE LOCAȚIE/ANGAJAT ÎNTR-UN INTERVAL =====
  // Folosește employee_daily_points (inclusiv puncte negative la reatribuire) unde location_id e setat.
  // Fallback: dacă nu există niciun rând cu location_id, agregare din task_points + execution (comportament vechi).
  async calculateTotalPointsForLocation(
    locationId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<number> {
    const qb = this.employeeDailyPointsRepository
      .createQueryBuilder('edp')
      .select('COALESCE(SUM(edp.total_points), 0)', 'total')
      .where('edp.location_id = :locId', { locId: locationId });

    if (startDate && endDate) {
      const sd = startDate.replace(/T.*/, '');
      const ed = endDate.replace(/T.*/, '');
      qb.andWhere('DATE(edp.work_date) >= :sd', { sd }).andWhere('DATE(edp.work_date) <= :ed', { ed });
    }

    const res = await qb.getRawOne<{ total: string }>();
    let total = parseFloat(res?.total || '0');
    if (!Number.isFinite(total)) total = 0;
    // Fallback: date vechi fără location_id pe edp – agregare din task_points + execution
    if (total === 0 && startDate && endDate) {
      const fallbackQb = this.employeeDailyTaskPointsRepository
        .createQueryBuilder('taskPoints')
        .innerJoin('taskPoints.task_execution', 'exec')
        .select('COALESCE(SUM(taskPoints.points_awarded), 0)', 'total')
        .where('exec.location_id = :locId', { locId: locationId })
        .andWhere('exec.completed_at IS NOT NULL');
      const sd = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      const ed = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      fallbackQb.andWhere('exec.completed_at BETWEEN :sd AND :ed', { sd, ed });
      const fallbackRes = await fallbackQb.getRawOne<{ total: string }>();
      total = parseFloat(fallbackRes?.total || '0') || 0;
    }
    return total;
  }

  async calculatePointsByEmployeeForLocation(
    locationId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<Array<{ employee_id: number; total_points: number }>> {
    const qb = this.employeeDailyPointsRepository
      .createQueryBuilder('edp')
      .select('edp.employee_id', 'employee_id')
      .addSelect('COALESCE(SUM(edp.total_points), 0)', 'total_points')
      .where('edp.location_id = :locId', { locId: locationId })
      .groupBy('edp.employee_id');

    if (startDate && endDate) {
      const sd = startDate.replace(/T.*/, '');
      const ed = endDate.replace(/T.*/, '');
      qb.andWhere('DATE(edp.work_date) >= :sd', { sd }).andWhere('DATE(edp.work_date) <= :ed', { ed });
    }

    let rows = await qb.getRawMany<{ employee_id: string; total_points: string }>();
    // Fallback: dacă niciun rând cu location_id, folosim agregarea din task_points + execution
    if (rows.length === 0 && startDate && endDate) {
      const fallbackQb = this.employeeDailyTaskPointsRepository
        .createQueryBuilder('taskPoints')
        .innerJoin('taskPoints.task_execution', 'exec')
        .select('exec.employee_id', 'employee_id')
        .addSelect('COALESCE(SUM(taskPoints.points_awarded), 0)', 'total_points')
        .where('exec.location_id = :locId', { locId: locationId })
        .andWhere('exec.completed_at IS NOT NULL')
        .groupBy('exec.employee_id');
      const sd = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      const ed = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      fallbackQb.andWhere('exec.completed_at BETWEEN :sd AND :ed', { sd, ed });
      rows = await fallbackQb.getRawMany<{ employee_id: string; total_points: string }>();
    }
    return rows.map((r) => {
      const totalPoints = parseFloat(r.total_points || '0');
      return {
        employee_id: Number(r.employee_id),
        total_points: Number.isFinite(totalPoints) ? totalPoints : 0,
      };
    });
  }
  // Puncte manager: sursă unică manager_daily_payout (populat la încasare/cron), nu la fiecare task.

  // ===== METODĂ PENTRU GĂSIREA MANAGERULUI PREZENT LA UN MOMENT DAT =====
  private async findManagerAtTime(
    locationId: number,
    completionTime: Date,
  ): Promise<any> {
    try {
      // Obține toate shift-urile pentru această locație
      const shiftsResponse = await this.httpService.axiosRef.get(
        `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${locationId}&limit=1000`,
        {
          headers: {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret':
              process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json',
          },
        },
      );

      let allShifts: any[] = [];
      if (Array.isArray(shiftsResponse.data)) {
        allShifts = shiftsResponse.data;
      } else if (shiftsResponse.data?.data) {
        allShifts = shiftsResponse.data.data;
      }

      // Filtrează shift-urile care conțin ora de finalizare
      const relevantShifts: any[] = allShifts.filter((shift: any) => {
        const startTime = new Date(shift.start_time);
        const endTime = new Date(shift.end_time);
        return startTime <= completionTime && endTime >= completionTime;
      });

      // Pentru fiecare shift relevant, verifică prezența managerului
      for (const shift of relevantShifts) {
        // Obține toate prezențele pentru acest shift
        const presencesResponse = await this.httpService.axiosRef.get(
          `http://giurom.bitap.ro:3016/attendance/presences?shift_id=${shift.id}&limit=1000`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret':
                process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json',
            },
          },
        );

        let presences: any[] = [];
        if (Array.isArray(presencesResponse.data)) {
          presences = presencesResponse.data;
        } else if (presencesResponse.data?.data) {
          presences = presencesResponse.data.data;
        }

        // Caută prezența managerului în acest shift
        const managerPresence = presences.find((presence: any) => {
          return (
            presence.employee_id &&
            presence.is_manager === true &&
            presence.check_in_time &&
            new Date(presence.check_in_time) <= completionTime &&
            (!presence.check_out_time ||
              new Date(presence.check_out_time) >= completionTime)
          );
        });

        if (managerPresence) {
          return managerPresence;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Eroare la căutarea managerului:', error);
      return null;
    }
  }

  /**
   * Calculează repo root-ul - similar cu locations și stock services
   */
  private getRepoRoot(): string {
    // Resolve repo root relative to this file location
    // __dirname is .../giurom-backend/veziv-tasks/src/execution (dev with ts-node) or .../giurom-backend/veziv-tasks/dist/execution (prod)
    const repoRoot = path.resolve(__dirname, '../../..');
    return repoRoot;
  }

  /**
   * Upload imagine task - salvează pe server în images/tasks
   */
  async uploadTaskImage(
    fileName: string,
    base64Content: string,
  ): Promise<string> {
    try {
      let base64Data = base64Content;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop() || 'jpg';
      const baseFileName = fileName.replace(/\.[^/.]+$/, '') || 'image';
      const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images');
      const tasksDir = path.join(imagesDir, 'tasks');

      if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
        console.log(`📁 Created images/tasks directory: ${tasksDir}`);
      }

      const filePath = path.join(tasksDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Task image saved: ${filePath} (${buffer.length} bytes)`);

      return `/api/images/tasks/${uniqueFileName}`;
    } catch (error: any) {
      console.error(`❌ Error uploading task image: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea imaginii: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Servește imaginea unui task
   */
  async serveTaskImage(
    fileName: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images', 'tasks');
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      const buffer = fs.readFileSync(filePath);

      const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      let mimeType = 'image/jpeg';

      switch (extension) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'svg':
          mimeType = 'image/svg+xml';
          break;
        case 'jfif':
          mimeType = 'image/jpeg';
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      console.error(`❌ Error serving task image: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge imaginea unui task de pe server
   */
  async deleteTaskImage(imageUrl: string): Promise<void> {
    try {
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        throw new BadRequestException('URL-ul imaginii nu este valid');
      }

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images', 'tasks');
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Task image not found for deletion: ${filePath}`);
        return;
      }

      fs.unlinkSync(filePath);
      console.log(`✅ Task image deleted: ${filePath}`);
    } catch (error: any) {
      console.error(`❌ Error deleting task image: ${error}`);
      throw new BadRequestException(
        `Eroare la ștergerea imaginii: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Listare înregistrări manager_daily_payout pentru rapoarte.
   * Sursă unică: tabela manager_daily_payout (populată la introducerea/aprobarea încasării).
   * Filtrare opțională: work_location_id, start_date, end_date. Fără N+1 – un singur query.
   * Comparația de date folosește DATE() ca să evite probleme de timezone.
   */
  async findManagerDailyPayouts(
    workLocationId?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<ManagerDailyPayout[]> {
    try {
      const normStart = startDate ? startDate.split('T')[0].split(' ')[0] : undefined;
      const normEnd = endDate ? endDate.split('T')[0].split(' ')[0] : undefined;

      const qb = this.managerDailyPayoutRepository
        .createQueryBuilder('p')
        .orderBy('p.work_date', 'DESC')
        .addOrderBy('p.work_location_id', 'ASC');

      if (workLocationId != null) {
        qb.andWhere('p.work_location_id = :workLocationId', { workLocationId });
      }
      if (normStart) {
        qb.andWhere('p.work_date >= :normStart', { normStart });
      }
      if (normEnd) {
        qb.andWhere('p.work_date <= :normEnd', { normEnd });
      }

      const list = await qb.getMany();
      if (list.length === 0 && workLocationId != null && (normStart || normEnd)) {
        const countWithoutDate = await this.managerDailyPayoutRepository
          .createQueryBuilder('p')
          .where('p.work_location_id = :workLocationId', { workLocationId })
          .getCount();
        if (countWithoutDate > 0) {
          console.warn(
            `[findManagerDailyPayouts] work_location_id=${workLocationId}, start=${normStart}, end=${normEnd}: 0 rânduri, dar locația are ${countWithoutDate} înregistrări (posibil filtru dată/timezone)`,
          );
        }
      }
      return list;
    } catch (err) {
      console.error('[findManagerDailyPayouts]', err);
      return [];
    }
  }
}
