export interface JwtPayload {
  sub: number; // user ID
  username: string;
  email: string;
  permissions: string[];
  roles: string[];
  iat?: number;
  exp?: number;
}