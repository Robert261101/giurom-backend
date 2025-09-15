import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository, DeepPartial } from 'typeorm';
import { ShiftChangeRequest, ShiftChangeStatus } from './entities/shift-change-request.entity';
import { CreateShiftChangeRequestDto } from './dto/create-shift-change-request.dto';
import { UpdateShiftChangeStatusDto } from './dto/update-shift-change-status.dto';
import { FilterShiftChangeRequestsDto } from './dto/filter-shift-change-requests.dto';

@Injectable()
export class ShiftChangeRequestsService {
  private readonly logger = new Logger(ShiftChangeRequestsService.name);

  constructor(
    @InjectRepository(ShiftChangeRequest)
    private readonly shiftChangeRepo: Repository<ShiftChangeRequest>,
    private readonly httpService: HttpService,
  ) {}

  // Creare cerere de schimb de tură
  async create(dto: CreateShiftChangeRequestDto, currentUserId?: number): Promise<ShiftChangeRequest> {
    this.logger.log(`Creating shift change request from employee ${dto.employee_id} to ${dto.replacement_id}`);

    // Verifică dacă angajatul există prin HTTP call
    try {
      await firstValueFrom(this.httpService.get(`http://localhost:3012/employees/${dto.employee_id}`));
    } catch (error) {
      this.logger.error(`Employee with ID ${dto.employee_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul care cere schimbul nu a fost găsit');
    }

    // Verifică dacă înlocuitorul există prin HTTP call
    try {
      await firstValueFrom(this.httpService.get(`http://localhost:3012/employees/${dto.replacement_id}`));
    } catch (error) {
      this.logger.error(`Replacement employee with ID ${dto.replacement_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul înlocuitor nu a fost găsit');
    }

    // Autorizare: angajatul poate crea cereri doar pentru sine
    if (currentUserId && currentUserId !== dto.employee_id) {
      this.logger.warn(`User ${currentUserId} attempted to create shift change request for employee ${dto.employee_id}`);
      throw new ForbiddenException('Nu poți crea cereri de schimb de tură pentru alți angajați');
    }

    // Validări pentru date
    const startDate = new Date(dto.start_datetime);
    const endDate = new Date(dto.end_datetime);
    const now = new Date();

    if (endDate <= startDate) {
      this.logger.error(`Invalid date range: start ${startDate}, end ${endDate}`);
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    if (startDate < now) {
      this.logger.error(`Start date ${startDate} is in the past`);
      throw new BadRequestException('Data de început nu poate fi în trecut');
    }

    // Verifică dacă angajatul nu încearcă să se înlocuiască pe sine
    if (dto.employee_id === dto.replacement_id) {
      this.logger.error(`Employee ${dto.employee_id} attempted to replace themselves`);
      throw new BadRequestException('Nu te poți înlocui pe tine însuți');
    }

    // Verifică suprapuneri cu alte cereri aprobate pentru același angajat
    const overlappingRequests = await this.shiftChangeRepo
      .createQueryBuilder('scr')
      .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId: dto.employee_id })
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .andWhere(
        '(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)',
        { startDate, endDate }
      )
      .getCount();

    if (overlappingRequests > 0) {
      this.logger.error(`Overlapping shift change requests found for employee ${dto.employee_id}`);
      throw new BadRequestException('Există deja o cerere de schimb aprobată în această perioadă');
    }

    // Verifică suprapuneri pentru angajatul înlocuitor
    const replacementOverlapping = await this.shiftChangeRepo
      .createQueryBuilder('scr')
      .where('(scr.employee_id = :replacementId OR scr.replacement_id = :replacementId)', { replacementId: dto.replacement_id })
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .andWhere(
        '(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)',
        { startDate, endDate }
      )
      .getCount();

    if (replacementOverlapping > 0) {
      this.logger.error(`Replacement employee ${dto.replacement_id} has overlapping approved requests`);
      throw new BadRequestException('Angajatul înlocuitor are deja o cerere aprobată în această perioadă');
    }

    // Creează cererea
    const partial: DeepPartial<ShiftChangeRequest> = {
      ...dto,
      duration_unit: (dto as any).duration_unit || 'days',
      start_datetime: startDate as any,
      end_datetime: endDate as any,
      status: ShiftChangeStatus.PENDING,
    };

    const shiftChangeRequest: ShiftChangeRequest = this.shiftChangeRepo.create(partial);

    const savedRequest: ShiftChangeRequest = await this.shiftChangeRepo.save(shiftChangeRequest);

    this.logger.log(`Shift change request ${savedRequest.id} created successfully`);
    
    return this.findOne(savedRequest.id);
  }

  // Listare cereri cu filtrare
  async findAll(filters: FilterShiftChangeRequestsDto, currentUserId?: number): Promise<ShiftChangeRequest[]> {
    this.logger.log(`Fetching shift change requests with filters: ${JSON.stringify(filters)}`);

    const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr');
      // Employee relations removed - using HTTP calls to employees microservice

    // Filtrare pe status
    if (filters.status) {
      queryBuilder.andWhere('scr.status = :status', { status: filters.status });
    }

    // Filtrare pe angajatul care cere schimbul
    if (filters.employee_id) {
      queryBuilder.andWhere('scr.employee_id = :employeeId', { employeeId: filters.employee_id });
    }

    // Filtrare pe angajatul înlocuitor
    if (filters.replacement_id) {
      queryBuilder.andWhere('scr.replacement_id = :replacementId', { replacementId: filters.replacement_id });
    }

    // Filtrare pe perioada
    if (filters.start_date && filters.end_date) {
      queryBuilder.andWhere(
        'scr.start_datetime >= :startDate AND scr.end_datetime <= :endDate',
        { startDate: new Date(filters.start_date), endDate: new Date(filters.end_date) }
      );
    } else if (filters.start_date) {
      queryBuilder.andWhere('scr.start_datetime >= :startDate', { startDate: new Date(filters.start_date) });
    } else if (filters.end_date) {
      queryBuilder.andWhere('scr.end_datetime <= :endDate', { endDate: new Date(filters.end_date) });
    }

    // Filtrare pe reviewer
    if (filters.reviewed_by_id) {
      queryBuilder.andWhere('scr.reviewed_by_id = :reviewerId', { reviewerId: filters.reviewed_by_id });
    }

    // Autorizare: angajații pot vedea doar cererile în care sunt implicați
    if (currentUserId && !this.isManager(currentUserId)) {
      queryBuilder.andWhere(
        '(scr.employee_id = :currentUserId OR scr.replacement_id = :currentUserId)',
        { currentUserId }
      );
    }

    queryBuilder.orderBy('scr.created_at', 'DESC');

    const requests = await queryBuilder.getMany();
    this.logger.log(`Found ${requests.length} shift change requests`);
    
    return requests;
  }

  // Obținere cereri în așteptare
  async findPending(currentUserId?: number): Promise<ShiftChangeRequest[]> {
    this.logger.log('Fetching pending shift change requests');
    return this.findAll({ status: ShiftChangeStatus.PENDING }, currentUserId);
  }

  // Obținere cerere specifică
  async findOne(id: number, currentUserId?: number): Promise<ShiftChangeRequest> {
    const shiftChangeRequest = await this.shiftChangeRepo.findOne({
      where: { id },
      // Employee relations removed - using HTTP calls to employees microservice
    });

    if (!shiftChangeRequest) {
      this.logger.error(`Shift change request with ID ${id} not found`);
      throw new NotFoundException('Cererea de schimb de tură nu a fost găsită');
    }

    // Autorizare: angajatul poate vedea doar cererile în care este implicat
    if (currentUserId && !this.isManager(currentUserId)) {
      const isInvolved = shiftChangeRequest.employee_id === currentUserId || 
                        shiftChangeRequest.replacement_id === currentUserId;
      
      if (!isInvolved) {
        this.logger.warn(`User ${currentUserId} attempted to access shift change request ${id} without permission`);
        throw new ForbiddenException('Nu ai permisiunea să vezi această cerere de schimb de tură');
      }
    }

    return shiftChangeRequest;
  }

  // Actualizare status cerere (aprobare/respingere)
  async updateStatus(id: number, dto: UpdateShiftChangeStatusDto, currentUserId?: number): Promise<ShiftChangeRequest> {
    this.logger.log(`Updating status of shift change request ${id} to ${dto.status} by user ${dto.reviewed_by_id}`);

    const shiftChangeRequest = await this.findOne(id);

    // Verifică dacă reviewerul există prin HTTP call
    try {
      await firstValueFrom(this.httpService.get(`http://localhost:3012/employees/${dto.reviewed_by_id}`));
    } catch (error) {
      this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found: ${error.message}`);
      throw new NotFoundException('Managerul care aprobă nu a fost găsit');
    }

    // Autorizare: doar managerii pot aproba/respinge cereri
    if (currentUserId && !this.isManager(currentUserId)) {
      this.logger.warn(`Non-manager user ${currentUserId} attempted to update shift change request status`);
      throw new ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de schimb de tură');
    }

    // Verifică dacă cererea poate fi modificată
    if (shiftChangeRequest.status !== ShiftChangeStatus.PENDING) {
      this.logger.error(`Attempted to modify shift change request ${id} with status ${shiftChangeRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi modificate');
    }

    // Permitem angajaților să-și aprobe propriile cereri de schimb de tură

    // Actualizează cererea
    const oldStatus = shiftChangeRequest.status;
    shiftChangeRequest.status = dto.status;
    shiftChangeRequest.reviewed_by_id = dto.reviewed_by_id;
    shiftChangeRequest.reviewed_at = new Date();

    // Adaugă comentariul de review dacă există
    if (dto.review_comment) {
      shiftChangeRequest.comment = shiftChangeRequest.comment 
        ? `${shiftChangeRequest.comment}\n\nDecizie manager: ${dto.review_comment}`
        : `Decizie manager: ${dto.review_comment}`;
    }

    const updatedRequest = await this.shiftChangeRepo.save(shiftChangeRequest);

    // Logare acțiune critică
    this.logger.log(
      `CRITICAL ACTION: Shift change request ${id} status changed from ${oldStatus} to ${dto.status} ` +
      `by manager ${dto.reviewed_by_id} for employee ${shiftChangeRequest.employee_id} -> ${shiftChangeRequest.replacement_id}`
    );

    return this.findOne(updatedRequest.id);
  }

  // Ștergere cerere (doar dacă este pending și de către creator)
  async remove(id: number, currentUserId?: number): Promise<void> {
    const shiftChangeRequest = await this.findOne(id, currentUserId);

    // Verifică dacă cererea poate fi ștearsă
    if (shiftChangeRequest.status !== ShiftChangeStatus.PENDING) {
      this.logger.error(`Attempted to delete shift change request ${id} with status ${shiftChangeRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi șterse');
    }

    // Autorizare: doar creatorul poate șterge cererea
    if (currentUserId && shiftChangeRequest.employee_id !== currentUserId) {
      this.logger.warn(`User ${currentUserId} attempted to delete shift change request ${id} of employee ${shiftChangeRequest.employee_id}`);
      throw new ForbiddenException('Nu poți șterge cereri de schimb de tură ale altor angajați');
    }

    await this.shiftChangeRepo.remove(shiftChangeRequest);

    this.logger.log(`Shift change request ${id} deleted by employee ${shiftChangeRequest.employee_id}`);
  }

  // Obținere statistici pentru un angajat
  async getEmployeeStats(employeeId: number, year?: number): Promise<any> {
    const currentYear = year || new Date().getFullYear();
    
    const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr')
      .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId })
      .andWhere('YEAR(scr.start_datetime) = :year', { year: currentYear });

    const totalRequests = await queryBuilder.getCount();
    
    const asRequester = await queryBuilder
      .clone()
      .andWhere('scr.employee_id = :employeeId', { employeeId })
      .getCount();

    const asReplacement = await queryBuilder
      .clone()
      .andWhere('scr.replacement_id = :employeeId', { employeeId })
      .getCount();

    const approvedRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .getCount();

    const pendingRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.PENDING })
      .getCount();

    const rejectedRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.REJECTED })
      .getCount();

    this.logger.log(`Generated stats for employee ${employeeId} for year ${currentYear}`);

    return {
      year: currentYear,
      total_requests: totalRequests,
      as_requester: asRequester,
      as_replacement: asReplacement,
      approved_requests: approvedRequests,
      pending_requests: pendingRequests,
      rejected_requests: rejectedRequests,
    };
  }

  // Helper pentru verificarea dacă utilizatorul este manager
  private async isManager(userId: number): Promise<boolean> {
    // Implementare simplificată - în realitate ar verifica rolul din baza de date
    // Pentru moment, considerăm că toți utilizatorii cu ID > 100 sunt manageri
    return userId > 100;
  }

  // Obținere cereri pentru aprobare (pentru manageri)
  async findRequestsForApproval(managerId: number): Promise<ShiftChangeRequest[]> {
    this.logger.log(`Fetching shift change requests for approval by manager ${managerId}`);

    // În implementarea reală, ar trebui să existe o relație între manager și angajați
    // Pentru moment, returnăm toate cererile pending
    return this.findAll({ status: ShiftChangeStatus.PENDING }, managerId);
  }

  // Obținere cereri pentru un anumit angajat (ca requester sau replacement)
  async findByEmployee(employeeId: number, currentUserId?: number): Promise<ShiftChangeRequest[]> {
    this.logger.log(`Fetching shift change requests for employee ${employeeId}`);

    // Autorizare: angajatul poate vedea doar propriile cereri
    if (currentUserId && !this.isManager(currentUserId) && currentUserId !== employeeId) {
      throw new ForbiddenException('Nu poți vedea cererile altor angajați');
    }

    return this.shiftChangeRepo.find({
      where: [
        { employee_id: employeeId },
        { replacement_id: employeeId }
      ],
      // Employee relations removed - using HTTP calls to employees microservice
      order: { created_at: 'DESC' },
    });
  }
}