'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FeedFormProps {
  initialData?: {
    id: string;
    title: string;
    description: string;
    category?: string;
    cover_image_url?: string;
    tts_voice?: string;
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
  const [category, setCategory] = useState(initialData?.category || 'Technology');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [existingCoverUrl] = useState(initialData?.cover_image_url || '');
  const [ttsVoice, setTtsVoice] = useState(initialData?.tts_voice || 'auto');
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

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('tts_voice', ttsVoice);
    if (coverImageFile) {
      formData.append('cover_image', coverImageFile);
    } else if (existingCoverUrl) {
      formData.append('cover_image_url', existingCoverUrl);
    }

    const res = await fetch(url, {
      method,
      body: formData,
    });

    if (res.ok) {
      if (!initialData) {
        const data = await res.json();
        setTitle('');
        setDescription('');
        setCoverImageFile(null);
        router.push(`/?feedId=${data.feed.id}`);
      } else {
        router.refresh();
      }
      handleClose();
    } else {
      alert(`Failed to ${initialData ? 'update' : 'create'} podcast`);
    }
    setLoading(false);
  };

  return (
    <>
      {!hideTrigger && (
        <button 
          onClick={() => setInternalIsOpen(true)}
          className={buttonClassName}
          style={buttonStyle || {padding: '0.4rem 0.8rem', fontSize: '0.875rem', whiteSpace: 'nowrap'}}
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
            <h2 style={{marginTop: 0}}>{initialData ? 'Edit Podcast' : 'Create New Podcast'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" className="input-field" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Technology">Technology</option>
                  <option value="Business">Business</option>
                  <option value="Education">Education</option>
                  <option value="Science">Science</option>
                  <option value="News">News</option>
                  <option value="Society &amp; Culture">Society &amp; Culture</option>
                  <option value="Arts">Arts</option>
                  <option value="Health &amp; Fitness">Health &amp; Fitness</option>
                  <option value="Comedy">Comedy</option>
                  <option value="Sports">Sports</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={50} />
              </div>
              <div className="form-group">
                <label>Cover Image (Optional)</label>
                {existingCoverUrl && !coverImageFile && (
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Current image exists. Upload a new one to replace.
                  </div>
                )}
                <input type="file" className="input-field" accept="image/*" onChange={e => setCoverImageFile(e.target.files?.[0] || null)} />
              </div>
              <div className="form-group">
                <label>Narrator Voice</label>
                <select className="input-field" value={ttsVoice} onChange={e => setTtsVoice(e.target.value)}>
                  <option value="auto">Auto-detect Language (Default)</option>
                  <option value="en-US-Journey-F">US Female (Journey)</option>
                  <option value="en-US-Journey-D">US Male (Journey)</option>
                  <option value="en-GB-Studio-C">UK Female (Studio)</option>
                  <option value="en-GB-Studio-B">UK Male (Studio)</option>
                  <option value="sv-SE-Neural2-A">Swedish Female (Neural2)</option>
                  <option value="es-ES-Neural2-A">Spanish Female (Neural2)</option>
                  <option value="fr-FR-Neural2-A">French Female (Neural2)</option>
                  <option value="de-DE-Neural2-A">German Female (Neural2)</option>
                </select>
              </div>
              <button type="submit" className="btn" disabled={loading} style={{width: '100%'}}>
                {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Podcast')}
              </button>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
