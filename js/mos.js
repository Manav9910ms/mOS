const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?.()||'w-'+Date.now()+'-'+Math.random().toString(16).slice(2);
const state={windows:new Map(),settings:{theme:'dark',accent:'#60a5fa',wallpaper:'aurora',showIcons:true},notifications:[],fsReady:false};
window.mOS={state,escapeHTML,uid};

const Settings={
  async load(){
    try{const v=JSON.parse(localStorage.getItem('mos-settings')||'{}');state.settings={...state.settings,...v}}catch{}
    this.apply();
  },
  save(){localStorage.setItem('mos-settings',JSON.stringify(state.settings));this.apply()},
  apply(){
    document.documentElement.style.setProperty('--mos-accent',state.settings.accent);\n    document.documentElement.dataset.theme=state.settings.theme;
    $('#desktop').dataset.wallpaper=state.settings.wallpaper;
    $('#desktop-icons').style.display=state.settings.showIcons?'grid':'none';
    const dark=state.settings.theme==='dark';
    document.documentElement.style.setProperty('--mos-panel',dark?'#f8fafc':'#ffffff');
  },
  set(k,v){state.settings[k]=v;this.save();notify('Settings updated',k)}
};
window.mOS.Settings=Settings;

const DB={name:'mos-db',version:1,db:null,async open(){
  if(this.db)return this.db;
  this.db=await new Promise((res,rej)=>{const r=indexedDB.open(this.name,this.version);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('nodes')){const s=db.createObjectStore('nodes',{keyPath:'id'});s.createIndex('parent','parent',{unique:false});}
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  return this.db;
},tx(store,mode='readonly'){return this.db.transaction(store,mode).objectStore(store)}};

const FileSystem={
  async init(){
    await DB.open();const all=await this.all();
    if(!all.length){const now=Date.now();const dirs=[
      ['root','',null,'dir'],['desktop','Desktop','root','dir'],['documents','Documents','root','dir'],
      ['downloads','Downloads','root','dir'],['pictures','Pictures','root','dir'],['music','Music','root','dir'],
      ['videos','Videos','root','dir'],['trash','Trash','root','dir']
    ];for(const [id,name,parent,type] of dirs)await this.put({id,name,parent,type,size:0,created:now,modified:now});}
    state.fsReady=true;
  },
  all(){return new Promise((res,rej)=>{const r=DB.tx('nodes').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})},
  get(id){return new Promise((res,rej)=>{const r=DB.tx('nodes').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  children(parent){return new Promise((res,rej)=>{const r=DB.tx('nodes').index('parent').getAll(parent);r.onsuccess=()=>res((r.result||[]).sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name)));r.onerror=()=>rej(r.error)})},
  put(n){return new Promise((res,rej)=>{const r=DB.tx('nodes','readwrite').put(n);r.onsuccess=()=>res(n);r.onerror=()=>rej(r.error)})},
  remove(id){return new Promise(async(res,rej)=>{try{const n=await this.get(id);if(!n)return res();for(const c of await this.children(id))await this.remove(c.id);const r=DB.tx('nodes','readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}catch(e){rej(e)}})},
  async createFolder(name,parent='root'){const now=Date.now();return this.put({id:uid(),name:name.trim()||'New Folder',parent,type:'dir',size:0,created:now,modified:now})},
  async createFile(name,content='',parent='documents'){const now=Date.now();return this.put({id:uid(),name:name.trim()||'New File.txt',parent,type:'file',mime:'text/plain',content,size:String(content).length,created:now,modified:now})},
  async rename(id,name){const n=await this.get(id);if(!n)return;n.name=name.trim()||n.name;n.modified=Date.now();return this.put(n)},
  async write(id,content){const n=await this.get(id);if(!n)throw new Error('File not found');n.content=String(content);n.size=n.content.length;n.modified=Date.now();return this.put(n)},
  async move(id,parent){const n=await this.get(id);if(!n)return;n.parent=parent;n.modified=Date.now();return this.put(n)},
  async trash(id){if(['root','desktop','documents','downloads','pictures','music','videos','trash'].includes(id))throw new Error('Protected folder');return this.move(id,'trash')},
  async restore(id){const n=await this.get(id);if(n?.parent==='trash')return this.move(id,'documents')},
  async emptyTrash(){for(const n of await this.children('trash'))await this.remove(n.id)},
  async search(q){const s=q.toLowerCase();return (await this.all()).filter(n=>n.name&&n.name.toLowerCase().includes(s)&&n.id!=='root')}
};
window.mOS.FileSystem=FileSystem;

function notify(title,detail=''){const n={id:uid(),title,detail,time:Date.now()};state.notifications.unshift(n);state.notifications=state.notifications.slice(0,30);renderNotifications();const el=document.createElement('div');el.className='toast';el.innerHTML='<strong>'+escapeHTML(title)+'</strong>'+(detail?'<small>'+escapeHTML(detail)+'</small>':'');$('#toast-stack').append(el);setTimeout(()=>el.remove(),3500)}
window.mOS.notify=notify;

const Apps=new Map();
const AppRegistry={
  register(app){Apps.set(app.id,app)},
  get(id){return Apps.get(id)},all(){return [...Apps.values()]},
  renderStart(filter=''){const q=filter.toLowerCase();const items=this.all().filter(a=>!q||a.name.toLowerCase().includes(q));$('#start-apps').innerHTML=items.map(a=>`<button class="start-app" data-app="${a.id}" role="menuitem"><span class="glyph">${a.icon}</span><small>${escapeHTML(a.name)}</small></button>`).join('');$$('#start-apps [data-app]').forEach(b=>b.onclick=()=>{WindowManager.open(b.dataset.app);toggleStart(false)})}
};
window.mOS.AppRegistry=AppRegistry;

const WindowManager={
  z:20,
  open(id,options={}){
    const app=Apps.get(id);if(!app)return;
    const existing=[...state.windows.values()].find(w=>w.appId===id&&!w.el.classList.contains('minimized')&&w.singleInstance!==false);
    if(existing){this.focus(existing.id);return existing}
    const w={id:uid(),appId:id,title:app.name,icon:app.icon,singleInstance:app.singleInstance!==false};
    const el=document.createElement('section');el.className='mos-window';el.dataset.windowId=w.id;el.style.left=options.left||Math.max(18,(innerWidth-640)/2+((state.windows.size%4)*24));el.style.top=options.top||Math.max(18,(innerHeight-520)/2+((state.windows.size%4)*18));el.style.zIndex=++this.z;
    el.innerHTML=`<div class="window-titlebar"><span class="window-icon">${app.icon}</span><span class="window-title">${escapeHTML(app.name)}</span><div class="window-controls"><button class="window-control min" aria-label="Minimize">−</button><button class="window-control max" aria-label="Maximize">□</button><button class="window-control close" aria-label="Close">×</button></div></div><div class="window-content"></div><div class="resize-handle" aria-hidden="true"></div>`;
    $('#window-layer').append(el);w.el=el;state.windows.set(w.id,w);
    el.addEventListener('pointerdown',()=>this.focus(w.id));
    $('.min',el).onclick=e=>{e.stopPropagation();this.minimize(w.id)};$('.max',el).onclick=e=>{e.stopPropagation();this.maximize(w.id)};$('.close',el).onclick=e=>{e.stopPropagation();this.close(w.id)};
    this.drag(w);this.resize(w);this.focus(w.id);this.refreshTaskbar();
    try{app.mount($('.window-content',el),w)}catch(e){console.error(e);$('.window-content',el).innerHTML=`<div class="empty-state">Unable to launch ${escapeHTML(app.name)}.</div>`}
    return w
  },
  close(id){const w=state.windows.get(id);if(!w)return;w.el.remove();state.windows.delete(id);this.refreshTaskbar();notify('Application closed',w.title)},
  minimize(id){const w=state.windows.get(id);if(!w)return;w.el.classList.add('minimized');this.refreshTaskbar()},
  maximize(id){const w=state.windows.get(id);if(!w)return;w.el.classList.toggle('maximized');this.focus(id)},
  restore(id){const w=state.windows.get(id);if(!w)return;w.el.classList.remove('minimized');this.focus(id)},
  focus(id){const w=state.windows.get(id);if(!w)return;this.z++;w.el.style.zIndex=this.z;w.el.classList.remove('minimized');this.active=id;this.refreshTaskbar()},
  drag(w){
    const bar=$('.window-titlebar',w.el);let sx=0,sy=0,ox=0,oy=0,moving=false;
    bar.addEventListener('pointerdown',e=>{if(e.target.closest('button')||w.el.classList.contains('maximized'))return;moving=true;bar.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;ox=parseFloat(w.el.style.left)||0;oy=parseFloat(w.el.style.top)||0});
    bar.addEventListener('pointermove',e=>{if(!moving)return;w.el.style.left=Math.max(0,Math.min(innerWidth-w.el.offsetWidth,ox+e.clientX-sx))+'px';w.el.style.top=Math.max(0,Math.min(innerHeight-varHeight(),oy+e.clientY-sy))+'px'});
    bar.addEventListener('pointerup',()=>moving=false);bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))this.maximize(w.id)});
  },
  resize(w){
    const h=$('.resize-handle',w.el);let sx=0,sy=0,sw=0,sh=0,res=false;
    h.addEventListener('pointerdown',e=>{if(w.el.classList.contains('maximized'))return;res=true;h.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;sw=w.el.offsetWidth;sh=w.el.offsetHeight});
    h.addEventListener('pointermove',e=>{if(!res)return;w.el.style.width=Math.max(280,Math.min(innerWidth-20,sw+e.clientX-sx))+'px';w.el.style.height=Math.max(190,Math.min(innerHeight-90,sh+e.clientY-sy))+'px'});
    h.addEventListener('pointerup',()=>res=false)
  },
  refreshTaskbar(){$('#taskbar-apps').innerHTML=[...state.windows.values()].map(w=>`<button class="task-app ${this.active===w.id&&!w.el.classList.contains('minimized')?'active':''}" data-win="${w.id}"><span class="task-app-icon">${w.icon}</span><span class="task-app-name">${escapeHTML(w.title)}</span></button>`).join('');$$('#taskbar-apps [data-win]').forEach(b=>b.onclick=()=>{const w=state.windows.get(b.dataset.win);if(w.el.classList.contains('minimized'))this.restore(w.id);else if(this.active===w.id)this.minimize(w.id);else this.focus(w.id)})}
};
function varHeight(){return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h'))||62}
window.mOS.WindowManager=WindowManager;

function toggleStart(force){const el=$('#start-menu');el.classList.toggle('hidden',force===undefined?!el.classList.contains('hidden'):!force);if(!el.classList.contains('hidden')){$('#start-search').focus();AppRegistry.renderStart($('#start-search').value)}}
function toggleSearch(force){const el=$('#search-panel');el.classList.toggle('hidden',force===undefined?!el.classList.contains('hidden'):!force);if(!el.classList.contains('hidden'))$('#global-search').focus()}

async function renderDesktopIcons(){
  const apps=AppRegistry.all();$('#desktop-icons').innerHTML=apps.map(a=>`<div class="desktop-icon" data-app="${a.id}" tabindex="0"><div class="desktop-icon-glyph">${a.icon}</div><div class="desktop-icon-label">${escapeHTML(a.name)}</div></div>`).join('');
  $$('.desktop-icon').forEach(i=>{i.addEventListener('dblclick',()=>WindowManager.open(i.dataset.app));i.addEventListener('keydown',e=>{if(e.key==='Enter')WindowManager.open(i.dataset.app)});i.addEventListener('click',()=>{$$('.desktop-icon').forEach(x=>x.classList.remove('selected'));i.classList.add('selected')})})
}
async function searchUI(q,target){
  const box=$(target);q=q.trim();if(!q){box.innerHTML='';return}
  const apps=AppRegistry.all().filter(a=>a.name.toLowerCase().includes(q.toLowerCase())).slice(0,5);
  const files=await FileSystem.search(q);box.innerHTML=[...apps.map(a=>`<button class="search-result" data-app="${a.id}"><span class="glyph">${a.icon}</span><span>${escapeHTML(a.name)}</span><span class="result-meta">App</span></button>`),...files.slice(0,8).map(f=>`<button class="search-result" data-file="${f.id}"><span class="glyph">${f.type==='dir'?'📁':'📄'}</span><span>${escapeHTML(f.name)}</span><span class="result-meta">File</span></button>`)].join('')||'<div class="empty-state">No results</div>';
  $$('[data-app]',box).forEach(b=>b.onclick=()=>{WindowManager.open(b.dataset.app);toggleStart(false);toggleSearch(false)});
  $$('[data-file]',box).forEach(b=>b.onclick=()=>{window.mOS.openFile(b.dataset.file);toggleStart(false);toggleSearch(false)})
}
function renderNotifications(){$('#notification-list').innerHTML=state.notifications.map(n=>`<div class="notification"><div class="notification-title">${escapeHTML(n.title)}</div><div class="notification-time">${escapeHTML(n.detail)} · ${new Date(n.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')||'<div class="empty-state">No notifications</div>'}

window.mOS.openFile=async id=>{const n=await FileSystem.get(id);if(!n)return;if(n.type==='dir'){WindowManager.open('files',{options:{}});setTimeout(()=>window.dispatchEvent(new CustomEvent('mos:open-path',{detail:{id}})),0)}else if((n.mime||'').startsWith('text/')||/\.(txt|md|json|csv|js|html|css)$/i.test(n.name)){const w=WindowManager.open('notes');setTimeout(()=>window.dispatchEvent(new CustomEvent('mos:edit-file',{detail:{file:n,window:w?.id}})),30)}else notify('File selected',n.name)};

document.addEventListener('contextmenu',e=>{e.preventDefault();const menu=$('#context-menu');const onFile=e.target.closest('.file-card');const onDesk=e.target.closest('.desktop');menu.innerHTML=onFile?`<button class="context-item" data-cmd="open">Open</button><button class="context-item" data-cmd="rename">Rename</button><button class="context-item" data-cmd="copy">Copy</button><button class="context-item" data-cmd="delete">Delete</button><button class="context-item" data-cmd="properties">Properties</button>`:`<button class="context-item" data-cmd="new-folder">New Folder</button><button class="context-item" data-cmd="new-file">New Text File</button><button class="context-item" data-cmd="refresh">Refresh</button><button class="context-item" data-cmd="settings">Display Settings</button>`;menu.style.left=Math.min(e.clientX,innerWidth-menu.offsetWidth-8)+'px';menu.style.top=Math.min(e.clientY,innerHeight-varHeight()-menu.offsetHeight-8)+'px';menu.classList.remove('hidden');menu.dataset.file=onFile?.dataset.id||''});
document.addEventListener('click',async e=>{if(!e.target.closest('#context-menu'))$('#context-menu').classList.add('hidden');const item=e.target.closest('.context-item');if(!item)return;const cmd=item.dataset.cmd,id=$('#context-menu').dataset.file;$('#context-menu').classList.add('hidden');
  try{if(cmd==='new-folder'){await FileSystem.createFolder('New Folder');notify('Folder created');window.dispatchEvent(new Event('mos:fschange'))}
    else if(cmd==='new-file'){await FileSystem.createFile('New File.txt');notify('File created');window.dispatchEvent(new Event('mos:fschange'))}
    else if(cmd==='refresh'){location.reload()}
    else if(cmd==='settings'){WindowManager.open('settings')}
    else if(id&&cmd==='open')window.mOS.openFile(id);
    else if(id&&cmd==='rename'){const n=await FileSystem.get(id);const v=prompt('Rename',n.name);if(v){await FileSystem.rename(id,v);window.dispatchEvent(new Event('mos:fschange'));notify('Renamed',v)}}
    else if(id&&cmd==='delete'){await FileSystem.trash(id);window.dispatchEvent(new Event('mos:fschange'));notify('Moved to Trash')}
    else if(id&&cmd==='copy'){window.mOS.clipboard=id;notify('Copied','Selected item is ready to paste')}
    else if(id&&cmd==='properties'){const n=await FileSystem.get(id);alert(`Name: ${n.name}\nType: ${n.type}\nSize: ${n.size||0} bytes`)}
  }catch(err){notify('Action failed',err.message)}
});
document.addEventListener('keydown',e=>{if(e.altKey&&e.key==='Tab'){e.preventDefault();const ws=[...state.windows.values()];if(ws.length){const i=Math.max(0,ws.findIndex(w=>w.id===WindowManager.active));WindowManager.focus(ws[(i+1)%ws.length].id)}}if(e.key==='Escape'){toggleStart(false);toggleSearch(false);$('#context-menu').classList.add('hidden')}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();WindowManager.open('files')}if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='t'){e.preventDefault();WindowManager.open('terminal')}if(e.key==='Meta'||e.key==='OS')toggleStart()});
$('#start-button').onclick=()=>toggleStart();$('#search-button').onclick=()=>toggleSearch();$('#notification-button').onclick=()=>$('#notification-panel').classList.toggle('hidden');$('#clear-notifications').onclick=()=>{state.notifications=[];renderNotifications()};
$('#start-search').addEventListener('input',e=>{AppRegistry.renderStart(e.target.value);searchUI(e.target.value,'#start-results')});
$('#global-search').addEventListener('input',e=>searchUI(e.target.value,'#global-results'));
document.addEventListener('click',e=>{if(!e.target.closest('#start-menu')&&!e.target.closest('#start-button'))toggleStart(false);if(!e.target.closest('#search-panel')&&!e.target.closest('#search-button'))toggleSearch(false)});
$('#start-menu').addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(!a)return;if(a.dataset.action==='open-settings'){WindowManager.open('settings');toggleStart(false)}if(a.dataset.action==='exit-mos'){document.title='mOS — exited';document.body.innerHTML='<div style="height:100vh;display:grid;place-items:center;background:#090d18;color:#e5e7eb;font-family:system-ui"><div style="text-align:center"><div style="font-size:56px;font-weight:800">mOS</div><div>mOS has been exited. Refresh to reopen.</div></div></div>'}});
function clock(){const d=new Date();$('#clock-button').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});$('#network-indicator').title=navigator.onLine?'Online':'Offline';$('#network-indicator').textContent=navigator.onLine?'◉':'○';const b=navigator.getBattery?.();if(b)b.then(x=>{$('#battery-indicator').textContent=x.charging?'⚡':'▰'}).catch(()=>{})}
setInterval(clock,1000);clock();window.addEventListener('online',clock);window.addEventListener('offline',clock);

(async function boot(){await Settings.load();await FileSystem.init();await import('./apps.js');\n  if('serviceWorker' in navigator && location.protocol!=='file:'){navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('mOS service worker unavailable',err))}AppRegistry.renderStart();await renderDesktopIcons();renderNotifications();setTimeout(()=>$('#boot-screen').remove(),900)})();
