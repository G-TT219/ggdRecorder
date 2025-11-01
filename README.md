# Game Process Recorder

A desktop application built with React and Electron that monitors game processes and records gameplay footage.

## Features

- Monitor running game processes
- Select a game to record
- Start/stop recording of game windows
- View recorded videos

## Installation

Since we had some issues with package installation, here's how to set up the project manually:

1. Make sure you have Node.js installed
2. Install the required packages:
   ```
   npm install electron react react-dom
   npm install -D vite @vitejs/plugin-react
   ```

## Development

To run the application in development mode:

1. Start the Vite development server:
   ```
   npm run dev
   ```

2. In another terminal, start the Electron app:
   ```
   npm start
   ```

## Building

To build the application for production:
```
npm run build
```

## How It Works

The application consists of two main parts:

1. **Electron Main Process** ([electron-main.js](electron-main.js)): Handles system-level operations like:
   - Monitoring running processes
   - Screen recording functionality
   - Window management

2. **React Renderer Process** ([src/App.jsx](src/App.jsx)): Provides the user interface for:
   - Displaying running games
   - Controlling recording sessions
   - Viewing recorded videos

Communication between the main and renderer processes is handled through the [preload.js](preload.js) script using Electron's contextBridge for security.

## Current Limitations

This is a basic implementation that demonstrates the concept. In a production environment, you would need to:

1. Implement actual game process detection using libraries like `ps-list` or native Node.js modules
2. Add real screen recording functionality using libraries like `fluent-ffmpeg` or Electron's desktopCapturer
3. Implement proper video storage and playback
4. Add error handling and user feedback mechanisms
5. Improve UI/UX design

## Future Enhancements

- Auto-detect popular games
- Record audio along with video
- Add recording settings (quality, format, etc.)
- Implement video trimming and editing features
- Add cloud storage integration
- Create a timeline view for recordings