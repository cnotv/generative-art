const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the incoming data
    const { videoData, filename = 'animation' } = JSON.parse(event.body);
    
    if (!videoData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No video data provided' }),
      };
    }

    // Create temporary directory for processing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-convert-'));
    const inputPath = path.join(tempDir, 'input.webm');
    const outputPath = path.join(tempDir, 'output.mp4');

    // Decode base64 video data and write to temp file
    const videoBuffer = Buffer.from(videoData.split(',')[1], 'base64');
    fs.writeFileSync(inputPath, videoBuffer);

    // Convert WebM to MP4 using FFmpeg
    const ffmpegPromise = new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputPath
      ]);

      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });

    // Set timeout for conversion (30 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Conversion timeout')), 30000);
    });

    await Promise.race([ffmpegPromise, timeoutPromise]);

    // Read the converted file
    const convertedBuffer = fs.readFileSync(outputPath);
    const base64Video = convertedBuffer.toString('base64');

    // Clean up temp files
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        videoData: `data:video/mp4;base64,${base64Video}`,
        filename: `${filename}.mp4`
      }),
    };

  } catch (error) {
    console.error('Conversion error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Video conversion failed',
        message: error.message
      }),
    };
  }
};
