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
    return res.status(400).send('Thiếu file video hoặc audio')
  }

  const outputPath = path.join('outputs', `output-${Date.now()}.mp4`)

  console.log('📥 Bắt đầu xử lý video và audio...')
  console.log('📥 File video:', videoFile.path)
  console.log('📥 File audio:', audioFile.path)

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
    .on('start', (cmdLine) => {
      console.log('⚙️ FFmpeg command:', cmdLine)
    })
    .on('end', () => {
      console.log('✅ Đã xử lý xong. Gửi file cho client.')
      res.sendFile(path.resolve(outputPath), {}, (err) => {
        if (err) console.error('❌ Lỗi khi gửi file:', err)
        fs.unlinkSync(videoFile.path)
        fs.unlinkSync(audioFile.path)
        fs.unlinkSync(outputPath)
      })
    })
    .on('error', (err) => {
      console.error('❌ Lỗi FFmpeg:', err.message)
      console.log('📄 Đường dẫn video:', videoFile.path)
      console.log('📄 Đường dẫn audio:', audioFile.path)
      res.status(500).send('Lỗi xử lý video/audio')
    })
    .save(outputPath)
})

app.listen(10000, () => {
  console.log('✅ Server is running on http://localhost:10000')
})
