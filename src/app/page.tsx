import { headers } from 'next/headers';
import Image from 'next/image';
import { getFeeds, getFeedItems, getSyndications } from '@/lib/firestore';
import FeedForm from './FeedForm';
import { DeleteFeedButton, DeleteItemButton, FeedUrlDisplay } from './ClientButtons';
import IngestionTabs from './IngestionTabs';
import FeedSelector from './FeedSelector';
import ProcessingList from './ProcessingList';

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
        <h1 style={{margin: 0, fontSize: '1.5rem'}}>article-caster</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FeedSelector feeds={feeds} activeFeedId={activeFeedId} />
          <FeedForm buttonText="New Podcast" />
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {selectedFeed ? (
          <div className="card" style={{padding: '2.5rem', maxWidth: '100%'}}>
              <div className="feed-header" style={{display: 'flex', gap: '2rem', marginBottom: '2.5rem'}}>
                <div style={{flexShrink: 0}}>
                  {selectedFeed.cover_image_url ? (
                    <Image src={selectedFeed.cover_image_url} alt="Cover" width={120} height={120} unoptimized={true} priority={true} style={{borderRadius: '12px', objectFit: 'cover'}} />
                  ) : (
                    <div style={{width: '120px', height: '120px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <span style={{fontSize: '3rem', color: '#fff'}}>{selectedFeed.title.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                  <div className="feed-header-info" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <h2 style={{margin: '0 0 0.5rem 0', fontSize: '2rem', display: 'flex', alignItems: 'center'}}>
                        {selectedFeed.title}
                        {selectedFeed.category && (
                          <span style={{
                            marginLeft: '1rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            verticalAlign: 'middle',
                            fontWeight: 'normal',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                          }}>
                            {selectedFeed.category}
                          </span>
                        )}
                      </h2>
                      <p style={{margin: 0, color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.5, maxWidth: '600px'}}>
                        {selectedFeed.description || 'No description provided.'}
                      </p>
                      <FeedUrlDisplay baseUrl={baseUrl} path={`/feed/${selectedFeed.unguessable_slug}.xml`} />
                    </div>
                    <div className="feed-actions" style={{display: 'flex', gap: '1rem'}}>
                      <FeedForm 
                        initialData={{
                          id: selectedFeed.id!, 
                          title: selectedFeed.title, 
                          description: selectedFeed.description, 
                          category: selectedFeed.category,
                          cover_image_url: selectedFeed.cover_image_url
                        }} 
                        buttonText="Edit" 
                      />
                      <DeleteFeedButton feedId={selectedFeed.id!} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{marginTop: '2rem', marginBottom: '3rem'}}>
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
                            <div className="article-title">
                              {item.source_url ? (
                                <a href={item.source_url} target="_blank" rel="noreferrer">
                                  {item.title}
                                </a>
                              ) : (
                                item.title
                              )}
                            </div>
                            <div className="article-meta">
                              Added at {formatDateTime(item.created_at)}
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
                            <DeleteItemButton itemId={item.id!} />
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
