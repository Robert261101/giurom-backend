import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Controller()
export class EmployeeMicroController {
  constructor(private readonly employeeService: EmployeeService) {}

  @MessagePattern('employees.create')
  create(@Payload() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @MessagePattern('employees.findAll')
  findAll(
    @Payload()
    payload: {
      page: number;
      limit: number;
      is_active?: boolean;
      department?: number;
      contract_type?: string;
    },
  ) {
    return this.employeeService.findAll(
      payload.page,
      payload.limit,
      payload.is_active,
      payload.department,
      payload.contract_type,
    );
  }

  @MessagePattern('employees.getStatistics')
  getStatistics() {
    return this.employeeService.getStatistics();
  }

  @MessagePattern('employees.findByEmail')
  findByEmail(@Payload() email: string) {
    return this.employeeService.findByEmail(email);
  }

  @MessagePattern('employees.findByCNP')
  findByCNP(@Payload() cnp: string) {
    return this.employeeService.findByCNP(cnp);
  }

  @MessagePattern('employees.findOne')
  findOne(@Payload() id: number) {
    return this.employeeService.findOne(id);
  }

  @MessagePattern('employees.update')
  update(
    @Payload()
    payload: { id: number; dto: UpdateEmployeeDto },
  ) {
    return this.employeeService.update(payload.id, payload.dto);
  }

  @MessagePattern('employees.toggleActive')
  toggleActive(@Payload() id: number) {
    return this.employeeService.toggleActive(id);
  }

  @MessagePattern('employees.remove')
  remove(@Payload() id: number) {
    return this.employeeService.remove(id);
  }

  // ==================== EMPLOYEE FILES PATTERNS ====================

  @MessagePattern('employees.files.create')
  createFile(@Payload() createFileDto: any) {
    return this.employeeService.createFile(createFileDto);
  }

  @MessagePattern('employees.files.findOne')
  findOneFile(@Payload() id: number) {
    return this.employeeService.findOneFile(id);
  }

  @MessagePattern('employees.files.findByEmployee')
  findFilesByEmployee(@Payload() employee_id: number) {
    return this.employeeService.findFilesByEmployee(employee_id);
  }

  @MessagePattern('employees.files.serveFile')
  serveFile(@Payload() payload: { file_id: number; forceDownload: boolean }) {
    return this.employeeService.serveFile(payload.file_id, payload.forceDownload);
  }

  @MessagePattern('employees.files.remove')
  removeFile(@Payload() id: number) {
    return this.employeeService.removeFile(id);
  }

  @MessagePattern('employees.files.findAll')
  filesFindAll(@Payload() payload: { page?: number; limit?: number; employee_id?: number; file_type?: string }) {
    return (this.employeeService as any).findAllFiles
      ? (this.employeeService as any).findAllFiles(payload.page, payload.limit, payload.employee_id, payload.file_type)
      : null;
  }

  @MessagePattern('employees.files.statistics')
  filesStatistics() {
    return (this.employeeService as any).filesStatistics
      ? (this.employeeService as any).filesStatistics()
      : null;
  }

  @MessagePattern('employees.files.findByType')
  filesFindByType(@Payload() file_type: string) {
    return (this.employeeService as any).findFilesByType
      ? (this.employeeService as any).findFilesByType(file_type)
      : null;
  }

  @MessagePattern('employees.files.update')
  filesUpdate(@Payload() payload: { id: number; dto: any }) {
    return (this.employeeService as any).updateFile
      ? (this.employeeService as any).updateFile(payload.id, payload.dto)
      : null;
  }

  @MessagePattern('employees.files.removeAllByEmployee')
  filesRemoveAllByEmployee(@Payload() employee_id: number) {
    return (this.employeeService as any).removeAllFilesByEmployee
      ? (this.employeeService as any).removeAllFilesByEmployee(employee_id)
      : null;
  }

  @MessagePattern('employees.files.validateAccess')
  filesValidateAccess(@Payload() payload: { file_id: number; employee_id?: number }) {
    return (this.employeeService as any).validateFileAccess
      ? (this.employeeService as any).validateFileAccess(payload.file_id, payload.employee_id)
      : null;
  }

  // ==================== GENERATED DOCUMENTS PATTERNS ====================

  @MessagePattern('employees.documents.create')
  createDocument(@Payload() dto: any) {
    return this.employeeService['documentsRepository'] && this.employeeService.createDocument
      ? (this.employeeService as any).createDocument(dto)
      : null;
  }

  @MessagePattern('employees.documents.findAll')
  documentsFindAll(@Payload() payload: { page: number; limit: number; employee_id?: number; status?: string; doc_id?: number }) {
    return (this.employeeService as any).documentsFindAll
      ? (this.employeeService as any).documentsFindAll(payload)
      : null;
  }

  @MessagePattern('employees.documents.findOne')
  documentFindOne(@Payload() id: number) {
    return (this.employeeService as any).documentFindOne
      ? (this.employeeService as any).documentFindOne(id)
      : null;
  }

  @MessagePattern('employees.documents.findByEmployee')
  documentsFindByEmployee(@Payload() employee_id: number) {
    return (this.employeeService as any).documentsFindByEmployee
      ? (this.employeeService as any).documentsFindByEmployee(employee_id)
      : null;
  }

  @MessagePattern('employees.documents.findByStatus')
  documentsFindByStatus(@Payload() status: string) {
    return (this.employeeService as any).documentsFindByStatus
      ? (this.employeeService as any).documentsFindByStatus(status)
      : null;
  }

  @MessagePattern('employees.documents.findByDocId')
  documentsFindByDocId(@Payload() doc_id: number) {
    return (this.employeeService as any).documentsFindByDocId
      ? (this.employeeService as any).documentsFindByDocId(doc_id)
      : null;
  }

  @MessagePattern('employees.documents.findExpired')
  documentsFindExpired() {
    return (this.employeeService as any).documentsFindExpired
      ? (this.employeeService as any).documentsFindExpired()
      : null;
  }

  @MessagePattern('employees.documents.update')
  documentsUpdate(@Payload() payload: { id: number; dto: any }) {
    return (this.employeeService as any).documentsUpdate
      ? (this.employeeService as any).documentsUpdate(payload.id, payload.dto)
      : null;
  }

  @MessagePattern('employees.documents.sign')
  documentsSign(@Payload() id: number) {
    return (this.employeeService as any).documentsSign
      ? (this.employeeService as any).documentsSign(id)
      : null;
  }

  @MessagePattern('employees.documents.cancel')
  documentsCancel(@Payload() id: number) {
    return (this.employeeService as any).documentsCancel
      ? (this.employeeService as any).documentsCancel(id)
      : null;
  }

  @MessagePattern('employees.documents.remove')
  documentsRemove(@Payload() id: number) {
    return (this.employeeService as any).documentsRemove
      ? (this.employeeService as any).documentsRemove(id)
      : null;
  }

  @MessagePattern('employees.documents.statistics')
  documentsStatistics() {
    return (this.employeeService as any).documentsStatistics
      ? (this.employeeService as any).documentsStatistics()
      : null;
  }

  // ==================== WORK LOCATION HISTORY PATTERNS ====================

  @MessagePattern('employees.workhistory.create')
  createWorkHistory(@Payload() dto: any) {
    return (this.employeeService as any).createWorkHistory
      ? (this.employeeService as any).createWorkHistory(dto)
      : null;
  }

  @MessagePattern('employees.workhistory.findAll')
  workHistoryFindAll(@Payload() payload: { page: number; limit: number; employee_id?: number; work_location_id?: number }) {
    return (this.employeeService as any).workHistoryFindAll
      ? (this.employeeService as any).workHistoryFindAll(payload)
      : null;
  }

  @MessagePattern('employees.workhistory.findOne')
  workHistoryFindOne(@Payload() id: number) {
    return (this.employeeService as any).workHistoryFindOne
      ? (this.employeeService as any).workHistoryFindOne(id)
      : null;
  }

  @MessagePattern('employees.workhistory.findByEmployee')
  workHistoryFindByEmployee(@Payload() employee_id: number) {
    return (this.employeeService as any).workHistoryFindByEmployee
      ? (this.employeeService as any).workHistoryFindByEmployee(employee_id)
      : null;
  }

  @MessagePattern('employees.workhistory.findByWorkLocation')
  workHistoryFindByWorkLocation(@Payload() work_location_id: number) {
    return (this.employeeService as any).workHistoryFindByWorkLocation
      ? (this.employeeService as any).workHistoryFindByWorkLocation(work_location_id)
      : null;
  }

  @MessagePattern('employees.workhistory.update')
  workHistoryUpdate(@Payload() payload: { id: number; dto: any }) {
    return (this.employeeService as any).workHistoryUpdate
      ? (this.employeeService as any).workHistoryUpdate(payload.id, payload.dto)
      : null;
  }

  @MessagePattern('employees.workhistory.remove')
  workHistoryRemove(@Payload() id: number) {
    return (this.employeeService as any).workHistoryRemove
      ? (this.employeeService as any).workHistoryRemove(id)
      : null;
  }

  @MessagePattern('employees.workhistory.statistics')
  workHistoryStatistics() {
    return (this.employeeService as any).workHistoryStatistics
      ? (this.employeeService as any).workHistoryStatistics()
      : null;
  }
}