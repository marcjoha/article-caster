/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const arg = process.argv[2];

if (!arg || (arg !== 'mac' && arg !== 'linux')) {
  console.error('Usage: node download-ffmpeg.js <mac|linux>');
  process.exit(1);
}

const destDir = path.join(process.cwd(), 'bin');
const destFile = path.join(destDir, 'ffmpeg');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function resolveDownloadUrl() {
  const baseUrl = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1';
  if (arg === 'linux') {
    return `${baseUrl}/ffmpeg-linux-x64.gz`;
  }
  return process.arch === 'arm64'
    ? `${baseUrl}/ffmpeg-darwin-arm64.gz`
    : `${baseUrl}/ffmpeg-darwin-x64.gz`;
}

function downloadGz(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'article-caster-ffmpeg-downloader' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadGz(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download FFmpeg: HTTP ${res.statusCode} ${res.statusMessage}`));
      }

      const gunzip = zlib.createGunzip();
      const out = fs.createWriteStream(dest);

      res.pipe(gunzip).pipe(out);

      out.on('finish', () => {
        fs.chmodSync(dest, 0o755);
        resolve();
      });

      out.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });

      gunzip.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

async function main() {
  const url = resolveDownloadUrl();
  console.log(`Downloading static FFmpeg for ${arg} from ${url}...`);
  try {
    await downloadGz(url, destFile);
    console.log(`Successfully downloaded and verified FFmpeg for ${arg} to ${destFile}`);
  } catch (err) {
    console.error(`Error downloading FFmpeg for ${arg}:`, err);
    process.exit(1);
  }
}

main();


