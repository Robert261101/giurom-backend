"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanAccessError = exports.PLAN_ACCESS_ERROR_CODES = exports.PLAN_LIMIT_KEYS_BY_COMPANY_TYPE = exports.FREEZE_LIMIT_KEYS = exports.PLAN_LIMIT_KEYS = exports.PLAN_FEATURE_KEYS = exports.PLAN_COMPANY_TYPES = void 0;
exports.isPlanFeatureKey = isPlanFeatureKey;
exports.resolvePlanGatingMode = resolvePlanGatingMode;
exports.isPlanAccessError = isPlanAccessError;
exports.normalizeCompanyPlanSnapshot = normalizeCompanyPlanSnapshot;
exports.hasPlanFeature = hasPlanFeature;
exports.assertPlanFeature = assertPlanFeature;
exports.getPlanLimit = getPlanLimit;
exports.describePlanLimit = describePlanLimit;
exports.assertPlanLimit = assertPlanLimit;
exports.isPlanGateExempt = isPlanGateExempt;
exports.resolvePlanCompanyIdOrFail = resolvePlanCompanyIdOrFail;
exports.createCompanyPlanClient = createCompanyPlanClient;
exports.evaluatePlanFeatureAccess = evaluatePlanFeatureAccess;
exports.evaluatePlanLimitForCompany = evaluatePlanLimitForCompany;
const tenant_access_1 = require("./tenant-access");
exports.PLAN_COMPANY_TYPES = ['client', 'furnizor'];
exports.PLAN_FEATURE_KEYS = [
    'dashboard',
    'comenzi',
    'furnizori',
    'clienti',
    'locatii',
    'necesar',
    'angajati',
    'pontaj',
    'staff_ops',
    'concedii',
    'evenimente',
    'sarcini',
    'stoc',
    'retetar',
    'rapoarte',
    'arunca_consuma',
    'incasare',
    'firme',
];
function isPlanFeatureKey(value) {
    return (typeof value === 'string' &&
        exports.PLAN_FEATURE_KEYS.includes(value));
}
exports.PLAN_LIMIT_KEYS = {
    SUPPLIERS_ACCOUNT_MAX: 'suppliers.account.max',
    SUPPLIERS_MANUAL_MAX: 'suppliers.manual.max',
    LOCATIONS_MAX: 'locations.max',
    CLIENTS_MAX: 'clients.max',
    STAFF_WAREHOUSE_MAX: 'staff.warehouse.max',
    STAFF_DRIVER_MAX: 'staff.driver.max',
};
exports.FREEZE_LIMIT_KEYS = [
    exports.PLAN_LIMIT_KEYS.LOCATIONS_MAX,
    exports.PLAN_LIMIT_KEYS.CLIENTS_MAX,
    exports.PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
    exports.PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX,
];
exports.PLAN_LIMIT_KEYS_BY_COMPANY_TYPE = {
    client: [
        exports.PLAN_LIMIT_KEYS.SUPPLIERS_ACCOUNT_MAX,
        exports.PLAN_LIMIT_KEYS.SUPPLIERS_MANUAL_MAX,
        exports.PLAN_LIMIT_KEYS.LOCATIONS_MAX,
    ],
    furnizor: [
        exports.PLAN_LIMIT_KEYS.LOCATIONS_MAX,
        exports.PLAN_LIMIT_KEYS.CLIENTS_MAX,
        exports.PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
        exports.PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX,
    ],
};
function resolvePlanGatingMode(raw = process.env.PLAN_GATING_MODE) {
    const value = String(raw ?? '').toLowerCase().trim();
    if (value === 'off' || value === 'log')
        return value;
    return 'enforce';
}
exports.PLAN_ACCESS_ERROR_CODES = {
    FEATURE_DENIED: 'PLAN_FEATURE_DENIED',
    LIMIT_REACHED: 'SUBSCRIPTION_LIMIT_REACHED',
    COMPANY_UNRESOLVED: 'PLAN_COMPANY_UNRESOLVED',
    RESOLUTION_FAILED: 'PLAN_RESOLUTION_FAILED',
};
class PlanAccessError extends Error {
    constructor(input) {
        super(input.message);
        this.name = 'PlanAccessError';
        this.httpStatus = input.httpStatus;
        this.error = input.error;
        this.code = input.code || input.error;
        this.details = input.details;
    }
    toHttpBody() {
        return {
            statusCode: this.httpStatus,
            error: this.error,
            code: this.code,
            message: this.message,
            ...(this.details ? { details: this.details } : {}),
        };
    }
}
exports.PlanAccessError = PlanAccessError;
function isPlanAccessError(value) {
    return (value instanceof PlanAccessError ||
        (typeof value === 'object' &&
            value !== null &&
            value.name === 'PlanAccessError' &&
            typeof value.httpStatus === 'number'));
}
function normalizeFeatureKey(key) {
    return String(key ?? '').toLowerCase().trim();
}
function normalizeCompanyPlanSnapshot(companyId, raw) {
    const data = (raw ?? {});
    const rawType = String(data.company_type ?? '').toLowerCase().trim();
    if (rawType !== 'client' && rawType !== 'furnizor') {
        throw new PlanAccessError({
            httpStatus: 503,
            error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
            message: 'Tipul companiei nu a putut fi determinat pentru abonament',
            details: { company_id: companyId },
        });
    }
    const planCode = String(data?.plan?.code ?? data?.plan_code ?? '')
        .toLowerCase()
        .trim();
    if (!planCode) {
        throw new PlanAccessError({
            httpStatus: 503,
            error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
            message: 'Planul companiei nu a putut fi determinat',
            details: { company_id: companyId },
        });
    }
    const features = Array.isArray(data.features)
        ? Array.from(new Set(data.features
            .map(normalizeFeatureKey)
            .filter((k) => k.length > 0)))
        : [];
    const limits = {};
    if (data.limits && typeof data.limits === 'object') {
        for (const [key, value] of Object.entries(data.limits)) {
            const num = Number(value);
            if (key && Number.isFinite(num))
                limits[key] = num;
        }
    }
    return {
        company_id: companyId,
        company_type: rawType,
        plan_code: planCode,
        plan_name: String(data?.plan?.name ?? data?.plan_name ?? planCode),
        status: String(data?.status ?? 'active'),
        features,
        limits,
        gating_mode: resolvePlanGatingMode(data?.gating_mode),
    };
}
function hasPlanFeature(snapshot, featureKey) {
    if (!snapshot)
        return false;
    const key = normalizeFeatureKey(featureKey);
    return snapshot.features.some((f) => normalizeFeatureKey(f) === key);
}
function assertPlanFeature(snapshot, featureKey) {
    if (hasPlanFeature(snapshot, featureKey))
        return;
    throw new PlanAccessError({
        httpStatus: 403,
        error: exports.PLAN_ACCESS_ERROR_CODES.FEATURE_DENIED,
        message: 'Această funcționalitate nu este inclusă în planul de abonament al firmei.',
        details: {
            feature_key: normalizeFeatureKey(featureKey),
            plan_code: snapshot.plan_code,
            company_type: snapshot.company_type,
            company_id: snapshot.company_id,
        },
    });
}
function getPlanLimit(snapshot, limitKey) {
    if (!snapshot)
        return null;
    const value = snapshot.limits?.[limitKey];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function describePlanLimit(snapshot, limitKey, used) {
    const limit = getPlanLimit(snapshot, limitKey);
    if (limit == null) {
        throw new PlanAccessError({
            httpStatus: 503,
            error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
            message: `Limita ${limitKey} nu este configurată pentru planul ${snapshot.plan_code}`,
            details: { limit_key: limitKey, plan_code: snapshot.plan_code },
        });
    }
    const safeUsed = Math.max(0, Math.trunc(Number(used) || 0));
    return {
        limit_key: limitKey,
        limit,
        used: safeUsed,
        remaining: Math.max(0, limit - safeUsed),
        reached: safeUsed >= limit,
        over_limit: safeUsed > limit,
    };
}
function assertPlanLimit(snapshot, limitKey, used, options) {
    const check = describePlanLimit(snapshot, limitKey, used);
    if (!check.reached)
        return check;
    throw new PlanAccessError({
        httpStatus: 403,
        error: exports.PLAN_ACCESS_ERROR_CODES.LIMIT_REACHED,
        code: options?.code || exports.PLAN_ACCESS_ERROR_CODES.LIMIT_REACHED,
        message: options?.message || 'Ai atins limita planului actual de abonament.',
        details: {
            limit_key: limitKey,
            used: check.used,
            limit: check.limit,
            plan_code: snapshot.plan_code,
            company_id: snapshot.company_id,
        },
    });
}
function isPlanGateExempt(user) {
    if (!user)
        return false;
    if (user.bypassAuth === true)
        return true;
    if ((0, tenant_access_1.resolveJwtCompanyId)(user) != null)
        return false;
    return (0, tenant_access_1.hasPlatformWideAccess)(user);
}
function resolvePlanCompanyIdOrFail(user) {
    const companyId = (0, tenant_access_1.resolveJwtCompanyId)(user);
    if (companyId == null) {
        throw new PlanAccessError({
            httpStatus: 403,
            error: exports.PLAN_ACCESS_ERROR_CODES.COMPANY_UNRESOLVED,
            message: 'Compania utilizatorului nu a putut fi determinată; accesul la această funcționalitate este refuzat.',
        });
    }
    return companyId;
}
function createCompanyPlanClient(options) {
    const baseUrl = String(options.companiesUrl || '').replace(/\/$/, '');
    const ttl = Math.max(0, Number(options.cacheTtlMs ?? 15000));
    const timeoutMs = Math.max(500, Number(options.timeoutMs ?? 5000));
    const fetchImpl = options.fetchImpl ??
        (globalThis.fetch
            ? (url, init) => globalThis.fetch(url, init)
            : undefined);
    const cache = new Map();
    async function fetchSnapshot(companyId) {
        if (!fetchImpl) {
            throw new PlanAccessError({
                httpStatus: 503,
                error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
                message: 'Clientul HTTP pentru abonament nu este disponibil',
            });
        }
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;
        try {
            const response = await fetchImpl(`${baseUrl}/companies/internal/${companyId}/subscription`, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-internal-service': options.serviceName,
                    'x-service-secret': options.serviceSecret,
                },
                signal: controller?.signal,
            });
            if (!response.ok) {
                throw new PlanAccessError({
                    httpStatus: 503,
                    error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
                    message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
                    details: { company_id: companyId, upstream_status: response.status },
                });
            }
            const body = await response.json();
            return normalizeCompanyPlanSnapshot(companyId, body);
        }
        catch (error) {
            if (isPlanAccessError(error))
                throw error;
            const msg = error?.message || String(error);
            options.logger?.warn(`[plan-access] getCompanyPlan company=${companyId} failed: ${msg}`);
            throw new PlanAccessError({
                httpStatus: 503,
                error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
                message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
                details: { company_id: companyId },
            });
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    return {
        async getCompanyPlan(companyId, opts) {
            const cid = Number(companyId);
            if (!Number.isFinite(cid) || cid <= 0) {
                throw new PlanAccessError({
                    httpStatus: 403,
                    error: exports.PLAN_ACCESS_ERROR_CODES.COMPANY_UNRESOLVED,
                    message: 'Compania nu a putut fi determinată pentru abonament',
                });
            }
            const now = Date.now();
            const cached = cache.get(cid);
            if (!opts?.force && cached && cached.expiresAt > now) {
                return cached.value;
            }
            const value = await fetchSnapshot(cid);
            if (ttl > 0)
                cache.set(cid, { expiresAt: now + ttl, value });
            return value;
        },
        invalidate(companyId) {
            if (companyId == null) {
                cache.clear();
                return;
            }
            cache.delete(Number(companyId));
        },
    };
}
async function evaluatePlanFeatureAccess(client, user, featureKey, mode = resolvePlanGatingMode()) {
    if (mode === 'off')
        return { allowed: true, reason: 'gating_off' };
    if (isPlanGateExempt(user))
        return { allowed: true, reason: 'exempt' };
    try {
        const companyId = resolvePlanCompanyIdOrFail(user);
        const snapshot = await client.getCompanyPlan(companyId);
        assertPlanFeature(snapshot, featureKey);
        return { allowed: true, reason: 'feature_included', snapshot };
    }
    catch (error) {
        const planError = isPlanAccessError(error)
            ? error
            : new PlanAccessError({
                httpStatus: 503,
                error: exports.PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
                message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
            });
        if (mode === 'log')
            return { allowed: true, reason: 'log_only' };
        return { allowed: false, error: planError };
    }
}
async function evaluatePlanLimitForCompany(client, companyId, limitKey, countUsed, options) {
    const mode = options?.mode ?? resolvePlanGatingMode();
    if (mode === 'off')
        return null;
    const snapshot = await client.getCompanyPlan(companyId);
    const used = await countUsed();
    if (mode === 'log') {
        const check = describePlanLimit(snapshot, limitKey, used);
        return { snapshot, check };
    }
    const check = assertPlanLimit(snapshot, limitKey, used, options);
    return { snapshot, check };
}
//# sourceMappingURL=plan-access.js.map