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
    // 迷你模式：窗口尺寸与 UI 严格一致
    const miniW = 240; 
    const miniH = 70;
    win.setResizable(true);
    win.setSize(miniW, miniH);
    win.setResizable(false);
    // 停靠在当前屏幕右下角
    win.setPosition(dX + dW - miniW - 20, dY + dH - miniH - 20);
  } else {
    // 展开模式
    const expW = 500;
    const expH = 500;
    win.setResizable(true);
    win.setSize(expW, expH);
    win.setResizable(false);
    // 停靠在当前屏幕右下角
    win.setPosition(dX + dW - expW - 40, dY + dH - expH - 40);
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
