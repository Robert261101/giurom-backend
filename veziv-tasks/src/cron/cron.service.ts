import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, Raw } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import {
  TaskAssignment,
  AssignmentStatus,
} from '../assignment/entity/task-assignment.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from '../execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from '../execution/entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from '../execution/entity/employee-daily-task-points.entity';
import { ManagerDailyPayout } from '../execution/entity/manager-daily-payout.entity';
import { ExecutionService } from '../execution/execution.service';
import { AssignmentService } from '../assignment/assignment.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, defaultIfEmpty } from 'rxjs';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    private assignmentService: AssignmentService,
    @InjectRepository(TaskExecution)
    private executionRepository: Repository<TaskExecution>,
    @InjectRepository(TaskExecutionAnswer)
    private answerRepository: Repository<TaskExecutionAnswer>,
    @InjectRepository(EmployeeDailyPoints)
    private employeeDailyPointsRepository: Repository<EmployeeDailyPoints>,
    @InjectRepository(EmployeeDailyTaskPoints)
    private employeeDailyTaskPointsRepository: Repository<EmployeeDailyTaskPoints>,
    @InjectRepository(ManagerDailyPayout)
    private managerDailyPayoutRepository: Repository<ManagerDailyPayout>,
    private executionService: ExecutionService,
    private httpService: HttpService,
    @Inject('NOTIFICATIONS_RMQ')
    private readonly notificationsClient: ClientProxy,
  ) {}

  /**
   * Cron job de test care rulează din minut în minut (pentru testare)
   * Finalizează automat task-urile active nefinalizate și scade punctele angajaților
   */
  //   @Cron(CronExpression.EVERY_MINUTE)
  //   async handleTestTaskCompletion() {
  //     this.logger.log('🧪 [TEST] Starting test task completion cron job (every minute)...');

  //     try {
  //       await this.processActiveTasks();
  //     } catch (error) {
  //       this.logger.error('❌ Error in test task completion cron job:', error);
  //     }
  //   }

  /**
   * Finalizare automată la miezul nopții DEZACTIVATĂ.
   * Finalizarea zilei (sarcini nefinalizate + scădere puncte) se declanșează la introducerea încasării pentru ziua respectivă (endpoint complete-day).
   */
  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // async handleDailyTaskCompletion() {
  //   this.logger.log('🕛 Starting daily task completion cron job...');
  //   try {
  //     await this.processActiveTasks(new Date(), false);
  //   } catch (error) {
  //     this.logger.error('❌ Error in daily task completion cron job:', error);
  //   }
  // }

  /**
   * Cron job care rulează la 00:00 pentru curățarea task-urilor FCFS nepreluate
   * Șterge doar task-urile FCFS cu status ASSIGNED și assigned_to_id = NULL
   * Task-urile DEACTIVATED rămân în istoric
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleFCFSCleanup() {
    this.logger.log('🧹 Starting FCFS unaccepted tasks cleanup...');

    try {
      const result = await this.assignmentRepository.delete({
        assignment_mode: 'first_come_first_served' as any,
        assigned_to_id: IsNull(),
        status: AssignmentStatus.ASSIGNED, // Doar ASSIGNED, nu DEACTIVATED
      });

      const deletedCount = result.affected || 0;
      this.logger.log(
        `✅ Cleanup completed: deleted ${deletedCount} unaccepted FCFS tasks (DEACTIVATED tasks preserved)`,
      );
    } catch (error) {
      this.logger.error('❌ Error in FCFS cleanup cron job:', error);
    }
  }

  /**
   * Cron job care rulează pentru atribuirea automată FCFS
   * Gestionează task-urile cu "primul venit, primul servit" care nu au fost preluate
   */
  @Cron('0 */2 * * * *') // La fiecare 2 minute (pentru testare)
  // @Cron('0 0 */2 * * *') // La fiecare 2 ore (pentru producție) - decomentează când e cazul
  async handleFCFSAutoAssignment() {
    this.logger.log('🎯 Starting FCFS auto-assignment cron job...');

    try {
      await this.processFCFSAutoAssignment();
    } catch (error) {
      this.logger.error('❌ Error in FCFS auto-assignment cron job:', error);
    }
  }

  /**
   * Procesează task-urile active pentru o anumită zi: le finalizează ca nefinalizate și scade punctele.
   * Apelat la introducerea încasării pentru ziua respectivă (nu la miezul nopții).
   * @param forDate ziua pentru care se rulează (ex. 18.02.2026); dacă lipsește, se folosește startul zilei curente
   * @param locationId dacă e setat, se finalizează doar sarcinile din această locație (la încasare pe locație)
   */
  async processActiveTasksForDate(
    forDate?: Date,
    locationId?: number,
  ): Promise<{
    completedCount: number;
    totalPointsDeducted: number;
  }> {
    const targetDate = forDate ? new Date(forDate) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const forceCloseDay = !!forDate;
    return this.processActiveTasks(targetDate, forceCloseDay, locationId);
  }

  /**
   * Procesează task-urile active pentru ziua targetDate: finalizează ca nefinalizate și scade punctele.
   * @param forceCloseDay true = la încasare pentru ziua X: toate sarcinile din ziua X, fără verificare deadline
   * @param locationId dacă e setat, se procesează doar sarcinile din această locație
   */
  private async processActiveTasks(
    targetDate: Date,
    forceCloseDay = false,
    locationId?: number,
  ): Promise<{
    completedCount: number;
    totalPointsDeducted: number;
  }> {
    const today = targetDate;

    const whereConditions: any[] = [
      { status: AssignmentStatus.ASSIGNED },
      { status: AssignmentStatus.IN_PROGRESS },
      { status: AssignmentStatus.SCHEDULED },
    ];
    if (locationId != null) {
      whereConditions.forEach((c) => {
        c.location_id = locationId;
      });
      this.logger.log(`📍 [complete-day] Filtrare doar locația ${locationId}`);
    }

    const activeAssignments = await this.assignmentRepository.find({
      where: whereConditions,
      relations: ['elements', 'elements.task_element', 'template'],
    });

    this.logger.log(
      `📋 Found ${activeAssignments.length} active assignments to process`,
    );

    let completedCount = 0;
    let totalPointsDeducted = 0;

    for (const assignment of activeAssignments) {
      try {
        // Sarcina recurentă PĂRINTE (șablon) nu se finalizează – doar generează copii
        const isRecurringParent =
          (assignment as any).recurrence_settings?.enabled === true &&
          !(assignment as any).parent_recurrence_id;
        if (isRecurringParent) {
          this.logger.log(
            `🔄 Skipping task ${assignment.id} - recurring parent (template), not closing`,
          );
          continue;
        }

        // Verifică dacă task-ul este de grup cu "primul venit, primul servit"
        if (
          assignment.department_group_id &&
          assignment.assignment_mode === 'first_come_first_served'
        ) {
          this.logger.log(
            `🎯 Skipping task ${assignment.id} - group task with first_come_first_served mode (competitive task)`,
          );
          continue;
        }

        const shouldComplete = this.shouldCompleteTask(assignment, today, {
          forceCloseDay,
        });

        if (!shouldComplete) {
          this.logger.log(
            `⏭️ Skipping task ${assignment.id} - doesn't meet completion criteria`,
          );
          continue;
        }

        // Verifică dacă task-ul permite amânarea și dacă a fost amânat
        const allowPostponeElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'allow_postpone',
        );
        const hasAllowPostpone =
          allowPostponeElement && allowPostponeElement.value === 'true';

        // Debug logging pentru amânare
        this.logger.log(
          `🔍 [DEBUG] Task ${assignment.id}: hasAllowPostpone=${hasAllowPostpone}, was_postponed=${assignment.was_postponed}`,
        );
        this.logger.log(
          `🔍 [DEBUG] Task ${assignment.id}: allowPostponeElement=${allowPostponeElement ? 'found' : 'not found'}, value=${allowPostponeElement?.value}`,
        );
        this.logger.log(
          `🔍 [DEBUG] Task ${assignment.id}: assignment.was_postponed type=${typeof assignment.was_postponed}, value=${assignment.was_postponed}`,
        );
        this.logger.log(
          `🔍 [DEBUG] Task ${assignment.id}: All elements:`,
          assignment.elements?.map((el) => ({
            id: el.id,
            element_type: el.task_element?.element_type,
            value: el.value,
          })),
        );

        if (hasAllowPostpone && assignment.was_postponed === true) {
          // Task-ul a fost amânat - acordă puncte pentru amânare în loc să scadă
          this.logger.log(
            `⏸️ Task ${assignment.id} was postponed - awarding points for postponement`,
          );

          // Calculează punctele maxime pentru acest task
          const maxPoints = this.calculateMaxPointsForAssignment(assignment);

          // Creează execuția pentru task-ul amânat cu puncte pozitive
          await this.createPositiveExecution(
            assignment,
            maxPoints,
            today,
            'Task amânat - puncte acordate',
          );

          if (maxPoints > 0) {
            // Adaugă punctele în punctajul zilnic al angajatului
            await this.addDailyPoints(
              assignment.assigned_to_id,
              maxPoints,
              today,
            );

            totalPointsDeducted -= maxPoints; // Scădem din totalul scăzut (deci adăugăm)
            this.logger.log(
              `✅ Awarded ${maxPoints} points to employee ${assignment.assigned_to_id} for postponed task ${assignment.id}`,
            );
            await this.assignmentService.sendTaskNotificationForEmployee(
              'assignment.points_awarded',
              'Puncte câștigate',
              `Ai primit ${maxPoints} puncte pentru task-ul amânat.`,
              assignment.id,
              assignment.assigned_to_id,
            );
          } else {
            this.logger.log(
              `📋 Task ${assignment.id} has no points - created execution without point award`,
            );
          }
        } else {
          const maxPoints = this.calculateMaxPointsForAssignment(assignment);

          const savedExecution = await this.createNegativeExecution(
            assignment,
            maxPoints,
            today,
          );

          if (maxPoints > 0) {
            await this.deductDailyPoints(
              assignment.assigned_to_id,
              maxPoints,
              today,
              { executionId: savedExecution.id },
            );

            totalPointsDeducted += maxPoints;
            this.logger.log(
              `⚠️ Deducted ${maxPoints} points from employee ${assignment.assigned_to_id} for incomplete task ${assignment.id}`,
            );
            await this.assignmentService.sendTaskNotificationForEmployee(
              'assignment.points_deducted',
              'Puncte pierdute',
              `S-au dedus ${maxPoints} puncte pentru task-ul nefinalizat la timp.`,
              assignment.id,
              assignment.assigned_to_id,
            );
          } else {
            this.logger.log(
              `📋 Task ${assignment.id} has no points - created execution without point deduction`,
            );
          }
        }

        // Marchează task-ul ca fiind finalizat automat
        await this.assignmentRepository.update(assignment.id, {
          status: 'completed' as any,
          completed_at: today,
        });

        completedCount++;
        this.logger.log(
          `✅ Auto-completed task ${assignment.id} for employee ${assignment.assigned_to_id}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error processing assignment ${assignment.id}:`,
          error.message,
        );
      }
    }

    this.logger.log(
      `🎯 Cron job completed: ${completedCount} tasks auto-completed, ${totalPointsDeducted} total points deducted`,
    );
    return { completedCount, totalPointsDeducted };
  }

  /**
   * Verifică dacă un task trebuie finalizat bazat pe programat_la, vizibil_de_la sau recurență.
   * @param options.forceCloseDay când true (la încasare pentru ziua X): toate sarcinile din ziua X, fără verificare deadline
   */
  private shouldCompleteTask(
    assignment: TaskAssignment,
    today: Date,
    options?: { forceCloseDay?: boolean },
  ): boolean {
    const forceCloseDay = options?.forceCloseDay === true;
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    // La introducere încasare (forceCloseDay): orice sarcină activă a cărei zi = ziua închisă se finalizează (manuale + copii recurență)
    if (forceCloseDay) {
      const assignedAt = assignment.assigned_at
        ? new Date(assignment.assigned_at)
        : null;
      const scheduledAt = (assignment as any).scheduled_datetime
        ? new Date((assignment as any).scheduled_datetime)
        : null;
      const refDate = scheduledAt || assignedAt;
      if (refDate) {
        const refDay = new Date(refDate);
        refDay.setHours(0, 0, 0, 0);
        if (refDay.getTime() === todayStartMs) {
          this.logger.log(
            `📅 Task ${assignment.id} belongs to closed day (forceCloseDay, date match)`,
          );
          return true;
        }
      }
    }

    const programatLaElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'scheduled_datetime',
    );
    const vizibilDeLaElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'visible_from',
    );
    const recurrenceElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'recurrence',
    );
    const finalizedInElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'finalized_in',
    );

    // Dacă există programat_la, verifică dacă ziua = ziua din programat_la
    if (programatLaElement && programatLaElement.value) {
      const scheduledDate = new Date(programatLaElement.value.trim());
      scheduledDate.setHours(0, 0, 0, 0);
      if (scheduledDate.getTime() === todayStartMs) {
        this.logger.log(
          `📅 Task ${assignment.id} scheduled for today (programat_la)`,
        );
        return true;
      }
    }

    // Dacă există doar vizibil_de_la (fără programat_la), verifică dacă ziua = ziua din vizibil_de_la
    if (vizibilDeLaElement && vizibilDeLaElement.value && !programatLaElement) {
      const visibleDate = new Date(vizibilDeLaElement.value.trim());
      visibleDate.setHours(0, 0, 0, 0);
      if (visibleDate.getTime() === todayStartMs) {
        this.logger.log(
          `👁️ Task ${assignment.id} visible from today (vizibil_de_la)`,
        );
        return true;
      }
    }

    // Dacă există recurență, verifică dacă ziua de azi este în zilele de recurență
    if (recurrenceElement && recurrenceElement.value) {
      try {
        const recurrenceData = JSON.parse(recurrenceElement.value.trim());
        const recurringDays = recurrenceData.days || []; // [1, 2, 3, 4, 5] pentru L-V

        const todayWeekday = today.getDay(); // 0 = Duminică, 1 = Luni, etc.

        if (recurringDays.includes(todayWeekday)) {
          this.logger.log(
            `🔄 Task ${assignment.id} scheduled for today (recurrence)`,
          );
          return true;
        }
      } catch (e) {
        this.logger.warn(
          `Failed to parse recurrence data for task ${assignment.id}:`,
          e,
        );
      }
    }

    // Dacă există finalized_in: la forceCloseDay includem task-ul dacă data programării/atribuirii = today; altfel doar dacă deadline-ul a trecut
    if (finalizedInElement && finalizedInElement.value) {
      try {
        let taskDayStart: Date;
        if (programatLaElement && programatLaElement.value) {
          taskDayStart = new Date(programatLaElement.value.trim());
        } else {
          taskDayStart = new Date(assignment.assigned_at);
        }
        taskDayStart.setHours(0, 0, 0, 0);
        const belongsToDay = taskDayStart.getTime() === todayStartMs;

        if (forceCloseDay && belongsToDay) {
          this.logger.log(
            `📅 Task ${assignment.id} belongs to closed day (finalized_in, forceCloseDay)`,
          );
          return true;
        }

        const finalizedInValue = finalizedInElement.value.trim();
        let hours = 0;
        let minutes = 0;
        if (finalizedInValue.includes(':')) {
          const parts = finalizedInValue.split(':');
          hours = parseInt(parts[0]) || 0;
          minutes = parseInt(parts[1]) || 0;
        } else {
          hours = parseInt(finalizedInValue) || 0;
        }
        let startTime: Date;
        if (programatLaElement && programatLaElement.value) {
          startTime = new Date(programatLaElement.value);
        } else {
          startTime = new Date(assignment.assigned_at);
        }
        const deadline = new Date(
          startTime.getTime() + (hours * 60 + minutes) * 60 * 1000,
        );
        if (today.getTime() >= deadline.getTime()) {
          this.logger.log(
            `⏰ Task ${assignment.id} deadline expired (finalized_in: ${finalizedInValue}, deadline: ${deadline.toISOString()})`,
          );
          return true;
        }
      } catch (e) {
        this.logger.warn(
          `Failed to parse finalized_in data for task ${assignment.id}:`,
          e,
        );
      }
    }

    // Dacă nu există nicio condiție specială, finalizează task-ul
    if (
      !programatLaElement &&
      !vizibilDeLaElement &&
      !recurrenceElement &&
      !finalizedInElement
    ) {
      this.logger.log(
        `📋 Task ${assignment.id} has no special scheduling - completing`,
      );
      return true;
    }

    return false;
  }

  /**
   * Calculează punctele maxime pentru un assignment
   */
  private calculateMaxPointsForAssignment(assignment: TaskAssignment): number {
    let totalPoints = 0;

    for (const element of assignment.elements || []) {
      const elementType = element.task_element.element_type;

      if (elementType === 'scoring_simple') {
        totalPoints += element.task_element.simple_score_points || 0;
      } else if (elementType === 'scoring_boolean') {
        try {
          const scoringOptions = JSON.parse(
            element.task_element.scoring_options || '[]',
          );
          const maxPointsForElement = scoringOptions.reduce(
            (sum: number, option: any) => sum + (option.points || 0),
            0,
          );
          totalPoints += maxPointsForElement;
        } catch (e) {
          this.logger.warn(
            `Failed to parse scoring_options for element ${element.id}`,
          );
        }
      }
    }

    return totalPoints;
  }

  /**
   * Creează o execuție negativă pentru punctele pierdute. Returnează execuția salvată (pentru legătura cu EmployeeDailyTaskPoints).
   */
  private async createNegativeExecution(
    assignment: TaskAssignment,
    pointsToDeduct: number,
    completionDate: Date,
  ): Promise<TaskExecution> {
    const execution = this.executionRepository.create({
      task_assignment_id: assignment.id,
      employee_id: assignment.assigned_to_id,
      started_at: assignment.assigned_at,
      completed_at: completionDate,
      comment: `Task finalizat automat la ${completionDate.toISOString().split('T')[0]} - puncte deduse pentru nefinalizare`,
    });

    const savedExecution = await this.executionRepository.save(execution);

    for (const element of assignment.elements || []) {
      const elementType = element.task_element.element_type;

      if (
        elementType === 'scoring_simple' ||
        elementType === 'scoring_boolean'
      ) {
        const answer = this.answerRepository.create({
          task_execution_id: savedExecution.id,
          task_element_id: element.task_element_id,
          value: 'auto_completed',
          score_awarded:
            elementType === 'scoring_simple'
              ? -(element.task_element.simple_score_points || 0)
              : 0,
        });

        await this.answerRepository.save(answer);
      }
    }

    return savedExecution;
  }

  /**
   * Creează o execuție pozitivă pentru punctele acordate pentru amânare
   */
  private async createPositiveExecution(
    assignment: TaskAssignment,
    pointsToAward: number,
    completionDate: Date,
    comment: string,
  ): Promise<void> {
    // Creează execuția principală
    const execution = this.executionRepository.create({
      task_assignment_id: assignment.id,
      employee_id: assignment.assigned_to_id,
      started_at: assignment.assigned_at,
      completed_at: completionDate,
      comment: comment,
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Creează answers pentru elementele cu puncte - acordă punctele maxime
    for (const element of assignment.elements || []) {
      const elementType = element.task_element.element_type;

      if (elementType === 'scoring_simple') {
        const points = element.task_element.simple_score_points || 0;
        const answer = this.answerRepository.create({
          task_execution_id: savedExecution.id,
          task_element_id: element.task_element_id,
          value: 'postponed_awarded',
          score_awarded: points,
        });
        await this.answerRepository.save(answer);
      } else if (elementType === 'scoring_boolean') {
        try {
          const scoringOptions = JSON.parse(
            element.task_element.scoring_options || '[]',
          );
          const totalPoints = scoringOptions.reduce(
            (sum: number, option: any) => sum + (option.points || 0),
            0,
          );
          const answer = this.answerRepository.create({
            task_execution_id: savedExecution.id,
            task_element_id: element.task_element_id,
            value: 'postponed_awarded',
            score_awarded: totalPoints,
          });
          await this.answerRepository.save(answer);
        } catch (e) {
          this.logger.warn(
            `Failed to parse scoring_options for element ${element.id}`,
          );
        }
      }
    }
  }

  /**
   * Scade punctele din punctajul zilnic al angajatului.
   * Folosește DATE(work_date) pentru a evita probleme de timezone; înregistrează și în EmployeeDailyTaskPoints dacă executionId e dat.
   */
  private async deductDailyPoints(
    employeeId: number,
    pointsToDeduct: number,
    date: Date,
    options?: { executionId?: number },
  ): Promise<void> {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    let dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: Raw((alias) => `DATE(${alias}) = :dateStr`, { dateStr }),
      },
    });

    if (!dailyPoints) {
      dailyPoints = this.employeeDailyPointsRepository.create({
        employee_id: employeeId,
        work_date: new Date(dateStr + 'T12:00:00.000Z'),
        total_points: 0,
      });
      dailyPoints = await this.employeeDailyPointsRepository.save(dailyPoints);
    }

    if (options?.executionId != null) {
      const existingLink = await this.employeeDailyTaskPointsRepository.findOne(
        {
          where: {
            employee_daily_points_id: dailyPoints.id,
            task_execution_id: options.executionId,
          },
        },
      );
      if (!existingLink) {
        await this.employeeDailyTaskPointsRepository.save(
          this.employeeDailyTaskPointsRepository.create({
            employee_daily_points_id: dailyPoints.id,
            task_execution_id: options.executionId,
            points_awarded: -pointsToDeduct,
          }),
        );
      }
    }

    const sumResult = await this.employeeDailyTaskPointsRepository
      .createQueryBuilder('tp')
      .select('COALESCE(SUM(tp.points_awarded), 0)', 'total')
      .where('tp.employee_daily_points_id = :id', { id: dailyPoints.id })
      .getRawOne<{ total: string }>();

    dailyPoints.total_points = parseFloat(sumResult?.total ?? '0') || 0;
    await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  /**
   * Adaugă punctele în punctajul zilnic al angajatului
   */
  private async addDailyPoints(
    employeeId: number,
    pointsToAdd: number,
    date: Date,
  ): Promise<void> {
    const workDate = new Date(date);
    workDate.setHours(0, 0, 0, 0);

    // Verifică dacă există deja punctaj zilnic pentru această zi
    let dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: workDate,
      },
    });

    if (dailyPoints) {
      // Adaugă punctele la punctajul existent
      dailyPoints.total_points += pointsToAdd;
    } else {
      // Creează un punctaj zilnic nou cu punctele pozitive
      dailyPoints = this.employeeDailyPointsRepository.create({
        employee_id: employeeId,
        work_date: workDate,
        total_points: pointsToAdd,
      });
    }

    await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  /**
   * Endpoint manual pentru a rula cron job-ul FCFS (pentru testare)
   */
  async runManualFCFSAutoAssignment(): Promise<{
    message: string;
    processedTasks: number;
    autoAssignedTasks: number;
    deletedTasks: number;
  }> {
    this.logger.log('🔧 Running manual FCFS auto-assignment...');

    try {
      await this.processFCFSAutoAssignment();

      // Recalculează statisticile pentru răspuns
      const now = new Date();
      const fcfsAssignments = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.ASSIGNED,
          assignment_mode: 'first_come_first_served' as any,
          department_group_id: Not(IsNull()),
        },
      });

      return {
        message: `Manual FCFS auto-assignment completed. Found ${fcfsAssignments.length} remaining FCFS assignments.`,
        processedTasks: fcfsAssignments.length,
        autoAssignedTasks: 0, // Se va calcula în funcția principală
        deletedTasks: 0, // Se va calcula în funcția principală
      };
    } catch (error) {
      this.logger.error('❌ Error in manual FCFS auto-assignment:', error);
      throw error;
    }
  }

  /**
   * Endpoint manual pentru a rula cron job-ul (pentru testare)
   */
  async runManualTaskCompletion(): Promise<{
    message: string;
    completedTasks: number;
    totalPointsDeducted: number;
  }> {
    this.logger.log('🔧 Running manual task completion...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeAssignments = await this.assignmentRepository.find({
      where: [
        { status: AssignmentStatus.ASSIGNED },
        { status: AssignmentStatus.IN_PROGRESS },
        { status: AssignmentStatus.SCHEDULED },
      ],
      relations: ['elements', 'elements.task_element'],
    });

    let completedCount = 0;
    let totalPointsDeducted = 0;

    for (const assignment of activeAssignments) {
      const maxPoints = this.calculateMaxPointsForAssignment(assignment);

      const savedExecution = await this.createNegativeExecution(
        assignment,
        maxPoints,
        today,
      );

      if (maxPoints > 0) {
        await this.deductDailyPoints(
          assignment.assigned_to_id,
          maxPoints,
          today,
          { executionId: savedExecution.id },
        );
        totalPointsDeducted += maxPoints;
      }

      await this.assignmentRepository.update(assignment.id, {
        status: 'completed' as any,
        completed_at: today,
      });

      completedCount++;
    }

    return {
      message: `Manual task completion completed: ${completedCount} tasks processed, ${totalPointsDeducted} points deducted`,
      completedTasks: completedCount,
      totalPointsDeducted,
    };
  }

  /**
   * Procesează atribuirea automată pentru task-urile FCFS (First Come First Served)
   */
  private async processFCFSAutoAssignment(): Promise<void> {
    const now = new Date();

    // Găsește toate task-urile FCFS care sunt în status ASSIGNED și nu au fost preluate (assigned_to_id = NULL)
    const fcfsAssignments = await this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.ASSIGNED,
        assignment_mode: 'first_come_first_served' as any,
        department_group_id: Not(IsNull()), // Doar task-urile de grup
        assigned_to_id: IsNull(), // Doar task-urile neacceptate încă
      },
      relations: ['elements', 'elements.task_element', 'template'],
    });

    this.logger.log(
      `🎯 Found ${fcfsAssignments.length} unassigned FCFS tasks to process`,
    );

    let processedCount = 0;
    let autoAssignedCount = 0;
    let deactivatedCount = 0;

    // Procesează fiecare task FCFS (fiecare grup are deja UN SINGUR task cu assigned_to_id = NULL)
    for (const assignment of fcfsAssignments) {
      try {
        const result = await this.processFCFSAssignment(assignment, now);

        if (result.action === 'auto_assigned') {
          autoAssignedCount++;
        } else if (result.action === 'deactivated') {
          deactivatedCount++;
        }

        processedCount++;
        this.logger.log(
          `✅ Processed FCFS assignment ${assignment.id}: ${result.action}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error processing FCFS assignment ${assignment.id}:`,
          error.message,
        );
      }
    }

    this.logger.log(
      `🎯 FCFS auto-assignment completed: ${processedCount} processed, ${autoAssignedCount} auto-assigned, ${deactivatedCount} deactivated`,
    );
  }

  /**
   * Procesează un singur task FCFS și decide ce acțiune să ia
   */
  private async processFCFSAssignment(
    assignment: TaskAssignment,
    now: Date,
  ): Promise<{ action: string; details?: any }> {
    const assignedAt = new Date(assignment.assigned_at);
    const hoursSinceAssigned =
      (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);

    this.logger.log(
      `🔍 [FCFS-DEBUG] Task ${assignment.id}: hoursSinceAssigned=${hoursSinceAssigned.toFixed(2)}`,
    );

    // Verifică dacă au trecut 3 ore de la atribuire (pentru testare: 3 minute = 0.05 ore)
    const waitingHours = 0.05; // 3 minute pentru testare - schimbă la 3 pentru producție
    // const waitingHours = 3; // 3 ore pentru producție - decomentează când e cazul

    if (hoursSinceAssigned < waitingHours) {
      this.logger.log(
        `🔍 [FCFS-DEBUG] Task ${assignment.id}: Still waiting (${hoursSinceAssigned.toFixed(2)} hours < ${waitingHours})`,
      );
      return { action: 'waiting', details: { hoursSinceAssigned } };
    }

    // Calculează orele până la 00:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hoursUntilMidnight =
      (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Verifică dacă task-ul are finalized_in, finalized_la sau finish_at
    const finalizedInElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'finalized_in',
    );
    const finalizedLaElement = assignment.elements?.find(
      (el) => el.task_element.element_type === ('finalized_la' as any),
    );
    const finishAtElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'finish_at',
    );

    // Verifică dacă task-ul permite amânare
    const allowPostponeElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'allow_postpone',
    );
    const allowsPostpone =
      allowPostponeElement && allowPostponeElement.value === 'true';

    this.logger.log(
      `🔍 [FCFS-DEBUG] Task ${assignment.id}: finalizedInElement=${finalizedInElement ? `"${finalizedInElement.value.trim()}"` : 'null'}, finalizedLaElement=${finalizedLaElement ? `"${finalizedLaElement.value.trim()}"` : 'null'}, finishAtElement=${finishAtElement ? `"${finishAtElement.value.trim()}"` : 'null'}, allowsPostpone=${allowsPostpone}`,
    );

    // Debug: afișează toate elementele task-ului
    if (assignment.elements && assignment.elements.length > 0) {
      this.logger.log(
        `🔍 [FCFS-DEBUG] Task ${assignment.id} elements:`,
        assignment.elements.map((el) => ({
          element_type: el.task_element.element_type,
          value: el.value,
        })),
      );
    } else {
      this.logger.log(
        `🔍 [FCFS-DEBUG] Task ${assignment.id}: No elements found`,
      );
    }

    // Logica de decizie - SIMPLIFICATĂ: Auto-atribuie întotdeauna după perioada de așteptare
    // Comentat: verificarea celor 4 ore până la midnight/deadline - acum poți posta oricând task-uri
    /*
    // LOGICA VECHE - comentată pentru a permite postarea oricând a task-urilor
    if ((!finalizedInElement || !finalizedInElement.value) && (!finalizedLaElement || !finalizedLaElement.value) && (!finishAtElement || !finishAtElement.value)) {
      // Nu există finalized_in, finalized_la sau finish_at
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: No finalized_in, finalized_la or finish_at, hoursUntilMidnight=${hoursUntilMidnight.toFixed(2)}`);
      if (hoursUntilMidnight > 4) {
        // Mai mult de 4 ore până la 00:00 - atribuie după 3 ore
        this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (no deadline elements, >4h to midnight)`);
        return await this.autoAssignFCFSTask(assignment);
      } else {
        // Mai puțin de 4 ore până la 00:00 - DEZACTIVEAZĂ task-ul
        this.logger.log(`⏸️ [FCFS-DEBUG] Task ${assignment.id}: Deactivating (no deadline elements, <4h to midnight)`);
        await this.assignmentRepository.update(assignment.id, {
          status: AssignmentStatus.DEACTIVATED
        });
        return { action: 'deactivated', details: { reason: 'less_than_4_hours_to_midnight', hoursUntilMidnight } };
      }
    } else {
      // Există finalized_in, finalized_la sau finish_at
      let deadline: Date;
      let deadlineType: string;
      
      if (finalizedInElement && finalizedInElement.value) {
        deadline = this.calculateDeadlineFromFinalizedIn(assignment, finalizedInElement.value.trim());
        deadlineType = 'finalized_in';
      } else if (finalizedLaElement && finalizedLaElement.value) {
        deadline = new Date(finalizedLaElement.value.trim());
        deadlineType = 'finalized_la';
      } else {
        deadline = new Date(finishAtElement!.value.trim());
        deadlineType = 'finish_at';
      }
      
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: ${deadlineType}="${finalizedInElement?.value?.trim() || finalizedLaElement?.value?.trim() || finishAtElement?.value?.trim()}", deadline="${deadline.toISOString()}", hoursUntilDeadline=${hoursUntilDeadline.toFixed(2)}`);

      if (hoursUntilDeadline > 4) {
        // Mai mult de 4 ore până la deadline
        this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: >4h to deadline, allowsPostpone=${allowsPostpone}`);
        if (!allowsPostpone) {
          // Nu există amânare - atribuie după 2 ore
          this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (>4h to deadline, no postpone)`);
          return await this.autoAssignFCFSTask(assignment);
        } else {
          // Există amânare
          if (hoursUntilMidnight > 4) {
            // Mai mult de 4 ore până la 00:00 - atribuie după 3 ore
            this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (>4h to deadline, with postpone, >4h to midnight)`);
            return await this.autoAssignFCFSTask(assignment);
          } else {
            // Mai puțin de 4 ore până la 00:00 - DEZACTIVEAZĂ task-ul
            this.logger.log(`⏸️ [FCFS-DEBUG] Task ${assignment.id}: Deactivating (>4h to deadline, with postpone, <4h to midnight)`);
            await this.assignmentRepository.update(assignment.id, {
              status: AssignmentStatus.DEACTIVATED
            });
            return { action: 'deactivated', details: { reason: 'less_than_4_hours_to_midnight_with_postpone', hoursUntilMidnight } };
          }
        }
      } else {
        // Mai puțin de 4 ore până la deadline - DEZACTIVEAZĂ task-ul
        this.logger.log(`⏸️ [FCFS-DEBUG] Task ${assignment.id}: Deactivating (<4h to deadline)`);
        await this.assignmentRepository.update(assignment.id, {
          status: AssignmentStatus.DEACTIVATED
        });
        return { action: 'deactivated', details: { reason: 'less_than_4_hours_to_deadline', hoursUntilDeadline } };
      }
    }
    */

    // LOGICA NOUĂ: Atribuie automat întotdeauna după perioada de așteptare
    this.logger.log(
      `🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (no restrictions - 4h checks disabled)`,
    );
    return await this.autoAssignFCFSTask(assignment);
  }

  /**
   * Atribuie automat un task FCFS unui angajat random din departament
   * Simplu: doar UPDATE assigned_to_id, fără DELETE (task-ul e deja unic)
   */
  private async autoAssignFCFSTask(
    assignment: TaskAssignment,
  ): Promise<{ action: string; details?: any }> {
    try {
      this.logger.log(
        `🔍 [AUTO-ACCEPT] ==========================================`,
      );
      this.logger.log(
        `🔍 [AUTO-ACCEPT] Auto-accepting task ${assignment.id} for department group: ${assignment.department_group_id}`,
      );
      this.logger.log(
        `🔍 [AUTO-ACCEPT] ==========================================`,
      );

      // Extrage department_id din department_group_id (format: dept_X_timestamp_random)
      const departmentId = assignment.department_group_id?.split('_')[1];

      if (!departmentId) {
        this.logger.warn(
          `⚠️ Cannot extract department ID from group ID: ${assignment.department_group_id}`,
        );
        return { action: 'invalid_group_id' };
      }

      this.logger.log(
        `🔍 [AUTO-ACCEPT] Department ID extracted: ${departmentId}`,
      );

      // Obține angajații care lucrează în departament ÎN ZIUA task-ului (din shifts)
      const taskDate = new Date(assignment.assigned_at)
        .toISOString()
        .split('T')[0];
      this.logger.log(
        `🔍 [AUTO-ACCEPT] Getting employees working on date: ${taskDate}`,
      );

      const departmentEmployees = await this.getEmployeesWorkingOnDate(
        parseInt(departmentId),
        taskDate,
      );

      if (!departmentEmployees || departmentEmployees.length === 0) {
        this.logger.warn(
          `⚠️ No employees found working in department ${departmentId} on ${taskDate}`,
        );
        return { action: 'no_employees' };
      }

      this.logger.log(
        `🔍 [AUTO-ACCEPT] Found ${departmentEmployees.length} employees working in department on ${taskDate}`,
      );

      // Alege un angajat random
      const randomIndex = Math.floor(
        Math.random() * departmentEmployees.length,
      );
      const selectedEmployee = departmentEmployees[randomIndex];

      this.logger.log(
        `🔍 [AUTO-ACCEPT] Selected employee: ${selectedEmployee.id} (${selectedEmployee.first_name} ${selectedEmployee.last_name})`,
      );

      // Actualizează task-ul: setează assigned_to_id (task-ul devine al angajatului)
      this.logger.log(
        `🔍 [AUTO-ACCEPT] Updating task ${assignment.id} assigned_to_id to ${selectedEmployee.id}...`,
      );

      const updateResult = await this.assignmentRepository.update(
        assignment.id,
        {
          assigned_to_id: selectedEmployee.id,
          status: AssignmentStatus.ASSIGNED,
        },
      );

      this.logger.log(`🔍 [AUTO-ACCEPT] Update result:`, updateResult);
      this.logger.log(
        `✅ [AUTO-ACCEPT] Task ${assignment.id} auto-assigned to employee ${selectedEmployee.id}`,
      );

      this.logger.log(
        `🔍 [AUTO-ACCEPT] ==========================================`,
      );
      this.logger.log(
        `✅ [AUTO-ACCEPT] Task auto-acceptance completed successfully!`,
      );
      this.logger.log(
        `🔍 [AUTO-ACCEPT] ==========================================`,
      );

      return {
        action: 'auto_assigned',
        details: {
          assignedTo: selectedEmployee.id,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error auto-assigning FCFS task ${assignment.id}:`,
        error.message,
      );
      return { action: 'error', details: { error: error.message } };
    }
  }

  /**
   * Calculează deadline-ul bazat pe finalized_in
   */
  private calculateDeadlineFromFinalizedIn(
    assignment: TaskAssignment,
    finalizedInValue: string,
  ): Date {
    let hours = 0;
    let minutes = 0;

    if (finalizedInValue.includes(':')) {
      // Format "2:30" - ore:minute
      const parts = finalizedInValue.split(':');
      hours = parseInt(parts[0]) || 0;
      minutes = parseInt(parts[1]) || 0;
    } else {
      // Format "2" - doar ore
      hours = parseInt(finalizedInValue) || 0;
    }

    // Calculează deadline-ul: assigned_at + finalized_in
    const assignedAt = new Date(assignment.assigned_at);
    return new Date(assignedAt.getTime() + (hours * 60 + minutes) * 60 * 1000);
  }

  /**
   * Obține angajații care lucrează într-un departament într-o anumită zi (din shifts)
   */
  private async getEmployeesWorkingOnDate(
    departmentId: number,
    date: string,
  ): Promise<Array<{
    id: number;
    first_name: string;
    last_name: string;
  }> | null> {
    try {
      this.logger.log(
        `🔍 Getting employees working in department ${departmentId} on ${date} from attendance shifts`,
      );

      // Obține shift-urile din ziua respectivă
      const shiftsResponse = await firstValueFrom(
        this.httpService.get(
          `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=3&limit=1000`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret':
                process.env.SERVICE_SECRET || 'default-service-secret',
              'x-api-key':
                process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Extrage array-ul de shifts (format: { data: [...], total, page, limit })
      let allShifts: any[] = [];
      if (Array.isArray(shiftsResponse.data)) {
        allShifts = shiftsResponse.data;
      } else if (
        shiftsResponse.data &&
        Array.isArray(shiftsResponse.data.data)
      ) {
        allShifts = shiftsResponse.data.data;
      }

      // Filtrează shift-urile pentru data și departamentul specificat
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      const relevantShifts = allShifts.filter((shift: any) => {
        const shiftStart = new Date(shift.start_datetime);
        shiftStart.setHours(0, 0, 0, 0);
        return (
          shiftStart.getTime() === targetDate.getTime() &&
          shift.department_id === departmentId
        );
      });

      if (relevantShifts.length === 0) {
        return [];
      }

      // Extrage employee_ids unici din shifts
      const employeeIds = [
        ...new Set(relevantShifts.map((s: any) => s.employee_id)),
      ];
      this.logger.log(`🔍 Employee IDs working on ${date}:`, employeeIds);

      // Evită apelul către serviciul employees (poate răspunde 401 în context cron)
      this.logger.log(
        `✅ Using attendance-only data for working employees in department ${departmentId} on ${date}`,
      );
      return employeeIds.map((id: number) => ({
        id,
        first_name: 'N/A',
        last_name: '',
      }));
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status ?? error?.code;
      const msg = (error?.message ?? error?.response?.data?.message ?? '') + '';
      const is401 = status === 401 || msg.includes('401');
      if (is401) {
        this.logger.warn(
          `⚠️ Attendance API 401 for date ${date} – cron continuă fără angajați din shifts`,
        );
      } else {
        this.logger.error(
          `❌ Error getting employees working on date ${date}:`,
          error?.message ?? error,
        );
      }
      return null;
    }
  }

  /**
   * Obține angajații dintr-un departament (DEPRECATED - folosește getEmployeesWorkingOnDate)
   */
  private async getDepartmentEmployees(
    departmentGroupId: string,
  ): Promise<Array<{
    id: number;
    first_name: string;
    last_name: string;
  }> | null> {
    try {
      // DEPRECATED: evită apelul către employees pentru a preveni 401.
      this.logger.log(
        `🔍 [DEPRECATED] getDepartmentEmployees called for group ${departmentGroupId} → returning empty without external calls`,
      );
      return [];
    } catch (error) {
      this.logger.error(
        `❌ Error getting department employees for group ${departmentGroupId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Obține informațiile despre angajați după ID-uri
   */
  private async getEmployeesByIds(employeeIds: number[]): Promise<Array<{
    id: number;
    first_name: string;
    last_name: string;
  }> | null> {
    try {
      // Evită complet employees service; construiește placeholder minimal
      this.logger.log(
        `🔍 Building minimal employee placeholders for IDs: ${employeeIds.join(', ')}`,
      );
      return (employeeIds || []).map((id) => ({
        id,
        first_name: 'N/A',
        last_name: '',
      }));
    } catch (error) {
      this.logger.error(
        `❌ Error getting employees by IDs ${employeeIds.join(', ')}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Cron: realocare automată – la fiecare minut, sarcinile expirate sunt realocate
   * (copie + scadere puncte + REALLOCATED) către un angajat pontat aleatoriu.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredTaskReassignment() {
    this.logger.log('🔄 Starting expired task reassignment cron job...');
    try {
      await this.processExpiredTasks();
    } catch (error) {
      this.logger.error(
        '❌ Error in expired task reassignment cron job:',
        error,
      );
    }
  }

  // La miezul nopții: marchează ca 'completed' toate task-urile nefinalizate din ziua anterioară (fără puncte)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async completeUnfinishedAssignmentsForPreviousDay() {
    try {
      const now = new Date();
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      const dateStr = prev.toISOString().split('T')[0];
      this.logger.log(
        `🕛 [CronService] Auto-complete unfinished assignments for ${dateStr}`,
      );

      const assignments = await this.assignmentRepository
        .createQueryBuilder('a')
        .where('(a.status = :s1 OR a.status = :s2)', {
          s1: 'assigned',
          s2: 'in_progress',
        })
        .andWhere(
          '(DATE(a.assigned_at) = :d OR DATE(a.scheduled_datetime) = :d)',
          { d: dateStr },
        )
        .getMany();
      this.logger.log(
        `🕛 [CronService] Found ${assignments.length} unfinished assignments on ${dateStr}`,
      );

      if (assignments.length > 0) {
        for (const a of assignments) {
          await this.assignmentRepository.update(a.id, {
            status: 'completed' as any,
            notes: `${a.notes || ''}\n✅ Auto-completat la miezul nopții pentru ziua ${dateStr} (fără puncte)`,
          });
        }
        this.logger.log(
          `🕛 [CronService] Marked ${assignments.length} assignments as completed without points`,
        );
      }
    } catch (err) {
      this.logger.error(
        '❌ [CronService] Auto-complete job failed:',
        err?.message || err,
      );
    }
  }

  /**
   * Procesează task-urile expirate și le reatribuie la alți angajați
   */
  private async processExpiredTasks(): Promise<void> {
    const now = new Date();

    // Găsește toate task-urile active (assigned sau in_progress)
    const activeAssignments = await this.assignmentRepository.find({
      where: [
        { status: AssignmentStatus.ASSIGNED },
        { status: AssignmentStatus.IN_PROGRESS },
      ],
      relations: ['elements', 'elements.task_element', 'template'],
    });

    this.logger.log(
      `📋 Found ${activeAssignments.length} active assignments to check for expiration`,
    );

    let reassignedCount = 0;

    for (const assignment of activeAssignments) {
      try {
        if (!assignment.assigned_to_id) continue;
        // Nu mai sărim task-urile de grup FCFS la expirare: se realochează la un angajat random din pontaj (fără manager)
        if ((assignment as any).reallocation_attempted_at != null) continue;
        // Dacă angajatul a făcut deja realocarea manuală, nu se mai face și automat (o singură realocare: fie automată, fie manuală)
        if ((assignment as any).reallocation_trigger === 'employee') continue;

        // Doar șabloanele recurente (părinte) nu se realochează; copiii recurenți (parent_recurrence_id setat) pot fi amânați și realocați
        const isRecurringParent =
          (assignment as any).recurrence_settings?.enabled === true &&
          !(assignment as any).parent_recurrence_id;
        if (isRecurringParent) continue;

        const isExpired = this.isTaskExpired(assignment, now);
        if (!isExpired) continue;

        // Dacă task-ul permite amânare și nu a fost amânat încă, amânare automată (due_date += minute); realocarea după noul termen
        try {
          const postponed =
            await this.assignmentService.autoPostponeExpiredTask(assignment);
          if (postponed) {
            this.logger.log(
              `⏸️ Task ${assignment.id} amânat automat – realocarea va fi după noul termen`,
            );
            continue;
          }
        } catch (postponeErr) {
          this.logger.warn(
            `⚠️ Auto-postpone failed for task ${assignment.id}: ${postponeErr?.message || postponeErr}`,
          );
        }

        // Realocarea este permisă doar dacă task-ul are permite_realocare !== false
        if ((assignment as any).permite_realocare === false) {
          this.logger.log(
            `⏭️ Task ${assignment.id} expirat dar permite_realocare=false – nu se realochează`,
          );
          continue;
        }

        this.logger.log(
          `⏰ Task ${assignment.id} has expired - attempting reallocation (o singură încercare)`,
        );

        await this.assignmentRepository.update(assignment.id, {
          reallocation_attempted_at: now,
        } as any);

        try {
          await this.assignmentService.reallocateAssignment(
            assignment.id,
            undefined,
            true,
            false,
            'cron',
          );
          reassignedCount++;
          this.logger.log(
            `✅ Successfully reallocated expired task ${assignment.id}`,
          );
        } catch (reallocErr) {
          this.logger.warn(
            `⚠️ Could not reallocate task ${assignment.id}: ${reallocErr?.message || reallocErr}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Error processing expired task ${assignment.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `✅ Expired task reassignment completed: ${reassignedCount} tasks reassigned`,
    );
  }

  /**
   * Verifică dacă un task a expirat.
   * Folosește întotdeauna assignment.due_date când există, ca să fie același termen „până la” ca în UI.
   */
  private isTaskExpired(assignment: TaskAssignment, now: Date): boolean {
    const nowTime = now.getTime();

    // Sursă unică pentru termen: due_date („până la”) – pentru amânat, realocat sau normal
    if (assignment.due_date) {
      const dueTime = new Date(assignment.due_date).getTime();
      return nowTime > dueTime;
    }

    // Fallback fără due_date (nu ar trebui să apară în scenariul normal)

    // Caută elementul finish_at pentru deadline fix
    const finishAtElement = assignment.elements?.find(
      (el) => el.task_element?.element_type === 'finish_at',
    );

    if (finishAtElement?.value) {
      try {
        const deadline = new Date(finishAtElement.value);
        return now > deadline;
      } catch (e) {
        return false;
      }
    }

    // Caută elementul finalized_in pentru deadline calculat
    const finalizedInElement = assignment.elements?.find(
      (el) => el.task_element?.element_type === 'finalized_in',
    );

    if (finalizedInElement?.value) {
      try {
        // Folosește aceeași logică ca în shouldCompleteTask pentru consistență
        const finalizedInValue = finalizedInElement.value.trim();
        let hours = 0;
        let minutes = 0;

        if (finalizedInValue.includes(':')) {
          // Format "2:30" - ore:minute
          const parts = finalizedInValue.split(':');
          hours = parseInt(parts[0]) || 0;
          minutes = parseInt(parts[1]) || 0;
        } else {
          // Format "2" - doar ore
          hours = parseInt(finalizedInValue) || 0;
        }

        // Calculează deadline-ul:
        // - Dacă există scheduled_datetime (programat_la), pornește de la acolo
        // - Altfel, pornește de la assigned_at
        const programatLaElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'scheduled_datetime',
        );

        let startTime: Date;
        if (programatLaElement && programatLaElement.value) {
          startTime = new Date(programatLaElement.value);
          this.logger.log(
            `⏰ Task ${assignment.id} - Cronometru expiră de la scheduled_datetime: ${startTime.toISOString()}`,
          );
        } else {
          startTime = new Date(assignment.assigned_at);
          this.logger.log(
            `⏰ Task ${assignment.id} - Cronometru expiră de la assigned_at: ${startTime.toISOString()}`,
          );
        }

        const deadline = new Date(
          startTime.getTime() + (hours * 60 + minutes) * 60 * 1000,
        );

        this.logger.log(
          `⏰ Task ${assignment.id} deadline check: now=${now.toISOString()}, deadline=${deadline.toISOString()}, expired=${now > deadline}`,
        );

        return now > deadline;
      } catch (e) {
        this.logger.warn(
          `Failed to parse finalized_in data for task ${assignment.id}:`,
          e,
        );
        return false;
      }
    }

    return false;
  }

  /**
   * Reatribuie un task expirat la alt angajat disponibil
   */
  private async reassignExpiredTask(
    assignment: TaskAssignment,
    now: Date,
  ): Promise<boolean> {
    try {
      // Obține locația task-ului (din elementele task-ului)
      const locationElement = assignment.elements?.find(
        (el) => el.task_element?.element_type === 'work_location',
      );

      let locationId = locationElement?.value
        ? parseInt(locationElement.value)
        : null;
      if (!locationId && (assignment as any)?.location_id) {
        locationId = Number((assignment as any).location_id);
        this.logger.log(
          `📍 Using assignment.location_id as fallback for task ${assignment.id}: ${locationId}`,
        );
      }

      // Eliminăm fallback-ul către employees pentru a evita 401 în context de cron

      if (!locationId) {
        this.logger.log(
          `⚠️ Could not determine location for task ${assignment.id}`,
        );
        return false;
      }

      // Obține data pentru care trebuie să găsim angajați (ziua curentă)
      const targetDate = new Date(now);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Apelează serviciul de attendance pentru a găsi shift-urile active
      let availableEmployees: any[] = [];

      try {
        const attendanceUrl = `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${locationId}&limit=1000`;
        const secret = process.env.SERVICE_SECRET || 'default-service-secret';
        const headers = {
          'x-internal-service': 'veziv-tasks',
          'x-service-secret': secret,
          'x-api-key': secret,
          'Content-Type': 'application/json',
        } as Record<string, string>;
        this.logger.log(`🔍 Calling attendance service: ${attendanceUrl}`);
        this.logger.log(
          `🔍 Attendance headers: { x-internal-service: ${headers['x-internal-service']}, x-service-secret: [len:${headers['x-service-secret']?.length || 0}], x-api-key: [len:${headers['x-api-key']?.length || 0}], content-type: ${headers['Content-Type']} }`,
        );

        const shiftsResponse = await firstValueFrom(
          this.httpService.get(attendanceUrl, { headers }),
        );
        this.logger.log(
          `✅ Attendance response: status=${shiftsResponse.status} hasData=${Boolean(shiftsResponse.data)} type=${Array.isArray(shiftsResponse.data) ? 'array' : typeof shiftsResponse.data}`,
        );

        // Extrage array-ul de shifts (format: { data: [...], total, page, limit })
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (
          shiftsResponse.data &&
          Array.isArray(shiftsResponse.data.data)
        ) {
          allShifts = shiftsResponse.data.data;
        }

        // Filtrează shift-urile pentru ziua curentă
        const todayShifts = allShifts.filter((shift: any) => {
          const shiftDate = new Date(shift.start_datetime);
          return shiftDate.toISOString().split('T')[0] === dateStr;
        });

        this.logger.log(
          `📋 Found ${todayShifts.length} shifts for location ${locationId} on ${dateStr}`,
        );

        // Extrage ID-urile unice ale angajaților cu shift astăzi
        const employeeIds = [
          ...new Set(todayShifts.map((shift: any) => shift.employee_id)),
        ];
        this.logger.log(
          `📋 Unique employee IDs with shifts: ${employeeIds.join(', ')}`,
        );

        // Construiește candidații direct din IDs (evită apelul către employees)
        availableEmployees = employeeIds.map((id: number) => ({
          id,
          first_name: 'N/A',
          last_name: '',
        }));
        this.logger.log(
          `📋 Built available employees from attendance: ${availableEmployees.length}`,
        );
      } catch (error) {
        const status = error?.response?.status;
        const data = error?.response?.data;
        const errHeaders = error?.response?.headers;
        this.logger.error(
          `❌ Error fetching employees from attendance service: ${status || ''} ${error?.message || error}`,
        );
        if (status) this.logger.error(`❌ Attendance error status: ${status}`);
        if (data)
          this.logger.error(
            `❌ Attendance error body: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
          );
        if (errHeaders)
          this.logger.error(
            `❌ Attendance error headers: ${JSON.stringify(errHeaders)}`,
          );
        this.logger.error(
          `❌ Used headers summary: { x-internal-service: veziv-tasks, x-service-secret:[len:${(process.env.SERVICE_SECRET || '').length}], x-api-key:[len:${(process.env.SERVICE_SECRET || '').length}] }`,
        );

        // Fallback: deduce working employees from today's assignments at this location
        try {
          this.logger.warn(
            `⚠️ Falling back to assignments-based candidate discovery for location ${locationId} on ${dateStr}`,
          );
          const qb = this.assignmentRepository
            .createQueryBuilder('assignment')
            .select([
              'assignment.assigned_to_id',
              'assignment.status',
              'assignment.assigned_at',
              'assignment.scheduled_datetime',
            ])
            .where('assignment.location_id = :locId', { locId: locationId })
            .andWhere('assignment.assigned_to_id IS NOT NULL')
            .andWhere(
              '(DATE(assignment.assigned_at) = :d OR DATE(assignment.scheduled_datetime) = :d)',
              { d: dateStr },
            );

          const todaysAssignments = await qb.getMany();
          this.logger.log(
            `📋 Assignments fallback found ${todaysAssignments.length} records at location ${locationId} for ${dateStr}`,
          );

          const workingSet = new Set<number>();
          todaysAssignments.forEach((a: any) => {
            const id = Number(a.assigned_to_id);
            if (id) workingSet.add(id);
          });
          const candidateIds = Array.from(workingSet.values());
          this.logger.log(
            `📋 Candidate employee IDs from assignments: ${candidateIds.join(', ')}`,
          );

          // Build minimal candidates
          availableEmployees = candidateIds.map((id) => ({
            id,
            first_name: 'N/A',
            last_name: '',
          }));
        } catch (fallbackErr) {
          this.logger.error(
            `❌ Assignments fallback failed:`,
            fallbackErr?.message || fallbackErr,
          );
        }
      }

      // Filtrează angajații: exclude angajatul curent
      const currentEmployeeId = assignment.assigned_to_id;
      const eligibleEmployees = availableEmployees.filter(
        (emp: any) => emp.id !== currentEmployeeId,
      );

      if (eligibleEmployees.length === 0) {
        this.logger.log(
          `⚠️ No eligible employees found for reassignment of task ${assignment.id} (location: ${locationId}, date: ${dateStr})`,
        );
        return false;
      }

      // Preferă angajatul cu cele mai puține task-uri active astăzi (tie-break: random)
      const todayStart = new Date(dateStr + 'T00:00:00Z');
      const todayEnd = new Date(dateStr + 'T23:59:59Z');
      const counts = new Map<number, number>();
      const activeToday = await this.assignmentRepository
        .createQueryBuilder('a')
        .select([
          'a.assigned_to_id',
          'a.status',
          'a.assigned_at',
          'a.scheduled_datetime',
        ])
        .where('a.location_id = :locId', { locId: locationId })
        .andWhere('a.assigned_to_id IS NOT NULL')
        .andWhere('(a.status = :s1 OR a.status = :s2)', {
          s1: 'assigned',
          s2: 'in_progress',
        })
        .getMany();
      activeToday.forEach((a: any) => {
        const ts = new Date(a.scheduled_datetime || a.assigned_at);
        if (ts >= todayStart && ts <= todayEnd) {
          const id = Number(a.assigned_to_id);
          counts.set(id, (counts.get(id) || 0) + 1);
        }
      });
      let selectedEmployee = eligibleEmployees[0];
      if (eligibleEmployees.length > 1) {
        selectedEmployee = eligibleEmployees.sort((e1: any, e2: any) => {
          const c1 = counts.get(e1.id) || 0;
          const c2 = counts.get(e2.id) || 0;
          if (c1 !== c2) return c1 - c2;
          return Math.random() - 0.5;
        })[0];
      }

      this.logger.log(
        `🎲 Randomly selected employee ${selectedEmployee.id} (${selectedEmployee.first_name} ${selectedEmployee.last_name}) for task ${assignment.id}`,
      );

      // Reatribuie task-ul la noul angajat
      await this.assignmentRepository.update(assignment.id, {
        assigned_to_id: selectedEmployee.id,
        assigned_at: now, // Resetează data de atribuire
        notes: `${assignment.notes || ''}\n🔄 Reatribuit automat de la angajatul ${currentEmployeeId} la ${selectedEmployee.first_name} ${selectedEmployee.last_name} din cauza expirării (${now.toISOString()})`,
      });

      this.logger.log(
        `✅ Task ${assignment.id} reassigned from employee ${currentEmployeeId} to ${selectedEmployee.id}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`❌ Error reassigning task ${assignment.id}:`, error);
      return false;
    }
  }

  /**
   * Calculează și înregistrează plata managerului pentru o locație și o dată.
   * Apelat la aprobarea încasării (trigger) sau din cron zilnic.
   * Sumă punctele angajaților din ziua respectivă, găsește managerul pontat în departamentul "Manager",
   * aplică manager_percent din WorkLocation_ManagerConfig: amount = total_points * manager_percent / 100.
   */
  async processManagerDailyPayoutForLocationAndDate(
    workLocationId: number,
    dateStr: string,
  ): Promise<{
    ok: boolean;
    created?: boolean;
    total_points?: number;
    amount?: number;
    manager_employee_id?: number;
    message?: string;
  }> {
    const normalizedDate = dateStr
      .toString()
      .trim()
      .split(' ')[0]
      .split('T')[0];
    const workDate = new Date(normalizedDate + 'T12:00:00');

    const locationsUrl =
      process.env.LOCATIONS_HTTP_URL || 'http://localhost:3002';
    const secret = process.env.SERVICE_SECRET || 'default-service-secret';
    const headers = {
      'x-internal-service': 'veziv-tasks',
      'x-service-secret': secret,
      'x-api-key': secret,
      'Content-Type': 'application/json',
    } as Record<string, string>;

    try {
      const existing = await this.managerDailyPayoutRepository.findOne({
        where: {
          work_location_id: workLocationId,
          work_date: workDate,
        } as any,
      });
      if (existing) {
        this.logger.log(
          `⏭️ [Manager Payout] Locația ${workLocationId} – deja procesat pentru ${normalizedDate}`,
        );
        return { ok: true, created: false };
      }

      const totalPointsResult = await this.employeeDailyTaskPointsRepository
        .createQueryBuilder('edtp')
        .innerJoin(
          EmployeeDailyPoints,
          'edp',
          'edtp.employee_daily_points_id = edp.id',
        )
        .innerJoin(TaskExecution, 'te', 'edtp.task_execution_id = te.id')
        .where('edp.work_date = :date', { date: normalizedDate })
        .andWhere('te.location_id = :locId', { locId: workLocationId })
        .select('COALESCE(SUM(edtp.points_awarded), 0)', 'total')
        .getRawOne();
      const totalPoints = Number(totalPointsResult?.total ?? 0);

      // Puncte scăzute (sarcinile anulate / nefinalizate) – angajați care au avut execuții la această locație în ziua respectivă
      const employeeIdsAtLocation = await this.employeeDailyTaskPointsRepository
        .createQueryBuilder('edtp')
        .innerJoin(
          EmployeeDailyPoints,
          'edp',
          'edtp.employee_daily_points_id = edp.id',
        )
        .innerJoin(TaskExecution, 'te', 'edtp.task_execution_id = te.id')
        .where('edp.work_date = :date', { date: normalizedDate })
        .andWhere('te.location_id = :locId', { locId: workLocationId })
        .select('edp.employee_id', 'employee_id')
        .distinct(true)
        .getRawMany();
      const ids = (employeeIdsAtLocation || [])
        .map((r) => (r as any).employee_id)
        .filter(Boolean);
      let pointsDeducted = 0;
      if (ids.length > 0) {
        const deductedResult = await this.employeeDailyTaskPointsRepository
          .createQueryBuilder('edtp')
          .innerJoin(
            EmployeeDailyPoints,
            'edp',
            'edtp.employee_daily_points_id = edp.id',
          )
          .where('edp.work_date = :date', { date: normalizedDate })
          .andWhere('edp.employee_id IN (:...ids)', { ids })
          .andWhere('edtp.points_awarded < 0')
          .select('COALESCE(SUM(edtp.points_awarded), 0)', 'deducted')
          .getRawOne();
        pointsDeducted = Number(deductedResult?.deducted ?? 0);
      }

      if (totalPoints <= 0) {
        this.logger.log(
          `⏭️ [Manager Payout] Locația ${workLocationId} – ${normalizedDate}: puncte_sarcini_finalizate=0, puncte_sarcinile_anulate=${pointsDeducted}, zero puncte pentru calcul manager`,
        );
        return { ok: true, created: false, message: 'no_points' };
      }

      let managerConfig: { manager_percent?: number } | null = null;
      try {
        const res = await firstValueFrom(
          this.httpService.get(
            `${locationsUrl}/locations/${workLocationId}/manager-config`,
            { headers },
          ),
        );
        managerConfig = res?.data ?? null;
      } catch (e) {
        this.logger.warn(
          `⚠️ [Manager Payout] Locația ${workLocationId} – manager-config: ${e?.message || e}`,
        );
        return { ok: false, message: 'manager_config_failed' };
      }
      const managerPercent = Number(managerConfig?.manager_percent ?? 0);
      if (managerPercent <= 0) {
        this.logger.log(
          `⏭️ [Manager Payout] Locația ${workLocationId} – manager_percent 0 sau lipsă`,
        );
        return { ok: true, created: false, message: 'no_manager_percent' };
      }

      // Folosim aceeași logică ca în assignment (getManagerEmployeeIdsForLocationAtDateTime):
      // API locations + fallback la DB locations pentru departament Manager, apoi shifts din attendance cu department_id.
      const workDateAtNoon = new Date(normalizedDate + 'T12:00:00');
      const managerIds =
        await this.assignmentService.getManagerEmployeeIdsForLocationAtDateTime(
          workLocationId,
          workDateAtNoon,
        );
      const managerEmployeeId = managerIds.length > 0 ? managerIds[0] : null;
      if (!managerEmployeeId) {
        this.logger.log(
          `⏭️ [Manager Payout] Locația ${workLocationId} – niciun manager pontat pe ${normalizedDate}`,
        );
        return { ok: true, created: false, message: 'no_manager_shift' };
      }

      const managerPoints = totalPoints * (managerPercent / 100);

      await this.managerDailyPayoutRepository.save({
        work_location_id: workLocationId,
        work_date: workDate,
        manager_employee_id: managerEmployeeId,
        total_points: totalPoints,
        manager_points: managerPoints,
      });

      // Puncte manager doar în manager_daily_payout (nu și în Employee_Daily_Task_Points) – sursă unică pentru rapoarte. Banii se calculează în timp real.
      this.logger.log(
        `✅ [Manager Payout / Încasare] Locația ${workLocationId} – ${normalizedDate}: puncte_sarcini_finalizate=${totalPoints}, puncte_sarcinile_anulate=${pointsDeducted}, puncte_manager=${managerPoints.toFixed(2)} (${managerPercent}% din ${totalPoints}) → angajat ${managerEmployeeId}`,
      );
      return {
        ok: true,
        created: true,
        total_points: totalPoints,
        amount: managerPoints,
        manager_employee_id: managerEmployeeId,
      };
    } catch (err) {
      this.logger.error(
        `❌ [Manager Payout] Locația ${workLocationId} – ${normalizedDate}: ${err?.message || err}`,
      );
      return { ok: false, message: String(err?.message || err) };
    }
  }

  /**
   * Cron zilnic: calculează și înregistrează plățile managerilor pe baza punctelor angajaților.
   * Rulează la 01:00 pentru ziua anterioară.
   * Pentru fiecare locație cu puncte: sumă puncte din employee_daily_task_points, găsește managerul
   * pontat în departamentul "Manager", aplică manager_percent din WorkLocation_ManagerConfig.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processManagerDailyPayouts() {
    const workDate = new Date();
    workDate.setDate(workDate.getDate() - 1);
    const dateStr = workDate.toISOString().split('T')[0];
    this.logger.log(`📋 [Manager Payout] Start pentru data ${dateStr}`);

    const locationIds = await this.executionRepository
      .createQueryBuilder('te')
      .innerJoin(
        EmployeeDailyTaskPoints,
        'edtp',
        'edtp.task_execution_id = te.id',
      )
      .innerJoin(
        EmployeeDailyPoints,
        'edp',
        'edtp.employee_daily_points_id = edp.id',
      )
      .where('edp.work_date = :date', { date: dateStr })
      .andWhere('te.location_id IS NOT NULL')
      .select('te.location_id')
      .distinct(true)
      .getRawMany()
      .then((rows) =>
        rows
          .map((r) => r.te_location_id ?? (r as any).location_id)
          .filter(Boolean),
      );

    for (const workLocationId of locationIds) {
      await this.processManagerDailyPayoutForLocationAndDate(
        workLocationId,
        dateStr,
      );
    }
    this.logger.log(`📋 [Manager Payout] Finalizat pentru ${dateStr}`);
  }

  /**
   * Cron: la fiecare 5 ore verifică documentele expirate din Angajați, Furnizori, Locații, Firme
   * și trimite notificare.
   */
  @Cron('0 */5 * * *') // La minute 0, la fiecare 5 ore (00:00, 05:00, 10:00, 15:00, 20:00)
  async handleExpiredDocumentsNotification() {
    this.logger.log(
      '📄 [Documente expirate] Start verificare documente expirate...',
    );
    const baseUrl =
      process.env.API_GATEWAY_URL ||
      process.env.LOCATIONS_HTTP_URL ||
      'http://localhost:3002';
    const secret = process.env.SERVICE_SECRET || 'default-service-secret';
    const headers = {
      'x-internal-service': 'veziv-tasks',
      'x-service-secret': secret,
      'x-api-key': secret,
      'Content-Type': 'application/json',
    } as Record<string, string>;

    const employeesUrl = process.env.EMPLOYEES_HTTP_URL || baseUrl;
    const locationsUrl = process.env.LOCATIONS_HTTP_URL || baseUrl;
    const companiesUrl = process.env.COMPANY_HTTP_URL || baseUrl;
    const suppliersUrl = process.env.SUPPLIERS_HTTP_URL || baseUrl;

    const results: {
      source: string;
      count: number;
      items: Array<{
        id: number;
        name?: string;
        expire_date?: string;
        [k: string]: any;
      }>;
    }[] = [];

    try {
      const toList = (v: any): any[] =>
        Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];
      const [empRes, locRes, compRes, suppRes] = await Promise.allSettled([
        firstValueFrom(
          this.httpService.get(`${employeesUrl}/employees/files/expired`, {
            headers,
          }),
        ).then((r) => r.data),
        firstValueFrom(
          this.httpService.get(`${locationsUrl}/locations/files/expired`, {
            headers,
          }),
        ).then((r) => r.data),
        firstValueFrom(
          this.httpService.get(`${companiesUrl}/companies/documents/expired`, {
            headers,
          }),
        ).then((r) => r.data),
        firstValueFrom(
          this.httpService.get(`${suppliersUrl}/suppliers/documents/expired`, {
            headers,
          }),
        ).then((r) => r.data),
      ]);

      const empList = empRes.status === 'fulfilled' ? toList(empRes.value) : [];
      const locList = locRes.status === 'fulfilled' ? toList(locRes.value) : [];
      const compList =
        compRes.status === 'fulfilled' ? toList(compRes.value) : [];
      const suppList =
        suppRes.status === 'fulfilled' ? toList(suppRes.value) : [];

      if (empList.length)
        results.push({
          source: 'Angajați',
          count: empList.length,
          items: empList,
        });
      if (locList.length)
        results.push({
          source: 'Locații',
          count: locList.length,
          items: locList,
        });
      if (compList.length)
        results.push({
          source: 'Firme',
          count: compList.length,
          items: compList,
        });
      if (suppList.length)
        results.push({
          source: 'Furnizori',
          count: suppList.length,
          items: suppList,
        });

      const total = results.reduce((s, r) => s + r.count, 0);
      if (total === 0) {
        this.logger.log('📄 [Documente expirate] Niciun document expirat.');
        return;
      }

      this.logger.log(
        `📄 [Documente expirate] Total: ${total} (Angajați: ${empList.length}, Locații: ${locList.length}, Firme: ${compList.length}, Furnizori: ${suppList.length})`,
      );

      const title = 'Documente expirate';
      const description = results
        .map((r) => `${r.source}: ${r.count} document(e)`)
        .join('; ');
      const payload = {
        type: 'document_expired',
        title,
        description,
        entity_type: 'document',
        entity_id: null,
        metadata: { sources: results, total },
        priority: 'high' as const,
        target_url: '/rapoarte',
      };
      await firstValueFrom(
        this.notificationsClient
          .emit({ cmd: 'tasks.notification' }, payload)
          .pipe(defaultIfEmpty(undefined)),
      );
      this.logger.log(
        `📄 [Documente expirate] Notificare trimisă: ${title} – ${description}`,
      );
    } catch (err: any) {
      this.logger.error(
        `❌ [Documente expirate] Eroare: ${err?.message || err}`,
      );
    }
  }
}
