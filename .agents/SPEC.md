---
trigger: always_on
---

# Specification

## Application Overview

The name of this application is **article-caster** (verbatim, all lowercase, never use "Article Caster" or similar). It helps busy people catch-up on interesting articles on the go, by allowing these to be "saved for later" and added into a personal podcast feed.

Articles are cleaned up from ads and converted into spoken word. The resulting audio files are stored in a content repository and added to a custom podcast feed as audio items.

## Business Logic & User Flows

1. **Authentication**: The application has an admin web interface restricted to a single admin user via a Simple Passcode mechanism. The passcode is securely stored as `ADMIN_PASSCODE` in the environment variables and validated using Next.js proxy with an `admin_session` cookie.
2. **Feed Management**: 
   - The admin can create new podcast feeds and provide relevant metadata (e.g., title, description, author name, cover image, TTS voice, audio prefix message).
   - The admin can view, edit, and delete existing feeds.
   - The feed URL generated is public to allow podcast clients to subscribe, but uses an "unguessable" random string (e.g., UUID) to protect privacy.
   - Whenever modifications are made to the podcast feed generation logic, the resulting feeds must be strictly validated against the latest Apple Podcasts or RSS feed standards.
3. **Content Ingestion**:
   - **Articles**: The admin can submit an article URL. The system offloads the processing to a Google Cloud Tasks background worker, which extracts the main text content, removes ads and boilerplate using a Gemini LLM, and uses a Text-to-Speech (TTS) service to generate an audio file.
   - **YouTube Videos**: The admin can submit a YouTube URL. The worker extracts the video audio using yt-dlp, prepends the standardized intro message using TTS, and streams the MP3 data natively via FFmpeg to prevent memory overload.
   - **RSS Syndication**: The admin can add RSS syndications to automatically ingest blog posts. A scheduled cron job (via Cloud Scheduler) periodically syncs new items.
   - **Episode Summaries**: During ingestion, Gemini generates a concise 1–3 sentence summary of each episode's source content. This summary is stored as the episode description and surfaced in the RSS feed's `<description>` and `<itunes:summary>` elements for podcast players to display.
   - **Google Chat Notifications**: Each feed can optionally have a Google Chat webhook URL configured. When set, a rich card message is posted to the Chat space for each newly ingested episode. In-place updates (reprocessing) are silent and do not trigger notifications.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to the generated audio content directly through the admin site.
## Data Model

*   **Feeds**: `id`, `title`, `description`, `author`, `category` (optional), `cover_image_url`, `tts_voice`, `audio_prefix_message`, `chat_webhook_url` (optional, Google Chat incoming webhook URL), `processed_urls` (permanent set of all URLs ever ingested, prevents RSS re-ingestion of deleted items), `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (audio), `size_bytes`, `duration_seconds`, `origin` (article | youtube | rss), `created_at`
*   **Ingestions**: `id`, `feed_id`, `url`, `status`, `error`, `origin` (article | youtube | rss), `created_at` — ephemeral work-in-progress records, auto-deleted on successful completion. Only pending/failed records exist at any time.
*   **Syndications**: `id`, `feed_id`, `url`, `title`, `last_checked_at`, `created_at`

## Technology Stack

*   **Backend & Frontend**: Next.js 16 (App Router) used as a unified full-stack Node.js framework to serve both the React frontend and backend API routes. Intended for deployment on Google Cloud Run.
*   **Storage**: 
    *   **Google Cloud Storage (GCS)**: Stores the generated audio files. The bucket must be configured with Uniform Bucket-Level Access to be publicly readable, allowing podcast clients direct access to media.
    *   **Google Cloud Firestore**: Stores metadata about feeds and feed items.
*   **Core Integrations**:
    *   **Google Cloud Tasks**: Used to queue and process long-running article ingestion tasks asynchronously to prevent web request timeouts.
    *   **Google Cloud Scheduler**: Triggers daily RSS syndication cron jobs to automatically ingest new blog posts.
    *   **Article Extraction**: Primary direct fetch with Jina Reader API fallback, paired with `@mozilla/readability` and `jsdom` to extract clean text, followed by a Gemini LLM to remove boilerplate and ads.
    *   **Text-to-Speech (TTS)**: Gemini 3.1 Flash TTS API for highly expressive, human-like podcast audio.
    *   **Audio Mastering**: FFmpeg is used to encode podcast-grade MP3 (128 kbps CBR, 44.1 kHz mono via libmp3lame) and apply loudness normalization (-16 LUFS) with True Peak limiting (-1.0 dBTP) for professional podcast audio.
    *   **Podcast Feed**: `podcast` npm package (supports RSS 2.0 with iTunes extensions for audio enclosures).

## User Interface

*   **Button Colors**:
    *   **Red**: Destructive actions (e.g., delete, remove).
    *   **Blue**: Inserts or updates (e.g., save, edit).
    *   **Green**: Non-destructive actions.
    *   **Gray**: For cancelling operations.
