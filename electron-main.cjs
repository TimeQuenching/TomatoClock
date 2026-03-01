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
    hasShadow: false, // 禁用原生阴影，防止坐标计算偏移
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 核心修复：鼠标穿透逻辑
  // 当鼠标在透明区域时，允许点击穿透到下层窗口
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setIgnoreMouseEvents(ignore, options);
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
    // 迷你模式：增加缓冲区给阴影空间 (UI 约 240x70)
    const winW = 320; 
    const winH = 150;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    // 补偿缓冲区，确保视觉上的右下角位置不变
    win.setPosition(dX + dW - winW + 20, dY + dH - winH + 20);
  } else {
    // 展开模式：增加缓冲区 (UI 500x500)
    const winW = 600;
    const winH = 600;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    // 补偿缓冲区
    win.setPosition(dX + dW - winW + 20, dY + dH - winH + 20);
  }

  // 彻底禁用鼠标穿透，因为窗口现在和内容一样大，不会误挡
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
