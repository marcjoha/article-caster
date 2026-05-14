/* eslint-disable @typescript-eslint/no-require-imports */
const ffbinaries = require('ffbinaries');
const path = require('path');
const fs = require('fs');

const arg = process.argv[2];

if (!arg || (arg !== 'mac' && arg !== 'linux')) {
  console.error('Usage: node download-ffmpeg.js <mac|linux>');
  process.exit(1);
}

// Map simple arguments to valid ffbinaries platform keys
const platform = arg === 'linux' ? 'linux-64' : (process.arch === 'arm64' ? 'mac-arm-64' : 'mac-64');

const dest = path.join(process.cwd(), 'bin');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

console.log(`Downloading FFmpeg for ${platform}...`);

ffbinaries.downloadBinaries(['ffmpeg'], { platform, destination: dest, force: true }, function () {
  console.log(`Successfully downloaded FFmpeg for ${platform} to ${dest}`);
});
