'use client';
import { useRouter } from 'next/navigation';


interface Feed {
  id?: string;
  title: string;
}

export default function FeedSelector({ feeds, activeFeedId }: { feeds: Feed[], activeFeedId?: string }) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const feedId = e.target.value;
    if (feedId) {
      router.push(`/?feedId=${feedId}`);
    }
  };

  if (feeds.length === 0) return null;

  return (
    <>
      <select 
        value={activeFeedId || ''} 
        onChange={handleChange}
        className="input-field"
        style={{ minWidth: '200px', margin: 0 }}
      >
        {[...feeds].sort((a, b) => a.title.localeCompare(b.title)).map(feed => (
          <option key={feed.id} value={feed.id}>{feed.title}</option>
        ))}
      </select>
    </>
  );
}
