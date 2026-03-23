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
DASHSCOPE_MULTIMODAL_MODEL=qwen3.5-plus
DASHSCOPE_AUDIO_MODEL=qwen3-omni-flash
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4
DASHSCOPE_EMBEDDING_DIMENSIONS=1024
DASHSCOPE_EMBEDDING_URL=https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding
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

你也可以在输入框左侧使用：

- 图片按钮：上传图片并直接发起图片问答
- 语音按钮：上传音频后自动转写到输入框

## 7. 关于 Reindex

当前项目已经切换到真正的 Qwen embedding 检索。

这意味着：

- 新上传的文档会自动使用新的 embedding 入库
- 旧文档如果是在升级前上传的，数据库里保存的还是旧向量
- 所以旧文档需要执行一次 `reindex`

你可以把 `reindex` 理解为：

- 不重新上传文件
- 直接把数据库里已有文档重新切块并重新生成 embedding

### 什么时候需要 Reindex

以下情况建议执行一次：

- 你在升级到新版 RAG 之前已经上传过文档
- 你发现明明文档里有内容，但检索总是命不中
- 你刚修改了 embedding 模型或 embedding 维度

### 注意

这里需要的是“系统登录 token”，不是 DashScope API Key。

错误示例：

```bash
Authorization: Bearer sk-xxxx
```

这里的 `sk-xxxx` 是百炼 API Key，不能拿来调用业务接口。

