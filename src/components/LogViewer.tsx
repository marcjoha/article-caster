'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ConfirmDialog from './ConfirmDialog';

interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  details?: string;
  created_at: string;
}

interface LogViewerProps {
  feedId: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname;
  } catch {
    return url;
  }
}

export default function LogViewer({ feedId }: LogViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUrl, setFilterUrl] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/logs?feedId=${feedId}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } catch {
      // Silently ignore fetch errors
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [feedId]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setFilterUrl('');
    fetchLogs(true);
  }, [fetchLogs]);

  // Poll every 5s while open
  useEffect(() => {
    if (!isOpen) return;
    intervalRef.current = setInterval(() => fetchLogs(false), 5000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, fetchLogs]);

  // Extract unique URLs from details field
  const uniqueUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const entry of entries) {
      if (entry.details && (entry.details.startsWith('http://') || entry.details.startsWith('https://'))) {
        urls.add(entry.details);
      }
    }
    return Array.from(urls).sort();
  }, [entries]);

  // Filter entries by selected URL
  const filteredEntries = useMemo(() => {
    if (!filterUrl) return entries;
    return entries.filter(e => e.details === filterUrl);
  }, [entries, filterUrl]);

  const handleClearLogs = useCallback(async () => {
    setIsClearing(true);
    try {
      const params = new URLSearchParams({ feedId });
      if (filterUrl) params.set('details', filterUrl);
      const res = await fetch(`/api/logs?${params}`, { method: 'DELETE' });
      if (res.ok) {
        if (filterUrl) {
          setEntries(prev => prev.filter(e => e.details !== filterUrl));
          setFilterUrl('');
        } else {
          setEntries([]);
          setFilterUrl('');
        }
      }
    } catch {
      // Silently ignore
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  }, [feedId, filterUrl]);

  const clearMessage = filterUrl
    ? `Delete all log entries for ${shortenUrl(filterUrl)}? This cannot be undone.`
    : 'Delete all log entries for this feed? This cannot be undone.';

  return (
    <>
      <button
        onClick={handleOpen}
        className="btn"
        style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        title="Activity Log"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>

      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '600px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>Activity Log</h2>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: '1.5rem', cursor: 'pointer', padding: 0, lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {entries.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                {uniqueUrls.length > 0 && (
                  <select
                    className="input-field"
                    value={filterUrl}
                    onChange={e => setFilterUrl(e.target.value)}
                    style={{ marginBottom: 0, flex: 1 }}
                  >
                    <option value="">All events</option>
                    {uniqueUrls.map(url => (
                      <option key={url} value={url}>{shortenUrl(url)}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="btn-destructive"
                  style={{ padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  title="Clear all logs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            )}

            {loading && entries.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No activity recorded yet.
              </div>
            ) : (
              <div className="log-list">
                {filteredEntries.map(entry => (
                  <div key={entry.id} className={`log-entry ${entry.level === 'error' ? 'log-entry-error' : ''}`}>
                    {entry.details && !filterUrl && (
                      <div className="log-entry-url">{shortenUrl(entry.details)}</div>
                    )}
                    <div className="log-entry-header">
                      <span className="log-timestamp">{formatRelativeTime(entry.created_at)}</span>
                    </div>
                    <div className="log-message">{entry.message}</div>
                  </div>
                ))}
                {filteredEntries.length === 0 && (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No events for this URL.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Activity Log"
          message={clearMessage}
          confirmLabel="Clear"
          onConfirm={handleClearLogs}
          onCancel={() => setShowClearConfirm(false)}
          isLoading={isClearing}
        />
      )}
    </>
  );
}
