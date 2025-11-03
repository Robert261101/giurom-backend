import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { TaskAssignment, AssignmentStatus } from '../assignment/entity/task-assignment.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from '../execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from '../execution/entity/employee-daily-points.entity';
import { ExecutionService } from '../execution/execution.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
    private httpService: HttpService,
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
        status: AssignmentStatus.ASSIGNED // Doar ASSIGNED, nu DEACTIVATED
      });
      
      const deletedCount = result.affected || 0;
      this.logger.log(`✅ Cleanup completed: deleted ${deletedCount} unaccepted FCFS tasks (DEACTIVATED tasks preserved)`);
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
        
        // Debug logging pentru amânare
        this.logger.log(`🔍 [DEBUG] Task ${assignment.id}: hasAllowPostpone=${hasAllowPostpone}, was_postponed=${assignment.was_postponed}`);
        this.logger.log(`🔍 [DEBUG] Task ${assignment.id}: allowPostponeElement=${allowPostponeElement ? 'found' : 'not found'}, value=${allowPostponeElement?.value}`);
        this.logger.log(`🔍 [DEBUG] Task ${assignment.id}: assignment.was_postponed type=${typeof assignment.was_postponed}, value=${assignment.was_postponed}`);
        this.logger.log(`🔍 [DEBUG] Task ${assignment.id}: All elements:`, assignment.elements?.map(el => ({ 
          id: el.id, 
          element_type: el.task_element?.element_type, 
          value: el.value 
        })));
        
        if (hasAllowPostpone && assignment.was_postponed === true) {
          // Task-ul a fost amânat - acordă puncte pentru amânare în loc să scadă
          this.logger.log(`⏸️ Task ${assignment.id} was postponed - awarding points for postponement`);
          
          // Calculează punctele maxime pentru acest task
          const maxPoints = this.calculateMaxPointsForAssignment(assignment);
          
          // Creează execuția pentru task-ul amânat cu puncte pozitive
          await this.createPositiveExecution(assignment, maxPoints, today, 'Task amânat - puncte acordate');
          
          if (maxPoints > 0) {
            // Adaugă punctele în punctajul zilnic al angajatului
            await this.addDailyPoints(assignment.assigned_to_id, maxPoints, today);
            
            totalPointsDeducted -= maxPoints; // Scădem din totalul scăzut (deci adăugăm)
            this.logger.log(`✅ Awarded ${maxPoints} points to employee ${assignment.assigned_to_id} for postponed task ${assignment.id}`);
          } else {
            this.logger.log(`📋 Task ${assignment.id} has no points - created execution without point award`);
          }
        } else {
          // Task-ul nu a fost amânat - scade punctele ca înainte
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
      const scheduledDate = new Date(programatLaElement.value.trim());
      scheduledDate.setHours(0, 0, 0, 0);
      
      if (scheduledDate.getTime() === today.getTime()) {
        this.logger.log(`📅 Task ${assignment.id} scheduled for today (programat_la)`);
        return true;
      }
    }

    // Dacă există doar vizibil_de_la (fără programat_la), verifică dacă ziua de azi = ziua din vizibil_de_la
    if (vizibilDeLaElement && vizibilDeLaElement.value && !programatLaElement) {
      const visibleDate = new Date(vizibilDeLaElement.value.trim());
      visibleDate.setHours(0, 0, 0, 0);
      
      if (visibleDate.getTime() === today.getTime()) {
        this.logger.log(`👁️ Task ${assignment.id} visible from today (vizibil_de_la)`);
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
        // - Dacă există scheduled_datetime, pornește de la acolo
        // - Altfel, pornește de la assigned_at (care se resetează la fiecare reatribuire)
        let startTime: Date;
        if (programatLaElement && programatLaElement.value) {
          startTime = new Date(programatLaElement.value);
          this.logger.log(`⏰ Task ${assignment.id} - Cronometru pornește de la scheduled_datetime: ${startTime.toISOString()}`);
        } else {
          startTime = new Date(assignment.assigned_at);
          this.logger.log(`⏰ Task ${assignment.id} - Cronometru pornește de la assigned_at: ${startTime.toISOString()}`);
        }
        
        const deadline = new Date(startTime.getTime() + (hours * 60 + minutes) * 60 * 1000);
        
        // Verifică dacă deadline-ul a trecut
        if (today.getTime() >= deadline.getTime()) {
          this.logger.log(`⏰ Task ${assignment.id} deadline expired (finalized_in: ${finalizedInValue}, deadline: ${deadline.toISOString()})`);
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
   * Creează o execuție pozitivă pentru punctele acordate pentru amânare
   */
  private async createPositiveExecution(assignment: TaskAssignment, pointsToAward: number, completionDate: Date, comment: string): Promise<void> {
    // Creează execuția principală
    const execution = this.executionRepository.create({
      task_assignment_id: assignment.id,
      employee_id: assignment.assigned_to_id,
      started_at: assignment.assigned_at,
      completed_at: completionDate,
      comment: comment
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
          score_awarded: points
        });
        await this.answerRepository.save(answer);
      } else if (elementType === 'scoring_boolean') {
        try {
          const scoringOptions = JSON.parse(element.task_element.scoring_options || '[]');
          const totalPoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
          const answer = this.answerRepository.create({
            task_execution_id: savedExecution.id,
            task_element_id: element.task_element_id,
            value: 'postponed_awarded',
            score_awarded: totalPoints
          });
          await this.answerRepository.save(answer);
        } catch (e) {
          this.logger.warn(`Failed to parse scoring_options for element ${element.id}`);
        }
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
   * Adaugă punctele în punctajul zilnic al angajatului
   */
  private async addDailyPoints(employeeId: number, pointsToAdd: number, date: Date): Promise<void> {
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
      // Adaugă punctele la punctajul existent
      dailyPoints.total_points += pointsToAdd;
    } else {
      // Creează un punctaj zilnic nou cu punctele pozitive
      dailyPoints = this.employeeDailyPointsRepository.create({
        employee_id: employeeId,
        work_date: workDate,
        total_points: pointsToAdd
      });
    }

    await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  /**
   * Endpoint manual pentru a rula cron job-ul FCFS (pentru testare)
   */
  async runManualFCFSAutoAssignment(): Promise<{ message: string; processedTasks: number; autoAssignedTasks: number; deletedTasks: number }> {
    this.logger.log('🔧 Running manual FCFS auto-assignment...');
    
    try {
      await this.processFCFSAutoAssignment();
      
      // Recalculează statisticile pentru răspuns
      const now = new Date();
      const fcfsAssignments = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.ASSIGNED,
          assignment_mode: 'first_come_first_served' as any,
          department_group_id: Not(IsNull())
        }
      });

      return {
        message: `Manual FCFS auto-assignment completed. Found ${fcfsAssignments.length} remaining FCFS assignments.`,
        processedTasks: fcfsAssignments.length,
        autoAssignedTasks: 0, // Se va calcula în funcția principală
        deletedTasks: 0 // Se va calcula în funcția principală
      };
    } catch (error) {
      this.logger.error('❌ Error in manual FCFS auto-assignment:', error);
      throw error;
    }
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
        assigned_to_id: IsNull() // Doar task-urile neacceptate încă
      },
      relations: ['elements', 'elements.task_element', 'template']
    });

    this.logger.log(`🎯 Found ${fcfsAssignments.length} unassigned FCFS tasks to process`);

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
        this.logger.log(`✅ Processed FCFS assignment ${assignment.id}: ${result.action}`);
        
      } catch (error) {
        this.logger.error(`❌ Error processing FCFS assignment ${assignment.id}:`, error.message);
      }
    }

    this.logger.log(`🎯 FCFS auto-assignment completed: ${processedCount} processed, ${autoAssignedCount} auto-assigned, ${deactivatedCount} deactivated`);
  }

  /**
   * Procesează un singur task FCFS și decide ce acțiune să ia
   */
  private async processFCFSAssignment(assignment: TaskAssignment, now: Date): Promise<{ action: string; details?: any }> {
    const assignedAt = new Date(assignment.assigned_at);
    const hoursSinceAssigned = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);
    
    this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: hoursSinceAssigned=${hoursSinceAssigned.toFixed(2)}`);
    
    // Verifică dacă au trecut 3 ore de la atribuire (pentru testare: 3 minute = 0.05 ore)
    const waitingHours = 0.05; // 3 minute pentru testare - schimbă la 3 pentru producție
    // const waitingHours = 3; // 3 ore pentru producție - decomentează când e cazul
    
    if (hoursSinceAssigned < waitingHours) {
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Still waiting (${hoursSinceAssigned.toFixed(2)} hours < ${waitingHours})`);
      return { action: 'waiting', details: { hoursSinceAssigned } };
    }

    // Calculează orele până la 00:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hoursUntilMidnight = (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Verifică dacă task-ul are finalized_in, finalized_la sau finish_at
    const finalizedInElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'finalized_in'
    );
    const finalizedLaElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'finalized_la' as any
    );
    const finishAtElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'finish_at'
    );

    // Verifică dacă task-ul permite amânare
    const allowPostponeElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'allow_postpone'
    );
    const allowsPostpone = allowPostponeElement && allowPostponeElement.value === 'true';

    this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: finalizedInElement=${finalizedInElement ? `"${finalizedInElement.value.trim()}"` : 'null'}, finalizedLaElement=${finalizedLaElement ? `"${finalizedLaElement.value.trim()}"` : 'null'}, finishAtElement=${finishAtElement ? `"${finishAtElement.value.trim()}"` : 'null'}, allowsPostpone=${allowsPostpone}`);
    
    // Debug: afișează toate elementele task-ului
    if (assignment.elements && assignment.elements.length > 0) {
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id} elements:`, assignment.elements.map(el => ({
        element_type: el.task_element.element_type,
        value: el.value
      })));
    } else {
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: No elements found`);
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
    this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (no restrictions - 4h checks disabled)`);
    return await this.autoAssignFCFSTask(assignment);
  }

  /**
   * Atribuie automat un task FCFS unui angajat random din departament
   * Simplu: doar UPDATE assigned_to_id, fără DELETE (task-ul e deja unic)
   */
  private async autoAssignFCFSTask(assignment: TaskAssignment): Promise<{ action: string; details?: any }> {
    try {
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);
      this.logger.log(`🔍 [AUTO-ACCEPT] Auto-accepting task ${assignment.id} for department group: ${assignment.department_group_id}`);
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);

      // Extrage department_id din department_group_id (format: dept_X_timestamp_random)
      const departmentId = assignment.department_group_id?.split('_')[1];
      
      if (!departmentId) {
        this.logger.warn(`⚠️ Cannot extract department ID from group ID: ${assignment.department_group_id}`);
        return { action: 'invalid_group_id' };
      }

      this.logger.log(`🔍 [AUTO-ACCEPT] Department ID extracted: ${departmentId}`);

      // Obține angajații care lucrează în departament ÎN ZIUA task-ului (din shifts)
      const taskDate = new Date(assignment.assigned_at).toISOString().split('T')[0];
      this.logger.log(`🔍 [AUTO-ACCEPT] Getting employees working on date: ${taskDate}`);
      
      const departmentEmployees = await this.getEmployeesWorkingOnDate(parseInt(departmentId), taskDate);
      
      if (!departmentEmployees || departmentEmployees.length === 0) {
        this.logger.warn(`⚠️ No employees found working in department ${departmentId} on ${taskDate}`);
        return { action: 'no_employees' };
      }

      this.logger.log(`🔍 [AUTO-ACCEPT] Found ${departmentEmployees.length} employees working in department on ${taskDate}`);

      // Alege un angajat random
      const randomIndex = Math.floor(Math.random() * departmentEmployees.length);
      const selectedEmployee = departmentEmployees[randomIndex];

      this.logger.log(`🔍 [AUTO-ACCEPT] Selected employee: ${selectedEmployee.id} (${selectedEmployee.first_name} ${selectedEmployee.last_name})`);

      // Actualizează task-ul: setează assigned_to_id (task-ul devine al angajatului)
      this.logger.log(`🔍 [AUTO-ACCEPT] Updating task ${assignment.id} assigned_to_id to ${selectedEmployee.id}...`);
      
      const updateResult = await this.assignmentRepository.update(assignment.id, {
        assigned_to_id: selectedEmployee.id,
        status: AssignmentStatus.ASSIGNED
      });

      this.logger.log(`🔍 [AUTO-ACCEPT] Update result:`, updateResult);
      this.logger.log(`✅ [AUTO-ACCEPT] Task ${assignment.id} auto-assigned to employee ${selectedEmployee.id}`);

      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);
      this.logger.log(`✅ [AUTO-ACCEPT] Task auto-acceptance completed successfully!`);
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);

      return { 
        action: 'auto_assigned', 
        details: { 
          assignedTo: selectedEmployee.id
        } 
      };

    } catch (error) {
      this.logger.error(`❌ Error auto-assigning FCFS task ${assignment.id}:`, error.message);
      return { action: 'error', details: { error: error.message } };
    }
  }

  /**
   * Calculează deadline-ul bazat pe finalized_in
   */
  private calculateDeadlineFromFinalizedIn(assignment: TaskAssignment, finalizedInValue: string): Date {
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
  private async getEmployeesWorkingOnDate(departmentId: number, date: string): Promise<Array<{id: number, first_name: string, last_name: string}> | null> {
    try {
      this.logger.log(`🔍 Getting employees working in department ${departmentId} on ${date} from attendance shifts`);
      
      // Obține shift-urile din ziua respectivă
      const shiftsResponse = await firstValueFrom(
        this.httpService.get(`http://giurom.bitap.ro:3002/attendance/shifts?work_location_id=3&limit=1000`, {
          headers: {
            'x-internal-service': 'tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        })
      );
      
      // Extrage array-ul de shifts (format: { data: [...], total, page, limit })
      let allShifts: any[] = [];
      if (Array.isArray(shiftsResponse.data)) {
        allShifts = shiftsResponse.data;
      } else if (shiftsResponse.data && Array.isArray(shiftsResponse.data.data)) {
        allShifts = shiftsResponse.data.data;
      }
      
      
      // Filtrează shift-urile pentru data și departamentul specificat
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const relevantShifts = allShifts.filter((shift: any) => {
        const shiftStart = new Date(shift.start_datetime);
        shiftStart.setHours(0, 0, 0, 0);
        return shiftStart.getTime() === targetDate.getTime() && shift.department_id === departmentId;
      });
      
      
      if (relevantShifts.length === 0) {
        return [];
      }
      
      // Extrage employee_ids unici din shifts
      const employeeIds = [...new Set(relevantShifts.map((s: any) => s.employee_id))];
      this.logger.log(`🔍 Employee IDs working on ${date}:`, employeeIds);
      
      // Obține detalii despre angajați
      const employeesResponse = await firstValueFrom(
        this.httpService.get(`http://giurom.bitap.ro:3002/employees`, {
          headers: {
            'x-internal-service': 'tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        })
      );
      
      const allEmployees = employeesResponse.data?.employees || [];
      const workingEmployees = allEmployees.filter((emp: any) => employeeIds.includes(emp.id));
      
      this.logger.log(`✅ Found ${workingEmployees.length} employees working in department ${departmentId} on ${date}`);
      
      return workingEmployees.map((emp: any) => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name
      }));
    } catch (error) {
      this.logger.error(`❌ Error getting employees working on date ${date}:`, error.message);
      return null;
    }
  }

  /**
   * Obține angajații dintr-un departament (DEPRECATED - folosește getEmployeesWorkingOnDate)
   */
  private async getDepartmentEmployees(departmentGroupId: string): Promise<Array<{id: number, first_name: string, last_name: string}> | null> {
    try {
      // Parsează department_group_id pentru a obține department_id
      // Format: "dept_3_1759229369116_y9n9vlq7e" -> extrage "3"
      let departmentId = departmentGroupId;
      
      if (departmentGroupId.startsWith('dept_')) {
        // Format: "dept_3_1759229369116_y9n9vlq7e"
        const parts = departmentGroupId.split('_');
        departmentId = parts[1]; // "3"
      } else if (departmentGroupId.startsWith('department_')) {
        // Format: "department_123"
        departmentId = departmentGroupId.replace('department_', '');
      }
      
      this.logger.log(`🔍 Getting employees for department ID: ${departmentId} from group: ${departmentGroupId}`);
      
      // Folosește microserviciul employees cu filtrul de departament
      const response = await firstValueFrom(
        this.httpService.get(`http://giurom.bitap.ro:3002/employees?department_id=${departmentId}`, {
          headers: {
            'x-internal-service': 'tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        })
      );
      
      const employees = response.data?.employees || [];
      this.logger.log(`✅ Found ${employees.length} employees for department ${departmentId}`);
      
      // Returnează doar câmpurile necesare
      return employees.map((emp: any) => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name
      }));
    } catch (error) {
      this.logger.error(`❌ Error getting department employees for group ${departmentGroupId}:`, error.message);
      return null;
    }
  }

  /**
   * Obține informațiile despre angajați după ID-uri
   */
  private async getEmployeesByIds(employeeIds: number[]): Promise<Array<{id: number, first_name: string, last_name: string}> | null> {
    try {
      this.logger.log(`🔍 Getting employee details for IDs: ${employeeIds.join(', ')}`);
      
      // Obține toți angajații și filtrează după ID-uri
      const response = await firstValueFrom(
        this.httpService.get(`http://giurom.bitap.ro:3002/employees`, {
          headers: {
            'x-internal-service': 'tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        })
      );
      
      const allEmployees = response.data?.employees || [];
      const filteredEmployees = allEmployees.filter((emp: any) => employeeIds.includes(emp.id));
      
      this.logger.log(`✅ Found ${filteredEmployees.length} employees for IDs: ${employeeIds.join(', ')}`);
      
      // Returnează doar câmpurile necesare
      return filteredEmployees.map((emp: any) => ({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name
      }));
    } catch (error) {
      this.logger.error(`❌ Error getting employees by IDs ${employeeIds.join(', ')}:`, error.message);
      return null;
    }
  }

  /**
   * Cron job care rulează din minut în minut
   * Reatribuie automat task-urile expirate la alți angajați disponibili
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredTaskReassignment() {
    this.logger.log('🔄 Starting expired task reassignment cron job...');
    
    try {
      await this.processExpiredTasks();
    } catch (error) {
      this.logger.error('❌ Error in expired task reassignment cron job:', error);
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
        { status: AssignmentStatus.IN_PROGRESS }
      ],
      relations: ['elements', 'elements.task_element', 'template']
    });

    this.logger.log(`📋 Found ${activeAssignments.length} active assignments to check for expiration`);

    let reassignedCount = 0;

    for (const assignment of activeAssignments) {
      try {
        // Verifică dacă task-ul a expirat
        const isExpired = this.isTaskExpired(assignment, now);
        
        if (!isExpired) {
          continue;
        }

        this.logger.log(`⏰ Task ${assignment.id} has expired - attempting reassignment`);

        // Încearcă să reatribui task-ul la alt angajat
        const reassigned = await this.reassignExpiredTask(assignment, now);
        
        if (reassigned) {
          reassignedCount++;
          this.logger.log(`✅ Successfully reassigned expired task ${assignment.id}`);
        } else {
          this.logger.log(`⚠️ Could not reassign task ${assignment.id} - no available employees`);
        }

      } catch (error) {
        this.logger.error(`❌ Error processing expired task ${assignment.id}:`, error);
      }
    }

    this.logger.log(`✅ Expired task reassignment completed: ${reassignedCount} tasks reassigned`);
  }

  /**
   * Verifică dacă un task a expirat
   */
  private isTaskExpired(assignment: TaskAssignment, now: Date): boolean {
    // Verifică dacă task-ul a fost amânat
    const wasPostponed = assignment.was_postponed === true;

    if (wasPostponed) {
      // Dacă task-ul a fost amânat, verifică due_date (deadline-ul după amânare)
      if (assignment.due_date) {
        return now > assignment.due_date;
      }
      return false;
    }

    // Dacă nu a fost amânat, verifică deadline-ul normal

    // Caută elementul finish_at pentru deadline fix
    const finishAtElement = assignment.elements?.find(el => 
      el.task_element?.element_type === 'finish_at'
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
    const finalizedInElement = assignment.elements?.find(el => 
      el.task_element?.element_type === 'finalized_in'
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
        const programatLaElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'scheduled_datetime'
        );
        
        let startTime: Date;
        if (programatLaElement && programatLaElement.value) {
          startTime = new Date(programatLaElement.value);
          this.logger.log(`⏰ Task ${assignment.id} - Cronometru expiră de la scheduled_datetime: ${startTime.toISOString()}`);
        } else {
          startTime = new Date(assignment.assigned_at);
          this.logger.log(`⏰ Task ${assignment.id} - Cronometru expiră de la assigned_at: ${startTime.toISOString()}`);
        }
        
        const deadline = new Date(startTime.getTime() + (hours * 60 + minutes) * 60 * 1000);
        
        this.logger.log(`⏰ Task ${assignment.id} deadline check: now=${now.toISOString()}, deadline=${deadline.toISOString()}, expired=${now > deadline}`);

        return now > deadline;
      } catch (e) {
        this.logger.warn(`Failed to parse finalized_in data for task ${assignment.id}:`, e);
        return false;
      }
    }

    return false;
  }

  /**
   * Reatribuie un task expirat la alt angajat disponibil
   */
  private async reassignExpiredTask(assignment: TaskAssignment, now: Date): Promise<boolean> {
    try {
      // Obține locația task-ului (din elementele task-ului)
      const locationElement = assignment.elements?.find(el => 
        el.task_element?.element_type === 'work_location'
      );
      
      let locationId = locationElement?.value ? parseInt(locationElement.value) : null;
      
      // Dacă nu găsim locația din elemente, încercăm să o obținem din angajatul curent
      if (!locationId && assignment.assigned_to_id) {
        try {
          const employeeResponse = await firstValueFrom(
            this.httpService.get(`http://giurom.bitap.ro:3002/employees/${assignment.assigned_to_id}`, {
              headers: {
                'x-internal-service': 'tasks',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json'
              }
            })
          );
          
          const employee = employeeResponse.data;
          locationId = employee?.work_location_default_id || employee?.work_location_id;
          this.logger.log(`📍 Location ID ${locationId} obtained from employee ${assignment.assigned_to_id}`);
        } catch (error) {
          this.logger.error(`❌ Could not get employee location:`, error.message);
        }
      }
      
      if (!locationId) {
        this.logger.log(`⚠️ Could not determine location for task ${assignment.id}`);
        return false;
      }
      
      // Obține data pentru care trebuie să găsim angajați (ziua curentă)
      const targetDate = new Date(now);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Apelează serviciul de attendance pentru a găsi shift-urile active
      let availableEmployees: any[] = [];
      
      try {
        this.logger.log(`🔍 Calling attendance service: http://giurom.bitap.ro:3002/attendance/shifts?work_location_id=${locationId}&limit=1000`);
        
        const shiftsResponse = await firstValueFrom(
          this.httpService.get(`http://giurom.bitap.ro:3002/attendance/shifts?work_location_id=${locationId}&limit=1000`, {
            headers: {
              'x-internal-service': 'tasks',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json'
            }
          })
        );
        
        // Extrage array-ul de shifts (format: { data: [...], total, page, limit })
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (shiftsResponse.data && Array.isArray(shiftsResponse.data.data)) {
          allShifts = shiftsResponse.data.data;
        }
        
        // Filtrează shift-urile pentru ziua curentă
        const todayShifts = allShifts.filter((shift: any) => {
          const shiftDate = new Date(shift.start_datetime);
          return shiftDate.toISOString().split('T')[0] === dateStr;
        });
        
        this.logger.log(`📋 Found ${todayShifts.length} shifts for location ${locationId} on ${dateStr}`);
        
        // Extrage ID-urile unice ale angajaților cu shift astăzi
        const employeeIds = [...new Set(todayShifts.map((shift: any) => shift.employee_id))];
        this.logger.log(`📋 Unique employee IDs with shifts: ${employeeIds.join(', ')}`);
        
        // Obține detaliile angajaților
        if (employeeIds.length > 0) {
          const employeesResponse = await firstValueFrom(
            this.httpService.get(`http://giurom.bitap.ro:3002/employees`, {
              headers: {
                'x-internal-service': 'tasks',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json'
              }
            })
          );
          
          const allEmployees = employeesResponse.data?.employees || [];
          availableEmployees = allEmployees.filter((emp: any) => employeeIds.includes(emp.id));
          
          this.logger.log(`📋 Found ${availableEmployees.length} employees with active shifts`);
          this.logger.log(`📋 Available employees: ${JSON.stringify(availableEmployees.map((e: any) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })))}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error fetching employees from attendance service:`, error.message);
        this.logger.error(`❌ Error details:`, error.response?.data || error);
      }

      // Filtrează angajații: exclude angajatul curent
      const currentEmployeeId = assignment.assigned_to_id;
      const eligibleEmployees = availableEmployees.filter((emp: any) => emp.id !== currentEmployeeId);

      if (eligibleEmployees.length === 0) {
        this.logger.log(`⚠️ No eligible employees found for reassignment of task ${assignment.id} (location: ${locationId}, date: ${dateStr})`);
        return false;
      }

      // Selectează un angajat random
      const randomIndex = Math.floor(Math.random() * eligibleEmployees.length);
      const selectedEmployee = eligibleEmployees[randomIndex];

      this.logger.log(`🎲 Randomly selected employee ${selectedEmployee.id} (${selectedEmployee.first_name} ${selectedEmployee.last_name}) for task ${assignment.id}`);

      // Reatribuie task-ul la noul angajat
      await this.assignmentRepository.update(assignment.id, {
        assigned_to_id: selectedEmployee.id,
        assigned_at: now, // Resetează data de atribuire
        notes: `${assignment.notes || ''}\n🔄 Reatribuit automat de la angajatul ${currentEmployeeId} la ${selectedEmployee.first_name} ${selectedEmployee.last_name} din cauza expirării (${now.toISOString()})`
      });

      this.logger.log(`✅ Task ${assignment.id} reassigned from employee ${currentEmployeeId} to ${selectedEmployee.id}`);
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Error reassigning task ${assignment.id}:`, error);
      return false;
    }
  }
}