### 第一步：先登录拿 token

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'
```

如果你已经把管理员密码改成别的，比如 `123456`，就把上面的密码替换掉。

成功后会返回类似：

```json
{
  "token": "你的登录token",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 第二步：对某个知识库执行 Reindex

例如对 `education` 知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/education/reindex \
  -H "Authorization: Bearer 你的登录token"
```

成功后会返回类似：

```json
{
  "status": "ok",
  "reindexed_documents": 3
}
```

### 一条命令完成登录并重建

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

curl -X POST http://127.0.0.1:8000/api/knowledge-bases/education/reindex \
  -H "Authorization: Bearer $TOKEN"
```

### 三个默认知识库的 Reindex 命令

教务知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/education/reindex \
  -H "Authorization: Bearer 你的登录token"
```

课程知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/course/reindex \
  -H "Authorization: Bearer 你的登录token"
```

通用知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/general/reindex \
  -H "Authorization: Bearer 你的登录token"
```

## 8. 批量导入本地 Markdown / TXT / Word

如果你已经把 PDF 转成了 Markdown，或者手里已经有整理好的 `txt / doc / docx`，可以直接批量入库，不必从前端一个个上传。

默认脚本位置：

```text
backend/scripts/import_local_documents.py
```

这个脚本会做这些事情：

- 递归扫描目录下的 `md / txt / doc / docx`
- 调用后端现有的文本抽取与切块逻辑
- 使用当前配置的 Qwen embedding 自动向量化
- 把文档和 chunk 写入指定知识库

### 先确认后端环境变量

进入后端目录并激活虚拟环境：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend
source .venv/bin/activate
```

确保 `backend/.env` 里已经配置了可用的：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_EMBEDDING_MODEL`

### 例子 1：把 `data_normalized` 全部导入教务知识库

在项目根目录执行：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui
backend/.venv/bin/python backend/scripts/import_local_documents.py \
  --input-dir data_normalized \
  --knowledge-base education \
  --skip-existing
```

### 例子 2：只导入 Markdown

```bash
backend/.venv/bin/python backend/scripts/import_local_documents.py \
  --input-dir data_normalized/pdf_markdown \
  --knowledge-base education \
  --extensions md \
  --skip-existing
```

### 例子 3：先试跑前 3 个文件

```bash
backend/.venv/bin/python backend/scripts/import_local_documents.py \
  --input-dir data_normalized/pdf_markdown \
  --knowledge-base education \
  --extensions md \
  --limit 3
```

### 例子 4：只看会导入哪些文件，不真正写入

```bash
backend/.venv/bin/python backend/scripts/import_local_documents.py \
  --input-dir data_normalized \
  --knowledge-base education \
  --dry-run
```

### 导入后的表现

脚本会把文档名保存为相对路径，例如：

```text
2022级培养方案/2022数学与应用数学专业培养方案/2022数学与应用数学专业培养方案/auto/2022数学与应用数学专业培养方案.md
```

这样后面在引用和排错时，能看出文档原本来自哪个目录。

如果同一路径的文档已经存在：

- 加 `--skip-existing`：直接跳过
- 不加 `--skip-existing`：会先删掉旧记录，再重新入库

### 什么时候还需要 Reindex

这个批量导入脚本本身就会自动重新切块并生成最新 embedding，所以：

- 新导入的文档不需要额外 reindex
- 只有老文档或者你修改了 embedding 配置之后，才需要重新执行 `reindex`

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/education/reindex \
  -H "Authorization: Bearer $TOKEN"
```

课程知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/course/reindex \
  -H "Authorization: Bearer $TOKEN"
```

通用知识库：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/general/reindex \
  -H "Authorization: Bearer $TOKEN"
```

### 不想 Reindex 也可以

如果文档不多，你也可以：

1. 在前端删除旧文档
2. 重新上传

效果等价于重新入库，也会自动使用新的 embedding。

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

如果你是旧版本升级过来的，先确认是否执行过 `reindex`。

另外，即使现在已经换成了真实 embedding，以下情况仍可能影响效果：

后续可以升级为：

- `pgvector` / Milvus / FAISS 等向量库
- 更稳定的分块策略
- OCR 和更强的 PDF 解析

### 4. 后端报错 `No module named pydantic_settings`

说明你启动后端时没有使用项目自己的虚拟环境，而是用了系统 Python 或 Anaconda Python。

请进入后端目录后执行：

```bash
cd /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

你也可以检查当前解释器是否正确：

```bash
which python
which uvicorn
```

它们应当指向：

```text
/Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend/.venv/bin/python
/Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend/.venv/bin/uvicorn
```

## 服务器部署

当前项目已经适合按“`Nginx + systemd` 单机部署”方式上云。推荐先用公网 IP 跑通，再决定是否接域名和 HTTPS。

### 部署目标

- 前端：构建为静态文件，由 `Nginx` 托管
- 后端：`FastAPI + uvicorn` 常驻运行，由 `Nginx` 反代到 `/api`
- 数据：保留现有 `backend/rag_app.db` 与 `backend/data/uploads`

### 目录建议

推荐把仓库部署到：

```text
/srv/rag-assistant
```

后文默认都按这个路径举例。

### 1. 服务器安装依赖

假设服务器是 `Ubuntu / Debian`，并且你有 `sudo`：

```bash
sudo apt update
sudo apt install -y nginx python3 python3-venv python3-pip nodejs npm
sudo npm install -g pnpm
```

### 2. 拉代码到服务器

```bash
sudo mkdir -p /srv/rag-assistant
sudo chown -R $USER:$USER /srv/rag-assistant
git clone <你的仓库地址> /srv/rag-assistant
cd /srv/rag-assistant
```

如果仓库已经在服务器上，只需要：

```bash
cd /srv/rag-assistant
git pull
```

### 3. 配置生产环境变量

前端生产环境：

```bash
cp .env.production.example .env.production
```

默认内容是：

```env
VITE_API_BASE_URL=
```

这里故意留空，表示前端直接请求同域下的 `/api/...` 路径。
不要写成 `/api`，否则会把登录等请求拼成 `/api/api/...`，导致页面提示 `Not Found`。

后端生产环境：

```bash
cp backend/.env.production.example backend/.env
```

然后编辑 `backend/.env`，至少补上：

- `DEFAULT_ADMIN_PASSWORD`
- `DASHSCOPE_API_KEY`

推荐确认这些字段：

```env
APP_ENV=production
APP_HOST=127.0.0.1
APP_PORT=8000
FRONTEND_ORIGIN=http://47.99.40.20
DATABASE_URL=sqlite:///./rag_app.db
UPLOAD_DIR=./data/uploads
```

### 4. 安装依赖并构建

前端：

```bash
cd /srv/rag-assistant
pnpm install
pnpm build
```

后端：

```bash
cd /srv/rag-assistant/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 5. 迁移现有数据

如果你要保留当前知识库和聊天记录，需要把本机这两部分拷到服务器：

- `backend/rag_app.db`
- `backend/data/uploads/`

在本机执行示例：

```bash
scp /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend/rag_app.db \
  tigerxu_alphapy:/srv/rag-assistant/backend/
```

```bash
rsync -avz /Users/tigerxu/Desktop/RUC/活动/第二次大创/rag_proj/workspace/shadcn-ui/backend/data/uploads/ \
  tigerxu_alphapy:/srv/rag-assistant/backend/data/uploads/
```

不建议迁移这些开发材料：

- `data_prepared/`
- `data_normalized/`
- `data_processed/`
- 本地测试数据库

### 6. 配置 systemd

仓库里已经提供了服务示例文件：

```text
deploy/rag-backend.service.example
```

复制到系统目录：

```bash
sudo cp /srv/rag-assistant/deploy/rag-backend.service.example /etc/systemd/system/rag-backend.service
```

如果服务器用户名不是 `tigerxu`，请先编辑其中的：

- `User`
- `Group`
- `WorkingDirectory`
- `EnvironmentFile`
- `ExecStart`

然后启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable rag-backend
sudo systemctl start rag-backend
```

检查状态：

```bash
sudo systemctl status rag-backend
curl http://127.0.0.1:8000/health
```

### 7. 配置 Nginx

仓库里已经提供了站点示例：

```text
deploy/nginx.rag-assistant.conf.example
```

复制并启用：

```bash
sudo cp /srv/rag-assistant/deploy/nginx.rag-assistant.conf.example /etc/nginx/sites-available/rag-assistant
sudo ln -sf /etc/nginx/sites-available/rag-assistant /etc/nginx/sites-enabled/rag-assistant
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

这份配置已经包含：

- 前端静态文件目录：`/srv/rag-assistant/dist`
- React Router 刷新兜底：`try_files ... /index.html`
- `/api/` 反代到 `127.0.0.1:8000`
- `/health` 直接反代后端健康检查
- 上传和多模态接口所需的 `25m` 请求体限制

### 8. 首次上线检查

建议按这个顺序验证：

1. `curl http://127.0.0.1:8000/health`
2. `curl http://47.99.40.20/health`
3. 浏览器访问 `http://47.99.40.20`
4. 管理员登录成功
5. 已有知识库文档数量正常
6. 文本提问可返回参考文献
7. 图片提问可走 OCR + RAG
8. `/admin/feedback` 看板能打开

如果迁移的是旧版本向量数据，建议上线后对目标知识库执行一次 `reindex`。

### 9. 常见部署排查

#### 前端打开了，但接口 404 或跨域

检查：

- 前端是否使用了 `.env.production`
- `VITE_API_BASE_URL` 是否为 `/api`
- `backend/.env` 里的 `FRONTEND_ORIGIN` 是否为 `http://47.99.40.20`
- `nginx` 是否启用了 `/api/` 反代

#### `systemctl status rag-backend` 启动失败

检查：

- `/srv/rag-assistant/backend/.venv` 是否存在
- `backend/.env` 是否已配置
- `ExecStart` 是否指向虚拟环境内的 `uvicorn`
- 日志可用：

```bash
sudo journalctl -u rag-backend -n 100 --no-pager
```

#### 页面能打开，但知识库是空的

检查：

- `backend/rag_app.db` 是否已经迁过去
- `backend/data/uploads/` 是否完整迁移
- 数据库文件权限是否允许当前服务用户读取

#### 迁移后命中率变差

如果你近期改过 embedding 模型、分块逻辑或文档规范化流程，建议重新执行：

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-bases/education/reindex \
  -H "Authorization: Bearer 你的登录token"
```

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
