/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];

if (!arg || (arg !== 'mac' && arg !== 'linux')) {
  console.error('Usage: node download-ytdlp.js <mac|linux>');
  process.exit(1);
}

const binaryName = arg === 'linux' ? 'yt-dlp_linux' : 'yt-dlp_macos';
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
const dest = path.join(process.cwd(), 'bin');
const destFile = path.join(dest, 'yt-dlp');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

console.log(`Downloading ${binaryName} from ${url}...`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download: ${res.statusCode} ${res.statusMessage}`));
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          fs.chmodSync(dest, 0o755);
          resolve();
        });
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

download(url, destFile)
  .then(() => {
    console.log(`Successfully downloaded yt-dlp to ${destFile}`);
  })
  .catch((err) => {
    console.error('Error downloading yt-dlp:', err);
    process.exit(1);
  });
