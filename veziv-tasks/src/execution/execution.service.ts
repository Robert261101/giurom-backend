import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { TaskExecution } from './entity/task-execution.entity';
import { TaskExecutionAnswer } from './entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { TaskAssignment, AssignmentStatus } from '../assignment/entity/task-assignment.entity';
import { TaskElement } from '../template/entity/task-element.entity';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { CreateEmployeeDailyPointsDto } from './dto/create-employee-daily-points.dto';
import { CreateEmployeeDailyTaskPointsDto } from './dto/create-employee-daily-task-points.dto';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(TaskExecution)
    private executionRepository: Repository<TaskExecution>,
    @InjectRepository(TaskExecutionAnswer)
    private answerRepository: Repository<TaskExecutionAnswer>,
    @InjectRepository(EmployeeDailyPoints)
    private employeeDailyPointsRepository: Repository<EmployeeDailyPoints>,
    @InjectRepository(EmployeeDailyTaskPoints)
    private employeeDailyTaskPointsRepository: Repository<EmployeeDailyTaskPoints>,
    @InjectRepository(TaskAssignment)
    private taskAssignmentRepository: Repository<TaskAssignment>,
    @InjectRepository(TaskElement)
    private taskElementRepository: Repository<TaskElement>,
    private httpService: HttpService,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
  ) {}

  private async sendExecutionNotification(
    type: string,
    title: string,
    description: string,
    executionId: number,
    metadata?: any
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'tasks.notification' }, {
          type,
          title,
          description,
          entity_id: executionId,
          entity_type: 'task_execution',
          metadata,
          priority: 'medium',
        })
      );
    } catch (error) {
      console.error('Failed to send execution notification:', error);
    }
  }

  async create(createExecutionDto: CreateExecutionDto): Promise<{ execution: TaskExecution; points: number; isOverdue: boolean; message: string }> {
    
    // Verifică dacă assignment-ul există
    const assignment = await this.taskAssignmentRepository.findOne({ 
      where: { id: createExecutionDto.task_assignment_id } 
    });
    
    if (!assignment) {
      throw new BadRequestException(`Assignment-ul cu ID-ul ${createExecutionDto.task_assignment_id} nu există`);
    }
    

    // Extrage answers din DTO
    const { answers, ...executionData } = createExecutionDto;
    
    // Setează employee_id cu assigned_to_id din assignment (angajatul căruia i s-a atribuit sarcina)
    executionData.employee_id = assignment.assigned_to_id;
    
    // Setează location_id din assignment pentru filtrări după locație
    if (assignment.location_id) {
      (executionData as any).location_id = assignment.location_id;
    }
    
    // Creează execuția
    const execution = this.executionRepository.create(executionData);
    const savedExecution = await this.executionRepository.save(execution);
    

    // Creează answers dacă sunt specificate
    console.log(`[ExecutionService.create] Creating execution ${savedExecution.id} with ${answers?.length || 0} answers`);
    if (answers && answers.length > 0) {
      for (const answerDto of answers) {
        console.log(`[ExecutionService.create] Processing answer for element ${answerDto.task_element_id} with value:`, answerDto.value);
        
        // Verifică dacă elementul există
        const element = await this.taskElementRepository.findOne({
          where: { id: answerDto.task_element_id }
        });
        
        if (!element) {
          console.error(`[ExecutionService.create] Element ${answerDto.task_element_id} not found`);
          throw new BadRequestException(`Elementul cu ID-ul ${answerDto.task_element_id} nu există`);
        }

        // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
        let score_awarded = answerDto.score_awarded || 0;
        
        if (element.element_type === 'scoring_boolean') {
          
          try {
            // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
            const selectedOptions = JSON.parse(answerDto.value || '[]');
            
            if (Array.isArray(selectedOptions)) {
              // Calculează punctajul total din opțiunile selectate
              const scoringOptions = element.scoring_options ? JSON.parse(element.scoring_options) : [
                { name: 'Opțiunea 1', points: 1 },
                { name: 'Opțiunea 2', points: 2 },
                { name: 'Opțiunea 3', points: 3 }
              ];
              
              score_awarded = selectedOptions.reduce((total: number, optionName: string) => {
                const option = scoringOptions.find((opt: any) => opt.name === optionName);
                const points = option ? option.points : 0;
                return total + points;
              }, 0);
            } else {
              // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
              score_awarded = 0;
            }
          } catch (error) {
            // Fallback pentru sistemul vechi true/false - nu acordăm puncte automat
            score_awarded = 0;
          }
        } else if (element.element_type === 'scoring_simple') {
          
          // Pentru scoring_simple, folosește punctele fixe din element
          // Dacă răspunsul este 'true' sau 'completed', acordă punctele
          if (answerDto.value === 'true' || answerDto.value === 'completed') {
            score_awarded = element.simple_score_points || 0;
          } else {
            score_awarded = 0;
          }
        }

        const answer = this.answerRepository.create({
          task_element_id: answerDto.task_element_id,
          value: answerDto.value || '',
          task_execution_id: savedExecution.id,
          score_awarded: score_awarded
        });
        const savedAnswer = await this.answerRepository.save(answer);
        console.log(`[ExecutionService.create] Saved answer ${savedAnswer.id} for element ${answerDto.task_element_id} with value:`, answerDto.value);
      }
      console.log(`[ExecutionService.create] Saved ${answers.length} answers for execution ${savedExecution.id}`);
    } else {
      console.log(`[ExecutionService.create] No answers to save for execution ${savedExecution.id}`);
    }

    // Returnează execuția cu relațiile
    const executionWithRelations = await this.findOne(savedExecution.id);

    // Dacă execuția este finalizată (completed_at este setat), verifică dacă are elemente cu puncte
    let points = 0;
    let isOverdue = false;
    let message = 'Sarcina a fost finalizată cu succes!';

    if (executionWithRelations.completed_at) {
      // Obține assignment-ul cu elementele pentru calculul punctajului
      const assignmentWithElements = await this.taskAssignmentRepository.findOne({
        where: { id: createExecutionDto.task_assignment_id },
        relations: ['elements', 'elements.task_element']
      });

      if (assignmentWithElements) {
        // Calculează punctajul și verifică dacă este întârziat
        const result = this.calculateTaskPoints(executionWithRelations, assignmentWithElements);
        points = result.points;
        isOverdue = result.isOverdue;

        // Generează mesajul în funcție de situație
        
        if (assignmentWithElements.was_postponed === true && points > 0) {
          message = `Sarcina a fost finalizată cu succes! Ai câștigat ${points} puncte.`;
        } else if (isOverdue && points < 0) {
          message = `S-a finalizat sarcina cu succes, dar ai pierdut ${Math.abs(points)} puncte pentru că ai depășit termenul!`;
        } else if (points > 0) {
          message = `Sarcina a fost finalizată cu succes! Ai câștigat ${points} puncte.`;
        } else if (isOverdue && points === 0) {
          message = `S-a finalizat sarcina cu succes, dar ai pierdut puncte pentru că ai depășit termenul!`;
        } else {
          message = 'Sarcina a fost finalizată cu succes!';
        }

        // Actualizează status-ul assignment-ului
        
        if (assignmentWithElements.requires_manager_check) {
          // Dacă are requires_manager_check, schimbă status-ul în waiting_response
          assignmentWithElements.status = AssignmentStatus.WAITING_RESPONSE;
        } else {
          // Dacă nu are requires_manager_check, schimbă status-ul în completed
          assignmentWithElements.status = AssignmentStatus.COMPLETED;
          assignmentWithElements.completed_at = new Date();
        }
        
        await this.taskAssignmentRepository.save(assignmentWithElements);
      }

      await this.handleTaskCompletion(executionWithRelations);
    }

    // Trimite notificare RabbitMQ pentru creare execution
    await this.sendExecutionNotification(
      'execution.created',
      'Execuție creată',
      `Execuția task-ului a fost creată${points > 0 ? ` și a primit ${points} puncte` : ''}`,
      executionWithRelations.id,
      { assignmentId: executionWithRelations.task_assignment_id, points, isOverdue }
    );

    return {
      execution: executionWithRelations,
      points,
      isOverdue,
      message
    };
  }

  async findAll(user: any, includeAssignment: boolean = true, locationId?: number): Promise<TaskExecution[]> {
    
    const query = this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .leftJoinAndSelect('answers.task_element', 'answer_task_element')
      .orderBy('execution.created_at', 'DESC');

    if (includeAssignment) {
      query
        .leftJoinAndSelect('execution.task_assignment', 'task_assignment')
        .leftJoinAndSelect('task_assignment.template', 'template')
        .leftJoinAndSelect('task_assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'element_task_element');
    }

    // Aplică filtrul după location_id dacă este furnizat
    if (locationId !== undefined) {
      query.andWhere('execution.location_id = :locationId', { locationId });
    }
    
    // Filtrare OBLIGATORIE - afișează DOAR executions cu location_id setat
    query.andWhere('execution.location_id IS NOT NULL');

    // execution.read_all - vede toate
    if (user?.permissions?.includes('execution.read_all')) {
      const result = await query.getMany();
      return result;
    }

    // execution.read_company - vede după compania din work_location
    if (user?.permissions?.includes('execution.read_company')) {
      // TODO: Implementare când avem legătura cu compania
      // Pentru read_company, managerii văd TOATE executions (inclusiv invizibile)
      const result = await query.getMany();
      return result;
    }

    // execution.read_location - vede după work_location
    if (user?.permissions?.includes('execution.read_location')) {
      // TODO: Implementare când avem legătura cu work_location
      // Pentru read_location, managerii văd TOATE executions (inclusiv invizibile)
      const result = await query.getMany();
      return result;
    }

    // execution.read_own - vede doar execuțiile lui (employee_id = user.sub)
    if (user?.permissions?.includes('execution.read_own')) {
      
      // Dacă are și assignment.create (este manager), poate vedea executions invizibile
      if (user?.permissions?.includes('assignment.create')) {
        const result = await query.getMany();
        return result;
      } else {
        // Dacă nu este manager, filtrează doar executions vizibile
        const result = await query
          .leftJoin('execution.task_assignment', 'assignment')
          .where('execution.employee_id = :userId', { userId: user.sub })
          .andWhere('assignment.is_visible_for_employee = :visible', { visible: true })
          .getMany();
        return result;
      }
    }

    // Dacă nu are nicio permisiune, returnează array gol
    return [];
  }

  async findOne(id: number): Promise<TaskExecution> {
    const execution = await this.executionRepository.findOne({
      where: { id },
      relations: ['task_assignment', 'task_assignment.template', 'task_assignment.elements', 'task_assignment.elements.task_element', 'answers', 'answers.task_element']
    });
    
    if (!execution) {
      throw new NotFoundException(`Execuția cu ID ${id} nu a fost găsită`);
    }
    
    return execution;
  }

  async getExecutionByAssignment(assignmentId: number): Promise<TaskExecution | null> {
    // Găsește execuția cea mai recentă cu răspunsuri (dacă există), altfel cea mai recentă
    console.log(`[ExecutionService.getExecutionByAssignment] Looking for executions for assignment ${assignmentId}`);
    const executions = await this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.answers', 'answers')
      .leftJoinAndSelect('answers.task_element', 'task_element')
      .where('execution.task_assignment_id = :assignmentId', { assignmentId })
      .orderBy('execution.created_at', 'DESC')
      .getMany();
    
    if (!executions || executions.length === 0) {
      return null;
    }
    
    // Log pentru debugging
    console.log(`[ExecutionService] Found ${executions.length} executions for assignment ${assignmentId}`);
    executions.forEach((exec, index) => {
      console.log(`[ExecutionService] Execution ${index + 1}: ID=${exec.id}, created_at=${exec.created_at}, answers count=${exec.answers?.length || 0}`);
    });
    
    // Verificare suplimentară: caută toate răspunsurile care ar putea fi asociate cu assignment-ul
    // prin verificarea task_element_id-urilor din template-ul assignment-ului
    const assignment = await this.taskAssignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['template', 'template.elements']
    });
    
    if (assignment && assignment.template && assignment.template.elements) {
      const templateElementIds = assignment.template.elements.map(el => el.id);
      console.log(`[ExecutionService] Assignment ${assignmentId} has template with ${templateElementIds.length} elements: ${templateElementIds.join(', ')}`);
      
      // Caută răspunsuri care au task_element_id din template-ul assignment-ului
      const allAnswersForTemplate = await this.answerRepository.find({
        where: { task_element_id: In(templateElementIds) },
        relations: ['task_element']
      });
      console.log(`[ExecutionService] Found ${allAnswersForTemplate.length} total answers for template elements`);
      
      // Grupează răspunsurile după task_execution_id
      const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
      allAnswersForTemplate.forEach(answer => {
        if (!answersByExecution.has(answer.task_execution_id)) {
          answersByExecution.set(answer.task_execution_id, []);
        }
        answersByExecution.get(answer.task_execution_id)!.push(answer);
      });
      
      console.log(`[ExecutionService] Answers grouped by execution: ${Array.from(answersByExecution.keys()).join(', ')}`);
      
      // Verifică dacă există răspunsuri pentru execuții care nu sunt în lista de execuții găsite
      for (const [execId, answers] of answersByExecution.entries()) {
        const exec = executions.find(e => e.id === execId);
        if (!exec) {
          console.log(`[ExecutionService] WARNING: Found ${answers.length} answers for execution ${execId} which is not in the executions list for assignment ${assignmentId}`);
          
          // Verifică dacă execuția există și pentru ce assignment este
          const missingExecution = await this.executionRepository.findOne({
            where: { id: execId },
            relations: ['task_assignment']
          });
          
          if (missingExecution) {
            console.log(`[ExecutionService] Execution ${execId} belongs to assignment ${missingExecution.task_assignment_id}, not ${assignmentId}`);
            
            // Dacă execuția are răspunsuri și este pentru un assignment diferit, verifică dacă ar trebui să fie inclusă
            // (poate există o problemă cu datele sau cu logica de căutare)
            if (missingExecution.task_assignment_id !== assignmentId) {
              console.log(`[ExecutionService] Execution ${execId} is for assignment ${missingExecution.task_assignment_id}, but we're looking for assignment ${assignmentId}`);
            }
          }
        } else {
          // Dacă execuția este în listă dar nu are răspunsuri încărcate, încarcă-le
          if (!exec.answers || exec.answers.length === 0) {
            exec.answers = answers;
            console.log(`[ExecutionService] Loaded ${answers.length} answers for execution ${exec.id} from template elements search`);
          }
        }
      }
    }
    
    // Verifică manual dacă există răspunsuri pentru fiecare execuție
    for (const exec of executions) {
      // Verifică dacă există răspunsuri direct în DB pentru această execuție
      const answersCount = await this.answerRepository.count({
        where: { task_execution_id: exec.id }
      });
      console.log(`[ExecutionService] Execution ${exec.id} has ${answersCount} answers in DB (direct count)`);
      
      // Verifică și prin query pentru a vedea dacă există răspunsuri
      const answersFromDB = await this.answerRepository.find({
        where: { task_execution_id: exec.id },
        relations: ['task_element']
      });
      console.log(`[ExecutionService] Execution ${exec.id} has ${answersFromDB.length} answers from find query`);
      
      // Dacă există răspunsuri în DB dar nu sunt încărcate, încarcă-le
      if (answersFromDB.length > 0) {
        exec.answers = answersFromDB;
        console.log(`[ExecutionService] Loaded ${answersFromDB.length} answers for execution ${exec.id}`);
      } else if (!exec.answers || exec.answers.length === 0) {
        // Dacă nu există răspunsuri, setează array gol explicit
        exec.answers = [];
      }
    }
    
    // Găsește prima execuție care are răspunsuri (verifică și după încărcare manuală)
    let executionWithAnswers = executions.find(exec => exec.answers && exec.answers.length > 0);
    
    // Dacă nu s-a găsit execuție cu răspunsuri în lista inițială, verifică dacă există răspunsuri
    // pentru execuții care nu sunt în listă (poate există o problemă cu task_assignment_id)
    if (!executionWithAnswers && assignment && assignment.template && assignment.template.elements) {
      const templateElementIds = assignment.template.elements.map(el => el.id);
      
      // Caută toate execuțiile care au răspunsuri pentru elementele din template
      const allAnswersForTemplate = await this.answerRepository.find({
        where: { task_element_id: In(templateElementIds) },
        relations: ['task_element', 'task_execution']
      });
      
      // Grupează răspunsurile după task_execution_id
      const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
      allAnswersForTemplate.forEach(answer => {
        if (!answersByExecution.has(answer.task_execution_id)) {
          answersByExecution.set(answer.task_execution_id, []);
        }
        answersByExecution.get(answer.task_execution_id)!.push(answer);
      });
      
      // Verifică dacă există o execuție cu răspunsuri care nu este în lista inițială
      // Sortează execuțiile după data creării (cea mai recentă primul)
      const executionsWithAnswersArray = Array.from(answersByExecution.entries())
        .map(([execId, answers]) => ({ execId, answers, count: answers.length }))
        .sort((a, b) => b.count - a.count); // Sortează după numărul de răspunsuri
      
      for (const { execId, answers } of executionsWithAnswersArray) {
        const exec = executions.find(e => e.id === execId);
        if (!exec && answers.length > 0) {
          // Găsește execuția din DB
          const foundExecution = await this.executionRepository.findOne({
            where: { id: execId },
            relations: ['task_assignment']
          });
          
          if (foundExecution) {
            console.log(`[ExecutionService] Found execution ${execId} with ${answers.length} answers, but it belongs to assignment ${foundExecution.task_assignment_id} (not ${assignmentId})`);
            
            // Dacă execuția este pentru assignment-ul curent, o adaugă în listă
            if (foundExecution.task_assignment_id === assignmentId) {
              foundExecution.answers = answers;
              executions.push(foundExecution);
              executionWithAnswers = foundExecution;
              console.log(`[ExecutionService] Added execution ${execId} to the list with ${answers.length} answers`);
              break;
            } else {
              // Dacă execuția nu este pentru assignment-ul curent, dar are răspunsuri pentru elementele din template,
              // verifică dacă ar trebui să fie asociată cu assignment-ul curent (poate există o problemă cu datele)
              console.log(`[ExecutionService] Execution ${execId} has ${answers.length} answers but is for assignment ${foundExecution.task_assignment_id}, not ${assignmentId}`);
            }
          }
        }
      }
    }
    
    // Dacă există execuție cu răspunsuri, o returnează, altfel returnează cea mai recentă
    const result = executionWithAnswers || executions[0];
    
    // Verificare finală: dacă execuția returnată nu are răspunsuri, verifică din nou în DB
    if (result && (!result.answers || result.answers.length === 0)) {
      const finalAnswersCount = await this.answerRepository.count({
        where: { task_execution_id: result.id }
      });
      console.log(`[ExecutionService] Final check: execution ${result.id} has ${finalAnswersCount} answers in DB`);
      
      if (finalAnswersCount > 0) {
        const answers = await this.answerRepository.find({
          where: { task_execution_id: result.id },
          relations: ['task_element']
        });
        result.answers = answers;
        console.log(`[ExecutionService] Final check: loaded ${answers.length} answers for execution ${result.id}`);
      } else if (assignment && assignment.template && assignment.template.elements) {
        // Dacă execuția returnată nu are răspunsuri, caută execuția cea mai recentă cu răspunsuri
        // pentru elementele din template (chiar dacă task_assignment_id nu se potrivește exact)
        const templateElementIds = assignment.template.elements.map(el => el.id);
        
        // Caută toate răspunsurile pentru elementele din template
        const allAnswersForTemplate = await this.answerRepository.find({
          where: { task_element_id: In(templateElementIds) },
          relations: ['task_element']
        });
        
        // Grupează răspunsurile după task_execution_id și sortează după numărul de răspunsuri
        const answersByExecution = new Map<number, TaskExecutionAnswer[]>();
        allAnswersForTemplate.forEach(answer => {
          if (!answersByExecution.has(answer.task_execution_id)) {
            answersByExecution.set(answer.task_execution_id, []);
          }
          answersByExecution.get(answer.task_execution_id)!.push(answer);
        });
        
        // Găsește execuția cu cele mai multe răspunsuri
        let bestExecution: TaskExecution | null = null;
        let maxAnswers = 0;
        
        for (const [execId, answers] of answersByExecution.entries()) {
          if (answers.length > maxAnswers) {
            const exec = await this.executionRepository.findOne({
              where: { id: execId }
            });
            
            if (exec) {
              // Verifică dacă execuția este recentă (creată în ultimele 24 de ore)
              const execDate = new Date(exec.created_at);
              const now = new Date();
              const hoursDiff = (now.getTime() - execDate.getTime()) / (1000 * 60 * 60);
              
              if (hoursDiff < 24) { // Execuție din ultimele 24 de ore
                bestExecution = exec;
                maxAnswers = answers.length;
                bestExecution.answers = answers;
                console.log(`[ExecutionService] Found better execution ${execId} with ${answers.length} answers (created ${hoursDiff.toFixed(2)} hours ago)`);
              }
            }
          }
        }
        
        if (bestExecution && bestExecution.answers && bestExecution.answers.length > 0) {
          console.log(`[ExecutionService] Returning execution ${bestExecution.id} with ${bestExecution.answers.length} answers instead of execution ${result.id}`);
          return bestExecution;
        }
      }
    }
    
    // Log final pentru debugging
    if (result) {
      console.log(`[ExecutionService] Returning execution ${result.id} with ${result.answers?.length || 0} answers`);
    }
    
    return result;
  }

  async update(id: number, updateExecutionDto: UpdateExecutionDto): Promise<TaskExecution> {
    const execution = await this.findOne(id);

    // Extrage answers din DTO
    const { answers, ...executionData } = updateExecutionDto;

    // Verifică dacă assignment-ul există dacă se actualizează
    if (executionData.task_assignment_id) {
      const assignment = await this.taskAssignmentRepository.findOne({ 
        where: { id: executionData.task_assignment_id } 
      });
      
      if (!assignment) {
        throw new BadRequestException(`Assignment-ul cu ID-ul ${executionData.task_assignment_id} nu există`);
      }
    }

    // Actualizează execuția
    Object.assign(execution, executionData);
    await this.executionRepository.save(execution);

    // Actualizează answers dacă sunt specificate
    if (answers) {
      // Șterge answers existente
      await this.answerRepository.delete({ task_execution_id: id });

      // Creează answers noi
      if (answers.length > 0) {
        for (const answerDto of answers) {
    // Verifică dacă elementul există
    const element = await this.taskElementRepository.findOne({
            where: { id: answerDto.task_element_id }
    });
    
    if (!element) {
            throw new BadRequestException(`Elementul cu ID-ul ${answerDto.task_element_id} nu există`);
    }

          // Folosește score_awarded din DTO sau calculează automat pentru elementele cu puncte
          let score_awarded = answerDto.score_awarded || 0;
          
          if (element.element_type === 'scoring_boolean') {
            try {
              // Încearcă să parsezi valoarea ca JSON (pentru opțiuni multiple)
              const selectedOptions = JSON.parse(answerDto.value || '[]');
              if (Array.isArray(selectedOptions)) {
                // Calculează punctajul total din opțiunile selectate
                const scoringOptions = element.scoring_options ? JSON.parse(element.scoring_options) : [
                  { name: 'Opțiunea 1', points: 1 },
                  { name: 'Opțiunea 2', points: 2 },
                  { name: 'Opțiunea 3', points: 3 }
                ];
                
                score_awarded = selectedOptions.reduce((total: number, optionName: string) => {
                  const option = scoringOptions.find((opt: any) => opt.name === optionName);
                  return total + (option ? option.points : 0);
                }, 0);
              } else {
                // Fallback pentru sistemul vechi true/false
                score_awarded = answerDto.value === 'true' ? 10 : 0;
              }
            } catch (error) {
              // Fallback pentru sistemul vechi true/false
              score_awarded = answerDto.value === 'true' ? 10 : 0;
            }
          } else if (element.element_type === 'scoring_simple') {
            // Pentru scoring_simple, folosește punctele fixe din element
            // Dacă răspunsul este 'true' sau 'completed', acordă punctele
            if (answerDto.value === 'true' || answerDto.value === 'completed') {
              score_awarded = element.simple_score_points || 0;
            } else {
              score_awarded = 0;
            }
          }
          
          const answer = this.answerRepository.create({
            task_element_id: answerDto.task_element_id,
            value: answerDto.value || '',
            task_execution_id: id,
            score_awarded: score_awarded
          });
          await this.answerRepository.save(answer);
  }
      }
    }

    // Returnează execuția actualizată
    const updatedExecution = await this.findOne(id);

    // Dacă execuția este finalizată (completed_at este setat), verifică dacă are elemente cu puncte
    if (updatedExecution.completed_at) {
      await this.handleTaskCompletion(updatedExecution);
    }

    // Trimite notificare RabbitMQ pentru actualizare execution
    await this.sendExecutionNotification(
      'execution.updated',
      'Execuție actualizată',
      `Execuția task-ului a fost actualizată`,
      updatedExecution.id,
      { assignmentId: updatedExecution.task_assignment_id, completedAt: updatedExecution.completed_at }
    );

    return updatedExecution;
  }

  async remove(id: number): Promise<void> {
    const execution = await this.findOne(id);
    
    // Gestionare puncte zilnice înainte de ștergerea execuției
    await this.handleTaskRemoval(execution);
    
    await this.executionRepository.remove(execution);
  }

  // ===== REACTIVARE EXECUȚIE (RESPINGERE ȘI REACTIVARE ASSIGNMENT) =====
  
  async reactivateExecution(executionId: number): Promise<{ message: string; executionId: number; assignmentId: number }> {
    
    // Găsește execuția
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['task_assignment']
    });

    if (!execution) {
      throw new NotFoundException(`Execuția cu ID-ul ${executionId} nu a fost găsită`);
    }


    if (!execution.task_assignment) {
      throw new BadRequestException(`Execuția nu are un assignment asociat`);
    }

    const assignment = execution.task_assignment;
    const assignmentId = assignment.id;
    const originalAssignedToId = assignment.assigned_to_id;


    // Șterge execuția (inclusiv punctele asociate)
    const executionIdToRemove = execution.id;
    await this.handleTaskRemoval(execution);
    await this.executionRepository.remove(execution);

    // Trimite notificare RabbitMQ pentru ștergere execution
    await this.sendExecutionNotification(
      'execution.deleted',
      'Execuție ștearsă',
      `Execuția task-ului a fost ștearsă`,
      executionId,
      { assignmentId }
    );

    // Reactivează assignment-ul (schimbă status-ul în 'assigned')
    assignment.status = AssignmentStatus.ASSIGNED;
    assignment.is_visible_for_employee = true; // Fă assignment-ul vizibil pentru angajat
    
    // IMPORTANT: Pentru task-urile FCFS, păstrăm assigned_to_id original pentru a evita auto-atribuirea
    // Doar pentru task-urile FCFS care au fost acceptate anterior (assigned_to_id != null)
    if (assignment.assignment_mode === 'first_come_first_served' && originalAssignedToId !== null) {
      // Nu modificăm assigned_to_id - rămâne valoarea originală
    } else if (assignment.assignment_mode === 'first_come_first_served' && originalAssignedToId === null) {
      // Pentru task-urile FCFS care nu au fost acceptate niciodată, rămâne null
    } else {
      // Pentru task-urile non-FCFS, păstrăm assigned_to_id original
    }
    
    // Incrementează numărul de respingeri
    assignment.rejecting_times = (assignment.rejecting_times || 0) + 1;
    
    await this.taskAssignmentRepository.save(assignment);

    return {
      message: 'Execuția a fost reactivată cu succes. Assignment-ul a fost reactivat.',
      executionId: executionId,
      assignmentId: assignmentId
    };
  }

  // ===== APROBARE EXECUȚIE (MARCHEAZĂ ASSIGNMENT-UL CA COMPLETED) =====
  
  async approveExecution(executionId: number, user: any): Promise<{ message: string; executionId: number; assignmentId: number; approvedBy: string }> {
    
    // Găsește execuția
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      relations: ['task_assignment']
    });

    if (!execution) {
      throw new NotFoundException(`Execuția cu ID-ul ${executionId} nu a fost găsită`);
    }


    if (!execution.task_assignment) {
      throw new BadRequestException(`Execuția nu are un assignment asociat`);
    }

    const assignment = execution.task_assignment;
    const assignmentId = assignment.id;


    // Verifică dacă assignment-ul este în waiting_response
    if (assignment.status !== AssignmentStatus.WAITING_RESPONSE) {
      throw new BadRequestException(`Assignment-ul nu așteaptă aprobare (status actual: ${assignment.status})`);
    }

    // Obține informații despre manager din microserviciul employees
    let managerName = 'Manager';
    try {
      const employeeId = user?.sub; // ID-ul managerului din JWT
      if (employeeId) {
        // Apelează microserviciul employees pentru a obține numele managerului
        const response = await fetch(`http://giurom.bitap.ro:3002/employees/${employeeId}`);
        if (response.ok) {
          const managerInfo = await response.json();
          managerName = `${managerInfo.first_name} ${managerInfo.last_name}`;
        }
      }
    } catch (error) {
      console.error(`❌ [APPROVE] Eroare la obținerea numelui managerului:`, error);
    }

    // Actualizează assignment-ul - marchează ca completed
    assignment.status = AssignmentStatus.COMPLETED;
    assignment.completed_at = new Date();
    // Salvăm informația despre cine a aprobat în câmpul notes (sau putem adăuga un câmp nou approved_by_name)
    assignment.notes = `${assignment.notes ? assignment.notes + '\n\n' : ''}✅ Aprobat de ${managerName} la ${new Date().toLocaleString('ro-RO')}`;
    
    await this.taskAssignmentRepository.save(assignment);

    return {
      message: `Execuția a fost aprobată cu succes de ${managerName}`,
      executionId: executionId,
      assignmentId: assignmentId,
      approvedBy: managerName
    };
  }

  // ===== METODĂ PENTRU GESTIONAREA ȘTERGERII TASK-URILOR CU PUNCTE =====

  private async handleTaskRemoval(execution: TaskExecution): Promise<void> {
    try {
      // Găsește toate punctele zilnice asociate cu această execuție
      const taskPoints = await this.employeeDailyTaskPointsRepository.find({
        where: { task_execution_id: execution.id },
        relations: ['employee_daily_points']
      });

      if (taskPoints.length > 0) {

        // Grupează punctele pe daily_points pentru a actualiza totalurile
        const dailyPointsMap = new Map<number, { dailyPoints: EmployeeDailyPoints; pointsToRemove: number }>();

        for (const taskPoint of taskPoints) {
          const dailyPoints = taskPoint.employee_daily_points;
          const dailyPointsId = dailyPoints.id;

          if (!dailyPointsMap.has(dailyPointsId)) {
            dailyPointsMap.set(dailyPointsId, {
              dailyPoints: dailyPoints,
              pointsToRemove: 0
            });
          }

          const entry = dailyPointsMap.get(dailyPointsId)!;
          entry.pointsToRemove += taskPoint.points_awarded;
        }

        // Actualizează totalurile pentru fiecare daily_points
        for (const [dailyPointsId, { dailyPoints, pointsToRemove }] of dailyPointsMap) {
          dailyPoints.total_points = Math.max(0, dailyPoints.total_points - pointsToRemove);
          await this.employeeDailyPointsRepository.save(dailyPoints);
          
        }

        // Șterge toate punctele zilnice pentru această execuție
        await this.employeeDailyTaskPointsRepository.delete({ task_execution_id: execution.id });
      }
    } catch (error) {
      console.error(`❌ Eroare la gestionarea ștergerii punctelor pentru execuția ${execution.id}:`, error);
      // Nu aruncăm eroarea pentru a nu bloca ștergerea execuției
    }
  }

  // ===== METODE PENTRU PUNCTAJ ZILNIC =====

  async createEmployeeDailyPoints(createDto: CreateEmployeeDailyPointsDto): Promise<EmployeeDailyPoints> {
    // Verifică dacă există deja un punctaj pentru această zi și angajat
    const existingPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: createDto.employee_id,
        work_date: new Date(createDto.work_date)
      }
    });

    if (existingPoints) {
      throw new BadRequestException(`Există deja un punctaj pentru angajatul ${createDto.employee_id} în data ${createDto.work_date}`);
    }

    const dailyPoints = this.employeeDailyPointsRepository.create({
      employee_id: createDto.employee_id,
      work_date: new Date(createDto.work_date),
      total_points: createDto.total_points || 0
    });

    return await this.employeeDailyPointsRepository.save(dailyPoints);
  }

  async getEmployeeDailyPoints(employeeId: number, workDate: string): Promise<EmployeeDailyPoints> {
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: {
        employee_id: employeeId,
        work_date: new Date(workDate)
      },
      relations: ['task_points', 'task_points.task_execution']
    });

    if (!dailyPoints) {
      throw new NotFoundException(`Nu există punctaj pentru angajatul ${employeeId} în data ${workDate}`);
    }

    return dailyPoints;
  }

  async addTaskPointsToDailyPoints(createDto: CreateEmployeeDailyTaskPointsDto): Promise<EmployeeDailyTaskPoints> {
    // Verifică dacă punctajul zilnic există
    const dailyPoints = await this.employeeDailyPointsRepository.findOne({
      where: { id: createDto.employee_daily_points_id }
    });

    if (!dailyPoints) {
      throw new BadRequestException(`Punctajul zilnic cu ID ${createDto.employee_daily_points_id} nu există`);
    }

    // Verifică dacă execuția task-ului există
    const taskExecution = await this.executionRepository.findOne({
      where: { id: createDto.task_execution_id }
    });

    if (!taskExecution) {
      throw new BadRequestException(`Execuția task-ului cu ID ${createDto.task_execution_id} nu există`);
    }

    // Verifică dacă există deja punctaj pentru această execuție
    const existingTaskPoints = await this.employeeDailyTaskPointsRepository.findOne({
      where: {
        employee_daily_points_id: createDto.employee_daily_points_id,
        task_execution_id: createDto.task_execution_id
      }
    });

    if (existingTaskPoints) {
      throw new BadRequestException(`Există deja punctaj pentru această execuție de task`);
    }

    // Creează punctajul pentru task
    const taskPoints = this.employeeDailyTaskPointsRepository.create({
      employee_daily_points_id: createDto.employee_daily_points_id,
      task_execution_id: createDto.task_execution_id,
      points_awarded: createDto.points_awarded
    });

    const savedTaskPoints = await this.employeeDailyTaskPointsRepository.save(taskPoints);

    // Actualizează punctajul total zilnic
    const totalPoints = await this.employeeDailyTaskPointsRepository
      .createQueryBuilder('taskPoints')
      .select('SUM(taskPoints.points_awarded)', 'total')
      .where('taskPoints.employee_daily_points_id = :dailyPointsId', { dailyPointsId: createDto.employee_daily_points_id })
      .getRawOne();

    dailyPoints.total_points = parseFloat(totalPoints.total) || 0;
    await this.employeeDailyPointsRepository.save(dailyPoints);

    return savedTaskPoints;
  }

  async getEmployeePointsForDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeDailyPoints[]> {
    // Normalize dates to YYYY-MM-DD format and create Date objects at midnight UTC
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    
    return await this.employeeDailyPointsRepository
      .createQueryBuilder('dailyPoints')
      .leftJoinAndSelect('dailyPoints.task_points', 'taskPoints')
      .leftJoinAndSelect('taskPoints.task_execution', 'taskExecution')
      .where('dailyPoints.employee_id = :employeeId', { employeeId })
      .andWhere('DATE(dailyPoints.work_date) >= DATE(:startDate)', { startDate: startDate })
      .andWhere('DATE(dailyPoints.work_date) <= DATE(:endDate)', { endDate: endDate })
      .orderBy('dailyPoints.work_date', 'ASC')
      .getMany();
  }

  async calculateTotalPointsForEmployee(employeeId: number, startDate: string, endDate: string): Promise<number> {
    const result = await this.employeeDailyPointsRepository
      .createQueryBuilder('dailyPoints')
      .select('SUM(dailyPoints.total_points)', 'total')
      .where('dailyPoints.employee_id = :employeeId', { employeeId })
      .andWhere('dailyPoints.work_date >= :startDate', { startDate: new Date(startDate) })
      .andWhere('dailyPoints.work_date <= :endDate', { endDate: new Date(endDate) })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  // ===== METODĂ PENTRU GESTIONAREA FINALIZĂRII TASK-URILOR CU PUNCTE =====

  private async handleTaskCompletion(execution: TaskExecution): Promise<void> {
    try {
      // Verifică dacă execuția are answers cu puncte
      if (!execution.answers || execution.answers.length === 0) {
        return; // Nu are answers, nu face nimic
      }

      // Obține assignment-ul pentru a verifica finish_at
      const assignment = await this.taskAssignmentRepository.findOne({
        where: { id: execution.task_assignment_id },
        relations: ['elements', 'elements.task_element']
      });

      if (!assignment) {
        console.error(`Assignment-ul cu ID ${execution.task_assignment_id} nu a fost găsit`);
        return;
      }

      // Calculează punctajul pentru task-ul finalizat
      const { points: totalPoints, isOverdue } = this.calculateTaskPoints(execution, assignment);

      // Obține data de lucru (ziua din completed_at)
      const workDate = new Date(execution.completed_at);
      workDate.setHours(0, 0, 0, 0); // Setează la începutul zilei

      // Verifică dacă există deja punctaj zilnic pentru această zi
      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: execution.employee_id,
          work_date: workDate
        }
      });

      // Dacă nu există, creează unul nou
      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: execution.employee_id,
          work_date: workDate,
          total_points: 0
        });
        dailyPoints = await this.employeeDailyPointsRepository.save(dailyPoints);
      }

      // Verifică dacă există deja punctaj pentru această execuție
      const existingTaskPoints = await this.employeeDailyTaskPointsRepository.findOne({
        where: {
          employee_daily_points_id: dailyPoints.id,
          task_execution_id: execution.id
        }
      });

      // Dacă nu există, adaugă punctajul pentru această execuție
      if (!existingTaskPoints) {
        const taskPoints = this.employeeDailyTaskPointsRepository.create({
          employee_daily_points_id: dailyPoints.id,
          task_execution_id: execution.id,
          points_awarded: totalPoints
        });
        await this.employeeDailyTaskPointsRepository.save(taskPoints);

        // Actualizează punctajul total zilnic
        const totalDailyPoints = await this.employeeDailyTaskPointsRepository
          .createQueryBuilder('taskPoints')
          .select('SUM(taskPoints.points_awarded)', 'total')
          .where('taskPoints.employee_daily_points_id = :dailyPointsId', { dailyPointsId: dailyPoints.id })
          .getRawOne();

        dailyPoints.total_points = parseFloat(totalDailyPoints.total) || 0;
        await this.employeeDailyPointsRepository.save(dailyPoints);

        const action = isOverdue ? 'scăzut' : 'adăugat';
        
        // ===== PUNCTAJ MANAGER =====
        // După ce s-au acordat punctele angajatului, calculează și adaugă punctele pentru manager
        await this.handleManagerPoints(execution, assignment, totalPoints, workDate);
      } else {
      }
    } catch (error) {
      console.error('❌ Eroare la procesarea finalizării task-ului cu puncte:', error);
      // Nu aruncăm eroarea pentru a nu afecta finalizarea task-ului
    }
  }

  // ===== METODĂ PENTRU PROCESAREA TASK-URILOR ÎNTÂRZIATE =====

  async processOverdueTasks(date: string): Promise<{ processedTasks: number; totalPointsDeducted: number }> {
    try {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      // Găsește toate assignment-urile care au elemente cu finish_at în ziua respectivă
      const assignments = await this.taskAssignmentRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.elements', 'elements')
        .leftJoinAndSelect('elements.task_element', 'taskElement')
        .where('taskElement.element_type = :finishAtType', { finishAtType: 'finish_at' })
        .andWhere('elements.value >= :startDate', { startDate: targetDate.toISOString() })
        .andWhere('elements.value < :endDate', { endDate: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString() })
        .andWhere('assignment.status != :completedStatus', { completedStatus: 'completed' })
        .getMany();

      let processedTasks = 0;
      let totalPointsDeducted = 0;

      for (const assignment of assignments) {
        // Verifică dacă există execuții pentru acest assignment
        const executions = await this.executionRepository.find({
          where: { task_assignment_id: assignment.id }
        });

        // Dacă nu există execuții, task-ul nu a fost început
        if (executions.length === 0) {
          const pointsDeducted = await this.deductPointsForUncompletedTask(assignment, targetDate);
          totalPointsDeducted += pointsDeducted;
          processedTasks++;
        }
      }


      return { processedTasks, totalPointsDeducted };
    } catch (error) {
      console.error('Eroare la procesarea task-urilor întârziate:', error);
      throw error;
    }
  }

  private async deductPointsForUncompletedTask(assignment: TaskAssignment, targetDate: Date): Promise<number> {
    let totalPointsDeducted = 0;

    // Pentru fiecare element cu puncte, scade punctele posibile
    for (const element of assignment.elements || []) {
      if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options ? JSON.parse(element.task_element.scoring_options) : [];
        const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
        totalPointsDeducted += totalPossiblePoints;
      }
    }

    if (totalPointsDeducted > 0) {
      // Creează sau actualizează punctajul zilnic
      let dailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: assignment.assigned_to_id,
          work_date: targetDate
        }
      });

      if (!dailyPoints) {
        dailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: assignment.assigned_to_id,
          work_date: targetDate,
          total_points: -totalPointsDeducted
        });
      } else {
        dailyPoints.total_points -= totalPointsDeducted;
      }

      await this.employeeDailyPointsRepository.save(dailyPoints);

    }

    return totalPointsDeducted;
  }

  // ===== METODĂ PENTRU CALCULAREA PUNCTAJULUI TASK-ULUI =====

  private calculateTaskPoints(execution: TaskExecution, assignment: TaskAssignment): { points: number; isOverdue: boolean } {
    let totalPoints = 0;
    let isOverdue = false;

    // Verifică dacă task-ul are deadline și dacă este finalizat în timp
    const deadlineElement = assignment.elements?.find(el => el.task_element.element_type === 'finish_at');
    const finalizedInElement = assignment.elements?.find(el => el.task_element.element_type === 'finalized_in');
    const allowPostponeElement = assignment.elements?.find(el => el.task_element.element_type === 'allow_postpone');
    
    // Verifică dacă există "permite amânarea" - dacă da, anulează efectul deadline-ului
    const hasAllowPostpone = allowPostponeElement && allowPostponeElement.value === 'true';
    
    // Verifică dacă task-ul a fost amânat
    const wasPostponed = assignment.was_postponed === true;
    
    
    if ((deadlineElement || finalizedInElement) && execution.completed_at) {
      let deadline: Date | null = null;
      
      // Verifică dacă există finish_at (deadline fix)
      if (deadlineElement && deadlineElement.value && deadlineElement.value.trim() !== '') {
        deadline = new Date(deadlineElement.value.trim());
      }
      // Altfel, verifică dacă există finalized_in (deadline calculat)
      else if (finalizedInElement && finalizedInElement.value && finalizedInElement.value.trim() !== '') {
        try {
          const durationData = JSON.parse(finalizedInElement.value.trim());
          const hours = durationData.hours || 0;
          const minutes = durationData.minutes || 0;
          
          // Calculează deadline-ul bazat pe assigned_at + durata
          deadline = new Date(assignment.assigned_at);
          deadline.setHours(deadline.getHours() + hours);
          deadline.setMinutes(deadline.getMinutes() + minutes);
          
        } catch (e) {
          deadline = null;
        }
      }
      
      if (deadline && !isNaN(deadline.getTime())) {
        const completionTime = new Date(execution.completed_at);
        
        // Verifică dacă data de finalizare este validă
        if (!isNaN(completionTime.getTime())) {
          isOverdue = completionTime > deadline;
        } else {
          isOverdue = false;
        }
      } else {
        isOverdue = false; // Nu este întârziat dacă nu există deadline
      }
    } else if (wasPostponed) {
      isOverdue = false; // Nu este întârziat dacă a fost amânat
    }

    // Găsește toate elementele cu puncte din assignment (scoring_boolean și scoring_simple)
    const scoringElements = assignment.elements?.filter(el => 
      el.task_element.element_type === 'scoring_boolean' || 
      el.task_element.element_type === 'scoring_simple'
    ) || [];
    
    // Verifică dacă toate elementele cu puncte au fost completate
    const completedScoringElements = scoringElements.filter(element => {
      const answer = execution.answers?.find(a => a.task_element_id === element.task_element_id);
      return answer && answer.score_awarded > 0;
    });


    // Calculează punctajul pentru fiecare element cu puncte
    
    for (const element of scoringElements) {
      const answer = execution.answers?.find(a => a.task_element_id === element.task_element_id);
      
      if (element.task_element.element_type === 'scoring_boolean') {
        const scoringOptions = element.task_element.scoring_options ? JSON.parse(element.task_element.scoring_options) : [];
        
        if (answer && answer.score_awarded > 0) {
          // Elementul a fost completat - adaugă punctele câștigate
          if (wasPostponed) {
            // Dacă task-ul a fost amânat, acordă doar punctele bifate efectiv (nu toate punctele)
            totalPoints += answer.score_awarded || 0;
          } else if (isOverdue) {
            // Dacă este finalizat după deadline, scade punctele din toate opțiunile
            const totalPossiblePoints = scoringOptions.reduce((sum: number, option: any) => sum + (option.points || 0), 0);
            totalPoints -= totalPossiblePoints;
          } else {
            // Punctaj normal - doar ce a fost bifat
            totalPoints += answer.score_awarded || 0;
          }
        }
        // Nu mai scădem punctele dacă nu este completat - scoring_boolean funcționează ca scoring_simple
      } else if (element.task_element.element_type === 'scoring_simple') {
        const simpleScorePoints = element.task_element.simple_score_points || 0;
        
        if (answer && answer.score_awarded > 0) {
          // Elementul a fost completat - adaugă punctele fixe
          if (wasPostponed) {
            // Dacă task-ul a fost amânat, acordă punctele maxime pentru amânare
            totalPoints += simpleScorePoints;
          } else if (isOverdue) {
            // Dacă este finalizat după deadline, scade punctele fixe
            totalPoints -= simpleScorePoints;
          } else {
            // Punctaj normal - punctele fixe
            totalPoints += simpleScorePoints;
          }
        } else {
        }
        // Nu mai scădem punctele dacă nu este completat - scoring_simple este întotdeauna bifat
      }
    }

    // Calculează punctajul pentru elementele non-scoring
    for (const answer of execution.answers) {
      const assignmentElement = assignment.elements?.find(el => el.task_element_id === answer.task_element_id);
      if (!assignmentElement) continue;

      const taskElement = assignmentElement.task_element;
      if (taskElement.element_type !== 'scoring_boolean' && taskElement.element_type !== 'scoring_simple') {
        // Pentru alte tipuri de elemente, punctaj normal
        totalPoints += answer.score_awarded || 0;
      }
    }

    return { points: totalPoints, isOverdue };
  }

  // ===== AGREGAȚI PUNCTE PE LOCAȚIE/ANGAJAT ÎNTR-UN INTERVAL =====
  async calculateTotalPointsForLocation(locationId: number, startDate?: string, endDate?: string): Promise<number> {
    const qb = this.employeeDailyTaskPointsRepository
      .createQueryBuilder('taskPoints')
      .innerJoin('taskPoints.task_execution', 'exec')
      .select('COALESCE(SUM(taskPoints.points_awarded), 0)', 'total')
      .where('exec.location_id = :locId', { locId: locationId })
      .andWhere('exec.completed_at IS NOT NULL');
    
    if (startDate && endDate) {
      const sd = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      const ed = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      qb.andWhere('exec.completed_at BETWEEN :sd AND :ed', { sd, ed });
    }
    
    const res = await qb.getRawOne<{ total: string }>();
    return parseFloat(res?.total || '0') || 0;
  }
  
  async calculatePointsByEmployeeForLocation(locationId: number, startDate?: string, endDate?: string): Promise<Array<{ employee_id: number; total_points: number }>> {
    const qb = this.employeeDailyTaskPointsRepository
      .createQueryBuilder('taskPoints')
      .innerJoin('taskPoints.task_execution', 'exec')
      .select('exec.employee_id', 'employee_id')
      .addSelect('COALESCE(SUM(taskPoints.points_awarded), 0)', 'total_points')
      .where('exec.location_id = :locId', { locId: locationId })
      .andWhere('exec.completed_at IS NOT NULL')
      .groupBy('exec.employee_id');
    
    if (startDate && endDate) {
      const sd = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      const ed = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      qb.andWhere('exec.completed_at BETWEEN :sd AND :ed', { sd, ed });
    }
    
    const rows = await qb.getRawMany<{ employee_id: string; total_points: string }>();
    return rows.map(r => ({
      employee_id: Number(r.employee_id),
      total_points: parseFloat(r.total_points || '0') || 0
    }));
  }
  // ===== METODĂ PENTRU CALCULAREA PUNCTELOR MANAGERULUI =====
  private async handleManagerPoints(execution: TaskExecution, assignment: TaskAssignment, employeePoints: number, workDate: Date): Promise<void> {
    try {
      // 1. Obține ora finalizării task-ului
      const taskCompletionTime = new Date(execution.completed_at);

      // 2. Obține locația - mai întâi din elementele task-ului
      const locationElement = assignment.elements?.find(el => 
        el.task_element?.element_type === 'work_location'
      );
      
      let locationId = locationElement?.value ? parseInt(locationElement.value) : null;
      
      // Dacă nu găsim locația din elemente, încercăm să o obținem din angajat
      if (!locationId && assignment.assigned_to_id) {
        try {
          const employeeResponse = await this.httpService.axiosRef.get(`http://giurom.bitap.ro:3002/employees/${assignment.assigned_to_id}`, {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json'
            }
          });
          const employee = employeeResponse.data;
          locationId = employee?.work_location_default_id || employee?.work_location_id;
        } catch (error) {
          console.error(`❌ Eroare la obținerea locației din angajat:`, error.message);
        }
      }

      if (!locationId) {
        return;
      }

      // 3. Obține configurația managerului pentru această locație
      const managerConfigResponse = await this.httpService.axiosRef.get(
        `http://giurom.bitap.ro:3002/locations/${locationId}/manager-config`,
        {
          headers: {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        }
      );
      
      const managerConfig = managerConfigResponse.data;

      if (!managerConfig || !managerConfig.manager_percent || managerConfig.manager_percent <= 0) {
        return;
      }

      const managerPercentage = parseFloat(String(managerConfig.manager_percent)) / 100;

      // 4. Încercă să găsești managerul prin microserviciul employees (abordare simplificată)
      let managerEmployeeId = null;
      
      try {
        // Obține toți angajații din locația respectivă
        const employeesResponse = await this.httpService.axiosRef.get(
          `http://giurom.bitap.ro:3002/employees?work_location_id=${locationId}&is_active=true`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json'
            }
          }
        );
        
        const employees = employeesResponse.data?.employees || [];
        console.log(`👔 [MANAGER POINTS] Găsiți ${employees.length} angajați în locația ${locationId}`);
        
        // Caută managerul din pontaj la momentul execuției task-ului
        try {
          // Obțin shift-urile din pontaj pentru data execuției
          const workDate = new Date(taskCompletionTime).toISOString().split('T')[0]; // YYYY-MM-DD
          console.log(`👔 [MANAGER POINTS] Caut managerul din pontaj pentru data: ${workDate}`);
          
          const shiftsResponse = await this.httpService.axiosRef.get(
            `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${locationId}&limit=1000`,
            {
              headers: {
                'x-internal-service': 'veziv-tasks',
                'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Extrage array-ul de shifts (format: { data: [...], total, page, limit })
          let allShifts: any[] = [];
          if (Array.isArray(shiftsResponse.data)) {
            allShifts = shiftsResponse.data;
          } else if (shiftsResponse.data && Array.isArray(shiftsResponse.data.data)) {
            allShifts = shiftsResponse.data.data;
          }
          
          if (allShifts.length > 0) {
            console.log(`👔 [MANAGER POINTS] Găsite ${allShifts.length} shift-uri în pontaj`);
            
            // Filtrează shift-urile pentru data respectivă
            const workDateObj = new Date(workDate);
            workDateObj.setHours(0, 0, 0, 0);
            
            const relevantShifts = allShifts.filter((shift: any) => {
              const shiftStart = new Date(shift.start_datetime);
              shiftStart.setHours(0, 0, 0, 0);
              return shiftStart.getTime() === workDateObj.getTime();
            });
            
            console.log(`👔 [MANAGER POINTS] Shift-uri relevante pentru ${workDate}: ${relevantShifts.length}`);
            
            // Log toate shift-urile relevante pentru debugging
            relevantShifts.forEach((shift: any, index: number) => {
              console.log(`👔 [MANAGER POINTS] Shift ${index + 1}: employee_id=${shift.employee_id}, department_id=${shift.department_id}`);
            });
            
            // Caută primul shift cu departamentul "Manager" prin department_id
            let managerShift = null;
            
            // Obțin toate departamentele pentru locația respectivă
            try {
              const departmentsResponse = await this.httpService.axiosRef.get(
                `http://giurom.bitap.ro:3002/locations/${locationId}/departments`,
                {
                  headers: {
                    'x-internal-service': 'veziv-tasks',
                    'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              const departments = departmentsResponse.data || [];
              console.log(`👔 [MANAGER POINTS] Găsite ${departments.length} departamente pentru locația ${locationId}`);
              
              // Log toate departamentele pentru debugging
              departments.forEach((dept: any, index: number) => {
                console.log(`👔 [MANAGER POINTS] Departament ${index + 1}: id=${dept.id}, name="${dept.name}", code="${dept.code}"`);
              });
              
              // Caută departamentul "Manager"
              const managerDepartment = departments.find((dept: any) => dept.name === 'Manager');
              
              if (managerDepartment) {
                console.log(`👔 [MANAGER POINTS] Departamentul Manager găsit: id=${managerDepartment.id}, name="${managerDepartment.name}"`);
                
                // Caută primul shift cu department_id-ul managerului
                managerShift = relevantShifts.find((shift: any) => shift.department_id === managerDepartment.id);
                
                if (managerShift) {
                  console.log(`👔 [MANAGER POINTS] Manager găsit în pontaj: employee_id ${(managerShift as any).employee_id} din departamentul "${managerDepartment.name}" pentru data ${workDate}`);
                } else {
                  console.log(`👔 [MANAGER POINTS] Nu s-a găsit niciun shift pentru departamentul Manager (id=${managerDepartment.id}) în data ${workDate}`);
                }
              } else {
                console.log(`👔 [MANAGER POINTS] Nu s-a găsit departamentul "Manager" în locația ${locationId}`);
              }
            } catch (error) {
              console.log(`⚠️ [MANAGER POINTS] Nu s-au putut obține departamentele pentru locația ${locationId}:`, error.message);
            }
            
            if (managerShift) {
              managerEmployeeId = (managerShift as any).employee_id;
              console.log(`👔 [MANAGER POINTS] Manager găsit în pontaj: employee_id ${managerEmployeeId} pentru data ${workDate}`);
            } else {
              console.log(`👔 [MANAGER POINTS] Nu s-a găsit niciun manager în pontaj pentru data ${workDate}`);
            }
          } else {
            console.log(`👔 [MANAGER POINTS] Nu s-au găsit shift-uri în pontaj pentru data ${workDate}`);
          }
        } catch (error) {
          console.log(`⚠️ [MANAGER POINTS] Eroare la căutarea managerului în pontaj:`, error.message);
        }
        
        if (!managerEmployeeId) {
          console.log(`⚠️ [MANAGER POINTS] Nu s-a găsit niciun manager în locația ${locationId}`);
          console.log(`🔍 [MANAGER POINTS] DEBUG: managerEmployeeId = ${managerEmployeeId}`);
          return;
        }
      } catch (error) {
        console.error(`❌ Eroare la căutarea managerului prin employees:`, error.message);
        return;
      }

      if (!managerEmployeeId) {
        console.log(`⚠️ [MANAGER POINTS] Nu s-a putut determina managerul pentru locația ${locationId}`);
        console.log(`🔍 [MANAGER POINTS] DEBUG: managerEmployeeId = ${managerEmployeeId}`);
        return;
      }

      // 5. Calculează punctajul managerului
      const managerPoints = employeePoints * managerPercentage;

      // 6. Creează sau actualizează punctajul zilnic pentru manager
      let managerDailyPoints = await this.employeeDailyPointsRepository.findOne({
        where: {
          employee_id: managerEmployeeId,
          work_date: workDate
        }
      });

      if (!managerDailyPoints) {
        managerDailyPoints = this.employeeDailyPointsRepository.create({
          employee_id: managerEmployeeId,
          work_date: workDate,
          total_points: 0
        });
        managerDailyPoints = await this.employeeDailyPointsRepository.save(managerDailyPoints);
      }

      // 7. Adaugă punctele pentru acest task în punctajul zilnic al managerului
      const managerTaskPoints = this.employeeDailyTaskPointsRepository.create({
        employee_daily_points_id: managerDailyPoints.id,
        task_execution_id: execution.id,
        points_awarded: managerPoints
      });
      await this.employeeDailyTaskPointsRepository.save(managerTaskPoints);

      // 8. Actualizează punctajul total zilnic al managerului
      const managerTotalDailyPoints = await this.employeeDailyTaskPointsRepository
        .createQueryBuilder('taskPoints')
        .select('SUM(taskPoints.points_awarded)', 'total')
        .where('taskPoints.employee_daily_points_id = :dailyPointsId', { dailyPointsId: managerDailyPoints.id })
        .getRawOne();

      managerDailyPoints.total_points = parseFloat(managerTotalDailyPoints.total) || 0;
      await this.employeeDailyPointsRepository.save(managerDailyPoints);

    } catch (error) {
      console.error('❌ Eroare la calcularea punctelor pentru manager:', error);
      // Nu aruncăm eroarea pentru a nu afecta procesarea angajatului
    }
  }

  // ===== METODĂ PENTRU GĂSIREA MANAGERULUI PREZENT LA UN MOMENT DAT =====
  private async findManagerAtTime(locationId: number, completionTime: Date): Promise<any> {
    try {
      // Obține toate shift-urile pentru această locație
      const shiftsResponse = await this.httpService.axiosRef.get(
        `http://giurom.bitap.ro:3016/attendance/shifts?work_location_id=${locationId}&limit=1000`,
        {
          headers: {
            'x-internal-service': 'veziv-tasks',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json'
          }
        }
      );
      
      let allShifts: any[] = [];
      if (Array.isArray(shiftsResponse.data)) {
        allShifts = shiftsResponse.data;
      } else if (shiftsResponse.data?.data) {
        allShifts = shiftsResponse.data.data;
      }


      // Filtrează shift-urile care conțin ora de finalizare
      const relevantShifts: any[] = allShifts.filter((shift: any) => {
        const startTime = new Date(shift.start_time);
        const endTime = new Date(shift.end_time);
        return startTime <= completionTime && endTime >= completionTime;
      });


      // Pentru fiecare shift relevant, verifică prezența managerului
      for (const shift of relevantShifts) {
        // Obține toate prezențele pentru acest shift
        const presencesResponse = await this.httpService.axiosRef.get(
          `http://giurom.bitap.ro:3016/attendance/presences?shift_id=${shift.id}&limit=1000`,
          {
            headers: {
              'x-internal-service': 'veziv-tasks',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json'
            }
          }
        );
        
        let presences: any[] = [];
        if (Array.isArray(presencesResponse.data)) {
          presences = presencesResponse.data;
        } else if (presencesResponse.data?.data) {
          presences = presencesResponse.data.data;
        }


        // Caută prezența managerului în acest shift
        const managerPresence = presences.find((presence: any) => {
          return presence.employee_id && 
                 presence.is_manager === true && 
                 presence.check_in_time && 
                 new Date(presence.check_in_time) <= completionTime &&
                 (!presence.check_out_time || new Date(presence.check_out_time) >= completionTime);
        });

        if (managerPresence) {
          return managerPresence;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Eroare la căutarea managerului:', error);
      return null;
    }
  }
} 