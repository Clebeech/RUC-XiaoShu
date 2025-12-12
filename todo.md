# Qwen RAG系统 MVP开发计划

## 核心功能
1. 左侧导航栏 - 包含个人中心、作业管理、成绩概览、AI助手等菜单项
2. 顶部工具栏 - 知识库选择器、模型选择器、设置按钮
3. 主聊天界面 - 消息列表和输入框
4. Qwen API集成 - 处理AI对话请求

## 文件结构
1. `src/components/Sidebar.tsx` - 左侧导航栏组件
2. `src/components/TopBar.tsx` - 顶部工具栏组件  
3. `src/components/ChatArea.tsx` - 主聊天区域组件
4. `src/components/MessageList.tsx` - 消息列表组件
5. `src/components/MessageInput.tsx` - 消息输入组件
6. `src/lib/qwen-api.ts` - Qwen API客户端
7. `src/pages/Index.tsx` - 主页面（重写）
8. `src/types/chat.ts` - 聊天相关类型定义

## 实现策略
- 使用深色主题匹配原界面风格
- 响应式设计，支持移动端
- 简化版本，专注核心聊天功能
- 使用localStorage存储聊天历史