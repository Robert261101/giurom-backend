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
   * Cron job care rulează la fiecare minut pentru atribuirea automată FCFS
   * Gestionează task-urile cu "primul venit, primul servit" care nu au fost preluate
   */
  @Cron('0 * * * * *') // La fiecare minut
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
    
    // Găsește toate task-urile FCFS care sunt în status ASSIGNED și nu au fost preluate
    const fcfsAssignments = await this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.ASSIGNED,
        assignment_mode: 'first_come_first_served' as any,
        department_group_id: Not(IsNull()) // Doar task-urile de grup
      },
      relations: ['elements', 'elements.task_element', 'template']
    });

    // Grupează task-urile după department_group_id pentru a procesa doar un task per grup
    const groupedAssignments = new Map<string, TaskAssignment[]>();
    for (const assignment of fcfsAssignments) {
      const groupId = assignment.department_group_id;
      if (!groupedAssignments.has(groupId)) {
        groupedAssignments.set(groupId, []);
      }
      groupedAssignments.get(groupId)!.push(assignment);
    }

    // Pentru fiecare grup, alege doar primul task pentru procesare
    const validFCFSAssignments: TaskAssignment[] = [];
    for (const [groupId, tasks] of groupedAssignments) {
      // Verifică dacă există deja un task acceptat în acest grup
      const existingAcceptedTask = await this.assignmentRepository.findOne({
        where: {
          department_group_id: groupId,
          status: AssignmentStatus.IN_PROGRESS
        }
      });

      if (!existingAcceptedTask) {
        // Alege primul task din grup pentru procesare
        validFCFSAssignments.push(tasks[0]);
        this.logger.log(`🎯 Selected task ${tasks[0].id} from group ${groupId} (${tasks.length} tasks in group)`);
      } else {
        this.logger.log(`⏭️ Skipping group ${groupId} - already has accepted task ${existingAcceptedTask.id}`);
      }
    }

    this.logger.log(`🎯 Found ${fcfsAssignments.length} FCFS assignments, ${validFCFSAssignments.length} valid to process`);

    let processedCount = 0;
    let autoAssignedCount = 0;
    let deletedCount = 0;

    for (const assignment of validFCFSAssignments) {
      try {
        const result = await this.processFCFSAssignment(assignment, now);
        
        if (result.action === 'auto_assigned') {
          autoAssignedCount++;
        } else if (result.action === 'deleted') {
          deletedCount++;
        }
        
        processedCount++;
        this.logger.log(`✅ Processed FCFS assignment ${assignment.id}: ${result.action}`);
        
      } catch (error) {
        this.logger.error(`❌ Error processing FCFS assignment ${assignment.id}:`, error.message);
      }
    }

    this.logger.log(`🎯 FCFS auto-assignment completed: ${processedCount} processed, ${autoAssignedCount} auto-assigned, ${deletedCount} deleted`);
  }

  /**
   * Procesează un singur task FCFS și decide ce acțiune să ia
   */
  private async processFCFSAssignment(assignment: TaskAssignment, now: Date): Promise<{ action: string; details?: any }> {
    const assignedAt = new Date(assignment.assigned_at);
    const hoursSinceAssigned = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);
    
    this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: hoursSinceAssigned=${hoursSinceAssigned.toFixed(2)}`);
    
    // Verifică dacă au trecut 1 minut de la atribuire (pentru testare)
    if (hoursSinceAssigned < 0.016) { // 1 minut = 0.016 ore
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Still waiting (${hoursSinceAssigned.toFixed(2)} hours < 0.016)`);
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

    // Logica de decizie conform cerințelor
    if ((!finalizedInElement || !finalizedInElement.value) && (!finalizedLaElement || !finalizedLaElement.value) && (!finishAtElement || !finishAtElement.value)) {
      // Nu există finalized_in, finalized_la sau finish_at
      this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: No finalized_in, finalized_la or finish_at, hoursUntilMidnight=${hoursUntilMidnight.toFixed(2)}`);
      if (hoursUntilMidnight > 4) {
        // Mai mult de 4 ore până la 00:00 - atribuie după 2 ore
        this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (no deadline elements, >4h to midnight)`);
        return await this.autoAssignFCFSTask(assignment);
      } else {
        // Mai puțin de 4 ore până la 00:00 - nu atribuie
        this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Waiting (no deadline elements, <4h to midnight)`);
        return { action: 'waiting', details: { reason: 'less_than_4_hours_to_midnight', hoursUntilMidnight } };
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
            // Mai mult de 4 ore până la 00:00 - atribuie după 2 ore
            this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Auto-assigning (>4h to deadline, with postpone, >4h to midnight)`);
            return await this.autoAssignFCFSTask(assignment);
          } else {
            // Mai puțin de 4 ore până la 00:00 - nu atribuie
            this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Waiting (>4h to deadline, with postpone, <4h to midnight)`);
            return { action: 'waiting', details: { reason: 'less_than_4_hours_to_midnight_with_postpone', hoursUntilMidnight } };
          }
        }
      } else {
        // Mai puțin de 4 ore până la deadline - nu atribuie
        this.logger.log(`🔍 [FCFS-DEBUG] Task ${assignment.id}: Waiting (<4h to deadline)`);
        return { action: 'waiting', details: { reason: 'less_than_4_hours_to_deadline', hoursUntilDeadline } };
      }
    }
  }

  /**
   * Atribuie automat un task FCFS unui angajat random din departament
   * Face exact același lucru ca acceptTask() manual, doar că automat
   */
  private async autoAssignFCFSTask(assignment: TaskAssignment): Promise<{ action: string; details?: any }> {
    try {
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);
      this.logger.log(`🔍 [AUTO-ACCEPT] Auto-accepting task ${assignment.id} for department group: ${assignment.department_group_id}`);
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);

      // Obține angajații care sunt deja atribuiți la task-urile din acest grup
      const allGroupTasks = await this.assignmentRepository.find({
        where: { department_group_id: assignment.department_group_id }
      });

      this.logger.log(`🔍 [AUTO-ACCEPT] All tasks in group:`, allGroupTasks.map(t => ({ id: t.id, assigned_to_id: t.assigned_to_id, status: t.status })));

      // Extrage ID-urile unice ale angajaților atribuiți
      const assignedEmployeeIds = [...new Set(allGroupTasks.map(task => task.assigned_to_id).filter(id => id !== null))];
      
      if (assignedEmployeeIds.length === 0) {
        this.logger.warn(`⚠️ No assigned employees found for department group ${assignment.department_group_id}`);
        return { action: 'no_employees' };
      }

      this.logger.log(`🔍 [AUTO-ACCEPT] Assigned employee IDs:`, assignedEmployeeIds);

      // Obține informațiile despre angajați
      const departmentEmployees = await this.getEmployeesByIds(assignedEmployeeIds);
      
      if (!departmentEmployees || departmentEmployees.length === 0) {
        this.logger.warn(`⚠️ No employee details found for IDs: ${assignedEmployeeIds.join(', ')}`);
        return { action: 'no_employees' };
      }

      // Alege un angajat random din cei atribuiți
      const randomIndex = Math.floor(Math.random() * departmentEmployees.length);
      const selectedEmployee = departmentEmployees[randomIndex];

      this.logger.log(`🔍 [AUTO-ACCEPT] Selected employee: ${selectedEmployee.id} (${selectedEmployee.first_name} ${selectedEmployee.last_name})`);

      // LOGICA EXACTĂ CA ÎN acceptTask() - Șterge toate celelalte task-uri din grup
      let deletedTasksCount = 0;
      
      if (assignment.assignment_mode === 'first_come_first_served') {
        this.logger.log(`🔍 [AUTO-ACCEPT] [FIRST_COME_FIRST_SERVED] Șterg celelalte taskuri din grup`);
        
        // Găsește toate task-urile din același grup (orice status)
        const allGroupTasks = await this.assignmentRepository.find({
          where: { department_group_id: assignment.department_group_id }
        });

        this.logger.log(`🔍 [AUTO-ACCEPT] All tasks in group (any status):`, allGroupTasks.map(t => ({ id: t.id, assigned_to_id: t.assigned_to_id, status: t.status })));

        // Filtrează doar task-urile care nu sunt cel acceptat
        const otherTasks = allGroupTasks.filter(task => task.id !== assignment.id);
        
        this.logger.log(`🔍 [AUTO-ACCEPT] Other tasks to delete:`, otherTasks.map(t => ({ id: t.id, assigned_to_id: t.assigned_to_id, status: t.status })));

        if (otherTasks.length > 0) {
          this.logger.log(`🔍 [AUTO-ACCEPT] Attempting to delete ${otherTasks.length} tasks...`);
          
          for (const taskToDelete of otherTasks) {
            this.logger.log(`🔍 [AUTO-ACCEPT] Deleting task ${taskToDelete.id} (assigned to ${taskToDelete.assigned_to_id}, status: ${taskToDelete.status})`);
            const deleteResult = await this.assignmentRepository.remove(taskToDelete);
            this.logger.log(`🔍 [AUTO-ACCEPT] Delete result for task ${taskToDelete.id}:`, deleteResult);
          }
          
          deletedTasksCount = otherTasks.length;
          this.logger.log(`✅ [AUTO-ACCEPT] [FIRST_COME_FIRST_SERVED] Deleted ${otherTasks.length} other tasks from the group`);
        } else {
          this.logger.log(`ℹ️ [AUTO-ACCEPT] [FIRST_COME_FIRST_SERVED] No other tasks to delete in the group`);
        }
      }

      // Actualizează task-ul acceptat (rămâne ASSIGNED pentru consistență cu logica manuală)
      this.logger.log(`🔍 [AUTO-ACCEPT] Updating task ${assignment.id} to ASSIGNED...`);
      
      const updateResult = await this.assignmentRepository.update(assignment.id, {
        assigned_to_id: selectedEmployee.id,
        status: AssignmentStatus.ASSIGNED
      });

      this.logger.log(`🔍 [AUTO-ACCEPT] Update result for accepted task:`, updateResult);
      this.logger.log(`✅ [AUTO-ACCEPT] Task ${assignment.id} auto-accepted and updated to assigned`);

      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);
      this.logger.log(`✅ [AUTO-ACCEPT] Task auto-acceptance completed successfully!`);
      this.logger.log(`🔍 [AUTO-ACCEPT] ==========================================`);

      return { 
        action: 'auto_assigned', 
        details: { 
          assignedTo: selectedEmployee.id,
          deletedOthers: deletedTasksCount 
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
   * Obține angajații dintr-un departament
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
        this.httpService.get(`http://localhost:3012/employees?department=${departmentId}`)
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
        this.httpService.get(`http://localhost:3012/employees`)
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
}
