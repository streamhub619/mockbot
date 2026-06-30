// db/setup.js — cross-platform replacement for shell db:* scripts
// Usage: node db/setup.js [init|seed|reset]

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const action = process.argv[2] || 'init';

const clientConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

async function runSQL(file) {
  const client = new Client(clientConfig);
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  console.log(`▸ Running ${file}...`);
  await client.query(sql);
  await client.end();
  console.log(`  ✓ Done.\n`);
}

async function reset() {
  // Connect to default postgres DB to drop/recreate mockbot_db
  const adminConfig = { ...clientConfig, database: 'postgres' };
  const client = new Client(adminConfig);
  await client.connect();
  const dbName = clientConfig.database || 'mockbot_db';
  console.log(`▸ Dropping and recreating database "${dbName}"...`);
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();
  console.log(`  ✓ Database reset.\n`);
}

(async () => {
  try {
    if (action === 'init') {
      await runSQL('schema.sql');
    } else if (action === 'seed') {
      await runSQL('seed.sql');
    } else if (action === 'reset') {
      await reset();
      await runSQL('schema.sql');
      await runSQL('seed.sql');
    } else {
      console.error(`Unknown action: ${action}. Use init | seed | reset`);
      process.exit(1);
    }
    console.log('All done ✓');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  }
})();