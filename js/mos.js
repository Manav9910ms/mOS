(() => {
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.innerHTML = `
    <button type="button" data-action="folder">Create Folder</button>
    <button type="button" data-action="file">Create File</button>
  `;
  document.body.appendChild(menu);

  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.setAttribute("aria-label", "mOS workspace");
  document.body.appendChild(workspace);

  function hideMenu() {
    menu.classList.remove("visible");
  }

  function showMenu(x, y) {
    menu.style.left = Math.min(x, Math.max(8, window.innerWidth - 198)) + "px";
    menu.style.top = Math.min(y, Math.max(8, window.innerHeight - 100)) + "px";
    menu.classList.add("visible");
  }

  function addItem(name, type) {
    const item = document.createElement("div");
    item.className = "desktop-item";
    item.dataset.name = name;
    item.dataset.type = type;
    item.innerHTML = `
      <div class="item-icon">${type === "folder" ? "📁" : "📄"}</div>
      <div class="item-name"></div>
    `;
    item.querySelector(".item-name").textContent = name;
    workspace.appendChild(item);
  }

  function clearItems() {
    workspace.innerHTML = "";
  }

  async function loadStorage() {
    try {
      const items = await window.mosStorage.list();
      clearItems();

      for (const item of items) {
        addItem(item.name, item.type);
      }
    } catch (error) {
      console.error(error);
      clearItems();

      const message = document.createElement("div");
      message.className = "backend-warning";
      message.textContent = "Unable to read mOS storage.";
      workspace.appendChild(message);
    }
  }

  async function createStorageItem(type) {
    const label = type === "folder" ? "folder" : "file";
    const name = window.prompt(`Enter ${label} name:`);

    if (!name || !name.trim()) {
      return;
    }

    try {
      const item = await window.mosStorage.create(type, name.trim());
      addItem(item.name, item.type);
    } catch (error) {
      window.alert(error.message || "Could not create item.");
    }
  }

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMenu(event.clientX, event.clientY);
  });

  menu.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "folder") {
      await createStorageItem("folder");
    }

    if (action === "file") {
      await createStorageItem("file");
    }

    hideMenu();
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) {
      hideMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideMenu();
    }
  });

  window.addEventListener("resize", hideMenu);

  loadStorage();
})();
