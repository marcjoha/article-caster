'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { formatDateTime } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';

type Ingestion = {
  id: string;
  url: string;
  status: string;
  error?: string;
  created_at: string;
  origin?: 'article' | 'rss' | 'youtube';
};

export default function ProcessingList({ feedId }: { feedId: string }) {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);
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

  const formatError = (errorStr: string) => {
    try {
      const jsonStart = errorStr.indexOf('{');
      if (jsonStart !== -1) {
        const jsonStr = errorStr.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          return parsed.error.message;
        }
      }
    } catch {
      // fall through
    }
    return errorStr;
  };

  if (ingestions.length === 0) return null;

  const hasFailed = ingestions.some(ing => ing.status === 'failed');

  const handleClearFailed = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/ingestions?feedId=${feedId}`, { method: 'DELETE' });
      if (res.ok) {
        setIngestions(prev => prev.filter(ing => ing.status !== 'failed'));
        setIsClearModalOpen(false);
      }
    } catch (e) {
      console.error('Failed to clear ingestions', e);
    } finally {
      setIsClearing(false);
    }
  };

  const handleTryAgain = async (ing: Ingestion) => {
    // We shouldn't optimistically remove it until we know it succeeded, or at least show an error.
    try {
      // Add it back to the queue FIRST
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ feedId, url: ing.url, origin: ing.origin }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const errData = await res.json();
        setErrorModalMessage(`Failed to retry: ${errData.error || res.statusText}`);
      } else {
        // 2. Only delete the old failed ingestion record on success
        if (ing.id) {
          await fetch(`/api/ingestions?ingestionId=${ing.id}`, { method: 'DELETE' });
        }
        // Remove from UI to prevent vanishing before next poll
        setIngestions(prev => prev.filter(i => i.id !== ing.id));
      }
      
      router.refresh();
    } catch (e) {
      console.error('Failed to retry ingestion', e);
      setErrorModalMessage('Network error while retrying.');
    }
  };

  const getStatusText = (ing: Ingestion) => {
    if (ing.status === 'pending') return 'Pending...';
    if (ing.status === 'processing') return 'Processing...';
    return ing.status;
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Processing</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {hasFailed && (
            <button 
              onClick={() => setIsClearModalOpen(true)}
              disabled={isClearing}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
            >
              Clear failed
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', overflow: 'hidden' }}>
                      <div style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '300px' }}>
                        {formatError(ing.error || 'Unknown error')}
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
                      {getStatusText(ing)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isClearModalOpen && (
        <ConfirmDialog
          title="Clear failed ingestions?"
          message="This will remove all failed ingestions from the list. You will not be able to retry them once cleared."
          confirmLabel="Clear"
          onConfirm={handleClearFailed}
          onCancel={() => setIsClearModalOpen(false)}
          isLoading={isClearing}
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
