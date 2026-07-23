import { Injectable, UnauthorizedException, Logger, BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../guards/auth.guard';
import { TokenService } from '../common/token.service';
import { BruteForceProtectionService } from '../common/security/brute-force.service';
import { TokenRotationService } from '../common/security/token-rotation.service';
import { SecurityAlertsService, SecurityEventType } from '../common/security/security-alerts.service';
import { AnomalyDetectionService } from '../common/security/anomaly-detection.service';
import { TwoFactorAuthService } from '../2fa-auth/2fa-auth.service';
import { RegisterSupplierDto } from './dto/register-supplier.dto';
import {
  AnafCompanySnapshot,
  AnafLookupResult,
  AnafLookupService,
  normalizeCuiDigits,
} from './anaf-lookup.service';
import { formatDefaultLocationName } from './location-name.util';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  


  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private authGuard: AuthGuard,
    private tokenService: TokenService,
    private bruteForceService: BruteForceProtectionService,
    private tokenRotationService: TokenRotationService,
    private securityAlertsService: SecurityAlertsService,
    private anomalyDetectionService: AnomalyDetectionService,
    private twoFactorAuthService: TwoFactorAuthService,
    private readonly httpService: HttpService,
    private readonly anafLookupService: AnafLookupService,
  ) {}

  async signIn(
    identifier: string,
    pass: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ access_token?: string; refresh_token?: string; requires_2fa?: boolean; userId?: number; message?: string }> {
    // Detectează dacă este email sau telefon
    const isEmail = this.isValidEmail(identifier);
    const isPhone = this.isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
    }

    // Verifică protecția împotriva brute force
    try {
      await this.bruteForceService.checkBruteForce(identifier);
    } catch (error) {
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.ACCOUNT_LOCKED,
        email: identifier,
        ipAddress,
        userAgent,
        details: `Cont blocat temporar: ${this.extractErrorMessage(error)}`,
        severity: 'HIGH',
        timestamp: new Date()
      });
      throw error;
    }

    let user: User | undefined;
    
    if (isEmail) {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByEmail(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    } else {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByPhone(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    }

    if (!user) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        email: identifier,
        ipAddress,
        userAgent,
        details: 'Angajat inexistent',
        severity: 'MEDIUM',
        timestamp: new Date()
      });
      throw new UnauthorizedException('Credențiale incorecte');
    }

    // Verifică parola folosind bcrypt
    const isPasswordValid = await bcrypt.compare(pass, user.password || '');
    if (!isPasswordValid) {
      // Înregistrează încercarea eșuată
      await this.bruteForceService.recordFailedAttempt(identifier);
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        userId: user.id.toString(),
        email: identifier,
        ipAddress,
        userAgent,
        details: 'Parolă incorectă',
        severity: 'MEDIUM',
        timestamp: new Date()
      });
      throw new UnauthorizedException('Credențiale incorecte');
    }

    // Detectează anomalii în comportament
    const anomalyScore = await this.anomalyDetectionService.detectAnomalies(
      user.id.toString(),
      'LOGIN',
      {
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: true
      }
    );

    // Log eveniment suspect dacă scorul este ridicat
    if (anomalyScore.score > 70) {
      await this.securityAlertsService.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_LOGIN,
        userId: user.id.toString(),
        email: identifier,
        ipAddress,
        userAgent,
        details: `Login suspect - scor anomalie: ${anomalyScore.score}/100. Factori: ${anomalyScore.factors.join(', ')}`,
        severity: anomalyScore.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        timestamp: new Date()
      });
    }

    // Resetează încercările eșuate la login reușit
    await this.bruteForceService.resetAttempts(identifier);

    // Verifică dacă utilizatorul are 2FA activat
    if (user.is_2fa) {
      this.logger.log(`Utilizatorul ${identifier} are 2FA activat. Se trimite OTP automat.`);
      
      try {
        // Trimite OTP-ul automat folosind serviciul injectat
        const result = await this.twoFactorAuthService.step1Login(identifier, pass);
        
        this.logger.log(`OTP trimis cu succes pentru ${identifier}`);
        
        return {
          requires_2fa: true,
          userId: result.userId,
          message: result.message
        };
      } catch (error) {
        this.logger.error(`Eroare la trimiterea OTP pentru ${identifier}: ${this.extractErrorMessage(error)}`);
        throw new UnauthorizedException('Autentificarea cu parolă a reușit, dar nu s-a putut trimite OTP-ul. Încearcă din nou.');
      }
    }

    // Dacă nu are 2FA activat, generează token-urile normal
    const userDataForToken = await this.usersService.buildUserDataForToken(
      user.id_employee,
      user.id,
      {
        profile_image: this.convertToApiProxyUrl(user.profile_image),
        is_2fa_active: user.is_2fa,
      },
    );

    const tokens = await this.tokenRotationService.generateTokensWithRotation(userDataForToken);
    
    // Log utilizatorul și permisiunile sale
    this.logger.log(`=== LOGIN REUȘIT (FĂRĂ 2FA) ===`);
    this.logger.log(`Utilizator ID: ${user.id_employee}`);
    this.logger.log(`2FA Status: ${user.is_2fa ? 'ACTIVAT' : 'DEZACTIVAT'}`);
    this.logger.log(`Roluri: ${userDataForToken.roles.join(', ')}`);
    this.logger.log(`Permisiuni: ${userDataForToken.permissions.join(', ')}`);
    this.logger.log(
      `Companie: id=${userDataForToken.company_id}, type=${userDataForToken.company_type}`,
    );
    this.logger.log(`====================`);
    
    return tokens;
  }

  async logout(token: string): Promise<{ message: string }> {
    try {
      // Verifică dacă token-ul este valid înainte de a-l invalida
      const payload = await this.jwtService.verifyAsync(token);
      
      // Adaugă token-ul în blacklist prin AuthGuard
      this.authGuard.addToBlacklist(token);
      
      // Revocă toate token-urile pentru utilizatorul respectiv
      await this.tokenService.revokeAllUserTokens(payload.sub);
      
      this.logger.log(`Logout complet pentru utilizatorul ID ${payload.sub} - toate token-urile revocate`);
      
      return { 
        message: 'Logout realizat cu succes - toate sesiunile au fost închise' 
      };
    } catch (error) {
      throw new UnauthorizedException('Token invalid');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Folosește rotirea de token-uri pentru securitate sporită
      const newRefreshToken = await this.tokenRotationService.rotateRefreshToken(refreshToken);
      
      // Generează access token nou
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET nu este configurat în variabilele de mediu');
      }
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret
      });
      
      // Găsește user-ul local după id_employee din payload
      const user = await this.usersService.findByEmployeeIdWithPassword(payload.sub);
      if (!user) {
        throw new Error('Utilizatorul nu a fost găsit');
      }
      
      // Preia datele complete din microserviciul employees folosind id_employee direct
      this.logger.log(`🔍 Refresh token payload:`, payload);
      // Folosim user.id_employee direct pentru a obține datele employee-ului
      const employeeData: any = await this.usersService.findEmployeeById(user.id_employee);
      
      if (!employeeData) {
        this.logger.warn(`⚠️ Nu s-au găsit date pentru employee cu ID ${user.id_employee} - folosim date alternative`);
        // Dacă nu găsim prin ID, încercăm prin email sau phone din payload (pentru compatibilitate cu token-uri vechi)
        const fallbackData = await this.usersService.findEmployeeByEmail(payload.email || '') || 
                            (payload.phone ? await this.usersService.findEmployeeByPhone(payload.phone) : null);
        if (fallbackData) {
          Object.assign(employeeData || {}, fallbackData);
        }
      }

      const userDataForToken = await this.usersService.buildUserDataForToken(
        user.id_employee,
        user.id,
        {
          profile_image: this.convertToApiProxyUrl(user.profile_image),
        },
      );

      const jwtPayload = {
        sub: userDataForToken.id,
        email: userDataForToken.email,
        first_name: userDataForToken.first_name,
        last_name: userDataForToken.last_name,
        phone: userDataForToken.phone,
        profile_image: userDataForToken.profile_image,
        birth_date: userDataForToken.birth_date,
        department_id: userDataForToken.department_id,
        work_location_id: userDataForToken.work_location_id,
        company_id: userDataForToken.company_id,
        company_type: userDataForToken.company_type,
        position_default_id: userDataForToken.position_default_id,
        roles: userDataForToken.roles,
        permissions: userDataForToken.permissions,
      };
      
      const accessToken = await this.jwtService.signAsync(jwtPayload);
      
      return {
        access_token: accessToken,
        refresh_token: newRefreshToken
      };
    } catch (error) {
      this.logger.error(`Eroare la reînnoirea token-ului: ${this.extractErrorMessage(error)}`);
      throw new UnauthorizedException('Refresh token invalid');
    }
  }

  async revokeAllUserTokens(userId: number): Promise<{ message: string }> {
    try {
      await this.tokenService.revokeAllUserTokens(userId);
      return { 
        message: `Toate token-urile pentru utilizatorul ${userId} au fost revocate` 
      };
    } catch (error) {
      this.logger.error(`Eroare la revocarea token-urilor: ${this.extractErrorMessage(error)}`);
      throw error;
    }
  }

  async validateIdentifier(identifier: string): Promise<{ exists: boolean; type: 'email' | 'phone' }> {
    // Detectează dacă este email sau telefon
    const isEmail = this.isValidEmail(identifier);
    const isPhone = this.isValidPhone(identifier);

    if (!isEmail && !isPhone) {
      throw new BadRequestException('Format invalid. Trebuie să fie un email valid sau un număr de telefon românesc.');
    }

    let user: User | undefined;
    
    if (isEmail) {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByEmail(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    } else {
      // Găsește angajatul prin microserviciul employees
      const employee = await this.usersService.findEmployeeByPhone(identifier);
      if (employee) {
        // Găsește user-ul din tabelul users pe baza id_employee
        user = await this.usersService.findByEmployeeIdWithPassword(employee.id) || undefined;
      }
    }

    return {
      exists: !!user,
      type: isEmail ? 'email' : 'phone'
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Acceptă formatul 07XXXXXXXX sau +407XXXXXXXX
    const phoneRegex = /^(\+40)?7[0-9]{8}$/;
    return phoneRegex.test(phone);
  }

  // Helper method to convert direct file path to API proxy URL
  private convertToApiProxyUrl(profileImageUrl: string | null): string | null {
    if (!profileImageUrl) {
      return null;
    }
    
    // If this is already an API proxy URL, return as is
    if (profileImageUrl.startsWith('/api/')) {
      return profileImageUrl;
    }
    
    // If this is a direct file path, it means we need to handle it properly
    // For now, we'll return null to use the default avatar
    // In a real implementation, we would need to find the file ID and create the proper URL
    if (profileImageUrl.startsWith('/files/')) {
      // This is a direct file path that can't be accessed directly
      // Return null to use default avatar until we can properly convert it
      return null;
    }
    
    // For any other URL, return as is
    return profileImageUrl;
  }

  private internalServiceHeaders(): Record<string, string> {
    return {
      'X-Internal-Service': 'auth-service',
      'X-Service-Secret': process.env.SERVICE_SECRET || '',
    };
  }

  private companiesUrl(): string {
    return process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
  }

  private locationsUrl(): string {
    return process.env.LOCATIONS_HTTP_URL || 'http://localhost:3004';
  }

  private employeesUrl(): string {
    return process.env.EMPLOYEES_SERVICE_URL || 'http://localhost:3011';
  }

  private suppliersUrl(): string {
    return process.env.SUPPLIERS_HTTP_URL || 'http://localhost:3007';
  }

  private unwrapPayload<T>(data: unknown): T {
    if (data && typeof data === 'object' && 'data' in (data as object)) {
      return (data as { data: T }).data;
    }
    return data as T;
  }

  private extractErrorMessage(error: unknown): string {
    const err = error as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (typeof err?.message === 'string') return err.message;
    return 'Eroare necunoscută';
  }

  /**
   * Lookup public firmă după CUI (proxy ANAF). Nu salvează nimic în DB.
   */
  async lookupRegisterSupplierCompany(rawCui: string): Promise<AnafLookupResult> {
    return this.anafLookupService.lookupCompany(rawCui);
  }

  private async deleteCompanyInternal(companyId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.companiesUrl()}/companies/${companyId}`,
          { headers: this.internalServiceHeaders() },
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Rollback: nu s-a putut șterge compania ${companyId}: ${this.extractErrorMessage(error)}`,
      );
    }
  }

  private async deleteLocationInternal(locationId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.locationsUrl()}/locations/${locationId}`,
          { headers: this.internalServiceHeaders() },
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Rollback: nu s-a putut șterge locația ${locationId}: ${this.extractErrorMessage(error)}`,
      );
    }
  }

  private async deleteSupplierInternal(supplierId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.suppliersUrl()}/suppliers/${supplierId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Rollback: nu s-a putut șterge supplier ${supplierId}: ${this.extractErrorMessage(error)}`,
      );
    }
  }

  private async deleteEmployeeInternal(employeeId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.employeesUrl()}/employees/${employeeId}`,
          { headers: this.internalServiceHeaders() },
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Rollback: nu s-a putut șterge employee ${employeeId}: ${this.extractErrorMessage(error)}`,
      );
    }
  }

  /**
   * Verifică dacă există deja o companie cu același CUI normalizat.
   * CUI-ul e stocat cu prefix RO (convenția CreateCompanyDto).
   */
  private async assertCuiNotRegistered(cuiWithPrefix: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.companiesUrl()}/companies/cui/${encodeURIComponent(cuiWithPrefix)}`,
          { headers: this.internalServiceHeaders() },
        ),
      );
      const company = this.unwrapPayload<{ id?: number }>(response.data);
      if (company?.id) {
        throw new ConflictException(
          'Există deja o companie înregistrată cu acest CUI',
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) return; // CUI liber
      throw new InternalServerErrorException(
        'Nu s-a putut verifica unicitatea CUI-ului',
      );
    }
  }

  async registerSupplier(
    dto: RegisterSupplierDto,
  ): Promise<{ message: string; employee_id: number; supplier_id: number }> {
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Parolele nu coincid');
    }

    const cuiDigits = normalizeCuiDigits(dto.company?.cui);
    if (!cuiDigits) {
      throw new BadRequestException('CUI invalid');
    }
    const cuiWithPrefix = `RO${cuiDigits}`;

    // Proveniența datelor: doar un token semnat server-side (emis de
    // company-lookup) dovedește că datele provin dintr-un lookup ANAF real.
    // Un simplu "data_source: anaf" trimis din browser nu este acceptat.
    let anafSnapshot: AnafCompanySnapshot | null = null;
    let anafVerifiedAt: string | null = null;
    if (dto.anaf_token) {
      const verified = await this.anafLookupService.verifyAnafToken(
        dto.anaf_token,
        cuiDigits,
      );
      if (verified) {
        anafSnapshot = verified.snapshot;
        anafVerifiedAt = verified.verified_at;
      } else {
        this.logger.warn(
          `Token ANAF invalid/expirat la înregistrare (CUI ${cuiDigits}); compania va fi creată cu data_source=manual`,
        );
      }
    }
    const dataSource: 'anaf' | 'manual' = anafSnapshot ? 'anaf' : 'manual';

    await this.assertCuiNotRegistered(cuiWithPrefix);

    const furnizorRole = await this.usersService.findRoleByName('furnizor');
    if (!furnizorRole) {
      throw new InternalServerErrorException(
        'Rolul furnizor lipsește din sistem. Contactați administratorul.',
      );
    }

    const loc = dto.location;
    const streetAddress = [
      loc.street.trim(),
      `nr. ${loc.number.trim()}`,
      loc.details?.trim() || null,
    ]
      .filter(Boolean)
      .join(', ');
    const locationName =
      loc.location_name?.trim() ||
      formatDefaultLocationName(loc.city?.trim());
    const country = loc.country?.trim() || 'Romania';

    let companyId: number | null = null;
    let locationId: number | null = null;
    let supplierId: number | null = null;
    let employeeId: number | null = null;
    let userId: number | null = null;

    try {
      // 1. Compania (company_type=furnizor, cu proveniența datelor)
      const companyPayload = {
        company_name: dto.company.company_name.trim(),
        cui: cuiWithPrefix,
        trade_register_number: dto.company.trade_register_number.trim(),
        address: streetAddress,
        city: loc.city.trim(),
        county: loc.county.trim(),
        postal_code: loc.postal_code || undefined,
        country,
        phone_number: dto.company.phone_number || undefined,
        email: dto.company.email || undefined,
        incorporation_date:
          dto.company.incorporation_date ||
          anafSnapshot?.incorporationDate ||
          new Date().toISOString().slice(0, 10),
        legal_form: dto.company.legal_form || 'SRL',
        activity_code: dto.company.activity_code || anafSnapshot?.caenCode || '0000',
        vat_payer: anafSnapshot?.vatRegistered ?? false,
        company_type: 'furnizor' as const,
        data_source: dataSource,
        anaf_verified_at: anafVerifiedAt,
        anaf_original_data: anafSnapshot,
      };

      let companyResponse;
      try {
        companyResponse = await firstValueFrom(
          this.httpService.post(
            `${this.companiesUrl()}/companies`,
            companyPayload,
            { headers: this.internalServiceHeaders() },
          ),
        );
      } catch (error) {
        const message = this.extractErrorMessage(error);
        if (/există deja/i.test(message)) {
          throw new ConflictException(
            'Există deja o companie înregistrată cu acest CUI',
          );
        }
        throw new BadRequestException(
          message || 'Nu s-a putut crea compania',
        );
      }
      const company = this.unwrapPayload<{ id: number }>(companyResponse.data);
      companyId = Number(company?.id);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        throw new InternalServerErrorException(
          'Răspuns invalid de la serviciul companii',
        );
      }

      // 2. Locația principală (sediul)
      const locationPayload = {
        company_id: companyId,
        location_name: locationName,
        address: streetAddress.length >= 10 ? streetAddress : `${streetAddress}, ${loc.city.trim()}`,
        city: loc.city.trim(),
        county: loc.county.trim(),
        postal_code: loc.postal_code || undefined,
        country,
        phone_number: dto.company.phone_number || undefined,
        email: dto.company.email || undefined,
        notes: 'Sediu principal (creat automat la înregistrarea furnizorului)',
      };

      let locationResponse;
      try {
        locationResponse = await firstValueFrom(
          this.httpService.post(
            `${this.locationsUrl()}/locations`,
            locationPayload,
            { headers: this.internalServiceHeaders() },
          ),
        );
      } catch (error) {
        throw new BadRequestException(
          this.extractErrorMessage(error) || 'Nu s-a putut crea locația',
        );
      }
      const location = this.unwrapPayload<{ id: number }>(
        locationResponse.data,
      );
      locationId = Number(location?.id);
      if (!Number.isFinite(locationId) || locationId <= 0) {
        throw new InternalServerErrorException(
          'Răspuns invalid de la serviciul locații',
        );
      }

      // 3. Furnizorul (entitatea operațională, legată de companie și locație)
      const supplierPayload = {
        supplier_name: dto.company.company_name.trim(),
        registration_number: dto.company.trade_register_number.trim(),
        vat_number: cuiWithPrefix,
        address: streetAddress,
        city: loc.city.trim(),
        region: loc.county.trim(),
        country,
        postal_code: loc.postal_code || '000000',
        phone: dto.company.phone_number || dto.employee.phone,
        email: dto.company.email || dto.employee.email,
        contact_person:
          `${dto.employee.first_name} ${dto.employee.last_name}`.trim(),
        is_active: true,
        owner_company_id: companyId,
      };

      let supplierResponse;
      try {
        supplierResponse = await firstValueFrom(
          this.httpService.post(
            `${this.suppliersUrl()}/suppliers?location_id=${locationId}`,
            supplierPayload,
            {
              headers: {
                ...this.internalServiceHeaders(),
                'x-work-location-id': String(locationId),
              },
            },
          ),
        );
      } catch (error) {
        const message = this.extractErrorMessage(error);
        if (/duplicat|duplicate|există deja/i.test(message)) {
          if (/vat|cif|fiscal/i.test(message)) {
            throw new ConflictException('Există deja un furnizor cu acest CUI/CIF');
          }
          throw new ConflictException('Există deja un furnizor cu aceste date');
        }
        if (/owner_company|UQ_suppliers_owner_company/i.test(message)) {
          throw new ConflictException(
            'Compania furnizor are deja un furnizor operațional asociat',
          );
        }
        throw new BadRequestException(
          message || 'Nu s-a putut crea furnizorul',
        );
      }

      const supplier = this.unwrapPayload<{ id: number }>(
        supplierResponse.data,
      );
      supplierId = Number(supplier?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        throw new InternalServerErrorException(
          'Răspuns invalid de la serviciul furnizori',
        );
      }

      const employeePayload = {
        ...dto.employee,
        work_location_default_id: locationId,
        is_active: true,
      };

      let employeeResponse;
      try {
        employeeResponse = await firstValueFrom(
          this.httpService.post(
            `${this.employeesUrl()}/employees?location_id=${locationId}`,
            employeePayload,
            {
              headers: {
                ...this.internalServiceHeaders(),
                'x-work-location-id': String(locationId),
              },
            },
          ),
        );
      } catch (error) {
        const message = this.extractErrorMessage(error);
        if (/email există deja|email already/i.test(message)) {
          throw new ConflictException(
            'Există deja un angajat cu acest email',
          );
        }
        if (/cnp|personal_number/i.test(message)) {
          throw new ConflictException('Există deja un angajat cu acest CNP');
        }
        throw new BadRequestException(
          message || 'Nu s-a putut crea angajatul',
        );
      }

      const employee = this.unwrapPayload<{ id: number }>(
        employeeResponse.data,
      );
      employeeId = Number(employee?.id);
      if (!Number.isFinite(employeeId) || employeeId <= 0) {
        throw new InternalServerErrorException(
          'Răspuns invalid de la serviciul angajați',
        );
      }

      let user;
      try {
        user = await this.usersService.create({
          id_employee: employeeId,
          password: dto.password,
          is_active: true,
          is_2fa: false,
        });
      } catch (error) {
        const message = this.extractErrorMessage(error);
        if (/există deja/i.test(message)) {
          throw new ConflictException(
            'Există deja un cont pentru acest angajat',
          );
        }
        throw new BadRequestException(
          message || 'Nu s-a putut crea contul utilizator',
        );
      }
      userId = user.id;

      try {
        await this.usersService.createUserRole({
          userId: user.id,
          roleId: furnizorRole.id,
        });
      } catch (error) {
        throw new InternalServerErrorException(
          `Nu s-a putut atribui rolul furnizor: ${this.extractErrorMessage(error)}`,
        );
      }

      return {
        message: 'Contul de furnizor a fost creat cu succes',
        employee_id: employeeId,
        supplier_id: supplierId,
      };
    } catch (error) {
      // Compensare în ordine inversă: user → employee → supplier → location → company
      if (userId != null && employeeId != null) {
        try {
          await this.usersService.remove(employeeId);
        } catch (rollbackErr) {
          this.logger.warn(
            `Rollback user eșuat: ${this.extractErrorMessage(rollbackErr)}`,
          );
        }
      }
      if (employeeId != null) {
        await this.deleteEmployeeInternal(employeeId);
      }
      if (supplierId != null) {
        await this.deleteSupplierInternal(supplierId);
      }
      if (locationId != null) {
        await this.deleteLocationInternal(locationId);
      }
      if (companyId != null) {
        await this.deleteCompanyInternal(companyId);
      }
      throw error;
    }
  }
}