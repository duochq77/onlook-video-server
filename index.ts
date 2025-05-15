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

// 📂 Tạo thư mục outputs nếu chưa có
const outputsDir = path.join(process.cwd(), 'outputs')
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir)
}

// Cho phép truy cập file output qua /outputs
app.use('/outputs', express.static(outputsDir))

// ⚙️ Cấu hình Multer để upload file tạm vào thư mục uploads/
const upload = multer({ dest: 'uploads/' })

// 📌 API xử lý video + audio
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

  try {
    ffmpeg()
      .input(videoFile.path)
      .input(audioFile.path)
      .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
      .on('start', (cmd) => {
        console.log('▶️ FFmpeg command:', cmd)
      })
      .on('end', () => {
        fs.unlinkSync(videoFile.path)
        fs.unlinkSync(audioFile.path)
        console.log('✅ Xử lý xong:', outputFileName)
        if (!res.headersSent) {
          res.send(`✅ Đã xử lý xong: ${outputFileName}`)
        }
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg lỗi:', err.message)
        if (!res.headersSent) {
          res.status(500).send(`❌ FFmpeg lỗi: ${err.message}`)
        }
      })
      .save(outputPath)
  } catch (err: any) {
    console.error('❌ Lỗi không xác định:', err.message)
    if (!res.headersSent) {
      res.status(500).send(`❌ Lỗi không xác định: ${err.message}`)
    }
  }
})

// 🎬 Khởi động server
app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
