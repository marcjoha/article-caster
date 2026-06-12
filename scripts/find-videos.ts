import fs from 'fs';
import path from 'path';

// Load .env first to ensure environment variables are present before any local library imports
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
    console.log('Loaded environment from .env');
  }
} catch (e) {
  console.warn('Could not read .env file:', e);
}

async function main() {
  console.log('Querying all video items from Firestore...');
  const { db } = await import('../src/lib/firestore');
  const snapshot = await db.collection('items').where('type', '==', 'video').get();
  
  if (snapshot.empty) {
    console.log('No video items found.');
    return;
  }

  console.log(`Found ${snapshot.size} video items:\n`);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`Feed ID: ${data.feed_id}`);
    console.log(`Title: ${data.title}`);
    console.log(`Source URL: ${data.source_url}`);
    console.log(`Media URL: ${data.media_url}`);
    console.log(`Duration: ${data.duration_seconds}s`);
    console.log(`Created At: ${data.created_at.toDate()}`);
    console.log('--------------------------------------------------');
  });
}

main().catch(console.error);
