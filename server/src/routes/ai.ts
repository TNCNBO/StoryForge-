import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { deepseekClient } from '../services/deepseek.js'

const router = Router()
const prisma = new PrismaClient()

// Helper: Safe JSON parse with fallback
function safeParseJson<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback
  try {
    return JSON.parse(jsonString)
  } catch {
    return fallback
  }
}

// Helper: Extract JSON from AI response (handles markdown code blocks)
function extractJsonFromResponse(content: string): any {
  let text = content.trim()

  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // Try to strip markdown code block
    if (text.startsWith('```')) {
      // Find end of opening line
      const firstNewline = text.indexOf('\n')
      if (firstNewline > 0) {
        text = text.substring(firstNewline + 1)
      }
      // Remove closing ```
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3)
      } else if (text.endsWith('```\n')) {
        text = text.substring(0, text.length - 4)
      }
      text = text.trim()
    }

    // Try to find JSON object in remaining text
    try {
      return JSON.parse(text)
    } catch {
      // Try to extract JSON object using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          throw new Error('无法解析AI返回的JSON格式')
        }
      }
      throw new Error('AI返回内容不是有效的JSON格式')
    }
  }
}

// Helper: Build extended context window
function buildContext(previousChapters: any[], currentChapter: number): string {
  // Get up to 10 previous chapters with 3000 chars each
  const relevant = previousChapters
    .filter(c => c.order < currentChapter && c.content)
    .slice(-10)

  if (relevant.length === 0) return '（无前文，这是第一章）'

  return relevant
    .map(c => `=== 第${c.order}章 ${c.title} ===\n${c.content.slice(-3000)}`)
    .join('\n\n')
}

