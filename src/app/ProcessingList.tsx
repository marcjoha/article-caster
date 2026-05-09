'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { formatDateTime } from '@/lib/utils';

type Ingestion = {
  id: string;
  url: string;
  status: string;
  error?: string;
  created_at: string;
};

export default function ProcessingList({ feedId }: { feedId: string }) {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const prevCountRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const fetchIngestions = async () => {
      try {
        const res = await fetch(`/api/ingestions?feedId=${feedId}`);
        if (res.ok) {
          const data = await res.json();
          setIngestions(data.ingestions);
          
          if (data.ingestions.length < prevCountRef.current) {
            router.refresh();
          }
          prevCountRef.current = data.ingestions.length;
        }
      } catch (e) {
        console.error('Failed to fetch ingestions', e);
      }
    };

    fetchIngestions();
    const interval = setInterval(fetchIngestions, 3000);

    return () => clearInterval(interval);
  }, [feedId, router]);

  if (ingestions.length === 0) return null;

  const hasFailed = ingestions.some(ing => ing.status === 'failed');

  const handleClearFailed = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/ingestions?feedId=${feedId}`, { method: 'DELETE' });
      if (res.ok) {
        setIngestions(prev => prev.filter(ing => ing.status !== 'failed'));
      }
    } catch (e) {
      console.error('Failed to clear ingestions', e);
    } finally {
      setIsClearing(false);
    }
  };

  const handleTryAgain = async (ing: Ingestion) => {
    // Optimistically remove the failed one from UI
    setIngestions(prev => prev.filter(i => i.id !== ing.id));
    
    try {
      // 1. Delete the old failed ingestion
      if (ing.id) {
        await fetch(`/api/ingestions?ingestionId=${ing.id}`, { method: 'DELETE' });
      }
      
      // 2. Add it back to the queue
      await fetch('/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ feedId, url: ing.url }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      router.refresh();
    } catch (e) {
      console.error('Failed to retry ingestion', e);
    }
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Processing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {hasFailed && (
            <button 
              onClick={handleClearFailed}
              disabled={isClearing}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
            >
              {isClearing ? 'Clearing...' : 'Clear failed'}
            </button>
          )}
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{ingestions.length} in progress</span>
        </div>
      </div>
      
      <div className="article-table-container">
        <table className="article-table">
          <tbody>
            {ingestions.map(ing => (
              <tr key={ing.id}>
                <td>
                  <div className="article-title" style={{ color: '#cbd5e1' }}>{ing.url}</div>
                  <div className="article-meta">
                    {formatDateTime(ing.created_at)}
                  </div>
                </td>
                <td className="article-audio-cell" colSpan={2}>
                  {ing.status === 'failed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
                      <div style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>
                        {ing.error || 'Unknown error'}
                      </div>
                      <button 
                        onClick={() => handleTryAgain(ing)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', whiteSpace: 'nowrap' }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', color: '#f59e0b', fontSize: '0.875rem', fontWeight: 600 }}>
                      <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      {ing.status === 'pending' ? 'Pending...' : 'Processing...'}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

