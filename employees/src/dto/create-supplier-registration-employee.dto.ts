import { OmitType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

/**
 * Payload pentru employee creat automat la înregistrarea unui furnizor.
 * Nu include hire_date / contract_type (coloanele DB sunt nullable).
 * Nu trebuie folosit pe endpoint-ul public POST /employees.
 */
export class CreateSupplierRegistrationEmployeeDto extends OmitType(
  CreateEmployeeDto,
  ['hire_date', 'contract_type'] as const,
) {}
