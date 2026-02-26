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
  
  // 在生产环境下，我们需要运行编译后的服务器代码或通过 tsx 运行
  // 这里假设用户本地有 tsx 环境
  serverProcess = fork(path.join(__dirname, 'server.ts'), [], {
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    execArgv: ['--import', 'tsx']
  });

  // 等待服务器启动后加载页面
  setTimeout(() => {
    if (isDev) {
      win.loadURL('http://localhost:3000');
    } else {
      // 生产环境也指向本地服务器，因为我们需要数据库 API
      win.loadURL('http://localhost:3000');
    }
  }, 2000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
