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
   - **Transient Error Resilience & Retry Policy**: All external API and LLM/TTS operations (including Vertex AI TTS audio chunk generation, PDF parsing, content validation, and summarization) are protected by a centralized retry wrapper (`withRetry`). The retry logic automatically identifies transient network timeouts (`UND_ERR_HEADERS_TIMEOUT`, `ConnectTimeoutError`), socket drops (`ECONNRESET`, `ETIMEDOUT`), rate limits (HTTP 429), and upstream 5xx errors, applying exponential backoff with full jitter across retry attempts. HTTP clients are configured with generous request timeouts (up to 120s) to prevent premature client-side aborts during intensive generation.
   - **Content Quality Gate**: After extraction, a Gemini-powered quality gate validates that the content is genuine article text — not a login wall, paywall, cookie banner, error page, or other site chrome. Content that fails the check is rejected with a descriptive error, preventing garbage from reaching TTS or subscriber feeds. The gate also enforces a minimum content length (200 chars). It fails open: if the LLM validation itself errors, content passes through to preserve ingestion availability.
   - **YouTube Videos**: The admin can submit a YouTube URL. This is strictly supported only when running the application on a local development machine (not on Cloud Run). On a local machine, the worker downloads the video file (targeting 1080p resolution or lower) using `yt-dlp` to preserve the original video and audio. If `feed.audio_prefix_message` is configured, a video intro card (a black screen with the wrapped, centered episode title accompanied by the synthesized audio intro prefix) is generated dynamically and losslessly concatenated with the YouTube video before uploading to GCS. It is uploaded as a `'video'` type item.
   - **PDF Documents**: The admin can upload a local PDF file (up to 20MB) or submit a direct URL pointing to a PDF. The uploaded PDF is saved to GCS with an inline disposition so it can be viewed in-browser. The PDF pipeline uses Gemini 3.5 Flash to natively parse multi-column paper structure and extract a clean semantic HTML narrative suitable for high-quality TTS podcast generation. It automatically strips header/footer clutter, affiliations, citations, figure captions, mathematical formulas (converting them to simple spoken equivalents), and bibliography lists.
   - **RSS Syndication**: The admin can add RSS syndications to automatically ingest blog posts. A scheduled cron job (via Cloud Scheduler) periodically syncs new items. For RSS feed subscriptions, the episode title is strictly preserved from the RSS feed item title at all times. To ensure perfect chronological order in the generated podcast feed, both initial bulk load and cron sync routes extract and use the original blog post publication dates (`isoDate` or `pubDate`) rather than synthetic execution timestamps, utilizing a deterministic subtractive-offset loop index fallback if publication dates are identical or missing.
   - **Episode Summaries**: During ingestion, Gemini generates a concise 1–3 sentence summary of each episode's source content. This summary is stored as the episode description and surfaced in the RSS feed's `<description>` and `<itunes:summary>` elements for podcast players to display.
   - **Google Chat Notifications**: Each feed can optionally have a Google Chat webhook URL configured. When set, a rich card message is posted to the Chat space for each newly ingested episode. The card header displays the episode title with a subtitle of "New episode of [feed title]". The card body includes the AI-generated summary, source domain, duration, and three action buttons: Watch / Listen (direct media link), Subscribe (public subscription landing page at `/subscribe/[slug]`), and Source (source URL). A discussion prompt encourages thread replies. Each episode is posted as a top-level message. In-place updates (reprocessing) are silent and do not trigger notifications.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to generated audio or watch original video via an interactive glassmorphic popup player modal directly through the admin site.
