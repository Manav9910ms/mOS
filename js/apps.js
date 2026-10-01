const {AppRegistry,WindowManager,FileSystem,Settings,notify,escapeHTML,uid,state}=window.mOS;

AppRegistry.register({
  id:'files',name:'Files',icon:'📁',
  mount(root){
    const app=document.createElement('div');app.className='app';root.append(app);
    let current='root',clipboard=null,view='grid';
    const names={root:'Home',desktop:'Desktop',documents:'Documents',downloads:'Downloads',pictures:'Pictures',music:'Music',videos:'Videos',trash:'Trash'};
    async function draw(){
      const node=await FileSystem.get(current);const kids=await FileSystem.children(current);
      app.innerHTML=`<div class="files-layout">
        <aside class="files-sidebar">${['root','desktop','documents','downloads','pictures','music','videos','trash'].map(id=>`<button class="files-side-btn ${current===id?'active':''}" data-dir="${id}">${{root:'⌂',desktop:'▦',documents:'▤',downloads:'⇩',pictures:'▧',music:'♫',videos:'▶',trash:'⌫'}[id]} <span>${names[id]}</span></button>`).join('')}</aside>
        <section class="files-main"><div class="app-toolbar"><button class="app-btn" data-act="up">↑ Up</button><button class="app-btn" data-act="folder">＋ Folder</button><button class="app-btn" data-act="file">＋ File</button><button class="app-btn" data-act="import">⇧ Import</button><button class="app-btn" data-act="paste">Paste</button><button class="app-btn" data-act="download">⇩ Download</button><span class="app-spacer"></span><button class="app-btn" data-act="view">${view==='grid'?'☷ Grid':'☰ List'}</button></div>
        <div class="files-path">/ ${escapeHTML(node?.name||'Home')}</div><div class="files-grid ${view==='list'?'list-view':''}" id="files-grid">${kids.map(fileCard).join('')||'<div class="empty-state">This folder is empty</div>'}</div></section>
      </div>`;
      $$('.files-side-btn',app).forEach(b=>b.onclick=()=>{current=b.dataset.dir;draw()});
      window.addEventListener('mos:open-path',e=>{if(e.detail?.id){current=e.detail.id;draw()}});
      $$('[data-act]',app).forEach(b=>b.onclick=()=>action(b.dataset.act));
      $$('.file-card',app).forEach(c=>{c.addEventListener('dblclick',()=>openNode(c.dataset.id));c.addEventListener('click',()=>{ $$('.file-card',app).forEach(x=>x.classList.remove('selected'));c.classList.add('selected');clipboard=c.dataset.id;window.mOS.clipboard=clipboard})});
    }
    function fileCard(n){return `<div class="file-card" data-id="${n.id}" tabindex="0"><div class="file-card-icon">${n.type==='dir'?(n.id==='trash'?'🗑️':'📁'):'📄'}</div><div class="file-card-name" title="${escapeHTML(n.name)}">${escapeHTML(n.name)}</div></div>`}
    async function openNode(id){const n=await FileSystem.get(id);if(!n)return;if(n.type==='dir'){current=n.id;draw()}else window.mOS.openFile(id)}
    async function action(type){
      try{
        if(type==='up'){const n=await FileSystem.get(current);if(n?.parent)current=n.parent;draw()}
        if(type==='folder'){const name=prompt('Folder name','New Folder');if(name){await FileSystem.createFolder(name,current);notify('Folder created',name);draw()}}
        if(type==='file'){const name=prompt('Text file name','New File.txt');if(name){await FileSystem.createFile(name,'',current);notify('File created',name);draw()}}
        if(type==='import'){const input=document.createElement('input');input.type='file';input.multiple=true;input.onchange=async()=>{for(const f of input.files){const text=f.type.startsWith('text/')||/\.(txt|md|json|csv|js|html|css)$/i.test(f.name)?await f.text():'';await FileSystem.createFile(f.name,text,current)}notify('Import complete',String(input.files.length)+' item(s)');draw()};input.click()}
        if(type==='paste'&&window.mOS.clipboard){await FileSystem.move(window.mOS.clipboard,current);notify('Item moved','Pasted into '+(names[current]||'folder'));draw()}
        if(type==='download'){const sel=$('.file-card.selected',app);if(!sel)return notify('Nothing selected','Select a file first');const n=await FileSystem.get(sel.dataset.id);if(n?.type==='file'){const blob=new Blob([n.content||''],{type:n.mime||'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=n.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);notify('Download ready',n.name)}}
        if(type==='view'){view=view==='grid'?'list':'grid';draw()}
      }catch(e){notify('Files action failed',e.message)}
    }
    window.addEventListener('mos:fschange',draw);draw();
  }
});

AppRegistry.register({
  id:'notes',name:'Notes',icon:'📝',singleInstance:false,
  mount(root){
    let currentId=null;
    root.innerHTML=`<div class="notes-app"><div class="app-toolbar"><button class="app-btn" id="new-note">New</button><button class="app-btn" id="open-note">Open</button><button class="app-btn primary" id="save-note">Save</button><button class="app-btn" id="save-as">Save As</button><span class="app-spacer"></span><span id="note-name" style="font-size:11px;color:#64748b">Untitled</span></div><textarea class="notes-area" id="notes-area" spellcheck="true" placeholder="Start writing..."></textarea><div class="notes-status"><span id="notes-count">0 words · 0 characters</span></div></div>`;
    const area=$('#notes-area',root),count=$('#notes-count',root),nameEl=$('#note-name',root);
    const update=()=>{const t=area.value;count.textContent=(t.trim()?t.trim().split(/\s+/).length:0)+' words · '+t.length+' characters'};area.oninput=update;
    window.addEventListener('mos:edit-file',e=>{if(e.detail?.file){currentId=e.detail.file.id;area.value=e.detail.file.content||'';nameEl.textContent=e.detail.file.name;update()}});
    $('#new-note',root).onclick=()=>{currentId=null;area.value='';nameEl.textContent='Untitled';update()};
    $('#open-note',root).onclick=async()=>{const files=(await FileSystem.children('documents')).filter(n=>n.type==='file');if(!files.length)return notify('No notes found');const list=files.map((f,i)=>`${i+1}. ${f.name}`).join('\n');const answer=prompt('Enter note number:\n'+list);const f=files[Number(answer)-1];if(f){currentId=f.id;area.value=f.content||'';nameEl.textContent=f.name;update()}};
    $('#save-note',root).onclick=async()=>{try{if(currentId){await FileSystem.write(currentId,area.value)}else{const n=await FileSystem.createFile('Untitled.txt',area.value,'documents');currentId=n.id;nameEl.textContent=n.name}notify('Note saved',nameEl.textContent)}catch(e){notify('Save failed',e.message)}};
    $('#save-as',root).onclick=async()=>{const name=prompt('File name','Untitled.txt');if(!name)return;const n=await FileSystem.createFile(name,area.value,'documents');currentId=n.id;nameEl.textContent=n.name;notify('Saved as',n.name)};
    update();
  }
});

AppRegistry.register({
  id:'calculator',name:'Calculator',icon:'🧮',singleInstance:false,
  mount(root){
    root.innerHTML=`<div class="calc"><div class="calc-display"><div class="calc-expression" id="calc-expression"></div><div class="calc-value" id="calc-value">0</div></div><div class="calc-grid">${['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','±','='].map((k,i)=>`<button class="calc-key ${i<4||['÷','×','−','+'].includes(k)?'operator':''} ${k==='='?'equals':''}" data-key="${k}">${k}</button>`).join('')}</div></div>`;
    let value='0',pending='',op=null,reset=true;
    const valEl=$('#calc-value',root),exprEl=$('#calc-expression',root);
    function render(){valEl.textContent=value;exprEl.textContent=pending+(op?' '+op:'')}
    function calc(a,b,o){a=Number(a);b=Number(b);if(o==='+')return a+b;if(o==='−')return a-b;if(o==='×')return a*b;if(o==='÷')return b===0?'Error':a/b;return b}
    function press(k){
      if(k==='C'){value='0';pending='';op=null;reset=true}
      else if(k==='⌫'){value=value.length>1?value.slice(0,-1):'0'}
      else if(k==='%'){value=String(Number(value)/100)}
      else if(k==='±'){value=String(Number(value)*-1)}
      else if(['+','−','×','÷'].includes(k)){pending=value;op=k;reset=true}
      else if(k==='='){if(op&&pending!=='' ){value=String(calc(pending,value,op));pending='';op=null;reset=true}}
      else if(k==='.') {if(reset){value='0';reset=false};if(!value.includes('.'))value+='.'}
      else {if(reset){value=k;reset=false}else if(value==='0')value=k;else value+=k}
      render()
    }
    $$('[data-key]',root).forEach(b=>b.onclick=()=>press(b.dataset.key));
    root.onkeydown=e=>{const map={'*':'×','/':'÷','-':'−','+':'+','Enter':'=','Escape':'C','Backspace':'⌫','%':'%'};if(map[e.key]){e.preventDefault();press(map[e.key])}else if(/[0-9.]/.test(e.key)){press(e.key)}};root.tabIndex=0;
  }
});

AppRegistry.register({
  id:'browser',name:'Browser',icon:'🌐',singleInstance:false,
  mount(root){
    root.innerHTML=`<div class="browser"><div class="browser-tabs"><div class="browser-tab">New Tab</div></div><div class="browser-toolbar"><button class="browser-nav" id="back">‹</button><button class="browser-nav" id="forward">›</button><button class="browser-nav" id="refresh">↻</button><input class="browser-address" id="address" value="https://example.com" aria-label="Address"><button class="app-btn primary" id="go">Go</button></div><div class="browser-view"><iframe id="frame" title="mOS Browser content" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin" referrerpolicy="no-referrer"></iframe><div class="browser-blocked hidden" id="blocked"><div><strong>This site may block embedding inside mOS Browser.</strong><span>Browser security policies can prevent some websites from loading here.</span><div style="margin-top:14px"><button class="app-btn primary" id="open-external">Open in system browser</button></div></div></div></div></div>`;
    const address=$('#address',root),frame=$('#frame',root),blocked=$('#blocked',root);let history=[],index=-1;
    function nav(url,push=true){if(!/^https?:\/\//i.test(url))url='https://'+url;if(push){history=history.slice(0,index+1);history.push(url);index++}address.value=url;blocked.classList.add('hidden');frame.src=url}
    $('#go',root).onclick=()=>nav(address.value);$('#refresh',root).onclick=()=>frame.src=frame.src;
    $('#back',root).onclick=()=>{if(index>0){index--;nav(history[index],false)}};$('#forward',root).onclick=()=>{if(index<history.length-1){index++;nav(history[index],false)}};
    frame.onerror=()=>blocked.classList.remove('hidden');$('#open-external',root).onclick=()=>window.open(address.value,'_blank','noopener');
    address.addEventListener('keydown',e=>{if(e.key==='Enter')nav(address.value)});
    nav(address.value);
  }
});

AppRegistry.register({
  id:'settings',name:'Settings',icon:'⚙️',
  mount(root){
    const sections=[['appearance','Appearance'],['desktop','Desktop'],['system','System'],['privacy','Privacy'],['about','About']];
    let active='appearance';
    const draw=()=>{root.innerHTML=`<div class="settings-layout"><nav class="settings-nav">${sections.map(s=>`<button class="${active===s[0]?'active':''}" data-section="${s[0]}">${s[1]}</button>`).join('')}</nav><section class="settings-body" id="settings-body"></section></div>`;$$('[data-section]',root).forEach(b=>b.onclick=()=>{active=b.dataset.section;draw()});renderSection()};
    function renderSection(){const b=$('#settings-body',root);if(!b)return;
      if(active==='appearance')b.innerHTML=`<div class="setting-section"><h3>Appearance</h3><div class="setting-row"><div class="setting-label"><strong>Theme</strong><small>Choose the mOS interface theme.</small></div><select class="select" id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="setting-row"><div class="setting-label"><strong>Accent</strong><small>Interface highlight color.</small></div><div class="swatches">${['#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa'].map(c=>`<button class="swatch ${state.settings.accent===c?'active':''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div></div>`; 
      if(active==='desktop')b.innerHTML=`<div class="setting-section"><h3>Desktop</h3><div class="setting-row"><div><strong>Show desktop icons</strong><small>Show application shortcuts.</small></div><button class="toggle ${state.settings.showIcons?'on':''}" id="show-icons" aria-label="Toggle desktop icons"></button></div><div class="setting-row"><div><strong>Wallpaper</strong><small>Choose the desktop background.</small></div><select class="select" id="wallpaper"><option value="aurora">Aurora</option><option value="midnight">Midnight</option><option value="sunset">Sunset</option></select></div></div>`;
      if(active==='system')b.innerHTML=`<div class="setting-section"><h3>System</h3><div class="setting-row"><div><strong>Clock</strong><small>Local browser time.</small></div><span>${new Date().toLocaleTimeString()}</span></div><div class="setting-row"><div><strong>Online status</strong><small>Browser connectivity.</small></div><span>${navigator.onLine?'Online':'Offline'}</span></div><div class="setting-row"><div><strong>Storage</strong><small>mOS local virtual filesystem.</small></div><button class="app-btn" id="storage-info">Inspect</button></div></div>`;
      if(active==='privacy')b.innerHTML=`<div class="setting-section"><h3>Privacy</h3><div class="setting-row"><div><strong>Clear notifications</strong><small>Remove notification history.</small></div><button class="app-btn" id="clear-notify">Clear</button></div><div class="setting-row"><div><strong>Reset mOS</strong><small>Delete the local virtual filesystem and preferences.</small></div><button class="app-btn" id="reset-mos">Reset</button></div></div>`;
      if(active==='about')b.innerHTML=`<div class="about"><div class="about-logo">mOS</div><h2>Portable Web Desktop</h2><p>Your desktop, anywhere.<br>Version 1.0 · Built with HTML, CSS &amp; JavaScript.</p><p>mOS is a browser-based pseudo-desktop environment, not a standalone operating system.</p></div>`;
      const th=$('#theme',b);if(th){th.value=state.settings.theme;th.onchange=()=>Settings.set('theme',th.value)}
      $$('[data-color]',b).forEach(x=>x.onclick=()=>{Settings.set('accent',x.dataset.color);draw()});
      const si=$('#show-icons',b);if(si)si.onclick=()=>{Settings.set('showIcons',!state.settings.showIcons);draw()};
      const wp=$('#wallpaper',b);if(wp){wp.value=state.settings.wallpaper;wp.onchange=()=>Settings.set('wallpaper',wp.value)}
      $('#storage-info',b)?.addEventListener('click',async()=>{const all=await FileSystem.all();const files=all.filter(x=>x.type==='file');alert(`Items: ${all.length}\nFiles: ${files.length}\nStored text: ${files.reduce((n,x)=>n+(x.content?.length||0),0)} characters`)});
      $('#clear-notify',b)?.addEventListener('click',()=>{state.notifications=[];notify('Notifications cleared')});
      $('#reset-mos',b)?.addEventListener('click',async()=>{if(confirm('Reset local mOS data? This cannot be undone.')){indexedDB.deleteDatabase('mos-db');localStorage.removeItem('mos-settings');location.reload()}});
    }
    draw();
  }
});

AppRegistry.register({id:'trash',name:'Trash',icon:'🗑️',mount(root){
  root.innerHTML=`<div class="app"><div class="app-toolbar"><button class="app-btn" id="empty-trash">Empty Trash</button><span class="app-spacer"></span><span style="font-size:11px;color:#64748b">Deleted items are stored locally.</span></div><div class="files-grid" id="trash-grid"></div></div>\`;
  const grid=$('#trash-grid',root);
  const draw=async()=>{const items=await FileSystem.children('trash');grid.innerHTML=items.map(n=>\`<div class="file-card" data-id="${n.id}"><div class="file-card-icon">${n.type==='dir'?'📁':'📄'}</div><div class="file-card-name">${escapeHTML(n.name)}</div><div style="font-size:10px;color:#94a3b8;margin-top:4px">Click to select</div></div>\`).join('')||'<div class="empty-state">Trash is empty</div>';
    $$('.file-card',root).forEach(c=>c.onclick=()=>{ $$('.file-card',root).forEach(x=>x.classList.remove('selected')); c.classList.add('selected')});
  };
  draw();
  $('#empty-trash',root).onclick=async()=>{await FileSystem.emptyTrash();notify('Trash emptied');draw()};
  root.addEventListener('contextmenu',e=>{const card=e.target.closest('.file-card');if(!card)return;e.preventDefault();const action=prompt('Trash item action: restore / delete','restore');if(action==='restore'){FileSystem.restore(card.dataset.id).then(()=>{notify('Item restored');draw()})}else if(action==='delete'){FileSystem.remove(card.dataset.id).then(()=>{notify('Item permanently deleted');draw()})}});
}});

AppRegistry.register({id:'computer',name:'Computer',icon:'🖥️',mount(root){
  root.innerHTML=`<div class="app"><div class="app-toolbar"><strong style="padding-left:4px">Computer</strong><span class="app-spacer"></span><span style="font-size:11px;color:#64748b">mOS virtual environment</span></div><div style="padding:20px"><div class="setting-section"><h3>Environment</h3><div class="setting-row"><div><strong>Platform</strong><small>Browser-based pseudo-desktop</small></div><span>${escapeHTML(navigator.platform||'Browser')}</span></div><div class="setting-row"><div><strong>Language</strong><small>Browser locale</small></div><span>${escapeHTML(navigator.language)}</span></div><div class="setting-row"><div><strong>Viewport</strong><small>Current window size</small></div><span>${innerWidth} × ${innerHeight}</span></div></div><div class="setting-section"><h3>Storage</h3><div class="setting-row"><div><strong>mOS filesystem</strong><small>Persisted with IndexedDB</small></div><button class="app-btn" id="open-files">Open Files</button></div></div></div></div>`;$('#open-files',root).onclick=()=>WindowManager.open('files')
}});

AppRegistry.register({id:'terminal',name:'Terminal',icon:'⌨️',mount(root){
  root.innerHTML=`<div style="height:100%;display:flex;flex-direction:column;background:#0b1020;color:#dbeafe;font-family:ui-monospace,SFMono-Regular,Consolas,monospace"><div style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px">mOS Terminal · virtual filesystem only</div><div id="term-out" style="flex:1;overflow:auto;padding:13px;white-space:pre-wrap;font-size:12px"></div><form id="term-form" style="display:flex;gap:8px;padding:10px;border-top:1px solid #1e293b"><span style="color:#60a5fa">mos$</span><input id="term-input" style="flex:1;background:transparent;border:0;outline:0;color:#fff;font:inherit" autocomplete="off"></form></div>`;
  const out=$('#term-out',root),input=$('#term-input',root);let cwd='root';const print=x=>{out.textContent+=x+'\n';out.scrollTop=out.scrollHeight};
  print('mOS Terminal — commands: help, ls, cd, pwd, mkdir, touch, cat, clear');
  $('#term-form',root).onsubmit=async e=>{e.preventDefault();const line=input.value.trim();input.value='';if(!line)return;print('mos$ '+line);const [cmd,...args]=line.split(/\s+/);try{
    if(cmd==='help')print('help  ls  cd <folder>  pwd  mkdir <name>  touch <name>  cat <name>  clear');
    else if(cmd==='clear')out.textContent='';
    else if(cmd==='pwd'){const n=await FileSystem.get(cwd);print('/'+(n.id==='root'?'':n.name))}
    else if(cmd==='ls'){const kids=await FileSystem.children(cwd);print(kids.map(n=>n.type==='dir'?n.name+'/':n.name).join('\n')||'(empty)')}
    else if(cmd==='cd'){const name=args.join(' ');if(name==='..'){const n=await FileSystem.get(cwd);cwd=n.parent||'root'}else{const k=await FileSystem.children(cwd);const d=k.find(n=>n.type==='dir'&&n.name===name);if(d)cwd=d.id;else print('cd: folder not found')}}
    else if(cmd==='mkdir'){if(!args[0])print('mkdir: name required');else await FileSystem.createFolder(args.join(' '),cwd)}
    else if(cmd==='touch'){if(!args[0])print('touch: name required');else await FileSystem.createFile(args.join(' '),'',cwd)}
    else if(cmd==='cat'){const k=await FileSystem.children(cwd);const f=k.find(n=>n.type==='file'&&n.name===args.join(' '));print(f?(f.content||''):'cat: file not found')}
    else print(cmd+': command not found');
  }catch(err){print('error: '+err.message)}};
  setTimeout(()=>input.focus(),0)
}});

AppRegistry.register({id:'help',name:'Help',icon:'❔',mount(root){
  root.innerHTML=`<div class="about" style="text-align:left"><div class="about-logo" style="font-size:45px">mOS</div><h2>Quick Help</h2><p><strong>Double-click</strong> desktop icons to open apps. Drag title bars to move windows, drag the bottom-right corner to resize them.</p><p><strong>Files</strong> uses an internal IndexedDB filesystem so documents persist locally across reloads.</p><p><strong>Browser</strong> is subject to normal browser security policies. Some sites cannot be embedded.</p><p><strong>Shortcuts</strong>: Alt+Tab-style window switching can be added later; Ctrl+Shift+F opens Files and Ctrl+Alt+T opens Terminal.</p><p>mOS is a browser-based pseudo-desktop, not a standalone operating system.</p></div>`
}});

// Reopen files when a file search result requests it and refresh file UI after mutations.
window.addEventListener('mos:fschange',()=>{});
