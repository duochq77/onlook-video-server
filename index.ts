import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import ffmpeg from 'fluent-ffmpeg'

const app = express()
const port = process.env.PORT || 10000

// Thư mục lưu tạm file upload
const upload = multer({ dest: 'uploads/' })

// ✅ Public thư mục outputs
app.use('/outputs', express.static(path.join(__dirname, 'outputs')))
app.use(cors())

// Tạo route xử lý video/audio
app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio')
  }

  const outputDir = path.join(__dirname, 'outputs')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  const outputPath = path.join(outputDir, `output-${Date.now()}.mp4`)

  ffmpeg()
    .input(videoFile.path)
    .input(audioFile.path)
    .outputOptions('-c:v copy') // Giữ nguyên chất lượng video
    .outputOptions('-map 0:v:0') // Lấy video từ input đầu tiên
    .outputOptions('-map 1:a:0') // Lấy audio từ input thứ hai
    .save(outputPath)
    .on('end', () => {
      // Xoá file tạm
      fs.unlinkSync(videoFile.path)
      fs.unlinkSync(audioFile.path)

      const filename = path.basename(outputPath)
      res.send(`✅ Đã xử lý xong: ${filename}`)
    })
    .on('error', (err) => {
      console.error('❌ FFmpeg error:', err)
      res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
    })
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
