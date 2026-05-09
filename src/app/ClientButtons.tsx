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
    <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
          <path fillRule="evenodd" d="M3.75 4.5a.75.75 0 01.75-.75h.75c8.284 0 15 6.716 15 15v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75C18 11.708 12.292 6 5.25 6H4.5a.75.75 0 01-.75-.75V4.5zm0 6.75a.75.75 0 01.75-.75h.75a8.25 8.25 0 018.25 8.25v.75a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75v-.75a6.75 6.75 0 00-6.75-6.75H4.5a.75.75 0 01-.75-.75v-.75zm0 7.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
        </svg>
      </div>
      <input 
        type="text" 
        readOnly 
        value={fullUrl} 
        style={{ flex: 1, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.9rem', outline: 'none', textOverflow: 'ellipsis', minWidth: 0 }} 
        onFocus={(e) => e.target.select()}
      />
      <button 
        onClick={handleCopy} 
        className={copied ? "" : "btn"}
        style={copied ? { 
          background: '#10b981', 
          color: 'white', 
          border: 'none', 
          borderRadius: '6px', 
          padding: '0.4rem 0.8rem', 
          fontSize: '0.875rem', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          transition: 'all 0.2s',
          flexShrink: 0,
          fontWeight: 600
        } : {
          padding: '0.4rem 0.8rem', 
          fontSize: '0.875rem', 
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexShrink: 0,
        }}
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy URL
          </>
        )}
      </button>
    </div>
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
        style={{backgroundColor: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.875rem'}}
      >
        Delete
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
        style={{backgroundColor: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.875rem'}}
      >
        Delete
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
