const mOS = window.mOS;
const AppRegistry = mOS.AppRegistry;
const WindowManager = mOS.WindowManager;
const FileSystem = mOS.FileSystem;
const Settings = mOS.Settings;
const notify = mOS.notify;
const escapeHTML = mOS.escapeHTML;
const state = mOS.state;

AppRegistry.register({
  id: 'files',
  name: 'Files',
  icon: '📁',
  mount: function(root) {
    var current = 'root';
    var view = 'grid';
    var names = {
      root: 'Home',
      desktop: 'Desktop',
      documents: 'Documents',
      downloads: 'Downloads',
      pictures: 'Pictures',
      music: 'Music',
      videos: 'Videos',
      trash: 'Trash'
    };
    var sideIcons = {
      root: '⌂',
      desktop: '▦',
      documents: '▤',
      downloads: '⇩',
      pictures: '▧',
      music: '♫',
      videos: '▶',
      trash: '⌫'
    };

    function card(n) {
      var icon = n.type === 'dir' ? (n.id === 'trash' ? '🗑️' : '📁') : '📄';
      return '<div class="file-card" data-id="' + n.id + '" tabindex="0">' +
        '<div class="file-card-icon">' + icon + '</div>' +
        '<div class="file-card-name" title="' + escapeHTML(n.name) + '">' + escapeHTML(n.name) + '</div>' +
      '</div>';
    }

    async function draw() {
      var node = await FileSystem.get(current);
      var children = await FileSystem.children(current);
      var sidebar = Object.keys(names).map(function(id) {
        return '<button class="files-side-btn ' + (id === current ? 'active' : '') + '" data-dir="' + id + '">' +
          sideIcons[id] + ' <span>' + names[id] + '</span></button>';
      }).join('');

      var cards = children.map(card).join('');
      if (!cards) cards = '<div class="empty-state">This folder is empty</div>';

      root.innerHTML =
        '<div class="files-layout">' +
          '<aside class="files-sidebar">' + sidebar + '</aside>' +
          '<section class="files-main">' +
            '<div class="app-toolbar">' +
              '<button class="app-btn" data-act="up">↑ Up</button>' +
              '<button class="app-btn" data-act="folder">＋ Folder</button>' +
              '<button class="app-btn" data-act="file">＋ File</button>' +
              '<button class="app-btn" data-act="import">⇧ Import</button>' +
              '<button class="app-btn" data-act="paste">Paste</button>' +
              '<button class="app-btn" data-act="download">⇩ Download</button>' +
              '<span class="app-spacer"></span>' +
              '<button class="app-btn" data-act="view">' + (view === 'grid' ? '☷ Grid' : '☰ List') + '</button>' +
            '</div>' +
            '<div class="files-path">/ ' + escapeHTML(node && node.name ? node.name : 'Home') + '</div>' +
            '<div class="files-grid ' + (view === 'list' ? 'list-view' : '') + '" id="files-grid">' + cards + '</div>' +
          '</section>' +
        '</div>';

      Array.from(root.querySelectorAll('.files-side-btn')).forEach(function(btn) {
        btn.onclick = function() {
          current = btn.dataset.dir;
          draw();
        };
      });

      Array.from(root.querySelectorAll('[data-act]')).forEach(function(btn) {
        btn.onclick = function() {
          action(btn.dataset.act);
        };
      });

      Array.from(root.querySelectorAll('.file-card')).forEach(function(btn) {
        btn.onclick = function() {
          Array.from(root.querySelectorAll('.file-card')).forEach(function(x) { x.classList.remove('selected'); });
          btn.classList.add('selected');
          window.mOS.clipboard = btn.dataset.id;
        };
        btn.ondblclick = function() { openNode(btn.dataset.id); };
      });
    }

    async function openNode(id) {
      var n = await FileSystem.get(id);
      if (!n) return;
      if (n.type === 'dir') {
        current = n.id;
        draw();
      } else {
        window.mOS.openFile(id);
      }
    }

    async function action(type) {
      try {
        if (type === 'up') {
          var node = await FileSystem.get(current);
          if (node && node.parent) current = node.parent;
          await draw();
        } else if (type === 'folder') {
          var name = prompt('Folder name', 'New Folder');
          if (name) {
            await FileSystem.createFolder(name, current);
            notify('Folder created', name);
            await draw();
          }
        } else if (type === 'file') {
          var fileName = prompt('Text file name', 'New File.txt');
          if (fileName) {
            await FileSystem.createFile(fileName, '', current);
            notify('File created', fileName);
            await draw();
          }
        } else if (type === 'import') {
          var input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.onchange = async function() {
            for (var i = 0; i < input.files.length; i++) {
              var file = input.files[i];
              var body = '';
              if (file.type.indexOf('text/') === 0 || /\.(txt|md|json|csv|js|html|css)$/i.test(file.name)) {
                body = await file.text();
              }
              await FileSystem.createFile(file.name, body, current);
            }
            notify('Import complete', input.files.length + ' item(s)');
            await draw();
          };
          input.click();
        } else if (type === 'paste') {
          if (window.mOS.clipboard) {
            await FileSystem.move(window.mOS.clipboard, current);
            notify('Item moved', names[current] || 'folder');
            await draw();
          }
        } else if (type === 'download') {
          var selected = root.querySelector('.file-card.selected');
          if (!selected) {
            notify('Nothing selected', 'Select a file first');
            return;
          }
          var selectedNode = await FileSystem.get(selected.dataset.id);
          if (selectedNode && selectedNode.type === 'file') {
            var blob = new Blob([selectedNode.content || ''], { type: selectedNode.mime || 'text/plain' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = selectedNode.name;
            a.click();
            setTimeout(function() { URL.revokeObjectURL(a.href); }, 500);
            notify('Download ready', selectedNode.name);
          }
        } else if (type === 'view') {
          view = view === 'grid' ? 'list' : 'grid';
          await draw();
        }
      } catch (err) {
        notify('Files action failed', err.message || 'Unknown error');
      }
    }

    window.addEventListener('mos:open-path', function(e) {
      if (e.detail && e.detail.id) {
        current = e.detail.id;
        draw();
      }
    });

    window.addEventListener('mos:fschange', function() { draw(); });
    draw();
  }
});

AppRegistry.register({
  id: 'notes',
  name: 'Notes',
  icon: '📝',
  singleInstance: false,
  mount: function(root) {
    var currentId = null;

    root.innerHTML =
      '<div class="notes-app">' +
        '<div class="app-toolbar">' +
          '<button class="app-btn" id="note-new">New</button>' +
          '<button class="app-btn" id="note-open">Open</button>' +
          '<button class="app-btn primary" id="note-save">Save</button>' +
          '<button class="app-btn" id="note-save-as">Save As</button>' +
          '<span class="app-spacer"></span>' +
          '<span id="note-name" style="font-size:11px;color:#64748b">Untitled</span>' +
        '</div>' +
        '<textarea class="notes-area" id="notes-editor" placeholder="Start writing..." spellcheck="true"></textarea>' +
        '<div class="notes-status"><span id="note-count">0 words · 0 characters</span></div>' +
      '</div>';

    var editor = root.querySelector('#notes-editor');
    var count = root.querySelector('#note-count');
    var nameEl = root.querySelector('#note-name');

    function updateCount() {
      var text = editor.value;
      var words = text.trim() ? text.trim().split(/\s+/).length : 0;
      count.textContent = words + ' words · ' + text.length + ' characters';
    }

    editor.oninput = updateCount;

    root.querySelector('#note-new').onclick = function() {
      currentId = null;
      editor.value = '';
      nameEl.textContent = 'Untitled';
      updateCount();
    };

    root.querySelector('#note-open').onclick = async function() {
      var files = (await FileSystem.children('documents')).filter(function(x) { return x.type === 'file'; });
      if (!files.length) {
        notify('No notes found');
        return;
      }
      var listing = files.map(function(x, i) { return (i + 1) + '. ' + x.name; }).join('\n');
      var answer = prompt('Enter note number:\n' + listing);
      var index = Number(answer) - 1;
      if (files[index]) {
        currentId = files[index].id;
        editor.value = files[index].content || '';
        nameEl.textContent = files[index].name;
        updateCount();
      }
    };

    root.querySelector('#note-save').onclick = async function() {
      try {
        if (currentId) {
          await FileSystem.write(currentId, editor.value);
        } else {
          var n = await FileSystem.createFile('Untitled.txt', editor.value, 'documents');
          currentId = n.id;
          nameEl.textContent = n.name;
        }
        notify('Note saved', nameEl.textContent);
      } catch (err) {
        notify('Save failed', err.message || 'Unknown error');
      }
    };

    root.querySelector('#note-save-as').onclick = async function() {
      var name = prompt('File name', 'Untitled.txt');
      if (!name) return;
      var n = await FileSystem.createFile(name, editor.value, 'documents');
      currentId = n.id;
      nameEl.textContent = n.name;
      notify('Saved as', n.name);
    };

    window.addEventListener('mos:edit-file', function(e) {
      if (e.detail && e.detail.file) {
        currentId = e.detail.file.id;
        editor.value = e.detail.file.content || '';
        nameEl.textContent = e.detail.file.name;
        updateCount();
      }
    });

    updateCount();
  }
});

AppRegistry.register({
  id: 'calculator',
  name: 'Calculator',
  icon: '🧮',
  singleInstance: false,
  mount: function(root) {
    root.innerHTML =
      '<div class="calc">' +
        '<div class="calc-display"><div class="calc-expression" id="calc-expression"></div><div class="calc-value" id="calc-value">0</div></div>' +
        '<div class="calc-grid">' +
          ['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','±','='].map(function(k, i) {
            return '<button class="calc-key ' + (i < 4 || ['÷','×','−','+'].indexOf(k) >= 0 ? 'operator ' : '') + (k === '=' ? 'equals' : '') + '" data-key="' + k + '">' + k + '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    var value = '0';
    var pending = '';
    var op = '';
    var reset = true;
    var valueEl = root.querySelector('#calc-value');
    var expressionEl = root.querySelector('#calc-expression');

    function render() {
      valueEl.textContent = value;
      expressionEl.textContent = pending + (op ? ' ' + op : '');
    }

    function calculate(a, b, operator) {
      a = Number(a);
      b = Number(b);
      if (operator === '+') return a + b;
      if (operator === '−') return a - b;
      if (operator === '×') return a * b;
      if (operator === '÷') return b === 0 ? 'Error' : a / b;
      return b;
    }

    function press(k) {
      if (k === 'C') {
        value = '0'; pending = ''; op = ''; reset = true;
      } else if (k === '⌫') {
        value = value.length > 1 ? value.slice(0, -1) : '0';
      } else if (k === '%') {
        value = String(Number(value) / 100);
      } else if (k === '±') {
        value = String(Number(value) * -1);
      } else if (['+','−','×','÷'].indexOf(k) >= 0) {
        pending = value; op = k; reset = true;
      } else if (k === '=') {
        if (op && pending !== '') {
          value = String(calculate(pending, value, op));
          pending = ''; op = ''; reset = true;
        }
      } else if (k === '.') {
        if (reset) { value = '0'; reset = false; }
        if (value.indexOf('.') < 0) value += '.';
      } else {
        if (reset) { value = k; reset = false; }
        else if (value === '0') value = k;
        else value += k;
      }
      render();
    }

    Array.from(root.querySelectorAll('[data-key]')).forEach(function(btn) {
      btn.onclick = function() { press(btn.dataset.key); };
    });

    root.tabIndex = 0;
    root.onkeydown = function(e) {
      var map = {'*':'×','/':'÷','-':'−','+':'+','Enter':'=','Escape':'C','Backspace':'⌫','%':'%'};
      if (map[e.key]) {
        e.preventDefault();
        press(map[e.key]);
      } else if (/^[0-9.]$/.test(e.key)) {
        press(e.key);
      }
    };
    render();
  }
});

AppRegistry.register({
  id: 'browser',
  name: 'Browser',
  icon: '🌐',
  singleInstance: false,
  mount: function(root) {
    root.innerHTML =
      '<div class="browser">' +
        '<div class="browser-tabs"><div class="browser-tab">New Tab</div></div>' +
        '<div class="browser-toolbar">' +
          '<button class="browser-nav" id="browser-back">‹</button>' +
          '<button class="browser-nav" id="browser-forward">›</button>' +
          '<button class="browser-nav" id="browser-refresh">↻</button>' +
          '<input class="browser-address" id="browser-address" value="https://example.com" aria-label="Address">' +
          '<button class="app-btn primary" id="browser-go">Go</button>' +
        '</div>' +
        '<div class="browser-view">' +
          '<iframe id="browser-frame" title="mOS Browser content" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin"></iframe>' +
          '<div class="browser-blocked hidden" id="browser-blocked"><div><strong>This site may block embedding inside mOS Browser.</strong><span>Browser security policies can prevent some websites from loading here.</span><div style="margin-top:14px"><button class="app-btn primary" id="browser-external">Open in system browser</button></div></div></div>' +
        '</div>' +
      '</div>';

    var address = root.querySelector('#browser-address');
    var frame = root.querySelector('#browser-frame');
    var blocked = root.querySelector('#browser-blocked');
    var history = [];
    var position = -1;

    function nav(url, addHistory) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (addHistory) {
        history = history.slice(0, position + 1);
        history.push(url);
        position++;
      }
      address.value = url;
      blocked.classList.add('hidden');
      frame.src = url;
    }

    root.querySelector('#browser-go').onclick = function() { nav(address.value, true); };
    root.querySelector('#browser-refresh').onclick = function() { frame.src = frame.src; };
    root.querySelector('#browser-back').onclick = function() { if (position > 0) { position--; nav(history[position], false); } };
    root.querySelector('#browser-forward').onclick = function() { if (position < history.length - 1) { position++; nav(history[position], false); } };
    root.querySelector('#browser-external').onclick = function() { window.open(address.value, '_blank', 'noopener'); };
    frame.onerror = function() { blocked.classList.remove('hidden'); };
    address.onkeydown = function(e) { if (e.key === 'Enter') nav(address.value, true); };
    nav(address.value, true);
  }
});

AppRegistry.register({
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',
  mount: function(root) {
    var tabs = [
      ['appearance', 'Appearance'],
      ['desktop', 'Desktop'],
      ['system', 'System'],
      ['privacy', 'Privacy'],
      ['about', 'About']
    ];
    var active = 'appearance';

    function draw() {
      root.innerHTML =
        '<div class="settings-layout">' +
          '<nav class="settings-nav">' +
            tabs.map(function(t) { return '<button class="' + (active === t[0] ? 'active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
          '</nav>' +
          '<section class="settings-body" id="settings-body"></section>' +
        '</div>';

      Array.from(root.querySelectorAll('[data-tab]')).forEach(function(btn) {
        btn.onclick = function() { active = btn.dataset.tab; draw(); };
      });

      var body = root.querySelector('#settings-body');

      if (active === 'appearance') {
        body.innerHTML =
          '<div class="setting-section"><h3>Appearance</h3>' +
          '<div class="setting-row"><div><strong>Theme</strong><small>Choose the mOS interface theme.</small></div><select class="select" id="mos-theme"><option value="dark">Dark</option><option value="light">Light</option></select></div>' +
          '<div class="setting-row"><div><strong>Accent</strong><small>Interface highlight color.</small></div><div class="swatches">' +
          ['#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa'].map(function(c) { return '<button class="swatch" data-color="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') +
          '</div></div></div>';

        body.querySelector('#mos-theme').value = state.settings.theme;
        body.querySelector('#mos-theme').onchange = function(e) { Settings.set('theme', e.target.value); };
        Array.from(body.querySelectorAll('[data-color]')).forEach(function(btn) {
          btn.onclick = function() { Settings.set('accent', btn.dataset.color); draw(); };
          if (btn.dataset.color === state.settings.accent) btn.classList.add('active');
        });
      }

      if (active === 'desktop') {
        body.innerHTML =
          '<div class="setting-section"><h3>Desktop</h3>' +
          '<div class="setting-row"><div><strong>Show desktop icons</strong><small>Show application shortcuts.</small></div><button class="toggle ' + (state.settings.showIcons ? 'on' : '') + '" id="mos-icons"></button></div>' +
          '<div class="setting-row"><div><strong>Wallpaper</strong><small>Choose a desktop background.</small></div><select class="select" id="mos-wallpaper"><option value="aurora">Aurora</option><option value="midnight">Midnight</option><option value="sunset">Sunset</option></select></div>' +
          '</div>';
        body.querySelector('#mos-icons').onclick = function() { Settings.set('showIcons', !state.settings.showIcons); draw(); };
        body.querySelector('#mos-wallpaper').value = state.settings.wallpaper;
        body.querySelector('#mos-wallpaper').onchange = function(e) { Settings.set('wallpaper', e.target.value); };
      }

      if (active === 'system') {
        body.innerHTML =
          '<div class="setting-section"><h3>System</h3>' +
          '<div class="setting-row"><div><strong>Connectivity</strong><small>Browser network status.</small></div><span>' + (navigator.onLine ? 'Online' : 'Offline') + '</span></div>' +
          '<div class="setting-row"><div><strong>Platform</strong><small>Browser platform value.</small></div><span>' + escapeHTML(navigator.platform || 'Browser') + '</span></div>' +
          '<div class="setting-row"><div><strong>Storage</strong><small>mOS virtual filesystem.</small></div><button class="app-btn" id="storage-check">Inspect</button></div>' +
          '</div>';
        body.querySelector('#storage-check').onclick = async function() {
          var all = await FileSystem.all();
          var files = all.filter(function(x) { return x.type === 'file'; });
          alert('Items: ' + all.length + '\nFiles: ' + files.length + '\nStored text: ' + files.reduce(function(n, x) { return n + (x.content ? x.content.length : 0); }, 0) + ' characters');
        };
      }

      if (active === 'privacy') {
        body.innerHTML =
          '<div class="setting-section"><h3>Privacy</h3>' +
          '<div class="setting-row"><div><strong>Reset mOS</strong><small>Delete local mOS settings and virtual files.</small></div><button class="app-btn" id="mos-reset">Reset</button></div>' +
          '</div>';
        body.querySelector('#mos-reset').onclick = function() {
          if (confirm('Reset local mOS data? This cannot be undone.')) {
            indexedDB.deleteDatabase('mos-db');
            localStorage.removeItem('mos-settings');
            localStorage.removeItem('mos-fallback-fs');
            location.reload();
          }
        };
      }

      if (active === 'about') {
        body.innerHTML =
          '<div class="about"><div class="about-logo">mOS</div><h2>Portable Web Desktop</h2>' +
          '<p>Your desktop, anywhere.<br>Version 1.0 · Built with HTML, CSS &amp; JavaScript.</p>' +
          '<p>mOS is a browser-based pseudo-desktop environment, not a standalone operating system.</p></div>';
      }
    }

    draw();
  }
});

AppRegistry.register({
  id: 'computer',
  name: 'Computer',
  icon: '🖥️',
  mount: function(root) {
    root.innerHTML =
      '<div class="app"><div class="app-toolbar"><strong style="padding-left:4px">Computer</strong><span class="app-spacer"></span><span style="font-size:11px;color:#64748b">mOS virtual environment</span></div>' +
      '<div style="padding:20px"><div class="setting-section"><h3>Environment</h3>' +
      '<div class="setting-row"><div><strong>Type</strong><small>Browser-based pseudo-desktop</small></div><span>mOS</span></div>' +
      '<div class="setting-row"><div><strong>Platform</strong><small>Browser platform</small></div><span>' + escapeHTML(navigator.platform || 'Browser') + '</span></div>' +
      '<div class="setting-row"><div><strong>Viewport</strong><small>Current window size</small></div><span>' + innerWidth + ' × ' + innerHeight + '</span></div>' +
      '</div></div></div>';
  }
});

AppRegistry.register({
  id: 'terminal',
  name: 'Terminal',
  icon: '⌨️',
  mount: function(root) {
    root.innerHTML =
      '<div style="height:100%;display:flex;flex-direction:column;background:#0b1020;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Consolas,monospace">' +
        '<div style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px">mOS Terminal · virtual filesystem</div>' +
        '<div id="term-output" style="flex:1;overflow:auto;padding:13px;white-space:pre-wrap;font-size:12px"></div>' +
        '<form id="term-form" style="display:flex;gap:8px;padding:10px;border-top:1px solid #1e293b"><span style="color:#60a5fa">mos$</span><input id="term-input" style="flex:1;background:transparent;border:0;outline:0;color:#fff;font:inherit" autocomplete="off"></form>' +
      '</div>';

    var output = root.querySelector('#term-output');
    var input = root.querySelector('#term-input');
    var cwd = 'root';

    function print(text) {
      output.textContent += text + '\n';
      output.scrollTop = output.scrollHeight;
    }

    print('mOS Terminal');
    print('Commands: help, ls, cd, pwd, mkdir, touch, cat, clear');

    root.querySelector('#term-form').onsubmit = async function(e) {
      e.preventDefault();
      var line = input.value.trim();
      input.value = '';
      if (!line) return;
      print('mos$ ' + line);
      var parts = line.split(/\s+/);
      var command = parts.shift();
      var arg = parts.join(' ');

      try {
        if (command === 'help') print('help  ls  cd <folder>  pwd  mkdir <name>  touch <name>  cat <name>  clear');
        else if (command === 'clear') output.textContent = '';
        else if (command === 'pwd') {
          var n = await FileSystem.get(cwd);
          print('/' + (n && n.id !== 'root' ? n.name : ''));
        } else if (command === 'ls') {
          var children = await FileSystem.children(cwd);
          print(children.map(function(x) { return x.type === 'dir' ? x.name + '/' : x.name; }).join('\n') || '(empty)');
        } else if (command === 'cd') {
          if (arg === '..') {
            var here = await FileSystem.get(cwd);
            cwd = (here && here.parent) || 'root';
          } else {
            var dirs = await FileSystem.children(cwd);
            var target = dirs.find(function(x) { return x.type === 'dir' && x.name === arg; });
            if (target) cwd = target.id;
            else print('cd: folder not found');
          }
        } else if (command === 'mkdir') {
          if (!arg) print('mkdir: name required');
          else await FileSystem.createFolder(arg, cwd);
        } else if (command === 'touch') {
          if (!arg) print('touch: name required');
          else await FileSystem.createFile(arg, '', cwd);
        } else if (command === 'cat') {
          var files = await FileSystem.children(cwd);
          var f = files.find(function(x) { return x.type === 'file' && x.name === arg; });
          print(f ? (f.content || '') : 'cat: file not found');
        } else {
          print(command + ': command not found');
        }
      } catch (err) {
        print('error: ' + (err.message || 'Unknown error'));
      }
    };

    setTimeout(function() { input.focus(); }, 50);
  }
});

AppRegistry.register({
  id: 'trash',
  name: 'Trash',
  icon: '🗑️',
  mount: function(root) {
    root.innerHTML =
      '<div class="app"><div class="app-toolbar"><button class="app-btn" id="trash-empty">Empty Trash</button><span class="app-spacer"></span><span style="font-size:11px;color:#64748b">Deleted items stay local.</span></div>' +
      '<div class="files-grid" id="trash-grid"></div></div>';

    var grid = root.querySelector('#trash-grid');

    async function draw() {
      var items = await FileSystem.children('trash');
      grid.innerHTML = items.map(function(n) {
        return '<div class="file-card" data-id="' + n.id + '"><div class="file-card-icon">' + (n.type === 'dir' ? '📁' : '📄') + '</div><div class="file-card-name">' + escapeHTML(n.name) + '</div></div>';
      }).join('') || '<div class="empty-state">Trash is empty</div>';

      Array.from(grid.querySelectorAll('.file-card')).forEach(function(card) {
        card.onclick = function() {
          Array.from(grid.querySelectorAll('.file-card')).forEach(function(x) { x.classList.remove('selected'); });
          card.classList.add('selected');
        };
        card.ondblclick = async function() {
          await FileSystem.restore(card.dataset.id);
          notify('Item restored');
          draw();
        };
      });
    }

    root.querySelector('#trash-empty').onclick = async function() {
      await FileSystem.emptyTrash();
      notify('Trash emptied');
      draw();
    };

    draw();
  }
});

AppRegistry.register({
  id: 'help',
  name: 'Help',
  icon: '❔',
  mount: function(root) {
    root.innerHTML =
      '<div class="about" style="text-align:left">' +
      '<div class="about-logo" style="font-size:45px">mOS</div>' +
      '<h2>Quick Help</h2>' +
      '<p><strong>Double-click</strong> a desktop icon to launch an application.</p>' +
      '<p><strong>Drag</strong> a window title bar to move it. Use the corner to resize. Double-click the title bar to maximize.</p>' +
      '<p><strong>Files</strong> stores its virtual filesystem locally in browser storage.</p>' +
      '<p><strong>Terminal</strong> is intentionally limited to the mOS virtual filesystem.</p>' +
      '<p><strong>Browser</strong> respects normal browser security policies.</p>' +
      '</div>';
  }
});

if (typeof console !== 'undefined') console.log('mOS applications loaded:', AppRegistry.all().map(function(app) { return app.name; }).join(', '));
