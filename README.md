# ggdRecorder 鹅鸭杀游戏录制助手

一款基于 React + Electron + TypeScript 的桌面应用，专为鹅鸭杀（Goose Goose Duck）对局录制与复盘设计。

## 功能特性

### 录制
- 自动检测运行中的游戏进程（GGD 自动置顶）
- `getDisplayMedia` 高画质录制（支持 60fps + 音频）
- 暂停/继续录制
- 可选 ffmpeg 自动压缩
- 可自定义录像保存路径
- 快捷键：`Ctrl+Shift+S` 开始 / `Ctrl+Shift+D` 停止

### 录像管理
- 录像列表 + 缩略图 + 分页（惰性加载缩略图）
- 内嵌视频播放器（自定义 `recording://` 流式协议，支持进度拖拽）
- 日期筛选 / 收藏筛选 / 批量删除
- 收藏分组（精彩局 / 需要复盘 / 搞笑局…）
- 手动复盘备注（每局可记录思路与操作）
- AI 视频分析（Google Gemini API，自动生成行动轨迹 + 会议发言稿）
- 收藏录像另存到指定目录

### 战绩查询
- 通过 User ID 拉取 `gaggle.fun` 对局历史
- 玩家统计卡片（胜率 / 投票准确率 / 存活回合 / 击杀）
- 角色分布（鹅/鸭/中立）
- 单局详情（玩家列表、回合信息、投票详情）
- 自动适配 SOCKS5 / HTTP 代理

### 地图辅助工具
- 13 张内置地图
- 数字标记（拖拽放置 + 移动）
- 连线绘制（右键连线 + 悬停删除）
- 角色身份设置（好鹅/中立/坏鹅 + 颜色区分）
- 轮次管理（多轮独立标记）
- 标记删除区（拖至右上角删除）
- 全部状态跨 tab 保持（不丢失）

### 设置
- 录像保存路径选择
- 视频压缩开关
- 游戏程序路径 + 一键启动
- Google Gemini API Key 管理
- GGD Token 管理

## 技术架构

```
src/
├── main/          # 主进程 (TypeScript, tsc → dist-main/)
│   ├── index.ts          # 入口
│   ├── window.ts         # 窗口 / 托盘 / 权限
│   ├── protocol.ts       # app:// + recording:// 协议
│   ├── config.ts         # 配置 / 收藏 持久化
│   ├── utils.ts          # 工具函数
│   ├── logger.ts         # Winston 日志
│   ├── ipc-recording.ts  # 录制相关 IPC
│   ├── ipc-favorites.ts  # 收藏/备注/分组 IPC
│   ├── ipc-config.ts     # 设置页面 IPC
│   ├── ipc-window.ts     # 窗口控制 IPC
│   ├── ipc-misc.ts       # 进程 / 日志 IPC
│   ├── ipc-stats.ts      # 战绩查询 IPC
│   └── services/
│       ├── ffmpeg.ts     # 视频压缩 + 缩略图
│       └── gemini.ts     # Gemini AI 分析
├── preload/
│   └── index.ts          # contextBridge 桥接
├── renderer/     # React 前端 (Vite → dist/)
│   ├── main.tsx
│   ├── App.tsx + App.css
│   ├── index.html
│   ├── components/       # 7 个 TSX 组件
│   ├── utils/            # logger + IPC 守卫
│   ├── types/            # 类型声明
│   └── public/img/       # 13 张地图图片
└── shared/
    └── types.ts          # main + renderer 共享类型
```

### 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + Electron 39 |
| 语言 | TypeScript（全部 Renderer + Main + Preload） |
| 构建 | Vite（Renderer）+ tsc（Main/Preload） |
| 录制 | `navigator.mediaDevices.getDisplayMedia()` |
| 流式播放 | 自定义 `recording://` 协议 + `Readable.toWeb()` |
| 日志 | Winston + DailyRotateFile |
| AI 分析 | Google Gemini API（@google/genai） |
| 打包 | Electron Forge + Electron Builder |

## 开始使用

```bash
# 安装依赖
npm install

# 开发模式（同时启动 Vite + Electron）
npm run dev-electron

# 生产构建
npm run build

# 打包分发
npm run dist:win     # Windows NSIS 安装包
npm run dist:linux   # Linux .deb
```

## 前提条件

- **Node.js** 18+
- **ffmpeg**（可选，用于视频压缩和缩略图生成）
- **Google Gemini API Key**（可选，用于 AI 分析）
- 部分地区使用 Gemini 可能需要配置代理（修改 `.env` 中的 `https_proxy`）

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Shift+S` | 开始录制 |
| `Ctrl+Shift+D` | 停止录制 |
| `Ctrl+Shift+I` / `F12` | 打开 DevTools |

## 关于

项目地址：[G-TT219/ggdRecorder](https://github.com/G-TT219/ggdRecorder)
