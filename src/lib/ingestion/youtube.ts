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

  // 2. Download audio
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `yt-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`);

  const downloadArgs = [
    '-f', 'bestaudio', // Download best audio format
    '-o', outputPath,
    '--no-playlist',
    '--js-runtimes', 'node'
  ];

  if (fs.existsSync(path.join(process.cwd(), 'cookies.txt'))) {
    downloadArgs.push('--cookies', path.join(process.cwd(), 'cookies.txt'));
  }
  
  downloadArgs.push(url);

  await execFileAsync(customYtDlpPath, downloadArgs, { maxBuffer: 10 * 1024 * 1024 });

  return {
    title,
    description,
    filePath: outputPath,
    durationSeconds
  };
}
