import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

const app = express()
const port = process.env.PORT || 10000

app.use(cors())

// 👉 Public thư mục outputs cho phép xem từ trình duyệt
app.use('/outputs', express.static(path.join(__dirname, 'outputs')))

// Tạo thư mục uploads và outputs nếu chưa tồn tại
const uploadsDir = path.join(__dirname, 'uploads')
const outputsDir = path.join(__dirname, 'outputs')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir)

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ storage })

// 📥 API xử lý video/audio POST /process
app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio')
  }

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join(outputsDir, outputFileName)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions('-map 0:v:0', '-map 1:a:0', '-c:v copy', '-shortest')
    .on('end', () => {
      console.log(`✅ Đã xử lý xong: ${outputFileName}`)
      res.send(`✅ Đã xử lý xong: ${outputFileName}`)
    })
    .on('error', (err) => {
      console.error('❌ Lỗi xử lý video/audio:', err.message)
      res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
    })
    .save(outputPath)
})

// 🚀 Khởi động server
app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy!`)
  console.log(`🌐 http://localhost:${port}`)
})
