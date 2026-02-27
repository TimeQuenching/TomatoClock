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
  
  // 获取当前窗口所在的显示器
  const currentDisplay = screen.getDisplayNearestPoint(win.getBounds());
  const { x: displayX, y: displayY, width: displayW, height: displayH } = currentDisplay.workArea;
  
  win.hide();

  if (isMini) {
    // 迷你模式：窗口尺寸与 UI 完全一致，不再需要鼠标穿透
    const miniW = 220; 
    const miniH = 60;
    win.setResizable(true); // 允许修改尺寸
    win.setSize(miniW, miniH);
    win.setResizable(false);
    // 停靠在当前显示器的右下角
    win.setPosition(displayX + displayW - miniW - 20, displayY + displayH - miniH - 20);
  } else {
    // 展开模式：窗口尺寸与 UI 完全一致
    const expandedW = 500;
    const expandedH = 500;
    win.setResizable(true);
    win.setSize(expandedW, expandedH);
    win.setResizable(false);
    // 停靠在当前显示器的右下角
    win.setPosition(displayX + displayW - expandedW - 40, displayY + displayH - expandedH - 40);
  }

  // 彻底关闭鼠标穿透，因为窗口现在和内容一样大，不会误挡
  win.setIgnoreMouseEvents(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
});

// 核心修复：高精度坐标同步拖拽（解决多屏 DPI 漂移）
let isDragging = false;
let mouseOffset = { x: 0, y: 0 };

ipcMain.on('window-drag-start', (event) => {
  const cursor = screen.getCursorScreenPoint();
  const winPos = win.getPosition();
  // 记录初始偏移（逻辑像素）
  mouseOffset = {
    x: cursor.x - winPos[0],
    y: cursor.y - winPos[1]
  };
  isDragging = true;
});

ipcMain.on('window-drag-move', (event) => {
  if (!isDragging || !win) return;
  const cursor = screen.getCursorScreenPoint();
  // 直接计算目标位置，不进行累加，防止误差累积
  const nextX = Math.round(cursor.x - mouseOffset.x);
  const nextY = Math.round(cursor.y - mouseOffset.y);
  win.setPosition(nextX, nextY);
});

ipcMain.on('window-drag-end', () => {
  isDragging = false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
