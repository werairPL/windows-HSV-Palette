// preload —— 在隔离环境下安全地暴露窗口控制与配置记忆能力
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("winCtl", {
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggle-max"),
  close: () => ipcRenderer.send("win:close"),
  onMaximizeChange: (cb) => {
    ipcRenderer.on("win:maximize-changed", (_e, isMax) => cb(isMax));
  }
});

// 配置记忆（主题等）——读写 exe 同目录的配置文件
contextBridge.exposeInMainWorld("appConfig", {
  load: () => ipcRenderer.invoke("config:load"),
  save: (cfg) => ipcRenderer.send("config:save", cfg)
});
