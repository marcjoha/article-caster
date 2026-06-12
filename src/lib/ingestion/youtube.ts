import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';

const execFileAsync = util.promisify(execFile);
const customYtDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');

export interface YoutubeExtractionResult {
  title: string;
  description: string;
  filePath: string;
  durationSeconds: number;
  isVideo?: boolean;
}

export async function extractYoutubeAudio(url: string): Promise<YoutubeExtractionResult> {
  const ytdlpArgs = [
    '--dump-json',
    '--no-playlist',
    '--js-runtimes', 'node'
  ];
  
  if (fs.existsSync(path.join(process.cwd(), 'cookies.txt'))) {
    ytdlpArgs.push('--cookies', path.join(process.cwd(), 'cookies.txt'));
  }
  
  ytdlpArgs.push(url);

  // 1. Fetch metadata
  const { stdout: metadataJson } = await execFileAsync(customYtDlpPath, ytdlpArgs, { maxBuffer: 10 * 1024 * 1024 });

  const metadata = JSON.parse(metadataJson);
  const title = metadata.title || 'Unknown YouTube Video';
  const description = metadata.description || '';
  const durationSeconds = metadata.duration || 0;

  // 2. Download video (max 1080p) and audio merged into MP4
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `yt-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

  const downloadArgs = [
    '-f', 'bestvideo[height<=1080][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4][vcodec^=avc1]/best[ext=mp4][vcodec^=avc1]',
    '-o', outputPath,
    '--no-playlist',
    '--js-runtimes', 'node',
    '--no-progress'
  ];

  const binDir = path.join(process.cwd(), 'bin');
  const hasLocalFfmpeg = fs.existsSync(path.join(binDir, 'ffmpeg')) || fs.existsSync(path.join(binDir, 'ffmpeg.exe'));
  if (hasLocalFfmpeg) {
    downloadArgs.push('--ffmpeg-location', binDir);
  }

  if (fs.existsSync(path.join(process.cwd(), 'cookies.txt'))) {
    downloadArgs.push('--cookies', path.join(process.cwd(), 'cookies.txt'));
  }
  
  downloadArgs.push(url);

  await execFileAsync(customYtDlpPath, downloadArgs, { maxBuffer: 10 * 1024 * 1024 });

  if (!fs.existsSync(outputPath)) {
    throw new Error(`yt-dlp completed successfully, but the expected output video file was not created at: ${outputPath}`);
  }

  return {
    title,
    description,
    filePath: outputPath,
    durationSeconds,
    isVideo: true
  };
}

