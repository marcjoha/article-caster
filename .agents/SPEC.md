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
   - **Content Quality Gate**: After extraction, a Gemini-powered quality gate validates that the content is genuine article text — not a login wall, paywall, cookie banner, error page, or other site chrome. Content that fails the check is rejected with a descriptive error, preventing garbage from reaching TTS or subscriber feeds. The gate also enforces a minimum content length (200 chars). It fails open: if the LLM validation itself errors, content passes through to preserve ingestion availability.
   - **YouTube Videos**: The admin can submit a YouTube URL. The worker downloads the video file (targeting 720p resolution or lower) using `yt-dlp` to preserve the original video and audio. It uploads the raw MP4 file directly to Google Cloud Storage (GCS) and registers it as a `'video'` type item. To avoid heavy video re-encoding, the TTS prefix intro is prepended textually into the episode description.
   - **RSS Syndication**: The admin can add RSS syndications to automatically ingest blog posts. A scheduled cron job (via Cloud Scheduler) periodically syncs new items. To ensure perfect chronological order in the generated podcast feed, both initial bulk load and cron sync routes extract and use the original blog post publication dates (`isoDate` or `pubDate`) rather than synthetic execution timestamps, utilizing a deterministic subtractive-offset loop index fallback if publication dates are identical or missing.
   - **Episode Summaries**: During ingestion, Gemini generates a concise 1–3 sentence summary of each episode's source content. This summary is stored as the episode description and surfaced in the RSS feed's `<description>` and `<itunes:summary>` elements for podcast players to display.
   - **Google Chat Notifications**: Each feed can optionally have a Google Chat webhook URL configured. When set, a rich card message is posted to the Chat space for each newly ingested episode. The card header displays the episode title with a subtitle of "New episode of [feed title]". The card body includes the AI-generated summary, source domain, duration, and three action buttons: Watch this episode / Listen to this episode (direct link), Subscribe to the podcast (public subscription landing page at `/subscribe/[slug]`), and Watch original / Read original (source URL). A discussion prompt encourages thread replies. Each episode is posted as a top-level message. In-place updates (reprocessing) are silent and do not trigger notifications.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to generated audio or watch original video via an interactive glassmorphic popup player modal directly through the admin site.
5. **Activity Log**:
   - Each feed maintains a per-feed activity log that records important pipeline events: ingestion lifecycle (success, failure, dedup), RSS cron syncs, Chat notification outcomes, and feed/episode management actions.
   - The log is accessible via a "Log" button in the feed header.
   - Clicking the button opens a modal dialog showing timestamped log entries, each color-coded by severity (info/warn/error) and tagged by category (ingestion/rss/chat/feed/episode).
   - The log auto-refreshes every 5 seconds while the modal is open.
   - Log retention is capped at 500 entries per feed; oldest entries are purged on each write.
## Data Model

*   **Feeds**: `id`, `title`, `description`, `author`, `category` (optional), `cover_image_url`, `tts_voice`, `audio_prefix_message`, `chat_webhook_url` (optional, Google Chat incoming webhook URL), `processed_urls` (permanent set of all URLs ever ingested, prevents RSS re-ingestion of deleted items), `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (`audio` | `video`), `size_bytes`, `duration_seconds`, `origin` (`article` | `youtube` | `rss`), `created_at`
*   **Ingestions**: `id`, `feed_id`, `url`, `status`, `error`, `origin` (article | youtube | rss), `created_at` — ephemeral work-in-progress records, auto-deleted on successful completion. Only pending/failed records exist at any time.
*   **Syndications**: `id`, `feed_id`, `url`, `title`, `last_checked_at`, `created_at`
*   **Logs**: `id`, `feed_id`, `level` (info | warn | error), `category` (ingestion | rss | chat | feed | episode), `message`, `details` (optional), `created_at` — activity log entries, capped at 500 per feed. Cascade-deleted with feed.

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
