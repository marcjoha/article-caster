import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const customFfmpegPath = path.join(process.cwd(), 'bin', 'ffmpeg');
ffmpeg.setFfmpegPath(customFfmpegPath);

export function applyLoudnessNormalization(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`);

    fs.writeFileSync(inputPath, inputBuffer);

    ffmpeg(inputPath)
      .audioFilters('loudnorm=I=-19:LRA=4:TP=-1.0')
      .toFormat('wav')
      .on('end', () => {
        try {
          const outputBuffer = fs.readFileSync(outputPath);
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
          resolve(outputBuffer);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg Error:', err.message);
        console.error('FFmpeg Stderr:', stderr);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(new Error(`FFmpeg error: ${err.message}. Stderr: ${stderr}`));
      })
      .save(outputPath);
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
