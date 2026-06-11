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
const dest = path.join(process.cwd(), 'bin');
const destFile = path.join(dest, 'yt-dlp');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'article-caster-downloader'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch JSON: ${res.statusCode} ${res.statusMessage}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

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

async function main() {
  let downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
  console.log('Fetching yt-dlp releases to find version older than 2 months...');
  try {
    const releases = await fetchJSON('https://api.github.com/repos/yt-dlp/yt-dlp/releases');
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 2);
    
    let chosenRelease = null;
    for (const release of releases) {
      const publishDate = new Date(release.published_at);
      if (publishDate <= targetDate) {
        chosenRelease = release;
        break;
      }
    }
    
    if (chosenRelease) {
      console.log(`Found release ${chosenRelease.tag_name} published at ${chosenRelease.published_at} (more than 2 months ago).`);
      downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${chosenRelease.tag_name}/${binaryName}`;
    } else {
      console.log('No release found that is older than 2 months. Falling back to latest release.');
    }
  } catch (err) {
    console.error('Error finding 2-month-old release, falling back to latest release:', err.message);
  }

  console.log(`Downloading from ${downloadUrl}...`);
  try {
    await download(downloadUrl, destFile);
    console.log(`Successfully downloaded yt-dlp to ${destFile}`);
  } catch (err) {
    console.error('Error downloading yt-dlp:', err);
    process.exit(1);
  }
}

main();
