import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const customFfmpegPath = path.join(process.cwd(), 'bin', 'ffmpeg');
ffmpeg.setFfmpegPath(customFfmpegPath);

import { spawn } from 'child_process';
import { Writable } from 'stream';

export async function applyLoudnessNormalization(input: Buffer | string | (Buffer | string)[], outputFormat: 'wav' | 'mp3', outputStream: Writable): Promise<void> {
  const tmpDir = os.tmpdir();
  const inputs = Array.isArray(input) ? input : [input];
  const inputPaths: string[] = [];
  const createdFiles: string[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const item = inputs[i];
    if (typeof item === 'string') {
      inputPaths.push(item);
    } else {
      const p = path.join(tmpDir, `input-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.wav`);
      fs.writeFileSync(p, item);
      inputPaths.push(p);
      createdFiles.push(p);
    }
  }

  const args = ['-y'];
  inputPaths.forEach(p => {
    args.push('-i', p);
  });

  if (inputPaths.length > 1) {
    const filters: string[] = [];
    const concatLabels: string[] = [];
    
    inputPaths.forEach((_, idx) => {
      // Force all inputs to 44.1kHz stereo to prevent concat mismatch errors
      filters.push(`[${idx}:a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=stereo[a${idx}]`);
      concatLabels.push(`[a${idx}]`);
    });
    
    filters.push(`${concatLabels.join('')}concat=n=${inputPaths.length}:v=0:a=1[outa]`);
    filters.push(`[outa]loudnorm=I=-19:LRA=4:TP=-1.0[final]`);
    
    args.push('-filter_complex', filters.join(';'), '-map', '[final]');
  } else {
    args.push('-af', 'loudnorm=I=-19:LRA=4:TP=-1.0');
  }

  args.push('-f', outputFormat, 'pipe:1');

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(customFfmpegPath, args);

    ffmpegProcess.stdout.pipe(outputStream);

    let stderrOutput = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      createdFiles.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });

      if (code === 0) {
        resolve();
      } else {
        console.error('FFmpeg Native Error code:', code);
        console.error('FFmpeg Native Stderr:', stderrOutput);
        reject(new Error(`FFmpeg error: process exited with code ${code}. Stderr: ${stderrOutput}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      createdFiles.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      reject(err);
    });
  });
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
