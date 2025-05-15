import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const app = express()
const port = process.env.PORT || 10000

app.use(cors())
app.use(express.json())

// Đảm bảo thư mục outputs tồn tại
const outputsDir = path.join(process.cwd(), 'outputs')
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir)
}
app.use('/outputs', express.static(outputsDir))

const upload = multer({ dest: 'uploads/' })

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio')
  }

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join(outputsDir, outputFileName)

  console.log('🚀 Bắt đầu xử lý:')
  console.log('📹 Video:', videoFile.path)
  console.log('🎵 Audio:', audioFile.path)
  console.log('📤 Output:', outputPath)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
    .on('start', (commandLine) => {
      console.log('▶️ FFmpeg command:', commandLine)
    })
    .on('end', () => {
      fs.unlinkSync(videoFile.path)
      fs.unlinkSync(audioFile.path)
      console.log('✅ Xử lý xong:', outputFileName)
      res.send(`✅ Đã xử lý xong: ${outputFileName}`)
    })
    .on('error', (err) => {
      console.error('❌ Lỗi xử lý video/audio:', err.message)
      res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
    })
    .save(outputPath)
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
