const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL
  });

  try {
    console.log('🔍 Testing raw PostgreSQL connection...');
    console.log(`📍 Connection string: ${process.env.DIRECT_URL?.replace(/:([^@]+)@/, ':****@')}`);

    await client.connect();
    console.log('✅ Connected successfully!');

    const result = await client.query('SELECT current_user, current_database(), version()');
    console.log('\n📊 Connection details:');
    console.log(`   User: ${result.rows[0].current_user}`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);

    const userCount = await client.query('SELECT COUNT(*) FROM "User"');
    console.log(`\n👥 User count: ${userCount.rows[0].count}`);

    await client.end();
    console.log('\n✅ Test passed - credentials are valid!');
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

testConnection();
