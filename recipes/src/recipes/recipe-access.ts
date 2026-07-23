export interface RecipeAccessRequester {
  userId?: number;
  work_location_id?: number;
  work_location_default_id?: number;
  permissions?: string[];
}

export function buildRecipeAccessRequester(user?: {
  userId?: number;
  id?: number;
  work_location_id?: number;
  work_location_default_id?: number;
  permissions?: string[];
}): RecipeAccessRequester {
  const rawId = user?.userId ?? user?.id;
  return {
    userId: Number.isFinite(Number(rawId)) ? Number(rawId) : undefined,
    work_location_id: Number.isFinite(Number(user?.work_location_id))
      ? Number(user?.work_location_id)
      : undefined,
    work_location_default_id: Number.isFinite(Number(user?.work_location_default_id))
      ? Number(user?.work_location_default_id)
      : undefined,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  };
}

/** Admin/manager cu acces company-wide — sare peste verificarea de locație. */
export function isRecipeAdminUser(permissions: string[]): boolean {
  return (
    permissions.includes('assignment.read_all') ||
    permissions.includes('assignment.read_company')
  );
}
