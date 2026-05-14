import { headers } from 'next/headers';
import Image from 'next/image';
import { getFeeds, getFeedItems, getSyndications } from '@/lib/firestore';
import FeedForm from '@/components/FeedForm';
import { DeleteFeedButton, DeleteItemButton, FeedUrlDisplay, ReprocessItemButton } from '@/components/ClientButtons';
import IngestionTabs from '@/components/IngestionTabs';
import FeedSelector from '@/components/FeedSelector';
import ProcessingList from '@/components/ProcessingList';
import FeedStats from '@/components/FeedStats';

import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ feedId?: string }> }) {
  const { feedId } = await searchParams;
  const feeds = await getFeeds();
  
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  
  const foundFeed = feedId ? feeds.find(f => f.id === feedId) : undefined;
  const selectedFeed = foundFeed || (feeds.length > 0 ? feeds[0] : null);
    
  const activeFeedId = selectedFeed?.id;
  const items = activeFeedId ? await getFeedItems(activeFeedId) : [];
  const syndications = activeFeedId ? await getSyndications(activeFeedId) : [];

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <Image src="/logo.svg" alt="article-caster logo" width={260} height={44} priority />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                      <h2 style={{margin: '0 0 0.5rem 0', fontSize: '2rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                        {selectedFeed.title}
                        <FeedUrlDisplay baseUrl={baseUrl} path={`/feed/${selectedFeed.unguessable_slug}.xml`} />
                      </h2>
                      <p style={{margin: 0, color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.5, maxWidth: '600px'}}>
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
                          audio_prefix_message: selectedFeed.audio_prefix_message
                        }} 
                        buttonText="Edit" 
                      />
                      <DeleteFeedButton feedId={selectedFeed.id!} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{marginTop: '0', marginBottom: '3rem'}}>
                <FeedStats feedId={selectedFeed.id!} />
                <IngestionTabs feedId={selectedFeed.id!} syndications={syndications} />
              </div>

              <ProcessingList feedId={selectedFeed.id!} />

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h3 style={{margin: 0}}>Podcast Episodes</h3>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>{items.length} {items.length === 1 ? 'episode' : 'episodes'}</span>
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
                            <div className="article-title" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <div style={{
                                color: '#94a3b8',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center'
                              }} title={item.origin === 'rss' ? 'RSS Ingestion' : 'Article Ingestion'}>
                                {item.origin === 'rss' ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1rem', height: '1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
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
                                  {(() => {
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
                          <td className="article-audio-cell">
                            <audio controls src={item.media_url} />
                          </td>
                          <td className="article-actions-cell">
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                              <ReprocessItemButton itemId={item.id!} />
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
