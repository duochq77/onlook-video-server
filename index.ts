import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import util from 'util'

const app = express()
const port = process.env.PORT || 10000

app.use(cors())
app.use(express.json())

// ✅ Đảm bảo đường dẫn đúng trên Render
app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')))

const upload = multer({ dest: 'uploads/' })
const ffprobe = util.promisify(ffmpeg.ffprobe)

// ✅ Hàm lấy thời lượng
const getDuration = async (filePath: string): Promise<number> => {
  const metadata = await ffprobe(filePath)
  return metadata.format.duration || 0
}

// ✅ Xoá file cũ hơn 3 phút
const cleanupOldFiles = (userDir: string) => {
  const now = Date.now()
  const files = fs.readdirSync(userDir)
  for (const file of files) {
    const filePath = path.join(userDir, file)
    const stats = fs.statSync(filePath)
    const ageMinutes = (now - stats.mtimeMs) / (1000 * 60)
    if (ageMinutes >= 3) {
      fs.unlinkSync(filePath)
    }
  }
}

app.post('/process', upload.fields([{ name: 'video' }, { name: 'audio' }]), async (req, res) => {
  const videoFile = req.files?.['video']?.[0]
  const audioFile = req.files?.['audio']?.[0]
  const userId = req.body.userId || 'default'

  if (!videoFile || !audioFile) {
    return res.status(400).send('❌ Thiếu file video hoặc audio')
  }

  const outputsRoot = path.join(process.cwd(), 'outputs')
  const outputsDir = path.join(outputsRoot, userId)
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true })
  }

  cleanupOldFiles(outputsDir)

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join(outputsDir, outputFileName)

  try {
    const videoDuration = await getDuration(videoFile.path)
    const audioDuration = await getDuration(audioFile.path)

    const finalDuration = Math.max(videoDuration, audioDuration)
    const loopedVideo = path.join(outputsDir, `looped-video-${Date.now()}.mp4`)
    const loopedAudio = path.join(outputsDir, `looped-audio-${Date.now()}.mp3`)

    if (videoDuration < audioDuration) {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoFile.path)
          .inputOptions(['-stream_loop', `${Math.ceil(audioDuration / videoDuration) - 1}`])
          .outputOptions('-t', `${finalDuration}`)
          .output(loopedVideo)
          .on('end', resolve)
          .on('error', reject)
          .run()
      })
      fs.renameSync(audioFile.path, loopedAudio)
    } else {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(audioFile.path)
          .inputOptions(['-stream_loop', `${Math.ceil(videoDuration / audioDuration) - 1}`])
          .outputOptions('-t', `${finalDuration}`)
          .output(loopedAudio)
          .on('end', resolve)
          .on('error', reject)
          .run()
      })
      fs.renameSync(videoFile.path, loopedVideo)
    }

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(loopedVideo)
        .input(loopedAudio)
        .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject)
    })

    fs.unlinkSync(loopedVideo)
    fs.unlinkSync(loopedAudio)

    const publicUrl = `/outputs/${userId}/${outputFileName}`
    res.send(`✅ Đã xử lý xong: ${publicUrl}`)
  } catch (err: any) {
    console.error('❌ Lỗi xử lý video/audio:', err.message)
    res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
  }
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
