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
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // 切换前先隐藏，避免闪烁和定位错误
  win.hide();

  if (isMini) {
    const miniW = 350; 
    const miniH = 150;
    win.setSize(miniW, miniH);
    win.setPosition(screenWidth - miniW - 20, screenHeight - miniH - 20);
  } else {
    const expandedSize = 650;
    win.setSize(expandedSize, expandedSize);
    win.setPosition(screenWidth - expandedSize - 20, screenHeight - expandedSize - 20);
  }

  // 确保窗口在最顶层
  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
});

// 改进的无漂移拖拽逻辑
let startWinPos = [0, 0];
let startMousePos = { x: 0, y: 0 };

ipcMain.on('window-drag-start', (event) => {
  if (!win) return;
  startWinPos = win.getPosition();
  startMousePos = screen.getCursorScreenPoint();
});

ipcMain.on('window-drag-move', (event) => {
  if (win) {
    const currentMousePos = screen.getCursorScreenPoint();
    const dx = currentMousePos.x - startMousePos.x;
    const dy = currentMousePos.y - startMousePos.y;
    
    win.setPosition(
      Math.floor(startWinPos[0] + dx),
      Math.floor(startWinPos[1] + dy)
    );
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
