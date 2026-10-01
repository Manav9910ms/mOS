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
    menu.style.left = Math.min(x, window.innerWidth - 190) + "px";
    menu.style.top = Math.min(y, window.innerHeight - 90) + "px";
    menu.classList.add("visible");
  }

  function addItem(name, type) {
    const item = document.createElement("div");
    item.className = "desktop-item";
    item.innerHTML = `
      <div class="item-icon">${type === "folder" ? "📁" : "📄"}</div>
      <div class="item-name"></div>
    `;
    item.querySelector(".item-name").textContent = name;
    workspace.appendChild(item);
  }

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMenu(event.clientX, event.clientY);
  });

  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "folder") {
      const name = window.prompt("Enter folder name:");
      if (name?.trim()) addItem(name.trim(), "folder");
    }

    if (action === "file") {
      const name = window.prompt("Enter file name:");
      if (name?.trim()) addItem(name.trim(), "file");
    }

    hideMenu();
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) hideMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideMenu();
  });

  window.addEventListener("resize", hideMenu);
})();
