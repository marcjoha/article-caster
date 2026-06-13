import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// 1. Load environment variables
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

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (!PROJECT_ID || !BUCKET_NAME) {
  console.error('Error: GOOGLE_CLOUD_PROJECT and GCS_BUCKET_NAME must be set in .env');
  process.exit(1);
}

async function main() {
  console.log('==================================================');
  console.log('🛠️ PRODUCTION DATA INTEGRITY REPAIR TOOL 🛠️');
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`GCS Bucket Name: ${BUCKET_NAME}`);
  console.log('==================================================\n');

  const { db } = await import('../src/lib/firestore');
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  // --- 1. Clean up Orphan Log Entry referencing non-existent Feed ---
  const orphanLogId = '8kTcY30XSnDgPKtZfUt2';
  console.log(`Checking orphan log document "${orphanLogId}"...`);
  const orphanLogRef = db.collection('logs').doc(orphanLogId);
  const orphanLogDoc = await orphanLogRef.get();
  
  if (orphanLogDoc.exists) {
    console.log(`Found orphan log referencing non-existent Feed ID "${orphanLogDoc.data()?.feed_id}". Deleting...`);
    await orphanLogRef.delete();
    console.log(`✅ Successfully deleted orphan log "${orphanLogId}".`);
  } else {
    console.log(`Orphan log "${orphanLogId}" does not exist (already cleaned).`);
  }

  // --- 2. Clean up Logs with non-strict Details field (must be exactly a URL) ---
  console.log('\nScanning logs for non-strict details URL formatting...');
  const logsSnapshot = await db.collection('logs').get();
  let repairedLogsCount = 0;

  for (const doc of logsSnapshot.docs) {
    const data = doc.data();
    if (data.details) {
      const detailsStr = String(data.details).trim();
      
      // Check if details is already a strict valid URL
      let isStrictUrl = false;
      try {
        new URL(detailsStr);
        // If it compiles as URL, let's verify it doesn't contain surrounding text
        isStrictUrl = !detailsStr.includes(' ') && !detailsStr.includes('\n');
      } catch (e) {}

      if (!isStrictUrl) {
        // Extract URL from string using regex
        const urlMatch = detailsStr.match(/https?:\/\/[^\s,)]+/);
        if (urlMatch) {
          const strictUrl = urlMatch[0];
          console.log(`Repairing log "${doc.id}":`);
          console.log(`  - Original: "${detailsStr}"`);
          console.log(`  + Extracted strict URL: "${strictUrl}"`);
          
          await doc.ref.update({ details: strictUrl });
          repairedLogsCount++;
        } else {
          console.warn(`⚠️ Log "${doc.id}" has invalid details "${detailsStr}" but no URL could be extracted.`);
        }
      }
    }
  }
  console.log(`✅ Repaired ${repairedLogsCount} log entries to use strict URLs.`);

  // --- 3. Clean up Orphan GCS File ---
  const orphanGcsPath = 'content/pdf/24951776b5e020f7f324601aa4a538463263b04bc2dc76bd2449fc67ca98b6cb.pdf';
  console.log(`\nChecking orphan GCS file "${orphanGcsPath}"...`);
  const file = bucket.file(orphanGcsPath);
  const [exists] = await file.exists();
  
  if (exists) {
    console.log(`Orphan GCS file found. Deleting to restore 100% parity...`);
    await file.delete();
    console.log(`✅ Successfully deleted orphan file "${orphanGcsPath}" from GCS.`);
  } else {
    console.log(`Orphan GCS file "${orphanGcsPath}" does not exist in the bucket (already cleaned).`);
  }

  console.log('\n==================================================');
  console.log('🎉 REPAIR AND CLEANUP OPERATION COMPLETED 🎉');
  console.log('==================================================\n');
}

main().catch(console.error);
