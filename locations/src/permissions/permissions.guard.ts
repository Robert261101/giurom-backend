import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // If bypassAuth is set by InternalServiceGuard, allow the request
    if (request.bypassAuth) {
      this.logger.log('Bypassing permissions check for internal service request');
      return true;
    }

    const handler = context.getHandler();
    const controller = context.getClass();
    const handlerName = handler.name;
    
    // Log pentru a vedea ce handler este apelat
    this.logger.log(`🔍 [PermissionsGuard] Handler name: ${handlerName}, Controller: ${controller.name}`);
    
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      handler,
      controller,
    ]);
    
    // Log pentru a vedea ce permisiuni sunt găsite
    const handlerPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, handler);
    const classPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, controller);
    this.logger.log(`🔍 [PermissionsGuard] Handler permissions: ${JSON.stringify(handlerPermissions)}`);
    this.logger.log(`🔍 [PermissionsGuard] Class permissions: ${JSON.stringify(classPermissions)}`);
    this.logger.log(`🔍 [PermissionsGuard] Final required permissions (getAllAndOverride): ${JSON.stringify(requiredPermissions)}`);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    
    // If this is an internal service request, bypass permissions check
    if (request.bypassAuth === true) {
      return true;
    }
    
    const user = request?.user;
    if (!user) {
      this.logger.warn('User not authenticated');
      throw new ForbiddenException('Fără permisiuni');
    }

    // Extrage path-ul pentru logging
    const path = request.path || request.url?.split('?')[0] || '';
    const isGetRequest = request.method === 'GET';
    
    // Verifică dacă utilizatorul are permisiunea necesară
    const hasAll = user.permissions && requiredPermissions.every((perm) => (user.permissions as string[]).includes(perm));
    
    // Log detaliat pentru debugging
    this.logger.log(`🔍 [PermissionsGuard] Checking permissions for ${request.method} ${path}`);
    this.logger.log(`🔍 [PermissionsGuard] Required permissions: ${JSON.stringify(requiredPermissions)}`);
    this.logger.log(`🔍 [PermissionsGuard] User permissions count: ${user.permissions?.length || 0}`);
    this.logger.log(`🔍 [PermissionsGuard] User has cashing.create: ${user.permissions?.includes('cashing.create') || false}`);
    if (user.permissions && user.permissions.length > 0) {
      this.logger.log(`🔍 [PermissionsGuard] First 10 user permissions: ${JSON.stringify(user.permissions.slice(0, 10))}`);
    }
    this.logger.log(`🔍 [PermissionsGuard] Has all required permissions: ${hasAll}`);
    
    // Dacă are permisiunea, permite accesul
    if (hasAll) {
      this.logger.log(`✅ User has all required permissions: ${requiredPermissions.join(', ')}`);
      return true;
    }
    
    // Dacă nu are permisiunea, dar este autentificat, verifică dacă încearcă să acceseze locațiile sale
    // Această verificare se aplică doar pentru endpoint-urile GET (citire)
    // IMPORTANT: Pentru endpoint-urile de revenue (PATCH/DELETE /locations/revenue/:revenueId), 
    // verificăm STRICT permisiunile, fără bypass
    
    // Verifică dacă este endpoint de revenue (PATCH/DELETE revenue) - verifică strict permisiunile
    const isRevenueEndpoint = path.includes('/revenue/') && (request.method === 'PATCH' || request.method === 'DELETE');
    if (isRevenueEndpoint) {
      // Pentru endpoint-urile de revenue, verificăm STRICT permisiunile, fără bypass
      if (!user.permissions) {
        this.logger.warn('User has no permissions for revenue endpoint');
        throw new ForbiddenException('Fără permisiuni');
      }
      
      this.logger.warn(`User missing required permissions for revenue endpoint: ${requiredPermissions.join(', ')}`);
      throw new ForbiddenException('Permisiuni insuficiente');
    }
    
    // Extrage locationId din params sau din path
    let locationId = request.params?.id || request.params?.locationId;
    if (!locationId && path) {
      // Încearcă să extragă locationId din path: /locations/3 sau /locations/3/...
      const match = path.match(/\/locations\/(\d+)/);
      if (match) {
        locationId = match[1];
      }
    }
    
    const employeeId = user.id || user.employee_id || user.userId;
    const userWorkLocationId = user.work_location_id;
    
    this.logger.log(`🔍 Checking location access - isGetRequest: ${isGetRequest}, locationId: ${locationId}, employeeId: ${employeeId}, work_location_id: ${userWorkLocationId}, work_location_default_id: ${user.work_location_default_id}, path: ${path}, params: ${JSON.stringify(request.params)}`);
    
    // Pentru GET /locations (fără ID) - permitem accesul pentru utilizatorii autentificați
    // Service-ul va filtra locațiile în funcție de permisiuni
    const isLocationsListRequest = isGetRequest && !locationId && (
      path === '/locations' || 
      path === '/locations/' || 
      path.startsWith('/locations?') ||
      (path.startsWith('/locations') && !path.match(/\/locations\/\d+/)) // Nu este /locations/:id
    );
    
    if (isLocationsListRequest) {
      this.logger.log(`✅ Allowing GET /locations for authenticated user (employee ID ${employeeId}) - service will filter locations`);
      return true;
    }
    
    // Pentru GET /locations/:id - verifică dacă locația este în lista utilizatorului
    if (isGetRequest && locationId && employeeId) {
      this.logger.log(`🔍 Checking access to location ${locationId} for employee ${employeeId}`);
      // Verificare 1: Dacă work_location_id sau work_location_default_id din JWT se potrivește cu locationId
      const workLocationId = user.work_location_id || user.work_location_default_id;
      if (workLocationId && String(locationId) === String(workLocationId)) {
        this.logger.log(`✅ User accessing own location via work_location_id/work_location_default_id (location ID ${workLocationId})`);
        return true;
      }
      
      // Verificare 2: Verifică în employees_locations prin employees microservice
      try {
        const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3012';
        const response = await axios.get(`${employeesUrl}/employees/${employeeId}/locations`, {
          headers: {
            'x-internal-service': 'locations',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
            'Content-Type': 'application/json',
          },
          timeout: 3000, // 3 second timeout
        });
        
        const employeeLocations = Array.isArray(response.data) ? response.data : [];
        const locationIdNum = parseInt(locationId, 10);
        const hasAccess = employeeLocations.some((el: any) => {
          const elLocationId = el.idLocation || el.id_location || el.locationId || el.location_id;
          return elLocationId === locationIdNum || String(elLocationId) === String(locationId);
        });
        
        if (hasAccess) {
          this.logger.log(`✅ User accessing own location via employees_locations (employee ID ${employeeId}, location ID ${locationId})`);
          return true;
        } else {
          this.logger.warn(`❌ Location ${locationId} not found in employee ${employeeId} locations list`);
        }
      } catch (error: any) {
        // Dacă microserviciul nu este accesibil, verificăm direct din DB
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          try {
            // Verifică direct din employees_locations din DB
            const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
            const result = await this.dataSource.query(
              `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`,
              [employeeId, locationId]
            );
            if (result && result.length > 0) {
              this.logger.log(`✅ Found location ${locationId} in employees_locations via direct DB query for employee ${employeeId}`);
              return true;
            } else {
              this.logger.warn(`❌ Location ${locationId} not found in employees_locations for employee ${employeeId}`);
            }
          } catch (dbError: any) {
            this.logger.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
            // Dacă nu putem verifica, aruncăm eroare
          }
        } else {
          this.logger.error(`❌ Failed to check employee location access: ${error.message} (code: ${error.code || 'unknown'})`);
        }
      }
    }
    
    // Pentru endpoint-urile non-GET sau dacă verificările de mai sus eșuează, verifică permisiunile
    if (!user.permissions) {
      this.logger.warn('User has no permissions');
      throw new ForbiddenException('Fără permisiuni');
    }
    
    this.logger.warn(`User missing required permissions: ${requiredPermissions.join(', ')}`);
    throw new ForbiddenException('Permisiuni insuficiente');
  }
}