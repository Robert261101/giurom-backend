import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'role_id' })
  roleId: number;

  // Relații
  @ManyToOne('User', 'userRoles')
  @JoinColumn({ name: 'user_id' })
  user: any;

  @ManyToOne('Role', 'userRoles')
  @JoinColumn({ name: 'role_id' })
  role: any;
}
