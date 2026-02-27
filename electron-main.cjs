const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { fork } = require('child_process');

// 禁用硬件加速以解决部分 Windows 上的透明窗口显示问题
app.disableHardwareAcceleration();

let serverProcess;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // 确保窗口不会超出屏幕边界
  const winWidth = 650;
  const winHeight = 650;
  const x = Math.max(0, screenWidth - winWidth - 20);
  const y = Math.max(0, screenHeight - winHeight - 20);

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false, // 先隐藏，加载成功后再显示
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
        console.log('页面加载成功');
        win.show();
        win.focus();
        // if (isDev) win.webContents.openDevTools({ mode: 'detach' });
      })
      .catch(() => {
        console.log('服务器尚未就绪，1秒后重试...');
        setTimeout(loadURL, 1000);
      });
  };

  setTimeout(loadURL, 1000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
