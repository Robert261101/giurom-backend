import type { TenantAccessUser } from './tenant-access.types';
export declare const PLAN_COMPANY_TYPES: readonly ["client", "furnizor"];
export type PlanCompanyType = (typeof PLAN_COMPANY_TYPES)[number];
export declare const PLAN_FEATURE_KEYS: readonly ["dashboard", "comenzi", "furnizori", "clienti", "locatii", "necesar", "angajati", "pontaj", "staff_ops", "concedii", "evenimente", "sarcini", "stoc", "retetar", "rapoarte", "arunca_consuma", "incasare", "firme"];
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];
export declare function isPlanFeatureKey(value: unknown): value is PlanFeatureKey;
export declare const PLAN_LIMIT_KEYS: {
    readonly SUPPLIERS_ACCOUNT_MAX: "suppliers.account.max";
    readonly SUPPLIERS_MANUAL_MAX: "suppliers.manual.max";
    readonly LOCATIONS_MAX: "locations.max";
    readonly CLIENTS_MAX: "clients.max";
    readonly STAFF_WAREHOUSE_MAX: "staff.warehouse.max";
    readonly STAFF_DRIVER_MAX: "staff.driver.max";
};
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[keyof typeof PLAN_LIMIT_KEYS];
export declare const FREEZE_LIMIT_KEYS: readonly PlanLimitKey[];
export declare const PLAN_LIMIT_KEYS_BY_COMPANY_TYPE: Record<PlanCompanyType, readonly PlanLimitKey[]>;
export type PlanGatingMode = 'off' | 'log' | 'enforce';
export declare function resolvePlanGatingMode(raw?: string | undefined | null): PlanGatingMode;
export type CompanyPlanSnapshot = {
    company_id: number;
    company_type: PlanCompanyType;
    plan_code: string;
    plan_name: string;
    status: string;
    features: string[];
    limits: Record<string, number>;
    gating_mode: PlanGatingMode;
};
export declare const PLAN_ACCESS_ERROR_CODES: {
    readonly FEATURE_DENIED: "PLAN_FEATURE_DENIED";
    readonly LIMIT_REACHED: "SUBSCRIPTION_LIMIT_REACHED";
    readonly COMPANY_UNRESOLVED: "PLAN_COMPANY_UNRESOLVED";
    readonly RESOLUTION_FAILED: "PLAN_RESOLUTION_FAILED";
};
export type PlanAccessErrorCode = (typeof PLAN_ACCESS_ERROR_CODES)[keyof typeof PLAN_ACCESS_ERROR_CODES];
export type PlanAccessErrorBody = {
    statusCode: number;
    error: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
};
export declare class PlanAccessError extends Error {
    readonly httpStatus: number;
    readonly error: PlanAccessErrorCode;
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(input: {
        httpStatus: number;
        error: PlanAccessErrorCode;
        code?: string;
        message: string;
        details?: Record<string, unknown>;
    });
    toHttpBody(): PlanAccessErrorBody;
}
export declare function isPlanAccessError(value: unknown): value is PlanAccessError;
export declare function normalizeCompanyPlanSnapshot(companyId: number, raw: unknown): CompanyPlanSnapshot;
export declare function hasPlanFeature(snapshot: Pick<CompanyPlanSnapshot, 'features'> | null | undefined, featureKey: string): boolean;
export declare function assertPlanFeature(snapshot: CompanyPlanSnapshot, featureKey: string): void;
export declare function getPlanLimit(snapshot: Pick<CompanyPlanSnapshot, 'limits'> | null | undefined, limitKey: string): number | null;
export type PlanLimitCheck = {
    limit_key: string;
    limit: number;
    used: number;
    remaining: number;
    reached: boolean;
    over_limit: boolean;
};
export declare function describePlanLimit(snapshot: CompanyPlanSnapshot, limitKey: string, used: number): PlanLimitCheck;
export declare function assertPlanLimit(snapshot: CompanyPlanSnapshot, limitKey: string, used: number, options?: {
    code?: string;
    message?: string;
}): PlanLimitCheck;
export declare function isPlanGateExempt(user?: TenantAccessUser | null): boolean;
export declare function resolvePlanCompanyIdOrFail(user?: TenantAccessUser | null): number;
export type PlanFetchResponse = {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
};
export type PlanFetchImpl = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    signal?: AbortSignal;
}) => Promise<PlanFetchResponse>;
export type CompanyPlanClientOptions = {
    companiesUrl: string;
    serviceSecret: string;
    serviceName: string;
    cacheTtlMs?: number;
    timeoutMs?: number;
    fetchImpl?: PlanFetchImpl;
    logger?: {
        warn: (msg: string) => void;
    };
};
export type CompanyPlanClient = {
    getCompanyPlan(companyId: number, options?: {
        force?: boolean;
    }): Promise<CompanyPlanSnapshot>;
    invalidate(companyId?: number): void;
};
export declare function createCompanyPlanClient(options: CompanyPlanClientOptions): CompanyPlanClient;
export type PlanFeatureEvaluation = {
    allowed: true;
    reason: 'exempt' | 'gating_off' | 'feature_included' | 'log_only';
    snapshot?: CompanyPlanSnapshot;
} | {
    allowed: false;
    error: PlanAccessError;
};
export declare function evaluatePlanFeatureAccess(client: CompanyPlanClient, user: TenantAccessUser | null | undefined, featureKey: string, mode?: PlanGatingMode): Promise<PlanFeatureEvaluation>;
export declare function evaluatePlanLimitForCompany(client: CompanyPlanClient, companyId: number, limitKey: string, countUsed: () => Promise<number>, options?: {
    code?: string;
    message?: string;
    mode?: PlanGatingMode;
}): Promise<{
    snapshot: CompanyPlanSnapshot;
    check: PlanLimitCheck;
} | null>;
