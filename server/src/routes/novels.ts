import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../utils/db.js'

const router = Router()

router.use(authMiddleware)

router.get('/projects/:projectId/novels', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    const novels = await prisma.novel.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { updatedAt: 'desc' },
    })

    res.json(novels)
  } catch (error) {
    console.error('Get novels error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/projects/:projectId/novels', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    const { title, genre, synopsis } = req.body

    if (!title) {
      return res.status(400).json({ message: '请提供小说标题' })
    }

    const novel = await prisma.novel.create({
      data: {
        title,
        genre,
        synopsis,
        projectId: req.params.projectId,
      },
    })

    res.status(201).json(novel)
  } catch (error) {
    console.error('Create novel error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/novels/:id', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.id },
      include: {
        characters: true,
        chapters: {
          orderBy: { order: 'asc' },
        },
        project: {
          select: { userId: true },
        },
      },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    res.json(novel)
  } catch (error) {
    console.error('Get novel error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.put('/novels/:id', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.id },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { title, genre, synopsis } = req.body

    const updated = await prisma.novel.update({
      where: { id: req.params.id },
      data: { title, genre, synopsis },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update novel error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.delete('/novels/:id', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.id },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    await prisma.novel.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete novel error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

export default router
