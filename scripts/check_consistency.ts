import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (!BUCKET_NAME) {
  console.error("GCS_BUCKET_NAME is not set in .env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

const db = getFirestore();
const storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
const bucket = storage.bucket(BUCKET_NAME);

async function main() {
  console.log("Checking consistency between Firestore and Cloud Storage...");
  console.log(`Bucket: ${BUCKET_NAME}`);

  // 1. Get all files in Cloud Storage
  console.log("Fetching files from GCS...");
  const [files] = await bucket.getFiles();
  const storageFiles = new Set(files.map(f => `https://storage.googleapis.com/${BUCKET_NAME}/${f.name}`));
  console.log(`Found ${storageFiles.size} files in GCS.`);

  // 2. Get all file references in Firestore
  console.log("Fetching references from Firestore...");
  const firestoreFiles = new Set<string>();

  // Feeds (cover images)
  const feedsSnapshot = await db.collection('feeds').get();
  let feedCount = 0;
  feedsSnapshot.forEach(doc => {
    feedCount++;
    const data = doc.data();
    if (data.cover_image_url) {
      firestoreFiles.add(data.cover_image_url);
    }
  });
  console.log(`Found ${feedCount} feeds.`);

  // Items (media files)
  const itemsSnapshot = await db.collection('items').get();
  let itemCount = 0;
  itemsSnapshot.forEach(doc => {
    itemCount++;
    const data = doc.data();
    if (data.media_url) {
      firestoreFiles.add(data.media_url);
    }
  });
  console.log(`Found ${itemCount} items.`);

  console.log(`Found ${firestoreFiles.size} total unique file references in Firestore.`);

  // 3. Compare
  console.log("\n--- Comparison Results ---");

  // Missing files (in Firestore but not in GCS)
  const missingInGCS: string[] = [];
  for (const ref of firestoreFiles) {
    if (!storageFiles.has(ref)) {
      missingInGCS.push(ref);
    }
  }

  // Orphaned files (in GCS but not in Firestore)
  const orphanedInGCS: string[] = [];
  for (const file of storageFiles) {
    if (!firestoreFiles.has(file)) {
      orphanedInGCS.push(file);
    }
  }

  console.log(`\nFiles missing in GCS (referenced in DB but don't exist in bucket): ${missingInGCS.length}`);
  if (missingInGCS.length > 0) {
    missingInGCS.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (missingInGCS.length > 10) console.log(`  ... and ${missingInGCS.length - 10} more`);
  }

  console.log(`\nOrphaned files in GCS (exist in bucket but not referenced in DB): ${orphanedInGCS.length}`);
  if (orphanedInGCS.length > 0) {
    orphanedInGCS.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (orphanedInGCS.length > 10) console.log(`  ... and ${orphanedInGCS.length - 10} more`);
  }

  if (missingInGCS.length === 0 && orphanedInGCS.length === 0) {
    console.log("\n✅ Firestore and Cloud Storage are perfectly consistent!");
  } else {
    console.log("\n❌ Inconsistencies found.");
  }
}

main().catch(console.error);
