import Image from 'next/image';
import { getFeeds, getFeedItems } from '@/lib/firestore';
import FeedForm from './FeedForm';
import { DeleteFeedButton, DeleteItemButton, FeedUrlDisplay } from './ClientButtons';
import IngestionForm from './IngestionForm';
import FeedSelector from './FeedSelector';
import ProcessingList from './ProcessingList';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ feedId?: string }> }) {
  const { feedId } = await searchParams;
  const feeds = await getFeeds();
  
  const selectedFeed = feedId 
    ? feeds.find(f => f.id === feedId) 
    : (feeds.length > 0 ? feeds[0] : null);
    
  const activeFeedId = selectedFeed?.id;
  const items = activeFeedId ? await getFeedItems(activeFeedId) : [];

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{margin: 0, fontSize: '1.5rem'}}>article-caster</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FeedSelector feeds={feeds} activeFeedId={activeFeedId} />
          <FeedForm buttonText="New Feed" />
        </div>
      </div>

      <div style={{ width: '100%' }}>
        {selectedFeed ? (
          <div className="card" style={{padding: '2.5rem', maxWidth: '100%'}}>
              <div className="feed-header" style={{display: 'flex', gap: '2rem', marginBottom: '2.5rem'}}>
                <div style={{flexShrink: 0}}>
                  {selectedFeed.cover_image_url ? (
                    <Image src={selectedFeed.cover_image_url} alt="Cover" width={120} height={120} unoptimized={true} style={{borderRadius: '12px', objectFit: 'cover'}} />
                  ) : (
                    <div style={{width: '120px', height: '120px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <span style={{fontSize: '3rem', color: '#fff'}}>{selectedFeed.title.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                  <div className="feed-header-info" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <h2 style={{margin: '0 0 0.5rem 0', fontSize: '2rem'}}>{selectedFeed.title}</h2>
                      <p style={{margin: 0, color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.5, maxWidth: '600px'}}>
                        {selectedFeed.description || 'No description provided.'}
                      </p>
                      <FeedUrlDisplay path={`/feed/${selectedFeed.unguessable_slug}`} />
                    </div>
                    <div className="feed-actions" style={{display: 'flex', gap: '1rem'}}>
                      <FeedForm 
                        initialData={{
                          id: selectedFeed.id!, 
                          title: selectedFeed.title, 
                          description: selectedFeed.description, 
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
                <IngestionForm feedId={selectedFeed.id!} />
              </div>

              <ProcessingList feedId={selectedFeed.id!} />

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h3 style={{margin: 0}}>Articles</h3>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>{items.length} articles</span>
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
                  <p>No articles in this feed yet.</p>
                </div>
              ) : (
                <div className="item-list">
                  {items.map(item => (
                    <div key={item.id} className="item-card" style={{padding: '1.25rem', borderLeft: '4px solid var(--accent-color)'}}>
                      <div className="item-info" style={{width: '100%'}}>
                        <h4 style={{margin: '0 0 0.5rem 0', fontSize: '1.1rem'}}>{item.title}</h4>
                        <div className="item-card-details" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem'}}>
                          <p style={{fontSize: '0.875rem', margin: 0}}>
                            {Math.round(item.duration_seconds / 60)} mins • {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          <div className="item-card-actions" style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                            <audio controls src={item.media_url} style={{ height: '36px' }} />
                            <DeleteItemButton itemId={item.id!} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
