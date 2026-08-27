/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// 1. Load environment variables from .env
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
  }
} catch (e) {
  console.warn('Could not read .env file:', e);
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
if (!PROJECT_ID) {
  console.error('Error: GOOGLE_CLOUD_PROJECT must be set in .env');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = getFirestore();

// Helper to clean title strings with regex fallback
function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/\s*\|\s*Google Antigravity Blog\s*$/i, '')
    .replace(/^Google Antigravity Blog:\s*/i, '')
    .trim();
}

async function main() {
  console.log('====================================================');
  console.log(`🧹 FIX HISTORICAL ANTIGRAVITY BLOG TITLES ${isDryRun ? '(DRY RUN)' : '(LIVE)'} 🧹`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log('====================================================\n');

  // 1. Fetch the live Antigravity RSS feed for exact matching
  const parser = new Parser();
  const urlToCleanTitleMap = new Map();

  try {
    console.log('Fetching live upstream Antigravity RSS feed...');
    const feed = await parser.parseURL('https://storage.googleapis.com/antigravity-blog-feed/rss.xml');
    if (feed.items) {
      for (const item of feed.items) {
        if (item.link && item.title) {
          urlToCleanTitleMap.set(item.link.trim(), cleanTitle(item.title));
        }
      }
    }
    console.log(`Loaded ${urlToCleanTitleMap.size} upstream posts from Antigravity RSS feed.\n`);
  } catch (err) {
    console.warn('Could not fetch upstream RSS feed; falling back to pattern matching:', err);
  }

  // 2. Query items belonging to Antigravity RSS syndication
  console.log('Scanning Firestore items for historical Antigravity episodes...');
  const itemsSnapshot = await db.collection('items').get();

  let matchedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of itemsSnapshot.docs) {
    const data = doc.data();
    const sourceUrl = (data.source_url || '').trim();
    const currentTitle = (data.title || '').trim();

    const isAntigravityItem =
      (data.origin === 'rss' || !data.origin) &&
      (sourceUrl.includes('antigravity.google') ||
       data.syndication_title === 'Google Antigravity Blog' ||
       currentTitle.includes('Google Antigravity Blog'));

    if (!isAntigravityItem) {
      continue;
    }

    matchedCount++;

    // Determine target clean title: prefer upstream RSS title if found, otherwise regex cleaner
    const upstreamTitle = urlToCleanTitleMap.get(sourceUrl);
    const targetTitle = upstreamTitle || cleanTitle(currentTitle);

    if (currentTitle === targetTitle) {
      console.log(`  [OK] "${currentTitle}" (ID: ${doc.id}) is already clean.`);
      skippedCount++;
      continue;
    }

    console.log(`\n  [UPDATE] Item ID: ${doc.id}`);
    console.log(`    Source URL:  ${sourceUrl}`);
    console.log(`    Old Title:   "${currentTitle}"`);
    console.log(`    New Title:   "${targetTitle}"`);

    if (!isDryRun) {
      // Update title in-place preserving document ID / RSS <guid>, timestamps, and media references
      await doc.ref.update({
        title: targetTitle,
      });

      // Audit log entry for feed activity
      if (data.feed_id) {
        await db.collection('logs').add({
          feed_id: data.feed_id,
          level: 'info',
          category: 'episode',
          message: `Episode title updated (in-place): "${targetTitle}"`,
          details: sourceUrl || `https://antigravity.google`,
          created_at: new Date(),
        });
      }

      console.log(`    ✅ Updated in-place successfully.`);
    } else {
      console.log(`    🔍 [DRY RUN] Would update in-place.`);
    }

    updatedCount++;
  }

  console.log('\n====================================================');
  console.log(`Summary:`);
  console.log(`  Total Antigravity items matched: ${matchedCount}`);
  console.log(`  Items needing title update:      ${updatedCount}`);
  console.log(`  Items already clean:             ${skippedCount}`);
  console.log(`  Execution mode:                  ${isDryRun ? 'DRY RUN (no changes committed)' : 'LIVE (changes applied)'}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
