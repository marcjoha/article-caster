import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';
import { synthesizeSpeech } from './tts';

const execFileAsync = util.promisify(execFile);

/**
 * Formats a duration in seconds into ASS timestamp format (H:MM:SS.cs)
 */
function formatAssTime(seconds: number): string {
  const pad = (num: number, size: number) => num.toString().padStart(size, '0');
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${hrs}:${pad(mins, 2)}:${pad(secs, 2)}.${pad(cs, 2)}`;
}

/**
 * Generates an ASS subtitle file content with custom styling.
 * If hasCover is true, the text is positioned beautifully in the lower-middle half (below the cover image).
 */
function generateAssContent(text: string, durationSeconds: number, width: number, height: number, hasCover: boolean): string {
  const endTime = formatAssTime(durationSeconds);
  const fontsize = Math.round(height * 0.045);
  
  const alignment = hasCover ? 2 : 5;
  
  let marginV = 10;
  if (hasCover) {
    const imageHeight = Math.round(height * 0.50);
    const gap = Math.round(height * 0.04);
    const textHeightEstimate = Math.round(height * 0.08);
    const totalGroupHeight = imageHeight + gap + textHeightEstimate;
    marginV = Math.round((height - totalGroupHeight) / 2);
  }
  
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontsize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,${alignment},30,30,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${endTime},Default,,0,0,0,,{\\an${alignment}}${text}
`;
}

interface VideoSpecs {
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  channels: number;
  tbn: number;
  codec: string;
}

/**
 * Probes the target downloaded video's metadata by reading output of 'ffmpeg -i'.
 * Regex patterns are used to parse resolution, FPS, audio sample rate, and audio channel configuration.
 */
async function probeVideo(filePath: string, ffmpegPath: string): Promise<VideoSpecs> {
  try {
    const { stderr } = await execFileAsync(ffmpegPath, ['-i', filePath]).catch((err: unknown) => {
      const execError = err as { stderr?: string };
      return { stderr: execError.stderr || '' };
    });
    
    const output = stderr;
    
    const resMatch = output.match(/, (\d{2,4})x(\d{2,4})[ ,]/);
    const fpsMatch = output.match(/([\d.]+)\s+fps/);
    const hzMatch = output.match(/(\d{5})\s+Hz/);
    const channelsMatch = output.match(/Hz,\s+([^,\s]+)/);
    
    const codecMatch = output.match(/Video:\s+([a-zA-Z0-9]+)/i);
    const codec = codecMatch ? codecMatch[1].toLowerCase() : 'unknown';
    
    const tbnMatch = output.match(/, (\d+(?:\.\d+)?k?)\s+tbn/);
    let tbn = 90000; // default standard timescale
    if (tbnMatch) {
      const val = tbnMatch[1];
      if (val.endsWith('k')) {
        tbn = parseFloat(val.slice(0, -1)) * 1000;
      } else {
        tbn = parseInt(val, 10);
      }
    }
    
    const specs: VideoSpecs = {
      width: resMatch ? parseInt(resMatch[1], 10) : 1280,
      height: resMatch ? parseInt(resMatch[2], 10) : 720,
      fps: fpsMatch ? parseFloat(fpsMatch[1]) : 25,
      sampleRate: hzMatch ? parseInt(hzMatch[1], 10) : 44100,
      channels: channelsMatch ? (channelsMatch[1].includes('mono') ? 1 : 2) : 2,
      tbn: tbn,
      codec: codec,
    };
    
    console.log(`[videoIntro] Probed specs for ${path.basename(filePath)}:`, specs);
    return specs;
  } catch (err) {
    console.warn(`[videoIntro] Probing failed, using default specs:`, err);
    return {
      width: 1280,
      height: 720,
      fps: 25,
      sampleRate: 44100,
      channels: 2,
      tbn: 90000,
      codec: 'unknown',
    };
  }
}

/**
 * Generates an intro video clip (black background + centered title text + TTS speech audio)
 * matching the target video specifications, and losslessly concatenates them.
 * 
 * Returns the path to the final concatenated MP4 file and its final duration,
 * or falls back to the original file and duration on error.
 */
