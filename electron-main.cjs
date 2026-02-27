const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 650, // 调大窗口，为阴影留空间
    height: 650,
    x: screenWidth - 670,
    y: screenHeight - 670,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false, // 禁用系统原生阴影，使用我们 CSS 写的漂亮阴影
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
