import { BadRequestException } from '@nestjs/common';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const CONTRACT_TYPES = new Set(['permanent', 'fixed-term', 'internship']);
const MARITAL_STATUSES = new Set(['single', 'married', 'other']);

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Self-registration lasă hire_date / contract_type NULL.
 * FE poate trimite "" pe dirty-diff ("" !== null) → MySQL 500 pe DATE/ENUM.
 * Normalizează empty → null; respinge enum invalid (fail-closed).
 */
export function normalizeEmployeeUpdatePayload(
  dto: UpdateEmployeeDto,
): UpdateEmployeeDto {
  const out: UpdateEmployeeDto = { ...dto };

  if ('hire_date' in out) {
    if (isBlank(out.hire_date)) {
      (out as { hire_date: null }).hire_date = null;
    }
  }

  if ('termination_date' in out) {
    if (isBlank(out.termination_date)) {
      (out as { termination_date: null }).termination_date = null;
    }
  }

  if ('contract_type' in out) {
    if (isBlank(out.contract_type)) {
      (out as { contract_type: null }).contract_type = null;
    } else if (!CONTRACT_TYPES.has(String(out.contract_type))) {
      throw new BadRequestException(
        'Tipul contractului trebuie să fie unul din: permanent, fixed-term, internship',
      );
    }
  }

  if ('marital_status' in out) {
    if (isBlank(out.marital_status)) {
      (out as { marital_status: null }).marital_status = null;
    } else if (!MARITAL_STATUSES.has(String(out.marital_status))) {
      throw new BadRequestException(
        'Starea civilă trebuie să fie una din: single, married, other',
      );
    }
  }

  return out;
}
