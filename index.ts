app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), async (req, res) => {
  const videoFile = req.files?.['video']?.[0];
  const audioFile = req.files?.['audio']?.[0];

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio');
  }

  const outputFileName = `output-${Date.now()}.mp4`;
  const outputPath = path.join(outputsDir, outputFileName);

  console.log('🚀 Bắt đầu xử lý:');
  console.log('📹 Video:', videoFile.path);
  console.log('🎵 Audio:', audioFile.path);
  console.log('📤 Output:', outputPath);

  try {
    ffmpeg()
      .input(videoFile.path)
      .input(audioFile.path)
      .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
      .on('start', (commandLine) => {
        console.log('▶️ FFmpeg command:', commandLine);
      })
      .on('end', () => {
        fs.unlinkSync(videoFile.path);
        fs.unlinkSync(audioFile.path);
        console.log('✅ Xử lý xong:', outputFileName);
        if (!res.headersSent) {
          res.send(`✅ Đã xử lý xong: ${outputFileName}`);
        }
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg lỗi:', err.message);
        if (!res.headersSent) {
          res.status(500).send(`❌ Lỗi FFmpeg: ${err.message}`);
        }
      })
      .save(outputPath);
  } catch (err: any) {
    console.error('❌ Lỗi không xác định:', err.message);
    if (!res.headersSent) {
      res.status(500).send(`❌ Lỗi không xác định: ${err.message}`);
    }
  }
});
