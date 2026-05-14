'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface FeedFormProps {
  initialData?: {
    id: string;
    title: string;
    description: string;
    author?: string;
    category?: string;
    cover_image_url?: string;
    tts_voice?: string;
    audio_prefix_message?: string;
  };
  buttonText?: string;
  buttonStyle?: React.CSSProperties;
}

export default function FeedForm({ 
  initialData, 
  buttonText = '+ Add New', 
  buttonStyle, 
}: FeedFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [author, setAuthor] = useState(initialData?.author || '');
  const [category, setCategory] = useState(initialData?.category || 'Technology');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [existingCoverUrl] = useState(initialData?.cover_image_url || '');
  const [ttsVoice, setTtsVoice] = useState((!initialData?.tts_voice || initialData.tts_voice === 'auto') ? 'Puck' : initialData.tts_voice);
  const [audioPrefixMessage, setAudioPrefixMessage] = useState(initialData?.audio_prefix_message || '');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setPreviewLoading(false);
    };
    audioRef.current.onerror = () => {
      setPreviewLoading(false);
      setIsPlaying(false);
      alert('Failed to play preview');
    };
    audioRef.current.onplaying = () => {
      setPreviewLoading(false);
      setIsPlaying(true);
    };
  }, []);

  const handlePreview = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setPreviewLoading(true);
    audioRef.current.src = `/api/tts/preview?voice=${ttsVoice}&t=${Date.now()}`;
    audioRef.current.play().catch(err => {
      console.error('Playback error:', err);
      setPreviewLoading(false);
      setIsPlaying(false);
      alert('Failed to play preview');
    });
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const url = initialData ? `/api/feeds/${initialData.id}` : '/api/feeds';
    const method = initialData ? 'PUT' : 'POST';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('author', author);
    formData.append('category', category);
    formData.append('tts_voice', ttsVoice);
    formData.append('audio_prefix_message', audioPrefixMessage);
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
        setAuthor('');
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
      <button 
        onClick={() => setIsOpen(true)}
        className="btn"
        style={buttonStyle || {padding: '0.4rem 0.8rem', fontSize: '0.875rem', whiteSpace: 'nowrap'}}
      >
        {buttonText}
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', maxHeight: '90vh', overflowY: 'auto'}}>
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
                <label>Author (Optional)</label>
                <input type="text" className="input-field" value={author} onChange={e => setAuthor(e.target.value)} />
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
                <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} />
              </div>
              <div className="form-group">
                <label>Audio Prefix Message (Optional)</label>
                <textarea className="input-field" rows={2} value={audioPrefixMessage} onChange={e => setAudioPrefixMessage(e.target.value)} />
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select className="input-field" value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ flex: 1, marginBottom: 0 }}>
                    <option value="Puck">Puck (Default)</option>
                    <option value="Kore">Kore</option>
                    <option value="Aoede">Aoede</option>
                    <option value="Charon">Charon</option>
                    <option value="Fenrir">Fenrir</option>
                    <option value="Leda">Leda</option>
                  </select>
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ 
                      background: isPlaying ? 'var(--bg-secondary)' : 'var(--accent-color)', 
                      color: isPlaying ? 'var(--text-primary)' : '#fff', 
                      border: '1px solid ' + (isPlaying ? 'var(--border-color)' : 'var(--accent-color)'),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      width: '90px',
                      justifyContent: 'center',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={handlePreview}
                    disabled={previewLoading && !isPlaying}
                  >
                    {previewLoading ? 'Loading...' : isPlaying ? '⏹ Stop' : '▶ Play'}
                  </button>
                </div>
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
