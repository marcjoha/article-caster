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


function formatAbsoluteTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return dateStr;
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
    return Array.from(urls).sort((a, b) => a.localeCompare(b));
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
    ? `Delete all log entries for ${filterUrl}? This cannot be undone.`
    : 'Delete all log entries for this feed? This cannot be undone.';

  return (
    <>
      <button
        onClick={handleOpen}
        className="btn-success"
        title="Activity Log"
      >
        Logs
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card log-viewer-dialog" style={{ padding: '2rem', width: '100%', maxWidth: '1100px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
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
                      <option key={url} value={url}>{url}</option>
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
                {filteredEntries.map(entry => {
                  const fullUrl = entry.details || '—';
                  return (
                    <div key={entry.id} className={`log-entry ${entry.level === 'error' ? 'log-entry-error' : ''}`}>
                      <div className="log-entry-top">
                        <div className="log-message" title={entry.message}>
                          {entry.message}
                        </div>
                        <span className="log-timestamp">
                          {formatAbsoluteTime(entry.created_at)}
                        </span>
                      </div>
                      {!filterUrl && (
                        <div className="log-entry-url" title={entry.details || ''}>
                          {fullUrl}
                        </div>
                      )}
                    </div>
                  );
                })}
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