// Helper: Validate outline data
function validateOutlineData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'AI返回数据格式无效' }
  }
  if (!data.title || typeof data.title !== 'string') {
    return { valid: false, error: '缺少小说标题' }
  }
  if (!data.mainArc || typeof data.mainArc !== 'string') {
    return { valid: false, error: '缺少主线剧情概述' }
  }
  if (!Array.isArray(data.plotPoints) || data.plotPoints.length === 0) {
    return { valid: false, error: '缺少情节要点列表或列表为空' }
  }
  if (data.plotPoints.length < 30) {
    return { valid: false, error: `情节要点数量不足，当前${data.plotPoints.length}章，需要至少30章` }
  }
  // Validate total word count
  const totalWords = data.plotPoints.reduce((sum: number, pt: any) =>
    sum + (pt.expectedWordCount || 3500), 0)
  if (totalWords < 2000) {
    return { valid: false, error: `预估总字数${totalWords}不足，要求≥2000字` }
  }
  return { valid: true }
}

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

    const worldSetting = extractJsonFromResponse(content)

    const result = await prisma.worldSetting.upsert({
      where: { novelId: novel.id },
      update: {
        name: worldSetting.name || '未命名世界观',
        genre: worldSetting.genre || genre || '玄幻奇幻',
        description: worldSetting.description || '',
        timeSetting: worldSetting.timeSetting || '',
        locationSetting: worldSetting.locationSetting || '',
        socialStructure: worldSetting.socialStructure || '',
        culturalRules: worldSetting.culturalRules || '',
        magicOrTechSystem: worldSetting.magicOrTechSystem || '',
      },
      create: {
        name: worldSetting.name || '未命名世界观',
        genre: worldSetting.genre || genre || '玄幻奇幻',
        description: worldSetting.description || '',
        timeSetting: worldSetting.timeSetting || '',
        locationSetting: worldSetting.locationSetting || '',
        socialStructure: worldSetting.socialStructure || '',
        culturalRules: worldSetting.culturalRules || '',
        magicOrTechSystem: worldSetting.magicOrTechSystem || '',
        novelId: novel.id,
      },
    })

    res.json(result)
  } catch (error) {
    console.error('Generate world setting error:', error)
    const message = error instanceof Error ? error.message : '未知错误'
    res.status(500).json({ message: `生成失败: ${message}` })
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

    const outlineData = extractJsonFromResponse(content)

    // Validate outline data
    const validation = validateOutlineData(outlineData)
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error })
    }

    const result = await prisma.outline.upsert({
      where: { novelId: novel.id },
      update: {
        title: outlineData.title,
        mainArc: outlineData.mainArc,
        subArcs: JSON.stringify(outlineData.subArcs || []),
        volumeStructure: JSON.stringify(outlineData.volumeStructure || []),
        plotPoints: JSON.stringify(outlineData.plotPoints || []),
        totalChapters: outlineData.plotPoints?.length || targetChapters,
      },
      create: {
        title: outlineData.title,
        mainArc: outlineData.mainArc,
        subArcs: JSON.stringify(outlineData.subArcs || []),
        volumeStructure: JSON.stringify(outlineData.volumeStructure || []),
        plotPoints: JSON.stringify(outlineData.plotPoints || []),
        totalChapters: outlineData.plotPoints?.length || targetChapters,
        novelId: novel.id,
      },
    })

    res.json(result)
  } catch (error) {
    console.error('Generate outline error:', error)
    const message = error instanceof Error ? error.message : '未知错误'
    res.status(500).json({ message: `生成失败: ${message}` })
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

    const plotPoints = safeParseJson(outline.plotPoints, [])
    const currentPlot = plotPoints.find(
      (p: any) => p.chapterNumber === chapter.order
    )

    if (!currentPlot) {
      return res.status(400).json({ message: '找不到对应的大纲章节' })
    }

    // 构建扩展上下文窗口（前10章×3000字）
    const context = buildContext(chapter.novel.chapters, chapter.order)

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

    // Validate content length
    if (content.length < 2500) {
      return res.status(400).json({
        message: `生成内容过少（${content.length}字），请重试`
      })
    }

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

    const plotPoints = safeParseJson(novel.outline.plotPoints, [])
    const generatedChapters = []
    const failedChapters = []
    const chaptersMap = new Map(novel.chapters.map(c => [c.order, c]))
    const totalChapters = endChapter - startChapter + 1

    for (let i = startChapter; i <= endChapter; i++) {
      const chapter = chaptersMap.get(i)
      if (!chapter) continue

      const currentPlot = plotPoints.find((p: any) => p.chapterNumber === i)
      if (!currentPlot) continue

      // 获取扩展上下文（前10章×3000字）
      const context = buildContext(novel.chapters, i)

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
${context}

## 写作要求
1. 严格遵循大纲设定
2. 章节字数: ${currentPlot.expectedWordCount || 3500}-5000字
3. 文笔流畅，符合出版物标准
4. 对话自然，符合角色性格
5. 场景描写细腻
6. 与前文衔接自然

请直接输出正文内容。`

      try {
        const startTime = Date.now()
        const content = await deepseekClient.chat(
          [{ role: 'user', content: prompt }],
          { temperature: 0.75, max_tokens: 8192 }
        )
        const generationTime = Date.now() - startTime

        if (content.length < 2500) {
          failedChapters.push({ chapter: i, reason: `内容过少（${content.length}字）` })
          continue
        }

        const updated = await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            content,
            wordCount: content.length,
            status: 'draft',
          },
        })

        generatedChapters.push({ ...updated, generationTime: `${generationTime}ms` })
      } catch (err) {
        console.error(`Failed to generate chapter ${i}:`, err)
        failedChapters.push({ chapter: i, reason: 'API调用失败' })
      }
    }

    res.json({
      total: totalChapters,
      success: generatedChapters.length,
      failed: failedChapters.length,
      failedChapters,
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
    const plotPoints = safeParseJson(outline.plotPoints, [])
    const subArcs = safeParseJson(outline.subArcs, [])
    const volumeStructure = safeParseJson(outline.volumeStructure, [])

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

// ==================== 角色生成 (SHA-7) ====================

// 生成单个角色
router.post('/novels/:novelId/characters/generate', async (req: AuthRequest, res) => {
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

    const { roleType, name, description } = req.body
    // roleType: protagonist, antagonist, supporting

    const existingChars = novel.characters.map(c => `- ${c.name}: ${c.description || '待补充'}`).join('\n')

    const worldDesc = novel.worldSetting ? `
- 时代背景: ${novel.worldSetting.timeSetting || '待补充'}
- 社会结构: ${novel.worldSetting.socialStructure || '待补充'}
- 文化规则: ${novel.worldSetting.culturalRules || '待补充'}
${novel.worldSetting.magicOrTechSystem ? `- 力量体系: ${novel.worldSetting.magicOrTechSystem}` : ''}` : ''

    const prompt = `你是一位专业的小说角色设计师。请为以下小说生成一个完整的角色设定。

## 小说信息
- 类型: ${novel.genre || '玄幻奇幻'}
- 标题: ${novel.title}
${worldDesc}

## 已有角色（避免重复）
${existingChars || '（暂无已有角色）'}

## 用户需求
- 角色定位: ${roleType === 'protagonist' ? '主角' : roleType === 'antagonist' ? '反派' : '配角'}
${name ? `- 指定名称: ${name}` : ''}
${description ? `- 用户描述: ${description}` : ''}

## 角色生成要求
请生成一个性格鲜明、背景立体、有成长弧线的角色。包含：
1. 姓名（符合小说风格）
2. 外貌特征
3. 性格特点（详细，3-5个关键词）
4. 背景故事（至少100字）
5. 核心动机/目标
6. 与其他角色的潜在关系
7. 如果是主角/反派，需要有明显的成长弧线

请以JSON格式输出：
{
  "name": "角色姓名",
  "role": "${roleType}",
  "description": "角色简介（20字以内）",
  "personality": "性格特点描述",
  "appearance": "外貌特征描述",
  "background": "背景故事",
  "motivation": "核心动机/目标",
  "relationships": "与其他角色的潜在关系"
}`

    const content = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.8, max_tokens: 4096 }
    )

    const characterData = extractJsonFromResponse(content)

    const character = await prisma.character.create({
      data: {
        name: characterData.name || '未命名角色',
        role: roleType,
        description: characterData.description || '',
        personality: characterData.personality || '',
        appearance: characterData.appearance || '',
        background: characterData.background || '',
        novelId: novel.id,
      },
    })

    res.json(character)
  } catch (error) {
    console.error('Generate character error:', error)
    res.status(500).json({ message: '生成失败，请重试' })
  }
})

// 批量生成角色
router.post('/novels/:novelId/characters/batch-generate', async (req: AuthRequest, res) => {
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

    const { protagonistCount = 1, antagonistCount = 1, supportingCount = 3 } = req.body

    const worldDesc = novel.worldSetting ? `
- 时代背景: ${novel.worldSetting.timeSetting || '待补充'}
- 社会结构: ${novel.worldSetting.socialStructure || '待补充'}
- 文化规则: ${novel.worldSetting.culturalRules || '待补充'}
${novel.worldSetting.magicOrTechSystem ? `- 力量体系: ${novel.worldSetting.magicOrTechSystem}` : ''}` : ''

    const prompt = `你是一位专业的小说角色设计师。请为以下小说生成一套完整的角色体系。

## 小说信息
- 类型: ${novel.genre || '玄幻奇幻'}
- 标题: ${novel.title}
${worldDesc}

## 角色需求
- 主角数量: ${protagonistCount}
- 反派数量: ${antagonistCount}
- 配角数量: ${supportingCount}

## 生成要求
1. 主角需要有明确的成长弧线和鲜明的个人特质
2. 反派需要有合理的动机，不能是单纯的"坏人"
3. 配角需要有自己的个性和存在的意义
4. 所有角色之间需要有潜在的关系网络
5. 角色设定要符合小说的世界观

请为每个角色生成详细的设定，输出JSON数组格式：
[
  {
    "name": "角色姓名",
    "role": "protagonist|antagonist|supporting",
    "description": "角色简介（20字以内）",
    "personality": "性格特点描述",
    "appearance": "外貌特征描述",
    "background": "背景故事",
    "motivation": "核心动机/目标"
  }
]`

    const content = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.8, max_tokens: 8192 }
    )

    let charactersData = extractJsonFromResponse(content)

    // Ensure it's an array
    if (!Array.isArray(charactersData)) {
      charactersData = [charactersData]
    }

    // Create characters in database
    const createdCharacters = []
    for (const charData of charactersData) {
      const character = await prisma.character.create({
        data: {
          name: charData.name || '未命名角色',
          role: charData.role || 'supporting',
          description: charData.description || '',
          personality: charData.personality || '',
          appearance: charData.appearance || '',
          background: charData.background || '',
          novelId: novel.id,
        },
      })
      createdCharacters.push(character)
    }

    res.json({ count: createdCharacters.length, characters: createdCharacters })
  } catch (error) {
    console.error('Batch generate characters error:', error)
    res.status(500).json({ message: '批量生成失败，请重试' })
  }
})

// ==================== 场景/对话优化 (SHA-10) ====================

// 优化场景描写
router.post('/optimize/scene', async (req: AuthRequest, res) => {
  try {
    const { content, context, target } = req.body
    // target: atmosphere, detail, both

    if (!content) {
      return res.status(400).json({ message: '请提供需要优化的内容' })
    }

    const prompt = `你是一位专业的小说文笔润色师。请对以下场景描写进行优化。

## 原文
${content}

${context ? `## 上下文\n${context}` : ''}

## 优化目标
${target === 'atmosphere' ? '增强氛围感和情绪表达' : target === 'detail' ? '增加场景细节和画面感' : '同时增强氛围感和场景细节'}

## 优化要求
1. 保持原文的情节和人物行为不变
2. 增强视觉、听觉、嗅觉、触觉等感官描写
3. 提升文字的画面感和沉浸感
4. 氛围描写要与情节情绪匹配
5. 不要添加新的情节元素
6. 优化后的内容应保持在500-2000字

请直接输出优化后的内容，不要添加任何说明。`

    const optimized = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 4096 }
    )

    res.json({
      original: content,
      optimized,
      type: 'scene',
      improvement: optimized.length > content.length ? 'enhanced' : 'similar'
    })
  } catch (error) {
    console.error('Optimize scene error:', error)
    res.status(500).json({ message: '优化失败，请重试' })
  }
})

// 优化对话
router.post('/optimize/dialogue', async (req: AuthRequest, res) => {
  try {
    const { content, characterContext } = req.body

    if (!content) {
      return res.status(400).json({ message: '请提供需要优化的对话' })
    }

    const prompt = `你是一位专业的小说对话设计师。请对以下对话进行润色优化。

## 原文对话
${content}

${characterContext ? `## 角色背景\n${characterContext}` : ''}

## 优化要求
1. 保持原对话的核心意思不变
2. 让对话更符合角色的性格和说话习惯
3. 增强对话的自然性和情感表达
4. 适当添加动作神态描写（用括号）
5. 对话要有潜台词和张力
6. 避免对话过于直白或过于文艺

## 输出格式
保持对话原文结构，只在需要的地方添加动作神态描写。输出优化后的完整内容。`

    const optimized = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 4096 }
    )

    res.json({
      original: content,
      optimized,
      type: 'dialogue'
    })
  } catch (error) {
    console.error('Optimize dialogue error:', error)
    res.status(500).json({ message: '优化失败，请重试' })
  }
})

// 优化文风/整体润色
router.post('/optimize/style', async (req: AuthRequest, res) => {
  try {
    const { content, style, targetWordCount } = req.body
    // style: vivid, concise, literary, modern

    if (!content) {
      return res.status(400).json({ message: '请提供需要优化的内容' })
    }

    const styleMap: Record<string, string> = {
      vivid: '增强画面感和感官描写，让文字更加生动鲜活',
      concise: '精简冗余表达，保持核心内容的同时让文字更加凝练',
      literary: '提升文学性，使用更优雅的表达方式',
      modern: '使用更现代的表达方式，贴近当代读者习惯'
    }

    const prompt = `你是一位专业的小说文风编辑。请对以下内容进行文风优化。

## 原文
${content}

## 目标文风
${styleMap[style] || styleMap.vivid}

${targetWordCount ? `## 目标字数\n${targetWordCount}字左右` : ''}

## 优化要求
1. 保持原文的情节、人物和核心信息不变
2. 调整文风使其符合目标风格
3. 保持文字的节奏感和可读性
4. 不要添加新的情节或人物
5. ${targetWordCount ? `输出字数控制在${targetWordCount}字左右` : '保持原文长度或适当精简'}

请直接输出优化后的内容，不要添加任何说明。`

    const optimized = await deepseekClient.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 8192 }
    )

    res.json({
      original: content,
      optimized,
      type: 'style',
      style,
      wordCount: optimized.length
    })
  } catch (error) {
    console.error('Optimize style error:', error)
    res.status(500).json({ message: '优化失败，请重试' })
  }
})

// ==================== 世界观设定 CRUD (前端对接) ====================

// 获取项目的所有世界观设定
router.get('/projects/:projectId/world-settings', async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    })

    if (!project) {
      return res.status(404).json({ message: '项目不存在' })
    }

    const novels = await prisma.novel.findMany({
      where: { projectId: project.id },
      include: { worldSetting: true },
    })

    const worldSettings = novels
      .filter(n => n.worldSetting)
      .map(n => ({ ...n.worldSetting, novelTitle: n.title }))

    res.json(worldSettings)
  } catch (error) {
    console.error('Get world settings error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

// 获取单个世界观设定
router.get('/world-settings/:id', async (req: AuthRequest, res) => {
  try {
    const worldSetting = await prisma.worldSetting.findUnique({
      where: { id: req.params.id },
      include: { novel: { include: { project: true } } },
    })

    if (!worldSetting || worldSetting.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '世界观不存在' })
    }

    res.json({ ...worldSetting, novelTitle: worldSetting.novel.title })
  } catch (error) {
    console.error('Get world setting error:', error)
    res.status(500).json({ message: '服务器错误' })
  }
})

// 更新世界观设定
router.put('/world-settings/:id', async (req: AuthRequest, res) => {
  try {
    const worldSetting = await prisma.worldSetting.findUnique({
      where: { id: req.params.id },
      include: { novel: { include: { project: true } } },
    })

    if (!worldSetting || worldSetting.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '世界观不存在' })
    }

    const { name, genre, description, timeSetting, locationSetting, socialStructure, culturalRules, magicOrTechSystem } = req.body

    // Helper: only update if value is non-empty string
    const keepExisting = (newVal: string | undefined, existing: string) =>
      (!newVal || newVal.trim() === '') ? existing : newVal

    const updated = await prisma.worldSetting.update({
      where: { id: worldSetting.id },
      data: {
        name: keepExisting(name, worldSetting.name),
        genre: keepExisting(genre, worldSetting.genre),
        description: keepExisting(description, worldSetting.description),
        timeSetting: keepExisting(timeSetting, worldSetting.timeSetting),
        locationSetting: keepExisting(locationSetting, worldSetting.locationSetting),
        socialStructure: keepExisting(socialStructure, worldSetting.socialStructure),
        culturalRules: keepExisting(culturalRules, worldSetting.culturalRules),
        magicOrTechSystem: keepExisting(magicOrTechSystem, worldSetting.magicOrTechSystem),
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Update world setting error:', error)
    res.status(500).json({ message: '更新失败' })
  }
})

// 删除世界观设定
router.delete('/world-settings/:id', async (req: AuthRequest, res) => {
  try {
    const worldSetting = await prisma.worldSetting.findUnique({
      where: { id: req.params.id },
      include: { novel: { include: { project: true } } },
    })

    if (!worldSetting || worldSetting.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '世界观不存在' })
    }

    await prisma.worldSetting.delete({
      where: { id: worldSetting.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete world setting error:', error)
    res.status(500).json({ message: '删除失败' })
  }
})

// AI生成世界观内容（更新已有世界观）
router.post('/world-settings/:id/generate', async (req: AuthRequest, res) => {
  try {
    const worldSetting = await prisma.worldSetting.findUnique({
      where: { id: req.params.id },
      include: { novel: { include: { project: true } } },
    })

    if (!worldSetting || worldSetting.novel.project.userId !== req.userId) {
      return res.status(404).json({ message: '世界观不存在' })
    }

    const prompt = `你是一位专业的小说世界观设计师。请为以下类型的小说生成/更新世界观设定。

## 小说类型
${worldSetting.genre || '玄幻奇幻'}

## 用户描述
${worldSetting.description || '请根据类型自动生成'}

## 已有世界观
- 名称: ${worldSetting.name}
- 时代背景: ${worldSetting.timeSetting || '待补充'}
- 地理环境: ${worldSetting.locationSetting || '待补充'}
- 社会结构: ${worldSetting.socialStructure || '待补充'}
- 文化规则: ${worldSetting.culturalRules || '待补充'}
${worldSetting.magicOrTechSystem ? `- 力量体系: ${worldSetting.magicOrTechSystem}` : ''}

## 要求
请生成完整的世界观设定，包含：
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

    const data = extractJsonFromResponse(content)

    const updated = await prisma.worldSetting.update({
      where: { id: worldSetting.id },
      data: {
        name: data.name || worldSetting.name,
        genre: data.genre || worldSetting.genre,
        description: data.description || worldSetting.description,
        timeSetting: data.timeSetting || worldSetting.timeSetting,
        locationSetting: data.locationSetting || worldSetting.locationSetting,
        socialStructure: data.socialStructure || worldSetting.socialStructure,
        culturalRules: data.culturalRules || worldSetting.culturalRules,
        magicOrTechSystem: data.magicOrTechSystem || worldSetting.magicOrTechSystem,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('Generate world setting error:', error)
    res.status(500).json({ message: '生成失败，请重试' })
  }
})

export default router