5. **Activity Log**:
   - Each feed maintains a per-feed activity log that records important pipeline events: ingestion lifecycle (success, failure, dedup), RSS cron syncs, Chat notification outcomes, and feed/episode management actions.
   - The log is accessible via a "Log" button in the feed header.
   - Clicking the button opens a modal dialog showing timestamped log entries, each color-coded by severity (info/warn/error) and tagged by category (ingestion/rss/chat/feed/episode).
   - **Required URL details**: Every log entry has a strictly **required** `details` field containing exactly and only a valid URL. This URL acts as a key identifying the resource (such as the source article URL, the ingested media URL, or the feed's public RSS subscription URL for feed-level events). The second row of each log entry displays this URL directly.
   - The log auto-refreshes every 5 seconds while the modal is open.
   - Log retention is capped at 500 entries per feed; oldest entries are purged on each write.
6. **Episode Publishing Rate Limiter & Queue**:
    - Feeds can optionally enable an episode publishing rate limiter and schedule (e.g. 1 episode per weekday at 08:00 UTC). Default is disabled (immediate publishing).
    - When enabled, incoming content is ingested, TTS-synthesized, and audio-mastered immediately upon ingestion, then held in a `queued` state.
    - An hourly Cloud Scheduler job (`/api/worker/publish-cron`) evaluates scheduled feeds. It checks active days, scheduled release hour, and counts episodes already published on the current calendar day (`published_at >= startOfDayUtc`) to respect daily quotas. Eligible FIFO queued items are then published, and Google Chat notifications are dispatched.
    - The admin UI displays a dedicated "Publishing Queue" section with audio/video preview, instant manual "Publish Now" override, and delete controls.
    - Disabling rate limiting on a feed immediately flushes and publishes all remaining queued items.

## Data Model

*   **Feeds**: `id`, `title`, `description`, `author`, `category` (optional), `cover_image_url`, `tts_voice`, `audio_prefix_message`, `chat_webhook_url` (optional), `rate_limit_enabled` (optional boolean), `rate_limit_schedule` ('weekdays' | 'daily' | 'custom'), `rate_limit_days` (number[]), `rate_limit_hour_utc` (number), `rate_limit_episodes_per_window` (number), `last_rate_limit_published_date` (string), `processed_urls` (permanent set of all URLs ever ingested), `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (`audio` | `video`), `size_bytes`, `duration_seconds`, `origin` (`article` | `youtube` | `rss` | `pdf`), `status` (`published` | `queued`), `published_at` (optional Date), `queued_at` (optional Date), `syndication_title` (optional string), `created_at`
*   **Ingestions**: `id`, `feed_id`, `url`, `status`, `error`, `origin` (`article` | `youtube` | `rss` | `pdf`), `created_at` — ephemeral work-in-progress records, auto-deleted on successful completion. Only pending/failed records exist at any time.
*   **Syndications**: `id`, `feed_id`, `url`, `title`, `last_checked_at`, `created_at`
*   **Logs**: `id`, `feed_id`, `level` (info | warn | error), `category` (ingestion | rss | chat | feed | episode), `message`, `details` (required, strictly a URL), `created_at` — activity log entries, capped at 500 per feed. Cascade-deleted with feed.

## Technology Stack

*   **Backend & Frontend**: Next.js 16 (App Router) used as a unified full-stack Node.js framework to serve both the React frontend and backend API routes. Intended for deployment on Google Cloud Run.
*   **Storage**: 
    *   **Google Cloud Storage (GCS)**: Stores the generated audio files. The bucket must be configured with Uniform Bucket-Level Access to be publicly readable, allowing podcast clients direct access to media.
    *   **Google Cloud Firestore**: Stores metadata about feeds and feed items.
*   **Core Integrations**:
    *   **Google Cloud Tasks**: Used to queue and process long-running article ingestion tasks asynchronously to prevent web request timeouts.
    *   **Google Cloud Scheduler**: Triggers daily RSS syndication cron jobs to automatically ingest new blog posts.
    *   **Article Extraction**: Primary direct fetch with Jina Reader API fallback, paired with `@mozilla/readability` and `jsdom` to extract clean text, followed by a Gemini LLM to remove boilerplate and ads. Markdown content is cleanly transformed into continuous spoken prose (stripping raw markdown syntax, unparsed link markup, and headings) and parsed into semantic paragraph blocks.
    *   **Text-to-Speech (TTS) & Chunking**: Gemini 3.1 Flash TTS API (`gemini-3.1-flash-tts-preview`) for expressive, human-like podcast audio. Text is chunked into cohesive ~1,800 to 2,200-character segments along paragraph, sentence, and clause boundaries (never mid-word or mid-sentence), minimizing stitch points and maintaining consistent voice inflection and volume across paragraph transitions.
    *   **Audio Mastering**: FFmpeg is used to encode podcast-grade MP3 (128 kbps CBR, 44.1 kHz mono via libmp3lame) and apply loudness normalization (-16 LUFS) with True Peak limiting (-1.0 dBTP) for professional podcast audio.
    *   **Podcast Feed**: `podcast` npm package (supports RSS 2.0 with iTunes extensions for audio enclosures).

## User Interface

*   **Button Colors**:
    *   **Red**: Destructive actions (e.g., delete, remove).
    *   **Blue**: Inserts or updates (e.g., save, edit).
    *   **Green**: Non-destructive actions.
    *   **Gray**: For cancelling operations.
