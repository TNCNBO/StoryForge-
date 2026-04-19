import express from 'express'
import cors from 'cors'
import { config } from './config/index.js'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import novelRoutes from './routes/novels.js'
import characterRoutes from './routes/characters.js'
import chapterRoutes from './routes/chapters.js'

const app = express()

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api', novelRoutes)
app.use('/api', characterRoutes)
app.use('/api', chapterRoutes)

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((_, res) => {
  res.status(404).json({ message: '接口不存在' })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: '服务器内部错误' })
})

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} (${config.nodeEnv})`)
})
