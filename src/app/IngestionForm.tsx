'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function IngestionForm({ feedId }: { feedId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleIngest = async (e: React.FormEvent) => {
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

  return (
    <form onSubmit={handleIngest} className="card" style={{padding: '1.5rem', width: '100%', maxWidth: '100%'}}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input type="url" className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/article" required style={{ marginBottom: 0 }} />
          <button type="submit" className="btn" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
            {loading ? 'Processing...' : 'Ingest'}
          </button>
        </div>
      </div>
    </form>
  );
}
