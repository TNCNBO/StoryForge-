import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../utils/db.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req: AuthRequest, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(projects)
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body

    if (!name) {
      return res.status(400).json({ message: '请提供项目名称' })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId: req.userId!,
      },
    })

    res.status(201).json(project)
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        novels: {
          include: {
            characters: true,
            chapters: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    res.json(project)
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update project error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    await prisma.project.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

export default router
