const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 500,
    height: 500,
    x: screenWidth - 520,
    y: screenHeight - 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 启动后端服务器
  const isDev = process.env.NODE_ENV === 'development';
  
  serverProcess = fork(path.join(__dirname, 'server.ts'), [], {
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    execArgv: ['--import', 'tsx']
  });

  // 循环尝试加载页面，直到服务器就绪
  const loadURL = () => {
    win.loadURL('http://localhost:3000').catch(() => {
      console.log('服务器尚未就绪，1秒后重试...');
      setTimeout(loadURL, 1000);
    });
  };

  // 初始延迟 1 秒后开始尝试
  setTimeout(loadURL, 1000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
