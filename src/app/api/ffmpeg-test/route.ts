import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function GET(): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    const customFfmpegPath = path.join(process.cwd(), 'bin', 'ffmpeg');
    
    // Test 1: ffmpeg -version
    exec(`${customFfmpegPath} -version`, (error, stdout, stderr) => {
      
      // Test 2: Create a dummy wav and run loudnorm
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `test-input.wav`);
      const outputPath = path.join(tmpDir, `test-output.wav`);
      
      // Create a dummy 1-second silent WAV
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + 48000, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(24000, 24);
      header.writeUInt32LE(48000, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36);
      header.writeUInt32LE(48000, 40);
      const data = Buffer.alloc(48000, 0);
      fs.writeFileSync(inputPath, Buffer.concat([header, data]));

      exec(`${customFfmpegPath} -i ${inputPath} -af loudnorm=I=-19:LRA=4:TP=-1.0 -f wav ${outputPath}`, (error2, stdout2, stderr2) => {
        resolve(NextResponse.json({
          version_test: {
            error: error ? error.message : null,
            stdout,
            stderr
          },
          encode_test: {
            error: error2 ? error2.message : null,
            stdout: stdout2,
            stderr: stderr2
          }
        }));
      });
    });
  });
}
