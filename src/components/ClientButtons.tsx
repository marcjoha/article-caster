'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

export function SubscribePageLink({ slug }: { slug: string }) {
  return (
    <a 
      href={`/subscribe/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View Subscription Landing Page"
      className="btn btn-rss"
      style={{
        marginLeft: '1rem',
        padding: '0.35rem', 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
        <path fillRule="evenodd" d="M3.75 4.5a.75.75 0 01.75-.75h.75c8.284 0 15 6.716 15 15v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75C18 11.708 12.292 6 5.25 6H4.5a.75.75 0 01-.75-.75V4.5zm0 6.75a.75.75 0 01.75-.75h.75a8.25 8.25 0 018.25 8.25v.75a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75v-.75a6.75 6.75 0 00-6.75-6.75H4.5a.75.75 0 01-.75-.75v-.75zm0 7.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
      </svg>
    </a>
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
        <ConfirmDialog
          title="Delete Podcast"
          message="Are you sure you want to delete this podcast and ALL its episodes? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          isLoading={isDeleting}
        />
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
        <ConfirmDialog
          title="Delete Episode"
          message="Are you sure you want to delete this episode?"
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          isLoading={isDeleting}
        />
      )}
    </>
  );
}

export function WatchVideoButton({ videoUrl, title }: { videoUrl: string; title: string }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn"
        style={{
          backgroundColor: '#10b981',
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.4rem 0.8rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" fill="currentColor" style={{ width: '0.875rem', height: '0.875rem' }}>
          <path d="M8 5.14v14l11-7z" />
        </svg>
        Watch
      </button>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              width: '100%',
              maxWidth: '800px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                {title}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000' }}>
              <video
                src={videoUrl}
                controls
                autoPlay
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
