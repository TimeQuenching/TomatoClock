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
    // 迷你模式：UI 约 240x70，窗口 320x150
    const winW = 320; 
    const winH = 150;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    
    // 核心修复：确保 UI 实体向左挪动半个面板宽度，且不跨屏
    // 计算逻辑：屏幕起点 + 屏幕宽度 - 窗口宽度 - (半个面板宽120 + 边距20) + 窗口内补白40
    const x = dX + dW - winW - 100; 
    const y = dY + dH - winH - 10;
    win.setPosition(x, y);
  } else {
    // 展开模式：UI 500x500，窗口 600x600
    const winW = 600;
    const winH = 600;
    win.setResizable(true);
    win.setSize(winW, winH);
    win.setResizable(false);
    
    // 展开模式也向左挪动，确保不跨屏
    const x = dX + dW - winW - 50;
    const y = dY + dH - winH - 20;
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
