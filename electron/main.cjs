const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');

let mainWindow = null;
const SERVER_PORT = 3000;

// كنترول+R: العملية الرئيسية بتفضل شغالة والصفحة بس اللي بتعيد التحميل.
// العلامة بتقول للفرونت «دي أول تحميلة بعد تشغيل البرنامج» — أول استدعاء يرجع true
// وبعدها false، يعني أي إعادة تحميل جوه نفس التشغيلة ترجع false (نرجّع المستخدم).
let freshStart = true;

// سجل أعطال على القرص — أي اختفاء/كراش بعد كده هيسيب أثر نعرف منه السبب
function logPath() {
  try { return path.join(app.getPath('userData'), 'captain-crash.log'); }
  catch { return path.join(process.cwd(), 'captain-crash.log'); }
}
function logCrash(tag, info) {
  try {
    const line = `[${new Date().toISOString()}] ${tag}: ${String((info && info.message) || info || '')}\n`;
    fs.appendFileSync(logPath(), line);
  } catch {}
}
process.on('uncaughtException', (err) => {
  logCrash('uncaughtException', err && err.stack || err);
  try { dialog.showErrorBox('حدث خطأ غير متوقع', `تم تسجيل الخطأ في:\n${logPath()}\n\nأعد فتح البرنامج، ولو تكرر أرسل ملف السجل.`); } catch {}
  app.quit();
});
process.on('unhandledRejection', (reason) => {
  logCrash('unhandledRejection', reason && reason.stack || reason);
});
app.on('render-process-gone', (_e, _wc, details) => {
  logCrash('render-process-gone', JSON.stringify(details));
});
app.on('child-process-gone', (_e, details) => {
  logCrash('child-process-gone', JSON.stringify(details));
});

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '127.0.0.1');
  });
}

function waitForServer(url, retries = 30) {
  return new Promise((resolve) => {
    const check = (n) => {
      http.get(url, (res) => { res.resume(); resolve(true); })
        .on('error', () => {
          if (n <= 0) return resolve(false);
          setTimeout(() => check(n - 1), 500);
        });
    };
    check(retries);
  });
}

function ensureRuntimeFiles(projectDir) {
  // في النسخة المجمّعة: حدّث ملفات التشغيل (dist/public) في كل تشغيل
  // — ما نلمسش مجلدات البيانات (*-data) اللي جوّاها مخزون وديون وخزينة
  if (app.isPackaged) {
    const staged = path.join(process.resourcesPath, 'app-runtime');
    const isUserData = (name) => name.endsWith('-data');
    const syncDir = (src, dest) => {
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (isUserData(entry.name)) continue;
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(d, { recursive: true });
          syncDir(s, d);
        } else {
          fs.copyFileSync(s, d);
        }
      }
    };
    for (const sub of ['dist', 'public']) {
      try {
        const src = path.join(staged, sub);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(projectDir, sub);
        fs.mkdirSync(dest, { recursive: true });
        syncDir(src, dest);
      } catch (e) { if (typeof logCrash === 'function') logCrash('ensureRuntimeFiles.' + sub, e); }
    }
  }
}

function resolveProjectDir(isDev) {
  // وضع التطوير: مجلد المشروع نفسه
  if (isDev) return path.join(__dirname, '..');
  // المنظومة الموحدة: بيانات التطبيق كلها (database + license + public + backups)
  // في مجلد المشروع D:\CaptainPOS — ولو مش موجودة (جهاز تاني) نرجع لبيانات المستخدم
  const home = process.env.CAPTAIN_HOME || 'D:\\CaptainPOS';
  try {
    if (fs.existsSync(path.join(home, 'package.json'))) return home;
  } catch {}
  return app.getPath('userData');
}

