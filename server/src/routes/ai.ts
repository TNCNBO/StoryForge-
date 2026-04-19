import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { deepseekClient } from '../services/deepseek.js'

const router = Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// 生成世界观
router.post('/novels/:novelId/world-setting', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { genre, description } = req.body

    const prompt = `你是一位专业的小说世界观设计师。请为以下类型的小说生成完整的世界观设定。

## 小说类型
${genre || '玄幻奇幻'}

## 用户描述
${description || '请根据类型自动生成'}

## 世界观要求
请生成以下方面的详细信息：
1. 时代背景（时间设定）
2. 地理环境（地点设定）
3. 社会结构（阶级、组织、势力）
4. 文化规则（风俗习惯、禁忌）
5. 力量体系（如果有魔法或科技）

请以JSON格式输出：
{
  "name": "世界观名称",
  "genre": "类型",
  "description": "整体描述",
  "timeSetting": "时代背景",
  "locationSetting": "地理环境",
  "socialStructure": "社会结构",
  "culturalRules": "文化规则",
  "magicOrTechSystem": "力量体系（可为空）"
}`

    const content = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 4096 }
    )

    const worldSetting = JSON.parse(content)

    const result = await prisma.worldSetting.upsert({
      where: { novelId: novel.id },
      update: worldSetting,
      create: {
        ...worldSetting,
        novelId: novel.id,
      },
    })

    res.json(result)
  } catch (error) {
    console.error('Generate world setting error:', error)
    res.status(500).json({ message: '生成失败，请重试' })
  }
})

// 获取世界观
router.get('/novels/:novelId/world-setting', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const worldSetting = await prisma.worldSetting.findUnique({
      where: { novelId: novel.id },
    })

    res.json(worldSetting)
  } catch (error) {
    console.error('Get world setting error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

// 生成大纲
router.post('/novels/:novelId/outline', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: {
        project: { select: { userId: true } },
        worldSetting: true,
        characters: true,
      },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { targetChapters = 30 } = req.body

    // 构建角色描述
    const charactersDesc = novel.characters
      .map(c => `- ${c.name}: ${c.personality || c.description || '待补充'}`)
      .join('\n')

    // 构建世界观描述
    const worldDesc = novel.worldSetting
      ? `
- 时代背景: ${novel.worldSetting.timeSetting || '待补充'}
- 地理环境: ${novel.worldSetting.locationSetting || '待补充'}
- 社会结构: ${novel.worldSetting.socialStructure || '待补充'}
- 文化规则: ${novel.worldSetting.culturalRules || '待补充'}
${novel.worldSetting.magicOrTechSystem ? `- 力量体系: ${novel.worldSetting.magicOrTechSystem}` : ''}`
      : ''

    const prompt = `你是一位专业的小说大纲设计师。请为以下作品生成完整的章节大纲。

## 作品类型
${novel.genre || '玄幻奇幻'}

## 世界观设定
${worldDesc || '（暂无详细世界观，请根据类型自动设计）'}

## 角色设定
${charactersDesc || '（暂无角色设定，请根据类型自动设计）'}

## 大纲要求
1. 生成 ${targetChapters} 章的完整大纲
2. 采用"起承转合"结构
3. 每章需包含：章节标题、章节概述（100-200字）、涉及角色、场景地点、预期字数、情节类型
4. 分配主线和支线任务
5. 标注高潮点和转折点

请以JSON格式输出：
{
  "title": "小说标题",
  "mainArc": "主线剧情概述",
  "subArcs": ["支线1", "支线2"],
  "volumeStructure": [{"volume": 1, "chapters": "1-10", "theme": "卷主题"}],
  "plotPoints": [
    {
      "chapterNumber": 1,
      "title": "章节标题",
      "summary": "章节概述",
      "involvedCharacters": ["角色1"],
      "location": "场景地点",
      "expectedWordCount": 3500,
      "plotType": "setup"
    }
  ]
}`

    const content = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 8192 }
    )

    const outlineData = JSON.parse(content)

    const result = await prisma.outline.upsert({
      where: { novelId: novel.id },
      update: {
        title: outlineData.title,
        mainArc: outlineData.mainArc,
        subArcs: JSON.stringify(outlineData.subArcs || []),
        volumeStructure: JSON.stringify(outlineData.volumeStructure || []),
        plotPoints: JSON.stringify(outlineData.plotPoints || []),
        totalChapters: outlineData.totalChapters || targetChapters,
      },
      create: {
        title: outlineData.title,
        mainArc: outlineData.mainArc,
        subArcs: JSON.stringify(outlineData.subArcs || []),
        volumeStructure: JSON.stringify(outlineData.volumeStructure || []),
        plotPoints: JSON.stringify(outlineData.plotPoints || []),
        totalChapters: outlineData.totalChapters || targetChapters,
        novelId: novel.id,
      },
    })

    res.json(result)
  } catch (error) {
    console.error('Generate outline error:', error)
    res.status(500).json({ message: '生成失败，请重试' })
  }
})

