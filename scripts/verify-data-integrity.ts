import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// 1. Load environment variables first
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

// Ensure critical variables are set
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

if (!PROJECT_ID || !BUCKET_NAME) {
  console.error('Error: GOOGLE_CLOUD_PROJECT and GCS_BUCKET_NAME must be set in .env');
  process.exit(1);
}

async function main() {
  console.log('==================================================');
  console.log('🔍 PRODUCTION DATA & DATE INTEGRITY VERIFIER 🔍');
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`GCS Bucket Name: ${BUCKET_NAME}`);
  console.log('==================================================\n');

  // Initialize Services
  const { db } = await import('../src/lib/firestore');
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  // Stats trackers
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalChecks = 0;

  function reportError(message: string) {
    totalErrors++;
    console.error(`❌ [ERROR] ${message}`);
  }

  function reportWarning(message: string) {
    totalWarnings++;
    console.warn(`⚠️ [WARNING] ${message}`);
  }

  function reportSuccess(message: string) {
    console.log(`✅ [OK] ${message}`);
  }

  // --- STEP 1: Query GCS Bucket Files to Pre-populate Cache ---
  console.log('📦 Fetching files in GCS bucket to populate local cache...');
  const filesMap = new Map<string, { size: number; timeCreated: Date; name: string }>();
  try {
    const [files] = await bucket.getFiles();
    console.log(`Found ${files.length} physical files in GCS.`);
    files.forEach(file => {
      const metadata = file.metadata;
      filesMap.set(file.name, {
        size: parseInt(String(metadata.size), 10) || 0,
        timeCreated: new Date(metadata.timeCreated),
        name: file.name,
      });
    });
  } catch (e: any) {
    reportError(`Failed to fetch files from GCS bucket: ${e.message}`);
    process.exit(1);
  }
  console.log('GCS files cached successfully.\n');

  // Track referenced GCS paths to find orphans later
  const referencedGcsPaths = new Set<string>();

  // --- STEP 2: Verify Feeds ---
  console.log('📋 Verifying FEEDS collection...');
  const feedsSnapshot = await db.collection('feeds').get();
  console.log(`Retrieved ${feedsSnapshot.size} feeds.`);

  const feedsMap = new Map<string, any>();
  const unguessableSlugs = new Set<string>();

  feedsSnapshot.docs.forEach(doc => {
    totalChecks++;
    const data = doc.data();
    feedsMap.set(doc.id, { id: doc.id, ...data });

    console.log(`\nAnalyzing Feed ID: ${doc.id} ("${data.title}")`);

    // Check slug uniqueness & validity
    if (!data.unguessable_slug || typeof data.unguessable_slug !== 'string') {
      reportError(`Feed ${doc.id} has missing or invalid unguessable_slug.`);
    } else if (unguessableSlugs.has(data.unguessable_slug)) {
      reportError(`Feed ${doc.id} has a duplicate unguessable_slug: "${data.unguessable_slug}".`);
    } else {
      unguessableSlugs.add(data.unguessable_slug);
    }

    // Check created_at date integrity
    if (!data.created_at) {
      reportError(`Feed ${doc.id} is missing created_at timestamp.`);
    } else {
      const createdAt = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      if (isNaN(createdAt.getTime())) {
        reportError(`Feed ${doc.id} has invalid created_at timestamp.`);
      } else {
        reportSuccess(`Feed created_at date is valid: ${createdAt.toISOString()}`);
      }
    }

    // Check cover image existence in GCS
    if (data.cover_image_url) {
      const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
      if (data.cover_image_url.startsWith(prefix)) {
        const filePath = data.cover_image_url.substring(prefix.length);
        referencedGcsPaths.add(filePath);
        const cachedFile = filesMap.get(filePath);

        if (!cachedFile) {
          reportError(`Cover image file "${filePath}" does not exist in GCS.`);
        } else {
          reportSuccess(`Cover image exists in GCS: "${filePath}" (${cachedFile.size} bytes)`);
        }
      } else {
        reportWarning(`Cover image URL "${data.cover_image_url}" is external or uses a non-standard bucket structure.`);
      }
    }
  });

  // --- STEP 3: Verify Items (Episodes) ---
  console.log('\n🎙️ Verifying ITEMS (Episodes) collection...');
  const itemsSnapshot = await db.collection('items').get();
  console.log(`Retrieved ${itemsSnapshot.size} episodes.`);

  itemsSnapshot.docs.forEach(doc => {
    totalChecks++;
    const data = doc.data();
    console.log(`\nAnalyzing Episode ID: ${doc.id} ("${data.title}")`);

    // Referential integrity: check if parent feed exists
    const feed = feedsMap.get(data.feed_id);
    if (!feed) {
      reportError(`Episode ${doc.id} references non-existent Feed ID: "${data.feed_id}".`);
    } else {
      reportSuccess(`Episode references valid Feed ID: "${data.feed_id}" ("${feed.title}")`);
    }

    // Origin validation
    const validOrigins = ['article', 'rss', 'youtube', 'pdf'];
    if (!data.origin || !validOrigins.includes(data.origin)) {
      reportError(`Episode ${doc.id} has invalid origin: "${data.origin}". Must be one of: ${validOrigins.join(', ')}`);
    }

    // Type validation
    if (data.type !== 'audio' && data.type !== 'video') {
      reportError(`Episode ${doc.id} has invalid type: "${data.type}". Must be 'audio' or 'video'`);
    }

    // Size and Duration integrity
    if (typeof data.size_bytes !== 'number' || data.size_bytes <= 0) {
      reportError(`Episode ${doc.id} has invalid size_bytes: ${data.size_bytes}`);
    }
    if (typeof data.duration_seconds !== 'number' || data.duration_seconds <= 0) {
      reportError(`Episode ${doc.id} has invalid duration_seconds: ${data.duration_seconds}`);
    }

    // Date integrity
    let episodeCreated: Date | null = null;
    if (!data.created_at) {
      reportError(`Episode ${doc.id} is missing created_at timestamp.`);
    } else {
      episodeCreated = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      if (isNaN(episodeCreated.getTime())) {
        reportError(`Episode ${doc.id} has invalid created_at timestamp.`);
        episodeCreated = null;
      } else {
        reportSuccess(`Episode created_at date is valid: ${episodeCreated.toISOString()}`);
        
        // Temporal ordering: episode cannot be older than the feed
        if (feed) {
          const feedCreated = feed.created_at.toDate ? feed.created_at.toDate() : new Date(feed.created_at);
          // Allow small buffer (1 minute) for edge cases or clock offsets
          if (episodeCreated.getTime() < feedCreated.getTime() - 60000) {
            reportError(`Episode "${data.title}" was created on ${episodeCreated.toISOString()} but its parent Feed "${feed.title}" was created later on ${feedCreated.toISOString()}!`);
          }
        }
      }
    }

    // Media file physical validation & date integrity cross-check
    if (data.media_url) {
      const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
      if (data.media_url.startsWith(prefix)) {
        const filePath = data.media_url.substring(prefix.length);
        referencedGcsPaths.add(filePath);
        const cachedFile = filesMap.get(filePath);

        if (!cachedFile) {
          reportError(`Episode media file "${filePath}" does not exist in GCS.`);
        } else {
          // Compare file size metadata
          if (cachedFile.size !== data.size_bytes) {
            reportWarning(`Episode size discrepancy! DB says ${data.size_bytes} bytes, GCS has ${cachedFile.size} bytes.`);
          } else {
            reportSuccess(`Media file size matches exactly: ${cachedFile.size} bytes`);
          }

          // Cross-check GCS file creation time with DB document creation time
          if (episodeCreated) {
            const timeDiffMs = Math.abs(cachedFile.timeCreated.getTime() - episodeCreated.getTime());
            const timeDiffSec = timeDiffMs / 1000;
            
            // Files processed via Cloud Tasks or upload might have small differences. 
            // If they are more than 3 hours apart, flag as warning (since pubDates can be back-dated for RSS syndication, which is expected!)
            if (timeDiffSec > 10800) { 
              if (data.origin === 'rss') {
                reportSuccess(`GCS creation time (${cachedFile.timeCreated.toISOString()}) differs from RSS pubDate (${episodeCreated.toISOString()}). (Expected: RSS back-dating is correct).`);
              } else {
                reportWarning(`High temporal variance! Episode DB creation is ${episodeCreated.toISOString()} but GCS file creation is ${cachedFile.timeCreated.toISOString()} (Diff: ${(timeDiffSec/3600).toFixed(2)} hours).`);
              }
            } else {
              reportSuccess(`GCS file creation is highly synchronized with DB: Diff is ${(timeDiffSec).toFixed(1)}s.`);
            }
          }
        }
      } else {
        reportError(`Episode media URL "${data.media_url}" does not match standard GCS path structure.`);
      }
    } else {
      reportError(`Episode ${doc.id} has missing media_url.`);
    }
  });

  // --- STEP 4: Verify Log Events ---
  console.log('\n📜 Verifying LOGS collection...');
  const logsSnapshot = await db.collection('logs').get();
  console.log(`Retrieved ${logsSnapshot.size} log entries.`);

  const validCategories = ['ingestion', 'rss', 'chat', 'feed', 'episode'];
  const validLevels = ['info', 'warn', 'error'];

  logsSnapshot.docs.forEach(doc => {
    totalChecks++;
    const data = doc.data();

    // Referential integrity check
    const feed = feedsMap.get(data.feed_id);
    if (!feed) {
      reportError(`Log ${doc.id} references non-existent Feed ID: "${data.feed_id}".`);
    }

    // Date integrity
    if (!data.created_at) {
      reportError(`Log ${doc.id} is missing created_at timestamp.`);
    } else {
      const logCreated = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      if (isNaN(logCreated.getTime())) {
        reportError(`Log ${doc.id} has invalid created_at timestamp.`);
      }
    }

    // Category and level validation
    if (!validLevels.includes(data.level)) {
      reportError(`Log ${doc.id} has invalid level: "${data.level}"`);
    }
    if (!validCategories.includes(data.category)) {
      reportError(`Log ${doc.id} has invalid category: "${data.category}"`);
    }

    // Details URL structural validation (Required by specification to be exactly and only a valid URL)
    if (!data.details) {
      reportError(`Log ${doc.id} is missing required details field.`);
    } else {
      try {
        const url = new URL(data.details);
        // Verify GCS URLs in logs if they refer to our bucket
        const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
        if (data.details.startsWith(prefix)) {
          const filePath = data.details.substring(prefix.length);
          const cachedFile = filesMap.get(filePath);
          if (!cachedFile) {
            reportWarning(`Log ${doc.id} details point to a GCS file "${filePath}" that is missing.`);
          }
        }
      } catch (e) {
        reportError(`Log ${doc.id} details field contains an invalid URL: "${data.details}" (details field must strictly be a valid URL).`);
      }
    }
  });

  // --- STEP 5: Verify Syndications ---
  console.log('\n📡 Verifying SYNDICATIONS collection...');
  const syndicationsSnapshot = await db.collection('syndications').get();
  console.log(`Retrieved ${syndicationsSnapshot.size} syndications.`);

  syndicationsSnapshot.docs.forEach(doc => {
    totalChecks++;
    const data = doc.data();

    // Referential integrity
    const feed = feedsMap.get(data.feed_id);
    if (!feed) {
      reportError(`Syndication ${doc.id} references non-existent Feed ID: "${data.feed_id}".`);
    }

    // Date validation
    if (!data.created_at) {
      reportError(`Syndication ${doc.id} is missing created_at timestamp.`);
    } else {
      const created = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      if (isNaN(created.getTime())) {
        reportError(`Syndication ${doc.id} has invalid created_at timestamp.`);
      }
    }

    if (data.last_checked_at) {
      const checked = data.last_checked_at.toDate ? data.last_checked_at.toDate() : new Date(data.last_checked_at);
      if (isNaN(checked.getTime())) {
        reportError(`Syndication ${doc.id} has invalid last_checked_at timestamp.`);
      }
    }
  });

  // --- STEP 6: Verify Ingestions (Ephemerals) ---
  console.log('\n⚙️ Verifying INGESTIONS collection...');
  const ingestionsSnapshot = await db.collection('ingestions').get();
  console.log(`Retrieved ${ingestionsSnapshot.size} active ingestions.`);

  ingestionsSnapshot.docs.forEach(doc => {
    totalChecks++;
    const data = doc.data();

    // Referential integrity
    const feed = feedsMap.get(data.feed_id);
    if (!feed) {
      reportError(`Ingestion ${doc.id} references non-existent Feed ID: "${data.feed_id}".`);
    }

    // Date validation
    if (!data.created_at) {
      reportError(`Ingestion ${doc.id} is missing created_at timestamp.`);
    } else {
      const created = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      if (isNaN(created.getTime())) {
        reportError(`Ingestion ${doc.id} has invalid created_at timestamp.`);
      }
    }

    // Ingestions should not linger forever
    if (data.created_at) {
      const created = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
      const ageHours = (Date.now() - created.getTime()) / 3600000;
      if (ageHours > 24) {
        reportWarning(`Ingestion task ${doc.id} has been active/pending for ${ageHours.toFixed(1)} hours (older than 24h limit).`);
      }
    }
  });

  // --- STEP 7: Detect Orphan Cloud Storage Files ---
  console.log('\n🧹 Checking for Orphan Files in Cloud Storage...');
  let orphanCount = 0;
  let totalOrphanBytes = 0;

  filesMap.forEach((meta, filePath) => {
    if (!referencedGcsPaths.has(filePath)) {
      orphanCount++;
      totalOrphanBytes += meta.size;
      reportWarning(`Orphan file found in GCS: "${filePath}" (${(meta.size / 1024 / 1024).toFixed(2)} MB) created on ${meta.timeCreated.toISOString()}`);
    }
  });

  if (orphanCount === 0) {
    reportSuccess('No orphan GCS files found! Perfect storage synchronization.');
  } else {
    console.log(`\n🧹 Summary: Found ${orphanCount} orphan files totalling ${(totalOrphanBytes / 1024 / 1024).toFixed(2)} MB in Cloud Storage.`);
  }

  // --- STEP 8: SUMMARY REPORT ---
  console.log('\n==================================================');
  console.log('📊 INTEGRITY VERIFICATION SUMMARY REPORT 📊');
  console.log('==================================================');
  console.log(`Total Checks Executed : ${totalChecks}`);
  console.log(`Total Errors Found    : ${totalErrors}`);
  console.log(`Total Warnings Found  : ${totalWarnings}`);
  
  if (totalErrors === 0) {
    console.log('\n🏆 RESULT: PASS 🏆');
    console.log('The production database metadata, episode data, log events, and GCS files are in perfect integrity!');
  } else {
    console.log('\n⚠️ RESULT: FAIL ⚠️');
    console.log('There are active data integrity errors that should be reviewed and resolved.');
  }
  console.log('==================================================\n');
}

main().catch(console.error);
