const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const isPackaged = app.isPackaged;
const STORAGE_DIR = isPackaged
  ? path.join(path.dirname(process.execPath), "storage")
  : path.join(__dirname, "storage");

function ensureStorage() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function isSafeName(name) {
  return typeof name === "string"
    && name.trim().length > 0
    && name.trim() !== "."
    && name.trim() !== ".."
    && !name.includes("/")
    && !name.includes("\\")
    && !name.includes("\0");
}

function listItems() {
  ensureStorage();

  return fs.readdirSync(STORAGE_DIR, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file"
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createItem(type, rawName) {
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!["file", "folder"].includes(type)) {
    throw new Error("Invalid item type.");
  }

  if (!isSafeName(name)) {
    throw new Error("Invalid name.");
  }

  ensureStorage();

  const target = path.join(STORAGE_DIR, name);

  if (fs.existsSync(target)) {
    throw new Error("A file or folder with that name already exists.");
  }

  if (type === "folder") {
    fs.mkdirSync(target);
  } else {
    fs.writeFileSync(target, "", "utf8");
  }

  return { name, type };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#4f6fbd",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ensureStorage();

  ipcMain.handle("storage:list", () => listItems());
  ipcMain.handle("storage:create", (_event, { type, name }) => createItem(type, name));
  ipcMain.handle("storage:path", () => STORAGE_DIR);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
