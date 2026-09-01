export declare class TenantScopeViolationError extends Error {
    readonly code = "TENANT_SCOPE_VIOLATION";
    constructor(message: string);
}
