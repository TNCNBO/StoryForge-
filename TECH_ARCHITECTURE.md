# StoryForge 技术架构方案

## 1. 技术栈选型

### 1.1 前端
| 选项 | 推荐 | 理由 |
|------|------|------|
| 框架 | **Next.js 14 (App Router)** | SSR/SSG 支持好，API 路由内置，部署简单 |
| UI 库 | **TailwindCSS + shadcn/ui** | 快速开发，样式一致性好 |
| 状态管理 | **Zustand** | 轻量，比 Redux 简单 |
| 表单 | **React Hook Form + Zod** | 类型安全，验证方便 |
| Markdown编辑 | **@uiw/react-md-editor** | 小说内容编辑 |

### 1.2 后端
| 选项 | 推荐 | 理由 |
|------|------|------|
| 框架 | **Next.js API Routes** | 前后端一体化，简化部署 |
| ORM | **Prisma** | 类型安全，迁移方便 |
| 认证 | **NextAuth.js** | 支持多种 Provider，简单易用 |

### 1.3 数据库
| 选项 | 推荐 | 理由 |
|------|------|------|
| 数据库 | **PostgreSQL** | 关系型数据，JSON 支持，扩展性好 |
| 部署 | **Supabase** 或 **Neon** | Serverless PostgreSQL，免费额度 |

### 1.4 AI 集成
| 选项 | 推荐 | 理由 |
|------|------|------|
| AI Provider | **Claude API** ( Anthropic ) | 长上下文，创意写作能力强 |
| 备选 | **OpenAI GPT-4o** | 成熟生态 |

---

## 2. 数据库 Schema 设计

### 2.1 核心实体

```
User (用户)
├── id: UUID (PK)
├── email: String (unique)
├── passwordHash: String
├── name: String
├── createdAt: DateTime
└── updatedAt: DateTime

Project (项目/小说)
├── id: UUID (PK)
├── userId: UUID (FK → User)
├── title: String
├── description: Text
├── genre: String (enum)
├── targetWordCount: Int
├── status: Enum (draft/writing/completed/archived)
├── createdAt: DateTime
└── updatedAt: DateTime

Character (角色)
├── id: UUID (PK)
├── projectId: UUID (FK → Project)
├── name: String
├── role: Enum (protagonist/antagonist/supporting/minor)
├── description: Text
├── appearance: Text
├── personality: Text
├── backstory: Text
├── arc: Text
├── imageUrl: String (optional)
└── createdAt: DateTime

Chapter (章节)
├── id: UUID (PK)
├── projectId: UUID (FK → Project)
├── number: Int
├── title: String
├── synopsis: Text (AI生成概要)
├── content: Text (Markdown)
├── wordCount: Int
├── status: Enum (outline/draft/revision/final)
├── createdAt: DateTime
└── updatedAt: DateTime

Scene (场景) - 可选，用于复杂结构
├── id: UUID (PK)
├── chapterId: UUID (FK → Chapter)
├── number: Int
├── location: String
├── timePeriod: String
├── content: Text
└── createdAt: DateTime

WorldSetting (世界观设定)
├── id: UUID (PK)
├── projectId: UUID (FK → Project)
├── category: String (地理/历史/魔法/社会...)
├── title: String
├── content: Text
└── createdAt: DateTime

GenerationLog (AI生成记录)
├── id: UUID (PK)
├── projectId: UUID (FK → Project)
├── prompt: Text
├── response: Text
├── model: String
├── tokens: Int
├── createdAt: DateTime
└── createdAt: DateTime
```

### 2.2 关系图

```
User 1───< Project 1───< Chapter
                │              │
                │              │
                ├───< Character
                ├───< WorldSetting
                └───< GenerationLog
```

---

## 3. API 规范

### 3.1 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/session` | 获取会话 |
| POST | `/api/auth/logout` | 登出 |

### 3.2 项目接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 列表 |
| POST | `/api/projects` | 创建 |
| GET | `/api/projects/:id` | 详情 |
| PUT | `/api/projects/:id` | 更新 |
| DELETE | `/api/projects/:id` | 删除 |

### 3.3 章节接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:pid/chapters` | 列表 |
| POST | `/api/projects/:pid/chapters` | 创建 |
| PUT | `/api/chapters/:id` | 更新 |
| DELETE | `/api/chapters/:id` | 删除 |

### 3.4 AI 生成接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/generate-outline` | 生成大纲 |
| POST | `/api/ai/generate-chapter` | 生成章节 |
| POST | `/api/ai/generate-dialogue` | 生成对话 |
| POST | `/api/ai/continue-story` | 续写 |
| POST | `/api/ai/revise` | 润色/修改 |
| POST | `/api/ai/world-building` | 世界观生成 |

---

## 4. 目录结构

```
StoryForge/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── projects/
│   │   │   │   ├── [projectId]/
│   │   │   │   │   ├── chapters/
│   │   │   │   │   │   ├── [chapterId]/
│   │   │   │   │   ├── characters/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── outline/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── chapters/
│   │   │   └── ai/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── editor/
│   │   ├── project/
│   │   └── ai/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── ai/
│   │   │   ├── claude.ts
│   │   │   └── prompts/
│   │   └── utils.ts
│   └── types/
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 5. 部署方案

### 5.1 推荐方案：Vercel + Supabase
| 服务 | 用途 | 成本 |
|------|------|------|
| **Vercel** | 前端 + API | 免费 ( Hobby ) |
| **Supabase** | PostgreSQL + Auth | 免费 ( Pro: $25/月 ) |
| **Claude API** | AI 生成 | 按 token 计费 |

### 5.2 备选方案
- **Railway** + PostgreSQL plugin
- **Fly.io** + Neon PostgreSQL

---

## 6. 风险点

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| AI 生成内容质量不稳定 | 中 | 提供多次生成/选择功能，保留人工编辑能力 |
| 长篇小说上下文丢失 | 高 | 分章节处理，用向量数据库存储已生成内容 |
| 数据库迁移影响数据 | 中 | 使用 Prisma Migration，保留备份 |
| AI API 成本失控 | 中 | 设置用量限额，缓存常用 prompt |

---

## 7. 验收标准检查清单

- [ ] Next.js 项目可本地启动 (`npm run dev`)
- [ ] 用户可注册、登录
- [ ] 可创建/编辑/删除项目
- [ ] 可创建/编辑/删除章节
- [ ] 可调用 Claude API 生成内容
- [ ] 数据库 Schema 正确创建

---

## 8. 后续协作建议

在 SHA-5 完成后，前端开发需要确认：
1. **AI API 集成方案**：选择 Claude 还是 GPT，API Key 管理方式
2. **导出格式**：EPUB / PDF / Word，需要哪些库
3. **实时协作**：是否需要多人协作编辑
