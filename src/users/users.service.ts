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
        this.httpService.get(`http://localhost:3003/users?email=${email}`, {
          params: {
            include: 'roles,roles.permissions'
          },
          headers: {
            'x-internal-service': 'auth-service'
          }
        })
      );
      
      // Verifică structura reală a răspunsului
      if (response?.data?.data?.length) {
        const userData = response.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        const allRoles = [...userRoles];

        // Caută toți partenerii asociați utilizatorului din tabela de legătură
        let partnerNames: string[] = [];
        
        try {
          // Caută partenerii din tabela user_partners
          const userPartnersResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3003/users/${userData.user.id}/partners`, {
              headers: {
                'x-internal-service': 'auth-service'
              }
            })
          );
          
          if (userPartnersResponse?.data && userPartnersResponse.data.length > 0) {
            // Obține numele partenerilor din serviciul de parteneri
            const partnerIds = userPartnersResponse.data.map((userPartner: any) => userPartner.partner_id);
            this.logger.log(`Partner IDs găsite: ${JSON.stringify(partnerIds)}`);
            
            // Caută numele partenerilor
            for (const partnerId of partnerIds) {
              try {
                const partnerResponse = await firstValueFrom(
                  this.httpService.get(`http://localhost:3002/api/partners/${partnerId}`, {
                    headers: {
                      'x-internal-service': 'auth-service'
                    }
                  })
                );
                
                if (partnerResponse?.data?.data) {
                  partnerNames.push(partnerResponse.data.data.name);
                }
              } catch (partnerError) {
                this.logger.warn(`Nu s-a putut găsi partenerul cu ID ${partnerId}: ${partnerError.message}`);
              }
            }
            
            this.logger.log(`Parteneri găsiți din tabela de legătură: ${JSON.stringify(partnerNames)}`);
          }
        } catch (userPartnersError) {
          this.logger.warn(`Nu s-au putut găsi partenerii din tabela de legătură: ${userPartnersError.message}`);
          
          // Fallback: caută partenerul din câmpul partner_id (pentru compatibilitate)
          if (userData.user.partner_id) {
            try {
              this.logger.log(`Fallback: Încercare de a găsi partenerul cu ID: ${userData.user.partner_id}`);
              const partnerResponse = await firstValueFrom(
                this.httpService.get(`http://localhost:3002/api/partners/${userData.user.partner_id}`, {
                  headers: {
                    'x-internal-service': 'auth-service'
                  }
                })
              );
              
              if (partnerResponse?.data?.data) {
                partnerNames = [partnerResponse.data.data.name];
                this.logger.log(`Partner name din fallback: ${JSON.stringify(partnerNames)}`);
              }
            } catch (partnerError) {
              this.logger.error(`Nu s-a putut găsi partenerul pentru utilizatorul ${userData.user.id}: ${partnerError.message}`);
            }
          }
        }
        
        return {
          userId: userData.user.id,
          email: userData.user.email,
          password: userData.user.password,
          partner_id: userData.user.partner_id,
          partner_name: partnerNames,
          roles: allRoles,
          is_2fa_active: userData.user.is_2fa_active || false
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
        this.httpService.get(`http://localhost:3003/users?phone=${phone}`, {
          params: {
            include: 'roles,roles.permissions'
          },
          headers: {
            'x-internal-service': 'auth-service'
          }
        })
      );
      
      // Verifică structura reală a răspunsului
      if (response?.data?.data?.length) {
        const userData = response.data.data[0];
        
        // Extrage rolurile din tabelul user_roles dacă există
        const userRoles = userData.user.roles || [];
        const allRoles = [...userRoles];

        // Caută toți partenerii asociați utilizatorului din tabela de legătură
        let partnerNames: string[] = [];
        
        try {
          // Caută partenerii din tabela user_partners
          const userPartnersResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3003/users/${userData.user.id}/partners`, {
              headers: {
                'x-internal-service': 'auth-service'
              }
            })
          );
          
          if (userPartnersResponse?.data?.data && userPartnersResponse.data.data.length > 0) {
            // Obține numele partenerilor din serviciul de parteneri
            const partnerIds = userPartnersResponse.data.data.map((userPartner: any) => userPartner.partner_id);
            
            // Caută numele partenerilor
            for (const partnerId of partnerIds) {
              try {
                const partnerResponse = await firstValueFrom(
                  this.httpService.get(`http://localhost:3002/api/partners/${partnerId}`, {
                    headers: {
                      'x-internal-service': 'auth-service'
                    }
                  })
                );
                
                if (partnerResponse?.data?.data) {
                  partnerNames.push(partnerResponse.data.data.name);
                }
              } catch (partnerError) {
                this.logger.warn(`Nu s-a putut găsi partenerul cu ID ${partnerId}: ${partnerError.message}`);
              }
            }
          }
        } catch (userPartnersError) {
          this.logger.warn(`Nu s-au putut găsi partenerii din tabela de legătură: ${userPartnersError.message}`);
          
          // Fallback: caută partenerul din câmpul partner_id (pentru compatibilitate)
          if (userData.user.partner_id) {
            try {
              const partnerResponse = await firstValueFrom(
                this.httpService.get(`http://localhost:3002/api/partners/${userData.user.partner_id}`, {
                  headers: {
                    'x-internal-service': 'auth-service'
                  }
                })
              );
              
              if (partnerResponse?.data?.data) {
                partnerNames = [partnerResponse.data.data.name];
              }
            } catch (partnerError) {
              this.logger.warn(`Nu s-a putut găsi partenerul pentru utilizatorul ${userData.user.id}: ${partnerError.message}`);
            }
          }
        }
        
        return {
          userId: userData.user.id,
          email: userData.user.email,
          phone: userData.user.phone,
          password: userData.user.password,
          partner_id: userData.user.partner_id,
          partner_name: partnerNames,
          roles: allRoles,
          is_2fa_active: userData.user.is_2fa_active || false
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
        this.httpService.get(`http://localhost:3003/users/${userId}`, {
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

        // Caută toți partenerii asociați utilizatorului din tabela de legătură
        let partnerNames: string[] = [];
        
        try {
          // Caută partenerii din tabela user_partners
          const userPartnersResponse = await firstValueFrom(
            this.httpService.get(`http://localhost:3003/users/${userData.id}/partners`, {
              headers: {
                'x-internal-service': 'auth-service'
              }
            })
          );
          
          if (userPartnersResponse?.data?.data && userPartnersResponse.data.data.length > 0) {
            // Obține numele partenerilor din serviciul de parteneri
            const partnerIds = userPartnersResponse.data.data.map((userPartner: any) => userPartner.partner_id);
            
            // Caută numele partenerilor
            for (const partnerId of partnerIds) {
              try {
                const partnerResponse = await firstValueFrom(
                  this.httpService.get(`http://localhost:3002/api/partners/${partnerId}`, {
                    headers: {
                      'x-internal-service': 'auth-service'
                    }
                  })
                );
                
                if (partnerResponse?.data?.data) {
                  partnerNames.push(partnerResponse.data.data.name);
                }
              } catch (partnerError) {
                this.logger.warn(`Nu s-a putut găsi partenerul cu ID ${partnerId}: ${partnerError.message}`);
              }
            }
          }
        } catch (userPartnersError) {
          this.logger.warn(`Nu s-au putut găsi partenerii din tabela de legătură: ${userPartnersError.message}`);
          
          // Fallback: caută partenerul din câmpul partner_id (pentru compatibilitate)
          if (userData.partner_id) {
            try {
              const partnerResponse = await firstValueFrom(
                this.httpService.get(`http://localhost:3002/api/partners/${userData.partner_id}`, {
                  headers: {
                    'x-internal-service': 'auth-service'
                  }
                })
              );
              
              if (partnerResponse?.data?.data) {
                partnerNames = [partnerResponse.data.data.name];
              }
            } catch (partnerError) {
              this.logger.warn(`Nu s-a putut găsi partenerul pentru utilizatorul ${userData.id}: ${partnerError.message}`);
            }
          }
        }
        
        return {
          userId: userData.id,
          email: userData.email,
          partner_id: userData.partner_id,
          partner_name: partnerNames,
          roles: allRoles,
          is_2fa_active: userData.is_2fa_active || false
        };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error(`Eroare la căutarea utilizatorului după ID: ${error.message}`);
      return undefined;
    }
  }
} 