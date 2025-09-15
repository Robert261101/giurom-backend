import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, IsNull } from 'typeorm';
import { TaskAssignment, AssignmentStatus } from './entity/task-assignment.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ScheduledTasksService {
  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
  ) {}

  /**
   * Găsește toate sarcinile programate
   */
  async getScheduledTasks(): Promise<TaskAssignment[]> {
    return this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.SCHEDULED,
      },
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        scheduled_datetime: 'ASC'
      }
    });
  }

  /**
   * Găsește sarcinile programate pentru o dată specifică
   */
  async getScheduledTasksForDate(date: Date): Promise<TaskAssignment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.SCHEDULED,
        scheduled_datetime: LessThanOrEqual(endOfDay)
      },
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        scheduled_datetime: 'ASC'
      }
    });
  }

  /**
   * Activează sarcinile programate pentru ziua curentă
   * Rulează automat la fiecare 00:00 noaptea
   */
  @Cron('0 0 * * *')
  async activateScheduledTasksForToday(): Promise<void> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`🔍 [ScheduledTasksService] Verificare sarcinile programate pentru ${today.toISOString().split('T')[0]}`);

    try {
      const scheduledTasks = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.SCHEDULED,
          scheduled_datetime: LessThanOrEqual(endOfDay)
        }
      });

      if (scheduledTasks.length > 0) {
        console.log(`🔍 [ScheduledTasksService] Găsite ${scheduledTasks.length} sarcini programate pentru activare`);

        // Activează sarcinile (schimbă statusul din SCHEDULED în ASSIGNED)
        const updateResult = await this.assignmentRepository.update(
          {
            status: AssignmentStatus.SCHEDULED,
            scheduled_datetime: LessThanOrEqual(endOfDay)
          },
          {
            status: AssignmentStatus.ASSIGNED
          }
        );

        console.log(`✅ [ScheduledTasksService] ${updateResult.affected} sarcini au fost activate`);
      } else {
        console.log(`ℹ️ [ScheduledTasksService] Nu sunt sarcini programate pentru activare astăzi`);
      }
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la activarea sarcinilor programate:`, error);
    }
  }

  /**
   * Generează sarcini recurente pentru ziua curentă
   * Rulează automat la fiecare 12:00
   */
  @Cron('0 12 * * *')
  async generateRecurringTasks(): Promise<void> {
    const today = new Date();
    console.log(`🔍 [ScheduledTasksService] Verificare sarcini recurente pentru ${today.toISOString().split('T')[0]}`);

    try {
      // Găsește toate sarcinile cu recurență activă
      const recurringTasks = await this.assignmentRepository.find({
        where: {
          recurrence_settings: Not(IsNull())
        },
        relations: ['template', 'elements', 'elements.task_element']
      });

      console.log(`🔍 [ScheduledTasksService] Găsite ${recurringTasks.length} sarcini cu recurență`);

      for (const task of recurringTasks) {
        await this.processRecurringTask(task, today);
      }
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la generarea sarcinilor recurente:`, error);
    }
  }

  private async processRecurringTask(task: TaskAssignment, today: Date): Promise<void> {
    try {
      const recurrenceSettings = task.recurrence_settings;
      
      if (!recurrenceSettings?.enabled) {
        return;
      }

      // Verifică dacă trebuie să creeze sarcini pentru ziua curentă
      const shouldCreateToday = this.shouldCreateTasksForToday(recurrenceSettings, today);
      
      if (!shouldCreateToday) {
        return;
      }

      console.log(`🔍 [ScheduledTasksService] Creez sarcini recurente pentru task-ul ${task.id}`);

      // Simulează crearea de sarcini pentru departament (ca la departamente)
      await this.createRecurringTasksForDepartment(task);

    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la procesarea task-ului ${task.id}:`, error);
    }
  }

  private shouldCreateTasksForToday(recurrenceSettings: any, today: Date): boolean {
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayName = dayNames[dayOfWeek];

    if (recurrenceSettings.frequency === 'daily') {
      return recurrenceSettings.days?.includes(todayName) || false;
    }

    return false; // Pentru test, doar zilnic
  }

  private async createRecurringTasksForDepartment(parentTask: TaskAssignment): Promise<void> {
    // Simulează crearea de sarcini pentru departament
    // În realitate, aici ai apela assignmentService.create() pentru fiecare angajat
    
    console.log(`🔍 [ScheduledTasksService] Simulez crearea sarcinilor pentru departamentul ${parentTask.assigned_to_id}`);
    console.log(`🔍 [ScheduledTasksService] Task părinte: ${parentTask.id}, Template: ${parentTask.template_id}`);
    
    // TODO: Implementează logica de creare reală aici
    // Pentru test, doar loghează
  }

  /**
   * Verifică și activează task-urile cu "Vizibil de la" pentru ziua curentă
   * Rulează automat la fiecare 00:00 noaptea
   */
  @Cron('0 0 * * *')
  async checkVisibleFromTasks(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Mâine
    console.log(`🔍 [ScheduledTasksService] Verificare task-uri cu "Vizibil de la" pentru ${today} și ${tomorrow}`);

    try {
      // Găsește toate task-urile cu status ASSIGNED care au elemente
      const assignments = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.ASSIGNED
        },
        relations: ['elements', 'elements.task_element']
      });

      console.log(`🔍 [ScheduledTasksService] Găsite ${assignments.length} task-uri cu status ASSIGNED`);
      let activatedCount = 0;

      for (const assignment of assignments) {
        // Caută elementul visible_from
        const visibleFromElement = assignment.elements?.find(element => 
          element.task_element?.element_type === 'visible_from'
        );

        console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - visibleFromElement:`, visibleFromElement);

        if (visibleFromElement?.value) {
          let visibleFromDate: string | null = null;
          
          try {
            const visibleFromData = JSON.parse(visibleFromElement.value);
            visibleFromDate = visibleFromData.date;
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - JSON parsed, date:`, visibleFromDate);
          } catch (e) {
            // Dacă nu e JSON, folosește valoarea direct
            visibleFromDate = visibleFromElement.value;
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - direct value:`, visibleFromDate);
          }

          if (visibleFromDate) {
            const visibleDate = new Date(visibleFromDate).toISOString().split('T')[0];
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - today: ${today}, visibleDate: ${visibleDate}, match: ${today === visibleDate}`);
            
            if (today === visibleDate || tomorrow === visibleDate) {
              console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} devine vizibil ${today === visibleDate ? 'astăzi' : 'mâine'} (${visibleDate})`);
              // Task-ul devine vizibil - nu schimbăm statusul, doar logăm
              activatedCount++;
            }
          }
        }
      }

      if (activatedCount > 0) {
        console.log(`✅ [ScheduledTasksService] ${activatedCount} task-uri cu "Vizibil de la" devin vizibile astăzi`);
      } else {
        console.log(`ℹ️ [ScheduledTasksService] Nu sunt task-uri cu "Vizibil de la" care să devină vizibile astăzi`);
      }
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la verificarea task-urilor cu "Vizibil de la":`, error);
    }
  }

  /**
   * Programează o sarcină (schimbă statusul în SCHEDULED)
   */
  async scheduleTask(assignmentId: number, scheduledDateTime: Date): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'elements', 'elements.task_element']
    });

    if (!assignment) {
      throw new Error(`Assignment cu ID ${assignmentId} nu a fost găsit`);
    }

    assignment.status = AssignmentStatus.SCHEDULED;
    assignment.scheduled_datetime = scheduledDateTime;

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Anulează programarea unei sarcini (schimbă statusul în ASSIGNED)
   */
  async unscheduleTask(assignmentId: number): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'elements', 'elements.task_element']
    });

    if (!assignment) {
      throw new Error(`Assignment cu ID ${assignmentId} nu a fost găsit`);
    }

    assignment.status = AssignmentStatus.ASSIGNED;
    assignment.scheduled_datetime = null;

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Verifică și actualizează statusul sarcinilor în funcție de data programată
   * Poate fi apelată manual pentru testare
   */
  async checkAndUpdateScheduledTasks(): Promise<{ activated: number; total: number }> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const scheduledTasks = await this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.SCHEDULED,
        scheduled_datetime: LessThanOrEqual(endOfDay)
      }
    });

    if (scheduledTasks.length > 0) {
      const updateResult = await this.assignmentRepository.update(
        {
          status: AssignmentStatus.SCHEDULED,
          scheduled_datetime: LessThanOrEqual(endOfDay)
        },
        {
          status: AssignmentStatus.ASSIGNED
        }
      );

      return {
        activated: updateResult.affected || 0,
        total: scheduledTasks.length
      };
    }

    return {
      activated: 0,
      total: 0
    };
  }
}
