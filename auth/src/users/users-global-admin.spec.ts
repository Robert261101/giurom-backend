import { describe, expect, it } from '@jest/globals';
import { hasPlatformWideAccess } from '@giurom/tenant-access';

/** Mirrors UsersService.isGlobalUsersAdmin after PR-1.1. */
function isGlobalUsersAdmin(requester?: {
  company_id?: number | null;
  isSuperAdmin?: boolean;
  roles?: string[];
  permissions?: string[];
} | null): boolean {
  if (!requester) return false;
  return hasPlatformWideAccess(requester);
}

describe('isGlobalUsersAdmin (tenant-access)', () => {
  it('tenant admin with company_id is not global', () => {
    expect(
      isGlobalUsersAdmin({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('tenant assignment.read_all with company_id is not global', () => {
    expect(
      isGlobalUsersAdmin({
        permissions: ['assignment.read_all'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('platform operator without company_id is global', () => {
    expect(
      isGlobalUsersAdmin({
        roles: ['admin'],
      }),
    ).toBe(true);
    expect(
      isGlobalUsersAdmin({
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });
});
