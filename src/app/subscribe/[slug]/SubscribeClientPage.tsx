'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

interface FeedData {
  id: string;
  title: string;
  description: string;
  author?: string;
  cover_image_url?: string;
  unguessable_slug: string;
}

interface SubscribeClientPageProps {
  feed: FeedData;
  hostUrl: string;
}

export default function SubscribeClientPage({ feed, hostUrl }: SubscribeClientPageProps) {
  const [copied, setCopied] = useState(false);

  const feedUrl = hostUrl ? `${hostUrl}/feed/${feed.unguessable_slug}` : '';
  const hostWithoutProtocol = hostUrl ? hostUrl.replace(/^https?:\/\//, '') : '';

  // Smart URL links
  const applePodcastsUrl = feedUrl ? `pcast://${hostWithoutProtocol}/feed/${feed.unguessable_slug}` : '#';
  const pocketCastsUrl = feedUrl ? `pktc://subscribe/${hostWithoutProtocol}/feed/${feed.unguessable_slug}` : '#';
  const overcastUrl = feedUrl ? `overcast://x-callback-url/add?url=${encodeURIComponent(feedUrl)}` : '#';
  const podcastAddictUrl = feedUrl ? `podcastaddict://${encodeURIComponent(feedUrl)}` : '#';

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy feed URL:', err);
    }
  };

  return (
    <div className="subscribe-page">
      <style>{`
        .subscribe-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top right, #1e293b, #0f172a 70%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #f8fafc;
          padding: 2rem 1rem;
          box-sizing: border-box;
        }

        .subscribe-container {
          width: 100%;
          max-width: 500px;
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 2.25rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          box-sizing: border-box;
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .podcast-brand {
          display: flex;
          gap: 1.25rem;
          align-items: center;
          margin-bottom: 2.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 1.75rem;
        }

        .podcast-cover {
          width: 96px;
          height: 96px;
          border-radius: 14px;
          object-fit: cover;
          box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          background-color: #1e293b;
          flex-shrink: 0;
        }

        .podcast-info {
          flex: 1;
          min-width: 0;
        }

        .podcast-title {
          margin: 0 0 0.375rem 0;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podcast-author {
          font-size: 0.8125rem;
          color: #3b82f6;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podcast-description {
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.45;
          color: #94a3b8;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #64748b;
          margin-bottom: 0.875rem;
        }

        .smart-links-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.875rem;
          margin-bottom: 2.25rem;
        }

        @media (max-width: 480px) {
          .podcast-brand {
            flex-direction: column;
            text-align: center;
            gap: 1rem;
          }
          .podcast-cover {
            width: 110px;
            height: 110px;
          }
          .smart-links-grid {
            grid-template-columns: 1fr;
          }
        }

        .app-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          color: #e2e8f0;
          font-weight: 600;
          font-size: 0.875rem;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .app-btn svg {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          transition: transform 0.25s ease;
        }

        .app-btn:hover {
          transform: translateY(-2px);
          color: #ffffff;
        }

        .app-btn:hover svg {
          transform: scale(1.1);
        }

        /* Platform-Specific Themes */
        .app-btn.apple svg {
          fill: #9933cc;
        }
        .app-btn.apple:hover {
          background: rgba(153, 51, 204, 0.1);
          border-color: rgba(153, 51, 204, 0.35);
          box-shadow: 0 4px 20px rgba(153, 51, 204, 0.15);
        }

        .app-btn.pocketcasts svg {
          fill: #f43e37;
        }
        .app-btn.pocketcasts:hover {
          background: rgba(244, 62, 55, 0.1);
          border-color: rgba(244, 62, 55, 0.35);
          box-shadow: 0 4px 20px rgba(244, 62, 55, 0.15);
        }

        .app-btn.overcast svg {
          fill: #fc7e0f;
        }
        .app-btn.overcast:hover {
          background: rgba(252, 126, 15, 0.1);
          border-color: rgba(252, 126, 15, 0.35);
          box-shadow: 0 4px 20px rgba(252, 126, 15, 0.15);
        }

        .app-btn.podcastaddict svg {
          fill: #f4842d;
        }
        .app-btn.podcastaddict:hover {
          background: rgba(244, 132, 45, 0.1);
          border-color: rgba(244, 132, 45, 0.35);
          box-shadow: 0 4px 20px rgba(244, 132, 45, 0.15);
        }

        .manual-section {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .copy-group {
          display: flex;
          position: relative;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .copy-input {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0.75rem 1rem;
          color: #f1f5f9;
          font-family: monospace;
          font-size: 0.8125rem;
          pointer-events: none;
          text-overflow: ellipsis;
        }

        .copy-btn {
          background: #3b82f6;
          color: #ffffff;
          border: none;
          padding: 0 1.25rem;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s;
          white-space: nowrap;
        }

        .copy-btn:hover {
          background: #2563eb;
        }

        .copy-btn.success {
          background: #10b981;
        }

        .instructions-text {
          font-size: 0.8125rem;
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        .instructions-text strong {
          color: #94a3b8;
        }

        .instructions-list {
          padding-left: 1.15rem;
          margin: 0.375rem 0 0 0;
        }

        .instructions-list li {
          margin-bottom: 0.25rem;
        }
      `}</style>

      <div className="subscribe-container">
        {/* Brand Banner */}
        <div className="podcast-brand">
          <img
            src={feed.cover_image_url || '/favicon.ico'}
            alt={feed.title}
            className="podcast-cover"
          />
          <div className="podcast-info">
            <h1 className="podcast-title">{feed.title}</h1>
            {feed.author && <p className="podcast-author">By {feed.author}</p>}
            <p className="podcast-description">{feed.description || 'Listen to compiled articles, YouTube audio, and web content converted dynamically into podcast episodes.'}</p>
          </div>
        </div>

        {/* One-Click Linkers */}
        <h2 className="section-title">One-Click Subscribe</h2>
        <div className="smart-links-grid">
          {/* Apple Podcasts */}
          <a href={applePodcastsUrl} className="app-btn apple">
            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <title>Apple Podcasts</title>
              <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.59.12 2.2.007 2.864a8.506 8.506 0 01-3.24 5.296c-.608.46-2.096 1.261-2.336 1.261-.088 0-.096-.091-.056-.46.072-.592.144-.715.48-.856.536-.224 1.448-.874 2.008-1.435a7.644 7.644 0 002.008-3.536c.208-.824.184-2.656-.048-3.504-.728-2.696-2.928-4.792-5.624-5.352-.784-.16-2.208-.16-3 0-2.728.56-4.984 2.76-5.672 5.528-.184.752-.184 2.584 0 3.336.456 1.832 1.64 3.512 3.192 4.512.304.2.672.408.824.472.336.144.408.264.472.856.04.36.03.464-.056.464-.056 0-.464-.176-.896-.384l-.04-.03c-2.472-1.216-4.056-3.274-4.632-6.012-.144-.706-.168-2.392-.03-3.04.36-1.74 1.048-3.1 2.192-4.304 1.648-1.737 3.768-2.656 6.128-2.656zm.134 2.81c.409.004.803.04 1.106.106 2.784.62 4.76 3.408 4.376 6.174-.152 1.114-.536 2.03-1.216 2.88-.336.43-1.152 1.15-1.296 1.15-.023 0-.048-.272-.048-.603v-.605l.416-.496c1.568-1.878 1.456-4.502-.256-6.224-.664-.67-1.432-1.064-2.424-1.246-.64-.118-.776-.118-1.448-.008-1.02.167-1.81.562-2.512 1.256-1.72 1.704-1.832 4.342-.264 6.222l.413.496v.608c0 .336-.027.608-.06.608-.03 0-.264-.16-.512-.36l-.034-.011c-.832-.664-1.568-1.842-1.872-2.997-.184-.698-.184-2.024.008-2.72.504-1.878 1.888-3.335 3.808-4.019.41-.145 1.133-.22 1.814-.211zm-.13 2.99c.31 0 .62.06.844.178.488.253.888.745 1.04 1.259.464 1.578-1.208 2.96-2.72 2.254h-.015c-.712-.331-1.096-.956-1.104-1.77 0-.733.408-1.371 1.112-1.745.224-.117.534-.176.844-.176zm-.011 4.728c.988-.004 1.706.349 1.97.97.198.464.124 1.932-.218 4.302-.232 1.656-.36 2.074-.68 2.356-.44.39-1.064.498-1.656.288h-.003c-.716-.257-.87-.605-1.164-2.644-.341-2.37-.416-3.838-.218-4.302.262-.616.974-.966 1.97-.97z"/>
            </svg>
            Apple Podcasts
          </a>

          {/* Pocket Casts */}
          <a href={pocketCastsUrl} className="app-btn pocketcasts">
            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <title>Pocket Casts</title>
              <path d="M12,0C5.372,0,0,5.372,0,12c0,6.628,5.372,12,12,12c6.628,0,12-5.372,12-12 C24,5.372,18.628,0,12,0z M15.564,12c0-1.968-1.596-3.564-3.564-3.564c-1.968,0-3.564,1.595-3.564,3.564 c0,1.968,1.595,3.564,3.564,3.564V17.6c-3.093,0-5.6-2.507-5.6-5.6c0-3.093,2.507-5.6,5.6-5.6c3.093,0,5.6,2.507,5.6,5.6H15.564z M19,12c0-3.866-3.134-7-7-7c-3.866,0-7,3.134-7,7c0,3.866,3.134,7,7,7v2.333c-5.155,0-9.333-4.179-9.333-9.333 c0-5.155,4.179-9.333,9.333-9.333c5.155,0,9.333,4.179,9.333,9.333H19z"/>
            </svg>
            Pocket Casts
          </a>

          {/* Overcast */}
          <a href={overcastUrl} className="app-btn overcast">
            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <title>Overcast</title>
              <path d="M12 24C5.389 24.018.017 18.671 0 12.061V12C0 5.35 5.351 0 12 0s12 5.35 12 12c0 6.649-5.351 12-12 12zm0-4.751l.9-.899-.9-3.45-.9 3.45.9.899zm-1.15-.05L10.4 20.9l1.05-1.052-.6-.649zm2.3 0l-.6.601 1.05 1.051-.45-1.652zm.85 3.102L12 20.3l-2 2.001c.65.1 1.3.199 2 .199s1.35-.05 2-.199zM12 1.5C6.201 1.5 1.5 6.201 1.5 12c-.008 4.468 2.825 8.446 7.051 9.899l2.25-8.35c-.511-.372-.809-.968-.801-1.6 0-1.101.9-2.001 2-2.001s2 .9 2 2.001c0 .649-.301 1.2-.801 1.6l2.25 8.35c4.227-1.453 7.06-5.432 7.051-9.899 0-5.799-4.701-10.5-10.5-10.5zm6.85 15.7c-.255.319-.714.385-1.049.15-.313-.207-.4-.628-.194-.941.014-.021.028-.04.044-.06 0 0 1.35-1.799 1.35-4.35s-1.35-4.35-1.35-4.35c-.239-.289-.198-.719.091-.957.02-.016.039-.031.06-.044.335-.235.794-.169 1.049.15.1.101 1.65 2.15 1.65 5.2S18.949 17.1 18.85 17.2zm-3.651-1.95c-.3-.3-.249-.85.051-1.15 0 0 .75-.799.75-2.1s-.75-2.051-.75-2.1c-.3-.301-.3-.801-.051-1.15.232-.303.666-.357.969-.125.029.022.056.047.082.074C16.301 8.75 17.5 10 17.5 12s-1.199 3.25-1.25 3.301c-.301.299-.75.25-1.051-.051zm-6.398 0c-.301.301-.75.35-1.051.051C7.699 15.199 6.5 14 6.5 12s1.199-3.199 1.25-3.301c.301-.299.801-.299 1.051.051.3.3.249.85-.051 1.15 0 .049-.75.799-.75 2.1s.75 2.1.75 2.1c.3.3.351.799.051 1.15zm-2.602 2.101c-.335.234-.794.169-1.05-.15C5.051 17.1 3.5 15.05 3.5 12s1.551-5.1 1.649-5.2c.256-.319.715-.386 1.05-.15.313.206.4.628.194.941-.013.02-.028.04-.043.059C6.35 7.65 5 9.449 5 12s1.35 4.35 1.35 4.35c.25.3.15.75-.151 1.001z"/>
            </svg>
            Overcast
          </a>

          {/* Podcast Addict */}
          <a href={podcastAddictUrl} className="app-btn podcastaddict">
            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <title>Podcast Addict</title>
              <path d="M5.36.037C2.41.037 0 2.447 0 5.397v13.207c0 2.95 2.41 5.36 5.36 5.36h13.28c2.945 0 5.36-2.41 5.36-5.36V5.396c0-2.95-2.415-5.36-5.36-5.36zm6.585 4.285a7.72 7.72 0 017.717 7.544l.005 7.896h-3.39v-1.326a7.68 7.68 0 01-4.327 1.326 7.777 7.777 0 01-2.384-.378v-4.63a3.647 3.647 0 002.416.91 3.666 3.666 0 003.599-2.97h-1.284a2.416 2.416 0 01-4.73-.66v-.031c0-1.095.728-2.023 1.728-2.316V8.403a3.67 3.67 0 00-2.975 3.6v6.852a7.72 7.72 0 013.625-14.533zm.031 1.87V7.43h.006a4.575 4.575 0 014.573 4.574v.01h1.237v-.01a5.81 5.81 0 00-5.81-5.81zm0 2.149v1.246h.006a2.413 2.413 0 012.415 2.416v.01h1.247v-.01a3.662 3.662 0 00-3.662-3.662zm0 2.252c-.78 0-1.409.629-1.409 1.41 0 .78.629 1.409 1.41 1.409.78 0 1.409-.629 1.409-1.41 0-.78-.629-1.409-1.41-1.409z"/>
            </svg>
            Podcast Addict
          </a>
        </div>

        {/* Manual Addition */}
        <h2 className="section-title">Manual Custom RSS Import</h2>
        <div className="manual-section">
          <div className="copy-group">
            <input
              type="text"
              readOnly
              value={feedUrl || 'Generating link...'}
              className="copy-input"
            />
            <button
              onClick={handleCopy}
              className={`copy-btn ${copied ? 'success' : ''}`}
            >
              {copied ? '✓ Copied' : 'Copy URL'}
            </button>
          </div>

          <div className="instructions-text">
            <strong>How to import manually:</strong>
            <ul className="instructions-list">
              <li><strong>Spotify / YouTube Music / Apple Podcasts:</strong> Copy the RSS feed URL above, navigate to &quot;Add Show&quot; or &quot;Library&quot; &rarr; &quot;Add Feed / Add by URL&quot;, and paste the copied feed URL.</li>
              <li>Any other standard podcast app will support pasting this raw RSS address to load your automated show catalog directly!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
