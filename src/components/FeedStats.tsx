'use client';

import { useState, useEffect } from 'react';

interface StatsResponse {
  totalListens: number;
  listensByItem: { title: string; count: number }[];
  listensByUserAgent: { name: string; count: number }[];
}

export default function FeedStats({ feedId }: { feedId: string }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/stats/${feedId}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [feedId]);

  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading stats...</div>;
  if (!stats) return null;

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', maxWidth: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
        
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Listens
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            {stats.totalListens}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Top Episodes
          </div>
          {stats.listensByItem.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No listens yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.listensByItem.slice(0, 5).map((item, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={item.title}>
                    {item.title}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Clients
          </div>
          {stats.listensByUserAgent.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stats.listensByUserAgent.slice(0, 5).map((ua, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span>{ua.name}</span>
                  <span style={{ fontWeight: 'bold' }}>{ua.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
