import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

const app = express()
const port = process.env.PORT || 3001 // ✅ Phải dùng biến môi trường PORT

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const upload = multer({ dest: 'uploads/' })

app.get('/', (req, res) => {
  res.send('🎬 Video/audio processing server đang chạy!')
})

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('Thiếu file video hoặc audio')
  }

  const outputPath = path.join('outputs', `output-${Date.now()}.mp4`)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions('-c:v copy')
    .outputOptions('-shortest')
    .save(outputPath)
    .on('end', () => {
      res.send(`✅ Đã xử lý xong! File lưu tại ${outputPath}`)
    })
    .on('error', (err) => {
      res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
    })
})

app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`)
})
