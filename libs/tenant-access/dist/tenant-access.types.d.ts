export type TenantAccessUser = {
    company_id?: number | null;
    companyId?: number | null;
    isSuperAdmin?: boolean;
    permissions?: string[];
    roles?: string[];
    bypassAuth?: boolean;
};
export type PlatformSubscriptionAdminRequester = TenantAccessUser & {
    isSuperAdmin?: boolean;
    hasPlatformWideAccess?: boolean;
};
