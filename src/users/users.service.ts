import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly httpService: HttpService) {}

  async findOne(email: string): Promise<User | undefined> {
    try {
      // Caută utilizatorul după email cu roluri și permisiuni
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3005/users?email=${email}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );
      
      // Verifică structura reală a răspunsului
      if (response?.data?.data?.data?.length) {
        const userData = response.data.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.user.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }
        
        return {
          userId: userData.user.id,
          email: userData.user.email,
          password: userData.user.password,
          roles: allRoles
        };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului: ${error.message}`);
      return undefined;
    }
  }

  async findOneByPhone(phone: string): Promise<User | undefined> {
    try {
      // Caută utilizatorul după telefon cu roluri și permisiuni
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3005/users?phone=${phone}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );
      
      // Verifică structura reală a răspunsului
      if (response?.data?.data?.data?.length) {
        const userData = response.data.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.user.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }
        
        return {
          userId: userData.user.id,
          email: userData.user.email,
          phone: userData.user.phone,
          password: userData.user.password,
          roles: allRoles
        };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului după telefon: ${error.message}`);
      return undefined;
    }
  }

  async findById(userId: number): Promise<User | undefined> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3005/users/${userId}`, {
          params: {
            include: 'roles,roles.permissions'
          }
        })
      );
      
      if (response?.data) {
        const userData = response.data;
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.roles || [];
        
        // Include și rolul de bază din obiectul user
        const baseRole = userData.role;
        const allRoles = [...userRoles];
        
        // Adaugă rolul de bază dacă nu există deja în lista de roluri
        if (baseRole && !allRoles.find(role => role.name === baseRole)) {
          allRoles.push({ name: baseRole, permissions: [] });
        }
        
        return {
          userId: userData.id,
          email: userData.email,
          roles: allRoles
        };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului după ID: ${error.message}`);
      return undefined;
    }
  }
} 