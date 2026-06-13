import Image from 'next/image';
import { getFeeds, getFeedItems, getSyndications } from '@/lib/firestore';
import FeedForm from '@/components/FeedForm';
import { DeleteFeedButton, DeleteItemButton, ListenAudioButton, SubscribePageLink, WatchVideoButton } from '@/components/ClientButtons';
import IngestionTabs from '@/components/IngestionTabs';
import FeedSelector from '@/components/FeedSelector';
import ProcessingList from '@/components/ProcessingList';
import LogViewer from '@/components/LogViewer';

import { formatDateTime, getGcsStorageCost } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ feedId?: string }> }) {
  const { feedId } = await searchParams;
  const feeds = await getFeeds();
  
  const foundFeed = feedId ? feeds.find(f => f.id === feedId) : undefined;
  const selectedFeed = foundFeed || (feeds.length > 0 ? feeds[0] : null);
    
  const activeFeedId = selectedFeed?.id;
  const items = activeFeedId ? await getFeedItems(activeFeedId) : [];
  const syndications = activeFeedId ? await getSyndications(activeFeedId) : [];


  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="header">
        <Image src="/logo.svg" alt="article-caster logo" width={260} height={44} priority />
        <div className="header-actions">
          <FeedSelector feeds={feeds} activeFeedId={activeFeedId} />
          <FeedForm buttonText="New Podcast" />
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {selectedFeed ? (
          <div className="card" style={{padding: '2.5rem', maxWidth: '100%'}}>
              <div className="feed-header" style={{display: 'flex', gap: '2rem', marginBottom: '1.5rem'}}>
                <div style={{flexShrink: 0}}>
                  {selectedFeed.cover_image_url ? (
                    <Image src={selectedFeed.cover_image_url} alt="Cover" width={120} height={120} unoptimized={true} priority={true} style={{borderRadius: '12px', objectFit: 'cover'}} />
                  ) : (
                    <div style={{width: '120px', height: '120px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <span style={{fontSize: '3rem', color: '#fff'}}>{selectedFeed.title.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                  <div className="feed-header-info" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <h2 className="feed-title">
                        {selectedFeed.title}
                        <SubscribePageLink slug={selectedFeed.unguessable_slug} />
                      </h2>
                      <p className="feed-description">
                        {selectedFeed.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="feed-actions" style={{display: 'flex', gap: '1rem'}}>
                      <FeedForm 
                        initialData={{
                          id: selectedFeed.id!, 
                          title: selectedFeed.title, 
                          description: selectedFeed.description, 
                          category: selectedFeed.category,
                          cover_image_url: selectedFeed.cover_image_url,
                          author: selectedFeed.author,
                          tts_voice: selectedFeed.tts_voice,
                          audio_prefix_message: selectedFeed.audio_prefix_message,
                          chat_webhook_url: selectedFeed.chat_webhook_url,
                        }} 
                        buttonText="Edit" 
                        buttonTitle="Edit Podcast Settings"
                      />
                      <LogViewer feedId={selectedFeed.id!} />
                      <DeleteFeedButton feedId={selectedFeed.id!} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{marginTop: '0', marginBottom: '3rem'}}>
                <IngestionTabs feedId={selectedFeed.id!} syndications={syndications} />
              </div>

              <ProcessingList feedId={selectedFeed.id!} episodes={items} />

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h3 style={{margin: 0}}>Podcast Episodes</h3>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>
                  {items.length} {items.length === 1 ? 'episode' : 'episodes'}
                  {items.length > 0 && (() => {
                    const totalBytes = items.reduce((sum, item) => sum + (item.size_bytes || 0), 0);
                    if (totalBytes === 0) return null;
                    const units = ['B', 'KB', 'MB', 'GB'];
                    let size = totalBytes;
                    let unitIndex = 0;
                    while (size >= 1024 && unitIndex < units.length - 1) {
                      size /= 1024;
                      unitIndex++;
                    }
                    const formatted = unitIndex === 0 ? `${size} ${units[unitIndex]}` : `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
                    
                    const region = process.env.GOOGLE_CLOUD_REGION || 'europe-north2';
                    const { formattedCost, ratePerGb } = getGcsStorageCost(totalBytes, region);
                    
                    return (
                      <>
                        {" · "}
                        {formatted}
                        {" · "}
                        <span className="tooltip-container" style={{ cursor: 'help' }}>
                          ${formattedCost}/mo
                          <span className="tooltip-text">
                            Based on Standard Storage list price of ${ratePerGb.toFixed(3)}/GB/mo in {region}
                          </span>
                        </span>
                      </>
                    );
                  })()}
                </span>
              </div>
              
              {items.length === 0 ? (
                <div style={{
                  padding: '4rem 1rem', 
                  textAlign: 'center', 
                  backgroundColor: 'rgba(15, 23, 42, 0.5)', 
                  borderRadius: '8px',
                  border: '1px dashed #334155',
                  color: 'var(--text-secondary)'
                }}>
                  <p>No podcast episodes in this feed yet.</p>
                </div>
              ) : (
                <div className="article-table-container">
                  <table className="article-table">
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>

                          <td>
                            <div className="article-title" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
                              <div style={{
                                color: item.origin === 'youtube' ? '#f87171' : item.origin === 'pdf' ? '#fca5a5' : item.origin === 'rss' ? '#60a5fa' : '#94a3b8',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center'
                              }} title={item.origin === 'youtube' ? 'YouTube Ingestion' : item.origin === 'rss' ? 'RSS Ingestion' : item.origin === 'pdf' ? 'PDF Ingestion' : 'Article Ingestion'}>
                                {item.origin === 'youtube' ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                                  </svg>
                                ) : item.origin === 'rss' ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                  </svg>
                                ) : item.origin === 'pdf' ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                  </svg>
                                )}
                              </div>
                              {item.source_url ? (
                                <a href={item.source_url} target="_blank" rel="noreferrer">
                                  {item.title}
                                </a>
                              ) : (
                                item.title
                              )}
                            </div>
                            <div className="article-meta">
                              Added {formatDateTime(item.created_at)}
                              {item.source_url && (
                                <>
                                  <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>•</span>
                                  {item.origin === 'pdf' ? (
                                    'Uploaded PDF'
                                  ) : (() => {
                                    try {
                                      return new URL(item.source_url).hostname.replace(/^www\./, '');
                                    } catch {
                                      return item.source_url;
                                    }
                                  })()}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="article-actions-cell">
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              {item.type === 'video' || item.media_url.toLowerCase().endsWith('.mp4') ? (
                                <WatchVideoButton videoUrl={item.media_url} title={item.title} />
                              ) : (
                                <ListenAudioButton audioUrl={item.media_url} title={item.title} coverImageUrl={selectedFeed.cover_image_url} />
                              )}
                              <DeleteItemButton itemId={item.id!} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              )}
            </div>
          ) : (
            <div className="card" style={{
              padding: '4rem 2rem', 
              maxWidth: '100%', 
              textAlign: 'center', 
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px'
            }}>
              <p style={{maxWidth: '600px', lineHeight: 1.6}}>Create a new feed to start ingesting articles for your personalized podcast.</p>
            </div>
          )}
        </div>
      </div>
  );
}