function startServer() {
  const isDev = !app.isPackaged;
  // app.getAppPath() يعمل في الحالتين: مجلد المشروع (تطوير) أو app.asar (مجمّعة)
  const serverFile = path.join(app.getAppPath(), 'dist', 'server.cjs');
  const projectDir = resolveProjectDir(isDev);

  if (!fs.existsSync(serverFile)) {
    throw new Error(`ملف السيرفر غير موجود:\n${serverFile}`);
  }

  if (isDev) {
    process.chdir(projectDir);
  } else {
    ensureRuntimeFiles(projectDir);
    process.env.CAPTAIN_DATA_DIR = projectDir;
    process.chdir(projectDir);
  }

  process.env.PORT = String(SERVER_PORT);
  process.env.NODE_ENV = 'production';

  delete require.cache[require.resolve(serverFile)];
  require(serverFile);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    title: 'منظومة الكابتن',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    frame: true,
    // منع زر التكبير/الاستعادة (زر المربع الصغير) — الشاشة بتفتح ملء الشاشة والخروج بـ F11
    maximizable: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    // البرنامج يفتح ملء الشاشة كاملة (الخروج للويندوز عبر F11)
    try { mainWindow.setFullScreen(true); } catch {}
    setTimeout(() => {
      mainWindow.show();
      mainWindow.focus();
    }, 200);
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // لو صفحة العرض ماتت (كراش) سجل السبب وحاول ترجعها بدل اختفاء البرنامج بصمت
  let crashCount = 0;
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logCrash('window.render-process-gone', JSON.stringify(details));
    crashCount += 1;
    if (crashCount <= 2 && mainWindow) {
      try { mainWindow.reload(); return; } catch {}
    }
    try { dialog.showErrorBox('تعطلت نافذة العرض', `السبب مسجل في:\n${logPath()}`); } catch {}
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const zoomIn = () => { if (mainWindow) { const z = mainWindow.webContents.getZoomLevel(); mainWindow.webContents.setZoomLevel(z + 0.5); } };
  const zoomOut = () => { if (mainWindow) { const z = mainWindow.webContents.getZoomLevel(); mainWindow.webContents.setZoomLevel(z - 0.5); } };
  const zoomReset = () => { if (mainWindow) mainWindow.webContents.setZoomLevel(0); };
  const toggleFullScreen = () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); };

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => { if (mainWindow) mainWindow.webContents.reload(); }
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => { if (mainWindow) mainWindow.webContents.reloadIgnoringCache(); }
        },
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); }
        },
        {
          label: 'Fullscreen',
          accelerator: 'F11',
          click: toggleFullScreen
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: zoomIn
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Shift+=',
          click: zoomIn
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: zoomOut
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: zoomReset
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window-maximize', () => { if (mainWindow) { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); }});
  ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });
  // إعادة التركيز الجذري من العملية الرئيسية (حوارات النظام بتسرق الفوكس ولا يرجع بـ window.focus)
  ipcMain.on('window-refocus', () => {
    try {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (mainWindow.webContents) mainWindow.webContents.focus();
    } catch {}
  });

  // الدخول التلقائي اتشال (قرار الكابتن 2026-09-29): مفيش جلسة بتتسجل على القرص،
  // والبرنامج بقى يطلب كلمة السر مع كل تشغيلة — أي ملف جلسة قديم بيتمسح أول تشغيل.
  const sessionFile = () => path.join(app.getPath('userData'), 'captain-session.json');
  ipcMain.handle('session-save', async () => {
    try { fs.unlinkSync(sessionFile()); } catch {}
    return true;
  });
  ipcMain.handle('session-load', async () => {
    try { fs.unlinkSync(sessionFile()); } catch {}
    return null;
  });
  ipcMain.handle('session-clear', async () => {
    try { fs.unlinkSync(sessionFile()); } catch {}
    return true;
  });

  // كنترول+R / F5 → أول مرة true (تشغيل جديد = شاشة الدخول)، بعدها false (نرجّع الجلسة)
  ipcMain.handle('app-fresh-start', async () => {
    const v = freshStart;
    freshStart = false;
    return v;
  });

  // لما الويندوز يتقفل → نظّف ملف الجلسة
  mainWindow.on('close', () => {
    try { fs.unlinkSync(sessionFile()); } catch {}
  });
}

// نسخة واحدة فقط: الضغطة التانية على الأيقونة ترجع النافذة المفتوحة بدل نسخة تانية
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  try {
    const portFree = await isPortFree(SERVER_PORT);
    if (portFree) startServer();
    const up = await waitForServer(`http://localhost:${SERVER_PORT}`, 30);
    if (!up) {
      dialog.showErrorBox('تعذر تشغيل البرنامج', 'فشل تشغيل السيرفر الداخلي. أعد المحاولة، ولو تكررت المشكلة احذف أي نسخة شغالة من البرنامج وأعد الفتح.');
      app.quit();
      return;
    }
    createWindow();
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  } catch (err) {
    dialog.showErrorBox('تعذر تشغيل البرنامج', String((err && err.message) || err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
