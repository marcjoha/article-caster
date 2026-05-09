---
trigger: always_on
---

# Specification

## Application Overview

The name of this application is **article-caster** (verbatim, all lowercase, never use "Article Caster" or similar). It helps busy people catch-up on interesting articles on the go, by allowing these to be "saved for later" and added into a personal podcast feed.

Articles are cleaned up from ads and converted into spoken word. The resulting audio files are stored in a content repository and added to a custom podcast feed as audio items.

## Business Logic & User Flows

1. **Authentication**: The application has an admin web interface restricted to a single admin user via a Simple Passcode mechanism. The passcode is securely stored as `ADMIN_PASSCODE` in the environment variables and validated using Next.js middleware with an `admin_session` cookie.
2. **Feed Management**: 
   - The admin can create new podcast feeds and provide relevant metadata (e.g., title, description, author name, cover image, TTS voice, audio prefix message).
   - The admin can view, edit, and delete existing feeds.
   - The feed URL generated is public to allow podcast clients to subscribe, but uses an "unguessable" random string (e.g., UUID) to protect privacy.
   - Whenever modifications are made to the podcast feed generation logic, the resulting feeds must be strictly validated against the latest Apple Podcasts or RSS feed standards.
3. **Content Ingestion**:
   - **Articles**: The admin can submit an article URL. The system offloads the processing to a Google Cloud Tasks background worker, which extracts the main text content, removes ads and boilerplate using a Gemini LLM, and uses a Text-to-Speech (TTS) service to generate an audio file.
   - **RSS Syndication**: The admin can add RSS syndications to automatically ingest blog posts. A scheduled cron job (via Cloud Scheduler) periodically syncs new items.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to the generated audio content directly through the admin site.

## Data Model

*   **Feeds**: `id`, `title`, `description`, `author`, `category` (optional), `cover_image_url`, `tts_voice`, `audio_prefix_message`, `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (audio), `size_bytes`, `duration_seconds`, `origin` (article | rss), `created_at`
*   **Ingestions**: `id`, `feed_id`, `url`, `status`, `error`, `origin` (article | rss), `created_at`
*   **Syndications**: `id`, `feed_id`, `url`, `title`, `last_checked_at`, `created_at`

## Technology Stack

*   **Backend & Frontend**: Next.js 16 (App Router) used as a unified full-stack Node.js framework to serve both the React frontend and backend API routes. Intended for deployment on Google Cloud Run.
*   **Storage**: 
    *   **Google Cloud Storage (GCS)**: Stores the generated audio and downloaded video files. The bucket must be configured with Uniform Bucket-Level Access to be publicly readable, allowing podcast clients direct access to media.
    *   **Google Cloud Firestore**: Stores metadata about feeds and feed items.
*   **Core Integrations**:
    *   **Google Cloud Tasks**: Used to queue and process long-running article ingestion tasks asynchronously to prevent web request timeouts.
    *   **Article Extraction**: `@mozilla/readability` paired with `jsdom` to extract clean text, followed by a Gemini LLM to remove boilerplate and ads.
    *   **Text-to-Speech (TTS)**: Gemini 3.1 Flash TTS API for highly expressive, human-like podcast audio.
    *   **Podcast Feed**: `podcast` npm package (supports RSS 2.0 with iTunes extensions for audio enclosures).

