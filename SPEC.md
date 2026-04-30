# Specification

## Application Overview

The name of this application is **catchup-feeder** (all lowercase). It helps busy people catch-up on interesting articles and YouTube videos on the go, by allowing these to be "saved for later" and added into a personal podcast feed.

Articles are cleaned up from ads and converted into spoken word. The resulting audio files are stored in a content repository and added to a custom podcast feed as audio items. Similarly, videos are pulled from youtube, added to the repository and then to the feed as video items.

## Business Logic & User Flows

1. **Authentication**: The application has an admin web interface restricted to a single admin user.
2. **Feed Management**: 
   - The admin can create new podcast feeds and provide relevant metadata (e.g., title, description, cover image).
   - The admin can view, edit, and delete existing feeds.
   - The feed URL generated is public to allow podcast clients to subscribe, but uses an "unguessable" random string (e.g., UUID) to protect privacy.
3. **Content Ingestion**:
   - **Articles**: The admin can submit an article URL. The system will extract the main text content, remove ads and clutter, and use a Text-to-Speech (TTS) service to generate an audio file.
   - **YouTube Videos**: The admin can submit a YouTube URL. The system will download the audio/video content.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to the generated audio or video content directly through the admin site.

## Data Model

*   **Feeds**: `id`, `title`, `description`, `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (audio/video), `size_bytes`, `duration_seconds`, `created_at`

## Technology Stack

*   **Backend & Frontend**: Node.js intended for deployment on Google Cloud Run.
*   **Storage**: 
    *   **Google Cloud Storage (GCS)**: Stores the generated audio and downloaded video files.
    *   **Google Cloud Firestore**: Stores metadata about feeds and feed items.
*   **Core Integrations**:
    *   **YouTube Ingestion**: `youtube-dl-exec` (Node wrapper for yt-dlp).
    *   **Article Extraction**: `@mozilla/readability` paired with `jsdom` to extract clean text.
    *   **Text-to-Speech (TTS)**: `@google-cloud/text-to-speech` API (specifically using the LLM-based "Journey" voices for highly expressive, human-like podcast audio).
    *   **Podcast Feed**: `podcast` npm package (supports RSS 2.0 with iTunes extensions for both audio and video enclosures).

