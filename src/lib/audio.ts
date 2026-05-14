import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const customFfmpegPath = path.join(process.cwd(), 'bin', 'ffmpeg');
ffmpeg.setFfmpegPath(customFfmpegPath);

import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export async function applyLoudnessNormalization(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);

  fs.writeFileSync(inputPath, inputBuffer);

  try {
    const { stdout, stderr } = await execFileAsync(customFfmpegPath, [
      '-y',
      '-i', inputPath,
      '-af', 'loudnorm=I=-19:LRA=4:TP=-1.0',
      '-f', 'wav',
      outputPath
    ], { maxBuffer: 10 * 1024 * 1024 });
    
    const outputBuffer = fs.readFileSync(outputPath);
    return outputBuffer;
  } catch (err: any) {
    console.error('FFmpeg Native Error:', err);
    console.error('FFmpeg Native Stderr:', err.stderr);
    console.error('FFmpeg Native Stdout:', err.stdout);
    throw new Error(`FFmpeg error: ${err.message}. Stderr: ${err.stderr}`);
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}

/**
 * Creates a WAV file header for raw PCM audio data.
 */
export function createWavHeader(
  dataLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16,
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);       // Subchunk1Size
  header.writeUInt16LE(1, 20);        // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return header;
}