export async function injectVideoIntro(
  downloadedFilePath: string,
  originalDuration: number,
  title: string,
  prefixMessage: string,
  voicePreference?: string,
  coverImageUrl?: string
): Promise<{ filePath: string; durationSeconds: number }> {
  const tempFiles: string[] = [];
  
  try {
    console.log(`[videoIntro] Starting intro injection for video episode: "${title}"`);
    
    // 1. Synthesize audio prefix message
    console.log(`[videoIntro] Synthesizing speech prefix: "${prefixMessage}"`);
    const { audioBuffer, durationSeconds: ttsDuration } = await synthesizeSpeech({
      textBlocks: [prefixMessage],
      language: 'en-US',
      voicePreference,
    });
    
    if (ttsDuration <= 0 || audioBuffer.length === 0) {
      console.warn(`[videoIntro] Synthesized empty audio. Skipping intro card injection.`);
      return { filePath: downloadedFilePath, durationSeconds: originalDuration };
    }
    
    const tmpDir = os.tmpdir();
    const ttsWavPath = path.join(tmpDir, `video-intro-tts-${Date.now()}.wav`);
    fs.writeFileSync(ttsWavPath, audioBuffer);
    tempFiles.push(ttsWavPath);
    
    // 2. Resolve local or system ffmpeg path
    const binDir = path.join(process.cwd(), 'bin');
    const ffmpegName = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffmpegPath = fs.existsSync(path.join(binDir, ffmpegName))
      ? path.join(binDir, ffmpegName)
      : 'ffmpeg';
    
    // 3. Probe the downloaded video file for technical specs
    const specs = await probeVideo(downloadedFilePath, ffmpegPath);

    // 4. Download cover art image if provided
    let localCoverImgPath: string | null = null;
    if (coverImageUrl) {
      try {
        console.log(`[videoIntro] Downloading podcast cover art: ${coverImageUrl}`);
        const response = await fetch(coverImageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = path.extname(new URL(coverImageUrl).pathname) || '.png';
          localCoverImgPath = path.join(tmpDir, `video-intro-cover-${Date.now()}${ext}`);
          fs.writeFileSync(localCoverImgPath, buffer);
          tempFiles.push(localCoverImgPath);
          console.log(`[videoIntro] Downloaded cover art to: ${localCoverImgPath}`);
        } else {
          console.warn(`[videoIntro] Failed to download cover art (HTTP ${response.status}). Proceeding without cover art.`);
        }
      } catch (err) {
        console.warn(`[videoIntro] Error downloading cover art, proceeding without it:`, err);
      }
    }
    
    // 5. Generate ASS subtitle content (libass/subtitles automatically handles nice text sizing and line wrapping)
    const hasCover = localCoverImgPath !== null;
    const assContent = generateAssContent(title, ttsDuration, specs.width, specs.height, hasCover);
    const assFilePath = path.join(tmpDir, `video-intro-sub-${Date.now()}.ass`);
    fs.writeFileSync(assFilePath, assContent, 'utf-8');
    tempFiles.push(assFilePath);
    
    // 6. Generate matched intro.mp4 clip
    const introMp4Path = path.join(tmpDir, `video-intro-clip-${Date.now()}.mp4`);
    tempFiles.push(introMp4Path);
    
    console.log(`[videoIntro] Generating matched intro.mp4 using subtitles filter...`);
    
    // Standardize path slashes for FFmpeg compatibility
    const safeAssFilePath = assFilePath.replace(/\\/g, '/');
    
    // On Windows, the drive colon in 'C:/var/...' can confuse the subtitles filter.
    // We escape colons as '\:' for safe FFmpeg parsing if a colon is found.
    const escapedAssFilterPath = safeAssFilePath.replace(/:/g, '\\:');
    
    const introArgs: string[] = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=black:s=${specs.width}x${specs.height}:r=${specs.fps}:d=${ttsDuration}`,
      '-i', ttsWavPath
    ];

    if (localCoverImgPath) {
      // Scale cover art proportionally to 50% of the video height
      const imageSize = Math.round(specs.height * 0.50);
      
      const gap = Math.round(specs.height * 0.04);
      const textHeightEstimate = Math.round(specs.height * 0.08);
      const totalGroupHeight = imageSize + gap + textHeightEstimate;
      const imageTop = Math.round((specs.height - totalGroupHeight) / 2);
      
      const filterComplex = `[2:v]scale=${imageSize}:${imageSize}[logo];[0:v][logo]overlay=(W-w)/2:${imageTop}[bg_with_logo];[bg_with_logo]subtitles='${escapedAssFilterPath}'[outv]`;
      
      introArgs.push(
        '-i', localCoverImgPath,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', '1:a'
      );
    } else {
      introArgs.push(
        '-vf', `subtitles='${escapedAssFilterPath}'`,
        '-map', '0:v',
        '-map', '1:a'
      );
    }

    introArgs.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', specs.fps.toString(),                   // Force constant frame rate matching
      '-video_track_timescale', specs.tbn.toString(), // Force exact timescale matching
      '-c:a', 'aac',
      '-ar', specs.sampleRate.toString(),
      '-ac', specs.channels.toString(),
      '-shortest',
      introMp4Path
    );
    
    await execFileAsync(ffmpegPath, introArgs);
    console.log(`[videoIntro] Successfully generated intro.mp4 at ${introMp4Path}`);
    
    // 6. Lossless stream-copy concatenation
    const finalMp4Path = path.join(tmpDir, `video-final-${Date.now()}.mp4`);
    
    if (specs.codec !== 'h264') {
      console.warn(`[videoIntro] Target video codec is "${specs.codec}", but only "h264" is supported for TS stream-copy concatenation. Falling back to direct MP4 concat demuxer...`);
      
      const concatListPath = path.join(tmpDir, `video-intro-concat-${Date.now()}.txt`);
      tempFiles.push(concatListPath);
      
      const escapedIntroPath = introMp4Path.replace(/'/g, "'\\''");
      const escapedMainPath = downloadedFilePath.replace(/'/g, "'\\''");
      
      const concatContent = `file '${escapedIntroPath}'\nfile '${escapedMainPath}'\n`;
      fs.writeFileSync(concatListPath, concatContent, 'utf-8');
      
      await execFileAsync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        '-video_track_timescale', specs.tbn.toString(),
        finalMp4Path
      ]);
    } else {
      console.log(`[videoIntro] Target video codec is h264. Using robust MPEG-TS concatenation...`);
      
      const introTsPath = path.join(tmpDir, `video-intro-clip-${Date.now()}.ts`);
      const mainTsPath = path.join(tmpDir, `video-main-${Date.now()}.ts`);
      tempFiles.push(introTsPath, mainTsPath);
      
      console.log(`[videoIntro] Converting intro.mp4 to intermediate TS...`);
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i', introMp4Path,
        '-c', 'copy',
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts',
        introTsPath
      ]);
      
      console.log(`[videoIntro] Converting main video.mp4 to intermediate TS...`);
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i', downloadedFilePath,
        '-c', 'copy',
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts',
        mainTsPath
      ]);
      
      console.log(`[videoIntro] Concatenating TS streams into final MP4...`);
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i', `concat:${introTsPath}|${mainTsPath}`,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        finalMp4Path
      ]);
    }
    console.log(`[videoIntro] Concatenation successful. Final video: ${finalMp4Path}`);
    
    // Return final concatenated path and updated duration
    return { filePath: finalMp4Path, durationSeconds: originalDuration + ttsDuration };
  } catch (err) {
    console.error(`[videoIntro] Error during video intro injection:`, err);
    console.warn(`[videoIntro] Falling back to the raw YouTube video without intro card.`);
    return { filePath: downloadedFilePath, durationSeconds: originalDuration };
  } finally {
    // 7. Safely clean up all temporary files
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {
        console.error(`[videoIntro] Cleanup failed for file: ${file}`, e);
      }
    }
  }
}
