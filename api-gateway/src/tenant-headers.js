const jwt = require("jsonwebtoken");

const SKIP_PATH_PREFIXES = [
  "/health",
  "/api/images",
  "/auth",
  "/socket.io",
];

const INTERNAL_SERVICE_HEADER = "x-internal-service";
const INTERNAL_SECRET_HEADER = "x-service-secret";

function shouldSkipTenantValidation(url) {
  const path = (url || "").split("?")[0];
  return SKIP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isTrustedInternalCall(req) {
  const service = req.headers[INTERNAL_SERVICE_HEADER];
  const secret = req.headers[INTERNAL_SECRET_HEADER];
  const expected = process.env.SERVICE_SECRET || "";
  return Boolean(service && secret && expected && secret === expected);
}

function extractBearerToken(req) {
  const auth =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers["authorization"];
  if (!auth || typeof auth !== "string") {
    return null;
  }
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function decodeJwtPayload(token) {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    try {
      return jwt.verify(token, secret);
    } catch {
      return null;
    }
  }
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

function hasGlobalTenantBypass(payload) {
  const perms = Array.isArray(payload?.permissions) ? payload.permissions : [];
  return (
    perms.includes("assignment.read_all") ||
    payload?.isSuperAdmin === true ||
    payload?.isAdmin === true
  );
}

function hasCompanyWideAccess(payload) {
  const perms = Array.isArray(payload?.permissions) ? payload.permissions : [];
  return perms.includes("assignment.read_company");
}

function normalizeHeaderId(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Validează header-ele tenant trimise de client față de JWT.
 * Respinge spoofing-ul x-company-id / x-work-location-id / x-user-id.
 */
function tenantHeadersMiddleware(req, res, next) {
  const url = req.originalUrl || req.url || "";

  if (shouldSkipTenantValidation(url) || isTrustedInternalCall(req)) {
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") {
    return next();
  }

  if (hasGlobalTenantBypass(payload)) {
    return next();
  }

  const jwtCompanyId = normalizeHeaderId(payload.company_id);
  const jwtLocationId = normalizeHeaderId(
    payload.work_location_id ?? payload.work_location_default_id,
  );

  const clientCompanyId = normalizeHeaderId(req.headers["x-company-id"]);
  const clientLocationId = normalizeHeaderId(req.headers["x-work-location-id"]);

  if (
    clientCompanyId != null &&
    jwtCompanyId != null &&
    clientCompanyId !== jwtCompanyId
  ) {
    return res.status(403).json({
      error: "Forbidden",
      message: "x-company-id nu corespunde tokenului de autentificare",
    });
  }

  if (
    clientLocationId != null &&
    jwtLocationId != null &&
    clientLocationId !== jwtLocationId &&
    !hasCompanyWideAccess(payload)
  ) {
    return res.status(403).json({
      error: "Forbidden",
      message: "x-work-location-id nu corespunde tokenului de autentificare",
    });
  }

  // x-user-id controlat de client — nu îl propagăm; serviciile folosesc JWT sub
  delete req.headers["x-user-id"];

  next();
}

module.exports = { tenantHeadersMiddleware };
