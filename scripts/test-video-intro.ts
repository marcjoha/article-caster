import { injectVideoIntro } from '../src/lib/ingestion/videoIntro';
import path from 'path';
import fs from 'fs';

// Read .env file to configure environment
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      process.env[parts[0].trim()] = parts[1].trim();
    }
  });
} catch {
  console.warn('Could not read .env file, continuing...');
}

async function test() {
  const inputVideo = '/Users/majohansson/.gemini/antigravity/brain/0a4d707e-d464-4f73-9746-f99113c1e9ab/scratch/test-1781267251615.f398.mp4';
  const outputDest = '/Users/majohansson/.gemini/antigravity/brain/0a4d707e-d464-4f73-9746-f99113c1e9ab/scratch/test-video-with-intro.mp4';

  console.log('Input video exists?', fs.existsSync(inputVideo));
  if (!fs.existsSync(inputVideo)) {
    console.error('Error: test input video not found!');
    process.exit(1);
  }

  // Delete existing output if any
  if (fs.existsSync(outputDest)) {
    fs.unlinkSync(outputDest);
  }

  const title = "How to pair program with Antigravity AI";
  const prefix = "Hello, and welcome to this video lesson. Today we'll talk about pair programming.";
  // We use picsum as a stable image generator
  const coverUrl = "https://picsum.photos/500";

  console.log('Testing injectVideoIntro with cover art...');
  const start = Date.now();
  const result = await injectVideoIntro(
    inputVideo,
    100, // mock original duration
    title,
    prefix,
    'en-US-Journey-F',
    coverUrl
  );

  console.log(`Finished in ${Date.now() - start}ms`);
  console.log('Result:', result);

  if (fs.existsSync(result.filePath)) {
    console.log('SUCCESS! Generated file size:', fs.statSync(result.filePath).size);
    // Copy the final file to the expected output path if it's different
    if (result.filePath !== outputDest) {
      fs.copyFileSync(result.filePath, outputDest);
      console.log('Copied output to:', outputDest);
    }
  } else {
    console.error('FAIL: Output file does not exist');
  }
}

test().catch(console.error);
