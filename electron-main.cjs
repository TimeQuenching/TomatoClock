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
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  win.hide();

  if (isMini) {
    // 极致尺寸：刚好包裹小组件，不留任何透明区域挡住用户点击
    const miniW = 260; 
    const miniH = 80;
    win.setSize(miniW, miniH);
    win.setPosition(screenWidth - miniW - 10, screenHeight - miniH - 10);
    // 迷你模式下禁用穿透检测，因为窗口已经足够小了
    win.setIgnoreMouseEvents(false);
  } else {
    const expandedSize = 650;
    win.setSize(expandedSize, expandedSize);
    win.setPosition(screenWidth - expandedSize - 20, screenHeight - expandedSize - 20);
  }

  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
});

// 核心修复：原生轮询拖拽（引入 DPI 补偿，彻底解决漂移）
let dragTimer = null;
let startMousePos = { x: 0, y: 0 };
let startWinPos = [0, 0];

ipcMain.on('window-drag-start', () => {
  if (!win) return;
  
  startMousePos = screen.getCursorScreenPoint();
  startWinPos = win.getPosition();

  if (dragTimer) clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const currentMouse = screen.getCursorScreenPoint();
    
    // 终极修复：使用 Math.round 确保逻辑像素对齐，并使用 setBounds 替代 setPosition
    const nextX = Math.round(startWinPos[0] + (currentMouse.x - startMousePos.x));
    const nextY = Math.round(startWinPos[1] + (currentMouse.y - startMousePos.y));
    
    const [width, height] = win.getSize();
    win.setBounds({
      x: nextX,
      y: nextY,
      width: width,
      height: height
    });
  }, 10);
});

ipcMain.on('window-drag-end', () => {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
