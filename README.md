# StoryForge

AI 小说创作平台

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **ORM**: Prisma
- **部署**: Docker + Docker Compose + Nginx

## 快速开始

### 开发环境

1. 克隆仓库
2. 安装依赖

```bash
cd client && npm install
cd server && npm install
```

3. 初始化数据库

```bash
cd server
npx prisma generate
npx prisma db push
```

4. 启动开发服务器

```bash
# 终端1: 启动后端
cd server && npm run dev

# 终端2: 启动前端
cd client && npm run dev
```

5. 访问 http://localhost:5173

### Docker 部署 (生产环境)

1. 复制环境变量文件

```bash
cp .env.example .env
# 编辑 .env 填入实际值
```

2. 启动服务

```bash
docker-compose up -d
```

3. 初始化数据库

```bash
docker-compose exec server npx prisma migrate deploy
```

4. 访问 http://localhost

## 项目结构

```
StoryForge/
├── client/          # 前端应用
├── server/          # 后端应用
│   ├── prisma/      # 数据库 Schema
│   └── src/
│       ├── routes/  # API 路由
│       ├── middleware/ # 中间件
│       └── config/  # 配置
├── docs/            # 文档
└── docker-compose.yml
```

## API 接口

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 项目
- `GET /api/projects` - 项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id` - 项目详情
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 更多接口见 docs/技术方案.md

## TODO

- [ ] AI API 集成方案 (GPT/Claude)
- [ ] 角色管理界面
- [ ] 章节编辑器
- [ ] 导出功能 (PDF/EPUB)
- [ ] 数据备份
