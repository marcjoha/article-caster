import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { deleteFile } from './storage';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export const db = getFirestore();

export interface Feed {
  id?: string;
  title: string;
  description: string;
  author?: string;
  category?: string;
  unguessable_slug: string;
  cover_image_url?: string;
  tts_voice?: string;
  audio_prefix_message?: string;
  chat_webhook_url?: string;
  processed_urls?: string[];
  created_at: Date;
}

export interface FeedItem {
  id?: string;
  feed_id: string;
  title: string;
  description: string;
  source_url: string;
  media_url: string;
  type: 'audio';
  size_bytes: number;
  duration_seconds: number;
  created_at: Date;
  origin?: 'article' | 'rss' | 'youtube';
}

export const createFeed = async (feed: Omit<Feed, 'id' | 'created_at'>) => {
  const docRef = db.collection('feeds').doc();
  const data: Feed = {
    ...feed,
    id: docRef.id,
    created_at: new Date(),
  };
  await docRef.set(data);
  return data;
};

export const updateFeed = async (feedId: string, updates: Partial<Omit<Feed, 'id' | 'created_at'>>) => {
  await db.collection('feeds').doc(feedId).update(updates);
};

export const deleteFeed = async (feedId: string) => {
  const batch = db.batch();
  const deleteFilePromises: Promise<void>[] = [];

  // 1. Cascade: delete all child items and their GCS audio files
  const itemsSnapshot = await db.collection('items').where('feed_id', '==', feedId).get();
  itemsSnapshot.docs.forEach(doc => {
    const itemData = doc.data() as FeedItem;
    if (itemData.media_url) {
      deleteFilePromises.push(
        deleteFile(itemData.media_url).catch(e => console.error('Failed to delete media file:', e))
      );
    }
    batch.delete(doc.ref);
  });

  // 2. Cascade: delete all ingestion records
  const ingestionsSnapshot = await db.collection('ingestions').where('feed_id', '==', feedId).get();
  ingestionsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  // 3. Cascade: delete all syndication records
  const syndicationsSnapshot = await db.collection('syndications').where('feed_id', '==', feedId).get();
  syndicationsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  // 4. Delete the feed itself (cover image + document) — last, so retries can re-discover children
  const feedDoc = await db.collection('feeds').doc(feedId).get();
  if (feedDoc.exists) {
    const feedData = feedDoc.data() as Feed;
    if (feedData.cover_image_url) {
      deleteFilePromises.push(
        deleteFile(feedData.cover_image_url).catch(e => console.error('Failed to delete cover image:', e))
      );
    }
  }
  batch.delete(db.collection('feeds').doc(feedId));

  // Commit all Firestore deletes atomically, then wait for GCS cleanup
  await batch.commit();
  await Promise.allSettled(deleteFilePromises);
};

export const getFeeds = async (): Promise<Feed[]> => {
  const snapshot = await db.collection('feeds').orderBy('created_at', 'desc').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { ...data, created_at: data.created_at.toDate() } as Feed;
  });
};

export const getFeedBySlug = async (slug: string): Promise<Feed | null> => {
  const snapshot = await db.collection('feeds').where('unguessable_slug', '==', slug).limit(1).get();
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { ...data, created_at: data.created_at.toDate() } as Feed;
};

export const createFeedItem = async (item: Omit<FeedItem, 'id' | 'created_at'> & { created_at?: Date }) => {
  const docRef = db.collection('items').doc();
  const data: FeedItem = {
    ...item,
    id: docRef.id,
    created_at: item.created_at || new Date(),
  };
  await docRef.set(data);
  return data;
};

export const getFeedItems = async (feedId: string): Promise<FeedItem[]> => {
  const snapshot = await db.collection('items')
    .where('feed_id', '==', feedId)
    .orderBy('created_at', 'desc')
    .get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { ...data, created_at: data.created_at.toDate() } as FeedItem;
  });
};

