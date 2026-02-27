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
  
  // 获取当前窗口所在的显示器，解决多屏切换消失的问题
  const currentDisplay = screen.getDisplayNearestPoint(win.getBounds());
  const { x: displayX, y: displayY, width: displayW, height: displayH } = currentDisplay.workArea;
  
  win.hide();

  if (isMini) {
    // 极致尺寸：刚好包裹小组件，不留任何透明区域挡住用户点击
    const miniW = 260; 
    const miniH = 80;
    win.setSize(miniW, miniH);
    // 停靠在当前显示器的右下角
    win.setPosition(displayX + displayW - miniW - 10, displayY + displayH - miniH - 10);
    // 迷你模式下禁用穿透检测，因为窗口已经足够小了
    win.setIgnoreMouseEvents(false);
  } else {
    const expandedSize = 650;
    win.setSize(expandedSize, expandedSize);
    // 停靠在当前显示器的右下角
    win.setPosition(displayX + displayW - expandedSize - 20, displayY + displayH - expandedSize - 20);
  }

  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
});

// 核心修复：使用 CSS 拖拽（业界最标准方案）
// 在渲染进程中使用 -webkit-app-region: drag
// 这里移除之前报错的原生接口调用
ipcMain.on('window-drag-fix', (event) => {
  // 仅作为占位，实际拖拽由 CSS 处理
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
