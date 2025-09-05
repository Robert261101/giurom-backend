import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('users')
export class User {
  @ApiProperty({
    description: 'ID-ul unic al utilizatorului',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul angajatului din microserviciul employees',
    example: 6,
  })
  @Column({
    type: 'int',
    unique: true,
    nullable: false,
  })
  id_employee: number;

  @ApiProperty({
    description: 'Parola hashuită a utilizatorului',
    example: '$2b$10$fBLebjs8B6GknHsl5jN7OuuxK4zzyfbAOkLz8mBWONDexkrDgp4f.',
  })
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    select: false, // Nu se returnează în query-uri normale
  })
  password: string;

  @ApiProperty({
    description: 'URL-ul imaginii de profil a utilizatorului',
    example: '/api/images/profile_123.jpg',
    maxLength: 255,
  })
  @Column({
    type: 'varchar',
    length: 255,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    nullable: true,
  })
  profile_image: string | null;


  @ApiProperty({
    description: 'Statusul activ al utilizatorului',
    example: true,
  })
  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Statusul 2FA al utilizatorului',
    example: false,
  })
  @Column({
    type: 'boolean',
    default: false,
    nullable: false,
  })
  is_2fa: boolean;

  @ApiProperty({
    description: 'Data creării utilizatorului',
    example: '2025-01-15T10:30:00.000Z',
  })
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări a utilizatorului',
    example: '2025-01-15T10:30:00.000Z',
  })
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updated_at: Date;

  // Relații
  @OneToMany('UserRole', 'user')
  userRoles: any[];
}
