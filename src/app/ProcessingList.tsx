'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { formatDateTime } from '@/lib/utils';

type Ingestion = {
  id: string;
  url: string;
  status: string;
  created_at: string;
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

  if (ingestions.length === 0) return null;

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Processing</h3>
        <span style={{ color: '#f59e0b', fontSize: '0.875rem' }}>{ingestions.length} in progress</span>
      </div>
      
      <div className="article-table-container">
        <table className="article-table" style={{ borderTopColor: '#f59e0b' }}>
          <tbody>
            {ingestions.map(ing => (
              <tr key={ing.id}>
                <td>
                  <div className="article-title" style={{ color: '#cbd5e1' }}>{ing.url}</div>
                  <div className="article-meta">
                    {formatDateTime(ing.created_at)}
                  </div>
                </td>
                <td className="article-audio-cell">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', color: '#f59e0b', fontSize: '0.875rem', fontWeight: 600 }}>
                    <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    {ing.status === 'pending' ? 'Pending...' : 'Processing...'}
                  </div>
                </td>
                <td className="article-actions-cell"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

