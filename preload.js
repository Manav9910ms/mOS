const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mosStorage", {
  list: () => ipcRenderer.invoke("storage:list"),
  create: (type, name) => ipcRenderer.invoke("storage:create", { type, name }),
  path: () => ipcRenderer.invoke("storage:path")
});
