'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Syndication } from '@/lib/firestore';
import { formatDateTime } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function IngestionTabs({ feedId, syndications }: { feedId: string, syndications: Syndication[] }) {
  const [activeTab, setActiveTab] = useState<'article' | 'youtube' | 'rss'>('article');
  const router = useRouter();

  // Article/YouTube form state
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [rssUrl, setRssUrl] = useState('');
  const [rssLoading, setRssLoading] = useState(false);
  const [syndicationToDelete, setSyndicationToDelete] = useState<string | null>(null);
  const [isDeletingRss, setIsDeletingRss] = useState(false);
  const [initialAction, setInitialAction] = useState('future');
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);

  const handleIngestArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ feedId, url, origin: activeTab }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setErrorModalMessage(errorData.error);
        } catch {
          setErrorModalMessage(`Status ${res.status}: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (err: unknown) {
      setErrorModalMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleAddRss = async (e: React.FormEvent) => {
    e.preventDefault();
    setRssLoading(true);
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'POST',
        body: JSON.stringify({ feedId, url: rssUrl, initialAction }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRssUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setErrorModalMessage(`Failed to subscribe: ${errorData.error}`);
        } catch {
          setErrorModalMessage(`Failed to subscribe with status ${res.status}.`);
        }
      }
    } catch (err: unknown) {
      setErrorModalMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setRssLoading(false);
  };

  const handleDeleteRss = async () => {
    if (!syndicationToDelete) return;
    setIsDeletingRss(true);
    try {
      const res = await fetch(`/api/rss-feeds?id=${syndicationToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSyndicationToDelete(null);
        router.refresh();
      } else {
        setErrorModalMessage('Failed to remove subscription');
      }
    } catch {
      setErrorModalMessage('Network error while removing subscription');
    }
    setIsDeletingRss(false);
  };

  const handleTabChange = (tab: 'article' | 'youtube' | 'rss') => {
    setActiveTab(tab);
    setUrl('');
    setRssUrl('');
  };

  return (
    <div className="card" style={{padding: '1.5rem', width: '100%', maxWidth: '100%'}}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #334155', marginBottom: '1.5rem' }}>
        <button
          onClick={() => handleTabChange('article')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'article' ? '#fff' : '#94a3b8',
            borderBottom: activeTab === 'article' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'article' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Article
        </button>
        <button
          onClick={() => handleTabChange('rss')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'rss' ? '#fff' : '#94a3b8',
            borderBottom: activeTab === 'rss' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'rss' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          RSS Feeds
        </button>
        <button
          onClick={() => {
            if (process.env.NODE_ENV !== 'development') return;
            handleTabChange('youtube');
          }}
          title={process.env.NODE_ENV !== 'development' ? 'Deploy article-caster on a local machine to enable YouTube ingestion (datacenter IPs are blocked)' : ''}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'youtube' ? '#fff' : (process.env.NODE_ENV !== 'development' ? '#475569' : '#94a3b8'),
            borderBottom: activeTab === 'youtube' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: process.env.NODE_ENV !== 'development' ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'youtube' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: process.env.NODE_ENV !== 'development' ? 0.5 : 1,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
          YouTube
        </button>
      </div>

      {activeTab === 'article' || activeTab === 'youtube' ? (
        <form onSubmit={handleIngestArticle}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input type="url" className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder={activeTab === 'youtube' ? "https://youtube.com/watch?v=..." : "https://example.com/article"} required style={{ marginBottom: 0 }} />
              <button type="submit" className="btn" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                {loading ? 'Processing...' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div>
          <form onSubmit={handleAddRss} style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="url" className="input-field" value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="https://example.com/rss.xml" required style={{ marginBottom: 0, flex: 1 }} />
                <select className="input-field" value={initialAction} onChange={e => setInitialAction(e.target.value)} style={{ marginBottom: 0, width: 'auto' }}>
                  <option value="future">Add only future posts</option>
                  <option value="recent">Also add most recent post</option>
                  <option value="all">Also add all historical posts</option>
                </select>
                <button type="submit" className="btn" disabled={rssLoading} style={{ whiteSpace: 'nowrap' }}>
                  {rssLoading ? 'Adding...' : 'Subscribe'}
                </button>
              </div>
            </div>
          </form>
          
          {syndications.length > 0 && (
            <div className="article-table-container">
              <table className="article-table" style={{ margin: 0 }}>
                <tbody>
                  {syndications.map(syn => (
                    <tr key={syn.id}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div className="article-title">
                          <a href={syn.url} target="_blank" rel="noreferrer">
                            {syn.title || syn.url}
                          </a>
                        </div>
                        <div className="article-meta">
                          {syn.last_checked_at ? `Last checked ${formatDateTime(syn.last_checked_at)}` : 'Not checked yet'}
                          {syn.url && (
                            <>
                              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                              {(() => {
                                try {
                                  return new URL(syn.url).hostname.replace(/^www\./, '');
                                } catch {
                                  return syn.url;
                                }
                              })()}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="article-actions-cell" style={{ padding: '0.75rem 1rem' }}>
                        <button onClick={() => setSyndicationToDelete(syn.id!)} className="btn-destructive" title="Remove Feed" style={{ padding: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {syndications.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>No RSS feeds subscribed yet.</p>
          )}
        </div>
      )}

      {syndicationToDelete && (
        <ConfirmDialog
          title="Remove RSS Feed"
          message="Are you sure you want to remove this RSS feed subscription?"
          confirmLabel="Remove"
          onConfirm={handleDeleteRss}
          onCancel={() => setSyndicationToDelete(null)}
          isLoading={isDeletingRss}
        />
      )}

      {errorModalMessage && (
        <ConfirmDialog
          title="Error"
          message={errorModalMessage}
          confirmLabel="OK"
          onConfirm={() => setErrorModalMessage(null)}
          onCancel={() => setErrorModalMessage(null)}
          hideCancel={true}
        />
      )}
    </div>
  );
}
