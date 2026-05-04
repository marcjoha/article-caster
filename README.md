# article-caster

A personal podcast feed generator that converts web articles into spoken-word audio. Paste an article URL, and article-caster will extract the text, synthesize it into natural-sounding speech using Google Cloud TTS, and add it to a private podcast feed you can subscribe to in any podcast app.

## Features

- **Article-to-Audio Ingestion** — Paste any article URL to extract, clean, and convert it into an MP3 podcast episode (processed asynchronously via Cloud Tasks).
- **Podcast Feed Management** — Create and manage multiple podcast feeds, each with its own title, description, and cover image.
- **Private RSS Feeds** — Each feed gets a unique, unguessable URL that can be subscribed to in any podcast client.
- **Admin Authentication** — Simple passcode-based login to protect the admin dashboard.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Infrastructure**: Google Cloud Run, Firestore, Cloud Storage, Cloud Tasks
- **TTS**: Google Cloud Text-to-Speech (Journey voices)
- **Article Extraction**: `@mozilla/readability` + `jsdom`

## Getting Started

### Prerequisites

- Node.js 24+
- A Google Cloud project with Firestore, Cloud Storage, and Text-to-Speech APIs enabled

### Local Development

1. Copy `.env.example` to `.env` and fill in your values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy to Google Cloud Run:

```bash
./cloud-deploy.sh
```

Tear down:

```bash
./cloud-teardown.sh
```

See [SPEC.md](SPEC.md) for full application specification.
