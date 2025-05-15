import express, { Request } from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

const upload = multer({ dest: 'uploads/' })

interface MulterRequest extends Request {
  files: {
    [fieldname: string]: Express.Multer.File[]
  }
}

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), async (req, res) => {
  const request = req as MulterRequest

  const videoFile = request.files?.['video']?.[0]
  const audioFile = request.files?.['audio']?.[0]

  if (!videoFile || !audioFile) {
    return res.status(400).json({ error: 'Thiếu video hoặc audio file' })
  }

  const outputPath = path.join('outputs', `${Date.now()}-output.mp4`)

  ffmpeg()
    .addInput(videoFile.path)
    .addInput(audioFile.path)
    .outputOptions('-c:v copy', '-c:a aac', '-shortest')
    .save(outputPath)
    .on('end', () => {
      fs.unlinkSync(videoFile.path)
      fs.unlinkSync(audioFile.path)
      res.download(outputPath, () => {
        fs.unlinkSync(outputPath)
      })
    })
    .on('error', (err: any) => {
      console.error('Lỗi ffmpeg:', err)
      res.status(500).json({ error: 'Xử lý thất bại' })
    })
})

app.listen(port, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`)
})
