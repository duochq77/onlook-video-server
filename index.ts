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

// ✅ Dùng process.cwd() để đúng đường dẫn trên Render
app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')))

const upload = multer({ dest: 'uploads/' })
const ffprobe = util.promisify(ffmpeg.ffprobe)

// ✅ Hàm lấy thời lượng video/audio
const getDuration = async (filePath: string): Promise<number> => {
  const metadata = await ffprobe(filePath)
  return metadata.format.duration || 0
}

// ✅ Hàm xoá file quá 3 phút trong thư mục người dùng
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

  const outputsDir = path.join(process.cwd(), 'outputs', userId)
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true })
  }

  // ✅ Xoá file cũ hơn 3 phút
  cleanupOldFiles(outputsDir)

  const outputFileName = `output-${Date.now()}.mp4`
  const outputPath = path.join(outputsDir, outputFileName)

  try {
    const videoDuration = await getDuration(videoFile.path)
    const audioDuration = await getDuration(audioFile.path)

    const loopVideo = Math.ceil(audioDuration / videoDuration)
    const loopAudio = Math.ceil(videoDuration / audioDuration)

    const finalDuration = Math.min(loopVideo * videoDuration, loopAudio * audioDuration)

    const loopedVideo = path.join(outputsDir, `looped-video-${Date.now()}.mp4`)
    const loopedAudio = path.join(outputsDir, `looped-audio-${Date.now()}.mp3`)

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoFile.path)
        .inputOptions(['-stream_loop', `${loopVideo - 1}`])
        .outputOptions('-t', `${finalDuration}`)
        .output(loopedVideo)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(audioFile.path)
        .inputOptions(['-stream_loop', `${loopAudio - 1}`])
        .outputOptions('-t', `${finalDuration}`)
        .output(loopedAudio)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(loopedVideo)
        .input(loopedAudio)
        .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject)
    })

    fs.unlinkSync(videoFile.path)
    fs.unlinkSync(audioFile.path)
    fs.unlinkSync(loopedVideo)
    fs.unlinkSync(loopedAudio)

    res.send(`✅ Đã xử lý xong: ${userId}/${outputFileName}`)
  } catch (err: any) {
    console.error('❌ Lỗi xử lý video/audio:', err.message)
    res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
  }
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
