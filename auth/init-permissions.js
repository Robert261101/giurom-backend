const { DataSource } = require('typeorm');
const { User } = require('./dist/users/entities/user.entity');
const { Role } = require('./dist/users/entities/role.entity');
const { Permission } = require('./dist/users/entities/permission.entity');
const { UserRole } = require('./dist/users/entities/user-role.entity');
const { RolePermission } = require('./dist/users/entities/role-permission.entity');

async function initPermissions() {
  // Configure the database connection
  const dataSource = new DataSource({
    type: 'mariadb',
    host: 'localhost',
    port: 3307,
    username: 'root',
    password: 'eric',
    database: 'giurom_db',
    entities: [User, Role, Permission, UserRole, RolePermission],
    synchronize: false,
    logging: false,
  });

  try {
    // Initialize the database connection
    await dataSource.initialize();
    console.log('Connected to database');

    // Create basic permissions
    const permissionsData = [
      { name: 'employees.read', group: 'employees', description: 'View employees' },
      { name: 'employees.create', group: 'employees', description: 'Create employees' },
      { name: 'employees.update', group: 'employees', description: 'Update employees' },
      { name: 'employees.delete', group: 'employees', description: 'Delete employees' },
      { name: 'stock.read', group: 'stock', description: 'View stock' },
      { name: 'stock.create', group: 'stock', description: 'Create stock items' },
      { name: 'stock.update', group: 'stock', description: 'Update stock items' },
      { name: 'stock.delete', group: 'stock', description: 'Delete stock items' },
      { name: 'recipes.read', group: 'recipes', description: 'View recipes' },
      { name: 'recipes.create', group: 'recipes', description: 'Create recipes' },
      { name: 'recipes.update', group: 'recipes', description: 'Update recipes' },
      { name: 'recipes.delete', group: 'recipes', description: 'Delete recipes' },
      { name: 'companies.read', group: 'companies', description: 'View companies' },
      { name: 'companies.create', group: 'companies', description: 'Create companies' },
      { name: 'companies.update', group: 'companies', description: 'Update companies' },
      { name: 'companies.delete', group: 'companies', description: 'Delete companies' },
      { name: 'locations.read', group: 'locations', description: 'View locations' },
      { name: 'locations.create', group: 'locations', description: 'Create locations' },
      { name: 'locations.update', group: 'locations', description: 'Update locations' },
      { name: 'locations.delete', group: 'locations', description: 'Delete locations' },
    ];

    const permissionRepository = dataSource.getRepository(Permission);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);
    const rolePermissionRepository = dataSource.getRepository(RolePermission);

    console.log('Creating permissions...');
    const permissions = [];
    for (const permData of permissionsData) {
      // Check if permission already exists
      let permission = await permissionRepository.findOneBy({ name: permData.name });
      if (!permission) {
        permission = permissionRepository.create(permData);
        permission = await permissionRepository.save(permission);
        console.log(`Created permission: ${permData.name}`);
      } else {
        console.log(`Permission already exists: ${permData.name}`);
      }
      permissions.push(permission);
    }

    // Create admin role
    console.log('Creating admin role...');
    let adminRole = await roleRepository.findOneBy({ name: 'admin' });
    if (!adminRole) {
      adminRole = roleRepository.create({
        name: 'admin',
        description: 'Administrator with full access'
      });
      adminRole = await roleRepository.save(adminRole);
      console.log('Created admin role');
    } else {
      console.log('Admin role already exists');
    }

    // Assign all permissions to admin role
    console.log('Assigning permissions to admin role...');
    for (const permission of permissions) {
      // Check if role-permission association already exists
      const existing = await rolePermissionRepository.findOneBy({
        roleId: adminRole.id,
        permissionId: permission.id
      });
      
      if (!existing) {
        const rolePermission = rolePermissionRepository.create({
          roleId: adminRole.id,
          permissionId: permission.id
        });
        await rolePermissionRepository.save(rolePermission);
        console.log(`Assigned permission ${permission.name} to admin role`);
      } else {
        console.log(`Permission ${permission.name} already assigned to admin role`);
      }
    }

    // Find the first user (your employee account)
    console.log('Finding user to assign admin role...');
    const userRepository = dataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: {},
      order: { id: 'ASC' }
    });

    if (user) {
      console.log(`Found user with ID: ${user.id}, employee ID: ${user.id_employee}`);
      
      // Check if user already has admin role
      const existingUserRole = await userRoleRepository.findOneBy({
        userId: user.id,
        roleId: adminRole.id
      });
      
      if (!existingUserRole) {
        // Assign admin role to user
        const userRole = userRoleRepository.create({
          userId: user.id,
          roleId: adminRole.id
        });
        await userRoleRepository.save(userRole);
        console.log(`Assigned admin role to user ${user.id}`);
      } else {
        console.log(`User ${user.id} already has admin role`);
      }
    } else {
      console.log('No users found in database');
    }

    console.log('Permission initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing permissions:', error);
  } finally {
    // Close the database connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the initialization
initPermissions();