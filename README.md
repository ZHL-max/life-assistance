# 日常生活助手 (Life Assistant)

北航 (BUAA) 学生日常生活助手 — React + Vite 单页应用，支持 PWA 安装。

## 功能

- 📋 **每日任务** — 按日期管理任务，支持每日重复、置顶、搜索
- 🎯 **长期目标** — DDL 管理、进度追踪、文件附件
- 📅 **日历视图** — 月度日历，展示任务和课程事件
- 🏫 **课程表** — 从北航教务系统同步，按周展示
- 🔐 **密码库** — AES-GCM 256 加密，纯本地存储
- ⚙️ **设置** — 昵称、登出

## 快速开始

```bash
# 安装依赖
npm install

# 同时启动前端 + 后端
npm run dev:all
```

前端运行在 `http://localhost:5173`，后端 Connector 运行在 `http://127.0.0.1:8787`。

## 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 前端开发服务器 (port 5173) |
| `npm run connector` | 启动后端 Connector 服务器 (port 8787) |
| `npm run dev:all` | 同时启动前端和后端 |
| `npm run build` | 构建生产版本 |
| `npm run lint` | ESLint 检查 |
| `npm run preview` | 预览生产构建 |

## 技术栈

- **前端**: React 19 + Vite 8, Vanilla CSS
- **后端**: 原生 Node.js HTTP 服务器
- **认证**: 北航 SSO 统一认证
- **加密**: Web Crypto API (PBKDF2 + AES-GCM)
- **数据**: 服务端 JSON 文件存储 + 客户端 localStorage 降级
