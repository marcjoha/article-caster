'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Syndication } from '@/lib/firestore';
import { formatDateTime, looksLikeRssFeed, looksLikeArticleUrl, looksLikeYoutubeUrl } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function IngestionTabs({ feedId, syndications }: { feedId: string, syndications: Syndication[] }) {
  const [activeTab, setActiveTab] = useState<'article' | 'youtube' | 'rss' | 'pdf'>('article');
  const router = useRouter();

  // Article/YouTube form state
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [rssUrl, setRssUrl] = useState('');
  const [rssLoading, setRssLoading] = useState(false);
  const [syndicationToDelete, setSyndicationToDelete] = useState<string | null>(null);
  const [isDeletingRss, setIsDeletingRss] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [initialAction, setInitialAction] = useState('future');
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Client-side URL validation to prevent cross-posting
  const articleUrlWarning = activeTab === 'article' && url && looksLikeYoutubeUrl(url)
    ? 'This looks like a YouTube URL. Use the YouTube tab to ingest videos.'
    : url && looksLikeRssFeed(url)
    ? 'This looks like an RSS feed URL. Use the RSS tab to subscribe to feeds.'
    : null;
  const rssUrlWarning = rssUrl && looksLikeArticleUrl(rssUrl)
    ? 'This looks like a regular article or video URL, not an RSS feed. Use the Article tab to ingest individual articles.'
    : null;

  const handleIngestArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (articleUrlWarning) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: JSON.stringify({ feedId, url, origin: activeTab }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setErrorModalMessage(errorData.error);
        } catch {
          setErrorModalMessage(`Status ${res.status}: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (err: unknown) {
      setErrorModalMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading(false);
  };

  const handleAddRss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rssUrlWarning) return;
    setRssLoading(true);
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'POST',
        body: JSON.stringify({ feedId, url: rssUrl, initialAction }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRssUrl('');
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setErrorModalMessage(`Failed to subscribe: ${errorData.error}`);
        } catch {
          setErrorModalMessage(`Failed to subscribe with status ${res.status}.`);
        }
      }
    } catch (err: unknown) {
      setErrorModalMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setRssLoading(false);
  };

  const handleDeleteRss = async () => {
    if (!syndicationToDelete) return;
    setIsDeletingRss(true);
    try {
      const res = await fetch(`/api/rss-feeds?id=${syndicationToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSyndicationToDelete(null);
        router.refresh();
      } else {
        setErrorModalMessage('Failed to remove subscription');
      }
    } catch {
      setErrorModalMessage('Network error while removing subscription');
    }
    setIsDeletingRss(false);
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setErrorModalMessage(`Sync failed: ${errorData.error}`);
        } catch {
          setErrorModalMessage(`Sync failed with status ${res.status}.`);
        }
      }
    } catch (err: unknown) {
      setErrorModalMessage(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setSyncingId(null);
  };

  const handleTabChange = (tab: 'article' | 'youtube' | 'rss' | 'pdf') => {
    setActiveTab(tab);
    setUrl('');
    setRssUrl('');
    setPdfFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file);
      } else {
        setErrorModalMessage('Only PDF files are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setPdfFile(file);
      } else {
        setErrorModalMessage('Only PDF files are supported.');
      }
    }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) return;
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('feedId', feedId);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setPdfFile(null);
        router.refresh();
      } else {
        let errMsg = 'Failed to upload PDF.';
        try {
          const res = JSON.parse(xhr.responseText);
          errMsg = res.error || errMsg;
        } catch {
          errMsg = `Error ${xhr.status}: ${xhr.statusText || 'Upload failed'}`;
        }
        setErrorModalMessage(errMsg);
      }
    });

    xhr.addEventListener('error', () => {
      setIsUploading(false);
      setErrorModalMessage('Network error during upload.');
    });

    xhr.open('POST', '/api/ingest/upload');
    xhr.send(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="card" style={{padding: '1.5rem', width: '100%', maxWidth: '100%'}}>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #334155', marginBottom: '1.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => handleTabChange('article')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'article' ? '#94a3b8' : '#64748b',
            borderBottom: activeTab === 'article' ? '2px solid #94a3b8' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            style={{
              width: '1.2rem',
              height: '1.2rem',
              color: '#94a3b8',
              opacity: activeTab === 'article' ? 1 : 0.6,
              transition: 'opacity 0.2s',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Article
        </button>
        <button
          onClick={() => handleTabChange('pdf')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'pdf' ? '#fca5a5' : '#64748b',
            borderBottom: activeTab === 'pdf' ? '2px solid #fca5a5' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            style={{
              width: '1.2rem',
              height: '1.2rem',
              color: '#fca5a5',
              opacity: activeTab === 'pdf' ? 1 : 0.6,
              transition: 'opacity 0.2s',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          PDF
        </button>
        <button
          onClick={() => handleTabChange('rss')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'rss' ? '#60a5fa' : '#64748b',
            borderBottom: activeTab === 'rss' ? '2px solid #60a5fa' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            style={{
              width: '1.2rem',
              height: '1.2rem',
              color: '#60a5fa',
              opacity: activeTab === 'rss' ? 1 : 0.6,
              transition: 'opacity 0.2s',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          RSS
        </button>
        <button
          onClick={() => {
            if (process.env.NODE_ENV !== 'development') return;
            handleTabChange('youtube');
          }}
          title={process.env.NODE_ENV !== 'development' ? 'Deploy article-caster on a local machine to enable YouTube ingestion (datacenter IPs are blocked)' : ''}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            color: activeTab === 'youtube' ? '#f87171' : (process.env.NODE_ENV !== 'development' ? '#475569' : '#64748b'),
            borderBottom: activeTab === 'youtube' ? '2px solid #f87171' : '2px solid transparent',
            cursor: process.env.NODE_ENV !== 'development' ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: process.env.NODE_ENV !== 'development' ? 0.5 : 1,
            whiteSpace: 'nowrap',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            style={{
              width: '1.2rem',
              height: '1.2rem',
              color: '#f87171',
              opacity: activeTab === 'youtube' ? 1 : 0.6,
              transition: 'opacity 0.2s',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
          YouTube
        </button>
      </div>

      {activeTab === 'article' || activeTab === 'youtube' ? (
        <form onSubmit={handleIngestArticle}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="url" className="input-field" value={url} onChange={e => setUrl(e.target.value)} placeholder={activeTab === 'youtube' ? "https://youtube.com/watch?v=..." : "https://example.com/article"} required style={{ marginBottom: 0, borderColor: articleUrlWarning ? '#f59e0b' : undefined }} />
              <button type="submit" className="btn" disabled={loading || !!articleUrlWarning}>
                {loading ? 'Processing...' : 'Add'}
              </button>
            </div>
            {articleUrlWarning && (
              <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: '0.5rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {articleUrlWarning}
              </p>
            )}
          </div>
        </form>
      ) : activeTab === 'pdf' ? (
        <div>
          {!pdfFile ? (
            <div
              className={`pdf-dropzone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('pdf-file-input')?.click()}
            >
              <input
                id="pdf-file-input"
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <div className="pdf-dropzone-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '2.5rem', height: '2.5rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <p className="pdf-dropzone-text">
                Drag & drop your PDF file here, or <span style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>browse</span>
              </p>
              <p className="pdf-dropzone-subtext">Supports PDF documents up to 20MB</p>
            </div>
          ) : (
            <div className="pdf-file-preview">
              <div className="pdf-file-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem', color: '#fca5a5', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <div className="pdf-file-name" title={pdfFile.name}>
                  {pdfFile.name}
                </div>
                <div className="pdf-file-size">
                  {formatFileSize(pdfFile.size)}
                </div>
              </div>

              {isUploading && (
                <div className="pdf-progress-wrapper">
                  <div className="pdf-progress-bar-container">
                    <div className="pdf-progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <div className="pdf-progress-status">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              <div className="pdf-action-buttons">
                <button
                  type="button"
                  className="btn-destructive"
                  style={{ height: '2.25rem', padding: '0 1rem' }}
                  onClick={() => setPdfFile(null)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ height: '2.25rem', padding: '0 1rem' }}
                  onClick={handleUploadPdf}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload & Ingest'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <form onSubmit={handleAddRss} style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="url" className="input-field" value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="https://example.com/rss.xml" required style={{ marginBottom: 0, flex: 1, borderColor: rssUrlWarning ? '#f59e0b' : undefined }} />
                <select className="input-field" value={initialAction} onChange={e => setInitialAction(e.target.value)} style={{ marginBottom: 0, width: 'auto' }}>
                  <option value="future">Add only future posts</option>
                  <option value="recent">Also add most recent post</option>
                  <option value="all">Also add all historical posts</option>
                </select>
                <button type="submit" className="btn" disabled={rssLoading || !!rssUrlWarning}>
                  {rssLoading ? 'Adding...' : 'Subscribe'}
                </button>
              </div>
              {rssUrlWarning && (
                <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: '0.5rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {rssUrlWarning}
                </p>
              )}
            </div>
          </form>
          
          {syndications.length > 0 && (
            <div className="article-table-container">
              <table className="article-table" style={{ margin: 0 }}>
                <tbody>
                  {syndications.map(syn => (
                    <tr key={syn.id}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div className="article-title">
                          <a href={syn.url} target="_blank" rel="noreferrer">
                            {syn.title || syn.url}
                          </a>
                        </div>
                        <div className="article-meta">
                          {syn.last_checked_at ? `Last checked ${formatDateTime(syn.last_checked_at)}` : 'Not checked yet'}
                          {syn.url && (
                            <>
                              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                              {(() => {
                                try {
                                  return new URL(syn.url).hostname.replace(/^www\./, '');
                                } catch {
                                  return syn.url;
                                }
                              })()}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="article-actions-cell" style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleSync(syn.id!)}
                            className="btn btn-square"
                            style={{ backgroundColor: '#2563eb', color: 'white' }}
                            disabled={syncingId !== null || isDeletingRss}
                            title="Sync Now"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              style={{
                                width: '1.25rem',
                                height: '1.25rem',
                                animation: syncingId === syn.id ? 'spin 1s linear infinite' : 'none',
                              }}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setSyndicationToDelete(syn.id!)}
                            className="btn-destructive btn-square"
                            disabled={syncingId !== null || isDeletingRss}
                            title="Remove Feed"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {syndications.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>No RSS feeds subscribed yet.</p>
          )}
        </div>
      )}

      {syndicationToDelete && (
        <ConfirmDialog
          title="Remove RSS Feed"
          message="Are you sure you want to remove this RSS feed subscription?"
          confirmLabel="Remove"
          onConfirm={handleDeleteRss}
          onCancel={() => setSyndicationToDelete(null)}
          isLoading={isDeletingRss}
        />
      )}

      {errorModalMessage && (
        <ConfirmDialog
          title="Error"
          message={errorModalMessage}
          confirmLabel="OK"
          onConfirm={() => setErrorModalMessage(null)}
          onCancel={() => setErrorModalMessage(null)}
          hideCancel={true}
        />
      )}
    </div>
  );
}
