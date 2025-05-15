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

// ⚠️ Sử dụng process.cwd() thay vì __dirname
app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')))

const upload = multer({ dest: 'uploads/' })

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio')
  }

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join('outputs', outputFileName)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions('-c:v copy', '-c:a aac', '-shortest')
    .on('end', () => {
      fs.unlinkSync(videoFile.path)
      fs.unlinkSync(audioFile.path)
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
