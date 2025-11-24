# ggdRecorder 游戏录制助手

一款基于 React 和 Electron 构建的桌面应用程序，用于监控游戏进程并录制游戏画面。

## 功能特性

- 监控正在运行的游戏进程
- 选择要录制的游戏
- 开始/停止录制游戏窗口
- 查看和回放录制的视频
- 视频压缩功能以节省存储空间
- 可自定义录像保存路径
- 内置娱乐浏览器
- 支持打开指定游戏程序

## 技术架构

该项目使用以下技术栈：

- 前端框架：React
- 桌面应用框架：Electron
- 构建工具：Vite
- 日志系统：Winston
- 进程监控：ps-list

## 安装依赖

确保您已安装 Node.js，然后安装所需依赖：

```
npm install
```

## 开发模式

有两种方式可以在开发模式下运行应用程序：

### 方法一：分别启动

1. 启动 Vite 开发服务器：
   ```
   npm run dev
   ```

2. 在另一个终端中启动 Electron 应用：
   ```
   npm start
   ```

### 方法二：同时启动（推荐）

```
npm run dev-electron
```

此命令会同时启动 Vite 开发服务器和 Electron 应用。

## 构建和打包

### 构建前端资源

```
npm run build
```

### 使用 Electron Forge 打包

```
npm run make
```

### 使用 Electron Builder 打包

1. 打包应用目录：
   ```
   npm run pack-app
   ```

2. 生成完整的分发版本：
   ```
   npm run dist
   ```

3. 仅构建 Windows 平台安装程序：
   ```
   npm run dist:win
   ```

4. 仅构建 Linux 平台 .deb 包：
   ```
   npm run dist:linux
   ```

## 应用结构

该应用程序由两个主要部分组成：

1. **Electron 主进程** ([electron-main.js](electron-main.js))：处理系统级操作，例如：
   - 监控运行中的进程
   - 屏幕录制功能
   - 窗口管理
   - 文件系统操作
   - 应用配置管理

2. **React 渲染进程** ([src/App.jsx](src/App.jsx))：提供用户界面：
   - 显示运行中的游戏
   - 控制录制会话
   - 查看录制的视频
   - 应用设置管理
   - 娱乐浏览功能

主进程和渲染进程之间的通信通过 [preload.js](preload.js) 脚本使用 Electron 的 contextBridge 进行安全处理。

## 使用说明

1. 在"游戏录制"选项卡中，应用会自动检测正在运行的游戏进程
2. 从列表中选择要录制的游戏
3. 点击"开始录制"按钮开始录制
4. 点击"停止录制"按钮结束录制
5. 在"录像回放"选项卡中查看和管理录制的视频
6. 在"设置"选项卡中配置录像保存路径和视频压缩选项
7. 在"娱乐"选项卡中可以浏览网页

## 注意事项

- 应用需要访问屏幕录制权限
- 视频压缩功能需要系统中安装 ffmpeg
- 录制的视频默认保存在系统的 Videos/GameRecorder 目录中
- 应用支持 Windows 和 Linux 平台