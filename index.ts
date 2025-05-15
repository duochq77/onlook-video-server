import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const upload = multer({ dest: 'uploads/' })

// 🎬 API xử lý video + audio
app.post('/process', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const userId = req.body.userId
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!userId || !videoFile || !audioFile) {
    return res.status(400).send('❌ Cần đúng 2 file: 1 video, 1 audio và userId')
  }

  const outputDir = path.join(process.cwd(), 'outputs', userId)
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'final-output.mp4')

  console.log(`🔧 Bắt đầu xử lý cho user ${userId}`)
  console.log(`📥 Video: ${videoFile.originalname}, Audio: ${audioFile.originalname}`)

  ffmpeg()
    .addInput(videoFile.path)
    .inputOptions(['-stream_loop', '-1']) // loop video
    .addInput(audioFile.path)
    .inputOptions(['-stream_loop', '-1']) // loop audio
    .outputOptions(['-shortest'])
    .on('start', (cmd) => {
      console.log('▶ FFmpeg command:', cmd)
    })
    .on('progress', (progress) => {
      console.log(`📈 Tiến độ: ${progress.percent?.toFixed(2) || '0'}%`)
    })
    .on('end', () => {
      console.log(`✅ Đã xuất: ${outputPath}`)
      fs.unlinkSync(videoFile.path)
      fs.unlinkSync(audioFile.path)
      res.json({ output: `/outputs/${userId}/final-output.mp4` })
    })
    .on('error', (err) => {
      console.error('❌ FFmpeg lỗi:', err.message)
      res.status(500).send('Lỗi xử lý video')
    })
    .save(outputPath)
})

// 🧹 API cleanup sau 3 phút
app.post('/cleanup/:userId', (req, res) => {
  const userId = req.params.userId
  const userDir = path.join(process.cwd(), 'outputs', userId)

  if (!fs.existsSync(userDir)) {
    return res.status(404).send('❌ Không tìm thấy thư mục người dùng')
  }

  setTimeout(() => {
    const files = fs.readdirSync(userDir)
    for (const file of files) {
      fs.unlinkSync(path.join(userDir, file))
    }
    console.log(`🧹 Đã xoá toàn bộ file trong /outputs/${userId} sau 3 phút`)
  }, 3 * 60 * 1000)

  res.send(`🕒 Hẹn xoá thư mục /outputs/${userId} sau 3 phút`)
})

app.listen(PORT, () => {
  console.log(`🚀 Server video/audio xử lý tại http://localhost:${PORT}`)
})
