'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import ConfirmDialog from '@/components/ConfirmDialog';

export function SubscribePageLink({ slug }: { slug: string }) {
  return (
    <a 
      href={`/subscribe/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View Subscription Landing Page"
      className="btn btn-rss"
      style={{ padding: '0.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
        className="btn-destructive btn-square" 
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
        className="btn-destructive btn-square" 
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
    if (!showModal) return;
    if (typeof window === 'undefined') return;

    const w = window as unknown as { __openModals?: number };
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    w.__openModals = (w.__openModals || 0) + 1;

    return () => {
      w.__openModals = Math.max(0, (w.__openModals || 0) - 1);
      if ((w.__openModals || 0) === 0) {
        document.body.style.overflow = prevBodyOverflow || '';
        document.documentElement.style.overflow = prevHtmlOverflow || '';
      }
    };
  }, [showModal]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-success btn-square"
        title="Watch Video"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.15rem', height: '1.15rem', transform: 'translateX(1px)' }}>
          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
        </svg>
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

export function ListenAudioButton({ audioUrl, title, coverImageUrl }: { audioUrl: string; title: string; coverImageUrl?: string }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    if (typeof window === 'undefined') return;

    const w = window as unknown as { __openModals?: number };
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    w.__openModals = (w.__openModals || 0) + 1;

    return () => {
      w.__openModals = Math.max(0, (w.__openModals || 0) - 1);
      if ((w.__openModals || 0) === 0) {
        document.body.style.overflow = prevBodyOverflow || '';
        document.documentElement.style.overflow = prevHtmlOverflow || '';
      }
    };
  }, [showModal]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-success btn-square"
        title="Listen to Audio"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.15rem', height: '1.15rem', transform: 'translateX(1px)' }}>
          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
        </svg>
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
              maxWidth: '500px',
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
            <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', backgroundColor: '#0f172a' }}>
              {coverImageUrl ? (
                <Image src={coverImageUrl} alt="Cover" width={180} height={180} unoptimized style={{ borderRadius: '12px', objectFit: 'cover', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} />
              ) : (
                <div style={{ width: '180px', height: '180px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                  <span style={{ fontSize: '4.5rem', color: '#fff' }}>🎙️</span>
                </div>
              )}
              <div style={{ textAlign: 'center', width: '100%', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.1rem', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
                  {title}
                </h4>
              </div>
              <audio 
                src={audioUrl} 
                controls 
                autoPlay 
                style={{ 
                  width: '100%', 
                  height: '40px',
                  borderRadius: '8px'
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PublishItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/items/${itemId}/publish`, { method: 'POST' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to publish episode');
      }
    } catch (e) {
      console.error('Publish error:', e);
      alert('Network error while publishing episode');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <button
      onClick={handlePublish}
      disabled={isPublishing}
      className="btn"
      style={{
        padding: '0 0.6rem',
        height: '2rem',
        fontSize: '0.75rem',
        gap: '0.35rem',
        background: 'var(--accent-color)',
        color: '#fff',
      }}
      title="Publish this episode immediately"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '0.9rem', height: '0.9rem' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
      </svg>
      {isPublishing ? 'Publishing...' : 'Publish Now'}
    </button>
  );
}

