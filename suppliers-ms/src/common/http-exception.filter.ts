import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    // Preserve canonical plan/quota bodies:
    // { statusCode, error, code, message, details } — do not collapse to
    // { message, error: "ForbiddenException" } which breaks FE mapping.
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const body = raw as Record<string, unknown>;
      const isPlanBusiness =
        body.error === 'SUBSCRIPTION_LIMIT_REACHED' ||
        body.error === 'PLAN_FEATURE_DENIED' ||
        body.error === 'PLAN_COMPANY_UNRESOLVED' ||
        (typeof body.code === 'string' &&
          (body.code === 'SUBSCRIPTION_LIMIT_REACHED' ||
            body.code.endsWith('_LIMIT_REACHED') ||
            String(body.code).startsWith('PLAN_')));
      // Expected plan/quota denials are business outcomes, not server faults.
      if (isPlanBusiness && status === HttpStatus.FORBIDDEN) {
        this.logger.warn(
          `[${request.method}] ${request.url} → ${status} ${String(body.code || body.error)}`,
        );
      } else {
        this.logger.error(
          `[${request.method}] ${request.url} → ${status}`,
          stack ?? raw,
        );
      }
      response.status(status).json({
        statusCode: status,
        ...body,
        // Prefer Nest object's message when present; keep other fields intact.
        message:
          typeof body.message === 'string'
            ? body.message
            : body.message ?? 'Error',
      });
      return;
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      stack ?? raw,
    );

    response.status(status).json({
      statusCode: status,
      message: raw,
      error: exception instanceof HttpException ? exception.name : 'Error',
    });
  }
}
