'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Syndication } from '@/lib/firestore';
import { formatDateTime } from '@/lib/utils';

export default function IngestionTabs({ feedId, syndications }: { feedId: string, syndications: Syndication[] }) {
  const [activeTab, setActiveTab] = useState<'article' | 'rss'>('article');
  const router = useRouter();

  // Article form state
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [rssUrl, setRssUrl] = useState('');
  const [rssLoading, setRssLoading] = useState(false);
  const [syndicationToDelete, setSyndicationToDelete] = useState<string | null>(null);
  const [isDeletingRss, setIsDeletingRss] = useState(false);

  const handleIngestArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ feedId, url }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          alert(`Ingestion failed: ${errorData.error}`);
        } catch {
          alert(`Ingestion failed with status ${res.status}. Server response: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (err: unknown) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleAddRss = async (e: React.FormEvent) => {
    e.preventDefault();
    setRssLoading(true);
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'POST',
        body: JSON.stringify({ feedId, url: rssUrl }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRssUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          alert(`Failed to subscribe: ${errorData.error}`);
        } catch {
          alert(`Failed to subscribe with status ${res.status}.`);
        }
      }
    } catch (err: unknown) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        alert('Failed to remove subscription');
      }
    } catch {
      alert('Network error while removing subscription');
    }
    setIsDeletingRss(false);
  };

  return (
    <div className="card" style={{padding: '1.5rem', width: '100%', maxWidth: '100%'}}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #334155', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('article')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'article' ? '#fff' : '#94a3b8',
            borderBottom: activeTab === 'article' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'article' ? 600 : 400,
          }}
        >
          Article
        </button>
        <button
          onClick={() => setActiveTab('rss')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'rss' ? '#fff' : '#94a3b8',
            borderBottom: activeTab === 'rss' ? '2px solid #3b82f6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: activeTab === 'rss' ? 600 : 400,
          }}
        >
          RSS Feeds
        </button>
      </div>

      {activeTab === 'article' ? (
        <form onSubmit={handleIngestArticle}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input type="url" className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/article" required style={{ marginBottom: 0 }} />
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
                <input type="url" className="input-field" value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="https://example.com/rss.xml" required style={{ marginBottom: 0 }} />
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
                        <div className="article-title">{syn.title || syn.url}</div>
                        <div className="article-meta" style={{ opacity: 0.7 }}>
                          {syn.last_checked_at ? `Last checked: ${formatDateTime(syn.last_checked_at)}` : 'Not checked yet'}
                        </div>
                      </td>
                      <td className="article-actions-cell" style={{ padding: '0.75rem 1rem' }}>
                        <button onClick={() => setSyndicationToDelete(syn.id!)} className="btn-destructive">Delete</button>
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', textAlign: 'left'}}>
            <h2 style={{marginTop: 0, color: '#ef4444'}}>Remove RSS Feed</h2>
            <p style={{marginBottom: '2rem', lineHeight: 1.5}}>
              Are you sure you want to remove this RSS feed subscription?
            </p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setSyndicationToDelete(null)}
                className="btn"
                style={{backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)'}}
                disabled={isDeletingRss}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteRss}
                className="btn"
                style={{backgroundColor: '#ef4444'}}
                disabled={isDeletingRss}
              >
                {isDeletingRss ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
