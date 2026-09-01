import { BadRequestException } from '@nestjs/common';
import { normalizeEmployeeUpdatePayload } from './normalize-employee-update.util';

describe('normalizeEmployeeUpdatePayload', () => {
  it('maps empty hire_date / contract_type to null (self-reg NULL state)', () => {
    const out = normalizeEmployeeUpdatePayload({
      first_name: 'Ion',
      hire_date: '' as any,
      contract_type: '' as any,
    });
    expect(out.first_name).toBe('Ion');
    expect(out.hire_date).toBeNull();
    expect(out.contract_type).toBeNull();
  });

  it('maps whitespace-only dates to null', () => {
    const out = normalizeEmployeeUpdatePayload({
      hire_date: '   ' as any,
      termination_date: '\t' as any,
    });
    expect(out.hire_date).toBeNull();
    expect(out.termination_date).toBeNull();
  });

  it('keeps valid hire_date and contract_type', () => {
    const out = normalizeEmployeeUpdatePayload({
      hire_date: '2024-01-15',
      contract_type: 'permanent',
    });
    expect(out.hire_date).toBe('2024-01-15');
    expect(out.contract_type).toBe('permanent');
  });

  it('rejects invalid contract_type with BadRequest (not MySQL 500)', () => {
    expect(() =>
      normalizeEmployeeUpdatePayload({ contract_type: 'full-time' as any }),
    ).toThrow(BadRequestException);
  });

  it('maps empty marital_status to null', () => {
    const out = normalizeEmployeeUpdatePayload({ marital_status: '' as any });
    expect(out.marital_status).toBeNull();
  });

  it('does not invent fields that were not in the payload', () => {
    const out = normalizeEmployeeUpdatePayload({ last_name: 'Popescu' });
    expect(out).toEqual({ last_name: 'Popescu' });
    expect('hire_date' in out).toBe(false);
    expect('contract_type' in out).toBe(false);
  });
});
