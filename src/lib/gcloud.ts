import { execSync } from 'child_process';

let cachedPublicUrl: string | null = null;

/**
 * Gets the production Cloud Run URL.
 * In production, this directly returns the PUBLIC_URL env variable.
 * In local dev, it dynamically queries gcloud once to fetch the deployed Cloud Run service URL
 * so that local ingestion notifications point to the real deployed website.
 */
export function getProductionUrl(): string {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }

  if (cachedPublicUrl !== null) {
    return cachedPublicUrl;
  }

  if (process.env.NODE_ENV === 'development' || !process.env.K_SERVICE) {
    try {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const region = process.env.GOOGLE_CLOUD_REGION || 'europe-north2';
      const serviceName = 'article-caster';

      if (project) {
        const cmd = `gcloud run services describe "${serviceName}" --region="${region}" --project="${project}" --format="value(status.url)"`;
        const url = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (url && url.startsWith('http')) {
          cachedPublicUrl = url;
          console.log(`[local-dev] Dynamically retrieved Cloud Run production URL: ${url}`);
          return url;
        }
      }
    } catch {
      // Fallback silently if gcloud is not authenticated or not installed
    }
  }

  cachedPublicUrl = '';
  return '';
}
