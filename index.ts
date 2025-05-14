import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const app = express()
const upload = multer({ dest: 'uploads/' })

app.use(cors())

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = (req.files as any)?.['video']?.[0]
  const audioFile = (req.files as any)?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).json({ error: 'Thiếu file video hoặc audio' })
  }

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join(__dirname, 'outputs', outputFileName)

  console.log('📥 Nhận file video:', videoFile.originalname)
  console.log('📥 Nhận file audio:', audioFile.originalname)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions([
      '-map 0:v:0',
      '-map 1:a:0',
      '-c:v copy',
      '-c:a aac',
      '-movflags +faststart',
      '-shortest',
    ])
    .on('start', cmd => console.log('⚙️ FFmpeg:', cmd))
    .on('error', (err) => {
      console.error('❌ Lỗi FFmpeg:', err.message)
      res.status(500).json({ error: 'Lỗi xử lý FFmpeg' })
    })
    .on('end', () => {
      console.log('✅ Xử lý xong. Gửi file:', outputPath)
      res.sendFile(outputPath, {}, (err) => {
        // Cleanup
        fs.unlinkSync(videoFile.path)
        fs.unlinkSync(audioFile.path)
        fs.unlinkSync(outputPath)
        if (err) console.error('❌ Lỗi gửi file:', err)
      })
    })
    .save(outputPath)
})

// Tạo thư mục nếu chưa có
const outputsDir = path.join(__dirname, 'outputs')
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir)

app.listen(10000, () => {
  console.log('🚀 Server is running at http://localhost:10000')
})
