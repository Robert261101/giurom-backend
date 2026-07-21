import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Rezolvă id_employee (JWT sub) la user_id (users.id).
 * Auth pune în JWT sub = id_employee; notificările și room-urile WebSocket folosesc user_id.
 */
@Injectable()
export class UserResolutionService {
  constructor(private readonly httpService: HttpService) {}

  async resolveToUserId(employeeOrUserId: number): Promise<number> {
    try {
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3002';
      const res = await firstValueFrom(
        this.httpService.get(`${apiGatewayUrl}/users/employee/${employeeOrUserId}`, {
          headers: {
            'x-internal-service': 'notifications',
            'x-service-secret': process.env.SERVICE_SECRET || '',
          },
        })
      );
      const user = res.data?.data ?? res.data;
      if (user?.id) return user.id;
    } catch {
      // Dacă nu există user cu id_employee = X, presupunem că e deja user_id
    }
    return employeeOrUserId;
  }
}
