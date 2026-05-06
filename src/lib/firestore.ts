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
  category?: string;
  unguessable_slug: string;
  cover_image_url?: string;
  tts_voice?: string;
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
  // Fetch the feed first to get cover_image_url
  const feedDoc = await db.collection('feeds').doc(feedId).get();
  if (feedDoc.exists) {
    const feedData = feedDoc.data() as Feed;
    if (feedData.cover_image_url) {
      await deleteFile(feedData.cover_image_url);
    }
  }

  // Delete the feed
  await db.collection('feeds').doc(feedId).delete();
  
  const batch = db.batch();
  const deleteFilePromises: Promise<void>[] = [];

  // Also delete all items associated with this feed
  const itemsSnapshot = await db.collection('items').where('feed_id', '==', feedId).get();
  itemsSnapshot.docs.forEach(doc => {
    const itemData = doc.data() as FeedItem;
    if (itemData.media_url) {
      deleteFilePromises.push(deleteFile(itemData.media_url));
    }
    batch.delete(doc.ref);
  });

  // Also delete all ingestion records associated with this feed
  const ingestionsSnapshot = await db.collection('ingestions').where('feed_id', '==', feedId).get();
  ingestionsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await Promise.all([
    batch.commit(),
    ...deleteFilePromises
  ]);
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

export const createFeedItem = async (item: Omit<FeedItem, 'id' | 'created_at'>) => {
  const docRef = db.collection('items').doc();
  const data: FeedItem = {
    ...item,
    id: docRef.id,
    created_at: new Date(),
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

export const deleteFeedItem = async (itemId: string) => {
  await db.collection('items').doc(itemId).delete();
};

export interface Ingestion {
  id?: string;
  feed_id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  created_at: Date;
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
  await db.collection('ingestions').doc(id).update(updates);
};

export const getActiveIngestions = async (feedId: string): Promise<Ingestion[]> => {
  const snapshot = await db.collection('ingestions')
    .where('feed_id', '==', feedId)
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();
    
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      return { ...data, created_at: data.created_at.toDate() } as Ingestion;
    })
    .filter(ing => ing.status === 'pending' || ing.status === 'processing' || ing.status === 'failed');
};

export const clearFailedIngestions = async (feedId: string) => {
  const snapshot = await db.collection('ingestions')
    .where('feed_id', '==', feedId)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    if (doc.data().status === 'failed') {
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
};
