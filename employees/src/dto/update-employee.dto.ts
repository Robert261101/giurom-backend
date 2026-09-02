import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

/**
 * Partial update. hire_date / contract_type pot rămâne null (self-registration).
 * Empty string este normalizat în service înainte de persist (fără ValidationPipe global).
 */
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({
    description: 'Data angajării (null = necompletată)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsDateString({}, { message: 'Data angajării trebuie să fie o dată validă (YYYY-MM-DD)' })
  hire_date?: string | null;

  @ApiPropertyOptional({
    description: 'Tipul contractului (null = necompletat)',
    enum: ['permanent', 'fixed-term', 'internship'],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsIn(['permanent', 'fixed-term', 'internship'], {
    message: 'Tipul contractului trebuie să fie unul din: permanent, fixed-term, internship',
  })
  contract_type?: string | null;
}
