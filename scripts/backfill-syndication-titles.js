/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Load environment variables from .env
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

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();

// Known Google Cloud Blog topic/product mappings for fallback
const GC_BLOG_MAPPINGS = [
  { match: '/topics/developers-practitioners/', title: 'Developers & Practitioners' },
  { match: '/products/containers-kubernetes/', title: 'Containers & Kubernetes' },
  { match: '/products/serverless/', title: 'Serverless' },
  { match: '/products/application-development/', title: 'Application Development' },
  { match: '/products/devops-sre/', title: 'DevOps & SRE' },
  { match: '/products/networking/', title: 'Networking' },
  { match: '/products/ai-machine-learning/', title: 'AI & Machine Learning' },
  { match: '/products/management-tools/', title: 'Management Tools' },
  { match: '/topics/ai-infrastructure/', title: 'AI Infrastructure' },
  { match: '/products/identity-security/', title: 'Identity & Security' },
  { match: '/products/data-analytics/', title: 'Data Analytics' },
];

async function main() {
  console.log('Fetching syndications and items from Firestore...');
  const synsSnap = await db.collection('syndications').get();
  const syns = synsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const itemsSnap = await db.collection('items').where('origin', '==', 'rss').get();
  console.log(`Found ${itemsSnap.size} RSS items.`);

  let updatedCount = 0;
  let alreadySetCount = 0;

  for (const doc of itemsSnap.docs) {
    const data = doc.data();
    if (data.syndication_title) {
      alreadySetCount++;
      continue;
    }

    const url = data.source_url || '';
    let resolvedTitle = null;

    // 1. Try matching with active syndications for the item's feed
    const feedSyns = syns.filter(s => s.feed_id === data.feed_id);
    for (const syn of feedSyns) {
      if (!syn.url) continue;
      const cleanSynUrl = syn.url
        .replace(/https?:\/\/[^\/]+\//, '')
        .replace(/\/rss\/?$/, '')
        .replace(/\/feed\/?$/, '')
        .replace(/\.xml$/, '');
      if (cleanSynUrl && url.includes(cleanSynUrl)) {
        resolvedTitle = syn.title;
        break;
      }
    }

    // 2. Try known domain matching
    if (!resolvedTitle) {
      if (url.includes('addyosmani.com')) {
        resolvedTitle = 'AddyOsmani.com';
      } else if (url.includes('antigravity.google')) {
        resolvedTitle = 'Google Antigravity Blog';
      } else if (url.includes('cloud.google.com/blog/')) {
        for (const mapping of GC_BLOG_MAPPINGS) {
          if (url.includes(mapping.match)) {
            resolvedTitle = mapping.title;
            break;
          }
        }
      }
    }

    // 3. Fallback: single syndication on feed
    if (!resolvedTitle && feedSyns.length === 1 && feedSyns[0].title) {
      resolvedTitle = feedSyns[0].title;
    }

    if (resolvedTitle) {
      console.log(`Updating "${data.title}" -> syndication_title: "${resolvedTitle}"`);
      await doc.ref.update({ syndication_title: resolvedTitle });
      updatedCount++;
    } else {
      console.warn(`Could not resolve syndication_title for: "${data.title}" (${url})`);
    }
  }

  console.log(`\nDone! Updated: ${updatedCount}, Already set: ${alreadySetCount}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
