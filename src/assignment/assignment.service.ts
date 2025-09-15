import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TaskAssignment, AssignmentStatus } from './entity/task-assignment.entity';
import { TaskAssignmentElement } from './entity/task-assignment-element.entity';
import { TaskTemplate } from '../template/entity/task-template.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

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
  ) {}

  async create(createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    console.log('🔍 [AssignmentService] CreateAssignmentDto primit:', createAssignmentDto);
    console.log('🔍 [AssignmentService] scheduled_datetime primit:', createAssignmentDto.scheduled_datetime);
    
    // Determină statusul în funcție de scheduled_datetime
    let status = createAssignmentDto.status;
    if (createAssignmentDto.scheduled_datetime) {
      const scheduledDate = new Date(createAssignmentDto.scheduled_datetime);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      scheduledDate.setHours(0, 0, 0, 0);
      
      console.log('🔍 [AssignmentService] scheduledDate:', scheduledDate);
      console.log('🔍 [AssignmentService] today:', today);
      console.log('🔍 [AssignmentService] scheduledDate > today:', scheduledDate > today);
      
      // Dacă data programată este în viitor, setează statusul ca SCHEDULED
      if (scheduledDate > today) {
        status = 'scheduled' as any;
        console.log('🔍 [AssignmentService] Status schimbat la SCHEDULED');
      }
    }

    // Creează assignment-ul
    const assignment = this.assignmentRepository.create({
      template_id: createAssignmentDto.template_id,
      assigned_to_type: createAssignmentDto.assigned_to_type,
      assigned_to_id: createAssignmentDto.assigned_to_id,
      created_by_employee_id: createAssignmentDto.created_by_employee_id,
      total_score: createAssignmentDto.total_score,
      status: status,
      priority: createAssignmentDto.priority,
      assigned_at: new Date(createAssignmentDto.assigned_at),
      due_date: new Date(createAssignmentDto.due_date),
      scheduled_datetime: createAssignmentDto.scheduled_datetime ? new Date(createAssignmentDto.scheduled_datetime) : null,
      notes: createAssignmentDto.notes,
      requires_manager_check: createAssignmentDto.requires_manager_check,
      department_group_id: createAssignmentDto.department_group_id,
    });
    
    console.log('🔍 [AssignmentService] Assignment creat pentru salvare:', assignment);
    console.log('🔍 [AssignmentService] scheduled_datetime în assignment:', assignment.scheduled_datetime);
    console.log('🔍 [AssignmentService] scheduled_datetime type:', typeof assignment.scheduled_datetime);
    
    const savedAssignment: TaskAssignment = await this.assignmentRepository.save(assignment);
    
    console.log('🔍 [AssignmentService] Assignment salvat:', savedAssignment);
    console.log('🔍 [AssignmentService] scheduled_datetime în savedAssignment:', savedAssignment.scheduled_datetime);
    console.log('🔍 [AssignmentService] scheduled_datetime type în savedAssignment:', typeof savedAssignment.scheduled_datetime);
    
    // Verifică din nou din baza de date
    const dbAssignment = await this.assignmentRepository.findOne({
      where: { id: savedAssignment.id }
    });
    console.log('🔍 [AssignmentService] Assignment din DB:', dbAssignment);
    console.log('🔍 [AssignmentService] scheduled_datetime din DB:', dbAssignment?.scheduled_datetime);
    console.log('🔍 [AssignmentService] scheduled_datetime type din DB:', typeof dbAssignment?.scheduled_datetime);
    
    // Verifică direct cu query raw
    const rawResult = await this.assignmentRepository.query(
      'SELECT id, scheduled_datetime FROM Task_Assignment WHERE id = ?',
      [savedAssignment.id]
    );
    console.log('🔍 [AssignmentService] Raw query result:', rawResult);

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
        'id', 'template_id', 'assigned_to_type', 'assigned_to_id', 'created_by_employee_id',
        'total_score', 'status', 'priority', 'assigned_at', 'due_date', 'completed_at',
        'scheduled_datetime', 'notes', 'requires_manager_check', 'department_group_id',
        'created_at', 'updated_at'
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

    console.log('🔍 DEBUG findOne - department_group_id:', assignment.department_group_id);
    console.log('🔍 DEBUG findOne - status:', assignment.status);
    console.log('🔍 DEBUG findOne - assigned_to_id:', assignment.assigned_to_id);
    return assignment;
  }

  async update(id: number, updateAssignmentDto: UpdateAssignmentDto): Promise<TaskAssignment> {
    const assignment = await this.findOne(id);

    // Actualizează câmpurile de bază ale assignment-ului
    const updateData: any = {};
    
    if (updateAssignmentDto.template_id !== undefined) updateData.template_id = updateAssignmentDto.template_id;
    if (updateAssignmentDto.assigned_to_type !== undefined) updateData.assigned_to_type = updateAssignmentDto.assigned_to_type;
    if (updateAssignmentDto.assigned_to_id !== undefined) updateData.assigned_to_id = updateAssignmentDto.assigned_to_id;
    if (updateAssignmentDto.total_score !== undefined) updateData.total_score = updateAssignmentDto.total_score;
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
        'assignment.assigned_to_type',
        'assignment.assigned_to_id',
        'assignment.created_by_employee_id',
        'assignment.total_score',
        'assignment.status',
        'assignment.priority',
        'assignment.assigned_at',
        'assignment.due_date',
        'assignment.completed_at',
        'assignment.scheduled_datetime',
        'assignment.notes',
        'assignment.requires_manager_check',
        'assignment.department_group_id',
        'assignment.created_at',
        'assignment.updated_at'
      ])
      .orderBy('assignment.created_at', 'DESC');

    // assignment.read_own - vede doar taskurile lui (assigned_to_id = user.sub) - CEA MAI RESTRICTIVĂ
    if (user?.permissions?.includes('assignment.read_own')) {
      console.log('✅ [assignment.service] User are assignment.read_own - filtrez după assigned_to_id')
      const result = await query
        .where('assignment.assigned_to_id = :userId', { userId: user.sub })
        .andWhere('assignment.assigned_to_type = :type', { type: 'person' })
        .getMany();
      console.log('🔍 [assignment.service] Rezultat query own:', result.length, 'assignments')
      return result;
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
          const result = await query
            .leftJoin('template.templateLocations', 'templateLocation')
            .where('templateLocation.idLocation = :locationId', { locationId: employee.work_location_default_id })
            .getMany();
          
          console.log('🔍 [assignment.service] Rezultat query location:', result.length, 'assignments')
          return result;
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
              const result = await query
                .leftJoin('template.templateLocations', 'templateLocation')
                .where('templateLocation.idLocation IN (:...locationIds)', { locationIds })
                .getMany();
              
              console.log('🔍 [assignment.service] Rezultat query company:', result.length, 'assignments')
              return result;
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
      const result = await query.getMany();
      console.log('🔍 [assignment.service] Rezultat query all:', result.length, 'assignments')
      if (result.length > 0) {
        console.log('🔍 [assignment.service] Primul assignment:', result[0])
        console.log('🔍 [assignment.service] scheduled_datetime din primul assignment:', result[0].scheduled_datetime)
      }
      return result;
    }

    // Dacă nu are nicio permisiune, returnează array gol
    console.log('❌ [assignment.service] User nu are nicio permisiune pentru assignments - returnez array gol')
    return [];
  }

  /**
   * Acceptă un task și șterge complet toate celelalte taskuri din același grup de departament
   */
  async acceptTask(id: number, userId: number): Promise<TaskAssignment> {
    console.log(`🔍 Accepting task ${id} for user ${userId}`);
    
    const assignment = await this.findOne(id);
    
    if (!assignment) {
      console.log(`❌ Task assignment ${id} not found`);
      throw new Error('Task assignment not found');
    }

    console.log(`🔍 Task found:`, {
      id: assignment.id,
      status: assignment.status,
      department_group_id: assignment.department_group_id,
      assigned_to_id: assignment.assigned_to_id
    });

    // Verifică dacă taskul aparține utilizatorului
    if (assignment.assigned_to_id !== userId) {
      console.log(`❌ User ${userId} cannot accept task assigned to ${assignment.assigned_to_id}`);
      throw new Error('You can only accept tasks assigned to you');
    }

    // Verifică dacă taskul are department_group_id (este parte dintr-un grup de departament)
    if (assignment.department_group_id) {
      console.log(`🔍 Accepting task ${id} from department group: ${assignment.department_group_id}`);
      
      // Găsește toate taskurile din același grup
      console.log(`🔍 Searching for tasks with department_group_id: "${assignment.department_group_id}" and status: assigned or scheduled`);
      
      const groupTasks = await this.assignmentRepository.find({
        where: {
          department_group_id: assignment.department_group_id,
          status: In([AssignmentStatus.ASSIGNED, AssignmentStatus.SCHEDULED]) // Taskurile active și programate
        }
      });
      
      // Să verificăm și toate taskurile cu acel department_group_id, indiferent de status
      const allGroupTasks = await this.assignmentRepository.find({
        where: {
          department_group_id: assignment.department_group_id
        }
      });
      
      console.log(`🔍 All tasks in department group (any status):`, allGroupTasks.map(t => ({ id: t.id, status: t.status, assigned_to_id: t.assigned_to_id })));

      console.log(`🔍 Found ${groupTasks.length} tasks in department group:`, groupTasks.map(t => ({ id: t.id, status: t.status, assigned_to_id: t.assigned_to_id })));

      // Șterge complet toate celelalte taskuri din grup (nu pe cel acceptat)
      const otherTasks = groupTasks.filter(task => task.id !== id);
      console.log(`🔍 Other tasks to delete:`, otherTasks.map(t => ({ id: t.id, assigned_to_id: t.assigned_to_id })));
      
      if (otherTasks.length > 0) {
        // Șterge complet celelalte taskuri din grup
        const deleteResult = await this.assignmentRepository.delete(
          otherTasks.map(task => task.id)
        );
        
        console.log(`🔍 Delete result:`, deleteResult);
        console.log(`✅ Deleted ${otherTasks.length} other tasks from the group`);
      } else {
        console.log(`🔍 No other tasks to delete`);
      }
    }

    // Actualizează taskul acceptat la status IN_PROGRESS
    const updateResult = await this.assignmentRepository.update(id, { 
      status: AssignmentStatus.IN_PROGRESS,
      updated_at: new Date()
    });

    console.log(`🔍 Update result for accepted task:`, updateResult);
    console.log(`✅ Task ${id} accepted and updated to in_progress`);

    const updatedTask = await this.findOne(id);
    console.log(`🔍 Final task status:`, {
      id: updatedTask.id,
      status: updatedTask.status,
      department_group_id: updatedTask.department_group_id
    });

    return updatedTask;
  }
} 