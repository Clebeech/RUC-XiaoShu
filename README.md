# 教务小数 RAG 项目

这是一个前后端分离的 RAG 应用：

- 前端：`Vite + React + shadcn/ui`
- 后端：`FastAPI`
- 当前能力：
  - 登录鉴权
  - 知识库文档上传与管理
  - 文档切块与简单向量检索
  - RAG 问答
  - 聊天记录持久化
  - 模型选择器真实生效（`qwen-max / qwen-plus / qwen-turbo`）

## 目录结构

- `src/`：前端源码
- `backend/`：FastAPI 后端
- `.env.example`：前端环境变量模板
- `backend/.env.example`：后端环境变量模板

## 运行前准备

请先确认本机有这些环境：

- Node.js 18+
- `pnpm`
- Python 3.10+

如果 `pnpm` 还没有安装，可以先执行：

```bash
npm install -g pnpm
```

## 1. 配置后端

进入后端目录：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend
```

创建虚拟环境并安装依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

复制环境变量模板：

```bash
cp .env.example .env
```

然后编辑 `backend/.env`，至少检查这几个字段：

```env
APP_NAME=RAG Backend
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=sqlite:///./rag_app.db
UPLOAD_DIR=./data/uploads
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change-me
DASHSCOPE_API_KEY=你的百炼API Key
DASHSCOPE_MODEL=qwen-max
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

其中最重要的是：

- `DASHSCOPE_API_KEY`
- `DEFAULT_ADMIN_PASSWORD`

如果不配置 `DASHSCOPE_API_KEY`，登录和文档管理仍然可用，但问答接口会返回模型未配置错误。

## 2. 启动后端

仍在 `backend/` 目录下执行：

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动成功后，默认地址是：

```text
http://127.0.0.1:8000
```

健康检查接口：

```text
http://127.0.0.1:8000/health
```

## 3. 配置前端

打开项目根目录：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui
```

复制前端环境变量模板：

```bash
cp .env.example .env
```

默认内容如下：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

如果你的后端不是跑在 `8000` 端口，请把这里改成对应地址。

安装前端依赖：

```bash
pnpm install
```

## 4. 启动前端

在项目根目录执行：

```bash
pnpm dev
```

默认访问地址一般是：

```text
http://localhost:5173
```

## 5. 登录系统

默认管理员账号：

- 用户名：`admin`
- 密码：`backend/.env` 中的 `DEFAULT_ADMIN_PASSWORD`

如果你没有改过，默认就是：

- 用户名：`admin`
- 密码：`change-me`

## 6. 正常使用流程

1. 先启动后端
2. 再启动前端
3. 打开前端页面并登录
4. 在“知识库管理”中上传 `txt / pdf / docx` 文档
5. 选择知识库
6. 选择模型：`qwen-max / qwen-plus / qwen-turbo`
7. 开始提问

## 常见问题

### 1. 登录成功但提问报错

大概率是后端没有配置：

- `DASHSCOPE_API_KEY`

或者后端没有启动。

### 2. 前端打不开接口

检查：

- 后端是否已经启动
- `VITE_API_BASE_URL` 是否正确
- `backend/.env` 里的 `FRONTEND_ORIGIN` 是否和前端地址一致

如果前端是 `http://localhost:5173`，那后端里一般也应该是：

```env
FRONTEND_ORIGIN=http://localhost:5173
```

### 3. 文档上传了但回答效果一般

这是正常的，因为当前项目里的向量化还是一个简化版实现，适合先跑通流程，不是最终生产方案。

后续可以升级为：

- 真正的 embedding 模型
- `pgvector` / Milvus / FAISS 等向量库
- 更稳定的分块策略

## 一键回顾

前后端分别运行：

后端：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui
pnpm dev
```