export const getFeedItemById = async (itemId: string): Promise<FeedItem | null> => {
  const doc = await db.collection('items').doc(itemId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return { ...data, id: doc.id, created_at: data.created_at.toDate() } as FeedItem;
};

export const updateFeedItem = async (itemId: string, updates: Partial<FeedItem>) => {
  await db.collection('items').doc(itemId).update(updates);
};

export const deleteFeedItem = async (itemId: string) => {
  const itemDoc = await db.collection('items').doc(itemId).get();
  if (itemDoc.exists) {
    const itemData = itemDoc.data() as FeedItem;
    if (itemData.media_url) {
      await deleteFile(itemData.media_url);
    }
  }

  await db.collection('items').doc(itemId).delete();
};

export interface Ingestion {
  id?: string;
  feed_id: string;
  url: string;
  status: string;
  error?: string;
  origin?: 'article' | 'rss' | 'youtube';
  created_at?: FirebaseFirestore.Timestamp | Date;
}

export const createIngestion = async (ingestion: Omit<Ingestion, 'id' | 'created_at' | 'status'>) => {
  const docRef = db.collection('ingestions').doc();
  const data: Ingestion = {
    ...ingestion,
    id: docRef.id,
    status: 'pending',
    created_at: new Date(),
  };
  await docRef.set(data);
  return data;
};

export const updateIngestion = async (id: string, updates: Partial<Pick<Ingestion, 'status' | 'error'>>) => {
  await db.collection('ingestions').doc(id).set(updates, { merge: true });
};

export const getActiveIngestions = async (feedId: string): Promise<Ingestion[]> => {
  const snapshot = await db.collection('ingestions')
    .where('feed_id', '==', feedId)
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();
    
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { id: doc.id, ...data, created_at: data.created_at.toDate() } as Ingestion;
  });
};

/**
 * Adds a URL to the feed's processed_urls set.
 * This prevents the RSS cron from re-ingesting articles that have been
 * successfully processed or explicitly cleared by the user.
 */
export const addProcessedUrl = async (feedId: string, url: string) => {
  const { FieldValue } = await import('firebase-admin/firestore');
  await db.collection('feeds').doc(feedId).update({
    processed_urls: FieldValue.arrayUnion(url),
  });
};

/**
 * Returns the set of URLs that have been processed for a feed.
 * Used by the RSS cron to avoid re-ingesting deleted or cleared articles.
 */
export const getProcessedUrls = async (feedId: string): Promise<Set<string>> => {
  const feedDoc = await db.collection('feeds').doc(feedId).get();
  const data = feedDoc.data() as Feed | undefined;
  return new Set(data?.processed_urls || []);
};

export const clearFailedIngestions = async (feedId: string) => {
  const snapshot = await db.collection('ingestions')
    .where('feed_id', '==', feedId)
    .get();

  const batch = db.batch();
  const clearedUrls: string[] = [];
  snapshot.docs.forEach(doc => {
    if (doc.data().status === 'failed') {
      clearedUrls.push(doc.data().url);
      batch.delete(doc.ref);
    }
  });

  await batch.commit();

  // Mark cleared URLs as processed so the RSS cron doesn't re-ingest them
  if (clearedUrls.length > 0) {
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.collection('feeds').doc(feedId).update({
      processed_urls: FieldValue.arrayUnion(...clearedUrls),
    });
  }
};

export const deleteIngestion = async (id: string) => {
  await db.collection('ingestions').doc(id).delete();
};

export interface Syndication {
  id?: string;
  feed_id: string;
  url: string;
  title?: string;
  last_checked_at?: Date;
  created_at: Date;
}

export const createSyndication = async (syndication: Omit<Syndication, 'id' | 'created_at'>) => {
  const docRef = db.collection('syndications').doc();
  const data: Syndication = {
    ...syndication,
    id: docRef.id,
    created_at: new Date(),
  };
  await docRef.set(data);
  return data;
};

export const getSyndications = async (feedId: string): Promise<Syndication[]> => {
  const snapshot = await db.collection('syndications')
    .where('feed_id', '==', feedId)
    .orderBy('created_at', 'desc')
    .get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      ...data, 
      created_at: data.created_at.toDate(),
      last_checked_at: data.last_checked_at ? data.last_checked_at.toDate() : undefined
    } as Syndication;
  });
};

export const getAllSyndications = async (): Promise<Syndication[]> => {
  const snapshot = await db.collection('syndications').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      ...data, 
      created_at: data.created_at.toDate(),
      last_checked_at: data.last_checked_at ? data.last_checked_at.toDate() : undefined
    } as Syndication;
  });
};

export const updateSyndication = async (id: string, updates: Partial<Pick<Syndication, 'last_checked_at' | 'title'>>) => {
  await db.collection('syndications').doc(id).update(updates);
};

export const deleteSyndication = async (id: string) => {
  await db.collection('syndications').doc(id).delete();
};

