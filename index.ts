import express from 'express'
import multer from 'multer'
import cors from 'cors'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const app = express()
const port = process.env.PORT || 10000

app.use(cors())

// Tạo thư mục nếu chưa có
const uploadsDir = path.join(__dirname, 'uploads')
const outputsDir = path.join(__dirname, 'outputs')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir)

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

const upload = multer({ storage: storage })

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('Thiếu file video hoặc audio')
  }

  const outputFilename = `output-${Date.now()}.mp4`
  const outputPath = path.join(outputsDir, outputFilename)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions('-c:v copy') // giữ nguyên video gốc
    .outputOptions('-c:a aac')  // chuyển âm thanh sang định dạng phổ biến
    .outputOptions('-shortest') // dừng khi một trong hai track kết thúc
    .on('start', () => console.log('🎬 Bắt đầu xử lý video + audio...'))
    .on('end', () => {
      console.log('✅ Đã xử lý xong:', outputPath)
      res.send(`✅ Đã xử lý xong: ${outputFilename}`)
    })
    .on('error', (err) => {
      console.error('❌ Lỗi xử lý video/audio:', err.message)
      res.status(500).send('❌ Lỗi xử lý video/audio: ' + err.message)
    })
    .save(outputPath)
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
