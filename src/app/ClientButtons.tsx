'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function FeedUrlDisplay({ path, baseUrl }: { path: string; baseUrl?: string }) {
  const [origin, setOrigin] = useState(baseUrl || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!baseUrl) {
      const timer = setTimeout(() => {
        setOrigin(window.location.origin);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [baseUrl]);

  const fullUrl = origin ? `${origin}${path}` : path;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button 
      onClick={handleCopy} 
      title="Copy RSS Feed URL"
      className={`btn ${copied ? 'btn-success' : 'btn-rss'}`}
      style={{
        marginLeft: '1rem',
        padding: '0.35rem', 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
          <path fillRule="evenodd" d="M3.75 4.5a.75.75 0 01.75-.75h.75c8.284 0 15 6.716 15 15v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75C18 11.708 12.292 6 5.25 6H4.5a.75.75 0 01-.75-.75V4.5zm0 6.75a.75.75 0 01.75-.75h.75a8.25 8.25 0 018.25 8.25v.75a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75v-.75a6.75 6.75 0 00-6.75-6.75H4.5a.75.75 0 01-.75-.75v-.75zm0 7.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export function DeleteFeedButton({ feedId }: { feedId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await fetch(`/api/feeds/${feedId}`, { method: 'DELETE' });
    setShowConfirm(false);
    router.push('/');
    router.refresh();
  };
  
  return (
    <>
      <button 
        onClick={() => setShowConfirm(true)} 
        className="btn" 
        style={{backgroundColor: '#ef4444', color: 'white', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
        title="Delete Podcast"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>

      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', textAlign: 'left'}}>
            <h2 style={{marginTop: 0, color: '#ef4444'}}>Delete Podcast</h2>
            <p style={{marginBottom: '2rem', lineHeight: 1.5}}>
              Are you sure you want to delete this podcast and ALL its episodes? This cannot be undone.
            </p>

            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setShowConfirm(false)}
                className="btn"
                style={{backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)'}}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="btn"
                style={{backgroundColor: '#ef4444'}}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    setShowConfirm(false);
    setIsDeleting(false);
    router.refresh();
  };
  
  return (
    <>
      <button 
        onClick={() => setShowConfirm(true)} 
        className="btn" 
        style={{backgroundColor: '#ef4444', color: 'white', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
        title="Delete Episode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>

      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', textAlign: 'left'}}>
            <h2 style={{marginTop: 0, color: '#ef4444'}}>Delete Episode</h2>
            <p style={{marginBottom: '2rem', lineHeight: 1.5}}>
              Are you sure you want to delete this episode?
            </p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setShowConfirm(false)}
                className="btn"
                style={{backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)'}}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="btn"
                style={{backgroundColor: '#ef4444'}}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReprocessItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleReprocess = async () => {
    setIsProcessing(true);
    try {
      await fetch(`/api/items/${itemId}/reprocess`, { method: 'POST' });
      router.refresh();
    } catch (e) {
      console.error('Failed to start reprocessing', e);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <button 
      onClick={handleReprocess} 
      className="btn" 
      style={{backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
      title="Reprocess Episode"
      disabled={isProcessing}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    </button>
  );
}
