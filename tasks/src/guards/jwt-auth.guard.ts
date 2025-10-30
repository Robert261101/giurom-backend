import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard {
  constructor(private jwtService: JwtService) {
    console.log('🔍 [JwtAuthGuard] JWT Secret configurat:', this.jwtService['options']?.secret || 'NU ESTE CONFIGURAT');
    console.log('🔍 [JwtAuthGuard] JWT Options complete:', JSON.stringify(this.jwtService['options']));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    console.log('🔍 [JwtAuthGuard] Verificare token pentru:', request.url)
    console.log('🔍 [JwtAuthGuard] Authorization header:', request.headers.authorization ? 'EXISTĂ' : 'LIPSEȘTE')
    
    const token = this.extractTokenFromHeader(request);
    console.log('🔍 [JwtAuthGuard] Token extras: token:', token)
    if (token) {
      console.log('🔍 [JwtAuthGuard] Token primit:', token);
    }

    if (!token) {
      console.log('❌ [JwtAuthGuard] Token JWT lipsă')
      throw new UnauthorizedException('Token JWT lipsă');
    }

    try {
      console.log('🔍 [JwtAuthGuard] Încerc să verific token-ul cu secretul:', this.jwtService['options']?.secret);
      const payload = this.jwtService.verify(token);
      console.log('✅ [JwtAuthGuard] Token valid, payload:', payload)
      request.user = payload;
      return true;
    } catch (error) {
      console.log('❌ [JwtAuthGuard] Token JWT invalid:', error.message)
      console.log('🔍 [JwtAuthGuard] Secret folosit pentru verificare:', this.jwtService['options']?.secret);
      throw new UnauthorizedException('Token JWT invalid');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
