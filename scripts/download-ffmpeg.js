/* eslint-disable @typescript-eslint/no-require-imports */
const ffbinaries = require('ffbinaries');
const path = require('path');
const fs = require('fs');

const platform = process.argv[2];

if (!platform || (platform !== 'mac' && platform !== 'linux')) {
  console.error('Usage: node download-ffmpeg.js <mac|linux>');
  process.exit(1);
}

const dest = path.join(process.cwd(), 'bin');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

console.log(`Downloading FFmpeg for ${platform}...`);

ffbinaries.downloadBinaries(['ffmpeg'], { platform, destination: dest }, function () {
  console.log(`Successfully downloaded FFmpeg for ${platform} to ${dest}`);
});
