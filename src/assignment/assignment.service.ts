import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TaskAssignment, AssignmentStatus, AssignmentMode } from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { TaskTemplate } from '../template/entity/task-template.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ExecutionService } from '../execution/execution.service';

@Injectable()
export class AssignmentService {
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
  ) {}

  /**
   * Obține informațiile despre o persoană din microserviciul employees
   */
  private async getEmployeeInfo(employeeId: number): Promise<{first_name: string, last_name: string} | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/${employeeId}`)
      );
      const employee = response.data;
      return {
        first_name: employee.first_name || '',
        last_name: employee.last_name || ''
      };
    } catch (error) {
      console.error(`❌ [AssignmentService] Eroare la obținerea informațiilor despre angajatul ${employeeId}:`, error.message);
      return null;
    }
  }

  /**
   * Obține informațiile despre un departament din microserviciul locations
   */
  private async getDepartmentInfo(departmentId: number): Promise<{name: string} | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3004/work-location-departments/${departmentId}`)
      );
      const department = response.data;
      return {
        name: department.name || ''
      };
    } catch (error) {
      console.error(`❌ [AssignmentService] Eroare la obținerea informațiilor despre departamentul ${departmentId}:`, error.message);
      return null;
    }
  }

  /**
   * Adaugă informațiile despre persoana responsabilă și departamentul din grup
   */
  private async enrichAssignmentWithDetails(assignment: TaskAssignment): Promise<TaskAssignment> {
    const enrichedAssignment = { ...assignment };

    // Adaugă informații despre persoana responsabilă (toate task-urile sunt pentru persoane)
    if (assignment.assigned_to_id) {
      const employeeInfo = await this.getEmployeeInfo(assignment.assigned_to_id);
      if (employeeInfo) {
        enrichedAssignment['assigned_to_info'] = employeeInfo;
      }
    }

    // Logica pentru grupuri se face prin department_group_id, nu prin assigned_to_type

    return enrichedAssignment;
  }

  async create(createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    console.log('🔍 [AssignmentService] CreateAssignmentDto primit:', createAssignmentDto);
    
    // Determină statusul în funcție de scheduled_datetime
    let status = createAssignmentDto.status;
    
    // Dacă task-ul are recurență, nu se creează imediat - se creează doar task-urile recurente
    if (createAssignmentDto.recurrence_settings?.enabled) {
      console.log('🔍 [AssignmentService] Task cu recurență detectat - nu se creează task-ul părinte imediat');
      status = 'scheduled' as any; // Task-ul părinte rămâne scheduled
    } else if (createAssignmentDto.scheduled_datetime) {
      const scheduledDate = new Date(createAssignmentDto.scheduled_datetime);
      const now = new Date();
      
      console.log('🔍 [AssignmentService] scheduledDate:', scheduledDate);
      console.log('🔍 [AssignmentService] now:', now);
      console.log('🔍 [AssignmentService] scheduledDate > now:', scheduledDate > now);
      
      // Dacă data și ora programată este în viitor, setează statusul ca SCHEDULED
      if (scheduledDate > now) {
        status = 'scheduled' as any;
        console.log('🔍 [AssignmentService] Status schimbat la SCHEDULED');
      }
    }

    // Verifică dacă task-ul are visible_from în viitor
    let shouldBeVisible = createAssignmentDto.is_visible_for_employee !== undefined ? createAssignmentDto.is_visible_for_employee : true;
    
    if (createAssignmentDto.elements) {
      // Găsește template-ul pentru a verifica tipurile elementelor
      const template = await this.templateRepository.findOne({
        where: { id: createAssignmentDto.template_id },
        relations: ['elements']
      });
      
      if (template) {
        // Găsește elementul visible_from din template
        const visibleFromTemplateElement = template.elements.find(te => te.element_type === 'visible_from');
        const scheduledDatetimeTemplateElement = template.elements.find(te => te.element_type === 'scheduled_datetime');
        
        if (visibleFromTemplateElement) {
          // Găsește elementul corespunzător din assignment
          const visibleFromElement = createAssignmentDto.elements.find(el => 
            el.task_element_id === visibleFromTemplateElement.id
          );
          
          if (visibleFromElement && visibleFromElement.value) {
            // Verifică dacă visible_from este în viitor
            const visibleFromDate = new Date(visibleFromElement.value.trim());
            const now = new Date();
            
            console.log(`🔍 [AssignmentService] Verificare visible_from: ${visibleFromElement.value.trim()}, now: ${now.toISOString()}, visibleFromDate: ${visibleFromDate.toISOString()}`);
            
            if (visibleFromDate > now) {
              shouldBeVisible = false;
              console.log(`🔍 [AssignmentService] Task cu visible_from în viitor (${visibleFromElement.value.trim()}) - setez is_visible_for_employee=false`);
            } else {
              console.log(`🔍 [AssignmentService] Task cu visible_from în trecut sau prezent (${visibleFromElement.value.trim()}) - păstrez is_visible_for_employee=true`);
            }
          }
        }
        
        // Verifică dacă există și scheduled_datetime și visible_from
        if (visibleFromTemplateElement && scheduledDatetimeTemplateElement) {
          const visibleFromElement = createAssignmentDto.elements.find(el => 
            el.task_element_id === visibleFromTemplateElement.id
          );
          const scheduledDatetimeElement = createAssignmentDto.elements.find(el => 
            el.task_element_id === scheduledDatetimeTemplateElement.id
          );
          
          if (visibleFromElement?.value && scheduledDatetimeElement?.value) {
            const visibleFromDate = new Date(visibleFromElement.value.trim());
            const scheduledDate = new Date(scheduledDatetimeElement.value.trim());
            
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
                  minute: '2-digit'
                });
              };
              
              const formattedVisibleFrom = formatDateTime(visibleFromElement.value.trim());
              const formattedScheduled = formatDateTime(scheduledDatetimeElement.value.trim());
              
              throw new Error(`❌ EROARE: "Vizibil de la" (${formattedVisibleFrom}) nu poate fi mai mare decât "Programat la" (${formattedScheduled}). Task-ul trebuie să devină vizibil înainte sau la aceeași oră cu programarea.`);
            }
            
            console.log(`✅ [AssignmentService] Verificare validă: visible_from (${visibleFromElement.value.trim()}) <= scheduled_datetime (${scheduledDatetimeElement.value.trim()})`);
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
      status: status,
      priority: createAssignmentDto.priority,
      assigned_at: new Date(createAssignmentDto.assigned_at),
      due_date: new Date(createAssignmentDto.due_date),
      scheduled_datetime: createAssignmentDto.recurrence_settings?.enabled ? null : (createAssignmentDto.scheduled_datetime ? new Date(createAssignmentDto.scheduled_datetime) : null),
      notes: createAssignmentDto.notes,
      requires_manager_check: createAssignmentDto.requires_manager_check,
      department_group_id: createAssignmentDto.department_group_id,
      assignment_mode: createAssignmentDto.assignment_mode || AssignmentMode.INDIVIDUAL,
      is_visible_for_employee: shouldBeVisible,
      recurrence_settings: createAssignmentDto.recurrence_settings,
    });
    
    console.log('🔍 [AssignmentService] Assignment creat pentru salvare:', assignment);
    
    const savedAssignment = await this.assignmentRepository.save(assignment);
    
    console.log('🔍 [AssignmentService] Assignment salvat:', savedAssignment);
    
    // Verifică din nou din baza de date
    const dbAssignment = await this.assignmentRepository.findOne({
      where: { id: savedAssignment.id }
    });
    console.log('🔍 [AssignmentService] Assignment din DB:', dbAssignment);

    // Încarcă template-ul pentru a obține toate elementele
    const template = await this.templateRepository.findOne({
      where: { id: createAssignmentDto.template_id },
      relations: ['elements']
    });

    if (!template) {
      throw new NotFoundException(`Template cu ID-ul ${createAssignmentDto.template_id} nu a fost găsit`);
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
        el => el.task_element_id === templateElement.id
      );
      
      const elementData = {
        task_assignment_id: savedAssignment.id,
        task_element_id: templateElement.id,
        value: customElement?.value || (templateElement.element_type === 'scoring_boolean' || templateElement.element_type === 'photo' ? '[]' : ''),
        score: customElement?.score || 0,
        is_visible_for_employee: customElement?.is_visible_for_employee !== undefined ? customElement.is_visible_for_employee : templateElement.is_visible_for_employee,
      };
      
      elementsToCreate.push(this.elementRepository.create(elementData));
    }
    
    if (elementsToCreate.length > 0) {
      await this.elementRepository.save(elementsToCreate);
    }

    // Returnează assignment-ul cu toate elementele
    return this.findOne(savedAssignment.id);
  }

  async findAll(): Promise<TaskAssignment[]> {
    return this.assignmentRepository.find({
      relations: ['template', 'elements', 'elements.task_element'],
      order: {
        created_at: 'DESC'
      }
    });
  }

  async findOne(id: number): Promise<TaskAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: ['template', 'template.elements', 'elements', 'elements.task_element'],
      select: [
        'id', 'template_id', 'assigned_to_id', 'created_by_employee_id',
        'status', 'priority', 'assigned_at', 'due_date', 'completed_at',
        'scheduled_datetime', 'notes', 'requires_manager_check', 'rejecting_times', 'department_group_id',
        'assignment_mode', 'is_visible_for_employee', 'created_at', 'updated_at'
      ],
      order: {
        template: {
          elements: {
            sort_order: 'ASC'
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment cu ID ${id} nu a fost găsit`);
    }

    console.log('🔍 [AssignmentService] findOne - assignment:', { id: assignment.id, status: assignment.status, assigned_to_id: assignment.assigned_to_id });
    
    // Adaugă informații despre persoana responsabilă și departamentul din grup
    const enrichedAssignment = await this.enrichAssignmentWithDetails(assignment);
    
    return enrichedAssignment;
  }

  async update(id: number, updateAssignmentDto: UpdateAssignmentDto): Promise<TaskAssignment> {
    const assignment = await this.findOne(id);

    // Actualizează câmpurile de bază ale assignment-ului
    const updateData: any = {};
    
    if (updateAssignmentDto.template_id !== undefined) updateData.template_id = updateAssignmentDto.template_id;
    // assigned_to_type eliminat - toate task-urile sunt pentru persoane
    if (updateAssignmentDto.assigned_to_id !== undefined) updateData.assigned_to_id = updateAssignmentDto.assigned_to_id;
    if (updateAssignmentDto.status !== undefined) updateData.status = updateAssignmentDto.status;
    if (updateAssignmentDto.priority !== undefined) updateData.priority = updateAssignmentDto.priority;
    if (updateAssignmentDto.assigned_at !== undefined) updateData.assigned_at = new Date(updateAssignmentDto.assigned_at);
    if (updateAssignmentDto.due_date !== undefined) updateData.due_date = new Date(updateAssignmentDto.due_date);
    if (updateAssignmentDto.scheduled_datetime !== undefined) {
      const scheduledDateTime = updateAssignmentDto.scheduled_datetime ? new Date(updateAssignmentDto.scheduled_datetime) : null;
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
    if (updateAssignmentDto.completed_at !== undefined) updateData.completed_at = new Date(updateAssignmentDto.completed_at);
    if (updateAssignmentDto.notes !== undefined) updateData.notes = updateAssignmentDto.notes;
    if (updateAssignmentDto.requires_manager_check !== undefined) updateData.requires_manager_check = updateAssignmentDto.requires_manager_check;

    if (Object.keys(updateData).length > 0) {
      await this.assignmentRepository.update(id, updateData);
    }

    // Actualizează elementele dacă sunt specificate
    if (updateAssignmentDto.elements !== undefined) {
      // Șterge toate elementele existente
      await this.elementRepository.delete({ task_assignment_id: id });

      // Creează elementele noi
      if (updateAssignmentDto.elements.length > 0) {
        const elements = updateAssignmentDto.elements.map(elementDto => 
          this.elementRepository.create({
            ...elementDto,
            task_assignment_id: id,
          })
        );
        
        await this.elementRepository.save(elements);
      }
    }

    // Returnează assignment-ul actualizat
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const assignment = await this.findOne(id);
    await this.assignmentRepository.remove(assignment);
  }

  // ===== METODA CU PERMISIUNI PENTRU GET ASSIGNMENTS =====

  async findAllWithPermissions(user: any): Promise<TaskAssignment[]> {
    console.log('🔍 [assignment.service] findAllWithPermissions - User:', user ? 'EXISTĂ' : 'LIPSEȘTE')
    if (user) {
      console.log('🔍 [assignment.service] User permissions:', user.permissions)
    }
    
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
        'assignment.created_at',
        'assignment.updated_at'
      ])
      .orderBy('assignment.created_at', 'DESC');

    // Debug: să vedem toate sarcinile înainte de filtrare
    const allAssignments = await query.getMany();
    console.log('🔍 [assignment.service] Toate sarcinile înainte de filtrare:', allAssignments.length)
    allAssignments.forEach(assignment => {
      console.log(`🔍 [assignment.service] Assignment ${assignment.id}: assigned_to_id=${assignment.assigned_to_id}, is_visible_for_employee=${assignment.is_visible_for_employee}`)
    })

    // assignment.read_own - vede doar taskurile lui (assigned_to_id = user.sub) - CEA MAI RESTRICTIVĂ
    if (user?.permissions?.includes('assignment.read_own')) {
      console.log('✅ [assignment.service] User are assignment.read_own - filtrez după assigned_to_id și is_visible_for_employee')
      console.log('🔍 [assignment.service] User ID:', user.sub)
      console.log('🔍 [assignment.service] User permissions:', user.permissions)
      
      // Obține grupul angajatului din shift-ul zilei curente (pentru task-urile FCFS)
      let userDepartmentId = null;
      try {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        console.log('🔍 [assignment.service] Încerc să obțin shift pentru user:', user.sub, 'data:', today);
        
        // Apelează microserviciul attendance pentru a obține shift-ul angajatului astăzi
        // Folosește același endpoint ca frontend-ul: GET /attendance/shifts?work_location_id=X
        const shiftsResponse = await firstValueFrom(
          this.httpService.get(`http://localhost:3007/attendance/shifts?work_location_id=${user.work_location_id || 1}&limit=1000`)
        );
        
        console.log('🔍 [assignment.service] Răspuns RAW de la attendance:', typeof shiftsResponse.data, Array.isArray(shiftsResponse.data));
        console.log('🔍 [assignment.service] Răspuns COMPLET:', JSON.stringify(shiftsResponse.data));
        
        // Răspunsul are structura: { data: [...], total: X, page: Y, limit: Z }
        let allShifts: any[] = [];
        if (Array.isArray(shiftsResponse.data)) {
          allShifts = shiftsResponse.data;
        } else if (shiftsResponse.data && Array.isArray(shiftsResponse.data.data)) {
          allShifts = shiftsResponse.data.data; // Extragem array-ul din "data"
        } else if (shiftsResponse.data && Array.isArray(shiftsResponse.data.shifts)) {
          allShifts = shiftsResponse.data.shifts;
        } else if (shiftsResponse.data) {
          console.log('🔍 [assignment.service] Keys în răspuns:', Object.keys(shiftsResponse.data));
          allShifts = [];
        }
        
        console.log('🔍 [assignment.service] Total shifts de la attendance:', allShifts.length);
        
        // Filtrează shift-urile pentru ziua curentă (today)
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        
        const shifts = allShifts.filter((shift: any) => {
          const shiftStart = new Date(shift.start_datetime);
          shiftStart.setHours(0, 0, 0, 0);
          return shiftStart.getTime() === todayDate.getTime();
        });
        
        console.log('🔍 [assignment.service] Shifts filtrate pentru astăzi (', today, '):', shifts.length);
        if (shifts.length > 0) {
          console.log('🔍 [assignment.service] Primul shift:', JSON.stringify(shifts[0]));
          console.log('🔍 [assignment.service] Toate employee_ids din shifts de astăzi:', shifts.map((s: any) => s.employee_id));
        }
        
        // Găsește shift-ul pentru angajatul curent
        const userShift = shifts.find((shift: any) => shift.employee_id === user.sub);
        
        if (userShift) {
          userDepartmentId = userShift.department_id;
          console.log('✅ [assignment.service] User department_id din shift (ziua curentă):', userDepartmentId);
        } else {
          console.log('⚠️ [assignment.service] Nu există shift pentru user-ul', user.sub, 'în ziua', today);
          console.log('⚠️ [assignment.service] Shifts disponibile pentru:', shifts.map((s: any) => `employee_id: ${s.employee_id}, dept: ${s.department_id}`));
        }
        
        // Fallback: dacă nu există shift astăzi, folosește JWT payload department_id
        if (!userDepartmentId && user.department_id) {
          userDepartmentId = user.department_id;
          console.log('🔍 [assignment.service] Folosesc department_id din JWT payload:', userDepartmentId);
        }
      } catch (error) {
        console.log('⚠️ [assignment.service] Eroare la obținerea shift-ului user-ului:', error.message);
        
        // Fallback: folosește department_id din JWT payload
        if (user.department_id) {
          userDepartmentId = user.department_id;
          console.log('🔍 [assignment.service] Fallback - User department_id din JWT:', userDepartmentId);
        }
      }
      
      // Filtrează sarcinile active și finalizate doar pe ziua curentă
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      const queryBuilder = query
        .where('assignment.is_visible_for_employee = :visible', { visible: true })
        .andWhere(
          '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR assignment.status = :scheduledStatus)',
          { 
            assignedStatus: 'assigned', 
            completedStatus: 'completed',
            waitingResponseStatus: 'waiting_response',
            scheduledStatus: 'scheduled'
          }
        )
        .andWhere(
          '(assignment.status = :scheduledStatus OR (assignment.assigned_at >= :startOfDay AND assignment.assigned_at <= :endOfDay))',
          { 
            scheduledStatus: 'scheduled',
            startOfDay: startOfDay,
            endOfDay: endOfDay
          }
        );
      
      // Adaugă condiția pentru assigned_to_id SAU task-uri FCFS din departamentul user-ului
      if (userDepartmentId) {
        queryBuilder.andWhere(
          '(assignment.assigned_to_id = :userId OR (assignment.assignment_mode = :fcfsMode AND assignment.assigned_to_id IS NULL AND assignment.department_group_id LIKE :departmentPattern))',
          { 
            userId: user.sub,
            fcfsMode: 'first_come_first_served',
            departmentPattern: `dept_${userDepartmentId}_%`
          }
        );
      } else {
        queryBuilder.andWhere('assignment.assigned_to_id = :userId', { userId: user.sub });
      }
      
      const result = await queryBuilder.getMany();
      
      console.log('🔍 [assignment.service] Rezultat query own:', result.length, 'assignments')
      if (result.length > 0) {
        console.log('🔍 [assignment.service] Primul assignment din rezultat:', {
          id: result[0].id,
          is_visible_for_employee: result[0].is_visible_for_employee,
          assigned_to_id: result[0].assigned_to_id,
          assignment_mode: result[0].assignment_mode
        })
      }
      // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        result.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
    }

    // assignment.read_location - vede după work_location
    if (user?.permissions?.includes('assignment.read_location')) {
      console.log('✅ [assignment.service] User are assignment.read_location - filtrez după locație')
      try {
        // Preia informațiile despre angajat din microserviciul employees
        const employeeResponse = await firstValueFrom(
          this.httpService.get(`http://localhost:3012/employees/${user.sub}`)
        );
        const employee = employeeResponse.data;
        
        if (employee?.work_location_default_id) {
          // Filtrează assignments-urile care au template-uri disponibile în locația utilizatorului
          // Filtrează sarcinile active și finalizate doar pe ziua curentă
          const today = new Date();
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
          
          const result = await query
            .leftJoin('template.templateLocations', 'templateLocation')
            .where('templateLocation.idLocation = :locationId', { locationId: employee.work_location_default_id })
            .andWhere('assignment.is_visible_for_employee = :visible', { visible: true })
            .andWhere(
              '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR (assignment.status = :scheduledStatus AND assignment.scheduled_datetime IS NULL))',
              { 
                assignedStatus: 'assigned', 
                completedStatus: 'completed',
                waitingResponseStatus: 'waiting_response',
                scheduledStatus: 'scheduled'
              }
            )
            .andWhere(
              '(assignment.status = :scheduledStatus OR (assignment.assigned_at >= :startOfDay AND assignment.assigned_at <= :endOfDay))',
              { 
                scheduledStatus: 'scheduled',
                startOfDay: startOfDay,
                endOfDay: endOfDay
              }
            )
            .getMany();
          
          console.log('🔍 [assignment.service] Rezultat query location:', result.length, 'assignments')
          // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        result.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
        }
        
        // Dacă nu are work_location_default_id, returnează array gol
        console.log('❌ [assignment.service] User nu are work_location_default_id:', user.sub)
        return [];
      } catch (error) {
        console.error('❌ [assignment.service] Eroare la obținerea informațiilor despre locație:', error.message)
        return [];
      }
    }

    // assignment.read_company - vede după compania din work_location
    if (user?.permissions?.includes('assignment.read_company')) {
      console.log('✅ [assignment.service] User are assignment.read_company - filtrez după companie')
      try {
        // Preia informațiile despre angajat din microserviciul employees
        const employeeResponse = await firstValueFrom(
          this.httpService.get(`http://localhost:3012/employees/${user.sub}`)
        );
        const employee = employeeResponse.data;
        
        if (employee?.work_location_default_id) {
          // Preia informațiile despre locație din microserviciul locations
          const locationResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3004/locations/${employee.work_location_default_id}`)
          );
          const location = locationResponse.data;
          
          if (location?.company_id) {
            // Preia toate locațiile din compania respectivă
            const companyLocationsResponse = await firstValueFrom(
              this.httpService.get(`http://localhost:3004/locations?company_id=${location.company_id}`)
            );
            const companyLocations = companyLocationsResponse.data.locations || [];
            const locationIds = companyLocations.map((loc: any) => loc.id);
            
            if (locationIds.length > 0) {
              // Filtrează assignments-urile care au template-uri disponibile în locațiile companiei
              // Filtrează sarcinile active și finalizate doar pe ziua curentă
              const today = new Date();
              const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
              
              const result = await query
                .leftJoin('template.templateLocations', 'templateLocation')
                .where('templateLocation.idLocation IN (:...locationIds)', { locationIds })
                .andWhere('assignment.is_visible_for_employee = :visible', { visible: true })
                .andWhere(
                  '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR (assignment.status = :scheduledStatus AND assignment.scheduled_datetime IS NULL))',
                  { 
                    assignedStatus: 'assigned', 
                    completedStatus: 'completed',
                    waitingResponseStatus: 'waiting_response',
                    scheduledStatus: 'scheduled'
                  }
                )
                .andWhere(
                  '(assignment.status = :scheduledStatus OR (assignment.assigned_at >= :startOfDay AND assignment.assigned_at <= :endOfDay))',
                  { 
                    scheduledStatus: 'scheduled',
                    startOfDay: startOfDay,
                    endOfDay: endOfDay
                  }
                )
                .getMany();
              
              console.log('🔍 [assignment.service] Rezultat query company:', result.length, 'assignments')
              // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        result.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
            }
          }
        }
        
        // Dacă nu poate obține informațiile, returnează array gol
        console.log('❌ [assignment.service] Nu pot obține informațiile despre companie pentru user:', user.sub)
        return [];
      } catch (error) {
        console.error('❌ [assignment.service] Eroare la obținerea informațiilor despre companie:', error.message)
        return [];
      }
    }

    // assignment.read_all - vede toate - CEA MAI PERMISIVĂ
    if (user?.permissions?.includes('assignment.read_all')) {
      console.log('✅ [assignment.service] User are assignment.read_all - returnez toate assignment-urile')
      
      // Dacă are și assignment.create (este manager), poate vedea sarcinile invizibile
      if (user?.permissions?.includes('assignment.create')) {
        console.log('✅ [assignment.service] User este manager (are assignment.create) - poate vedea sarcinile invizibile')
        // Filtrează sarcinile active și finalizate doar pe ziua curentă pentru manageri
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        
        const result = await query
          .where(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR (assignment.status = :scheduledStatus AND assignment.scheduled_datetime IS NULL))',
            { 
              assignedStatus: 'assigned', 
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled'
            }
          )
          .andWhere(
            '(assignment.status = :scheduledStatus OR (assignment.assigned_at >= :startOfDay AND assignment.assigned_at <= :endOfDay))',
            { 
              scheduledStatus: 'scheduled',
              startOfDay: startOfDay,
              endOfDay: endOfDay
            }
          )
          .getMany();
        console.log('🔍 [assignment.service] Rezultat query all (manager):', result.length, 'assignments')
        // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        result.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
      } else {
        // Dacă nu este manager, filtrează doar sarcinile vizibile
        console.log('✅ [assignment.service] User nu este manager - filtrez doar sarcinile vizibile')
        // Filtrează sarcinile active și finalizate doar pe ziua curentă
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        
        const result = await query
          .where('assignment.is_visible_for_employee = :visible', { visible: true })
          .andWhere(
            '(assignment.status = :assignedStatus OR assignment.status = :completedStatus OR assignment.status = :waitingResponseStatus OR (assignment.status = :scheduledStatus AND assignment.scheduled_datetime IS NULL))',
            { 
              assignedStatus: 'assigned', 
              completedStatus: 'completed',
              waitingResponseStatus: 'waiting_response',
              scheduledStatus: 'scheduled'
            }
          )
          .andWhere(
            '(assignment.status = :scheduledStatus OR (assignment.assigned_at >= :startOfDay AND assignment.assigned_at <= :endOfDay))',
            { 
              scheduledStatus: 'scheduled',
              startOfDay: startOfDay,
              endOfDay: endOfDay
            }
          )
          .getMany();
        console.log('🔍 [assignment.service] Rezultat query all (angajat):', result.length, 'assignments')
        // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        result.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
      }
    }

    // Dacă nu are nicio permisiune, returnează array gol
    console.log('❌ [assignment.service] User nu are nicio permisiune pentru assignments - returnez array gol')
    return [];
  }

  /**
   * Acceptă un task și șterge complet toate celelalte taskuri din același grup de departament
   */
  async acceptTask(id: number, userId: number): Promise<TaskAssignment> {
    console.log(`🔍 [ACCEPT] ==========================================`);
    console.log(`🔍 [ACCEPT] Accepting task ${id} for user ${userId}`);
    console.log(`🔍 [ACCEPT] ==========================================`);
    console.log(`🔍 [ACCEPT] METHOD CALLED - STARTING ACCEPTANCE PROCESS`);
    
    const assignment = await this.findOne(id);
    
    if (!assignment) {
      console.log(`❌ [ACCEPT] Task assignment ${id} not found`);
      throw new Error('Task assignment not found');
    }

    console.log(`🔍 [ACCEPT] Task found:`, {
      id: assignment.id,
      status: assignment.status,
      department_group_id: assignment.department_group_id,
      assigned_to_id: assignment.assigned_to_id,
      assignment_mode: assignment.assignment_mode
    });
    console.log(`🔍 [ACCEPT] assignment_mode type:`, typeof assignment.assignment_mode);
    console.log(`🔍 [ACCEPT] assignment_mode value:`, assignment.assignment_mode);

    // Verifică dacă taskul aparține utilizatorului SAU dacă utilizatorul este manager
    // Pentru manageri, să permitem acceptarea task-urilor atribuite altor angajați
    if (assignment.assigned_to_id !== userId) {
      // Verifică dacă utilizatorul este manager prin verificarea permisiunilor
      // Aceasta va fi verificată în controller prin PermissionsGuard
      console.log(`🔍 [ACCEPT] User ${userId} accepting task assigned to ${assignment.assigned_to_id} (manager action)`);
    }

    // Verifică dacă taskul este individual sau de grup
    if (assignment.department_group_id) {
      console.log(`🔍 [ACCEPT] Accepting task ${id} from department group: ${assignment.department_group_id}`);
      console.log(`🔍 [ACCEPT] Assignment mode: ${assignment.assignment_mode}`);
      
      // Comportament diferit bazat pe assignment_mode
      if (assignment.assignment_mode === AssignmentMode.FIRST_COME_FIRST_SERVED) {
        // MODUL NOU SIMPLU: Task-ul e deja unic, doar setăm assigned_to_id
        console.log(`🔍 [ACCEPT] [FIRST_COME_FIRST_SERVED] Task unic pentru grup - doar setăm proprietarul`);
        console.log(`✅ [ACCEPT] [FIRST_COME_FIRST_SERVED] Task acceptat de ${userId} - devine proprietarul`);
      } else if (assignment.assignment_mode === AssignmentMode.EVERYONE_GETS_IT) {
        // MODUL NOU: Toți din grup păstrează taskul și îl fac individual
        console.log(`🔍 [ACCEPT] [EVERYONE_GETS_IT] Toți din grup păstrează taskul - nu se șterge nimic`);
        console.log(`✅ [ACCEPT] [EVERYONE_GETS_IT] Task acceptat, dar ceilalți din grup îl păstrează`);
      }
    } else {
      // Task individual (fără department_group_id)
      console.log(`🔍 [ACCEPT] Accepting individual task ${id} (assignment_mode: ${assignment.assignment_mode})`);
      console.log(`✅ [ACCEPT] Individual task accepted - no group logic needed`);
    }

    // Actualizează taskul acceptat la status IN_PROGRESS
    console.log(`🔍 [ACCEPT] Updating task ${id} to IN_PROGRESS...`);
    
    const updateData: any = {
      status: AssignmentStatus.IN_PROGRESS,
      updated_at: new Date()
    };
    
    // Pentru task-uri FCFS (assigned_to_id = NULL) sau când managerul acceptă task-ul altui angajat
    if (assignment.assigned_to_id === null || assignment.assigned_to_id !== userId) {
      console.log(`🔍 [ACCEPT] Assigning task to user ${userId} (previous: ${assignment.assigned_to_id})`);
      updateData.assigned_to_id = userId;
    }
    
    const updateResult = await this.assignmentRepository.update(id, updateData);

    console.log(`🔍 [ACCEPT] Update result for accepted task:`, updateResult);
    console.log(`✅ [ACCEPT] Task ${id} accepted and updated to in_progress`);

    const updatedTask = await this.findOne(id);
    console.log(`🔍 [ACCEPT] Final task status:`, {
      id: updatedTask.id,
      status: updatedTask.status,
      department_group_id: updatedTask.department_group_id
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
  async cleanupGroupTasks(departmentGroupId: string): Promise<{ cleaned: number; remaining: number }> {
    console.log(`🔍 [CLEANUP] Verific task-urile din grupul ${departmentGroupId}`);
    
    // Găsește toate task-urile din grup
    const groupTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId
      }
    });
    
    console.log(`🔍 [CLEANUP] Găsite ${groupTasks.length} task-uri în grup`);
    console.log(`🔍 [CLEANUP] Task-uri:`, groupTasks.map(t => ({ id: t.id, assigned_to_id: t.assigned_to_id, status: t.status, assignment_mode: t.assignment_mode })));
    
    if (groupTasks.length === 0) {
      return { cleaned: 0, remaining: 0 };
    }
    
    // Găsește task-urile în IN_PROGRESS (acceptate)
    const inProgressTasks = groupTasks.filter(task => task.status === AssignmentStatus.IN_PROGRESS);
    
    if (inProgressTasks.length === 0) {
      console.log(`ℹ️ [CLEANUP] Nu există task-uri acceptate în grup`);
      return { cleaned: 0, remaining: groupTasks.length };
    }
    
    // Pentru fiecare task acceptat, verifică assignment_mode și șterge celelalte dacă este FIRST_COME_FIRST_SERVED
    let cleanedCount = 0;
    
    for (const acceptedTask of inProgressTasks) {
      if (acceptedTask.assignment_mode === AssignmentMode.FIRST_COME_FIRST_SERVED) {
        console.log(`🔍 [CLEANUP] Task-ul ${acceptedTask.id} este FIRST_COME_FIRST_SERVED - șterg celelalte`);
        
        // Șterge toate celelalte task-uri din grup (nu pe cel acceptat)
        const otherTasks = groupTasks.filter(task => 
          task.id !== acceptedTask.id && 
          task.status !== AssignmentStatus.COMPLETED
        );
        
        if (otherTasks.length > 0) {
          const deleteResult = await this.assignmentRepository.delete(
            otherTasks.map(task => task.id)
          );
          cleanedCount += otherTasks.length;
          console.log(`✅ [CLEANUP] Șterse ${otherTasks.length} task-uri din grup`);
        }
      } else {
        console.log(`ℹ️ [CLEANUP] Task-ul ${acceptedTask.id} este EVERYONE_GETS_IT - nu se șterge nimic`);
      }
    }
    
    // Recalculează task-urile rămase
    const remainingTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId
      }
    });
    
    console.log(`✅ [CLEANUP] Curățare completă: ${cleanedCount} șterse, ${remainingTasks.length} rămase`);
    
    return { cleaned: cleanedCount, remaining: remainingTasks.length };
  }

  /**
   * Metodă pentru testare - verifică task-urile din grup și le curăță dacă este necesar
   * Poate fi apelată manual pentru debugging
   */
  async debugGroupTasks(departmentGroupId: string): Promise<any> {
    console.log(`🔍 [DEBUG] Verific task-urile din grupul ${departmentGroupId}`);
    
    const groupTasks = await this.assignmentRepository.find({
      where: {
        department_group_id: departmentGroupId
      }
    });
    
    console.log(`🔍 [DEBUG] Găsite ${groupTasks.length} task-uri în grup`);
    
    const result = {
      groupId: departmentGroupId,
      totalTasks: groupTasks.length,
      tasks: groupTasks.map(t => ({
        id: t.id,
        assigned_to_id: t.assigned_to_id,
        status: t.status,
        assignment_mode: t.assignment_mode,
        created_at: t.created_at
      }))
    };
    
    console.log(`🔍 [DEBUG] Rezultat:`, result);
    
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
    const hasRequiresManagerCheck = assignment.elements?.some(el => 
      el.task_element.element_type === 'requires_manager_check' && el.value === 'true'
    );

    if (!hasRequiresManagerCheck) {
      throw new Error(`Task-ul ${id} nu are requires_manager_check activat`);
    }

    // Actualizează statusul la completed
    await this.assignmentRepository.update(id, { 
      status: 'completed' as any,
      completed_at: new Date()
    });

    // Creează execuția pentru task-ul aprobat
    try {
      const executionData = {
        task_assignment_id: id,
        employee_id: assignment.assigned_to_id,
        started_at: assignment.assigned_at ? assignment.assigned_at.toISOString() : new Date().toISOString(), // Convertește Date la string
        completed_at: new Date().toISOString(),
        comment: 'Task aprobat de manager',
        answers: []
      };

      await this.executionService.create(executionData);
      console.log(`✅ [APPROVE] Execuție creată pentru task ${id} aprobat de manager ${managerId}`);
    } catch (error) {
      console.error(`❌ [APPROVE] Eroare la crearea execuției pentru task ${id}:`, error);
      // Nu aruncăm eroarea, task-ul este deja aprobat
    }

    console.log(`✅ [APPROVE] Task ${id} aprobat de manager ${managerId} și finalizat`);

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
    const hasRequiresManagerCheck = assignment.elements?.some(el => 
      el.task_element.element_type === 'requires_manager_check' && el.value === 'true'
    );

    if (!hasRequiresManagerCheck) {
      throw new Error(`Task-ul ${id} nu are requires_manager_check activat`);
    }

    // Incrementează rejecting_times și actualizează statusul la assigned
    const currentRejectingTimes = assignment.rejecting_times || 0;
    const newRejectingTimes = currentRejectingTimes + 1;
    
    await this.assignmentRepository.update(id, { 
      status: 'assigned' as any,
      completed_at: undefined,
      rejecting_times: newRejectingTimes
    });

    console.log(`✅ [REJECT] Task ${id} respins de manager ${managerId} (respingere #${newRejectingTimes}) și returnat la assigned`);

    // Returnează task-ul actualizat
    return this.findOne(id);
  }

  /**
   * Obține sarcinile întârziate pentru angajatul curent
   */
  async getOverdueTasks(user: any): Promise<TaskAssignment[]> {
    console.log('🔍 [assignment.service] getOverdueTasks - User:', user ? 'EXISTĂ' : 'LIPSEȘTE')
    if (user) {
      console.log('🔍 [assignment.service] User ID:', user.sub)
      console.log('🔍 [assignment.service] User permissions:', user.permissions)
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
      console.log('✅ [assignment.service] User are assignment.read_own - filtrez după assigned_to_id')
      
      const result = await query
        .where('assignment.assigned_to_id = :userId', { userId: user.sub })
        // assigned_to_type eliminat - toate task-urile sunt pentru persoane
        .andWhere('assignment.is_visible_for_employee = :visible', { visible: true })
        .andWhere('assignment.status != :completedStatus', { completedStatus: 'completed' })
        .getMany();

      // Filtrează sarcinile întârziate pe frontend
      const overdueTasks = result.filter(assignment => {
        // Caută elementul finish_at sau finalized_in
        const finishAtElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'finish_at'
        );
        const finalizedInElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'finalized_in'
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

      console.log('🔍 [assignment.service] Rezultat overdue tasks:', overdueTasks.length, 'assignments')
      
      // Adaugă informații despre persoane și departamente
      const enrichedResults = await Promise.all(
        overdueTasks.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
    }

    // Pentru manageri, returnează toate sarcinile întârziate
    if (user?.permissions?.includes('assignment.read_all') || user?.permissions?.includes('assignment.read_company')) {
      console.log('✅ [assignment.service] User este manager - returnez toate sarcinile întârziate')
      
      const result = await query
        .where('assignment.status != :completedStatus', { completedStatus: 'completed' })
        .getMany();

      // Filtrează sarcinile întârziate
      const overdueTasks = result.filter(assignment => {
        const finishAtElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'finish_at'
        );
        const finalizedInElement = assignment.elements?.find(el => 
          el.task_element.element_type === 'finalized_in'
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

      console.log('🔍 [assignment.service] Rezultat overdue tasks (manager):', overdueTasks.length, 'assignments')
      
      const enrichedResults = await Promise.all(
        overdueTasks.map(assignment => this.enrichAssignmentWithDetails(assignment))
      );
      return enrichedResults;
    }

    // Dacă nu are permisiuni, returnează array gol
    console.log('❌ [assignment.service] User nu are permisiuni pentru overdue tasks')
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
    const allowPostponeElement = assignment.elements?.find(el => 
      el.task_element.element_type === 'allow_postpone'
    );
    const hasAllowPostpone = allowPostponeElement && allowPostponeElement.value === 'true';

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
    try {
      // Găsește elementul allow_postpone și îl actualizează la false
      const allowPostponeElement = assignment.elements?.find(el => 
        el.task_element.element_type === 'allow_postpone'
      );
      
      if (allowPostponeElement) {
        await this.elementRepository.update(
          { id: allowPostponeElement.id },
          { value: 'false' }
        );
        console.log(`✅ [POSTPONE] Updated allow_postpone to false for task ${id}`);
      }

      // Actualizează was_postponed la true
      await this.assignmentRepository.update(id, { was_postponed: true });
      console.log(`✅ [POSTPONE] Updated was_postponed to true for task ${id}`);
    } catch (error) {
      console.error(`❌ [POSTPONE] Error updating task assignment ${id}:`, error);
      throw new Error('Failed to update task assignment');
    }

    // Nu se creează execuție pentru amânare - doar se marchează was_postponed = true
    console.log(`✅ [POSTPONE] No execution created for postponed task ${id} - only was_postponed flag set`);

    console.log(`✅ [POSTPONE] Task ${id} postponed successfully by user ${userId}`);
    console.log(`🔍 [POSTPONE] ==========================================`);

    // Returnează assignment-ul actualizat
    return await this.findOne(id);
  }
} 