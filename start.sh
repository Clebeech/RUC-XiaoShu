#!/bin/bash

# RAG项目快速启动脚本

echo "🚀 启动RAG项目..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装Node.js，请先安装Node.js 18+"
    exit 1
fi

# 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  未检测到pnpm，正在安装..."
    npm install -g pnpm@8.10.0
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    pnpm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已存在"
fi

# 启动开发服务器
echo "🎉 启动开发服务器..."
echo "📍 项目将在 http://localhost:5173 运行"
echo ""
pnpm run dev

