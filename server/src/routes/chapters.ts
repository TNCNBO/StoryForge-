import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

router.get('/novels/:novelId/chapters', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const chapters = await prisma.chapter.findMany({
      where: { novelId: req.params.novelId },
      orderBy: { order: 'asc' },
    })

    res.json(chapters)
  } catch (error) {
    console.error('Get chapters error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/novels/:novelId/chapters', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { title, content, order, status } = req.body

    if (!title) {
      return res.status(400).json({ message: '请提供章节标题' })
    }

    const wordCount = content ? content.length : 0

    const chapter = await prisma.chapter.create({
      data: {
        title,
        content: content || '',
        order: order || 0,
        wordCount,
        status: status || 'draft',
        novelId: req.params.novelId,
      },
    })

    res.status(201).json(chapter)
  } catch (error) {
    console.error('Create chapter error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.put('/chapters/:id', async (req: AuthRequest, res) => {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: req.params.id },
      include: { novel: { include: { project: { select: { userId: true } } } } },
    })

    if (!chapter || chapter.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '章节不存在' })
    }

    const { title, content, order, status } = req.body
    const wordCount = content ? content.length : 0

    const updated = await prisma.chapter.update({
      where: { id: req.params.id },
      data: { title, content, order, status, wordCount },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update chapter error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.delete('/chapters/:id', async (req: AuthRequest, res) => {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: req.params.id },
      include: { novel: { include: { project: { select: { userId: true } } } } },
    })

    if (!chapter || chapter.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '章节不存在' })
    }

    await prisma.chapter.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete chapter error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

export default router
