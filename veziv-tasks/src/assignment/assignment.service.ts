import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Raw } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  TaskAssignment,
  AssignmentStatus,
  AssignmentMode,
} from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { TaskTemplate } from '../template/entity/task-template.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ExecutionService } from '../execution/execution.service';
import { TaskGateway } from '../websocket/task.gateway';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);
  constructor(
    @InjectRepository(TaskAssignment)
    private assignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskAssignmentElement)
    private elementRepository: Repository<TaskAssignmentElement>,
    @InjectRepository(TaskTemplate)
    private templateRepository: Repository<TaskTemplate>,
    @InjectRepository(TaskElement)
    private taskElementRepository: Repository<TaskElement>,
    private httpService: HttpService,
    private executionService: ExecutionService,
    private taskGateway: TaskGateway,
    @Inject('NOTIFICATIONS_RMQ')
    private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendAssignmentNotification(
    type: string,
    title: string,
    description: string,
    assignmentId: number,
    metadata?: any,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit(
          { cmd: 'tasks.notification' },
          {
            type,
            title,
            description,
            entity_id: assignmentId,
            entity_type: 'task_assignment',
            metadata,
            priority: 'medium',
          },
        ),
      );
    } catch (error) {
      console.error('Failed to send assignment notification:', error);
    }
  }

  /**
   * Obține informațiile despre o persoană din microserviciul employees
   */
  private async getEmployeeInfo(
    employeeId: number,
  ): Promise<{ first_name: string; last_name: string } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `http://giurom.bitap.ro:3002/employees/${employeeId}`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret':
                process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      const employee = response.data;
      return {
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
      };
    } catch (error) {
      // Retry against possible internal port if gateway rejects with 401
      const status = error?.response?.status;
      if (status === 401) {
        try {
          const response = await firstValueFrom(
            this.httpService.get(
              `http://giurom.bitap.ro:3012/employees/${employeeId}`,
              {
                headers: {
                  'x-internal-service': 'veziv-tasks',
                  'x-service-secret':
                    process.env.SERVICE_SECRET || 'default-service-secret',
                  'Content-Type': 'application/json',
                },
              },
            ),
          );
          const employee = response.data;
          return {
            first_name: employee.first_name || '',
            last_name: employee.last_name || '',
          };
        } catch (e2) {
          console.warn(
            `⚠️ [AssignmentService] employees retry failed for ${employeeId}:`,
            e2?.message || e2,
          );
          return null;
        }
      }
      console.warn(
        `⚠️ [AssignmentService] getEmployeeInfo failed for ${employeeId}:`,
        error?.message || error,
      );
      return null;
    }
  }

  /**
   * Obține informațiile despre un departament din microserviciul locations
   */
  private async getDepartmentInfo(
    departmentId: number,
  ): Promise<{ name: string } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `http://giurom.bitap.ro:3002/locations/work-location-departments/${departmentId}`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret':
                process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      const department = response.data;
      return {
        name: department.name || '',
      };
    } catch (error) {
      console.error(
        `❌ [AssignmentService] Eroare la obținerea informațiilor despre departamentul ${departmentId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Adaugă informațiile despre persoana responsabilă și departamentul din grup
   * @deprecated Folosește enrichAssignmentsWithDetailsBatch pentru performanță mai bună
   */
  private async enrichAssignmentWithDetails(
    assignment: TaskAssignment,
  ): Promise<TaskAssignment> {
    const enrichedAssignment = { ...assignment };

    // Adaugă informații despre persoana responsabilă (toate task-urile sunt pentru persoane)
    if (assignment.assigned_to_id) {
      const employeeInfo = await this.getEmployeeInfo(
        assignment.assigned_to_id,
      );
      if (employeeInfo) {
        enrichedAssignment['assigned_to_info'] = employeeInfo;
      }
    }

    // Adaugă execuția cu răspunsurile dacă există
    try {
      const execution = await this.executionService.getExecutionByAssignment(
        assignment.id,
      );
      if (execution) {
        console.log(
          `[AssignmentService] Found execution ${execution.id} for assignment ${assignment.id} with ${execution.answers?.length || 0} answers`,
        );
        enrichedAssignment['execution'] = execution;
      } else {
        console.log(
          `[AssignmentService] No execution found for assignment ${assignment.id}`,
        );
      }
    } catch (error) {
      // Dacă nu există execuție, continuă fără eroare
      console.log(
        `[AssignmentService] Error fetching execution for assignment ${assignment.id}:`,
        error.message,
      );
    }

    // Logica pentru grupuri se face prin department_group_id, nu prin assigned_to_type

    return enrichedAssignment;
  }

  /**
   * OPTIMIZAT: Adaugă informațiile despre persoane și execuții pentru TOATE assignments dintr-o dată
   * Elimină problema N+1 prin batch loading
   */
  private async enrichAssignmentsWithDetailsBatch(
    assignments: TaskAssignment[],
  ): Promise<TaskAssignment[]> {
    if (!assignments || assignments.length === 0) {
      return assignments;
    }

    const startTime = Date.now();
    console.log(
      `🚀 [BATCH ENRICH] Starting batch enrichment for ${assignments.length} assignments`,
    );

    // 1. Colectează toți assigned_to_id unici
    const uniqueEmployeeIds = new Set<number>();
    assignments.forEach((assignment) => {
      if (assignment.assigned_to_id) {
        uniqueEmployeeIds.add(assignment.assigned_to_id);
      }
    });

    // 2. Batch load employees - OPTIMIZAT: un singur request batch către employees service (fără N+1)
    const employeeInfoMap = new Map<
      number,
      { first_name: string; last_name: string }
    >();
    if (uniqueEmployeeIds.size > 0) {
      try {
        const employeeIdsArray = Array.from(uniqueEmployeeIds);
        console.log(
          `📦 [BATCH ENRICH] Loading ${employeeIdsArray.length} employees via /employees/batch`,
        );

        const employeesServiceUrl = 'http://giurom.bitap.ro:3012'; // internal employees HTTP service
        const headers = {
          'x-internal-service': 'veziv-tasks',
          'x-service-secret':
            process.env.SERVICE_SECRET || 'default-service-secret',
          'Content-Type': 'application/json',
        };

        const idsParam = employeeIdsArray.join(',');
        const response = await firstValueFrom(
          this.httpService.get(`${employeesServiceUrl}/employees/batch`, {
            headers,
            params: { ids: idsParam },
          }),
        );

        const employees = Array.isArray(response.data) ? response.data : [];
        employees.forEach((employee: any) => {
          if (employee && typeof employee.id === 'number') {
            employeeInfoMap.set(employee.id, {
              first_name: employee.first_name || '',
              last_name: employee.last_name || '',
            });
          }
        });

        console.log(
          `✅ [BATCH ENRICH] Loaded ${employeeInfoMap.size} employees via batch`,
        );
      } catch (error) {
        console.error(
          `❌ [BATCH ENRICH] Error loading employees:`,
          error.message,
        );
      }
    }

    // 3. Colectează toate assignment.id-urile
    const assignmentIds = assignments.map((a) => a.id);

    // 4. Batch load executions - un singur query cu WHERE IN
    const executionsMap = new Map<number, any>();
    if (assignmentIds.length > 0) {
      try {
        console.log(
          `📦 [BATCH ENRICH] Loading executions for ${assignmentIds.length} assignments`,
        );
        const executions =
          await this.executionService.getExecutionsByAssignmentsBatch(
            assignmentIds,
          );

        // Grupează executions după task_assignment_id (luăm doar cea mai recentă pentru fiecare assignment)
        executions.forEach((execution) => {
          const assignmentId = execution.task_assignment_id;
          if (
            !executionsMap.has(assignmentId) ||
            new Date(execution.created_at) >
              new Date(executionsMap.get(assignmentId).created_at)
          ) {
            executionsMap.set(assignmentId, execution);
          }
        });

        console.log(
          `✅ [BATCH ENRICH] Loaded ${executionsMap.size} executions`,
        );
      } catch (error) {
        console.error(
          `❌ [BATCH ENRICH] Error loading executions:`,
          error.message,
        );
      }
    }

    // 5. Populează assignments cu datele încărcate
    const enrichedAssignments = assignments.map((assignment) => {
      const enriched = { ...assignment } as any;

      // Adaugă informații despre angajat
      if (
        assignment.assigned_to_id &&
        employeeInfoMap.has(assignment.assigned_to_id)
      ) {
        enriched['assigned_to_info'] = employeeInfoMap.get(
          assignment.assigned_to_id,
        );
      }

      // Adaugă execuția
      if (executionsMap.has(assignment.id)) {
        enriched['execution'] = executionsMap.get(assignment.id);
      }

      return enriched;
    });

    const duration = Date.now() - startTime;
    console.log(
      `✅ [BATCH ENRICH] Completed in ${duration}ms (${assignments.length} assignments)`,
    );

    if (duration > 500) {
      console.warn(
        `⚠️ [BATCH ENRICH] Performance warning: ${duration}ms > 500ms target`,
      );
    }

    return enrichedAssignments;
  }

  async create(
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<TaskAssignment> {
    // Validare obligatorie: location_id
    if (
      !createAssignmentDto.location_id ||
      isNaN(Number(createAssignmentDto.location_id))
    ) {
      throw new Error('location_id este obligatoriu și trebuie să fie numeric');
    }

    // Calculează due_date corect bazat pe scheduled_datetime + finalized_in + allow_postpone
    let finalDueDate = new Date(createAssignmentDto.due_date);

    if (createAssignmentDto.elements) {
      const template = await this.templateRepository.findOne({
        where: { id: createAssignmentDto.template_id },
        relations: ['elements'],
      });

      if (template) {
        // Găsește elementele necesare pentru calcul
        const scheduledDatetimeTemplateElement = template.elements.find(
          (te) => te.element_type === 'scheduled_datetime',
        );
        const finalizedInTemplateElement = template.elements.find(
          (te) => te.element_type === 'finalized_in',
        );
        const finishAtTemplateElement = template.elements.find(
          (te) => te.element_type === 'finish_at',
        );
        const allowPostponeTemplateElement = template.elements.find(
          (te) => te.element_type === 'allow_postpone',
        );
        const scheduledBetweenTemplateElement = template.elements.find(
          (te) => te.element_type === 'scheduled_between',
        );

        // PRIORITATE 0: Dacă există scheduled_between, procesează-l și skip restul
        let usedScheduledBetween = false;
        if (scheduledBetweenTemplateElement) {
          const scheduledBetweenElement = createAssignmentDto.elements.find(
            (el) => el.task_element_id === scheduledBetweenTemplateElement.id,
          );

          if (scheduledBetweenElement && scheduledBetweenElement.value) {
            try {
              const timeData = JSON.parse(scheduledBetweenElement.value);
              // timeData = { start_hour: 10, start_minute: 30, end_hour: 17, end_minute: 45 }
              const today = new Date();
              const year = today.getFullYear();
              const month = today.getMonth();
              const day = today.getDate();

              // Construiește scheduled_datetime (start) - NU folosește toISOString() pentru a evita conversia la UTC
              const startDate = new Date(
                year,
                month,
                day,
                timeData.start_hour || 0,
                timeData.start_minute || 0,
                0,
              );
              // Formatează manual data în format MySQL DATETIME fără conversie la UTC
              const formatDateTimeLocal = (date: Date) => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const h = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                const s = String(date.getSeconds()).padStart(2, '0');
                return `${y}-${m}-${d} ${h}:${min}:${s}`;
              };
              createAssignmentDto.scheduled_datetime =
                formatDateTimeLocal(startDate);

              // Construiește due_date (end)
              const endDate = new Date(
                year,
                month,
                day,
                timeData.end_hour || 23,
                timeData.end_minute || 59,
                59,
              );
              finalDueDate = endDate;
              usedScheduledBetween = true;
            } catch (e) {}
          }
        }

        // Dacă nu am folosit scheduled_between, continuă cu logica normală
        if (!usedScheduledBetween) {
          // Inițializare base date cu scheduled_datetime sau assigned_at
          let baseDate = createAssignmentDto.scheduled_datetime
            ? new Date(createAssignmentDto.scheduled_datetime)
            : new Date(createAssignmentDto.assigned_at);

          let usedFinishAt = false;

          // Prioritate 1: Dacă există finish_at, folosește direct acea dată
          if (finishAtTemplateElement) {
            const finishAtElement = createAssignmentDto.elements.find(
              (el) => el.task_element_id === finishAtTemplateElement.id,
            );

            if (finishAtElement && finishAtElement.value) {
              baseDate = new Date(finishAtElement.value);
              usedFinishAt = true;
            }
          }

          // Prioritate 2: Dacă nu există finish_at, folosește scheduled_datetime + finalized_in
          if (!usedFinishAt) {
            // Adaugă durata din finalized_in
            if (finalizedInTemplateElement) {
              const finalizedInElement = createAssignmentDto.elements.find(
                (el) => el.task_element_id === finalizedInTemplateElement.id,
              );

              if (finalizedInElement && finalizedInElement.value) {
                try {
                  const durationData = JSON.parse(finalizedInElement.value);
                  const hours = durationData.hours || 0;
                  const minutes = durationData.minutes || 0;

                  baseDate = new Date(
                    baseDate.getTime() +
                      hours * 60 * 60 * 1000 +
                      minutes * 60 * 1000,
                  );
                } catch (e) {}
              }
            }
          }

          // Adaugă perioada de amânare din allow_postpone (se aplică în ambele cazuri)
          if (allowPostponeTemplateElement) {
            const allowPostponeElement = createAssignmentDto.elements.find(
              (el) => el.task_element_id === allowPostponeTemplateElement.id,
            );

            if (allowPostponeElement && allowPostponeElement.value) {
              try {
                // Verifică dacă este JSON cu perioada de amânare
                if (allowPostponeElement.value.startsWith('{')) {
                  const postponeConfig = JSON.parse(allowPostponeElement.value);
                  if (
                    postponeConfig.enabled === true &&
                    postponeConfig.minutes > 0
                  ) {
                    baseDate = new Date(
                      baseDate.getTime() + postponeConfig.minutes * 60 * 1000,
                    );
                  }
                }
              } catch (e) {}
            }
          }

          finalDueDate = baseDate;
        } // Închide if-ul pentru !usedScheduledBetween
      }
    }

    // Determină statusul în funcție de scheduled_datetime (DUPĂ procesarea elementelor)
    let status = createAssignmentDto.status;

    // Dacă task-ul are recurență, nu se creează imediat - se creează doar task-urile recurente
    if (createAssignmentDto.recurrence_settings?.enabled) {
      status = 'scheduled' as any; // Task-ul părinte rămâne scheduled
    } else if (createAssignmentDto.scheduled_datetime) {
      const scheduledDate = new Date(createAssignmentDto.scheduled_datetime);
      const now = new Date();

      // Dacă data și ora programată este în viitor, setează statusul ca SCHEDULED
      if (scheduledDate > now) {
        status = 'scheduled' as any;
      }
    }

    // Verifică dacă task-ul are visible_from în viitor
    let shouldBeVisible =
      createAssignmentDto.is_visible_for_employee !== undefined
        ? createAssignmentDto.is_visible_for_employee
        : true;
    let requiresManagerCheck =
      createAssignmentDto.requires_manager_check || false;

    if (createAssignmentDto.elements) {
      // Găsește template-ul pentru a verifica tipurile elementelor
      const template = await this.templateRepository.findOne({
        where: { id: createAssignmentDto.template_id },
        relations: ['elements'],
      });

      if (template) {
        // Găsește elementul visible_from din template
        const visibleFromTemplateElement = template.elements.find(
          (te) => te.element_type === 'visible_from',
        );
        const scheduledDatetimeTemplateElement = template.elements.find(
          (te) => te.element_type === 'scheduled_datetime',
        );
        const requiresManagerCheckTemplateElement = template.elements.find(
          (te) => te.element_type === 'requires_manager_check',
        );

        // Verifică dacă există elementul requires_manager_check și setează valoarea
        if (requiresManagerCheckTemplateElement) {
          const requiresManagerCheckElement = createAssignmentDto.elements.find(
            (el) =>
              el.task_element_id === requiresManagerCheckTemplateElement.id,
          );

          if (
            requiresManagerCheckElement &&
            requiresManagerCheckElement.value
          ) {
            requiresManagerCheck =
              requiresManagerCheckElement.value === 'true' ||
              requiresManagerCheckElement.value === 'True' ||
              requiresManagerCheckElement.value === '1';
          }
        }

        if (visibleFromTemplateElement) {
          // Găsește elementul corespunzător din assignment
          const visibleFromElement = createAssignmentDto.elements.find(
            (el) => el.task_element_id === visibleFromTemplateElement.id,
          );

          if (visibleFromElement && visibleFromElement.value) {
            // Verifică dacă visible_from este în viitor
            const visibleFromDate = new Date(visibleFromElement.value.trim());
            const now = new Date();

            if (visibleFromDate > now) {
              shouldBeVisible = false;
            } else {
            }
          }
        }

        // Verifică dacă există și scheduled_datetime și visible_from
        if (visibleFromTemplateElement && scheduledDatetimeTemplateElement) {
          const visibleFromElement = createAssignmentDto.elements.find(
            (el) => el.task_element_id === visibleFromTemplateElement.id,
          );
          const scheduledDatetimeElement = createAssignmentDto.elements.find(
            (el) => el.task_element_id === scheduledDatetimeTemplateElement.id,
          );

          if (visibleFromElement?.value && scheduledDatetimeElement?.value) {
            const visibleFromDate = new Date(visibleFromElement.value.trim());
            const scheduledDate = new Date(
              scheduledDatetimeElement.value.trim(),
            );

            // Verifică dacă visible_from este mai mare decât scheduled_datetime
            if (visibleFromDate > scheduledDate) {
              // Formatează datele într-un mod mai frumos
              const formatDateTime = (dateString: string) => {
                const date = new Date(dateString);
                return date.toLocaleString('ro-RO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              };

              const formattedVisibleFrom = formatDateTime(
                visibleFromElement.value.trim(),
              );
              const formattedScheduled = formatDateTime(
                scheduledDatetimeElement.value.trim(),
              );

              throw new Error(
                `❌ EROARE: "Vizibil de la" (${formattedVisibleFrom}) nu poate fi mai mare decât "Programat la" (${formattedScheduled}). Task-ul trebuie să devină vizibil înainte sau la aceeași oră cu programarea.`,
              );
            }
          }
        }
      }
    }

    // Creează assignment-ul
    const assignment = this.assignmentRepository.create({
      template_id: createAssignmentDto.template_id,
      // assigned_to_type eliminat - toate task-urile sunt pentru persoane
      assigned_to_id: createAssignmentDto.assigned_to_id,
      created_by_employee_id: createAssignmentDto.created_by_employee_id,
      location_id: Number(createAssignmentDto.location_id),
      status: status,
      priority: createAssignmentDto.priority,
      assigned_at: new Date(createAssignmentDto.assigned_at),
      due_date: finalDueDate, // Folosește due_date-ul ajustat cu perioada de amânare
      scheduled_datetime: createAssignmentDto.recurrence_settings?.enabled
        ? null
        : createAssignmentDto.scheduled_datetime
          ? new Date(createAssignmentDto.scheduled_datetime)
          : null,
      notes: createAssignmentDto.notes,
      requires_manager_check: requiresManagerCheck,
      department_group_id: createAssignmentDto.department_group_id,
      assignment_mode:
        createAssignmentDto.assignment_mode || AssignmentMode.INDIVIDUAL,
      is_visible_for_employee: shouldBeVisible,
      recurrence_settings: createAssignmentDto.recurrence_settings,
    });

    const savedAssignment = await this.assignmentRepository.save(assignment);

    // Verifică din nou din baza de date
    const dbAssignment = await this.assignmentRepository.findOne({
      where: { id: savedAssignment.id },
    });

    // Încarcă template-ul pentru a obține toate elementele
    let template = await this.templateRepository.findOne({
      where: { id: createAssignmentDto.template_id },
      relations: ['elements'],
    });

    if (!template) {
      throw new NotFoundException(
        `Template cu ID-ul ${createAssignmentDto.template_id} nu a fost găsit`,
      );
    }

    // Actualizează opțiunile pentru checkbox, radio și select și scoring_options pentru scoring_boolean
    // în TaskElement dacă sunt furnizate la creare atribuiri
    if (createAssignmentDto.elements) {
      for (const customElement of createAssignmentDto.elements) {
        const templateElement = template.elements.find(
          (el) => el.id === customElement.task_element_id,
        );
        if (!templateElement) continue;

        // Actualizează opțiunile pentru checkbox/radio/select dacă sunt furnizate
        if (
          customElement.options &&
          Array.isArray(customElement.options) &&
          customElement.options.length > 0
        ) {
          if (
            templateElement.element_type === 'checkbox' ||
            templateElement.element_type === 'radio' ||
            templateElement.element_type === 'select'
          ) {
            try {
              await this.taskElementRepository.update(
                { id: templateElement.id },
                { options: customElement.options },
              );
            } catch (e) {
              this.logger.warn(
                `Failed to update options for template element ${templateElement.id}: ${e}`,
              );
            }
          }
        }

        // Persistă scoring_options pentru scoring_boolean, indiferent dacă există 'options'
        if (
          templateElement.element_type === 'scoring_boolean' &&
          customElement.scoring_options &&
          Array.isArray(customElement.scoring_options) &&
          customElement.scoring_options.length > 0
        ) {
          try {
            await this.taskElementRepository.update(
              { id: templateElement.id },
              {
                scoring_options: JSON.stringify(customElement.scoring_options),
              },
            );
          } catch (e) {
            this.logger.warn(
              `Failed to update scoring_options for template element ${templateElement.id}: ${e}`,
            );
          }
        }
        // Persistă simple_score_points pentru scoring_simple dacă sunt furnizate la atribuirea task-ului
        if (
          templateElement.element_type === 'scoring_simple' &&
          typeof customElement.simple_score_points === 'number'
        ) {
          try {
            await this.taskElementRepository.update(
              { id: templateElement.id },
              { simple_score_points: customElement.simple_score_points },
            );
          } catch (e) {
            this.logger.warn(
              `Failed to update simple_score_points for template element ${templateElement.id}: ${e}`,
            );
          }
        }
      }

      // Reîncarcă template-ul pentru a avea opțiunile actualizate
      template = await this.templateRepository.findOne({
        where: { id: createAssignmentDto.template_id },
        relations: ['elements'],
      });
      if (!template) {
        throw new NotFoundException(
          `Template cu ID-ul ${createAssignmentDto.template_id} nu a fost găsit`,
        );
      }
    }

    // Creează elementele din template (exclude SCHEDULED_DATETIME - acestea sunt doar pentru programare)
    const elementsToCreate: TaskAssignmentElement[] = [];

    for (const templateElement of template.elements) {
      // Exclude elementele de tip SCHEDULED_DATETIME din assignment
      if (templateElement.element_type === 'scheduled_datetime') {
        continue;
      }

      // Verifică dacă există o valoare personalizată în request
      const customElement = createAssignmentDto.elements?.find(
        (el) => el.task_element_id === templateElement.id,
      );

      const elementData = {
        task_assignment_id: savedAssignment.id,
        task_element_id: templateElement.id,
        value:
          customElement?.value ||
          (templateElement.element_type === 'scoring_boolean' ||
          templateElement.element_type === 'photo'
            ? '[]'
            : ''),
        score: customElement?.score || 0,
        is_visible_for_employee:
          customElement?.is_visible_for_employee !== undefined
            ? customElement.is_visible_for_employee
            : templateElement.is_visible_for_employee,
      };

      elementsToCreate.push(this.elementRepository.create(elementData));
    }

    if (elementsToCreate.length > 0) {
      await this.elementRepository.save(elementsToCreate);
    }

    // Returnează assignment-ul cu toate elementele
    const finalAssignment = await this.findOne(savedAssignment.id);

    // Emite notificare WebSocket pentru task nou
    this.taskGateway.notifyNewTask(finalAssignment);

    // Trimite notificare RabbitMQ pentru creare assignment
    await this.sendAssignmentNotification(
      'assignment.created',
      'Task creat',
      `Task-ul "${finalAssignment.template?.template_name || 'Nou'}" a fost creat`,
      finalAssignment.id,
      {
        templateId: finalAssignment.template_id,
        assignedToId: finalAssignment.assigned_to_id,
      },
    );

    return finalAssignment;
  }

  /**
   * Creează mai multe assignments într-o singură tranzacție (batch)
   * Optimizează crearea de assignments pentru mai multe persoane
   */
  async createBatch(
    createAssignmentDtos: CreateAssignmentDto[],
  ): Promise<TaskAssignment[]> {
    if (!createAssignmentDtos || createAssignmentDtos.length === 0) {
      return [];
    }

    console.log(
      `📦 [ASSIGNMENT SERVICE] Creating ${createAssignmentDtos.length} assignments in batch`,
    );

    // Creează toate assignment-urile secvențial pentru a evita probleme de concurență
    // (nu folosim tranzacție pentru că create() are deja logica sa complexă)
    const createdAssignments: TaskAssignment[] = [];

    for (const createAssignmentDto of createAssignmentDtos) {
      try {
        const assignment = await this.create(createAssignmentDto);
        createdAssignments.push(assignment);
      } catch (error) {
        console.error(
          `❌ [ASSIGNMENT SERVICE] Error creating assignment in batch:`,
          error,
        );
        // Continuă cu următoarele chiar dacă unul eșuează
        // (sau poți arunca eroarea dacă vrei să anulezi toate)
        throw error;
      }
    }

    console.log(
      `✅ [ASSIGNMENT SERVICE] Successfully created ${createdAssignments.length} assignments in batch`,
    );
    return createdAssignments;
  }

  async findAll(): Promise<TaskAssignment[]> {
    return this.assignmentRepository.find({
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findOne(id: number): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: [
        'template',
        'template.elements',
        'elements',
        'elements.task_element',
      ],
      select: [
        'id',
        'template_id',
        'assigned_to_id',
        'created_by_employee_id',
        'status',
        'priority',
        'assigned_at',
        'due_date',
        'completed_at',
        'scheduled_datetime',
        'notes',
        'requires_manager_check',
        'rejecting_times',
        'department_group_id',
        'assignment_mode',
        'is_visible_for_employee',
        'was_postponed',
        'created_at',
        'updated_at',
      ],
      order: {
        template: {
          elements: {
            sort_order: 'ASC',
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment cu ID ${id} nu a fost găsit`);
    }

    // Adaugă informații despre persoana responsabilă și departamentul din grup
    // Pentru un singur assignment, folosim metoda batch (mai eficientă decât metoda veche)
    const enrichedAssignments = await this.enrichAssignmentsWithDetailsBatch([
      assignment,
    ]);
    return enrichedAssignments[0];
  }

  async update(
    id: number,
    updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<TaskAssignment> {
    const assignment = await this.findOne(id);

    // Actualizează câmpurile de bază ale assignment-ului
    const updateData: any = {};

    if (updateAssignmentDto.template_id !== undefined)
      updateData.template_id = updateAssignmentDto.template_id;
    // assigned_to_type eliminat - toate task-urile sunt pentru persoane
    if (updateAssignmentDto.assigned_to_id !== undefined)
      updateData.assigned_to_id = updateAssignmentDto.assigned_to_id;
    if (updateAssignmentDto.status !== undefined)
      updateData.status = updateAssignmentDto.status;
    if (updateAssignmentDto.priority !== undefined)
      updateData.priority = updateAssignmentDto.priority;
    if (updateAssignmentDto.assigned_at !== undefined)
      updateData.assigned_at = new Date(updateAssignmentDto.assigned_at);
    if (updateAssignmentDto.due_date !== undefined)
      updateData.due_date = new Date(updateAssignmentDto.due_date);
    if (updateAssignmentDto.scheduled_datetime !== undefined) {
      const scheduledDateTime = updateAssignmentDto.scheduled_datetime
        ? new Date(updateAssignmentDto.scheduled_datetime)
        : null;
      updateData.scheduled_datetime = scheduledDateTime;

      // Actualizează statusul în funcție de scheduled_datetime
      if (scheduledDateTime) {
        const scheduledDate = new Date(scheduledDateTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        scheduledDate.setHours(0, 0, 0, 0);

        // Dacă data programată este în viitor, setează statusul ca SCHEDULED
        if (scheduledDate > today) {
          updateData.status = 'scheduled' as any;
        } else {
          // Dacă data programată este astăzi sau în trecut, setează statusul ca ASSIGNED
          updateData.status = 'assigned' as any;
        }
      } else {
        // Dacă nu mai există scheduled_datetime, setează statusul ca ASSIGNED
        updateData.status = 'assigned' as any;
      }
    }
    if (updateAssignmentDto.completed_at !== undefined)
      updateData.completed_at = new Date(updateAssignmentDto.completed_at);
    if (updateAssignmentDto.notes !== undefined)
      updateData.notes = updateAssignmentDto.notes;
    if (updateAssignmentDto.requires_manager_check !== undefined)
      updateData.requires_manager_check =
        updateAssignmentDto.requires_manager_check;
    if (updateAssignmentDto.recurrence_settings !== undefined)
      updateData.recurrence_settings = updateAssignmentDto.recurrence_settings;

    if (Object.keys(updateData).length > 0) {
      await this.assignmentRepository.update(id, updateData);
    }

    // Actualizează elementele dacă sunt specificate
    if (updateAssignmentDto.elements !== undefined) {
      // Șterge toate elementele existente
      await this.elementRepository.delete({ task_assignment_id: id });

      // Creează elementele noi
      if (updateAssignmentDto.elements.length > 0) {
        const elements = updateAssignmentDto.elements.map((elementDto) =>
          this.elementRepository.create({
            ...elementDto,
            task_assignment_id: id,
          }),
        );

        await this.elementRepository.save(elements);
      }
    }

    // Returnează assignment-ul actualizat
    const updatedAssignment = await this.findOne(id);

    // Emite notificare WebSocket pentru actualizare task
    this.taskGateway.notifyTaskUpdate(updatedAssignment);

    // Trimite notificare RabbitMQ pentru actualizare assignment
    await this.sendAssignmentNotification(
      'assignment.updated',
      'Task actualizat',
      `Task-ul "${updatedAssignment.template?.template_name || 'Nou'}" a fost actualizat`,
      updatedAssignment.id,
      {
        status: updatedAssignment.status,
        templateId: updatedAssignment.template_id,
      },
    );

    return updatedAssignment;
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.findOne(id);

    // Dacă este un task părinte cu recurență, șterge și task-urile copil
    if (assignment.recurrence_settings?.enabled) {
      const childTasks = await this.assignmentRepository.find({
        where: {
          parent_recurrence_id: id.toString(),
        },
      });

      // Șterge task-urile copil
      for (const childTask of childTasks) {
        await this.elementRepository.delete({
          task_assignment_id: childTask.id,
        });
        await this.assignmentRepository.remove(childTask);
      }
    }

    // Șterge elementele task-ului părinte
    await this.elementRepository.delete({ task_assignment_id: id });

    // Șterge task-ul părinte
    const assignmentId = assignment.id;
    const templateName = assignment.template?.template_name || 'Necunoscut';

    await this.assignmentRepository.remove(assignment);

    // Trimite notificare RabbitMQ pentru ștergere assignment
    await this.sendAssignmentNotification(
      'assignment.deleted',
      'Task șters',
      `Task-ul "${templateName}" a fost șters`,
      assignmentId,
      { templateName },
    );
  }

  // ===== METODA CU PERMISIUNI PENTRU GET ASSIGNMENTS =====

  async findAllWithPermissions(
    user: any,
    locationId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TaskAssignment[]> {
    console.log('🔍 [assignment.service] findAllWithPermissions params:', {
      userId: user?.sub,
      perms: user?.permissions,
      locationId,
      startDate: startDate?.toISOString?.(),
      endDate: endDate?.toISOString?.(),
    });

    // OPTIMIZAT: Folosește select explicit și indexuri pentru performanță maximă
    const query = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.template', 'template')
      .leftJoinAndSelect('assignment.elements', 'elements')
      .leftJoinAndSelect('elements.task_element', 'task_element')
      .addSelect([
        'assignment.id',
        'assignment.template_id',
        // assigned_to_type eliminat
        'assignment.assigned_to_id',
        'assignment.created_by_employee_id',
        'assignment.status',
        'assignment.priority',
        'assignment.assigned_at',
        'assignment.due_date',
        'assignment.completed_at',
        'assignment.scheduled_datetime',
        'assignment.notes',
        'assignment.requires_manager_check',
        'assignment.rejecting_times',
        'assignment.department_group_id',
        'assignment.assignment_mode',
        'assignment.is_visible_for_employee',
        'assignment.was_postponed',
        'assignment.created_at',
        'assignment.updated_at',
      ])
      .orderBy('assignment.created_at', 'DESC')
      .cache(false); // Dezactivează cache pentru date fresh

    // Aplică filtrul după location_id dacă este furnizat
    if (locationId !== undefined) {
      query.andWhere('assignment.location_id = :locationId', { locationId });
    }

    // Filtrare OBLIGATORIE - afișează DOAR task-urile cu location_id setat
    query.andWhere('assignment.location_id IS NOT NULL');

    // assignment.read_all - vede toate - CEA MAI PERMISIVĂ - VERIFICĂ PRIMUL!
    if (user?.permissions?.includes('assignment.read_all')) {
      // Dacă are și assignment.create (este manager), poate vedea sarcinile invizibile
      if (user?.permissions?.includes('assignment.create')) {
        // Manager: dacă nu se trimit date, limitează la ultimele 30 de zile pentru performanță
        if (startDate && endDate) {
          // Formatează datele ca string-uri YYYY-MM-DD pentru comparație corectă
          const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          console.log('📅 [assignment.service] Date filter:', {
            startDate: sdStr,
            endDate: edStr,
            startDateObj: startDate.toISOString(),
            endDateObj: endDate.toISOString(),
          });
          // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
          // IMPORTANT: NU include sarcinile recurente părinte (sabloane) în filtrarea după date - acestea vor fi afișate separat în secțiunea "Sarcini cu Recurență"
          query.andWhere(
            `(assignment.scheduled_datetime IS NOT NULL AND DATE(assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (assignment.scheduled_datetime IS NULL AND DATE(assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
            { sdStr, edStr },
          );
        } else {
          // Limită implicită: ultimele 30 de zile pentru performanță
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          const sdStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
          const edStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          console.log(
            '📅 [assignment.service] No date filter provided, using default: last 30 days',
            {
              startDate: sdStr,
              endDate: edStr,
            },
          );
          // IMPORTANT: NU include sarcinile recurente părinte (sabloane) în filtrarea după date - acestea vor fi afișate separat în secțiunea "Sarcini cu Recurență"
          query.andWhere(
            `(assignment.scheduled_datetime IS NOT NULL AND DATE(assignment.scheduled_datetime) >= :sdStr) OR (assignment.scheduled_datetime IS NULL AND DATE(assignment.assigned_at) >= :sdStr)`,
            { sdStr },
          );
        }
        const result = await query
          .andWhere(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
            {
              assignedStatus: 'assigned',
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled',
            },
          )
          .getMany();
        console.log(
          '🔍 [assignment.service] read_all+create result count:',
          result.length,
        );

        // Debug pentru sarcinile recurente părinte
        const parentRecurring = result.filter((r) => {
          try {
            const recurrenceSettings = r.recurrence_settings;
            const enabled =
              recurrenceSettings && typeof recurrenceSettings === 'object'
                ? recurrenceSettings.enabled
                : false;
            const isParent =
              !r.parent_recurrence_id || r.parent_recurrence_id === null;
            return enabled === true && isParent;
          } catch (e) {
            return false;
          }
        });
        console.log(
          `🔄 [assignment.service] Sarcini recurente părinte găsite: ${parentRecurring.length}`,
        );
        if (parentRecurring.length > 0) {
          parentRecurring.forEach((r) => {
            console.log(
              `🔄 [assignment.service] Parent recurring task ID: ${r.id}, status: ${r.status}, recurrence_settings:`,
              JSON.stringify(r.recurrence_settings),
            );
          });
        }
        if (startDate && endDate && result.length > 0) {
          console.log(
            '📅 [assignment.service] Sample dates from results:',
            result.slice(0, 3).map((r) => ({
              id: r.id,
              assigned_at: r.assigned_at,
              scheduled_datetime: r.scheduled_datetime,
              status: r.status,
            })),
          );
        }
        // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
        const enrichedResults =
          await this.enrichAssignmentsWithDetailsBatch(result);
        return enrichedResults;
      } else {
        // Dacă nu este manager, filtrează doar sarcinile vizibile
        // Fără filtru implicit pe zi – aplică interval doar dacă e trimis
        if (startDate && endDate) {
          // Formatează datele ca string-uri YYYY-MM-DD pentru comparație corectă
          const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          console.log('📅 [assignment.service] Date filter:', {
            startDate: sdStr,
            endDate: edStr,
            startDateObj: startDate.toISOString(),
            endDateObj: endDate.toISOString(),
          });
          // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
          // IMPORTANT: NU include sarcinile recurente părinte (sabloane) în filtrarea după date - acestea vor fi afișate separat în secțiunea "Sarcini cu Recurență"
          query.andWhere(
            `(assignment.scheduled_datetime IS NOT NULL AND DATE(assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (assignment.scheduled_datetime IS NULL AND DATE(assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
            { sdStr, edStr },
          );
        }
        const result = await query
          .andWhere('assignment.is_visible_for_employee = :visible', {
            visible: true,
          })
          .andWhere(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
            {
              assignedStatus: 'assigned',
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled',
            },
          )
          .getMany();
        console.log(
          '🔍 [assignment.service] read_all (non-manager) result count:',
          result.length,
        );
        // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
        const enrichedResults =
          await this.enrichAssignmentsWithDetailsBatch(result);
        return enrichedResults;
      }
    }

    // assignment.read_own - vede doar taskurile lui (assigned_to_id = user.sub) - CEA MAI RESTRICTIVĂ
    if (user?.permissions?.includes('assignment.read_own')) {
      // Obține grupul angajatului din shift-ul zilei curente (pentru task-urile FCFS)
      let userDepartmentId = null;

      // 1. PRIORITATE: Încearcă să obții department_id din shift (attendance-ms) - CEL MAI RELEVANT pentru task-uri FCFS
      try {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // Apelează microserviciul attendance pentru a obține shift-ul angajatului astăzi
        const shiftsResponse = await firstValueFrom(
          this.httpService.get(
            `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${user.work_location_id || 3}&limit=1000`,
            {
              headers: {
                'x-internal-service': 'veziv-tasks',
                'x-service-secret':
                  process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json',
              },
            },
          ),
        );

        // Răspunsul are structura: { data: [...], total: X, page: Y, limit: Z }
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (
          shiftsResponse.data &&
          Array.isArray(shiftsResponse.data.data)
        ) {
          allShifts = shiftsResponse.data.data;
        } else if (
          shiftsResponse.data &&
          Array.isArray(shiftsResponse.data.shifts)
        ) {
          allShifts = shiftsResponse.data.shifts;
        }

        // Filtrează shift-urile pentru ziua curentă
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);

        const shifts = allShifts.filter((shift: any) => {
          const shiftStart = new Date(shift.start_datetime);
          shiftStart.setHours(0, 0, 0, 0);
          return shiftStart.getTime() === todayDate.getTime();
        });

        // Găsește shift-ul pentru angajatul curent
        const userShift = shifts.find(
          (shift: any) => shift.employee_id === user.sub,
        );

        if (userShift && userShift.department_id) {
          userDepartmentId = userShift.department_id;
        } else {
        }
      } catch (error) {}

      // 2. Fallback: Dacă nu lucrează astăzi, încearcă din employees-ms (department_default_id)
      if (!userDepartmentId) {
        try {
          const employeeResponse = await firstValueFrom(
            this.httpService.get(
              `http://giurom.bitap.ro:3012/employees/${user.sub}`,
              {
                headers: {
                  'x-internal-service': 'veziv-tasks',
                  'x-service-secret':
                    process.env.SERVICE_SECRET || 'default-service-secret',
                  'Content-Type': 'application/json',
                },
              },
            ),
          );

          if (employeeResponse.data?.department_id) {
            userDepartmentId = employeeResponse.data.department_id;
          }
        } catch (error) {}
      }

      // 3. Fallback final: folosește department_id din JWT payload
      if (!userDepartmentId && user.department_id) {
        userDepartmentId = user.department_id;
      }

      const queryBuilder = query
        .where('assignment.is_visible_for_employee = :visible', {
          visible: true,
        })
        .andWhere(
          '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
          {
            assignedStatus: 'assigned',
            completedStatus: 'completed',
            waitingResponseStatus: 'waiting_response',
            scheduledStatus: 'scheduled',
          },
        );

      // Aplică intervalul DOAR dacă este furnizat
      if (startDate && endDate) {
        // Formatează datele ca string-uri YYYY-MM-DD pentru comparație corectă
        const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        console.log('📅 [assignment.service] read_own Date filter:', {
          startDate: sdStr,
          endDate: edStr,
          startDateObj: startDate.toISOString(),
          endDateObj: endDate.toISOString(),
        });
        // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
        // IMPORTANT: Sarcinile recurente părinte (sabloane) NU sunt incluse în filtrarea după date
        // Ele ar trebui să fie afișate doar în secțiunea separată "Sarcini cu Recurență"
        queryBuilder.andWhere(
          `(assignment.scheduled_datetime IS NOT NULL AND DATE(assignment.scheduled_datetime) BETWEEN :sdStr AND :edStr) OR (assignment.scheduled_datetime IS NULL AND DATE(assignment.assigned_at) BETWEEN :sdStr AND :edStr)`,
          { sdStr, edStr },
        );
      }
      // Aplică filtru pe locație dacă e furnizat
      if (locationId !== undefined) {
        queryBuilder.andWhere('assignment.location_id = :ownLoc', {
          ownLoc: locationId,
        });
      }

      // 🔒 FILTRARE STRICTĂ: Task-ul este vizibil DOAR dacă:
      // 1. assigned_to_id = userId (pentru toate modurile: individual, everyone_gets_it acceptat, FCFS acceptat)
      // 2. assignment_mode = 'first_come_first_served' AND assigned_to_id IS NULL AND department_group_id corespunde departamentului user-ului
      // 3. assignment_mode = 'everyone_gets_it' AND assigned_to_id IS NULL AND department_group_id corespunde departamentului user-ului
      // IMPORTANT: 
      // - Taskurile individual cu assigned_to_id != userId trebuie excluse COMPLET
      // - Taskurile everyone_gets_it cu assigned_to_id != userId și assigned_to_id != NULL trebuie excluse COMPLET
      // - Taskurile FCFS/everyone_gets_it neatribuite trebuie să fie din departamentul user-ului (dept_${userDepartmentId}_%)
      // - Taskurile recurente copiate (cu parent_recurrence_id) trebuie să fie atribuite direct user-ului
      if (userDepartmentId) {
        // Pentru utilizatorii cu department_id:
        // - Taskuri atribuite direct user-ului (assigned_to_id = userId) - pentru TOATE modurile
        // - Taskuri FCFS/everyone_gets_it neatribuite din departamentul user-ului (dept_${userDepartmentId}_%) - DOAR părinți (parent_recurrence_id IS NULL)
        // - Taskuri recurente copiate (parent_recurrence_id IS NOT NULL) DOAR dacă sunt atribuite user-ului
        // - NU permite taskuri fără department_group_id (acestea sunt pentru utilizatorii fără department_id)
        queryBuilder.andWhere(
          `(
            assignment.assigned_to_id = :userId
            OR 
            (
              assignment.assigned_to_id IS NULL 
              AND assignment.parent_recurrence_id IS NULL
              AND (assignment.assignment_mode = :fcfsMode OR assignment.assignment_mode = :everyoneMode)
              AND assignment.department_group_id LIKE :departmentPattern
            )
          )`,
          {
            userId: user.sub,
            fcfsMode: 'first_come_first_served',
            everyoneMode: 'everyone_gets_it',
            departmentPattern: `dept_${userDepartmentId}_%`,
          },
        );
      } else {
        // Pentru utilizatorii fără department_id, afișează DOAR task-urile FCFS/everyone_gets_it de persoane (fără department_group_id)
        queryBuilder.andWhere(
          `(
            assignment.assigned_to_id = :userId
            OR 
            (
              assignment.assigned_to_id IS NULL 
              AND assignment.department_group_id IS NULL
              AND (assignment.assignment_mode = :fcfsMode OR assignment.assignment_mode = :everyoneMode)
            )
          )`,
          {
            userId: user.sub,
            fcfsMode: 'first_come_first_served',
            everyoneMode: 'everyone_gets_it',
          },
        );
      }

      // 🔍 DEBUG: Log query-ul SQL generat pentru debugging
      const sqlQuery = queryBuilder.getQuery();
      const sqlParams = queryBuilder.getParameters();
      console.log('🔍 [assignment.service] SQL Query:', sqlQuery);
      console.log('🔍 [assignment.service] SQL Parameters:', sqlParams);

      const result = await queryBuilder.getMany();
      console.log(
        '🔍 [assignment.service] read_own result count (înainte de filtrare finală):',
        result.length,
        'applied locationId:',
        locationId,
        'userDepartmentId:',
        userDepartmentId,
        'userId:',
        user.sub,
      );

      // 🔒 FILTRARE FINALĂ ÎN MEMORIE: Elimină taskurile care au trecut prin SQL dar nu ar trebui să fie returnate
      // Această filtrare este o măsură de siguranță pentru a elimina taskurile care au trecut prin SQL din cauza unei logici complexe
      const filteredResult = result.filter((r) => {
        const assignedToId = r.assigned_to_id;
        const assignmentMode = r.assignment_mode;
        const parentRecurrenceId = r.parent_recurrence_id;
        const departmentGroupId = r.department_group_id;
        
        // Verifică dacă este sarcină recurentă părinte (sablon)
        let isParentRecurring = false;
        try {
          const recurrenceSettings = r.recurrence_settings;
          const enabled =
            recurrenceSettings && typeof recurrenceSettings === 'object'
              ? recurrenceSettings.enabled
              : false;
          isParentRecurring =
            enabled === true &&
            (parentRecurrenceId === null || parentRecurrenceId === undefined);
        } catch (e) {
          isParentRecurring = false;
        }
        
        // Dacă se trimite un interval de date, exclude sarcinile recurente părinte (sabloane)
        // Sarcinile recurente părinte nu ar trebui să apară în lista de sarcini pentru o zi specifică
        // Ele ar trebui să fie afișate doar în secțiunea separată "Sarcini cu Recurență"
        if (startDate && endDate && isParentRecurring) {
          return false; // Exclude sarcinile recurente părinte când se filtrează după date
        }
        
        // Verificare suplimentară: exclude sarcinile care nu sunt în intervalul de date
        // Aceasta este o măsură de siguranță pentru a elimina sarcinile care au trecut prin SQL din cauza unei erori
        if (startDate && endDate && !isParentRecurring) {
          const taskDate = r.scheduled_datetime ? new Date(r.scheduled_datetime) : new Date(r.assigned_at);
          const taskDateStr = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}-${String(taskDate.getDate()).padStart(2, '0')}`;
          const sdStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const edStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          
          if (taskDateStr < sdStr || taskDateStr > edStr) {
            return false; // Exclude sarcini care nu sunt în intervalul de date
          }
        }
        
        // Task-ul este vizibil DOAR dacă:
        // 1. assigned_to_id === userId (pentru TOATE modurile)
        if (assignedToId !== null && assignedToId !== undefined) {
          // Task atribuit - trebuie să fie atribuit user-ului
          if (assignedToId !== user.sub) {
            return false; // Exclude task cu assigned_to_id diferit de userId
          }
          return true; // Task atribuit user-ului - OK
        }
        
        // 2. assigned_to_id IS NULL AND (FCFS/everyone_gets_it SAU sarcină recurentă părinte) AND department_group_id corespunde
        if (assignedToId === null || assignedToId === undefined) {
          // Task neatribuit - trebuie să fie FCFS/everyone_gets_it SAU sarcină recurentă părinte, fără parent_recurrence_id, și cu department_group_id corect
          const isFCFSOrEveryone = assignmentMode === 'first_come_first_served' || assignmentMode === 'everyone_gets_it';
          
          if (!isFCFSOrEveryone && !isParentRecurring) {
            return false; // Exclude task neatribuit care nu este FCFS/everyone_gets_it și nu este sarcină recurentă părinte
          }
          
          if (parentRecurrenceId !== null && parentRecurrenceId !== undefined) {
            return false; // Exclude task neatribuit cu parent_recurrence_id (ar trebui să fie atribuit user-ului)
          }
          
          if (userDepartmentId) {
            // Pentru utilizatorii cu department_id, trebuie să aibă department_group_id corect
            if (!departmentGroupId || !departmentGroupId.startsWith(`dept_${userDepartmentId}_`)) {
              return false; // Exclude task neatribuit fără department_group_id corect
            }
          } else {
            // Pentru utilizatorii fără department_id, trebuie să aibă department_group_id NULL
            if (departmentGroupId !== null && departmentGroupId !== undefined) {
              return false; // Exclude task neatribuit cu department_group_id setat
            }
          }
          return true; // Task neatribuit valid - OK
        }
        
        return false; // Exclude orice alt caz
      });
      
      console.log(
        '🔍 [assignment.service] read_own result count (după filtrare finală):',
        filteredResult.length,
        'eliminate:',
        result.length - filteredResult.length,
      );

      // 🔍 DEBUG: Verifică dacă există taskuri care nu ar trebui să fie returnate
      const incorrectTasks = filteredResult.filter((r) => {
        const assignedToId = r.assigned_to_id;
        const assignmentMode = r.assignment_mode;
        const parentRecurrenceId = r.parent_recurrence_id;
        const departmentGroupId = r.department_group_id;
        
        // Verifică dacă este sarcină recurentă părinte (sablon)
        let isParentRecurring = false;
        try {
          const recurrenceSettings = r.recurrence_settings;
          const enabled =
            recurrenceSettings && typeof recurrenceSettings === 'object'
              ? recurrenceSettings.enabled
              : false;
          isParentRecurring =
            enabled === true &&
            (parentRecurrenceId === null || parentRecurrenceId === undefined);
        } catch (e) {
          isParentRecurring = false;
        }
        
        // Task-ul ar trebui să fie vizibil DOAR dacă:
        // 1. assigned_to_id === userId SAU
        // 2. assigned_to_id IS NULL AND parent_recurrence_id IS NULL AND (FCFS/everyone_gets_it SAU sarcină recurentă părinte) AND department_group_id corespunde
        if (assignedToId !== null && assignedToId !== undefined && assignedToId !== user.sub) {
          return true; // Task cu assigned_to_id diferit de userId - INCORECT
        }
        
        // Verifică taskurile everyone_gets_it cu assigned_to_id setat
        if (assignmentMode === 'everyone_gets_it' && assignedToId !== null && assignedToId !== undefined && assignedToId !== user.sub) {
          return true; // Task everyone_gets_it cu assigned_to_id diferit de userId - INCORECT
        }
        
        // Verifică taskurile individual
        if (assignmentMode === 'individual' && assignedToId !== user.sub) {
          return true; // Task individual cu assigned_to_id diferit de userId - INCORECT
        }
        
        // Verifică taskurile neatribuite - trebuie să fie FCFS/everyone_gets_it SAU sarcină recurentă părinte, fără parent_recurrence_id, și cu department_group_id corect
        if (assignedToId === null || assignedToId === undefined) {
          const isFCFSOrEveryone = assignmentMode === 'first_come_first_served' || assignmentMode === 'everyone_gets_it';
          if (!isFCFSOrEveryone && !isParentRecurring) {
            return true; // Task neatribuit care nu este FCFS/everyone_gets_it și nu este sarcină recurentă părinte - INCORECT
          }
          if (parentRecurrenceId !== null && parentRecurrenceId !== undefined) {
            return true; // Task neatribuit cu parent_recurrence_id - INCORECT (ar trebui să fie atribuit user-ului)
          }
          if (userDepartmentId && (!departmentGroupId || !departmentGroupId.startsWith(`dept_${userDepartmentId}_`))) {
            return true; // Task neatribuit fără department_group_id corect - INCORECT
          }
        }
        
        return false;
      });
      
      if (incorrectTasks.length > 0) {
        console.error(`❌ [assignment.service] GĂSITE ${incorrectTasks.length} TASKURI INCORECTE ÎN REZULTAT (după filtrare finală)!`);
        incorrectTasks.slice(0, 10).forEach((task) => {
          console.error(`❌ [assignment.service] Task ${task.id} - assigned_to_id: ${task.assigned_to_id}, mode: ${task.assignment_mode}, parent_recurrence_id: ${task.parent_recurrence_id}, department_group_id: ${task.department_group_id}, userId: ${user.sub}`);
        });
      } else {
        console.log('✅ [assignment.service] Toate taskurile sunt corecte după filtrare finală!');
      }
      
      // Folosește rezultatul filtrat
      const finalResult = filteredResult;

      if (finalResult.length > 0) {
        console.log('🔍 [assignment.service] Primul assignment din rezultat:', {
          id: finalResult[0].id,
          is_visible_for_employee: finalResult[0].is_visible_for_employee,
          assigned_to_id: finalResult[0].assigned_to_id,
          assignment_mode: finalResult[0].assignment_mode,
          department_group_id: finalResult[0].department_group_id,
        });
      }
      // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
      const enrichedResults =
        await this.enrichAssignmentsWithDetailsBatch(finalResult);
      return enrichedResults;
    }

    // assignment.read_location - vede după work_location
    if (user?.permissions?.includes('assignment.read_location')) {
      try {
        // Preia informațiile despre angajat din microserviciul employees
        const employeeResponse = await firstValueFrom(
          this.httpService.get(
            `http://giurom.bitap.ro:3002/employees/${user.sub}`,
            {
              headers: {
                'x-internal-service': 'veziv-tasks',
                'x-service-secret':
                  process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        const employee = employeeResponse.data;

        if (employee?.work_location_default_id) {
          // Filtrează assignments-urile care au template-uri disponibile în locația utilizatorului
          // Fără filtrare implicită pe ziua curentă

          // Aplică filtrul după location_id dacă este furnizat
          if (locationId !== undefined) {
            query.andWhere('assignment.location_id = :queryLocationId', {
              queryLocationId: locationId,
            });
          }

          // Filtrare OBLIGATORIE - afișează DOAR task-urile cu location_id setat
          query.andWhere('assignment.location_id IS NOT NULL');

          const qb = query
            .leftJoin('template.templateLocations', 'templateLocation')
            .where('templateLocation.idLocation = :locationId', {
              locationId:
                locationId !== undefined
                  ? locationId
                  : employee.work_location_default_id,
            })
            .andWhere('assignment.is_visible_for_employee = :visible', {
              visible: true,
            })
            .andWhere(
              '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
              {
                assignedStatus: 'assigned',
                completedStatus: 'completed',
                waitingResponseStatus: 'waiting_response',
                scheduledStatus: 'scheduled',
              },
            );
          if (startDate && endDate) {
            const sd = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              0,
              0,
              0,
              0,
            );
            const ed = new Date(
              endDate.getFullYear(),
              endDate.getMonth(),
              endDate.getDate(),
              23,
              59,
              59,
              999,
            );
            // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
            // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
            qb.andWhere(
              "(assignment.scheduled_datetime IS NOT NULL AND assignment.scheduled_datetime BETWEEN :sd AND :ed) OR (assignment.scheduled_datetime IS NULL AND assignment.assigned_at BETWEEN :sd AND :ed) OR (JSON_UNQUOTE(JSON_EXTRACT(assignment.recurrence_settings, '$.enabled')) = 'true' AND assignment.parent_recurrence_id IS NULL)",
              { sd, ed },
            );
          }
          // Filtru explicit pe assignment.location_id dacă e trimis
          if (locationId !== undefined) {
            qb.andWhere('assignment.location_id = :filterLoc', {
              filterLoc: locationId,
            });
          }
          const locationResult = await qb.getMany();
          console.log(
            '🔍 [assignment.service] read_location result count:',
            locationResult.length,
            'applied locationId:',
            locationId !== undefined
              ? locationId
              : employee.work_location_default_id,
          );

          // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
          const enrichedLocationResults =
            await this.enrichAssignmentsWithDetailsBatch(locationResult);
          return enrichedLocationResults;
        }

        // Dacă nu are work_location_default_id, returnează array gol
        return [];
      } catch (error) {
        console.error(
          '❌ [assignment.service] Eroare la obținerea informațiilor despre locație:',
          error.message,
        );
        return [];
      }
    }

    // assignment.read_company - vede după compania din work_location
    if (user?.permissions?.includes('assignment.read_company')) {
      try {
        // Preia informațiile despre angajat din microserviciul employees
        const employeeResponse = await firstValueFrom(
          this.httpService.get(
            `http://giurom.bitap.ro:3002/employees/${user.sub}`,
            {
              headers: {
                'x-internal-service': 'veziv-tasks',
                'x-service-secret':
                  process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        const employee = employeeResponse.data;

        if (employee?.work_location_default_id) {
          // Preia informațiile despre locație din microserviciul locations
          const locationResponse = await firstValueFrom(
            this.httpService.get(
              `http://giurom.bitap.ro:3002/locations/${employee.work_location_default_id}`,
              {
                headers: {
                  'x-internal-service': 'veziv-tasks',
                  'x-service-secret':
                    process.env.SERVICE_SECRET || 'default-service-secret',
                  'Content-Type': 'application/json',
                },
              },
            ),
          );
          const location = locationResponse.data;

          if (location?.company_id) {
            // Preia toate locațiile din compania respectivă
            const companyLocationsResponse = await firstValueFrom(
              this.httpService.get(
                `http://giurom.bitap.ro:3002/locations?company_id=${location.company_id}`,
                {
                  headers: {
                    'x-internal-service': 'veziv-tasks',
                    'x-service-secret':
                      process.env.SERVICE_SECRET || 'default-service-secret',
                    'Content-Type': 'application/json',
                  },
                },
              ),
            );
            const companyLocations =
              companyLocationsResponse.data.locations || [];
            const locationIds = companyLocations.map((loc: any) => loc.id);

            if (locationIds.length > 0) {
              // Filtrează assignments-urile care au template-uri disponibile în locațiile companiei
              // Returnează toate sarcinile (fără restricție implicită pe ziua curentă)
              query
                .leftJoin('template.templateLocations', 'templateLocation')
                .where('templateLocation.idLocation IN (:...locationIds)', {
                  locationIds,
                })
                .andWhere('assignment.is_visible_for_employee = :visible', {
                  visible: true,
                })
                .andWhere(
                  '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
                  {
                    assignedStatus: 'assigned',
                    completedStatus: 'completed',
                    waitingResponseStatus: 'waiting_response',
                    scheduledStatus: 'scheduled',
                  },
                );

              // Aplică filtrul după location_id dacă este furnizat
              if (locationId !== undefined) {
                query.andWhere('assignment.location_id = :queryLocationId', {
                  queryLocationId: locationId,
                });
              }
              // Aplică intervalul de date doar dacă este furnizat
              if (startDate && endDate) {
                const start = new Date(
                  startDate.getFullYear(),
                  startDate.getMonth(),
                  startDate.getDate(),
                  0,
                  0,
                  0,
                  0,
                );
                const end = new Date(
                  endDate.getFullYear(),
                  endDate.getMonth(),
                  endDate.getDate(),
                  23,
                  59,
                  59,
                  999,
                );
                // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
                // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
                query.andWhere(
                  "(assignment.scheduled_datetime IS NOT NULL AND assignment.scheduled_datetime BETWEEN :sd AND :ed) OR (assignment.scheduled_datetime IS NULL AND assignment.assigned_at BETWEEN :sd AND :ed) OR (JSON_UNQUOTE(JSON_EXTRACT(assignment.recurrence_settings, '$.enabled')) = 'true' AND assignment.parent_recurrence_id IS NULL)",
                  { sd: start, ed: end },
                );
              }

              // Filtrare OBLIGATORIE - afișează DOAR task-urile cu location_id setat
              query.andWhere('assignment.location_id IS NOT NULL');

              const companyLocationResult = await query.getMany();
              console.log(
                '🔍 [assignment.service] read_company result count:',
                companyLocationResult.length,
                'filter locationId:',
                locationId,
                'company locations count:',
                locationIds.length,
              );

              // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
              const enrichedCompanyResults =
                await this.enrichAssignmentsWithDetailsBatch(
                  companyLocationResult,
                );
              return enrichedCompanyResults;
            }
          }
        }

        // Dacă nu poate obține informațiile, returnează array gol
        return [];
      } catch (error) {
        console.error(
          '❌ [assignment.service] Eroare la obținerea informațiilor despre companie:',
          error.message,
        );
        return [];
      }
    }

    // assignment.read_all - vede toate - CEA MAI PERMISIVĂ
    if (user?.permissions?.includes('assignment.read_all')) {
      // Dacă are și assignment.create (este manager), poate vedea sarcinile invizibile
      if (user?.permissions?.includes('assignment.create')) {
        // Manager: fără filtru implicit pe ziua curentă — returnăm toate sarcinile
        if (locationId !== undefined) {
          query.andWhere('assignment.location_id = :locId', {
            locId: locationId,
          });
        }
        if (startDate && endDate) {
          const start = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
            0,
            0,
            0,
            0,
          );
          const end = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
            23,
            59,
            59,
            999,
          );
          // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
          // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
          query.andWhere(
            "(assignment.scheduled_datetime IS NOT NULL AND assignment.scheduled_datetime BETWEEN :sd AND :ed) OR (assignment.scheduled_datetime IS NULL AND assignment.assigned_at BETWEEN :sd AND :ed) OR (JSON_UNQUOTE(JSON_EXTRACT(assignment.recurrence_settings, '$.enabled')) = 'true' AND assignment.parent_recurrence_id IS NULL)",
            { sd: start, ed: end },
          );
        }
        const result = await query
          .where(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
            {
              assignedStatus: 'assigned',
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled',
            },
          )
          .getMany();
        // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
        const enrichedResults =
          await this.enrichAssignmentsWithDetailsBatch(result);
        return enrichedResults;
      } else {
        // Dacă nu este manager, filtrează doar sarcinile vizibile
        // Fără filtru implicit pe ziua curentă — returnăm toate sarcinile vizibile
        if (locationId !== undefined) {
          query.andWhere('assignment.location_id = :locId', {
            locId: locationId,
          });
        }
        if (startDate && endDate) {
          const start = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
            0,
            0,
            0,
            0,
          );
          const end = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
            23,
            59,
            59,
            999,
          );
          // Pentru sarcini programate, folosește scheduled_datetime; pentru restul, assigned_at
          // IMPORTANT: Include și sarcinile recurente părinte (sabloane) indiferent de intervalul de date
          query.andWhere(
            "(assignment.scheduled_datetime IS NOT NULL AND assignment.scheduled_datetime BETWEEN :sd AND :ed) OR (assignment.scheduled_datetime IS NULL AND assignment.assigned_at BETWEEN :sd AND :ed) OR (JSON_UNQUOTE(JSON_EXTRACT(assignment.recurrence_settings, '$.enabled')) = 'true' AND assignment.parent_recurrence_id IS NULL)",
            { sd: start, ed: end },
          );
        }
        const result = await query
          .where('assignment.is_visible_for_employee = :visible', {
            visible: true,
          })
          .andWhere(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
            {
              assignedStatus: 'assigned',
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled',
            },
          )
          .getMany();
        // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
        const enrichedResults =
          await this.enrichAssignmentsWithDetailsBatch(result);
        return enrichedResults;
      }
    }

    // Dacă nu are nicio permisiune, returnează array gol
    return [];
  }

  /**
   * Acceptă un task și șterge complet toate celelalte taskuri din același grup de departament
   */
  async acceptTask(id: number, userId: number): Promise<TaskAssignment> {
    const assignment = await this.findOne(id);

    if (!assignment) {
      throw new Error('Task assignment not found');
    }

    console.log(`🔍 [ACCEPT] Task found:`, {
      id: assignment.id,
      status: assignment.status,
      department_group_id: assignment.department_group_id,
      assigned_to_id: assignment.assigned_to_id,
      assignment_mode: assignment.assignment_mode,
    });

    // Verifică dacă taskul aparține utilizatorului SAU dacă utilizatorul este manager
    // Pentru manageri, să permitem acceptarea task-urilor atribuite altor angajați
    if (assignment.assigned_to_id !== userId) {
      // Verifică dacă utilizatorul este manager prin verificarea permisiunilor
      // Aceasta va fi verificată în controller prin PermissionsGuard
      console.log(
        `🔍 [ACCEPT] User ${userId} accepting task assigned to ${assignment.assigned_to_id} (manager action)`,
      );
    }

    // Verifică dacă taskul este individual sau de grup
    if (assignment.department_group_id) {
      console.log(
        `🔍 [ACCEPT] Accepting task ${id} from department group: ${assignment.department_group_id}`,
      );
      console.log(`🔍 [ACCEPT] Assignment mode: ${assignment.assignment_mode}`);

      // Comportament diferit bazat pe assignment_mode
      if (
        assignment.assignment_mode === AssignmentMode.FIRST_COME_FIRST_SERVED
      ) {
        // MODUL NOU SIMPLU: Task-ul e deja unic, doar setăm assigned_to_id
        console.log(
          `🔍 [ACCEPT] [FIRST_COME_FIRST_SERVED] Task unic pentru grup - doar setăm proprietarul`,
        );
        console.log(
          `✅ [ACCEPT] [FIRST_COME_FIRST_SERVED] Task acceptat de ${userId} - devine proprietarul`,
        );
      } else if (
        assignment.assignment_mode === AssignmentMode.EVERYONE_GETS_IT
      ) {
        // MODUL NOU: Toți din grup păstrează taskul și îl fac individual
        console.log(
          `🔍 [ACCEPT] [EVERYONE_GETS_IT] Toți din grup păstrează taskul - nu se șterge nimic`,
        );
        console.log(
          `✅ [ACCEPT] [EVERYONE_GETS_IT] Task acceptat, dar ceilalți din grup îl păstrează`,
        );
      }
    } else {
      // Task individual (fără department_group_id)
      console.log(
        `🔍 [ACCEPT] Accepting individual task ${id} (assignment_mode: ${assignment.assignment_mode})`,
      );
      console.log(
        `✅ [ACCEPT] Individual task accepted - no group logic needed`,
      );
    }

    // Actualizează taskul acceptat - doar setează assigned_to_id
    const updateData: any = {
      updated_at: new Date(),
    };

    if (
      assignment.assigned_to_id === null ||
      assignment.assigned_to_id !== userId
    ) {
      updateData.assigned_to_id = userId;
    }

    const updateResult = await this.assignmentRepository.update(id, updateData);

    console.log(`🔍 [ACCEPT] Update result for accepted task:`, updateResult);
    console.log(`✅ [ACCEPT] Task ${id} accepted and updated to in_progress`);

    const updatedTask = await this.findOne(id);
    console.log(`🔍 [ACCEPT] Final task status:`, {
      id: updatedTask.id,
      status: updatedTask.status,
      department_group_id: updatedTask.department_group_id,
    });

    console.log(`🔍 [ACCEPT] ==========================================`);
    console.log(`✅ [ACCEPT] Task acceptance completed successfully!`);
    console.log(`🔍 [ACCEPT] ==========================================`);

    return updatedTask;
  }

  /**
   * Verifică și curăță task-urile din grup care ar trebui să fie șterse
   * Poate fi apelată manual pentru a repara situații în care logica de acceptare nu a funcționat corect
   */
  async cleanupGroupTasks(
    departmentGroupId: string,
  ): Promise<{ cleaned: number; remaining: number }> {
    console.log(
      `🔍 [CLEANUP] Verific task-urile din grupul ${departmentGroupId}`,
    );

    // Găsește toate task-urile din grup
    const groupTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId,
      },
    });

    console.log(`🔍 [CLEANUP] Găsite ${groupTasks.length} task-uri în grup`);
    console.log(
      `🔍 [CLEANUP] Task-uri:`,
      groupTasks.map((t) => ({
        id: t.id,
        assigned_to_id: t.assigned_to_id,
        status: t.status,
        assignment_mode: t.assignment_mode,
      })),
    );

    if (groupTasks.length === 0) {
      return { cleaned: 0, remaining: 0 };
    }

    // Găsește task-urile în IN_PROGRESS (acceptate)
    const inProgressTasks = groupTasks.filter(
      (task) => task.status === AssignmentStatus.IN_PROGRESS,
    );

    if (inProgressTasks.length === 0) {
      console.log(`ℹ️ [CLEANUP] Nu există task-uri acceptate în grup`);
      return { cleaned: 0, remaining: groupTasks.length };
    }

    // Pentru fiecare task acceptat, verifică assignment_mode și șterge celelalte dacă este FIRST_COME_FIRST_SERVED
    let cleanedCount = 0;

    for (const acceptedTask of inProgressTasks) {
      if (
        acceptedTask.assignment_mode === AssignmentMode.FIRST_COME_FIRST_SERVED
      ) {
        console.log(
          `🔍 [CLEANUP] Task-ul ${acceptedTask.id} este FIRST_COME_FIRST_SERVED - șterg celelalte`,
        );

        // Șterge toate celelalte task-uri din grup (nu pe cel acceptat)
        const otherTasks = groupTasks.filter(
          (task) =>
            task.id !== acceptedTask.id &&
            task.status !== AssignmentStatus.COMPLETED,
        );

        if (otherTasks.length > 0) {
          const deleteResult = await this.assignmentRepository.delete(
            otherTasks.map((task) => task.id),
          );
          cleanedCount += otherTasks.length;
          console.log(
            `✅ [CLEANUP] Șterse ${otherTasks.length} task-uri din grup`,
          );
        }
      } else {
        console.log(
          `ℹ️ [CLEANUP] Task-ul ${acceptedTask.id} este EVERYONE_GETS_IT - nu se șterge nimic`,
        );
      }
    }

    // Recalculează task-urile rămase
    const remainingTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId,
      },
    });

    console.log(
      `✅ [CLEANUP] Curățare completă: ${cleanedCount} șterse, ${remainingTasks.length} rămase`,
    );

    return { cleaned: cleanedCount, remaining: remainingTasks.length };
  }

  /**
   * Metodă pentru testare - verifică task-urile din grup și le curăță dacă este necesar
   * Poate fi apelată manual pentru debugging
   */
  async debugGroupTasks(departmentGroupId: string): Promise<any> {
    const groupTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId,
      },
    });

    const result = {
      groupId: departmentGroupId,
      totalTasks: groupTasks.length,
      tasks: groupTasks.map((t) => ({
        id: t.id,
        assigned_to_id: t.assigned_to_id,
        status: t.status,
        assignment_mode: t.assignment_mode,
        created_at: t.created_at,
      })),
    };

    return result;
  }

  /**
   * Aprobă un task cu requires_manager_check și îl finalizează
   */
  async approveTask(id: number, managerId: number): Promise<TaskAssignment> {
    console.log(`🔍 [APPROVE] Manager ${managerId} aprobă task-ul ${id}`);

    const assignment = await this.findOne(id);
    if (!assignment) {
      throw new Error(`Assignment cu ID ${id} nu a fost găsit`);
    }

    if (assignment.status !== 'waiting_response') {
      throw new Error(`Task-ul ${id} nu este în status waiting_response`);
    }

    // Verifică dacă task-ul are requires_manager_check
    const hasRequiresManagerCheck = assignment.elements?.some(
      (el) =>
        el.task_element.element_type === 'requires_manager_check' &&
        el.value === 'true',
    );

    if (!hasRequiresManagerCheck) {
      throw new Error(`Task-ul ${id} nu are requires_manager_check activat`);
    }

    // Actualizează statusul la completed
    await this.assignmentRepository.update(id, {
      status: 'completed' as any,
      completed_at: new Date(),
    });

    // NU mai creăm execuție nouă - angajatul a creat deja execuția când a completat task-ul!
    // Execuția existentă conține deja toate răspunsurile (answers) ale angajatului

    console.log(
      `✅ [APPROVE] Task ${id} aprobat de manager ${managerId} și finalizat`,
    );

    // Returnează task-ul actualizat
    return this.findOne(id);
  }

  /**
   * Respinge un task cu requires_manager_check și îl returnează la status assigned
   */
  async rejectTask(id: number, managerId: number): Promise<TaskAssignment> {
    console.log(`🔍 [REJECT] Manager ${managerId} respinge task-ul ${id}`);

    const assignment = await this.findOne(id);
    if (!assignment) {
      throw new Error(`Assignment cu ID ${id} nu a fost găsit`);
    }

    if (assignment.status !== 'waiting_response') {
      throw new Error(`Task-ul ${id} nu este în status waiting_response`);
    }

    // Verifică dacă task-ul are requires_manager_check
    const hasRequiresManagerCheck = assignment.elements?.some(
      (el) =>
        el.task_element.element_type === 'requires_manager_check' &&
        el.value === 'true',
    );

    if (!hasRequiresManagerCheck) {
      throw new Error(`Task-ul ${id} nu are requires_manager_check activat`);
    }

    // ȘTERGE EXECUȚIA ȘI PUNCTELE - Găsește execuția pentru acest assignment
    // Folosim ExecutionService.remove() care gestionează automat ștergerea punctelor
    const executions = await this.executionService.findAll(null, false);
    const execution = executions.find((e) => e.task_assignment_id === id);

    if (execution) {
      console.log(
        `🔍 [REJECT] Găsită execuție ${execution.id} pentru task ${id} - va fi ștearsă`,
      );

      try {
        // Folosește metoda remove din ExecutionService care gestionează automat punctele
        await this.executionService.remove(execution.id);
        console.log(
          `✅ [REJECT] Execuția ${execution.id} și punctele au fost șterse cu succes`,
        );
      } catch (error) {
        console.error(
          `❌ [REJECT] Eroare la ștergerea execuției ${execution.id}:`,
          error,
        );
        // Nu aruncăm eroarea pentru a nu bloca reactivarea task-ului
      }
    } else {
      console.log(
        `ℹ️ [REJECT] Nu există execuție pentru task ${id} - continuăm cu reactivarea`,
      );
    }

    // Incrementează rejecting_times și actualizează statusul la assigned
    const currentRejectingTimes = assignment.rejecting_times || 0;
    const newRejectingTimes = currentRejectingTimes + 1;

    await this.assignmentRepository.update(id, {
      status: 'assigned' as any,
      completed_at: undefined,
      rejecting_times: newRejectingTimes,
    });

    console.log(
      `✅ [REJECT] Task ${id} respins de manager ${managerId} (respingere #${newRejectingTimes}) și returnat la assigned`,
    );

    // Returnează task-ul actualizat
    return this.findOne(id);
  }

  /**
   * Obține sarcinile întârziate pentru angajatul curent
   */
  async getOverdueTasks(user: any): Promise<TaskAssignment[]> {
    console.log(
      '🔍 [assignment.service] getOverdueTasks - User:',
      user ? 'EXISTĂ' : 'LIPSEȘTE',
    );
    if (user) {
      console.log('🔍 [assignment.service] User ID:', user.sub);
      console.log(
        '🔍 [assignment.service] User permissions:',
        user.permissions,
      );
    }

    const now = new Date();
    const query = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.template', 'template')
      .leftJoinAndSelect('assignment.elements', 'elements')
      .leftJoinAndSelect('elements.task_element', 'task_element')
      .orderBy('assignment.assigned_at', 'DESC');

    // assignment.read_own - vede doar taskurile lui (assigned_to_id = user.sub)
    if (user?.permissions?.includes('assignment.read_own')) {
      console.log(
        '✅ [assignment.service] User are assignment.read_own - filtrez după assigned_to_id',
      );

      const result = await query
        .where('assignment.assigned_to_id = :userId', { userId: user.sub })
        // assigned_to_type eliminat - toate task-urile sunt pentru persoane
        .andWhere('assignment.is_visible_for_employee = :visible', {
          visible: true,
        })
        .andWhere('assignment.status != :completedStatus', {
          completedStatus: 'completed',
        })
        .getMany();

      // Filtrează sarcinile întârziate pe frontend
      const overdueTasks = result.filter((assignment) => {
        // Caută elementul finish_at sau finalized_in
        const finishAtElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'finish_at',
        );
        const finalizedInElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'finalized_in',
        );

        let deadline: Date | null = null;

        if (finishAtElement?.value) {
          deadline = new Date(finishAtElement.value.trim());
        } else if (finalizedInElement?.value) {
          try {
            const durationData = JSON.parse(finalizedInElement.value.trim());
            const hours = durationData.hours || 0;
            const minutes = durationData.minutes || 0;

            deadline = new Date(assignment.assigned_at);
            deadline.setHours(deadline.getHours() + hours);
            deadline.setMinutes(deadline.getMinutes() + minutes);
          } catch (e) {
            return false;
          }
        }

        // Verifică dacă deadline-ul a fost depășit
        return deadline && now > deadline;
      });

      console.log(
        '🔍 [assignment.service] Rezultat overdue tasks:',
        overdueTasks.length,
        'assignments',
      );

      // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
      const enrichedResults =
        await this.enrichAssignmentsWithDetailsBatch(overdueTasks);
      return enrichedResults;
    }

    // Pentru manageri, returnează toate sarcinile întârziate
    if (
      user?.permissions?.includes('assignment.read_all') ||
      user?.permissions?.includes('assignment.read_company')
    ) {
      console.log(
        '✅ [assignment.service] User este manager - returnez toate sarcinile întârziate',
      );

      const result = await query
        .where('assignment.status != :completedStatus', {
          completedStatus: 'completed',
        })
        .getMany();

      // Filtrează sarcinile întârziate
      const overdueTasks = result.filter((assignment) => {
        const finishAtElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'finish_at',
        );
        const finalizedInElement = assignment.elements?.find(
          (el) => el.task_element.element_type === 'finalized_in',
        );

        let deadline: Date | null = null;

        if (finishAtElement?.value) {
          deadline = new Date(finishAtElement.value.trim());
        } else if (finalizedInElement?.value) {
          try {
            const durationData = JSON.parse(finalizedInElement.value.trim());
            const hours = durationData.hours || 0;
            const minutes = durationData.minutes || 0;

            deadline = new Date(assignment.assigned_at);
            deadline.setHours(deadline.getHours() + hours);
            deadline.setMinutes(deadline.getMinutes() + minutes);
          } catch (e) {
            return false;
          }
        }

        return deadline && now > deadline;
      });

      console.log(
        '🔍 [assignment.service] Rezultat overdue tasks (manager):',
        overdueTasks.length,
        'assignments',
      );

      // Adaugă informații despre persoane și departamente - OPTIMIZAT cu batch loading
      const enrichedResults =
        await this.enrichAssignmentsWithDetailsBatch(overdueTasks);
      return enrichedResults;
    }

    // Dacă nu are permisiuni, returnează array gol
    console.log(
      '❌ [assignment.service] User nu are permisiuni pentru overdue tasks',
    );
    return [];
  }

  /**
   * Amână un task cu allow_postpone activat
   */
  async postponeTask(id: number, userId: number): Promise<TaskAssignment> {
    console.log(`🔍 [POSTPONE] ==========================================`);
    console.log(`🔍 [POSTPONE] Postponing task ${id} for user ${userId}`);
    console.log(`🔍 [POSTPONE] ==========================================`);

    const assignment = await this.findOne(id);

    if (!assignment) {
      console.log(`❌ [POSTPONE] Task assignment ${id} not found`);
      throw new Error('Task assignment not found');
    }

    // Verifică dacă task-ul aparține utilizatorului
    if (assignment.assigned_to_id !== userId) {
      console.log(`❌ [POSTPONE] Task ${id} doesn't belong to user ${userId}`);
      throw new Error('Task does not belong to user');
    }

    // Verifică dacă task-ul permite amânarea
    const allowPostponeElement = assignment.elements?.find(
      (el) => el.task_element.element_type === 'allow_postpone',
    );

    // Verifică dacă allow_postpone este activ (fie 'true' simplu, fie JSON cu enabled: true)
    let hasAllowPostpone = false;
    if (allowPostponeElement) {
      const postponeValue = allowPostponeElement.value;
      if (postponeValue === 'true') {
        hasAllowPostpone = true;
      } else if (postponeValue && postponeValue.startsWith('{')) {
        try {
          const postponeConfig = JSON.parse(postponeValue);
          hasAllowPostpone = postponeConfig.enabled === true;
        } catch (e) {
          hasAllowPostpone = false;
        }
      }
    }

    if (!hasAllowPostpone) {
      console.log(`❌ [POSTPONE] Task ${id} doesn't allow postponement`);
      throw new Error('Task does not allow postponement');
    }

    // Verifică dacă task-ul nu este deja finalizat
    if (assignment.status === 'completed') {
      console.log(`❌ [POSTPONE] Task ${id} is already completed`);
      throw new Error('Task is already completed');
    }

    // Actualizează assignment-ul: was_postponed = true și allow_postpone = false
    // NU modificăm due_date - acesta a fost deja setat la creare cu perioada de amânare inclusă
    try {
      // Găsește elementul allow_postpone și îl actualizează la false
      const allowPostponeElement = assignment.elements?.find(
        (el) => el.task_element.element_type === 'allow_postpone',
      );

      if (allowPostponeElement) {
        await this.elementRepository.update(
          { id: allowPostponeElement.id },
          { value: 'false' },
        );
        console.log(
          `✅ [POSTPONE] Updated allow_postpone to false for task ${id}`,
        );
      }

      // Actualizează doar was_postponed la true (due_date rămâne neschimbat)
      await this.assignmentRepository.update(id, {
        was_postponed: true,
      });
      console.log(
        `✅ [POSTPONE] Updated was_postponed to true pentru task ${id}`,
      );
      console.log(
        `ℹ️ [POSTPONE] due_date rămâne neschimbat (a fost deja ajustat la creare)`,
      );
    } catch (error) {
      console.error(
        `❌ [POSTPONE] Error updating task assignment ${id}:`,
        error,
      );
      throw new Error('Failed to update task assignment');
    }

    // Nu se creează execuție pentru amânare - doar se marchează was_postponed = true
    console.log(
      `✅ [POSTPONE] No execution created for postponed task ${id} - only was_postponed flag set`,
    );

    console.log(
      `✅ [POSTPONE] Task ${id} postponed successfully by user ${userId}`,
    );
    console.log(`🔍 [POSTPONE] ==========================================`);

    // Returnează assignment-ul actualizat
    return await this.findOne(id);
  }
}
