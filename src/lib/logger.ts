/**
 * Centralized activity logger.
 * Writes structured log entries to both console (for Cloud Logging) and
 * Firestore (for the admin UI). Fire-and-forget — never throws or blocks.
 */
import { createLogEntry } from './firestore';

export async function logActivity(entry: {
  feedId: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  details?: string;
}): Promise<void> {
  // Skip Firestore writes for missing/empty feedIds (e.g. test-webhook calls).
  // This prevents orphan log entries referencing non-existent feeds.
  if (!entry.feedId) return;

  try {
    await createLogEntry({
      feed_id: entry.feedId,
      level: entry.level,
      category: entry.category,
      message: entry.message,
      details: entry.details,
    });
  } catch (error) {
    // Never break the caller — log to console only
    console.error('Failed to write activity log:', error);
  }
}
