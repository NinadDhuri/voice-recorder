const fs = require('fs');
const { exec } = require('child_process');
const WebSocket = require('ws');
const path = require('path');


const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}


const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log('WebSocket server running on ws://localhost:8080');
});

wss.on('connection', (ws) => {
  console.log('Client connected');

 
  const rawFileName = `recording_${Date.now()}.webm`;
  const rawFilePath = path.join(recordingsDir, rawFileName);

  const fileStream = fs.createWriteStream(rawFilePath);
  console.log('Writing raw data to:', rawFilePath);

  
  ws.on('message', (data) => {
    fileStream.write(data);
  });

 
  ws.on('close', () => {
    fileStream.end();
    console.log('Recording closed:', rawFilePath);

    
    const wavFileName = `recording_${Date.now()}.wav`;
    const wavFilePath = path.join(recordingsDir, wavFileName);

   
    const ffmpegCmd = `ffmpeg -y -i "${rawFilePath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${wavFilePath}"`;
    console.log('Converting to WAV:', ffmpegCmd);

    exec(ffmpegCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('FFmpeg conversion error:', err);
      } else {
        console.log('WAV file saved to:', wavFilePath);
      }
    });
  });
});
