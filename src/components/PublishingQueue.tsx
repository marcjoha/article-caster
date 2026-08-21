'use client';
import { Feed, FeedItem } from '@/lib/firestore';
import { formatDateTime } from '@/lib/utils';
import { DeleteItemButton, ListenAudioButton, PublishItemButton, WatchVideoButton } from './ClientButtons';

interface PublishingQueueProps {
  feed: Feed;
  queuedItems: FeedItem[];
}

function getScheduleSummary(feed: Feed): string {
  if (!feed.rate_limit_enabled) {
    return 'Rate limiter disabled';
  }
  const scheduleType = feed.rate_limit_schedule || 'weekdays';
  let daysStr = 'Weekdays';
  if (scheduleType === 'daily') {
    daysStr = 'Everyday';
  } else if (scheduleType === 'custom' && Array.isArray(feed.rate_limit_days)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysStr = feed.rate_limit_days.map(d => dayNames[d]).join(', ');
  }

  const hourStr = (feed.rate_limit_hour_utc ?? 8).toString().padStart(2, '0') + ':00 UTC';
  const limitStr = `${feed.rate_limit_episodes_per_window || 1}/day`;

  return `${daysStr} @ ${hourStr} · Max ${limitStr}`;
}

export default function PublishingQueue({ feed, queuedItems }: PublishingQueueProps) {
  if (!feed.rate_limit_enabled && queuedItems.length === 0) {
    return null;
  }

  const scheduleSummary = getScheduleSummary(feed);
  const countText = `${queuedItems.length} ${queuedItems.length === 1 ? 'episode' : 'episodes'} queued`;

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: 0 }}>Publishing Queue</h3>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {countText}{feed.rate_limit_enabled ? ` · ${scheduleSummary}` : ''}
        </span>
      </div>

      {queuedItems.length === 0 ? (
        <div style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '8px',
          border: '1px dashed #334155',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
        }}>
          <p style={{ margin: 0 }}>Queue is empty. Incoming episodes will wait here until their scheduled release.</p>
        </div>
      ) : (
        <div className="article-table-container">
          <table className="article-table">
            <tbody>
              {queuedItems.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <div className="article-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        minWidth: '1.25rem',
                        marginRight: '0.2rem'
                      }}>
                        #{index + 1}
                      </span>
                      <div style={{
                        color: item.origin === 'youtube' ? '#f87171' : item.origin === 'pdf' ? '#fca5a5' : item.origin === 'rss' ? '#60a5fa' : '#94a3b8',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }} title={item.origin === 'youtube' ? 'YouTube Ingestion' : item.origin === 'rss' ? 'RSS Ingestion' : item.origin === 'pdf' ? 'PDF Ingestion' : 'Article Ingestion'}>
                        {item.origin === 'youtube' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                          </svg>
                        ) : item.origin === 'rss' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                          </svg>
                        ) : item.origin === 'pdf' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        )}
                      </div>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </div>
                    <div className="article-meta">
                      Queued {formatDateTime(item.queued_at || item.created_at)}
                      {item.syndication_title && (
                        <>
                          <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                          <span>{item.syndication_title}</span>
                        </>
                      )}
                      {item.source_url && (() => {
                        try {
                          const domain = new URL(item.source_url).hostname.replace(/^www\./, '');
                          if (item.syndication_title && item.syndication_title.trim().toLowerCase() === domain.toLowerCase()) {
                            return null;
                          }
                          return (
                            <>
                              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                              {domain}
                            </>
                          );
                        } catch {
                          return (
                            <>
                              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                              {item.source_url}
                            </>
                          );
                        }
                      })()}
                    </div>
                  </td>
                  <td className="article-actions-cell">
                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <PublishItemButton itemId={item.id!} />
                      {item.type === 'video' || item.media_url.toLowerCase().endsWith('.mp4') ? (
                        <WatchVideoButton videoUrl={item.media_url} title={item.title} />
                      ) : (
                        <ListenAudioButton audioUrl={item.media_url} title={item.title} coverImageUrl={feed.cover_image_url} />
                      )}
                      <DeleteItemButton itemId={item.id!} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
