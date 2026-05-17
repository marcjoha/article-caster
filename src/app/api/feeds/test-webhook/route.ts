import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: 'No webhook URL provided' }, { status: 400 });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        cardsV2: [{
          cardId: `test-${Date.now()}`,
          card: {
            header: {
              title: '✅ Webhook Connected',
              subtitle: 'article-caster notifications are working',
              imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/podcast/default/48px.svg',
              imageType: 'CIRCLE',
            },
            sections: [
              {
                widgets: [{
                  textParagraph: {
                    text: 'New episode notifications will appear here as rich cards with AI-generated summaries, quick-listen links, and subscribe buttons.',
                  },
                }],
              },
              {
                widgets: [{
                  buttonList: {
                    buttons: [
                      { text: '▶️ Listen Now', onClick: { openLink: { url: 'https://github.com/marcjoha/article-caster' } } },
                      { text: '🔔 Subscribe to Feed', onClick: { openLink: { url: 'https://github.com/marcjoha/article-caster' } } },
                      { text: '📖 Read Original', onClick: { openLink: { url: 'https://github.com/marcjoha/article-caster' } } },
                    ],
                  },
                }],
              },
              {
                widgets: [{
                  textParagraph: {
                    text: '💬 <i>Thoughts? Reply to this thread to discuss!</i>',
                  },
                }],
              },
            ],
          },
        }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: `Webhook returned ${response.status}: ${body}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Webhook test error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
