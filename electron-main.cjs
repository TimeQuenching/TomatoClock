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
    // 切换到迷你模式：缩小窗口并移动到右下角
    const miniSize = 250; 
    win.setSize(miniSize, miniSize);
    win.setPosition(screenWidth - miniSize - 20, screenHeight - miniSize - 20);
  } else {
    // 切换到展开模式：恢复大窗口
    const expandedSize = 650;
    win.setSize(expandedSize, expandedSize);
    win.setPosition(screenWidth - expandedSize - 20, screenHeight - expandedSize - 20);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
