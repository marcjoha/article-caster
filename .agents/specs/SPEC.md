# Specification

## Application Overview

The name of this application is **article-caster** (verbatim, all lowercase, never use "Article Caster" or similar). It helps busy people catch-up on interesting articles on the go, by allowing these to be "saved for later" and added into a personal podcast feed.

Articles are cleaned up from ads and converted into spoken word. The resulting audio files are stored in a content repository and added to a custom podcast feed as audio items.

## Business Logic & User Flows

1. **Authentication**: The application has an admin web interface restricted to a single admin user via a Simple Passcode mechanism. The passcode is securely stored as `ADMIN_PASSCODE` in the environment variables and validated using Next.js middleware with an `admin_session` cookie.
2. **Feed Management**: 
   - The admin can create new podcast feeds and provide relevant metadata (e.g., title, description, cover image).
   - The admin can view, edit, and delete existing feeds.
   - The feed URL generated is public to allow podcast clients to subscribe, but uses an "unguessable" random string (e.g., UUID) to protect privacy.
3. **Content Ingestion**:
   - **Articles**: The admin can submit an article URL. The system offloads the processing to a Google Cloud Tasks background worker, which extracts the main text content, removes ads and clutter, and uses a Text-to-Speech (TTS) service to generate an audio file.
4. **Content Management**:
   - Ingested items are added to a specific feed.
   - The admin can remove previously added items.
   - The admin can play/listen to the generated audio content directly through the admin site.

## Data Model

*   **Feeds**: `id`, `title`, `description`, `unguessable_slug`, `created_at`
*   **Items**: `id`, `feed_id`, `title`, `description`, `source_url`, `media_url` (Cloud Storage path), `type` (audio), `size_bytes`, `duration_seconds`, `created_at`

## Technology Stack

*   **Backend & Frontend**: Next.js 16 (App Router) used as a unified full-stack Node.js framework to serve both the React frontend and backend API routes. Intended for deployment on Google Cloud Run.
*   **Storage**: 
    *   **Google Cloud Storage (GCS)**: Stores the generated audio and downloaded video files. The bucket must be configured with Uniform Bucket-Level Access to be publicly readable, allowing podcast clients direct access to media.
    *   **Google Cloud Firestore**: Stores metadata about feeds and feed items.
*   **Core Integrations**:
    *   **Google Cloud Tasks**: Used to queue and process long-running article ingestion tasks asynchronously to prevent web request timeouts.
    *   **Article Extraction**: `@mozilla/readability` paired with `jsdom` to extract clean text.
    *   **Text-to-Speech (TTS)**: `@google-cloud/text-to-speech` API (specifically using the LLM-based "Journey" voices for highly expressive, human-like podcast audio).
    *   **Podcast Feed**: `podcast` npm package (supports RSS 2.0 with iTunes extensions for audio enclosures).

