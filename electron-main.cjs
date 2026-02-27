const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess;
let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const winWidth = 650;
  const winHeight = 650;

  win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 20,
    y: screenHeight - winHeight - 20,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    show: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  serverProcess = fork(path.join(__dirname, 'server.ts'), [], {
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    execArgv: ['--import', 'tsx']
  });

  const loadURL = () => {
    win.loadURL('http://localhost:3000')
      .then(() => {
        console.log('Success: Page Loaded');
      })
      .catch(() => {
        console.log('Retrying connection to server...');
        setTimeout(loadURL, 1000);
      });
  };

  setTimeout(loadURL, 3000);
}

// 监听来自渲染进程的状态切换请求
ipcMain.on('toggle-mini', (event, isMini) => {
  if (!win) return;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  if (isMini) {
    // 迷你模式：小而精，居中对齐内容
    const miniW = 300; 
    const miniH = 120;
    win.setSize(miniW, miniH);
    // 移动到右下角，留出 20px 边距
    win.setPosition(screenWidth - miniW - 20, screenHeight - miniH - 20);
  } else {
    // 展开模式：大窗口
    const expandedSize = 650;
    win.setSize(expandedSize, expandedSize);
    // 移动到右下角
    win.setPosition(screenWidth - expandedSize - 20, screenHeight - expandedSize - 20);
  }
});

// 原生拖拽实现：解决 CSS 拖拽在 Windows 上的各种玄学问题
let isDragging = false;
let mouseOffset = { x: 0, y: 0 };

ipcMain.on('window-drag-start', (event, { x, y }) => {
  isDragging = true;
  mouseOffset = { x, y };
});

ipcMain.on('window-drag-move', (event, { screenX, screenY }) => {
  if (isDragging && win) {
    win.setPosition(screenX - mouseOffset.x, screenY - mouseOffset.y);
  }
});

ipcMain.on('window-drag-end', () => {
  isDragging = false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
