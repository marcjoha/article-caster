'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FeedFormProps {
  initialData?: {
    id: string;
    title: string;
    description: string;
    cover_image_url?: string;
  };
  buttonText?: string;
  buttonStyle?: React.CSSProperties;
  buttonClassName?: string;
  hideTrigger?: boolean;
  externalIsOpen?: boolean;
  onExternalClose?: () => void;
}

export default function FeedForm({ 
  initialData, 
  buttonText = '+ Add New', 
  buttonStyle, 
  buttonClassName = "btn",
  hideTrigger = false,
  externalIsOpen = false,
  onExternalClose
}: FeedFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.cover_image_url || '');
  const [loading, setLoading] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen || internalIsOpen;
  const router = useRouter();

  const handleClose = () => {
    if (onExternalClose) onExternalClose();
    setInternalIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const url = initialData ? `/api/feeds/${initialData.id}` : '/api/feeds';
    const method = initialData ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      body: JSON.stringify({ title, description, cover_image_url: coverImageUrl }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      if (!initialData) {
        const data = await res.json();
        setTitle('');
        setDescription('');
        setCoverImageUrl('');
        router.push(`/?feedId=${data.feed.id}`);
      } else {
        router.refresh();
      }
      handleClose();
    } else {
      alert(`Failed to ${initialData ? 'update' : 'create'} feed`);
    }
    setLoading(false);
  };

  return (
    <>
      {!hideTrigger && (
        <button 
          onClick={() => setInternalIsOpen(true)}
          className={buttonClassName}
          style={buttonStyle || {padding: '0.4rem 0.8rem', fontSize: '0.875rem', backgroundColor: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', whiteSpace: 'nowrap'}}
        >
          {buttonText}
        </button>
      )}

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative'}}>
            <button 
              onClick={handleClose}
              style={{
                position: 'absolute', top: '1rem', right: '1rem', 
                background: 'none', border: 'none', color: 'var(--text-secondary)', 
                fontSize: '1.5rem', cursor: 'pointer'
              }}
            >
              &times;
            </button>
            <h2 style={{marginTop: 0}}>{initialData ? 'Edit Feed' : 'Create New Feed'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" className="input-field" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={50} />
              </div>
              <div className="form-group">
                <label>Cover Image URL (Optional)</label>
                <input type="url" className="input-field" value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
              </div>
              <button type="submit" className="btn" disabled={loading} style={{width: '100%'}}>
                {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Feed')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
