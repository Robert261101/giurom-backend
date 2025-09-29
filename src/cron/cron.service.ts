import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAssignment, AssignmentStatus } from '../assignment/entity/task-assignment.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from '../execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from '../execution/entity/employee-daily-points.entity';
import { ExecutionService } from '../execution/execution.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskExecution)
    private executionRepository: Repository<TaskExecution>,
    @InjectRepository(TaskExecutionAnswer)
    private answerRepository: Repository<TaskExecutionAnswer>,
    @InjectRepository(EmployeeDailyPoints)
    private employeeDailyPointsRepository: Repository<EmployeeDailyPoints>,
    private executionService: ExecutionService,
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
   * Cron job care rulează la 00:00 în fiecare zi
   * Finalizează automat task-urile active nefinalizate și scade punctele angajaților
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyTaskCompletion() {
    this.logger.log('🕛 Starting daily task completion cron job...');
    
    try {
      await this.processActiveTasks();
    } catch (error) {
      this.logger.error('❌ Error in daily task completion cron job:', error);
    }
  }

  /**
   * Procesează task-urile active și le finalizează dacă îndeplinesc condițiile
   */
  private async processActiveTasks(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Găsește toate task-urile active nefinalizate
    const activeAssignments = await this.assignmentRepository.find({
      where: [
        { status: AssignmentStatus.ASSIGNED },
        { status: AssignmentStatus.IN_PROGRESS },
        { status: AssignmentStatus.SCHEDULED }
      ],
      relations: ['elements', 'elements.task_element', 'template']
    });

    this.logger.log(`📋 Found ${activeAssignments.length} active assignments to process`);

    let completedCount = 0;
    let totalPointsDeducted = 0;

    for (const assignment of activeAssignments) {
      try {
        // Verifică dacă task-ul este de grup cu "primul venit, primul servit"
        // Aceste task-uri nu trebuie finalizate automat pentru că sunt competitive
        if (assignment.department_group_id && assignment.assignment_mode === 'first_come_first_served') {
          this.logger.log(`🎯 Skipping task ${assignment.id} - group task with first_come_first_served mode (competitive task)`);
          continue;
        }

        // Verifică dacă task-ul trebuie finalizat bazat pe programat_la, vizibil_de_la sau recurență
        const shouldComplete = this.shouldCompleteTask(assignment, today);
        
        if (!shouldComplete) {
          this.logger.log(`⏭️ Skipping task ${assignment.id} - doesn't meet completion criteria`);
          continue;
        }

        // Verifică dacă task-ul permite amânarea și dacă a fost amânat
        const allowPostponeElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'allow_postpone'
        );
        const hasAllowPostpone = allowPostponeElement && allowPostponeElement.value === 'true';
        
        if (hasAllowPostpone) {
          // Verifică dacă task-ul a fost amânat (are execuții cu comment de amânare)
          const postponeExecutions = await this.executionRepository.find({
            where: {
              task_assignment_id: assignment.id,
              comment: 'Task amânat de angajat'
            }
          });
          
          if (postponeExecutions.length > 0) {
            // Task-ul a fost amânat, dar la 00:00 se finalizează automat oricum
            this.logger.log(`⏸️ Task ${assignment.id} was postponed, but finalizing at 00:00 as requested`);
            // Continuă procesarea - nu skip
          }
        }

        // Calculează punctele maxime pentru acest task
        const maxPoints = this.calculateMaxPointsForAssignment(assignment);
        
        // Creează execuția pentru task-ul finalizat automat (chiar dacă nu are puncte)
        await this.createNegativeExecution(assignment, maxPoints, today);
        
        if (maxPoints > 0) {
          // Scade punctele din punctajul zilnic al angajatului
          await this.deductDailyPoints(assignment.assigned_to_id, maxPoints, today);
          
          totalPointsDeducted += maxPoints;
          this.logger.log(`⚠️ Deducted ${maxPoints} points from employee ${assignment.assigned_to_id} for incomplete task ${assignment.id}`);
        } else {
          this.logger.log(`📋 Task ${assignment.id} has no points - created execution without point deduction`);
        }

        // Marchează task-ul ca fiind finalizat automat
        await this.assignmentRepository.update(assignment.id, {
          status: 'completed' as any,
          completed_at: today
        });

        completedCount++;
        this.logger.log(`✅ Auto-completed task ${assignment.id} for employee ${assignment.assigned_to_id}`);

      } catch (error) {
        this.logger.error(`❌ Error processing assignment ${assignment.id}:`, error.message);
      }
    }

    this.logger.log(`🎯 Cron job completed: ${completedCount} tasks auto-completed, ${totalPointsDeducted} total points deducted`);
  }

  /**
   * Verifică dacă un task trebuie finalizat bazat pe programat_la, vizibil_de_la sau recurență
   */
  private shouldCompleteTask(assignment: TaskAssignment, today: Date): boolean {
    const programatLaElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'scheduled_datetime'
    );
    const vizibilDeLaElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'visible_from'
    );
    const recurrenceElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'recurrence'
    );
    const finalizedInElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'finalized_in'
    );

    // Dacă există programat_la, verifică dacă ziua de azi = ziua din programat_la
    if (programatLaElement && programatLaElement.value) {
      const scheduledDate = new Date(programatLaElement.value);
      scheduledDate.setHours(0, 0, 0, 0);
      
      if (scheduledDate.getTime() === today.getTime()) {
        this.logger.log(`📅 Task ${assignment.id} scheduled for today (programat_la)`);
        return true;
      }
    }

    // Dacă există doar vizibil_de_la (fără programat_la), verifică dacă ziua de azi = ziua din vizibil_de_la
    if (vizibilDeLaElement && vizibilDeLaElement.value && !programatLaElement) {
      const visibleDate = new Date(vizibilDeLaElement.value);
      visibleDate.setHours(0, 0, 0, 0);
      
      if (visibleDate.getTime() === today.getTime()) {
        this.logger.log(`👁️ Task ${assignment.id} visible from today (vizibil_de_la)`);
        return true;
      }
    }

    // Dacă există recurență, verifică dacă ziua de azi este în zilele de recurență
    if (recurrenceElement && recurrenceElement.value) {
      try {
        const recurrenceData = JSON.parse(recurrenceElement.value);
        const recurringDays = recurrenceData.days || []; // [1, 2, 3, 4, 5] pentru L-V
        
        const todayWeekday = today.getDay(); // 0 = Duminică, 1 = Luni, etc.
        
        if (recurringDays.includes(todayWeekday)) {
          this.logger.log(`🔄 Task ${assignment.id} scheduled for today (recurrence)`);
          return true;
        }
      } catch (e) {
        this.logger.warn(`Failed to parse recurrence data for task ${assignment.id}:`, e);
      }
    }

    // Dacă există finalized_in, verifică dacă timpul a expirat
    if (finalizedInElement && finalizedInElement.value) {
      try {
        // finalized_in conține durata în ore/minute (ex: "2:30" sau "2")
        const finalizedInValue = finalizedInElement.value;
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
        const deadline = new Date(assignedAt.getTime() + (hours * 60 + minutes) * 60 * 1000);
        
        // Verifică dacă deadline-ul a trecut
        if (today.getTime() >= deadline.getTime()) {
          this.logger.log(`⏰ Task ${assignment.id} deadline expired (finalized_in: ${finalizedInValue})`);
          return true;
        }
      } catch (e) {
        this.logger.warn(`Failed to parse finalized_in data for task ${assignment.id}:`, e);
      }
    }

    // Dacă nu există nicio condiție specială, finalizează task-ul
    if (!programatLaElement && !vizibilDeLaElement && !recurrenceElement && !finalizedInElement) {
      this.logger.log(`📋 Task ${assignment.id} has no special scheduling - completing`);
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
          const scoringOptions = JSON.parse(element.task_element.scoring_options || '[]');
          const maxPointsForElement = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
          totalPoints += maxPointsForElement;
        } catch (e) {
          this.logger.warn(`Failed to parse scoring_options for element ${element.id}`);
        }
      }
    }

    return totalPoints;
  }

  /**
   * Creează o execuție negativă pentru punctele pierdute
   */
  private async createNegativeExecution(assignment: TaskAssignment, pointsToDeduct: number, completionDate: Date): Promise<void> {
    // Creează execuția principală
    const execution = this.executionRepository.create({
      task_assignment_id: assignment.id,
      employee_id: assignment.assigned_to_id,
      started_at: assignment.assigned_at,
      completed_at: completionDate,
      comment: `Task finalizat automat la ${completionDate.toISOString().split('T')[0]} - puncte deduse pentru nefinalizare`
      // total_score eliminat - punctajul se stochează în employee_daily_points
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Creează answers pentru elementele cu puncte
    for (const element of assignment.elements || []) {
      const elementType = element.task_element.element_type;
      
      if (elementType === 'scoring_simple' || elementType === 'scoring_boolean') {
        const answer = this.answerRepository.create({
          task_execution_id: savedExecution.id,
          task_element_id: element.task_element_id,
          value: 'auto_completed',
          score_awarded: elementType === 'scoring_simple' ? -(element.task_element.simple_score_points || 0) : 0
        });

        await this.answerRepository.save(answer);
      }
    }
  }

  /**
   * Scade punctele din punctajul zilnic al angajatului
   */
  private async deductDailyPoints(employeeId: number, pointsToDeduct: number, date: Date): Promise<void> {
    const workDate = new Date(date);
    workDate.setHours(0, 0, 0, 0);

    // Verifică dacă există deja punctaj zilnic pentru această zi
    let dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: workDate
      }
    });

    if (dailyPoints) {
      // Scade punctele din punctajul existent
      dailyPoints.total_points -= pointsToDeduct;
    } else {
      // Creează un punctaj zilnic nou cu punctele negative
      dailyPoints = this.employeeDailyPointsRepository.create({
        employee_id: employeeId,
        work_date: workDate,
        total_points: -pointsToDeduct
      });
    }

    await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  /**
   * Endpoint manual pentru a rula cron job-ul (pentru testare)
   */
  async runManualTaskCompletion(): Promise<{ message: string; completedTasks: number; totalPointsDeducted: number }> {
    this.logger.log('🔧 Running manual task completion...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeAssignments = await this.assignmentRepository.find({
      where: [
        { status: AssignmentStatus.ASSIGNED },
        { status: AssignmentStatus.IN_PROGRESS },
        { status: AssignmentStatus.SCHEDULED }
      ],
      relations: ['elements', 'elements.task_element']
    });

    let completedCount = 0;
    let totalPointsDeducted = 0;

    for (const assignment of activeAssignments) {
      const maxPoints = this.calculateMaxPointsForAssignment(assignment);
      
      // Creează execuția pentru task-ul finalizat automat (chiar dacă nu are puncte)
      await this.createNegativeExecution(assignment, maxPoints, today);
      
      if (maxPoints > 0) {
        await this.deductDailyPoints(assignment.assigned_to_id, maxPoints, today);
        totalPointsDeducted += maxPoints;
      }

      await this.assignmentRepository.update(assignment.id, {
        status: 'completed' as any,
        completed_at: today
      });

      completedCount++;
    }

    return {
      message: `Manual task completion completed: ${completedCount} tasks processed, ${totalPointsDeducted} points deducted`,
      completedTasks: completedCount,
      totalPointsDeducted
    };
  }
}
