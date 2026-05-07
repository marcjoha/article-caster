<p align="center">
  <img src="public/logo.svg" alt="article-caster logo" width="400" />
</p>

# article-caster

A personal podcast feed generator that converts web articles into spoken-word audio. Paste an article URL, and article-caster will extract the text, synthesize it into natural-sounding speech using Google Cloud TTS, and add it to a private podcast feed you can subscribe to in any podcast app.

## Features

- **Article-to-Audio Ingestion** — Paste any article URL to extract, clean, and convert it into an MP3 podcast episode (processed asynchronously via Cloud Tasks).
- **Podcast Feed Management** — Create and manage multiple podcast feeds, each with its own title, description, category, and cover image.
- **Private RSS Feeds** — Each feed gets a unique, unguessable URL that can be subscribed to in any podcast client.
- **Admin Authentication** — Simple passcode-based login to protect the admin dashboard.
- **Content Management** — Play/listen to generated audio directly in the admin UI, and remove items from feeds.

## Architecture

![GCP Topology](docs/gcp-topology.png)

| Service | Purpose |
|---|---|
| **Cloud Run** | Hosts the Next.js application (admin UI + API routes + RSS feed endpoint) |
| **Cloud Firestore** | Stores metadata for feeds, items, and ingestion records |
| **Cloud Storage (GCS)** | Stores generated MP3 audio files, publicly accessible for podcast clients |
| **Cloud Tasks** | Queues and processes long-running article ingestion jobs asynchronously |
| **Cloud Text-to-Speech** | Synthesizes article text into natural-sounding audio using Gemini 3.1 Flash TTS |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Infrastructure**: Google Cloud Run, Firestore, Cloud Storage, Cloud Tasks
- **TTS**: Vertex AI Gemini 3.1 Flash TTS
- **Article Extraction**: `@mozilla/readability` + `jsdom`
- **Podcast Feed**: `podcast` npm package (RSS 2.0 with iTunes extensions)

## Getting Started

### Prerequisites

- Node.js 24+
- A Google Cloud project with Firestore, Cloud Storage, Cloud Tasks, and Text-to-Speech APIs enabled

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|---|---|
| `ADMIN_PASSCODE` | Passcode for admin dashboard login |
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID |
| `GCS_BUCKET_NAME` | Cloud Storage bucket name for audio files |
| `GOOGLE_CLOUD_REGION` | GCP region for Cloud Run and Firestore (e.g., `europe-north2`) |
| `CLOUD_TASKS_REGION` | GCP region for Cloud Tasks queue (e.g., `europe-west1`) |

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

Tear down all infrastructure:

```bash
./cloud-teardown.sh
```

See [SPEC.md](.agents/specs/SPEC.md) for full application specification.
