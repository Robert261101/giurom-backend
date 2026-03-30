import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, IsNull, Between, In } from 'typeorm';
import {
  TaskAssignment,
  AssignmentStatus,
  Priority,
  AssignmentMode,
} from './entity/task-assignment.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { TaskGateway } from '../websocket/task.gateway';

@Injectable()
export class ScheduledTasksService {
  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    private assignmentService: AssignmentService,
    private httpService: HttpService,
    private jwtService: JwtService,
    private taskGateway: TaskGateway,
  ) {}

  /**
   * Formatează o dată în timezone-ul României pentru logging
   */
  private formatDateForRomania(date: Date): string {
    return date.toLocaleString('ro-RO', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Returnează string-ul YYYY-MM-DD corespunzător datei în timezone-ul Europe/Bucharest.
   * Folosește Intl.formatToParts pentru a evita parsing invalid (en-GB toLocaleString în Node poate da Invalid Date).
   * Returnează '' dacă data este invalidă.
   */
  private toRomaniaDate(d: Date | string | null | undefined): string {
    if (d == null) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(dt);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
    return '';
  }

  /**
   * Generează un token de serviciu pentru autentificarea inter-microservicii
   */
  private generateServiceToken(): string {
    const payload = {
      sub: 'tasks-service',
      permissions: ['attendance.read'],
      service: 'tasks-scheduled',
      iat: Math.floor(Date.now() / 1000),
    };
    return this.jwtService.sign(payload, { expiresIn: '24h' });
  }

  /**
   * Calculează due_date pentru task-urile recurente.
   * - Dacă există element `finalized_in` -> adaugă durata la `assignedAt`
   * - Altfel -> fallback la sfârșitul zilei (23:59:59.999)
   */
  private computeDueDateForRecurring(
    parentTask: TaskAssignment,
    assignedAt: Date,
  ): Date {
    try {
      const elements = (parentTask.elements as any[]) || [];

      // 1) finalized_in (ore/minute) -> assignedAt + finalized_in
      const finalizedInEl = elements.find(
        (e: any) => e.task_element?.element_type === 'finalized_in',
      );
      if (finalizedInEl?.value) {
        const v = finalizedInEl.value;
        const due = new Date(assignedAt);
        // Already an object { hours, minutes }
        if (typeof v === 'object') {
          const hours = Number(v.hours || 0) || 0;
          const minutes = Number(v.minutes || 0) || 0;
          due.setHours(due.getHours() + hours, due.getMinutes() + minutes, 0, 0);
          return due;
        }
        if (typeof v === 'string') {
          try {
            const parsedJson = JSON.parse(v);
            if (parsedJson && typeof parsedJson === 'object') {
              const hours = Number(parsedJson.hours || 0) || 0;
              const minutes = Number(parsedJson.minutes || 0) || 0;
              due.setHours(due.getHours() + hours, due.getMinutes() + minutes, 0, 0);
              return due;
            }
          } catch (_err) {
            // not JSON, continue
          }
          // Try HH:MM format
          const hhmm = (v as string).match(/^(\d{1,2}):(\d{1,2})$/);
          if (hhmm) {
            const hours = Number(hhmm[1]);
            const minutes = Number(hhmm[2]);
            due.setHours(due.getHours() + hours, due.getMinutes() + minutes, 0, 0);
            return due;
          }
          // Try minutes as number
          const minutesNum = Number(v);
          if (!Number.isNaN(minutesNum)) {
            due.setMinutes(due.getMinutes() + minutesNum);
            return due;
          }
        }
      }
    } catch (_e) {
      // Ignore parsing errors and fallback
    }

    // Fallback: sfârșitul zilei
    const end = new Date(assignedAt);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  async getScheduledTasks(): Promise<TaskAssignment[]> {
    return this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.SCHEDULED,
      },
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        assigned_at: 'ASC', // Ordonează după assigned_at în loc de scheduled_datetime pentru task-urile cu scheduled_datetime NULL
      },
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
        scheduled_datetime: LessThanOrEqual(endOfDay),
      },
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        scheduled_datetime: 'ASC',
      },
    });
  }

  /**
   * Activează sarcinile programate pentru ziua curentă
   * Rulează automat din minut în minut
   */
  async activateScheduledTasksForToday(): Promise<boolean> {
    const now = new Date();

    console.log(
      `🔍 [ScheduledTasksService] Verificare sarcinile programate pentru ${this.formatDateForRomania(now)}`,
    );

    try {
      const scheduledTasks = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.SCHEDULED,
          scheduled_datetime: LessThanOrEqual(now),
        },
      });

      if (scheduledTasks.length > 0) {
        console.log(
          `🔍 [ScheduledTasksService] Găsite ${scheduledTasks.length} sarcini programate pentru activare`,
        );

        // Activează sarcinile (schimbă statusul din SCHEDULED în ASSIGNED)
        const updateResult = await this.assignmentRepository.update(
          {
            status: AssignmentStatus.SCHEDULED,
            scheduled_datetime: LessThanOrEqual(now),
          },
          {
            status: AssignmentStatus.ASSIGNED,
          },
        );

        // Emit WebSocket + notificare "Task activ" pentru fiecare task activat (programat -> activ)
        for (const t of scheduledTasks) {
          try {
            const updated = await this.assignmentService.findOne(t.id);
            if (updated) {
              this.taskGateway.notifyTaskUpdate(updated);
              if (updated.assigned_to_id) {
                try {
                  const taskNameEl = (updated.elements as any[])?.find(
                    (el: any) => el.task_element?.element_type === 'task_name',
                  );
                  const displayName =
                    taskNameEl?.value?.trim() ||
                    updated.template?.template_name ||
                    'Sarcină';
                  await this.assignmentService.sendTaskNotificationForEmployee(
                    'assignment.became_visible',
                    'Task activ',
                    `Task-ul "${displayName}" a trecut în sarcini active.`,
                    updated.id,
                    updated.assigned_to_id,
                  );
                  console.log(
                    `📤 [ScheduledTasksService] Notificare "Task activ" trimisă (programat→activ) task ${updated.id}, assigned_to_id=${updated.assigned_to_id}`,
                  );
                } catch (e: any) {
                  console.warn(
                    `[ScheduledTasksService] Eroare notificare became_visible task ${t.id}:`,
                    e?.message || e,
                  );
                }
              }
            }
          } catch (e) {
            // ignoră erori la emit
          }
        }

        console.log(
          `✅ [ScheduledTasksService] ${updateResult.affected || 0} sarcini au fost activate`,
        );
        return (updateResult.affected || 0) > 0;
      } else {
        console.log(
          `ℹ️ [ScheduledTasksService] Nu sunt sarcini programate pentru activare acum`,
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ [ScheduledTasksService] Eroare la activarea sarcinilor programate:`,
        error,
      );
      return false;
    }
  }

  /**
   * Generează sarcini recurente și verifică task-uri active
   * Rulează automat la fiecare minut
   */
  @Cron('* * * * *')
  async generateRecurringTasksAndCheckActive(): Promise<void> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayName = dayNames[dayOfWeek];

    const currentTime = now.toTimeString().split(' ')[0];

    let hasRelevantActivity = false;

    try {
      // 1. VERIFICĂ RECURENȚA (la fiecare minut)
      const recurringActivity = await this.processRecurringTasks(
        now,
        todayName,
      );
      if (recurringActivity) hasRelevantActivity = true;

      // 2. VERIFICĂ TASK-URI PROGRAMATE (la fiecare minut)
      const scheduledActivity = await this.activateScheduledTasksForToday();
      if (scheduledActivity) hasRelevantActivity = true;

      // 3. VERIFICĂ TASK-URI VIZIBIL DE LA (la fiecare minut)
      const visibleActivity = await this.checkVisibleFromTasks();
      if (visibleActivity) hasRelevantActivity = true;

      // 4. VERIFICĂ TASK-URI ACTIVE (la fiecare minut)
      await this.checkAndNotifyActiveTasks(now);

      // Afișează log-ul doar dacă s-a întâmplat ceva relevant
      if (hasRelevantActivity) {
        console.log(`🔄 [CRONJOB] ==========================================`);
        console.log(`🔄 [CRONJOB] ACTIVITATE DETECTATĂ - ${currentTime}`);
        console.log(`🔄 [CRONJOB] Data: ${dateStr} (${todayName})`);
        console.log(`🔄 [CRONJOB] ==========================================`);
      }
    } catch (error) {
      console.error(`❌ [CRONJOB] Eroare la verificarea sarcinilor:`, error);
    }
  }

  /**
   * Procesează sarcinile recurente (la fiecare minut)
   */
  private async processRecurringTasks(
    today: Date,
    todayName: string,
  ): Promise<boolean> {
    console.log(`🔄 [RECURENTA] PROCESARE RECURENȚĂ - ${todayName}`);

    // Găsește toate sarcinile cu recurență activă
    const recurringTasks = await this.assignmentRepository.find({
      where: {
        recurrence_settings: Not(IsNull()),
      },
      relations: ['template', 'elements', 'elements.task_element'],
    });

    console.log(
      `🔍 [RECURENTA] Găsite ${recurringTasks.length} sarcini cu recurență activă`,
    );

    let processedCount = 0;
    let createdCount = 0;

    for (const task of recurringTasks) {
      processedCount++;

      // Verifică dacă trebuie să creeze task-ul pentru ziua curentă
      const shouldCreate = this.shouldCreateTasksForToday(
        task.recurrence_settings,
        today,
      );
      if (shouldCreate) {
        // Verifică dacă este ora corectă pentru a crea task-ul
        const shouldCreateNow = this.shouldCreateTasksForCurrentTime(
          task.recurrence_settings,
          today,
          todayName,
        );
        if (shouldCreateNow) {
          console.log(
            `🔄 [RECURENTA] CREARE TASK RECURENT - ${todayName} - Task ID: ${task.id}`,
          );

          await this.processRecurringTask(task, today);
          createdCount++;
        }
      }
    }

    console.log(
      `🔄 [RECURENTA] RECURENȚĂ COMPLETĂ - Task-uri procesate: ${processedCount}, create: ${createdCount}`,
    );

    return createdCount > 0;
  }

  /**
   * Verifică și notifică task-urile care devin active (la fiecare minut)
   */
  private async checkAndNotifyActiveTasks(now: Date): Promise<void> {
    try {
      // Găsește task-urile care devin active în următoarele 60 de secunde
      const startTime = new Date(now);
      const endTime = new Date(now.getTime() + 60000); // +1 minut

      const activeTasks = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.ASSIGNED,
          scheduled_datetime: Between(startTime, endTime),
        },
        relations: ['template'],
      });

      if (activeTasks.length > 0) {
        const currentTime = now.toTimeString().split(' ')[0];
        console.log(
          `🔔 [SOCKET] Notific ${activeTasks.length} task-uri active la ${currentTime}`,
        );

        // TODO: Implementează socket-ul aici
        // this.socketGateway.emit('tasksBecameActive', {
        //   time: currentTime,
        //   tasks: activeTasks,
        //   count: activeTasks.length
        // });

        console.log(
          `🔔 [SOCKET] Task-uri active:`,
          activeTasks.map((t) => ({
            id: t.id,
            template: t.template?.template_name,
            scheduled: t.scheduled_datetime,
          })),
        );
      }
    } catch (error) {
      console.error(
        `❌ [SOCKET] Eroare la verificarea task-urilor active:`,
        error,
      );
    }
  }

  private async processRecurringTask(
    task: TaskAssignment,
    today: Date,
  ): Promise<void> {
    try {
      const recurrenceSettings = task.recurrence_settings;

      if (!recurrenceSettings?.enabled) {
        return;
      }

      // Verifică dacă trebuie să creeze sarcini pentru ziua curentă
      const shouldCreateToday = this.shouldCreateTasksForToday(
        recurrenceSettings,
        today,
      );

      if (!shouldCreateToday) {
        return;
      }

      // Verifică dacă task-ul a fost deja creat astăzi pentru a evita duplicatele
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const existingTaskToday = await this.assignmentRepository.findOne({
        where: {
          parent_recurrence_id: task.id.toString(),
          assigned_at: Between(todayStart, todayEnd),
        },
      });

      if (existingTaskToday) {
        console.log(
          `⏭️ [RECURENTA] Task recurent ${task.id} deja creat astăzi (ID: ${existingTaskToday.id}), skip.`,
        );
        return;
      }

      console.log(
        `🔍 [ScheduledTasksService] Creez sarcini recurente pentru task-ul ${task.id}`,
      );

      // Simulează crearea de sarcini pentru departament (ca la departamente)
      await this.createRecurringTasksForDepartment(task);
    } catch (error) {
      console.error(
        `❌ [ScheduledTasksService] Eroare la procesarea task-ului ${task.id}:`,
        error,
      );
    }
  }

  private shouldCreateTasksForToday(
    recurrenceSettings: any,
    today: Date,
  ): boolean {
    if (!recurrenceSettings?.enabled) {
      return false;
    }

    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayName = dayNames[dayOfWeek];
    const dayOfMonth = today.getDate();

    switch (recurrenceSettings.frequency) {
      case 'daily':
        return recurrenceSettings.days?.includes(todayName) || false;

      case 'weekly':
        // Pentru weekly, verifică doar dacă ziua curentă este în lista de zile
        return recurrenceSettings.days?.includes(todayName) || false;

      case 'monthly':
        // Verifică dacă este ziua corectă din lună
        return recurrenceSettings.days?.includes(dayOfMonth);

      case 'yearly':
        // Verifică dacă este luna și ziua corectă
        const month = today.getMonth() + 1; // 1-12
        return (
          recurrenceSettings.months?.includes(month) &&
          recurrenceSettings.days?.includes(dayOfMonth)
        );

      default:
        console.warn(
          `🔍 [ScheduledTasksService] Tip de recurență necunoscut: ${recurrenceSettings.frequency}`,
        );
        return false;
    }
  }

  /**
   * Verifică dacă trebuie să creeze task-ul pentru ora curentă
   */
  private shouldCreateTasksForCurrentTime(
    recurrenceSettings: any,
    now: Date,
    todayName: string,
  ): boolean {
    if (!recurrenceSettings?.enabled) {
      return false;
    }

    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Verifică dacă există oră specifică pentru ziua curentă
    const specificTime = recurrenceSettings.times?.[todayName];
    if (specificTime) {
      const [hours, minutes] = specificTime.split(':').map(Number);

      // Verifică dacă ora curentă a trecut de ora programată
      // (ora curentă > ora programată SAU ora egală și minutele >= minutele programate)
      const isPastScheduledTime =
        currentHour > hours ||
        (currentHour === hours && currentMinute >= minutes);

      if (isPastScheduledTime) {
        console.log(
          `🕐 [RECURENTA] Ora a trecut pentru ${todayName}: ${specificTime} (curent: ${currentTime})`,
        );
        return true;
      }
    } else {
      // Fallback la 09:00 dacă nu există oră specifică
      const isPastNineAM =
        currentHour > 9 || (currentHour === 9 && currentMinute >= 0);
      if (isPastNineAM) {
        console.log(
          `🕐 [RECURENTA] Ora fallback a trecut pentru ${todayName}: 09:00 (curent: ${currentTime})`,
        );
        return true;
      }
    }

    return false;
  }

  private async createRecurringTasksForDepartment(
    parentTask: TaskAssignment,
  ): Promise<void> {
    try {
      console.log(`🔄 [RECURENTA] Procesare task recurent ${parentTask.id}`);

      // Calculează datele pentru task-ul curent
      const today = new Date();
      const assignedAt = new Date(today);

      // Folosește ora din recurrence_settings.times pentru ziua curentă
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayName = dayNames[dayOfWeek];

      // Verifică dacă există oră specifică pentru ziua curentă
      const specificTime = parentTask.recurrence_settings?.times?.[todayName];
      if (specificTime) {
        const [hours, minutes] = specificTime.split(':').map(Number);
        assignedAt.setHours(hours, minutes, 0, 0);
      } else {
        assignedAt.setHours(9, 0, 0, 0); // 09:00 dimineața ca fallback
      }

      // Prevenire: dacă pentru acest parent s-a generat deja recurența azi, skip
      try {
        // Comparăm folosind data în timezone-ul României pentru a evita off-by-one UTC issues
        const assignedDateStr = this.toRomaniaDate(assignedAt);
        if (parentTask.last_recurrence_generated_date) {
          const lastGenStr = this.toRomaniaDate(
            new Date(parentTask.last_recurrence_generated_date),
          );
          if (lastGenStr === assignedDateStr) {
            console.log(
              `⏭️ [RECURENTA] Parent ${parentTask.id} deja generat pentru ${assignedDateStr} — skip.`,
            );
            return;
          }
        }
      } catch (e) {
        // dacă orice eroare la parse, continuăm normal
      }

      // LOG DETALIAT PENTRU ATRIBUIRILE RECURENTE
      const dateStr = today.toISOString().split('T')[0];
      const timeStr = assignedAt.toTimeString().split(' ')[0];

      console.log(
        `🔄 [RECURENTA] S-A ATRIBUIT SARCINA RECURENTĂ - Data: ${dateStr} (${todayName}), Ora: ${timeStr}, Task părinte ID: ${parentTask.id}`,
      );

      // Extrage department ID(s) din department_group_id
      // Format un singur grup: dept_3_timestamp_random
      // Format mai multe grupuri: depts_4_9_timestamp_random (aceeași recurență pentru toate)
      let departmentIdsForGroup: number[] = [];

      if (parentTask.department_group_id) {
        const groupId = parentTask.department_group_id;
        // Mai multe departamente: depts_4_9_timestamp_random (ID-uri 1-6 cifre, apoi timestamp 10+ cifre)
        const deptsMatch = groupId.match(
          /^depts_((?:\d{1,6}_)*\d{1,6})_\d{10,}_/,
        );
        if (deptsMatch) {
          const idsStr = deptsMatch[1];
          departmentIdsForGroup = idsStr
            .split('_')
            .map((s) => parseInt(s, 10))
            .filter((n) => !Number.isNaN(n) && n > 0 && n < 100000);
          console.log(
            `🔄 [RECURENTA] Mai multe grupuri (aceeași recurență): department_ids=${departmentIdsForGroup.join(', ')}`,
          );
        } else {
          const singleMatch = groupId.match(/^dept_(\d+)_/);
          if (singleMatch) {
            departmentIdsForGroup = [parseInt(singleMatch[1], 10)];
          }
        }
      }

      // Fallback la assigned_to_id dacă nu s-a găsit în department_group_id
      if (departmentIdsForGroup.length === 0 && parentTask.assigned_to_id) {
        departmentIdsForGroup = [parentTask.assigned_to_id];
      }

      // Logica de grup se face prin department_group_id
      if (parentTask.department_group_id && departmentIdsForGroup.length > 0) {
        if (departmentIdsForGroup.length === 1) {
          const departmentIdForGroup = departmentIdsForGroup[0];
          const recurrenceId = `dept_${departmentIdForGroup}_${Date.now()}_rec${parentTask.id}`;
          console.log(
            `🔄 [RECURENTA] Grup: Departament ID ${departmentIdForGroup} - Toate persoanele din grup vor primi sarcina`,
          );
          await this.createRecurringTasksForGroup(
            parentTask,
            assignedAt,
            recurrenceId,
            departmentIdForGroup,
          );
        } else {
          // Aceeași recurență pentru mai multe grupuri: creează task-uri pentru fiecare departament (dacă există angajați la postare)
          for (const departmentId of departmentIdsForGroup) {
            try {
              const recurrenceId = `dept_${departmentId}_${Date.now()}_rec${parentTask.id}`;
              console.log(
                `🔄 [RECURENTA] Grup ${departmentId}/${departmentIdsForGroup.join(',')} - Creez task-uri recurente`,
              );
              await this.createRecurringTasksForGroup(
                parentTask,
                assignedAt,
                recurrenceId,
                departmentId,
              );
            } catch (err) {
              console.warn(
                `⚠️ [RECURENTA] Skip departament ${departmentId}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }
      } else if (parentTask.department_group_id) {
        // department_group_id setat dar nu dept/depts (ex: loc_3_...) – un singur apel
        const recurrenceIdLoc = `recurrence_${parentTask.id}_${Date.now()}`;
        await this.createRecurringTasksForGroup(
          parentTask,
          assignedAt,
          recurrenceIdLoc,
        );
      } else {
        // Fără department_group_id
        const recurrenceId = `recurrence_${parentTask.id}_${Date.now()}`;
        const isGroupTask =
          parentTask.assignment_mode === 'first_come_first_served' ||
          parentTask.assignment_mode === 'everyone_gets_it';

        if (isGroupTask) {
          // Task pentru grup (FCFS sau everyone_gets_it) - creează task-uri pentru grup
          // NU folosim assigned_to_id din părinte pentru task-urile de grup
          console.log(
            `🔄 [RECURENTA] Grup (${parentTask.assignment_mode}) - Creez task-uri pentru grup (ignor assigned_to_id=${parentTask.assigned_to_id})`,
          );
          await this.createRecurringTasksForGroup(
            parentTask,
            assignedAt,
            recurrenceId,
          );
        } else {
          // Verifică dacă assigned_to_id este valid (nu este 0 sau null)
          if (!parentTask.assigned_to_id || parentTask.assigned_to_id === 0) {
            console.warn(
              `⚠️ [RECURENTA] Task părinte ${parentTask.id} nu are assigned_to_id valid (${parentTask.assigned_to_id}) - Nu pot crea task recurent`,
            );
            return;
          }

          console.log(
            `🔄 [RECURENTA] Responsabil: Persoană cu ID ${parentTask.assigned_to_id}`,
          );

          // Pentru persoane individuale, creează un singur task
          await this.createSingleRecurringTask(
            parentTask,
            assignedAt,
            recurrenceId,
          );
        }
      }

      console.log(
        `🔄 [RECURENTA] Setări recurență:`,
        JSON.stringify(parentTask.recurrence_settings, null, 2),
      );

      // Actualizează parent cu data ultimei generări pentru a preveni recreate în aceeași zi
      try {
        const assignedDateStr = this.toRomaniaDate(assignedAt);
        if (!assignedDateStr) {
          console.warn(
            `⚠️ [RECURENTA] assignedAt invalid pentru parent ${parentTask.id}, nu se actualizează last_recurrence_generated_date`,
          );
        } else {
          const assignedDateOnly = new Date(assignedDateStr);
          if (Number.isNaN(assignedDateOnly.getTime())) {
            console.warn(
              `⚠️ [RECURENTA] assignedDateStr invalid pentru parent ${parentTask.id}, nu se actualizează last_recurrence_generated_date`,
            );
          } else {
            await this.assignmentRepository.update(parentTask.id, {
              last_recurrence_generated_date: assignedDateOnly,
            });
            console.log(
              `✅ [RECURENTA] parent.last_recurrence_generated_date set pentru ${parentTask.id} -> ${assignedDateStr}`,
            );
          }
        }
      } catch (e) {
        console.warn(
          `⚠️ [RECURENTA] Nu s-a putut actualiza last_recurrence_generated_date pentru parent ${parentTask.id}:`,
          e,
        );
      }
    } catch (error) {
      console.error(
        `❌ [ScheduledTasksService] Eroare la crearea task-ului recurent pentru departamentul ${parentTask.assigned_to_id}:`,
        error,
      );
    }
  }

  /**
   * Creează un singur task recurent pentru o persoană
   */
  private async createSingleRecurringTask(
    parentTask: TaskAssignment,
    assignedAt: Date,
    recurrenceId: string,
  ): Promise<void> {
    const dueDate = this.computeDueDateForRecurring(parentTask, assignedAt);

    // IMPORTANT: Pentru task-urile recurente, nu folosim assigned_to_id din părinte
    // dacă părintele este un sablon recurent (nu are parent_recurrence_id)
    // În acest caz, task-ul recurent nu trebuie atribuit automat unei persoane
    // Dacă task-ul părinte este un sablon recurent (parent_recurrence_id este null),
    // atunci task-urile recurente nu trebuie să aibă assigned_to_id setat
    const isParentRecurrenceTemplate = !parentTask.parent_recurrence_id;
    const assignedToId = isParentRecurrenceTemplate
      ? undefined
      : parentTask.assigned_to_id;

    console.log(`🔍 [RECURENTA] Task părinte ${parentTask.id}:`, {
      isParentRecurrenceTemplate,
      parentAssignedToId: parentTask.assigned_to_id,
      finalAssignedToId: assignedToId,
      parentRecurrenceId: parentTask.parent_recurrence_id,
    });

    const createAssignmentDto: CreateAssignmentDto = {
      template_id: parentTask.template_id,
      location_id: parentTask.location_id,
      // assigned_to_type eliminat - toate task-urile sunt pentru persoane
      assigned_to_id: assignedToId, // undefined pentru sabloane recurente, parentTask.assigned_to_id pentru task-uri recurente create din task-uri recurente
      created_by_employee_id: parentTask.created_by_employee_id,
      status: AssignmentStatus.ASSIGNED,
      priority: parentTask.priority,
      assigned_at: assignedAt.toISOString(),
      due_date: dueDate.toISOString(),
      scheduled_datetime: assignedAt.toISOString(),
      notes: `Task recurent generat automat - ${parentTask.notes || 'Fără note'}`,
      requires_manager_check: parentTask.requires_manager_check,
      department_group_id: recurrenceId,
      assignment_mode: parentTask.assignment_mode,
      is_visible_for_employee: parentTask.is_visible_for_employee,
      permite_realocare: parentTask.permite_realocare ?? true,
      elements: this.prepareRecurringElements(parentTask),
    };

    const newTask = await this.assignmentService.create(createAssignmentDto);

    await this.assignmentRepository.update(newTask.id, {
      parent_recurrence_id: parentTask.id.toString(),
      recurrence_settings: undefined,
    });

    console.log(
      `✅ [RECURENTA] Task recurent creat pentru persoana ${parentTask.assigned_to_id}!`,
    );
    console.log(`✅ [RECURENTA] Task nou ID: ${newTask.id}`);
  }

  /**
   * Creează task-uri recurente pentru toate persoanele din grup
   */
  private async createRecurringTasksForGroup(
    parentTask: TaskAssignment,
    assignedAt: Date,
    recurrenceId: string,
    departmentIdOverride?: number,
  ): Promise<void> {
    try {
      // Extrage department ID sau location ID din department_group_id (sau folosește override pentru depts_4_9_)
      // Format un departament: dept_3_timestamp_random
      // Format mai multe: depts_4_9_timestamp_random (override trimis din createRecurringTasksForDepartment)
      // Format locație: loc_3_timestamp_random
      let departmentId: number | null = departmentIdOverride ?? null;
      let locationId: number | null = null;
      let isLocationBased = false;

      if (departmentIdOverride == null && parentTask.department_group_id) {
        const locMatch = parentTask.department_group_id.match(/^loc_(\d+)_/);
        if (locMatch) {
          locationId = parseInt(locMatch[1]);
          isLocationBased = true;
          console.log(
            `🔍 [RECURENTA] Location ID extras din group_id: ${locationId} (toți angajații pontați)`,
          );
        } else {
          const deptMatch =
            parentTask.department_group_id.match(/^dept_(\d+)_/);
          if (deptMatch) {
            departmentId = parseInt(deptMatch[1]);
            console.log(
              `🔍 [RECURENTA] Department ID extras din group_id: ${departmentId}`,
            );
          }
        }
      }

      // Fallback la assigned_to_id dacă nu se găsește în department_group_id
      if (!departmentId && !locationId && parentTask.assigned_to_id) {
        departmentId = parentTask.assigned_to_id;
      }

      // Fallback la location_id din task dacă avem doar locație
      if (isLocationBased && !locationId && parentTask.location_id) {
        locationId = parentTask.location_id;
      }

      let workingEmployees: any[] = [];

      if (isLocationBased && locationId) {
        // Obține toți angajații pontați la locația respectivă pentru data specificată
        console.log(
          `🔍 [RECURENTA] Obțin toți angajații pontați la locația ${locationId} pentru data ${assignedAt.toISOString().split('T')[0]}`,
        );
        workingEmployees = await this.getLocationEmployees(
          locationId,
          assignedAt,
        );
      } else if (departmentId) {
        // Obține angajații din departament pentru data respectivă (la postare); dacă nu există, nu creăm task – fără eroare
        console.log(
          `🔍 [RECURENTA] Obțin persoanele din departamentul ${departmentId} pentru data ${assignedAt.toISOString().split('T')[0]}`,
        );
        try {
          workingEmployees = await this.getDepartmentEmployees(
            departmentId,
            assignedAt,
          );
        } catch (err) {
          console.warn(
            `⚠️ [RECURENTA] Nu s-au putut obține angajații pentru departamentul ${departmentId}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }
      } else {
        console.error(
          `❌ [RECURENTA] Nu s-a putut extrage department ID sau location ID din task-ul ${parentTask.id}`,
        );
        return;
      }

      const departmentEmployees = workingEmployees;

      console.log(
        `🔍 [RECURENTA] Găsite ${departmentEmployees.length} persoane în departamentul ${departmentId}`,
      );

      if (departmentEmployees.length === 0) {
        console.log(
          `⚠️ [RECURENTA] Nu s-au găsit persoane în departamentul ${departmentId} – skip (fără eroare)`,
        );
        return;
      }

      const dueDate = this.computeDueDateForRecurring(parentTask, assignedAt);

      console.log(
        `🔍 [RECURENTA] Assignment mode: ${parentTask.assignment_mode}`,
      );

      // Logică diferită în funcție de assignment_mode
      if (parentTask.assignment_mode === 'first_come_first_served') {
        // Pentru FCFS: verifică dacă există un singur angajat
        if (departmentEmployees.length === 1) {
          // ✅ UN SINGUR ANGAJAT → Atribuire automată directă
          const singleEmployee = departmentEmployees[0];
          console.log(
            `🎯 [RECURENTA] FCFS cu UN SINGUR angajat → Atribuire automată pentru ${singleEmployee.first_name} ${singleEmployee.last_name} (ID: ${singleEmployee.id})`,
          );

          const createAssignmentDto: CreateAssignmentDto = {
            template_id: parentTask.template_id,
            location_id: parentTask.location_id,
            assigned_to_id: singleEmployee.id, // ✅ Atribuire directă
            created_by_employee_id: parentTask.created_by_employee_id,
            status: AssignmentStatus.ASSIGNED,
            priority: parentTask.priority,
            assigned_at: assignedAt.toISOString(),
            due_date: dueDate.toISOString(),
            scheduled_datetime: assignedAt.toISOString(),
            notes: `Task recurent atribuit automat (un singur angajat) - ${parentTask.notes || 'Fără note'}`,
            requires_manager_check: parentTask.requires_manager_check,
            department_group_id: recurrenceId,
            assignment_mode: AssignmentMode.INDIVIDUAL, // Schimbă în individual deoarece e atribuit direct
            is_visible_for_employee: parentTask.is_visible_for_employee,
            permite_realocare: parentTask.permite_realocare ?? true,
            elements: this.prepareRecurringElements(parentTask),
          };

          const newTask =
            await this.assignmentService.create(createAssignmentDto);

          await this.assignmentRepository.update(newTask.id, {
            parent_recurrence_id: parentTask.id.toString(),
            recurrence_settings: undefined,
          });

          console.log(
            `✅ [RECURENTA] Task atribuit automat cu ID: ${newTask.id} pentru ${singleEmployee.first_name} ${singleEmployee.last_name}`,
          );
        } else {
          // ❌ MULȚI ANGAJAȚI → Creează task FCFS normal (neatribuit)
          console.log(
            `🔍 [RECURENTA] FIRST_COME_FIRST_SERVED: Creez UN SINGUR task FCFS pentru grup (${departmentEmployees.length} angajați)`,
          );

          const createAssignmentDto: CreateAssignmentDto = {
            template_id: parentTask.template_id,
            location_id: parentTask.location_id,
            assigned_to_id: undefined, // undefined pentru FCFS - taskul nu e atribuit încă
            created_by_employee_id: parentTask.created_by_employee_id,
            status: AssignmentStatus.ASSIGNED,
            priority: parentTask.priority,
            assigned_at: assignedAt.toISOString(),
            due_date: dueDate.toISOString(),
            scheduled_datetime: assignedAt.toISOString(),
            notes: `Task FCFS generat automat - ${parentTask.notes || 'Fără note'}`,
            requires_manager_check: parentTask.requires_manager_check,
            department_group_id: recurrenceId,
            assignment_mode: parentTask.assignment_mode,
            is_visible_for_employee: parentTask.is_visible_for_employee,
            permite_realocare: parentTask.permite_realocare ?? true,
            elements: this.prepareRecurringElements(parentTask),
          };

          const newTask =
            await this.assignmentService.create(createAssignmentDto);

          await this.assignmentRepository.update(newTask.id, {
            parent_recurrence_id: parentTask.id.toString(),
            recurrence_settings: undefined,
          });

          console.log(
            `✅ [RECURENTA] Task FCFS creat cu ID: ${newTask.id} - vizibil pentru toți ${departmentEmployees.length} angajați din departament ${departmentId}`,
          );
        }
      } else {
        // Pentru EVERYONE_GETS_IT: creează task-uri individuale pentru fiecare angajat
        console.log(
          `🔍 [RECURENTA] EVERYONE_GETS_IT: Creez task pentru TOȚI angajații (${departmentEmployees.length})`,
        );

        for (const employee of departmentEmployees) {
          const createAssignmentDto: CreateAssignmentDto = {
            template_id: parentTask.template_id,
            location_id: parentTask.location_id,
            assigned_to_id: employee.id,
            created_by_employee_id: parentTask.created_by_employee_id,
            status: AssignmentStatus.ASSIGNED,
            priority: parentTask.priority,
            assigned_at: assignedAt.toISOString(),
            due_date: dueDate.toISOString(),
            scheduled_datetime: assignedAt.toISOString(),
            notes: `Task recurent generat automat - ${parentTask.notes || 'Fără note'}`,
            requires_manager_check: parentTask.requires_manager_check,
            department_group_id: recurrenceId,
            assignment_mode: parentTask.assignment_mode,
            is_visible_for_employee: parentTask.is_visible_for_employee,
            permite_realocare: parentTask.permite_realocare ?? true,
            elements: this.prepareRecurringElements(parentTask),
          };

          const newTask =
            await this.assignmentService.create(createAssignmentDto);

          await this.assignmentRepository.update(newTask.id, {
            parent_recurrence_id: parentTask.id.toString(),
            recurrence_settings: undefined,
          });

          console.log(
            `✅ [RECURENTA] Task recurent creat pentru angajatul ${employee.id} (${employee.first_name} ${employee.last_name})`,
          );
        }

        console.log(
          `✅ [RECURENTA] Creat ${departmentEmployees.length} task-uri recurente pentru grupul ${departmentId}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ [RECURENTA] Eroare la crearea task-urilor pentru grupul ${parentTask.assigned_to_id}:`,
        error,
      );
    }
  }

  /**
   * Obține persoanele din departament din microserviciul employees
   * Dacă targetDate este specificată, returnează doar angajații care lucrează în acea zi
   */
  private async getDepartmentEmployees(
    departmentId: number,
    targetDate?: Date,
  ): Promise<any[]> {
    try {
      console.log(
        `🔍 [RECURENTA] Obțin persoanele din departamentul ${departmentId}${targetDate ? ` pentru data ${targetDate.toISOString().split('T')[0]}` : ''} din microserviciul employees`,
      );

      // 1. Obține toți angajații activi din departament
      const employeesResponse = await firstValueFrom(
        this.httpService.get(
          `http://giurom.bitap.ro:3002/employees?department_id=${departmentId}&is_active=true`,
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

      const allEmployees =
        employeesResponse.data?.employees || employeesResponse.data || [];
      console.log(
        `🔍 [RECURENTA] Găsite ${allEmployees.length} persoane active în departamentul ${departmentId}`,
      );

      // 2. Dacă nu avem dată țintă, returnează toți angajații
      if (!targetDate) {
        // Log persoanele găsite pentru debugging
        allEmployees.forEach((emp: any) => {
          console.log(
            `🔍 [RECURENTA] - ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`,
          );
        });
        return allEmployees;
      }

      // 3. Verifică care angajați lucrează în ziua respectivă la ora țintă (folosind attendance-ms)
      const workingEmployees: any[] = [];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const targetDateTime = targetDate; // folosește Date complet (cu oră)

      try {
        // Obține toate shift-urile din attendance-ms (limit mare pentru a include toate intrările)
        console.log(
          `🔍 [RECURENTA] Obțin shift-urile pentru ${targetDateStr} de la attendance-ms`,
        );

        // Helper pentru apelul către attendance-ms (poate folosi token Bearer sau doar header secret)
        const makeAttendanceRequest = async (token?: string) => {
          const headers: Record<string, any> = {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret':
              process.env.SERVICE_SECRET || 'default-service-secret',
            'x-api-key': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          return await firstValueFrom(
            this.httpService.get(
              `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=3&limit=2000`,
              { headers },
            ),
          );
        };

        let shiftsResponse;
        try {
          // Prima încercare: fără token explicit (folosind doar x-service-secret)
          shiftsResponse = await makeAttendanceRequest();
        } catch (err: any) {
          const status = err?.response?.status || err?.status;
          console.warn(
            `⚠️ [RECURENTA] attendance-ms request failed (status=${status}), retrying with service token`,
          );
          try {
            // A doua încercare: generează token de serviciu și retrimite
            const serviceToken = this.generateServiceToken();
            shiftsResponse = await makeAttendanceRequest(serviceToken);
          } catch (err2: any) {
            // Propagăm eroarea mai sus pentru fallback-ul existent (care returnează toți angajații sau [] în caz de eroare)
            throw err2;
          }
        }

        // Extrage array-ul de shifts
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (
          shiftsResponse.data &&
          Array.isArray(shiftsResponse.data.data)
        ) {
          allShifts = shiftsResponse.data.data;
        }

        console.log(
          `🔍 [RECURENTA] Total shifts de la attendance: ${allShifts.length}`,
        );

        // Filtrează shift-urile care se potrivesc departamentului și acoperă ora țintă
        const relevantShifts = allShifts.filter((shift: any) => {
          if (!shift.start_datetime || !shift.end_datetime) return false;
          try {
            const shiftStart = new Date(shift.start_datetime);
            const shiftEnd = new Date(shift.end_datetime);
            // Verifică departament și dacă ora țintă este între start și end (inclusiv)
            return (
              shift.department_id === departmentId &&
              shiftStart.getTime() <= targetDateTime.getTime() &&
              shiftEnd.getTime() >= targetDateTime.getTime()
            );
          } catch (e) {
            return false;
          }
        });

        console.log(
          `🔍 [RECURENTA] Shifts relevante pentru departamentul ${departmentId} în ${targetDateStr} la ora ${targetDateTime.toTimeString().split(' ')[0]}: ${relevantShifts.length}`,
        );

        // Extrage employee_ids unici din shifts relevante
        const employeeIdsWorking = [
          ...new Set(relevantShifts.map((s: any) => s.employee_id)),
        ];
        console.log(
          `🔍 [RECURENTA] Employee IDs care lucrează la ora țintă:`,
          employeeIdsWorking,
        );

        // În loc să filtrăm prin allEmployees (care poate conține alte ID-uri),
        // solicităm detaliile angajaților direct din employees/batch pe baza ID-urilor din pontaj.
        if (employeeIdsWorking.length > 0) {
          try {
            const batchUrl = `http://giurom.bitap.ro:3002/employees/batch?ids=${encodeURIComponent(
              employeeIdsWorking.join(','),
            )}`;
            const batchRes = await firstValueFrom(
              this.httpService.get(batchUrl, {
                headers: {
                  'x-internal-service': 'veziv-tasks',
                  'x-service-secret':
                    process.env.SERVICE_SECRET || 'default-service-secret',
                  'x-api-key':
                    process.env.SERVICE_SECRET || 'default-service-secret',
                  'Content-Type': 'application/json',
                },
              }),
            );

            const batchEmployees =
              batchRes.data?.employees || batchRes.data || [];
            if (Array.isArray(batchEmployees) && batchEmployees.length > 0) {
              for (const emp of batchEmployees) {
                const id = Number(emp?.id);
                if (!Number.isFinite(id)) continue;
                workingEmployees.push(emp);
                console.log(
                  `✅ [RECURENTA] Angajat din pontaj găsit: ${emp.first_name} ${emp.last_name} (ID: ${id})`,
                );
              }
              console.log(
                `🔍 [RECURENTA] Găsite ${workingEmployees.length} angajați (din batch) care lucrează la ora țintă`,
              );
              return workingEmployees;
            } else {
              console.log(
                `⚠️ [RECURENTA] employees/batch a returnat 0 angajați pentru IDs: ${employeeIdsWorking.join(
                  ',',
                )} - folosesc fallback prin allEmployees`,
              );
            }
          } catch (err) {
            console.warn(
              `⚠️ [RECURENTA] batch employees request failed, fallback la filtrare locală:`,
              err?.message || err,
            );
          }
        }

        // Fallback: filtrează doar angajații care au shift la ora respectivă din allEmployees
        for (const employee of allEmployees) {
          if (employeeIdsWorking.includes(employee.id)) {
            workingEmployees.push(employee);
            console.log(
              `✅ [RECURENTA] (fallback) Angajatul ${employee.first_name} ${employee.last_name} (ID: ${employee.id}) lucrează în ${targetDateStr} la ora țintă`,
            );
          } else {
            console.log(
              `⏭️ [RECURENTA] (fallback) Angajatul ${employee.first_name} ${employee.last_name} (ID: ${employee.id}) NU lucrează în ${targetDateStr} la ora țintă`,
            );
          }
        }

        console.log(
          `🔍 [RECURENTA] Găsite ${workingEmployees.length} angajați care lucrează la ora țintă din ${allEmployees.length} total (fallback)`,
        );
        return workingEmployees;
      } catch (error) {
        console.error(
          `❌ [RECURENTA] Eroare la verificarea shift-urilor:`,
          error?.message || error,
        );
        // Dacă attendance-ms returnează eroare (ex. 401), nu mai facem fallback la "toți angajații"
        // Comportament intenționat: nu crea task-uri fără confirmarea pontajului
        console.log(
          `⚠️ [RECURENTA] attendance-ms a eșuat — nu se vor crea task-uri fără pontaj valid`,
        );
        return [];
      }
    } catch (error) {
      console.error(
        `❌ [RECURENTA] Eroare la obținerea persoanelor din departamentul ${departmentId}:`,
        error.message,
      );

      // Fallback la mock data în caz de eroare
      console.log(`⚠️ [RECURENTA] Folosesc mock data ca fallback`);
      return [
        { id: 2, first_name: 'Alexandru', last_name: 'Constantinescu' },
        { id: 3, first_name: 'John', last_name: 'Smith' },
      ];
    }
  }

  /**
   * Obține toți angajații pontați la o locație pentru o dată specificată
   * Similar cu getDepartmentEmployees, dar fără filtrare după departament
   */
  private async getLocationEmployees(
    locationId: number,
    targetDate?: Date,
  ): Promise<any[]> {
    try {
      console.log(
        `🔍 [RECURENTA] Obțin toți angajații pontați la locația ${locationId}${targetDate ? ` pentru data ${targetDate.toISOString().split('T')[0]}` : ''}`,
      );

      // Dacă nu avem dată țintă, nu putem filtra după pontaj
      if (!targetDate) {
        console.warn(
          `⚠️ [RECURENTA] Nu s-a specificat data țintă pentru getLocationEmployees`,
        );
        return [];
      }

      const targetDateStr = targetDate.toISOString().split('T')[0];
      const targetDateTime = targetDate;

      try {
        // Obține toate shift-urile din attendance-ms pentru locația respectivă
        console.log(
          `🔍 [RECURENTA] Obțin shift-urile pentru locația ${locationId} pe ${targetDateStr} de la attendance-ms`,
        );

        const makeAttendanceRequest = async (token?: string) => {
          const headers: Record<string, any> = {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret':
              process.env.SERVICE_SECRET || 'default-service-secret',
            'x-api-key': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          return await firstValueFrom(
            this.httpService.get(
              `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${locationId}&limit=2000`,
              { headers },
            ),
          );
        };

        let shiftsResponse;
        try {
          shiftsResponse = await makeAttendanceRequest();
        } catch (err: any) {
          const status = err?.response?.status || err?.status;
          console.warn(
            `⚠️ [RECURENTA] attendance-ms request failed (status=${status}), retrying with service token`,
          );
          try {
            const serviceToken = this.generateServiceToken();
            shiftsResponse = await makeAttendanceRequest(serviceToken);
          } catch (err2: any) {
            throw err2;
          }
        }

        // Extrage array-ul de shifts
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (
          shiftsResponse.data &&
          Array.isArray(shiftsResponse.data.data)
        ) {
          allShifts = shiftsResponse.data.data;
        }

        console.log(
          `🔍 [RECURENTA] Total shifts de la attendance pentru locația ${locationId}: ${allShifts.length}`,
        );

        // Filtrează shift-urile care acoperă ora țintă (fără filtrare după departament)
        const relevantShifts = allShifts.filter((shift: any) => {
          if (!shift.start_datetime || !shift.end_datetime) return false;
          try {
            const shiftStart = new Date(shift.start_datetime);
            const shiftEnd = new Date(shift.end_datetime);
            // Verifică doar dacă ora țintă este între start și end (inclusiv)
            return (
              shiftStart.getTime() <= targetDateTime.getTime() &&
              shiftEnd.getTime() >= targetDateTime.getTime()
            );
          } catch (e) {
            return false;
          }
        });

        console.log(
          `🔍 [RECURENTA] Shifts relevante pentru locația ${locationId} în ${targetDateStr} la ora ${targetDateTime.toTimeString().split(' ')[0]}: ${relevantShifts.length}`,
        );

        // Extrage employee_ids unici din shifts relevante
        const employeeIdsWorking = [
          ...new Set(relevantShifts.map((s: any) => s.employee_id)),
        ];
        console.log(
          `🔍 [RECURENTA] Employee IDs care lucrează la locația ${locationId} la ora țintă:`,
          employeeIdsWorking,
        );

        if (employeeIdsWorking.length === 0) {
          console.log(
            `⚠️ [RECURENTA] Niciun angajat nu lucrează la locația ${locationId} la ora țintă`,
          );
          return [];
        }

        // Obține detaliile angajaților din employees/batch
        try {
          const batchUrl = `http://giurom.bitap.ro:3002/employees/batch?ids=${encodeURIComponent(
            employeeIdsWorking.join(','),
          )}`;
          const batchRes = await firstValueFrom(
            this.httpService.get(batchUrl, {
              headers: {
                'x-internal-service': 'veziv-tasks',
                'x-service-secret':
                  process.env.SERVICE_SECRET || 'default-service-secret',
                'x-api-key':
                  process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json',
              },
            }),
          );

          const batchEmployees =
            batchRes.data?.employees || batchRes.data || [];
          if (Array.isArray(batchEmployees) && batchEmployees.length > 0) {
            const workingEmployees: any[] = [];
            for (const emp of batchEmployees) {
              const id = Number(emp?.id);
              if (!Number.isFinite(id)) continue;
              workingEmployees.push(emp);
              console.log(
                `✅ [RECURENTA] Angajat găsit la locația ${locationId}: ${emp.first_name} ${emp.last_name} (ID: ${id})`,
              );
            }
            console.log(
              `🔍 [RECURENTA] Găsiți ${workingEmployees.length} angajați pontați la locația ${locationId}`,
            );
            return workingEmployees;
          }
        } catch (err) {
          console.warn(
            `⚠️ [RECURENTA] batch employees request failed:`,
            err?.message || err,
          );
        }

        console.log(
          `⚠️ [RECURENTA] Nu s-au putut obține detaliile angajaților pentru locația ${locationId}`,
        );
        return [];
      } catch (error) {
        console.error(
          `❌ [RECURENTA] Eroare la verificarea shift-urilor pentru locația ${locationId}:`,
          error?.message || error,
        );
        return [];
      }
    } catch (error) {
      console.error(
        `❌ [RECURENTA] Eroare la getLocationEmployees pentru locația ${locationId}:`,
        error.message,
      );
      return [];
    }
  }

  private prepareRecurringElements(parentTask: TaskAssignment): any[] {
    if (!parentTask.elements) {
      return [];
    }

    return parentTask.elements.map((element) => {
      // Pentru elementele de recurență, nu copiază valoarea
      if (element.task_element?.element_type === 'recurrence') {
        return {
          task_element_id: element.task_element_id,
          value: '', // Nu copiază setările de recurență
          score: element.score,
        };
      }

      // Pentru celelalte elemente, copiază valorile
      return {
        task_element_id: element.task_element_id,
        value: element.value,
        score: element.score,
      };
    });
  }

  /**
   * Verifică și activează task-urile cu "Vizibil de la" pentru ziua curentă
   * Rulează automat din minut în minut
   */
  async checkVisibleFromTasks(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]; // Mâine
    console.log(
      `🔍 [ScheduledTasksService] Verificare task-uri cu "Vizibil de la" pentru ${today} și ${tomorrow}`,
    );

    try {
      // Găsește toate task-urile cu status ASSIGNED sau SCHEDULED care au elemente și nu sunt încă vizibile
      const assignments = await this.assignmentRepository.find({
        where: {
          status: In([AssignmentStatus.ASSIGNED, AssignmentStatus.SCHEDULED]),
          is_visible_for_employee: false,
        },
        relations: ['elements', 'elements.task_element', 'template'],
      });

      console.log(
        `🔍 [ScheduledTasksService] Găsite ${assignments.length} task-uri cu status ASSIGNED sau SCHEDULED`,
      );
      let activatedCount = 0;

      for (const assignment of assignments) {
        // Caută elementul visible_from
        const visibleFromElement = assignment.elements?.find(
          (element) => element.task_element?.element_type === 'visible_from',
        );

        console.log(
          `🔍 [ScheduledTasksService] Task ${assignment.id} - visibleFromElement:`,
          visibleFromElement,
        );

        if (visibleFromElement?.value) {
          let visibleFromDate: string | null = null;

          try {
            const visibleFromData = JSON.parse(visibleFromElement.value.trim());
            visibleFromDate = visibleFromData.date;
            console.log(
              `🔍 [ScheduledTasksService] Task ${assignment.id} - JSON parsed, date:`,
              visibleFromDate,
            );
          } catch (e) {
            // Dacă nu e JSON, folosește valoarea direct (cu trim pentru a elimina \r\n)
            visibleFromDate = visibleFromElement.value.trim();
            console.log(
              `🔍 [ScheduledTasksService] Task ${assignment.id} - direct value:`,
              visibleFromDate,
            );
          }

          if (visibleFromDate) {
            const visibleDateTime = new Date(visibleFromDate);
            const now = new Date();

            console.log(
              `🔍 [ScheduledTasksService] Task ${assignment.id} - now: ${now.toISOString()}, visibleFrom: ${visibleDateTime.toISOString()}, shouldBeVisible: ${now >= visibleDateTime}`,
            );

            if (now >= visibleDateTime) {
              console.log(
                `🔍 [ScheduledTasksService] Task ${assignment.id} devine vizibil (visible_from: ${visibleFromDate})`,
              );

              // Schimbă is_visible_for_employee din false în true
              await this.assignmentRepository.update(
                { id: assignment.id },
                { is_visible_for_employee: true },
              );

              // Emit WebSocket (invizibil -> vizibil) – asigură is_visible_for_employee: true în payload
              try {
                const updated = await this.assignmentService.findOne(
                  assignment.id,
                );
                if (updated) {
                  const payload = { ...updated, is_visible_for_employee: true };
                  this.taskGateway.notifyTaskUpdate(payload);
                }
              } catch (e) {
                // ignoră erori la emit
              }

              if (assignment.assigned_to_id) {
                try {
                  const taskNameEl = (assignment.elements as any[])?.find(
                    (el: any) => el.task_element?.element_type === 'task_name',
                  );
                  const displayName =
                    taskNameEl?.value?.trim() ||
                    assignment.template?.template_name ||
                    'Sarcină';
                  await this.assignmentService.sendTaskNotificationForEmployee(
                    'assignment.became_visible',
                    'Task activ',
                    `Task-ul "${displayName}" a trecut în sarcini active.`,
                    assignment.id,
                    assignment.assigned_to_id,
                  );
                  console.log(
                    `📤 [ScheduledTasksService] Notificare "Task activ" trimisă pentru task ${assignment.id}, assigned_to_id=${assignment.assigned_to_id}`,
                  );
                } catch (e: any) {
                  console.warn(
                    `[ScheduledTasksService] Eroare la trimitere notificare became_visible task ${assignment.id}:`,
                    e?.message || e,
                  );
                }
              }

              console.log(
                `✅ [ScheduledTasksService] Task ${assignment.id} este acum vizibil pentru angajați`,
              );
              activatedCount++;
            } else {
              console.log(
                `⏳ [ScheduledTasksService] Task ${assignment.id} încă nu este vizibil (visible_from: ${visibleFromDate})`,
              );
            }
          }
        }
      }

      if (activatedCount > 0) {
        console.log(
          `✅ [ScheduledTasksService] ${activatedCount} task-uri cu "Vizibil de la" devin vizibile astăzi`,
        );
        return true;
      } else {
        console.log(
          `ℹ️ [ScheduledTasksService] Nu sunt task-uri cu "Vizibil de la" care să devină vizibile astăzi`,
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ [ScheduledTasksService] Eroare la verificarea task-urilor cu "Vizibil de la":`,
        error,
      );
      return false;
    }
  }

  /**
   * Programează o sarcină (schimbă statusul în SCHEDULED)
   */
  async scheduleTask(
    assignmentId: number,
    scheduledDateTime: Date,
  ): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'elements', 'elements.task_element'],
    });

    if (!assignment) {
      throw new Error(`Assignment cu ID ${assignmentId} nu a fost găsit`);
    }

    assignment.status = AssignmentStatus.SCHEDULED;
    assignment.scheduled_datetime = scheduledDateTime;

    const saved = await this.assignmentRepository.save(assignment);
    if (saved.assigned_to_id) {
      const taskNameEl = (saved.elements as any[])?.find(
        (el: any) => el.task_element?.element_type === 'task_name',
      );
      const displayName =
        taskNameEl?.value?.trim() || saved.template?.template_name || 'Sarcină';
      const scheduledStr = new Date(saved.scheduled_datetime!).toLocaleString(
        'ro-RO',
        {
          timeZone: 'Europe/Bucharest',
          dateStyle: 'short',
          timeStyle: 'short',
        },
      );
      await this.assignmentService.sendTaskNotificationForEmployee(
        'assignment.scheduled',
        'Task programat',
        `Task-ul "${displayName}" a fost programat la ${scheduledStr}.`,
        saved.id,
        saved.assigned_to_id,
      );
    }
    return saved;
  }

  /**
   * Anulează programarea unei sarcini (schimbă statusul în ASSIGNED)
   */
  async unscheduleTask(assignmentId: number): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'elements', 'elements.task_element'],
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
  async checkAndUpdateScheduledTasks(): Promise<{
    activated: number;
    total: number;
  }> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const scheduledTasks = await this.assignmentRepository.find({
      where: {
        status: AssignmentStatus.SCHEDULED,
        scheduled_datetime: LessThanOrEqual(endOfDay),
      },
    });

    if (scheduledTasks.length > 0) {
      const updateResult = await this.assignmentRepository.update(
        {
          status: AssignmentStatus.SCHEDULED,
          scheduled_datetime: LessThanOrEqual(endOfDay),
        },
        {
          status: AssignmentStatus.ASSIGNED,
        },
      );

      return {
        activated: updateResult.affected || 0,
        total: scheduledTasks.length,
      };
    }

    return {
      activated: 0,
      total: 0,
    };
  }

  /**
   * Testează manual sistemul de recurență
   * Poate fi apelată pentru testare fără să aștepte cronjob-ul
   */
  async testRecurrenceSystem(): Promise<{
    processed: number;
    created: number;
    errors: number;
  }> {
    const today = new Date();
    return this.testRecurrenceSystemForDate(today);
  }

  /**
   * Testează manual sistemul de recurență pentru o dată specifică
   * Util pentru testarea cu diferite zile ale săptămânii
   */
  async testRecurrenceSystemForDate(
    testDate: Date,
  ): Promise<{ processed: number; created: number; errors: number }> {
    console.log(
      `🧪 [ScheduledTasksService] Testare manuală a sistemului de recurență pentru data: ${testDate.toISOString().split('T')[0]}`,
    );

    let processed = 0;
    let created = 0;
    let errors = 0;

    try {
      // Găsește toate sarcinile cu recurență activă
      const recurringTasks = await this.assignmentRepository.find({
        where: {
          recurrence_settings: Not(IsNull()),
        },
        relations: ['template', 'elements', 'elements.task_element'],
      });

      console.log(
        `🧪 [ScheduledTasksService] Găsite ${recurringTasks.length} sarcini cu recurență pentru testare`,
      );

      for (const task of recurringTasks) {
        processed++;
        try {
          console.log(
            `🧪 [ScheduledTasksService] Testez task-ul ${task.id} cu recurența:`,
            task.recurrence_settings,
          );

          // Verifică dacă trebuie să creeze task pentru data de test
          const shouldCreate = this.shouldCreateTasksForToday(
            task.recurrence_settings,
            testDate,
          );
          console.log(
            `🧪 [ScheduledTasksService] Should create for ${testDate.toISOString().split('T')[0]}: ${shouldCreate}`,
          );

          if (shouldCreate) {
            await this.processRecurringTask(task, testDate);
            created++;
            console.log(
              `✅ [ScheduledTasksService] Task recurent creat pentru data de test`,
            );
          } else {
            console.log(
              `⏭️ [ScheduledTasksService] Task-ul nu trebuie creat pentru data de test`,
            );
          }
        } catch (error) {
          errors++;
          console.error(
            `❌ [ScheduledTasksService] Eroare la procesarea task-ului ${task.id}:`,
            error,
          );
        }
      }

      console.log(
        `🧪 [ScheduledTasksService] Testare completă: ${processed} procesate, ${created} create, ${errors} erori`,
      );
    } catch (error) {
      console.error(
        `❌ [ScheduledTasksService] Eroare la testarea sistemului de recurență:`,
        error,
      );
    }

    return { processed, created, errors };
  }
}