// 获取大纲
router.get('/novels/:novelId/outline', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } } },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const outline = await prisma.outline.findUnique({
      where: { novelId: novel.id },
    })

    res.json(outline)
  } catch (error) {
    console.error('Get outline error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

// 生成单章正文
router.post('/chapters/:chapterId/generate', async (req: AuthRequest, res) => {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: req.params.chapterId },
      include: {
        novel: {
          include: {
            project: { select: { userId: true } },
            outline: true,
            characters: true,
            chapters: {
              orderBy: { order: 'asc' },
              take: 5,
            },
          },
        },
      },
    })

    if (!chapter || chapter.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '章节不存在' })
    }

    const { maxWords = 5000 } = req.body
    const outline = chapter.novel.outline

    if (!outline || !outline.plotPoints) {
      return res.status(400).json({ message: '请先生成大纲' })
    }

    const plotPoints = JSON.parse(outline.plotPoints)
    const currentPlot = plotPoints.find(
      (p: any) => p.chapterNumber === chapter.order
    )

    if (!currentPlot) {
      return res.status(400).json({ message: '找不到对应的大纲章节' })
    }

    // 构建前文上下文
    const previousChapters = chapter.novel.chapters
      .filter(c => c.order < chapter.order && c.content)
      .slice(-3)

    let context = ''
    if (previousChapters.length > 0) {
      context = previousChapters
        .map(c => `=== 第${c.order}章 ${c.title} ===\n${c.content.slice(-2000)}`)
        .join('\n\n')
    }

    const charactersDesc = chapter.novel.characters
      .map(c => `- ${c.name}: ${c.personality || c.description || '待补充'}`)
      .join('\n')

    const prompt = `你是一位专业的小说作者。请根据以下大纲和上下文，生成第${chapter.order}章的正文。

## 作品信息
- 标题: ${outline.title}
- 主线: ${outline.mainArc || '待补充'}

## 当前章节大纲
- 章节: 第${currentPlot.chapterNumber}章 - ${currentPlot.title}
- 章节概述: ${currentPlot.summary}
- 场景/地点: ${currentPlot.location}
- 涉及角色: ${currentPlot.involvedCharacters?.join(', ') || '待定'}
- 情节类型: ${currentPlot.plotType}
- 目标字数: ${currentPlot.expectedWordCount || 3500}-${maxWords}字

## 角色设定
${charactersDesc}

## 前文上下文
${context || '（无前文，这是第一章）'}

## 写作要求
1. 严格遵循大纲设定
2. 章节字数: ${currentPlot.expectedWordCount || 3500}-${maxWords}字
3. 文笔流畅，符合出版物标准
4. 对话自然，符合角色性格
5. 场景描写细腻，画面感强
6. 情节推进逻辑清晰
7. 与前文衔接自然

请直接输出正文内容，不要包含任何额外说明。`

    const startTime = Date.now()
    const content = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.75, max_tokens: 8192 }
    )
    const generationTime = Date.now() - startTime

    // 更新章节内容
    const updated = await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        content,
        wordCount: content.length,
        status: 'draft',
      },
    })

    res.json({
      ...updated,
      generationTime: `${generationTime}ms`,
    })
  } catch (error) {
    console.error('Generate chapter error:', error)
    res.status(500).json({ message: '生成失败，请重试' })
  }
})

