import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, IsNull, Between } from 'typeorm';
import { TaskAssignment, AssignmentStatus, Priority, AssignmentMode } from './entity/task-assignment.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ScheduledTasksService {
  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    private assignmentService: AssignmentService,
    private httpService: HttpService,
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
   * Rulează automat din minut în minut
   */
  async activateScheduledTasksForToday(): Promise<boolean> {
    const now = new Date();

    console.log(`🔍 [ScheduledTasksService] Verificare sarcinile programate pentru ${now.toISOString()}`);

    try {
      const scheduledTasks = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.SCHEDULED,
          scheduled_datetime: LessThanOrEqual(now)
        }
      });

      if (scheduledTasks.length > 0) {
        console.log(`🔍 [ScheduledTasksService] Găsite ${scheduledTasks.length} sarcini programate pentru activare`);

        // Activează sarcinile (schimbă statusul din SCHEDULED în ASSIGNED)
        const updateResult = await this.assignmentRepository.update(
          {
            status: AssignmentStatus.SCHEDULED,
            scheduled_datetime: LessThanOrEqual(now)
          },
          {
            status: AssignmentStatus.ASSIGNED
          }
        );

        console.log(`✅ [ScheduledTasksService] ${updateResult.affected || 0} sarcini au fost activate`);
        return (updateResult.affected || 0) > 0;
      } else {
        console.log(`ℹ️ [ScheduledTasksService] Nu sunt sarcini programate pentru activare acum`);
        return false;
      }
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la activarea sarcinilor programate:`, error);
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
      const recurringActivity = await this.processRecurringTasks(now, todayName);
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
  private async processRecurringTasks(today: Date, todayName: string): Promise<boolean> {
    console.log(`🔄 [RECURENTA] PROCESARE RECURENȚĂ - ${todayName}`);

      // Găsește toate sarcinile cu recurență activă
      const recurringTasks = await this.assignmentRepository.find({
        where: {
          recurrence_settings: Not(IsNull())
        },
        relations: ['template', 'elements', 'elements.task_element']
      });

    console.log(`🔍 [RECURENTA] Găsite ${recurringTasks.length} sarcini cu recurență activă`);

    let processedCount = 0;
    let createdCount = 0;

      for (const task of recurringTasks) {
      processedCount++;
      
      // Verifică dacă trebuie să creeze task-ul pentru ziua curentă
      const shouldCreate = this.shouldCreateTasksForToday(task.recurrence_settings, today);
      if (shouldCreate) {
        // Verifică dacă este ora corectă pentru a crea task-ul
        const shouldCreateNow = this.shouldCreateTasksForCurrentTime(task.recurrence_settings, today, todayName);
        if (shouldCreateNow) {
          console.log(`🔄 [RECURENTA] CREARE TASK RECURENT - ${todayName} - Task ID: ${task.id}`);
          
        await this.processRecurringTask(task, today);
          createdCount++;
        }
      }
    }
    
    console.log(`🔄 [RECURENTA] RECURENȚĂ COMPLETĂ - Task-uri procesate: ${processedCount}, create: ${createdCount}`);
    
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
          scheduled_datetime: Between(startTime, endTime)
        },
        relations: ['template']
      });

      if (activeTasks.length > 0) {
        const currentTime = now.toTimeString().split(' ')[0];
        console.log(`🔔 [SOCKET] Notific ${activeTasks.length} task-uri active la ${currentTime}`);
        
        // TODO: Implementează socket-ul aici
        // this.socketGateway.emit('tasksBecameActive', {
        //   time: currentTime,
        //   tasks: activeTasks,
        //   count: activeTasks.length
        // });
        
        console.log(`🔔 [SOCKET] Task-uri active:`, activeTasks.map(t => ({
          id: t.id,
          template: t.template?.template_name,
          scheduled: t.scheduled_datetime
        })));
      }
    } catch (error) {
      console.error(`❌ [SOCKET] Eroare la verificarea task-urilor active:`, error);
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
        return recurrenceSettings.months?.includes(month) && 
               recurrenceSettings.days?.includes(dayOfMonth);
      
      default:
        console.warn(`🔍 [ScheduledTasksService] Tip de recurență necunoscut: ${recurrenceSettings.frequency}`);
        return false;
    }
  }

  /**
   * Verifică dacă trebuie să creeze task-ul pentru ora curentă
   */
  private shouldCreateTasksForCurrentTime(recurrenceSettings: any, now: Date, todayName: string): boolean {
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
      
      // Verifică dacă ora curentă corespunde cu ora programată
      if (currentHour === hours && currentMinute === minutes) {
        console.log(`🕐 [RECURENTA] Ora corectă pentru ${todayName}: ${specificTime} (curent: ${currentTime})`);
        return true;
      }
    } else {
      // Fallback la 09:00 dacă nu există oră specifică
      if (currentHour === 9 && currentMinute === 0) {
        console.log(`🕐 [RECURENTA] Ora fallback pentru ${todayName}: 09:00 (curent: ${currentTime})`);
        return true;
      }
    }
    
    return false;
  }

  private async createRecurringTasksForDepartment(parentTask: TaskAssignment): Promise<void> {
    try {
      // Generează un ID unic pentru această recurență
      const recurrenceId = `recurrence_${parentTask.id}_${Date.now()}`;
      
      // Calculează datele pentru task-urile noi
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
      
      // LOG DETALIAT PENTRU ATRIBUIRILE RECURENTE
      const dateStr = today.toISOString().split('T')[0];
      const timeStr = assignedAt.toTimeString().split(' ')[0];
      
      console.log(`🔄 [RECURENTA] S-A ATRIBUIT SARCINA RECURENTĂ - Data: ${dateStr} (${todayName}), Ora: ${timeStr}, Task părinte ID: ${parentTask.id}`);
      
      // Toate task-urile sunt pentru persoane individuale
      // Logica de grup se face prin department_group_id
      if (parentTask.department_group_id) {
        console.log(`🔄 [RECURENTA] Grup: Departament cu ID ${parentTask.assigned_to_id} - Toate persoanele din grup vor primi sarcina`);
        
        // Pentru grupuri, obține toate persoanele din grup și creează task-uri individuale
        await this.createRecurringTasksForGroup(parentTask, assignedAt, recurrenceId);
      } else {
        console.log(`🔄 [RECURENTA] Responsabil: Persoană cu ID ${parentTask.assigned_to_id}`);
        
        // Pentru persoane individuale, creează un singur task
        await this.createSingleRecurringTask(parentTask, assignedAt, recurrenceId);
      }
      
      console.log(`🔄 [RECURENTA] Setări recurență:`, JSON.stringify(parentTask.recurrence_settings, null, 2));
      
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la crearea task-ului recurent pentru departamentul ${parentTask.assigned_to_id}:`, error);
    }
  }

  /**
   * Creează un singur task recurent pentru o persoană
   */
  private async createSingleRecurringTask(parentTask: TaskAssignment, assignedAt: Date, recurrenceId: string): Promise<void> {
    const dueDate = new Date(assignedAt);
      dueDate.setHours(18, 0, 0, 0); // 18:00 seara
      
      const createAssignmentDto: CreateAssignmentDto = {
        template_id: parentTask.template_id,
      // assigned_to_type eliminat - toate task-urile sunt pentru persoane
        assigned_to_id: parentTask.assigned_to_id,
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
        elements: this.prepareRecurringElements(parentTask)
      };
      
      const newTask = await this.assignmentService.create(createAssignmentDto);
    
    await this.assignmentRepository.update(newTask.id, {
      parent_recurrence_id: parentTask.id.toString(),
      recurrence_settings: undefined
    });
    
    console.log(`✅ [RECURENTA] Task recurent creat pentru persoana ${parentTask.assigned_to_id}!`);
    console.log(`✅ [RECURENTA] Task nou ID: ${newTask.id}`);
  }

  /**
   * Creează task-uri recurente pentru toate persoanele din grup
   */
  private async createRecurringTasksForGroup(parentTask: TaskAssignment, assignedAt: Date, recurrenceId: string): Promise<void> {
    try {
      // Obține toate persoanele din departamentul selectat
      const departmentId = parentTask.assigned_to_id;
      console.log(`🔍 [RECURENTA] Obțin persoanele din departamentul ${departmentId} pentru data ${assignedAt.toISOString().split('T')[0]}`);
      
      // Obține doar angajații care lucrează în ziua respectivă
      const departmentEmployees = await this.getDepartmentEmployees(departmentId, assignedAt);
      
      console.log(`🔍 [RECURENTA] Găsite ${departmentEmployees.length} persoane în departamentul ${departmentId}`);
      
      if (departmentEmployees.length === 0) {
        console.log(`⚠️ [RECURENTA] Nu s-au găsit persoane în departamentul ${departmentId}`);
        return;
      }
      
      // Pentru grupuri, se creează ÎNTOTDEAUNA task-uri pentru toți angajații
      // assignment_mode determină doar ce se întâmplă când cineva acceptă task-ul
      const employeesToAssign = departmentEmployees;
      
      console.log(`🔍 [RECURENTA] Pentru grupuri: Creez task pentru TOȚI angajații (${employeesToAssign.length})`);
      console.log(`🔍 [RECURENTA] Assignment mode: ${parentTask.assignment_mode}`);
      console.log(`🔍 [RECURENTA] - FIRST_COME_FIRST_SERVED: Primul care acceptă păstrează, ceilalți se șterg`);
      console.log(`🔍 [RECURENTA] - EVERYONE_GETS_IT: Toți păstrează task-ul individual`);
      
      // Creează task-uri pentru fiecare angajat selectat
      const dueDate = new Date(assignedAt);
      dueDate.setHours(18, 0, 0, 0);
      
      for (const employee of employeesToAssign) {
        const createAssignmentDto: CreateAssignmentDto = {
          template_id: parentTask.template_id,
          // assigned_to_type eliminat - toate task-urile sunt pentru persoane
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
          elements: this.prepareRecurringElements(parentTask)
        };
        
        const newTask = await this.assignmentService.create(createAssignmentDto);
        
      await this.assignmentRepository.update(newTask.id, {
        parent_recurrence_id: parentTask.id.toString(),
          recurrence_settings: undefined
        });
        
        console.log(`✅ [RECURENTA] Task recurent creat pentru angajatul ${employee.id} (${employee.first_name} ${employee.last_name})`);
        console.log(`✅ [RECURENTA] Task nou ID: ${newTask.id}`);
      }
      
      console.log(`✅ [RECURENTA] Creat ${employeesToAssign.length} task-uri recurente pentru grupul ${departmentId}`);
      
    } catch (error) {
      console.error(`❌ [RECURENTA] Eroare la crearea task-urilor pentru grupul ${parentTask.assigned_to_id}:`, error);
    }
  }

  /**
   * Obține persoanele din departament din microserviciul employees
   * Dacă targetDate este specificată, returnează doar angajații care lucrează în acea zi
   */
  private async getDepartmentEmployees(departmentId: number, targetDate?: Date): Promise<any[]> {
    try {
      console.log(`🔍 [RECURENTA] Obțin persoanele din departamentul ${departmentId}${targetDate ? ` pentru data ${targetDate.toISOString().split('T')[0]}` : ''} din microserviciul employees`);
      
      // 1. Obține toți angajații activi din departament
      const employeesResponse = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees?department_id=${departmentId}&is_active=true`)
      );
      
      const allEmployees = employeesResponse.data?.employees || employeesResponse.data || [];
      console.log(`🔍 [RECURENTA] Găsite ${allEmployees.length} persoane active în departamentul ${departmentId}`);
      
      // 2. Dacă nu avem dată țintă, returnează toți angajații
      if (!targetDate) {
        // Log persoanele găsite pentru debugging
        allEmployees.forEach((emp: any) => {
          console.log(`🔍 [RECURENTA] - ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`);
        });
        return allEmployees;
      }
      
      // 3. Verifică care angajați lucrează în ziua respectivă
      const workingEmployees: any[] = [];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      for (const employee of allEmployees) {
        try {
          // Verifică schimburile pentru angajatul respectiv în ziua țintă
          const shiftsResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3010/attendance/shifts?employee_id=${employee.id}&start_date=${targetDateStr}&end_date=${targetDateStr}`)
          );
          
          const shifts = shiftsResponse.data?.data || [];
          
          if (shifts.length > 0) {
            // Verifică dacă are prezență înregistrată pentru acea zi
            const presenceResponse = await firstValueFrom(
              this.httpService.get(`http://localhost:3010/attendance/presence?shift_id=${employee.id}&start_date=${targetDateStr}&end_date=${targetDateStr}`)
            );
            
            const presences = presenceResponse.data?.data || [];
            const hasPresence = presences.some((p: any) => 
              p.status === 'present_full' || p.status === 'present_partial'
            );
            
            if (hasPresence) {
              workingEmployees.push(employee);
              console.log(`✅ [RECURENTA] Angajatul ${employee.first_name} ${employee.last_name} lucrează în ${targetDateStr}`);
            } else {
              console.log(`⏭️ [RECURENTA] Angajatul ${employee.first_name} ${employee.last_name} nu are prezență înregistrată în ${targetDateStr}`);
            }
          } else {
            console.log(`⏭️ [RECURENTA] Angajatul ${employee.first_name} ${employee.last_name} nu are schimburi programate în ${targetDateStr}`);
          }
        } catch (error) {
          console.warn(`⚠️ [RECURENTA] Nu s-au putut verifica schimburile pentru angajatul ${employee.id}:`, error.message);
          // În caz de eroare, include angajatul (fallback)
          workingEmployees.push(employee as any);
        }
      }
      
      console.log(`🔍 [RECURENTA] Găsite ${workingEmployees.length} angajați care lucrează în ${targetDateStr} din ${allEmployees.length} total`);
      return workingEmployees;
      
    } catch (error) {
      console.error(`❌ [RECURENTA] Eroare la obținerea persoanelor din departamentul ${departmentId}:`, error.message);
      
      // Fallback la mock data în caz de eroare
      console.log(`⚠️ [RECURENTA] Folosesc mock data ca fallback`);
      return [
        { id: 2, first_name: 'Alexandru', last_name: 'Constantinescu' },
        { id: 3, first_name: 'John', last_name: 'Smith' }
      ];
    }
  }

  private prepareRecurringElements(parentTask: TaskAssignment): any[] {
    if (!parentTask.elements) {
      return [];
    }

    return parentTask.elements.map(element => {
      // Pentru elementele de recurență, nu copiază valoarea
      if (element.task_element?.element_type === 'recurrence') {
        return {
          task_element_id: element.task_element_id,
          value: '', // Nu copiază setările de recurență
          score: element.score
        };
      }
      
      // Pentru celelalte elemente, copiază valorile
      return {
        task_element_id: element.task_element_id,
        value: element.value,
        score: element.score
      };
    });
  }

  /**
   * Verifică și activează task-urile cu "Vizibil de la" pentru ziua curentă
   * Rulează automat din minut în minut
   */
  async checkVisibleFromTasks(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Mâine
    console.log(`🔍 [ScheduledTasksService] Verificare task-uri cu "Vizibil de la" pentru ${today} și ${tomorrow}`);

    try {
      // Găsește toate task-urile cu status ASSIGNED care au elemente și nu sunt încă vizibile
      const assignments = await this.assignmentRepository.find({
        where: {
          status: AssignmentStatus.ASSIGNED,
          is_visible_for_employee: false
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
            const visibleFromData = JSON.parse(visibleFromElement.value.trim());
            visibleFromDate = visibleFromData.date;
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - JSON parsed, date:`, visibleFromDate);
          } catch (e) {
            // Dacă nu e JSON, folosește valoarea direct (cu trim pentru a elimina \r\n)
            visibleFromDate = visibleFromElement.value.trim();
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - direct value:`, visibleFromDate);
          }

          if (visibleFromDate) {
            const visibleDateTime = new Date(visibleFromDate);
            const now = new Date();
            
            console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} - now: ${now.toISOString()}, visibleFrom: ${visibleDateTime.toISOString()}, shouldBeVisible: ${now >= visibleDateTime}`);
            
            if (now >= visibleDateTime) {
              console.log(`🔍 [ScheduledTasksService] Task ${assignment.id} devine vizibil (visible_from: ${visibleFromDate})`);
              
              // Schimbă is_visible_for_employee din false în true
              await this.assignmentRepository.update(
                { id: assignment.id },
                { is_visible_for_employee: true }
              );
              
              console.log(`✅ [ScheduledTasksService] Task ${assignment.id} este acum vizibil pentru angajați`);
              activatedCount++;
            } else {
              console.log(`⏳ [ScheduledTasksService] Task ${assignment.id} încă nu este vizibil (visible_from: ${visibleFromDate})`);
            }
          }
        }
      }

      if (activatedCount > 0) {
        console.log(`✅ [ScheduledTasksService] ${activatedCount} task-uri cu "Vizibil de la" devin vizibile astăzi`);
        return true;
      } else {
        console.log(`ℹ️ [ScheduledTasksService] Nu sunt task-uri cu "Vizibil de la" care să devină vizibile astăzi`);
        return false;
      }
    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la verificarea task-urilor cu "Vizibil de la":`, error);
      return false;
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

  /**
   * Testează manual sistemul de recurență
   * Poate fi apelată pentru testare fără să aștepte cronjob-ul
   */
  async testRecurrenceSystem(): Promise<{ processed: number; created: number; errors: number }> {
    const today = new Date();
    return this.testRecurrenceSystemForDate(today);
  }

  /**
   * Testează manual sistemul de recurență pentru o dată specifică
   * Util pentru testarea cu diferite zile ale săptămânii
   */
  async testRecurrenceSystemForDate(testDate: Date): Promise<{ processed: number; created: number; errors: number }> {
    console.log(`🧪 [ScheduledTasksService] Testare manuală a sistemului de recurență pentru data: ${testDate.toISOString().split('T')[0]}`);
    
    let processed = 0;
    let created = 0;
    let errors = 0;

    try {
      // Găsește toate sarcinile cu recurență activă
      const recurringTasks = await this.assignmentRepository.find({
        where: {
          recurrence_settings: Not(IsNull())
        },
        relations: ['template', 'elements', 'elements.task_element']
      });

      console.log(`🧪 [ScheduledTasksService] Găsite ${recurringTasks.length} sarcini cu recurență pentru testare`);

      for (const task of recurringTasks) {
        processed++;
        try {
          console.log(`🧪 [ScheduledTasksService] Testez task-ul ${task.id} cu recurența:`, task.recurrence_settings);
          
          // Verifică dacă trebuie să creeze task pentru data de test
          const shouldCreate = this.shouldCreateTasksForToday(task.recurrence_settings, testDate);
          console.log(`🧪 [ScheduledTasksService] Should create for ${testDate.toISOString().split('T')[0]}: ${shouldCreate}`);
          
          if (shouldCreate) {
            await this.processRecurringTask(task, testDate);
          created++;
            console.log(`✅ [ScheduledTasksService] Task recurent creat pentru data de test`);
          } else {
            console.log(`⏭️ [ScheduledTasksService] Task-ul nu trebuie creat pentru data de test`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ [ScheduledTasksService] Eroare la procesarea task-ului ${task.id}:`, error);
        }
      }

      console.log(`🧪 [ScheduledTasksService] Testare completă: ${processed} procesate, ${created} create, ${errors} erori`);

    } catch (error) {
      console.error(`❌ [ScheduledTasksService] Eroare la testarea sistemului de recurență:`, error);
    }

    return { processed, created, errors };
  }
}
