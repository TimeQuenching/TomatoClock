const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess;
let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const winWidth = 500;
  const winHeight = 500;

  win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 40,
    y: screenHeight - winHeight - 40,
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
  
  // 核心修复：获取当前窗口所在的显示器，解决多屏停靠偏移问题
  const currentDisplay = screen.getDisplayNearestPoint(win.getBounds());
  const { x: dX, y: dY, width: dW, height: dH } = currentDisplay.workArea;
  
  win.hide();

  if (isMini) {
    // 迷你模式：严格按照 UI 尺寸设置窗口 (220x60)
    const winW = 220; 
    const winH = 60;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    
    // 停靠在当前屏幕右下角，留出 20px 边距
    const x = dX + dW - winW - 20; 
    const y = dY + dH - winH - 20; 
    win.setPosition(x, y);
  } else {
    // 展开模式：严格按照 UI 尺寸设置窗口 (500x500)
    const winW = 500;
    const winH = 500;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    
    const x = dX + dW - winW - 40;
    const y = dY + dH - winH - 40;
    win.setPosition(x, y);
  }

  // 彻底关闭鼠标穿透，确保 CSS 拖拽 100% 可用
  win.setIgnoreMouseEvents(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
});

// 移除所有手动拖拽 IPC，回归 CSS 拖拽

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
