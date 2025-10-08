import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

export async function logAction(
  httpService: HttpService,
  logger: Logger,
  action: string,
  status: 'success' | 'failure',
  userId: number,
  resource: string,
  resourceId: number,
  newValue?: any,
  oldValue?: any,
  ip_address?: string,
  user_agent?: string
) {
  try {
    const log = {
      user_id: userId,
      resource,
      action,
      status,
      resource_id: resourceId,
      new_value: newValue,
      old_value: oldValue,
      ip_address: ip_address || '0.0.0.0',
      user_agent: user_agent || 'unknown'
    };
    await firstValueFrom(httpService.post(`http://localhost:${process.env.PORT || 3021}/logs`, log));
  } catch (e) {
    logger?.debug?.('Serviciul de logging nu este disponibil');
  }
} 