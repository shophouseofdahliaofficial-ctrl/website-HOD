const { Client } = require('pg');
const dbUrl = 'postgresql://postgres.vulmjlmhylizgxotswmu:PZqoI0oLWgF9xgut@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    
    const newMetadata = {
      widthPx: 130,
      widthPxMobile: 110,
      imageUrl: 'https://res.cloudinary.com/hythbqu9/image/upload/v1789840128/houseofdahlia/logo/house_of_dahlia_logo.jpg',
      imagePublicId: 'houseofdahlia/logo/house_of_dahlia_logo'
    };
    
    await client.query(
      'UPDATE site_content SET metadata = $1 WHERE content_type = $2',
      [JSON.stringify(newMetadata), 'logo']
    );
    console.log('✅ Updated site_content logo in Supabase database!');

    const res = await client.query('SELECT * FROM site_content WHERE content_type = $1', ['logo']);
    console.log('Updated logo row:', res.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
