import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const databaseUrl = process.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  console.error('VITE_DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigrations() {
  console.log('Running migrations...');
  const client = await pool.connect();

  try {
    // Run migration 001
    console.log('Running 001_create_instagram_analysis_tables.sql...');
    const migration001 = readFileSync(
      join(process.cwd(), 'db/migrations/001_create_instagram_analysis_tables.sql'),
      'utf-8'
    );
    await client.query(migration001);
    console.log('✓ Migration 001 completed');

    // Run migration 002
    console.log('Running 002_add_multi_tenant_auth.sql...');
    const migration002 = readFileSync(
      join(process.cwd(), 'db/migrations/002_add_multi_tenant_auth.sql'),
      'utf-8'
    );
    await client.query(migration002);
    console.log('✓ Migration 002 completed');

    // Run migration 003
    console.log('Running 003_add_ai_usage_tracking.sql...');
    const migration003 = readFileSync(
      join(process.cwd(), 'db/migrations/003_add_ai_usage_tracking.sql'),
      'utf-8'
    );
    await client.query(migration003);
    console.log('✓ Migration 003 completed');

    // Create default organization
    console.log('Creating default organization...');
    await client.query(`
      INSERT INTO organizations (name, slug, plan, status, max_users, max_analyses_per_month, ai_token_budget_monthly)
      VALUES ('Default Organization', 'default', 'professional', 'active', 100, 10000, 10000000)
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('✓ Default organization created');

    // Verify tables
    console.log('\nVerifying tables...');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in database:');
    tables.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));

    console.log('\n✓ All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
