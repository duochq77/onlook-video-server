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

app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')))

const upload = multer({ dest: 'uploads/' })
const ffprobe = util.promisify(ffmpeg.ffprobe)

const getDuration = async (filePath: string): Promise<number> => {
  const metadata = await ffprobe(filePath)
  return metadata.format.duration || 0
}

const cleanupOldFiles = (userDir: string) => {
  const now = Date.now()
  if (!fs.existsSync(userDir)) return
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

app.post('/process', upload.array('media', 2), async (req, res) => {
  const userId = req.body.userId || 'default'
  const files = req.files as Express.Multer.File[]

  if (!files || files.length !== 2) {
    return res.status(400).send('❌ Cần đúng 2 file: 1 video, 1 audio')
  }

  const outputsDir = path.join(process.cwd(), 'outputs', userId)
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true })
  }
  cleanupOldFiles(outputsDir)

  const [file1, file2] = files
  const isVideo = (f: Express.Multer.File) => f.mimetype.startsWith('video')
  const isAudio = (f: Express.Multer.File) => f.mimetype.startsWith('audio')

  let videoFile: Express.Multer.File | null = null
  let audioFile: Express.Multer.File | null = null

  if (isVideo(file1) && isAudio(file2)) {
    videoFile = file1
    audioFile = file2
  } else if (isVideo(file2) && isAudio(file1)) {
    videoFile = file2
    audioFile = file1
  } else {
    return res.status(400).send('❌ Phải gửi 1 video và 1 audio')
  }

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
          .inputOptions(['-stream_loop', `${Math.floor(audioDuration / videoDuration)}`])
          .outputOptions(['-t', `${finalDuration}`])
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
          .inputOptions(['-stream_loop', `${Math.floor(videoDuration / audioDuration)}`])
          .outputOptions(['-t', `${finalDuration}`])
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
        .outputOptions([
          '-map', '0:v:0', // lấy video từ loopedVideo
          '-map', '1:a:0', // lấy audio từ loopedAudio
          '-c:v', 'copy',
          '-c:a', 'aac'
        ])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject)
    })

    fs.unlinkSync(loopedVideo)
    fs.unlinkSync(loopedAudio)

    res.send(`✅ Đã xử lý xong: /outputs/${userId}/${outputFileName}`)
  } catch (err: any) {
    console.error('❌ Lỗi xử lý video/audio:', err.message)
    res.status(500).send(`❌ Lỗi xử lý video/audio: ${err.message}`)
  }
})

app.listen(port, () => {
  console.log(`🎬 Video/audio processing server đang chạy tại http://localhost:${port}`)
})