// 批量生成章节
router.post('/novels/:novelId/chapters/batch-generate', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: {
        project: { select: { userId: true } },
        outline: true,
        chapters: { orderBy: { order: 'asc' } },
      },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    const { startChapter, endChapter } = req.body

    if (!startChapter || !endChapter) {
      return res.status(400).json({ message: '请提供起始和结束章节号' })
    }

    if (!novel.outline || !novel.outline.plotPoints) {
      return res.status(400).json({ message: '请先生成大纲' })
    }

    const plotPoints = JSON.parse(novel.outline.plotPoints)
    const generatedChapters = []
    const chaptersMap = new Map(novel.chapters.map(c => [c.order, c]))

    for (let i = startChapter; i <= endChapter; i++) {
      const chapter = chaptersMap.get(i)
      if (!chapter) continue

      const currentPlot = plotPoints.find((p: any) => p.chapterNumber === i)
      if (!currentPlot) continue

      // 获取前文上下文
      const previousChapters = novel.chapters
        .filter(c => c.order < i && c.content)
        .slice(-3)

      let context = ''
      if (previousChapters.length > 0) {
        context = previousChapters
          .map(c => `=== 第${c.order}章 ${c.title} ===\n${c.content.slice(-2000)}`)
          .join('\n\n')
      }

      const charactersDesc = novel.characters
        .map(c => `- ${c.name}: ${c.personality || c.description || '待补充'}`)
        .join('\n')

      const prompt = `你是一位专业的小说作者。请根据以下大纲和上下文，生成第${i}章的正文。

## 作品信息
- 标题: ${novel.outline.title}
- 主线: ${novel.outline.mainArc || '待补充'}

## 当前章节大纲
- 章节: 第${currentPlot.chapterNumber}章 - ${currentPlot.title}
- 章节概述: ${currentPlot.summary}
- 场景/地点: ${currentPlot.location}
- 涉及角色: ${currentPlot.involvedCharacters?.join(', ') || '待定'}
- 情节类型: ${currentPlot.plotType}
- 目标字数: ${currentPlot.expectedWordCount || 3500}-5000字

## 角色设定
${charactersDesc}

## 前文上下文
${context || '（无前文，这是第一章）'}

## 写作要求
1. 严格遵循大纲设定
2. 章节字数: ${currentPlot.expectedWordCount || 3500}-5000字
3. 文笔流畅，符合出版物标准
4. 对话自然，符合角色性格
5. 场景描写细腻
6. 与前文衔接自然

请直接输出正文内容。`

      try {
        const content = await deepseekClient.chat(
          [{ role: 'user', content: prompt }],
          { temperature: 0.75, max_tokens: 8192 }
        )

        const updated = await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            content,
            wordCount: content.length,
            status: 'draft',
          },
        })

        generatedChapters.push(updated)
      } catch (err) {
        console.error(`Failed to generate chapter ${i}:`, err)
      }
    }

    res.json({
      count: generatedChapters.length,
      chapters: generatedChapters,
    })
  } catch (error) {
    console.error('Batch generate chapters error:', error)
    res.status(500).json({ message: '批量生成失败' })
  }
})

// 导出大纲
router.get('/novels/:novelId/outline/export', async (req: AuthRequest, res) => {
  try {
    const novel = await prisma.novel.findFirst({
      where: { id: req.params.novelId },
      include: { project: { select: { userId: true } }, outline: true },
    })

    if (!novel || novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '小说不存在' })
    }

    if (!novel.outline) {
      return res.status(404).json({ message: '大纲不存在' })
    }

    const outline = novel.outline
    const plotPoints = outline.plotPoints ? JSON.parse(outline.plotPoints) : []
    const subArcs = outline.subArcs ? JSON.parse(outline.subArcs) : []
    const volumeStructure = outline.volumeStructure ? JSON.parse(outline.volumeStructure) : []

    let md = `# ${outline.title}\n\n`
    md += `## 总览\n`
    md += `- 总章节数: ${outline.totalChapters}\n`
    md += `- 主线: ${outline.mainArc || '待补充'}\n`
    if (subArcs.length > 0) {
      md += `- 支线: ${subArcs.join(', ')}\n`
    }
    md += '\n'

    if (volumeStructure.length > 0) {
      md += '## 卷结构\n'
      volumeStructure.forEach((vol: any) => {
        md += `- 第${vol.volume}卷: ${vol.chapters} - ${vol.theme}\n`
      })
      md += '\n'
    }

    md += '## 章节大纲\n'
    plotPoints.forEach((pt: any) => {
      md += `### 第${pt.chapterNumber}章: ${pt.title}\n`
      md += `- **类型**: ${pt.plotType}\n`
      md += `- **地点**: ${pt.location}\n`
      md += `- **角色**: ${pt.involvedCharacters?.join(', ') || '待定'}\n`
      md += `- **预期字数**: ${pt.expectedWordCount || 3500}\n\n`
      md += `${pt.summary}\n\n`
    })

    res.json({ content: md, format: 'markdown' })
  } catch (error) {
    console.error('Export outline error:', error)
    res.status(500).json({ message: '导出失败' })
  }
})

export default router
