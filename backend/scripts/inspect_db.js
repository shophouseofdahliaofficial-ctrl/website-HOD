const { Client } = require('pg');
const dbUrl = 'postgresql://postgres.vulmjlmhylizgxotswmu:PZqoI0oLWgF9xgut@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL!');
    
    const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'site_content';");
    console.log('site_content columns:', cols.rows);
    
    const rows = await client.query('SELECT * FROM site_content LIMIT 10;');
    console.log('site_content rows:', rows.rows);

    const bannerRows = await client.query('SELECT * FROM banners LIMIT 10;');
    console.log('banner rows:', bannerRows.rows);

    const prodRows = await client.query('SELECT id, name, image_url FROM products LIMIT 10;');
    console.log('product rows:', prodRows.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
