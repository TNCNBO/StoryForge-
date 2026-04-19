# StoryForge API 文档

## 认证
所有接口（除 `/api/auth/*` 外）都需要在请求头中携带 JWT Token：
```
Authorization: Bearer <token>
```

---

## AI 生成模块

### 世界观生成

#### 生成世界观
```
POST /api/novels/:novelId/world-setting
```
**Body:**
```json
{
  "genre": "玄幻奇幻",
  "description": "用户描述（可选）"
}
```
**Response:**
```json
{
  "id": "uuid",
  "name": "世界观名称",
  "genre": "玄幻奇幻",
  "description": "整体描述",
  "timeSetting": "时代背景",
  "locationSetting": "地理环境",
  "socialStructure": "社会结构",
  "culturalRules": "文化规则",
  "magicOrTechSystem": "力量体系"
}
```

#### 获取世界观
```
GET /api/novels/:novelId/world-setting
```

---

### 角色生成 (SHA-7)

#### 生成单个角色
```
POST /api/novels/:novelId/characters/generate
```
**Body:**
```json
{
  "roleType": "protagonist | antagonist | supporting",
  "name": "指定名称（可选）",
  "description": "用户描述（可选）"
}
```
**Response:**
```json
{
  "id": "uuid",
  "name": "角色姓名",
  "role": "protagonist",
  "description": "角色简介",
  "personality": "性格特点",
  "appearance": "外貌特征",
  "background": "背景故事",
  "novelId": "uuid"
}
```

#### 批量生成角色
```
POST /api/novels/:novelId/characters/batch-generate
```
**Body:**
```json
{
  "protagonistCount": 1,
  "antagonistCount": 1,
  "supportingCount": 3
}
```
**Response:**
```json
{
  "count": 5,
  "characters": [...]
}
```

---

### 大纲生成 (SHA-8)

#### 生成大纲
```
POST /api/novels/:novelId/outline
```
**Body:**
```json
{
  "targetChapters": 30
}
```
**Response:**
```json
{
  "id": "uuid",
  "title": "小说标题",
  "mainArc": "主线剧情概述",
  "subArcs": "[\"支线1\", \"支线2\"]",
  "volumeStructure": "[{\"volume\": 1, \"chapters\": \"1-10\", \"theme\": \"卷主题\"}]",
  "plotPoints": "[{\"chapterNumber\": 1, \"title\": \"章节标题\", \"summary\": \"章节概述\", ...}]",
  "totalChapters": 30,
  "novelId": "uuid"
}
```
**注意:** `subArcs`, `volumeStructure`, `plotPoints` 字段为 JSON 字符串，前端需 JSON.parse() 解析。

#### 获取大纲
```
GET /api/novels/:novelId/outline
```

#### 导出大纲
```
GET /api/novels/:novelId/outline/export
```
**Response:**
```json
{
  "content": "# 小说标题\n\n## 总览\n...",
  "format": "markdown"
}
```

---

### 章节正文生成 (SHA-9)

#### 生成单章正文
```
POST /api/chapters/:chapterId/generate
```
**Body:**
```json
{
  "maxWords": 5000
}
```
**Response:**
```json
{
  "id": "uuid",
  "title": "章节标题",
  "content": "生成的正文内容...",
  "wordCount": 3500,
  "status": "draft",
  "generationTime": "1234ms"
}
```

#### 批量生成章节
```
POST /api/novels/:novelId/chapters/batch-generate
```
**Body:**
```json
{
  "startChapter": 1,
  "endChapter": 10
}
```
**Response:**
```json
{
  "count": 10,
  "chapters": [...]
}
```

---

### 场景/对话优化 (SHA-10)

#### 优化场景描写
```
POST /api/optimize/scene
```
**Body:**
```json
{
  "content": "需要优化的场景原文",
  "context": "上下文（可选）",
  "target": "atmosphere | detail | both"
}
```
**Response:**
```json
{
  "original": "原文",
  "optimized": "优化后内容",
  "type": "scene",
  "improvement": "enhanced"
}
```

#### 优化对话
```
POST /api/optimize/dialogue
```
**Body:**
```json
{
  "content": "需要优化的对话原文",
  "characterContext": "角色背景（可选）"
}
```
**Response:**
```json
{
  "original": "原文",
  "optimized": "优化后内容",
  "type": "dialogue"
}
```

#### 优化文风
```
POST /api/optimize/style
```
**Body:**
```json
{
  "content": "需要优化的内容",
  "style": "vivid | concise | literary | modern",
  "targetWordCount": 3000
}
```
**Response:**
```json
{
  "original": "原文",
  "optimized": "优化后内容",
  "type": "style",
  "style": "vivid",
  "wordCount": 3000
}
```

---

## 错误响应

所有接口错误返回格式：
```json
{
  "message": "错误描述"
}
```

HTTP 状态码：
- 200: 成功
- 400: 请求参数错误
- 401: 未授权（Token 无效）
- 404: 资源不存在
- 500: 服务器内部错误
