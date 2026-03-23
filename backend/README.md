# Backend

这个目录提供了一个最小可运行的 `FastAPI` 后端，用来接住当前前端缺失的服务端能力：

- 登录和会话 token
- 知识库与文档持久化
- 文档解析、切块、向量化
- RAG 检索与大模型代理调用
- 聊天记录持久化

## Quick Start

1. 创建虚拟环境并安装依赖

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. 配置环境变量

```bash
cp .env.example .env
```

至少补上：

- `DEFAULT_ADMIN_PASSWORD`
- `DASHSCOPE_API_KEY`

3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Default Account

- 用户名：`admin`
- 密码：来自 `.env` 中的 `DEFAULT_ADMIN_PASSWORD`

## API Overview

- `GET /health`
- `POST /api/auth/login`
- `GET /api/knowledge-bases`
- `POST /api/knowledge-bases`
- `GET /api/knowledge-bases/{knowledge_base_name}/documents`
- `POST /api/knowledge-bases/{knowledge_base_name}/documents`
- `POST /api/chat/query`
- `GET /api/chats`

## Notes

- 默认数据库是本地 `sqlite`，方便先跑通 MVP。
- 向量检索目前使用服务端内置的轻量向量器，后续可以替换成 DashScope embedding、OpenAI embedding 或 `pgvector`。
- 当前默认已经支持通过 DashScope `text-embedding-v4` 生成真实 embedding。
- 前端接入时，建议把所有模型调用都改成请求这个后端，不再直连大模型服务。
