import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import os from 'os';

const execFileAsync = util.promisify(execFile);
const customYtDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');

export interface YoutubeExtractionResult {
  title: string;
  description: string;
  filePath: string;
  durationSeconds: number;
}

export async function extractYoutubeAudio(url: string): Promise<YoutubeExtractionResult> {
  // 1. Fetch metadata
  const { stdout: metadataJson } = await execFileAsync(customYtDlpPath, [
    '--dump-json',
    '--no-playlist',
    '--js-runtimes', 'nodejs',
    '--extractor-args', 'youtube:player_client=ios',
    url
  ], { maxBuffer: 10 * 1024 * 1024 });

  const metadata = JSON.parse(metadataJson);
  const title = metadata.title || 'Unknown YouTube Video';
  const description = metadata.description || '';
  const durationSeconds = metadata.duration || 0;

  // 2. Download audio
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `yt-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`);

  await execFileAsync(customYtDlpPath, [
    '-f', 'bestaudio', // Download best audio format
    '-o', outputPath,
    '--no-playlist',
    '--js-runtimes', 'nodejs',
    '--extractor-args', 'youtube:player_client=ios',
    url
  ], { maxBuffer: 10 * 1024 * 1024 });

  return {
    title,
    description,
    filePath: outputPath,
    durationSeconds
  };
}
