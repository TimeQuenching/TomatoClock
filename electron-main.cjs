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

// 核心修复：物理像素级无漂移拖拽
let dragTimer = null;
let startMousePosPhys = { x: 0, y: 0 };
let startWinPosPhys = { x: 0, y: 0 };

ipcMain.on('window-drag-start', () => {
  if (!win) return;
  
  const dipMousePos = screen.getCursorScreenPoint();
  const dipWinPos = win.getPosition();
  
  // 将逻辑坐标 (DIP) 转换为物理像素坐标，彻底消除缩放误差
  startMousePosPhys = screen.dipToScreenPoint(dipMousePos);
  startWinPosPhys = screen.dipToScreenPoint({ x: dipWinPos[0], y: dipWinPos[1] });

  if (dragTimer) clearInterval(dragTimer);
  
  dragTimer = setInterval(() => {
    const currentDipMouse = screen.getCursorScreenPoint();
    const currentPhysMouse = screen.dipToScreenPoint(currentDipMouse);
    
    // 在物理像素层面计算位移
    const dx = currentPhysMouse.x - startMousePosPhys.x;
    const dy = currentPhysMouse.y - startMousePosPhys.y;
    
    // 计算新的物理位置并转回逻辑坐标给 Electron 使用
    const nextPhysPos = {
      x: startWinPosPhys.x + dx,
      y: startWinPosPhys.y + dy
    };
    
    const nextDipPos = screen.screenToDipPoint(nextPhysPos);
    
    // 显式设置，不使用 setBounds 以减少系统重绘干扰
    win.setPosition(Math.round(nextDipPos.x), Math.round(nextDipPos.y));
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
