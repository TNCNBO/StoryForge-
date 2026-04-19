import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../utils/db.js'

const router = Router()

router.use(authMiddleware)

router.get('/novels/:novelId/characters', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const characters = await prisma.character.findMany({
      where: { novelId: req.params.novelId },
    })

    res.json(characters)
  } catch (error) {
    console.error('Get characters error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.post('/novels/:novelId/characters', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { name, description, personality, appearance, background } = req.body

    if (!name) {
      return res.status(400).json({ message: '请提供角色名称' })
    }

    const character = await prisma.character.create({
      data: {
        name,
        description,
        personality,
        appearance,
        background,
        novelId: req.params.novelId,
      },
    })

    res.status(201).json(character)
  } catch (error) {
    console.error('Create character error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.put('/characters/:id', async (req: AuthRequest, res) => {
  try {
    const character = await prisma.character.findFirst({
      where: { id: req.params.id },
      include: { novel: { include: { project: { select: { userId: true } } } } },
    })

    if (!character || character.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '角色不存在' })
    }

    const { name, description, personality, appearance, background } = req.body

    const updated = await prisma.character.update({
      where: { id: req.params.id },
      data: { name, description, personality, appearance, background },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update character error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

router.delete('/characters/:id', async (req: AuthRequest, res) => {
  try {
    const character = await prisma.character.findFirst({
      where: { id: req.params.id },
      include: { novel: { include: { project: { select: { userId: true } } } } },
    })

    if (!character || character.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '角色不存在' })
    }

    await prisma.character.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete character error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

export default router
