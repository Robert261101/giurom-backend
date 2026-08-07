/**
 * One-off GIU-09 persistence check for supplier_products.storage_location.
 * Run: npx ts-node -P suppliers-ms/tsconfig.json suppliers-ms/scripts/verify-storage-location.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SupplierProduct } from '../src/suppliers/entities/supplier-product.entity';

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3307),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'giurombitap_suppliers',
    entities: [SupplierProduct],
    synchronize: false,
    logging: true,
  });

  await ds.initialize();
  const repo = ds.getRepository(SupplierProduct);
  const colNames = repo.metadata.columns.map((c) => c.databaseName);
  console.log('has_storage_location_column_metadata', colNames.includes('storage_location'));

  const product =
    (await repo.findOne({ where: { id: 9 } })) ||
    (await repo.findOne({ where: { product_name: 'Faina' as any } }));

  if (!product) {
    throw new Error('Product Faina / id=9 not found');
  }

  console.log('before', { id: product.id, name: product.product_name, storage_location: product.storage_location });

  product.storage_location = 'Raft A3';
  const saved = await repo.save(product);
  console.log('after_save', { id: saved.id, storage_location: saved.storage_location });

  const reloaded = await repo.findOne({ where: { id: saved.id } });
  console.log('after_reload', {
    id: reloaded?.id,
    storage_location: reloaded?.storage_location,
  });

  await ds.destroy();

  if (reloaded?.storage_location !== 'Raft A3') {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
