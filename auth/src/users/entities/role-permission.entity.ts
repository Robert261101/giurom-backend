import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @Column({ name: 'permission_id' })
  permissionId: number;

  // Relații
  @ManyToOne('Role', 'rolePermissions')
  @JoinColumn({ name: 'role_id' })
  role: any;

  @ManyToOne('Permission', 'rolePermissions')
  @JoinColumn({ name: 'permission_id' })
  permission: any;
}
