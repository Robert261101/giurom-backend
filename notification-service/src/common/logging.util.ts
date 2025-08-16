import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';

export async function logAction(
  httpService: HttpService,
  logger: Logger,
  action: string,
  status: string,
  user_id: number,
  resource: string,
  resource_id: number,
  new_value?: any,
  old_value?: any,
  ip_address?: string,
  user_agent?: string,
) {
  const log = {
    user_id,
    resource,
    action,
    resource_id,
    status,
    new_value,
    old_value,
    ip_address,
    user_agent,
  };
  try {
    await httpService.post('http://localhost:3010/logs', log).toPromise();
  } catch (e) {
    logger.warn(`Logging eșuat pentru ${action}: ${e.message}`);
  }
} 