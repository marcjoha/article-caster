'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Ingestion = {
  id: string;
  url: string;
  status: string;
};

export default function ProcessingList({ feedId }: { feedId: string }) {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const prevCountRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const fetchIngestions = async () => {
      try {
        const res = await fetch(`/api/ingestions?feedId=${feedId}`);
        if (res.ok) {
          const data = await res.json();
          setIngestions(data.ingestions);
          
          // If the count of active ingestions decreases, it likely means one finished.
          // Trigger a refresh so the main list updates to show the new article.
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
    const interval = setInterval(fetchIngestions, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [feedId, router]);

  if (ingestions.length === 0) return null;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', borderLeft: '4px solid #f59e0b' }}>
      <h3 style={{ margin: '0 0 1rem 0' }}>Processing ({ingestions.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {ingestions.map(ing => (
          <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '4px' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
              {ing.url}
            </span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
              {ing.status === 'pending' ? 'Pending...' : 'Processing...'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
