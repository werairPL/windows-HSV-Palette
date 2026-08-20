// Electron 主进程 —— 加载调色盘应用（融合式无边框窗口）
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

/* ---------- 配置记忆（窗口大小/位置、亮暗主题）存于 exe 同目录，便携携带 ---------- */
function configFile() {
  return path.join(path.dirname(app.getPath("exe")), "colorpicker-config.json");
}
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch (e) {
    return {};
  }
}
function saveConfig(cfg) {
  try {
    fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2), "utf8");
  } catch (e) { /* 忽略 */ }
}

let winRef = null;
let boundsTimer = null;

function rememberWindowBounds() {
  if (!winRef || winRef.isDestroyed()) return;
  const b = winRef.getBounds();
  const cfg = loadConfig();
  cfg.window = { width: b.width, height: b.height, x: b.x, y: b.y };
  saveConfig(cfg);
}

function createWindow() {
  const saved = loadConfig().window || {};
  const win = new BrowserWindow({
    width: saved.width || 528,   /* 基准 660×880 缩放 0.8，控件模块与左右边框间距与色板一致 */
    height: saved.height || 704,
    x: saved.x,
    y: saved.y,
    minWidth: 406,
    minHeight: 542,
    frame: false,            // 去掉 Windows 原生边框
    transparent: true,       // 窗口透明，实现圆角融合式外观
    resizable: true,         // 边缘仍可调整大小
    autoHideMenuBar: true,
    title: "调色盘",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  winRef = win;

  // 本应用无外链，若意外跳转外链则交给系统浏览器处理
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file:")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // 锁定窗口宽高比（660:880），缩放时排版不失调
  win.setAspectRatio(660 / 880);

  // 窗口尺寸/位置变化后防抖记忆（关闭时也保存一次）
  win.on("resize", () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(rememberWindowBounds, 400);
  });
  win.on("move", () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(rememberWindowBounds, 400);
  });
  win.on("close", rememberWindowBounds);
  win.on("closed", () => { winRef = null; });

  // 最大化状态通知渲染进程（用于去掉圆角）
  win.on("maximize", () => win.webContents.send("win:maximize-changed", true));
  win.on("unmaximize", () => win.webContents.send("win:maximize-changed", false));

  win.loadFile(path.join(__dirname, "app", "index.html"));
}

// 窗口控制 IPC（供自定义标题栏按钮调用）
ipcMain.on("win:minimize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.minimize();
});
ipcMain.on("win:toggle-max", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on("win:close", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.close();
});

// 配置记忆 IPC（渲染进程读写主题等）
ipcMain.handle("config:load", () => loadConfig());
ipcMain.on("config:save", (e, cfg) => saveConfig(cfg));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
