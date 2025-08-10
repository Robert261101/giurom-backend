import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EmployeeService } from '@/employee/employee.service';
import { CreateEmployeeDto } from '@/employee/dto/create-employee.dto';
import { UpdateEmployeeDto } from '@/employee/dto/update-employee.dto';

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
}