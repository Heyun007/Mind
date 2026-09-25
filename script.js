var storage;
try {
  if (typeof localforage !== 'undefined') {
    storage = localforage.createInstance({ name: 'MindApp', storeName: 'state' });
  } else {
    throw new Error('localforage 未加载');
  }
} catch(e) {
  // CDN 挂了，自动降级到 localStorage，绝不白屏
  storage = {
    setItem: function(k, v) {
      return new Promise(function(resolve, reject) {
        try { localStorage.setItem(k, v); resolve(); }
        catch(err) { reject(err); }
      });
    },
    getItem: function(k) {
      return new Promise(function(resolve) { resolve(localStorage.getItem(k)); });
    }
  };
}

// 检测URL参数
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('action') === 'call') {
  setTimeout(() => triggerCall(), 500);
}

// 日记的天气/心情预设
var WEATHERS = ['晴朗', '多云', '阴天', '小雨', '中雨', '大雨', '暴雨', '小雪', '中雪', '大雪', '暴雪', '雾霾', '大风', '冰雹', '彩虹'];
var MOODS = ['开心', '难过', '生气', '平静', '冷静', '无聊', '焦虑', '兴奋', '害羞', '期待', '疲惫', '感动', '心慌', '幸福', '孤单'];


// ===== STATE =====

let state = {
  profile: { avatar: '', name: '我', status: '在线' },
  dream: { avatar: '', name: '沈屿', gender: '男' },
  dreams: [],
  groups: [],
  currentEditDreamId: null,
  categories: [{ id: 'default', name: '默认' }],
  cards: [
    { id: 'c1', text: '怎么这么晚还在看手机？', cat: 'default' },
    { id: 'c2', text: '还不睡？要我陪你吗？', cat: 'default' },
    { id: 'c3', text: '又在偷偷刷视频？', cat: 'default' },
    { id: 'c4', text: '想我了没？', cat: 'default' },
    { id: 'c5', text: '过来，让我抱抱。', cat: 'default' },
  ],
  callHistory: [],
  checkinHistory: [],
  settings: { callBg: null, checkinBg: null, pushEnabled: false, customIcons: {} },
  callState: 'idle',
  callTimerInterval: null,
  callStartTime: null,
  callElapsed: 0,
  nextCallId: 0,
  nextCheckinId: 0,
    chatSessions: {}, // 存放每个梦角的聊天记录
  currentChatId: null, // 当前正在和谁聊天
    appPages: null,
   diaries: [],
  userDiaryLastDate: '',
};

// ===== 图标配置 =====
const ICONS_CONFIG = [
  { key: 'pageChatList', name: '聊天', emoji: '💬', color: 'icon-blue' },
  { key: 'pageProfile', name: '个人主页', emoji: '👤', color: 'icon-purple' },
  { key: 'pageDreamRole', name: '梦角信息', emoji: '💜', color: 'icon-pink' },
  { key: 'pageWordCards', name: '字卡功能', emoji: '📇', color: 'icon-orange' },
  { key: 'pageCallHistory', name: '通话记录', emoji: '📞', color: 'icon-green' },
  { key: 'pageCheckinHistory', name: '查岗记录', emoji: '🔍', color: 'icon-orange' },
  { key: 'pageBeautify', name: '外观美化', emoji: '🎨', color: 'icon-pink' },
  { key: 'pageSettings', name: '设置', emoji: '⚙️', color: 'icon-gray' },
  { key: 'pageFavorites', name: '收藏箱', emoji: '⭐', color: 'icon-orange' },
  { key: 'pageDiary', name: '日记', emoji: '📔', color: 'icon-orange' },
  { key: 'pageCompanion', name: '陪伴', emoji: '🐾', color: 'icon-blue' },
  { key: 'pageMailbox', name: '信箱', emoji: '✉️', color: 'icon-blue' },
];

// ===== 1. 渲染主页图标 =====
var APP_PER_PAGE = 24; // 每页 4×6

function initAppPages() {
  if (state.appPages && Array.isArray(state.appPages) && state.appPages.length > 0) return;
  var keys = ICONS_CONFIG.map(function(item) { return item.key; });
  var pages = [];
  for (var i = 0; i < keys.length; i += APP_PER_PAGE) {
    pages.push(keys.slice(i, i + APP_PER_PAGE));
  }
  state.appPages = pages;
  saveState();
}

function renderAppIcons() {
  initAppPages();
  var home = document.getElementById('pageHome');
  if (!home) return;

  var oldGrid = document.getElementById('homeAppGrid');
  if (oldGrid) oldGrid.remove();
  var oldPager = document.getElementById('homePager');
  if (oldPager) oldPager.remove();

  // 外层容器（横向滚动）
  var container = document.createElement('div');
  container.id = 'homeSwiper';
  container.style.cssText = 'display:flex;width:100%;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;';
  container.style.scrollbarWidth = 'none';

  // 每一页
  state.appPages.forEach(function(pageKeys, pageIdx) {
    var page = document.createElement('div');
    page.className = 'app-grid';
    page.dataset.pageIndex = pageIdx;
    page.style.cssText = 'flex-shrink:0;width:100%;scroll-snap-align:start;';

    // 24 个槽位（不足补空）
    for (var slot = 0; slot < APP_PER_PAGE; slot++) {
      var key = pageKeys[slot];
      if (!key) {
        // 空槽
        var empty = document.createElement('div');
        empty.className = 'app-icon-slot';
        empty.dataset.pageIndex = pageIdx;
        empty.dataset.slotIndex = slot;
        empty.style.cssText = 'width:100%;height:82px;'
        page.appendChild(empty);
        continue;
      }

      var item = ICONS_CONFIG.find(function(x) { return x.key === key; });
      if (!item) continue;

      var customIcon = state.settings.customIcons && state.settings.customIcons[item.key];
      var iconDiv = document.createElement('div');
      iconDiv.className = 'app-icon';
      iconDiv.dataset.pageIndex = pageIdx;
      iconDiv.dataset.slotIndex = slot;
      iconDiv.dataset.appKey = key;
           iconDiv.onclick = function() { 
        if (window.appEditMode) return;
        navigateTo(this.dataset.appKey); 
      };

      var imgDiv = document.createElement('div');
      imgDiv.className = 'app-icon-img ' + item.color;
      if (customIcon) {
        imgDiv.innerHTML = '<img src="' + customIcon + '" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">';
        imgDiv.style.background = 'transparent';
        imgDiv.style.border = 'none';
      } else {
        imgDiv.textContent = item.emoji;
      }

      var textDiv = document.createElement('div');
      textDiv.className = 'app-icon-text';
      textDiv.textContent = item.name;

      iconDiv.appendChild(imgDiv);
      iconDiv.appendChild(textDiv);
      page.appendChild(iconDiv);
    }

    container.appendChild(page);
  });

  // 插到主页的第一个位置
  var mainContent = document.getElementById('pageHome');
  mainContent.innerHTML = '';
  mainContent.appendChild(container);

    // 底部小点（只有超过 1 页才显示）
  if (state.appPages.length > 1) {
    var pager = document.createElement('div');
    pager.id = 'homePager';
    pager.style.cssText = 'display:flex;justify-content:center;gap:6px;padding:12px 0;';
    state.appPages.forEach(function(_, idx) {
      var dot = document.createElement('span');
      dot.dataset.pageDot = idx;
      dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:' + (idx === 0 ? 'var(--blue)' : 'rgba(0,0,0,0.15)') + ';transition:background 0.2s;';
      pager.appendChild(dot);
    });
    mainContent.appendChild(pager);

    container.addEventListener('scroll', function() {
      var idx = Math.round(container.scrollLeft / container.offsetWidth);
      var dots = pager.querySelectorAll('span');
      dots.forEach(function(d, i) {
        d.style.background = (i === idx) ? 'var(--blue)' : 'rgba(0,0,0,0.15)';
      });
    });
  }
}

// ===== 2. 渲染美化页的图标设置面板 =====
function renderIconSettings() {
  const grid = document.getElementById('iconSettingsGrid');
  if (!grid) return;
  grid.innerHTML = ICONS_CONFIG.map(item => {
    const customIcon = state.settings.customIcons && state.settings.customIcons[item.key];
    return `
      <div class="icon-setting-item">
        <div class="icon-setting-preview ${item.color}">
          ${customIcon ? `<img src="${customIcon}" style="width:100%;height:100%;border-radius:10px;object-fit:cover;">` : `<span style="font-size:20px;">${item.emoji}</span>`}
        </div>
        <div class="icon-setting-name">${item.name}</div>
        <label class="icon-setting-btn">
          上传
          <input type="file" accept="image/*" style="display:none" onchange="handleIconUpload(event, '${item.key}')">
        </label>
      </div>
    `;
  }).join('');
}

// ===== INIT =====
async functioninit(){
  await loadState()
  loadChatMessages();
  renderChatMessages();
  renderAll();
  renderAppIcons();
  renderAnniversaryWidget();
  bindAppDrag();
  renderIconSettings();  
  updateTime();
  setInterval(updateTime, 1000);
  startRandomEvents();
  setInterval(checkAutoMessage, 30000);
  setupPush();
  setupChatBg();
  applyBeautySettings();
  initSpeedSettings();
  checkAutoDiary();
  applyHomeBg();
    checkMailDelivery();
  setInterval(checkMailDelivery, 30000);
}

// ===== PERSISTENCE =====
function saveState() {
  var data = JSON.stringify(state);
  storage.setItem('dreamCheckState', data).then(function() {
    // 成功，什么都不做
  }).catch(function(e) {
    // 万一 IndexedDB 也存不下（几乎不可能），自动压缩一次
    try {
      var compact = JSON.parse(data);
      if (compact.chatSessions) {
        for (var k in compact.chatSessions) {
          var msgs = compact.chatSessions[k];
          if (!msgs || msgs.length === 0) continue;
          if (msgs.length > 80) msgs = msgs.slice(-80);
          for (var i = 0; i < msgs.length - 10; i++) {
            if (msgs[i] && msgs[i].stickerData) delete msgs[i].stickerData;
            if (msgs[i] && msgs[i].type === 'image') delete msgs[i].imageData;
          }
          compact.chatSessions[k] = msgs;
        }
      }
      storage.setItem('dreamCheckState', JSON.stringify(compact));
      state.chatSessions = compact.chatSessions;
      showToast('存储空间不足，已自动压缩历史数据');
    } catch(e2) {
      showToast('⚠️ 保存失败：' + e.message);
    }
  });
}

async function loadState() {
  try {
    // 先从 IndexedDB 读
    var saved = await storage.getItem('dreamCheckState');
    // 如果 IndexedDB 没数据，尝试从旧的 localStorage 读（迁移旧数据用）
    if (!saved) {
      var oldSaved = localStorage.getItem('dreamCheckState');
      if (oldSaved) {
        saved = oldSaved;
        // 迁移到 IndexedDB
        await storage.setItem('dreamCheckState', oldSaved);
        // 保留 localStorage 一份做备份，不删
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.profile) state.profile = parsed.profile;
      if (parsed.dream) state.dream = parsed.dream;
      if (parsed.dreams) state.dreams = parsed.dreams;
      if (parsed.groups) state.groups = parsed.groups;
      if (parsed.chatSessions) state.chatSessions = parsed.chatSessions;
      if (parsed.currentChatId) state.currentChatId = parsed.currentChatId;
      if (parsed.categories) state.categories = parsed.categories;
      if (parsed.cards) state.cards = parsed.cards;
      if (parsed.callHistory) state.callHistory = parsed.callHistory;
      if (parsed.checkinHistory) state.checkinHistory = parsed.checkinHistory;
      if (parsed.settings) state.settings = parsed.settings;
      if (parsed.nextCallId) state.nextCallId = parsed.nextCallId;
      if (parsed.nextCheckinId) state.nextCheckinId = parsed.nextCheckinId;
      if (parsed.pokes) state.pokes = parsed.pokes;
      if (parsed.diaries) state.diaries = parsed.diaries;
      if (parsed.favorites) state.favorites = parsed.favorites;
      if (parsed.anniversaries) state.anniversaries = parsed.anniversaries;
      if (parsed.mails) state.mails = parsed.mails;
      if (parsed.mutedChats) state.mutedChats = parsed.mutedChats;
      if (parsed.lastReadAt) state.lastReadAt = parsed.lastReadAt;
      if (parsed.lastActivityAt) state.lastActivityAt = parsed.lastActivityAt;
      if (parsed.compSelectedDreamId) state.compSelectedDreamId = parsed.compSelectedDreamId;
      if (parsed.userDiaryLastDate) state.userDiaryLastDate = parsed.userDiaryLastDate;
      if (parsed.appPages) state.appPages = parsed.appPages;
    }
  } catch(e) {
    console.error('loadState 出错：', e);
  }
}

// ===== TIME =====
function updateTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('statusTime').textContent = h + ':' + m;
}

// ===== NAVIGATION =====
function navigateTo(pageId) {
  // 1. 先隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // 2. 如果是主页，直接显示，结束
  if (pageId === 'pageHome') {
    document.querySelector('.main-content').style.display = 'block';
    return;
  }
  
  // 3. 隐藏主页内容区
  document.querySelector('.main-content').style.display = 'none';
  
  // 4. 寻找目标页面
  var page = document.getElementById(pageId);
  if (!page) {
    console.error('致命错误：找不到页面 [', pageId, ']，请检查 HTML 里是否有这个 id！');
    // 如果找不到，强行回到主页防止白屏
    document.querySelector('.main-content').style.display = 'block';
    return;
  }
  
  // 5. 显示目标页面
  page.classList.add('active');
  
  // 6. 根据页面触发对应的渲染逻辑
  try {
    if (pageId === 'pageWordCards') renderWordCards();
    if (pageId === 'pageCallHistory') renderCallHistory();
    if (pageId === 'pageCheckinHistory') renderCheckinHistory();
    if (pageId === 'pageProfile') loadProfileForm();
    if (pageId === 'pageDreamRole') renderDreamRoles();
    if (pageId === 'pageChatList') renderChatList();
    if (pageId === 'pageCompanion') compInit();
        if (pageId === 'pageMailbox') { switchMailTab('inbox'); renderMailList(); }
    if (pageId === 'pageWriteLetter') { /* 由 openWriteLetter 初始化 */ }
    if (pageId === 'pageFavorites') renderFavorites();
    if (pageId === 'pageDiary') renderDiaryList();
    if (pageId === 'pagePrivateChat') { loadChatMessages(); renderChat(); }
    if (pageId === 'pageCreateGroup') createGroupChat();
    if (pageId === 'pageGroupSettings') renderGroupSettings();
  } catch (err) {
    console.error('页面渲染出错：', pageId, err);
  }
}

// ===== PROFILE =====
function loadProfileForm() {
  document.getElementById('profileName').value = state.profile.name || '我';
  document.getElementById('profileStatus').value = state.profile.status || '在线';
  if (state.profile.avatar) {
    document.getElementById('profileAvatarPreview').src = state.profile.avatar;
  }
}

function handleProfileAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    state.profile.avatar = ev.target.result;
    document.getElementById('profileAvatarPreview').src = ev.target.result;
    saveState();
    showToast('头像已更新');
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  state.profile.name = document.getElementById('profileName').value || '我';
  state.profile.status = document.getElementById('profileStatus').value || '在线';
  saveState();
  showToast('个人资料已保存');
}

// ===== DREAM ROLE =====
// ===== 梦角列表渲染 =====
function renderDreamRoles() {
  var container = document.getElementById('dreamListContainer');
  if (!container) return;
  
  // 如果没有多梦角数据，就把旧的 single dream 转换成列表里的一项
  if (!state.dreams || state.dreams.length === 0) {
    if (state.dream) {
      state.dreams = [Object.assign({ id: 'dream_1' }, state.dream)];
    } else {
      state.dreams = [{ id: 'dream_1', name: '沈屿', gender: '男', avatar: '' }];
    }
    saveState();
  }

  container.innerHTML = state.dreams.map(function(d) {
    var avatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 80 80%27%3E%3Ccircle cx=%2740%27 cy=%2740%27 r=%2740%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2740%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2728%27%3E💜%3C/text%3E%3C/svg%3E';
    return `
      <div class="contact-item" onclick="openEditDreamRole('${d.id}')">
        <img class="contact-avatar" src="${avatar}">
        <div class="contact-info">
          <div class="contact-name">${d.name || '未命名'}</div>
          <div class="contact-desc">点击编辑信息</div>
        </div>
        <div class="contact-edit-btn">编辑</div>
      </div>
    `;
  }).join('');
}

// 新增梦角
function addDreamRole() {
  var newId = 'dream_' + Date.now();
  state.dreams.push({ id: newId, name: '新梦角', gender: '男', avatar: '' });
  saveState();
  renderDreamRoles();
  openEditDreamRole(newId);
}

// 打开编辑页
function openEditDreamRole(id) {
  var d = state.dreams.find(function(item) { return item.id === id; });
  if (!d) return;
  state.currentEditDreamId = id;
  
  document.getElementById('editDreamTitle').textContent = '编辑：' + d.name;
  document.getElementById('dreamName').value = d.name || '';
  document.getElementById('dreamGender').value = d.gender || '男';
  
  if (d.avatar) {
    document.getElementById('dreamAvatarPreview').src = d.avatar;
  } else {
    document.getElementById('dreamAvatarPreview').src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 80 80%27%3E%3Ccircle cx=%2740%27 cy=%2740%27 r=%2740%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2740%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2728%27%3E💜%3C/text%3E%3C/svg%3E';
  }
  
  navigateTo('pageEditDreamRole');
}

// 处理头像上传（带压缩）
function handleDreamAvatar(e) {
  const file = e.target.files[0];
  if (!file || !state.currentEditDreamId) return;
  
  const reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_SIZE = 200;
      var width = img.width;
      var height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      document.getElementById('dreamAvatarPreview').src = compressedDataUrl;
      var d = state.dreams.find(function(item) { return item.id === state.currentEditDreamId; });
      if (d) {
        d.avatar = compressedDataUrl;
        saveState();
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// 保存梦角
function saveDreamRole() {
  if (!state.currentEditDreamId) return;
  var d = state.dreams.find(function(item) { return item.id === state.currentEditDreamId; });
  if (!d) return;
  
  d.name = document.getElementById('dreamName').value || '未命名';
  d.gender = document.getElementById('dreamGender').value || '男';
  
  // 【重要兼容补丁】：把当前编辑的梦角，同步给旧的 state.dream，防止聊天功能报错
  state.dream = Object.assign({}, d);
  
  saveState();
  renderDreamRoles();
  showToast('梦角信息已保存');
  navigateTo('pageDreamRole');
}

// 删除梦角
function deleteDreamRole() {
  if (!state.currentEditDreamId) return;
  if (!confirm('确定要删除这个梦角吗？聊天记录也会一并删除哦！')) return;
  
  state.dreams = state.dreams.filter(function(item) { return item.id !== state.currentEditDreamId; });
  state.currentEditDreamId = null;
  saveState();
  renderDreamRoles();
  showToast('梦角已删除');
  navigateTo('pageDreamRole');
}

// ===== WORD CARDS =====
// ===== 替换 renderWordCards 函数 =====
function renderWordCards() {
  const catSelect = document.getElementById('batchCategory');
  if (catSelect) {
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  const container = document.getElementById('wordCardsContainer');
  container.innerHTML = '';
  
  state.categories.forEach(cat => {
    const cards = state.cards.filter(c => c.cat === cat.id);
    const group = document.createElement('div');
    group.className = 'category-group';
    const collapsed = cat.collapsed || false;
    
    // 生成字卡列表的 HTML
    let cardsHtml = '';
    if (cards.length === 0) {
      cardsHtml = '<div style="font-size:12px;color:var(--gray);padding:4px 0;">暂无字卡</div>';
    } else {
      cardsHtml = '<div class="card-list">';
      cards.forEach(c => {
        cardsHtml += `
          <div class="card-item">
            <div class="card-item-text">${c.text}</div>
            <div class="card-item-actions">
              <span onclick="editCard('${c.id}')" title="编辑">✎</span>
              <span onclick="deleteCard('${c.id}')" title="删除">🗑️</span>
            </div>
          </div>
        `;
      });
      cardsHtml += '</div>';
    }

    group.innerHTML = `
      <div class="category-header" onclick="toggleCategory('${cat.id}')">
        <span class="cat-name">${cat.name}（${cards.length}）</span>
        <div>
          <span class="delete-cat-btn" onclick="event.stopPropagation();deleteCategory('${cat.id}')">🗑</span>
          <span class="cat-toggle ${collapsed ? 'collapsed' : ''}">▼</span>
        </div>
      </div>
      <div class="category-body ${collapsed ? 'hidden' : ''}" id="catBody_${cat.id}">
        ${cardsHtml}
        <div class="add-card-area" style="margin-top:12px;">
          <input type="text" id="cardInput_${cat.id}" placeholder="输入新字卡" onkeydown="if(event.key==='Enter')addCard('${cat.id}')">
          <button onclick="addCard('${cat.id}')">添加</button>
        </div>
      </div>
    `;
    container.appendChild(group);
  });
}

// ===== 新增：编辑单条字卡 =====
function editCard(cardId) {
  var card = state.cards.find(function(c) { return c.id === cardId; });
  if (!card) return;
  
  // 弹出系统自带的输入框（目前最稳妥的手机端方案）
  var newText = prompt('编辑字卡内容：', card.text);
  
  // 如果用户点了取消，或者输入为空，就不改
  if (newText !== null && newText.trim() !== '') {
    card.text = newText.trim();
    saveState();
    renderWordCards();
    showToast('字卡已更新');
  }
}

function toggleCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (cat) {
    cat.collapsed = !cat.collapsed;
    saveState();
    renderWordCards();
  }
}

function addCategory() {
  const name = prompt('输入分类名称：');
  if (!name || name.trim() === '') return;
  const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  state.categories.push({ id, name: name.trim(), collapsed: false });
  saveState();
  renderWordCards();
  showToast('分类已添加');
}

function deleteCategory(catId) {
  // 解除了默认分类不能删除的限制
  if (!confirm('删除此分类及其所有字卡？此操作不可恢复！')) return;
  
  // 过滤掉要删除的分类和它下面的所有字卡
  state.cards = state.cards.filter(c => c.cat !== catId);
  state.categories = state.categories.filter(c => c.id !== catId);
  
  // 安全兜底：如果所有的分类都被删光了，自动补一个默认分类
  if (state.categories.length === 0) {
    state.categories.push({ id: 'default', name: '默认', collapsed: false });
  }
  
  saveState();
  renderWordCards();
  showToast('分类已删除');
}

function addCard(catId) {
  const input = document.getElementById('cardInput_' + catId);
  const text = input.value.trim();
  if (!text) return;
  state.cards.push({ id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), text, cat: catId });
  input.value = '';
  saveState();
  renderWordCards();
}

function deleteCard(cardId) {
  state.cards = state.cards.filter(c => c.id !== cardId);
  saveState();
  renderWordCards();
}

function batchAddCards() {
  const text = document.getElementById('batchText').value;
  const lines = text.split('\n').map(s => s.trim()).filter(s => s);
  if (lines.length === 0) { showToast('请输入字卡'); return; }
  const targetCat = document.getElementById('batchCategory').value || state.categories[0]?.id || 'default';
  lines.forEach(line => {
    state.cards.push({ id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), text: line, cat: targetCat });
  });
  saveState();
  renderWordCards();
  showToast('已添加 ' + lines.length + ' 个字卡');
}

// ===== CALL HISTORY =====
function renderCallHistory() {
  const list = document.getElementById('callHistoryList');
  if (state.callHistory.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无通话记录</div>';
    return;
  }
  list.innerHTML = state.callHistory.slice().reverse().map(c => {
    const time = new Date(c.timestamp);
    const timeStr = time.getMonth()+1 + '/' + time.getDate() + ' ' + String(time.getHours()).padStart(2,'0') + ':' + String(time.getMinutes()).padStart(2,'0');
    let statusLabel, statusClass;
    if (c.type === 'answered') { statusLabel = '已接听'; statusClass = 'answered'; }
    else if (c.type === 'missed') { statusLabel = '未接听'; statusClass = 'missed'; }
    else { statusLabel = '已挂断'; statusClass = 'hung'; }
    const dur = c.duration ? formatDuration(c.duration) : '--';
    return `<div class="history-item">
      <div class="hi-left">
        <div class="hi-main">${state.dream.name || '梦角'} <span class="hi-status ${statusClass}">${statusLabel}</span></div>
        <div class="hi-time">${timeStr}</div>
      </div>
      <div class="hi-right">${dur}</div>
    </div>`;
  }).join('');
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

// ===== CHECKIN HISTORY =====
function renderCheckinHistory() {
  const list = document.getElementById('checkinHistoryList');
  if (state.checkinHistory.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无查岗记录</div>';
    return;
  }
  list.innerHTML = state.checkinHistory.slice().reverse().map(c => {
    const time = new Date(c.timestamp);
    const timeStr = time.getMonth()+1 + '/' + time.getDate() + ' ' + String(time.getHours()).padStart(2,'0') + ':' + String(time.getMinutes()).padStart(2,'0');
    return `<div class="history-item">
      <div class="hi-left">
        <div class="hi-main">${c.message || '查岗消息'}</div>
        <div class="hi-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== SETTINGS =====
function handleCallBg(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    state.settings.callBg = ev.target.result;
    saveState();
    showToast('通话背景已设置');
  };
  reader.readAsDataURL(file);
}

function handleCheckinBg(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    state.settings.checkinBg = ev.target.result;
    saveState();
    showToast('查岗背景已设置');
  };
  reader.readAsDataURL(file);
}

function backupData() {
  var data = {
    state: state,
    chatMessages: chatMessages,
    // 补充：表情包、私聊背景、陪伴设置、聊天设置
    stickers: JSON.parse(localStorage.getItem('dreamStickers') || '[]'),
    dreamChatBg: localStorage.getItem('dreamChatBg') || null,
    dreamChatSettings: localStorage.getItem('dreamChatSettings') || null,
    comp_bg: localStorage.getItem('comp_bg') || null,
    comp_color: localStorage.getItem('comp_color') || null,
    comp_fontsize: localStorage.getItem('comp_fontsize') || null,
    comp_bgblur: localStorage.getItem('comp_bgblur') || null,
    comp_avatar: localStorage.getItem('comp_avatar') || null,
    version: 2
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Mind_备份_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('数据已备份（含表情/背景/陪伴）');
}

function restoreData(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      // 恢复 state
      if (data.state) {
        Object.assign(state, data.state);
        if (data.chatMessages) chatMessages = data.chatMessages;
      } else {
        Object.assign(state, data);
        if (data.chatMessages) chatMessages = data.chatMessages;
      }
      // 恢复表情包
      if (data.stickers) {
        try { localStorage.setItem('dreamStickers', JSON.stringify(data.stickers)); } catch(e) {}
      }
      // 恢复私聊聊天背景
      if (data.dreamChatBg) {
        localStorage.setItem('dreamChatBg', data.dreamChatBg);
      } else if (data.dreamChatBg === null && data.version >= 2) {
        localStorage.removeItem('dreamChatBg');
      }
      // 恢复聊天设置
      if (data.dreamChatSettings) {
        localStorage.setItem('dreamChatSettings', data.dreamChatSettings);
      }
      // 恢复陪伴设置
      if (data.comp_bg) localStorage.setItem('comp_bg', data.comp_bg);
      if (data.comp_color) localStorage.setItem('comp_color', data.comp_color);
      if (data.comp_fontsize) localStorage.setItem('comp_fontsize', data.comp_fontsize);
      if (data.comp_bgblur) localStorage.setItem('comp_bgblur', data.comp_bgblur);
      if (data.comp_avatar) localStorage.setItem('comp_avatar', data.comp_avatar);

      saveState();
      if (typeof renderAll === 'function') renderAll();
      showToast('数据已恢复（含表情/背景/陪伴）');
      // 延迟刷新，让状态全部加载
      setTimeout(function() { location.reload(); }, 800);
    } catch(err) {
      showToast('备份文件格式错误');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function togglePush() {
  state.settings.pushEnabled = !state.settings.pushEnabled;
  const toggle = document.getElementById('pushToggle');
  toggle.classList.toggle('on', state.settings.pushEnabled);
  saveState();
  if (state.settings.pushEnabled) {
    requestPushPermission();
  }
  showToast(state.settings.pushEnabled ? '推送已开启' : '推送已关闭');
}

function setupPush() {
  const toggle = document.getElementById('pushToggle');
  toggle.classList.toggle('on', state.settings.pushEnabled);
  document.getElementById('pushToggle').onclick = togglePush;
}

async function requestPushPermission() {
  if (!('Notification' in window)) { showToast('不支持通知'); return; }
  if (Notification.permission === 'granted') {
    // CodePen 环境屏蔽 Service Worker 注册，但本地没问题
    if ('serviceWorker' in navigator) registerSW();
  } else if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if ('serviceWorker' in navigator) registerSW();
    }
    else { showToast('请允许通知权限'); state.settings.pushEnabled = false; document.getElementById('pushToggle').classList.remove('on'); saveState(); }
  } else {
    showToast('通知已被拒绝'); state.settings.pushEnabled = false; document.getElementById('pushToggle').classList.remove('on'); saveState();
  }
}

async function registerSW() {
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    showToast('推送已开启');
  } catch(e) {
    showToast('推送注册失败（预览环境不支持）');
  }
}

// ===== RANDOM EVENTS =====
function startRandomEvents() {
  setInterval(() => {
    if (state.callState !== 'idle') return;
    if (Math.random() < 0.4) {
      triggerRandomEvent();
    }
  }, 45000);
}

function triggerRandomEvent() {
  var r = Math.random();
  if (r < 0.2) {
    if (state.callState === 'idle') triggerCall();
  } else if (r < 0.6) {
    if (state.callState === 'idle') triggerCheckin();
  } else {
    var allCards = state.cards || [];
    if (allCards.length > 0 && state.dreams && state.dreams.length > 0) {
      var card = allCards[Math.floor(Math.random() * allCards.length)];
      
      // 随机挑一个梦角来给你发消息
      var randomDream = state.dreams[Math.floor(Math.random() * state.dreams.length)];
      
      // 如果是当前打开的聊天窗口，就追加进去
      var chatPage = document.getElementById('pagePrivateChat');
      if (chatPage && chatPage.classList.contains('active') && state.currentChatId) {
         // 如果是群聊，找群里的随机人发
         if (state.currentChatId.startsWith('group_')) {
           var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
           if (g && g.memberIds.length > 0) {
             var randomId = g.memberIds[Math.floor(Math.random() * g.memberIds.length)];
             var member = state.dreams.find(function(d) { return d.id === randomId; });
             if (member) randomDream = member;
           }
         }
         chatMessages.push({ from: 'dream', senderId: randomDream.id, senderAvatar: randomDream.avatar, text: card.text, time: Date.now() });
         saveChatMessages();
         renderChatMessages();
      }
    }
  }
}

// ===== VOICE CALL =====
function triggerCall() {
  if (state.callState !== 'idle') {
    // 【忙音】用户正在通话时，其他人打来，在对应聊天显示小字
    var busyCaller = null;
    if (state.currentChatId && state.currentChatId.startsWith('group_')) {
      var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
      if (g && g.memberIds.length > 0) {
        var rid = g.memberIds[Math.floor(Math.random() * g.memberIds.length)];
        busyCaller = state.dreams.find(function(d) { return d.id === rid; });
      }
    } else if (state.currentChatId) {
      busyCaller = state.dreams.find(function(d) { return d.id === state.currentChatId; });
    }
    if (!busyCaller && state.dreams && state.dreams.length > 0) {
      busyCaller = state.dreams[Math.floor(Math.random() * state.dreams.length)];
    }
    if (busyCaller && state.currentChatId) {
      if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
      state.chatSessions[state.currentChatId].push({
        from: 'system',
        text: '「' + busyCaller.name + '」打来电话，但你正在通话中，请稍候再试',
        time: Date.now()
      });
      saveState();
      loadChatMessages();
      renderChatMessages();
      showToast('「' + busyCaller.name + '」来电，你正忙');
    }
    return;
  }

  // 【核心修复】：决定是谁打来的电话
  var caller = null;
  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    // 如果是群聊，随机抽一个群成员
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g && g.memberIds.length > 0) {
      var randomId = g.memberIds[Math.floor(Math.random() * g.memberIds.length)];
      caller = state.dreams.find(function(d) { return d.id === randomId; });
    }
  } else if (state.currentChatId) {
    // 如果是私聊，直接让当前私聊对象打来
    caller = state.dreams.find(function(d) { return d.id === state.currentChatId; });
  }
  
  // 兜底：如果没找到，从所有梦角里随机抽一个
  if (!caller && state.dreams && state.dreams.length > 0) {
    caller = state.dreams[Math.floor(Math.random() * state.dreams.length)];
  }
  // 如果连梦角都没有，就使用旧的默认数据
  if (!caller) caller = state.dream || { name: '沈屿', avatar: '' };

  state.callState = 'ringing';
  
  var avatar = caller.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 80 80%27%3E%3Ccircle cx=%2740%27 cy=%2740%27 r=%2740%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2740%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2728%27%3E💜%3C/text%3E%3C/svg%3E';
  document.getElementById('callAvatar').src = avatar;
  document.getElementById('callName').textContent = caller.name;
  document.getElementById('callStatus').textContent = '来电中…';
  document.getElementById('callTimer').classList.remove('show');
  document.getElementById('callButtons').innerHTML = `
    <button class="call-btn hangup" onclick="hangupCall()">☎</button>
    <button class="call-btn answer" onclick="answerCall()">📞</button>
  `;
  
  if (state.settings.callBg) {
    document.getElementById('callCard').style.background = `url(${state.settings.callBg}) center/cover, linear-gradient(145deg,#1a1a2e,#16213e)`;
  } else {
    document.getElementById('callCard').style.background = 'linear-gradient(145deg,#1a1a2e,#16213e)';
  }
  
  document.getElementById('callOverlay').classList.add('active');
  document.getElementById('callMini').classList.remove('show');
  sendNotification(caller.name, '来电了…');

  // 记录通话历史时，也顺便记录是谁打来的
  setTimeout(() => {
    if (state.callState === 'ringing') {
      state.callHistory.push({
        id: state.nextCallId++,
        type: 'missed',
        callerName: caller.name, // 新增：记录来电人名字
        timestamp: Date.now(),
        duration: 0
      });
      state.callState = 'idle';
      document.getElementById('callOverlay').classList.remove('active');
      saveState();
      showToast('未接来电 - ' + caller.name);
      sendNotification(caller.name, '你有一个未接来电');
    }
  }, 15000);
}

function answerCall() {
  if (state.callState !== 'ringing') return;
  state.callState = 'connected';
  state.callStartTime = Date.now();
  state.callElapsed = 0;
  document.getElementById('callStatus').textContent = '通话中';
  document.getElementById('callTimer').classList.add('show');
  document.getElementById('callButtons').innerHTML = `
    <button class="call-btn minimize" onclick="minimizeCall()">−</button>
    <button class="call-btn hangup" onclick="hangupCall()">☎</button>
  `;
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => {
    state.callElapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    document.getElementById('callTimer').textContent = formatDuration(state.callElapsed);
    document.getElementById('miniTime').textContent = formatDuration(state.callElapsed).slice(0,5);
  }, 1000);
  state.callHistory.push({
    id: state.nextCallId++,
    type: 'answered',
    timestamp: Date.now(),
    duration: 0
  });
  saveState();
}

function hangupCall() {
  if (state.callState === 'idle') return;
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = null;

  var sysText = '';
  if (state.callState === 'ringing') {
    state.callHistory.push({ id: state.nextCallId++, type: 'hung', timestamp: Date.now(), duration: 0 });
    sysText = '已挂断';
  } else if (state.callState === 'connected') {
    var dur = Math.floor((Date.now() - state.callStartTime) / 1000);
    for (var i = state.callHistory.length - 1; i >= 0; i--) {
      if (state.callHistory[i].type === 'answered' && state.callHistory[i].duration === 0) {
        state.callHistory[i].duration = dur; break;
      }
    }
    sysText = '通话时长 ' + formatDuration(dur).slice(3);
  } else if (state.callState === 'dialing' || state.callState === 'minimized') {
    sysText = '已挂断';
  }

  if (sysText && state.currentChatId) {
    if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
    state.chatSessions[state.currentChatId].push({ from: 'system', text: sysText, time: Date.now() });
    saveState();
    loadChatMessages();
    renderChatMessages();
  }

  state.callState = 'idle';
  document.getElementById('callOverlay').classList.remove('active');
  document.getElementById('callMini').classList.remove('show');
  saveState();
}

function minimizeCall() {
  if (state.callState !== 'connected') return;
  state.callState = 'minimized';
  document.getElementById('callOverlay').classList.remove('active');
  const avatar = state.dream.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2716%27 y=%2720%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2716%27%3E💜%3C/text%3E%3C/svg%3E';
  document.getElementById('miniAvatar').src = avatar;
  document.getElementById('miniTime').textContent = formatDuration(state.callElapsed).slice(0,5);
  document.getElementById('callMini').classList.add('show');
}

function expandCall() {
  if (window.callMiniMoved) return;
  if (state.callState !== 'minimized') return;
  state.callState = 'connected';
  document.getElementById('callMini').classList.remove('show');
  document.getElementById('callOverlay').classList.add('active');
  document.getElementById('callStatus').textContent = '通话中';
  document.getElementById('callTimer').classList.add('show');
  document.getElementById('callButtons').innerHTML = `
    <button class="call-btn minimize" onclick="minimizeCall()">−</button>
    <button class="call-btn hangup" onclick="hangupCall()">☎</button>
  `;
  if (state.settings.callBg) {
    document.getElementById('callCard').style.background = `url(${state.settings.callBg}) center/cover, linear-gradient(145deg,#1a1a2e,#16213e)`;
  } else {
    document.getElementById('callCard').style.background = 'linear-gradient(145deg,#1a1a2e,#16213e)';
  }
}

// ===== CHECK-IN =====
function triggerCheckin() {
  if (state.callState !== 'idle') return;
  
  // 【核心修复】：决定是谁在查岗
  var checker = null;
  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g && g.memberIds.length > 0) {
      var randomId = g.memberIds[Math.floor(Math.random() * g.memberIds.length)];
      checker = state.dreams.find(function(d) { return d.id === randomId; });
    }
  } else if (state.currentChatId) {
    checker = state.dreams.find(function(d) { return d.id === state.currentChatId; });
  }
  if (!checker && state.dreams && state.dreams.length > 0) {
    checker = state.dreams[Math.floor(Math.random() * state.dreams.length)];
  }
  if (!checker) checker = state.dream || { name: '沈屿', avatar: '' };

  var allCards = state.cards;
  if (allCards.length === 0) return;
  
  const count = 1;
  const shuffled = [...allCards].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  
  var avatar = checker.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2744%27 height=%2744%27 viewBox=%270 0 44 44%27%3E%3Ccircle cx=%2722%27 cy=%2722%27 r=%2722%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2722%27 y=%2726%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
  document.getElementById('ciAvatar').src = avatar;
  document.getElementById('ciName').textContent = checker.name;
  
  if (state.settings.checkinBg) {
    document.getElementById('checkinCard').style.background = `url(${state.settings.checkinBg}) center/cover, var(--card)`;
  } else {
    document.getElementById('checkinCard').style.background = 'var(--card)';
  }
  
  const messagesDiv = document.getElementById('ciMessages');
  messagesDiv.innerHTML = selected.map(c => `<div class="ci-msg">${c.text}</div>`).join('');
  
  document.getElementById('checkinOverlay').classList.add('active');
  
  const msgText = selected.map(c => c.text).join(' | ');
  state.checkinHistory.push({
    id: state.nextCheckinId++,
    message: msgText.length > 50 ? msgText.slice(0,50) + '…' : msgText,
    timestamp: Date.now(),
    fullMessages: selected.map(c => c.text)
  });
  saveState();
  
  sendNotification(checker.name, selected[0].text);
  
  setTimeout(() => {
    closeCheckin();
  }, 8000);
}

function closeCheckin() {
  document.getElementById('checkinOverlay').classList.remove('active');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g,'+').replace(/_/g,'/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ===== NOTIFICATION =====
async function sendNotification(title, body) {
  if (!state.settings.pushEnabled) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body: body,
      icon: state.dream.avatar || '',
      tag: 'dream-' + Date.now(),
      requireInteraction: true,
      vibrate: [200,100,200]
    });
  } catch(e) {
    try {
      const n = new Notification(title, {
        body: body,
        icon: state.dream.avatar || '',
        tag: 'dream-' + Date.now(),
        requireInteraction: true
      });
      setTimeout(() => n.close(), 5000);
    } catch(err) {}
  }
}

// ===== CHAT =====
let chatMessages = [];
let chatSettings = loadChatSettings();
let stickers = JSON.parse(localStorage.getItem('dreamStickers') || '[]');

function saveChatMessages() {
  if (!state.currentChatId) return;
  state.chatSessions[state.currentChatId] = JSON.parse(JSON.stringify(chatMessages));
  // 记录"最后互动时间"，用来判断多久没聊天
  if (!state.lastActivityAt) state.lastActivityAt = {};
  state.lastActivityAt[state.currentChatId] = Date.now();
  saveState();
}

function loadChatMessages() {
  if (!state.currentChatId) {
    chatMessages = [];
    return;
  }
  
  var rawMessages = state.chatSessions[state.currentChatId] || [];
  
  // 【终极修复】：强制清洗掉所有的 null、undefined 等脏数据
  chatMessages = rawMessages.filter(function(msg) {
    return msg && typeof msg === 'object' && msg.from !== undefined;
  });
  
  // 如果清洗后数据有变化，顺手保存一下干净的记录
  if (chatMessages.length !== rawMessages.length) {
    state.chatSessions[state.currentChatId] = chatMessages;
    saveState();
  }
}

var replyTimeout = null; // 新增：用来存那个“AI回复的闹钟”

window.replyTimeout = null; // 挂在全局，确保处处都能杀掉这个闹钟

function sendChatMsg() {
  var input = document.getElementById('chatInput');
  var text = input.value.trim();
  if (text.length === 0) return;

  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g) {
      checkExpiredMutes(g); 
      if (g.muteEndsAt && g.muteEndsAt[String('user')] !== undefined) {
        var remainMins = Math.ceil((g.muteEndsAt[String('user')] - Date.now()) / 60000);
        showToast('你已被群主禁言，还剩 ' + remainMins + ' 分钟');
        return; 
      }
    }
  }

  // 新增：status: 'unread' 表示未读
    var newMsg = { from: 'user', text: text, time: Date.now(), status: 'unread' };
  if (window.quoteData) {
    newMsg.quote = window.quoteData;
    clearQuote();
  }
  chatMessages.push(newMsg);
  input.value = '';
  renderChatMessages();
  saveChatMessages();
  
  scheduleAiReply();
}

function dreamReply() {
  var cards = state.cards || [];
    // 【强制已读】：AI 只要开始回复，用户的上一条消息必定变成已读
  for (var i = 0; i < chatMessages.length; i++) {
    if (chatMessages[i].from === 'user') {
      chatMessages[i].status = 'read';
    }
  }
  var useSticker = false;
  var stickerIdx = -1;
  var useCard = false;
  var senderId = '';
  var senderAvatar = '';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');

  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g) {
      checkExpiredMutes(g);
            // 5% 概率有成员主动退群
      if (Math.random() < 0.05) {
        var candidates = g.memberIds.filter(function(id) {
          return String(id) !== String(g.ownerId);
        });
        if (candidates.length > 0) {
          var leaverId = candidates[Math.floor(Math.random() * candidates.length)];
          var leaver = state.dreams.find(function(d) { return d.id === leaverId; });
          if (leaver) {
            g.memberIds = g.memberIds.filter(function(id) { return String(id) !== String(leaverId); });
            if (g.muteEndsAt) delete g.muteEndsAt[String(leaverId)];
            if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
            state.chatSessions[g.id].push({ from: 'system', text: '「' + leaver.name + '」主动退出了群聊', time: Date.now() });
            saveState();
          }
        }
      }
      
      if (g.ownerId !== 'user' && Math.random() < 0.15) {
        aiGroupOwnerAction(g);
        return; 
      }

            if (window.nextReplySender) {
        senderId = window.nextReplySender.id;
        senderAvatar = window.nextReplySender.avatar;
        window.nextReplySender = null;
      } else if (g.memberIds.length > 0) {
        var availableIds = g.memberIds.filter(function(id) {
          return !g.muteEndsAt || g.muteEndsAt[String(id)] === undefined;
        });
        if (availableIds.length === 0) return; 
        var randomMemberId = availableIds[Math.floor(Math.random() * availableIds.length)];
        var member = state.dreams.find(function(item) { return item.id === randomMemberId; });
        if (member) { senderId = member.id; senderAvatar = member.avatar; }
      }
    }
  }

  // 【终极防弹玻璃】：如果抽中的人被禁言了，直接闭嘴！
  if (senderId && isGroup) {
    var gCheck = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (gCheck && gCheck.muteEndsAt && gCheck.muteEndsAt[String(senderId)] !== undefined) {
      return; 
    }
  }
    // 【新增】：群聊或私聊，AI有20%概率发拍一拍
  var usePoke = false;
  if (state.pokes && state.pokes.length > 0 && Math.random() < 0.2) {
    usePoke = true;
  }
  
  
  var hasCards = cards.length > 0;
  var hasStickers = stickers.length > 0;
  if (hasCards && hasStickers) {
    if (Math.random() < 0.85) useCard = true; else useSticker = true;
  } else if (hasCards) useCard = true;
  else if (hasStickers) useSticker = true;

  if (useCard) {
    var idx = Math.floor(Math.random() * cards.length);
    chatMessages.push({ from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: cards[idx].text || '…', time: Date.now() });
  } else if (useSticker) {
    var lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg === undefined || lastMsg === null) lastMsg = { from: 'system' };
    if (stickers.length > 1 && lastMsg.from === 'user' && lastMsg.stickerIdx !== undefined) {
      do { stickerIdx = Math.floor(Math.random() * stickers.length); } while (stickerIdx === lastMsg.stickerIdx);
    } else {
      stickerIdx = Math.floor(Math.random() * stickers.length);
    }
    chatMessages.push({ from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: '[表情]', stickerIdx: stickerIdx, stickerData: stickers[stickerIdx], time: Date.now() });
  } else {
    chatMessages.push({ from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: '…', time: Date.now() });
  }

  renderChatMessages();
  saveChatMessages();
  sendNotification(state.dream.name || '梦角', '发来一条消息');
}

// ===== AI 群主的管理行为 =====
// ===== AI 群主的管理行为 =====
function aiGroupOwnerAction(g) {
  var owner = state.dreams.find(function(d) { return d.id === g.ownerId; });
  if (!owner) return;

  var otherMembers = g.memberIds.filter(function(id) { return String(id) !== String(g.ownerId); });
  var availableDreams = state.dreams.filter(function(d) { return !g.memberIds.includes(d.id); });

  var action = Math.random();
  var sysText = '';
  var targetId = '';
  var target = null;

  if (action < 0.3 && availableDreams.length > 0) {
    var toAdd = availableDreams[Math.floor(Math.random() * availableDreams.length)];
    g.memberIds.push(toAdd.id);
    sysText = '群主「' + owner.name + '」邀请了「' + toAdd.name + '」加入群聊';
  } else {
    if (otherMembers.length === 0) return;
    targetId = otherMembers[Math.floor(Math.random() * otherMembers.length)];
    target = state.dreams.find(function(d) { return d.id === targetId; });
    if (!target) return;

    var subAction = Math.random();
    if (subAction < 0.4) {
      if (!g.muteEndsAt) g.muteEndsAt = {};
      if (g.muteEndsAt[String(targetId)] !== undefined) return; 
      var durations = [5, 10, 15, 30];
      var mins = durations[Math.floor(Math.random() * durations.length)];
      g.muteEndsAt[String(targetId)] = Date.now() + mins * 60 * 1000; // 强制转字符串
      sysText = '群主「' + owner.name + '」禁言了「' + target.name + '」' + mins + '分钟';
    } else if (subAction < 0.8) {
      g.memberIds = g.memberIds.filter(function(id) { return String(id) !== String(targetId); });
      if (g.muteEndsAt) delete g.muteEndsAt[String(targetId)];
      sysText = '群主「' + owner.name + '」将「' + target.name + '」移出了群聊';
    } else {
      g.ownerId = targetId;
      sysText = '群主「' + owner.name + '」已将群主转让给「' + target.name + '」';
    }
  }

  if (sysText) {
    if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
    state.chatSessions[g.id].push({ from: 'system', text: sysText, time: Date.now() });
    saveState();
  }

  if (state.currentChatId === g.id) {
    loadChatMessages();
    renderChatMessages();
  }
}

function renderChat() {
  var chatBody = document.getElementById('chatBody');
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  var bg = null;

  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    bg = g && g.chatBg ? g.chatBg : null;
  } else {
    bg = localStorage.getItem('dreamChatBg');
  }

  if (chatBody) {
    if (bg) {
      chatBody.style.background = 'url("' + bg + '") center/cover no-repeat';
      chatBody.style.backgroundColor = 'transparent';
    } else {
      chatBody.style.background = '';
      chatBody.style.backgroundColor = '';
    }
  }

  if (isGroup) {
    var g2 = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g2) document.getElementById('chatHeaderName').textContent = g2.name + ' (' + g2.memberIds.length + ')';
  } else {
    var d = state.dreams.find(function(item) { return item.id === state.currentChatId; });
    if (d) document.getElementById('chatHeaderName').textContent = d.name;
  }

  renderChatMessages();
}

function renderChatMessages() {
  if (!chatMessages || !Array.isArray(chatMessages)) chatMessages = [];
  chatMessages = chatMessages.filter(function(m) { return m && m.from !== undefined; });

  var container = document.getElementById('chatMessages');
  if (!container) return;
  if (chatMessages.length === 0) {
    container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#86868b;font-size:14px;">开始和梦角聊天吧</div>';
    return;
  }
  var html = '';
  var currentStyle = chatSettings.bubbleStyle || 'default';
  var styleClass = 'bubble-' + currentStyle;
  var useInlineStyle = (currentStyle === 'default');
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');

  for (var i = 0; i < chatMessages.length; i++) {
    var m = chatMessages[i];
    if (!m || !m.from) continue;

    var time = new Date(m.time);
    var h = time.getHours();
    var min = time.getMinutes();
    if (h < 10) h = '0' + h;
    if (min < 10) min = '0' + min;
    var timeStr = h + ':' + min;

    if (m.from === 'system') {
      html += '<div style="text-align:center;margin:12px 0;font-size:12px;color:#86868b;">' + m.text + '</div>';
      continue; 
    }

    if (m.type === 'poke') {
      var pokeSenderName = m.senderName || (m.from === 'user' ? '我' : '梦角');
      if (!m.senderName && m.senderId) {
        var findMember = state.dreams.find(function(d){ return d.id === m.senderId; });
        if (findMember) pokeSenderName = findMember.name;
      }
      html += '<div style="text-align:center;margin:10px 0;font-size:12px;color:#86868b;">';
      html += '<span style="font-weight:600;color:#555;">' + pokeSenderName + '</span> ' + m.text;
      html += '</div>';
      continue; 
    }

    var imgSrc = '';
    if (m.type === 'image') {
      imgSrc = m.imageData;
    } else if (m.stickerData) {
      imgSrc = m.stickerData; 
    } else if (m.stickerIdx !== undefined && stickers[m.stickerIdx]) {
      imgSrc = stickers[m.stickerIdx]; 
    } else if (m.sticker) {
      imgSrc = m.sticker; 
    }

    var userBg = useInlineStyle ? 'background:' + chatSettings.bubbleUser + ';' : '';
    var dreamBg = useInlineStyle ? 'background:' + chatSettings.bubbleDream + ';' : '';
    var textColor = useInlineStyle ? 'color:' + chatSettings.fontColor + ';' : '';

    if (m.from === 'user') {
      html += '<div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:8px;margin-bottom:6px;">';
      html += '<div style="max-width:70%;">';
      
      // 【核心修改】：改成了 message user bubble，去掉了内联的 font-size
      var bubbleClass = 'message user bubble chat-bubble user bubble-user ' + styleClass;
            var quoteHtml = '';
      if (m.quote) {
        quoteHtml = '<div style="font-size:11px;opacity:0.7;padding:4px 8px;margin-bottom:4px;background:rgba(0,0,0,0.06);border-left:2px solid #999;border-radius:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">' + m.quote.senderName + '：' + m.quote.text + '</div>';
      }
      if (imgSrc) {
        html += '<div class="' + bubbleClass + '" style="' + userBg + textColor + 'padding:4px;">' + quoteHtml + '<img src="' + imgSrc + '" style="width:120px;height:120px;border-radius:6px;object-fit:cover;display:block;"></div>';
      } else {
        html += '<div class="' + bubbleClass + '" style="' + userBg + textColor + '">' + quoteHtml + m.text + '</div>';
      }
      var statusText = m.status === 'read' ? '已读' : '未读';
      html += '<span style="font-size:9px;color:#b0b0b0;display:block;text-align:right;margin-top:2px;">' + statusText + ' &nbsp; ' + timeStr + '</span>';
      html += '</div>';
      var userAvatar = state.profile.avatar || '';
      html += '<img src="' + userAvatar + '" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
      html += '</div>';
    } else {
      var displayAvatar = '';
      var senderName = '';
      if (isGroup) {
        if (m.senderId) {
          var member = state.dreams.find(function(item) { return item.id === m.senderId; });
          if (member) { senderName = member.name; displayAvatar = member.avatar || ''; }
        }
        if (!senderName) senderName = '未知成员';
        if (!displayAvatar) displayAvatar = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23eee%27/%3E%3Ctext x=%2716%27 y=%2720%27 text-anchor=%27middle%27 fill=%27%23aaa%27 font-size=%2712%27%3E?%3C/text%3E%3C/svg%3E';
      } else {
        var d = state.dreams.find(function(item) { return item.id === state.currentChatId; });
        if (d) { senderName = d.name; displayAvatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2716%27 y=%2720%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2712%27%3E💜%3C/text%3E%3C/svg%3E'; }
      }

      html += '<div style="display:flex;justify-content:flex-start;align-items:flex-end;gap:8px;margin-bottom:6px;">';
      html += '<img src="' + displayAvatar + '" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
      html += '<div style="max-width:70%;">';
      if (isGroup && senderName) html += '<span style="font-size:9px;color:#b0b0b0;display:block;margin-bottom:2px;">' + senderName + '</span>';
      
      // 【核心修改】：改成了 message yume bubble，去掉了内联的 font-size
     var bubbleClass = 'message yume bubble chat-bubble dream bubble-dream ' + styleClass;
           var quoteHtml = '';
      if (m.quote) {
        quoteHtml = '<div style="font-size:11px;opacity:0.7;padding:4px 8px;margin-bottom:4px;background:rgba(0,0,0,0.06);border-left:2px solid #999;border-radius:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">' + m.quote.senderName + '：' + m.quote.text + '</div>';
      }
      if (imgSrc) {
        html += '<div class="' + bubbleClass + '" style="' + dreamBg + textColor + 'padding:4px;">' + quoteHtml + '<img src="' + imgSrc + '" style="width:120px;height:120px;border-radius:6px;object-fit:cover;display:block;"></div>';
      } else {
        html += '<div class="' + bubbleClass + '" style="' + dreamBg + textColor + '">' + quoteHtml + m.text + '</div>';
      }
      html += '<span style="font-size:9px;color:#b0b0b0;display:block;margin-top:2px;">' + timeStr + '</span>';
      html += '</div>';
      html += '</div>';
    }
  }
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function loadChatSettings() {
  try {
    var saved = localStorage.getItem('dreamChatSettings');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { bg: null, bubbleUser: '#e8e8ed', bubbleDream: '#e8e8ed', fontColor: '#1d1d1f' };
}
function saveChatSettings() {
  chatSettings.bubbleUser = document.getElementById('bubbleUserColor').value;
  chatSettings.bubbleDream = document.getElementById('bubbleDreamColor').value;
  chatSettings.fontColor = document.getElementById('chatFontColor').value;
  localStorage.setItem('dreamChatSettings', JSON.stringify(chatSettings));
  showToast('聊天设置已保存');
}
function resetChatSettings() {
  chatSettings = { bg: null, bubbleUser: '#e8e8ed', bubbleDream: '#e8e8ed', fontColor: '#1d1d1f' };
  localStorage.removeItem('dreamChatSettings');
  localStorage.removeItem('dreamChatBg');
  document.getElementById('bubbleUserColor').value = '#e8e8ed';
  document.getElementById('bubbleDreamColor').value = '#e8e8ed';
  document.getElementById('chatFontColor').value = '#1d1d1f';
  showToast('已重置为默认');
  var savedBg = localStorage.getItem('dreamChatBg');
  if (savedBg) {
    document.getElementById('chatBgStatus').textContent = '已设置 ✓';
    document.getElementById('chatBgPreview').style.display = 'block';
    document.getElementById('chatBgPreview').style.background = 'url(' + savedBg + ') center/cover';
  } else {
    document.getElementById('chatBgStatus').textContent = '点击选择图片';
    document.getElementById('chatBgPreview').style.display = 'none';
  }
  setupChatBg();
}
function handleChatBg(e) {
  var file = e.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    
    // 先绑定加载完成事件，再赋值 src，确保万无一失
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_WIDTH = 800; 
      var width = img.width;
      var height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);

      try {
        localStorage.setItem('dreamChatBg', compressedDataUrl);
        // 更新全局变量，并强制触发一次渲染
        chatSettings.bg = compressedDataUrl;
        showToast('聊天背景已设置');
        
        // 顺手更新设置页面的预览
        var chatBgStatus = document.getElementById('chatBgStatus');
        if (chatBgStatus) chatBgStatus.textContent = '已设置 ✓';
        var chatBgPreview = document.getElementById('chatBgPreview');
        if (chatBgPreview) {
          chatBgPreview.style.display = 'block';
          chatBgPreview.style.background = 'url(' + compressedDataUrl + ') center/cover';
        }
      } catch(err) {
        showToast('存储空间不足，请换一张更小的图');
      }
    };
    
    img.onerror = function() {
        showToast('图片加载失败，请重试');
    };
    
    // 现在才赋值 src
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
function confirmClearChat() {
  if (confirm('确定清除所有聊天记录？此操作不可恢复！')) {
    chatMessages = [];
    saveChatMessages();
    renderChatMessages();
    showToast('聊天记录已清除');
  }
}

function toggleStickerPanel() {
  var panel = document.getElementById('stickerPanel');
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
    renderStickers();
  } else {
    panel.style.display = 'none';
  }
}

// 新增一个全局变量，用来记录是否处于编辑模式

function toggleStickerEditMode() {
  isEditingStickers = !isEditingStickers;
  renderStickers();
}

// ===== 表情包功能完整版 =====

function toggleStickerEditMode() {
  isEditingStickers = !isEditingStickers;
  renderStickers();
}

var isEditingStickers = false;

function renderStickers() {
  var panel = document.getElementById('stickerPanel');
  if (!panel) return;
  
  var html = '';
  
  // 顶部工具栏：编辑/完成 按钮
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
  html += '<span style="font-size:12px; color:var(--gray);">' + (isEditingStickers ? '点击表情删除' : '表情包') + '</span>';
  html += '<button onclick="toggleStickerEditMode()" style="font-size:12px; padding:2px 10px; border-radius:10px; border:1px solid var(--border); background:' + (isEditingStickers ? 'var(--red)' : 'var(--card)') + '; color:' + (isEditingStickers ? '#fff' : 'var(--blue)') + ';">' + (isEditingStickers ? '完成' : '编辑') + '</button>';
  html += '</div>';
  
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px;">';
  
  // 添加按钮（只在非编辑模式下显示）
  if (!isEditingStickers) {
    html += '<div onclick="document.getElementById(\'stickerInput\').click()" style="width:60px;height:60px;border:2px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--gray);cursor:pointer;flex-shrink:0;">+</div>';
  }
  
  // 渲染现有的表情包
  for (var i = 0; i < stickers.length; i++) {
    html += '<div class="sticker-item" style="position:relative;width:60px;height:60px;flex-shrink:0;">';
    
        if (isEditingStickers) {
      // 编辑模式下，点击图片本身不做操作，重点在叉号上！
      html += '<img src="' + stickers[i] + '" style="width:60px;height:60px;border-radius:8px;object-fit:cover;opacity:0.5;pointer-events:none;">';
      // 把删除事件绑定在叉号上，点击直接删（去掉了confirm弹窗，手机端爽飞）
      html += '<span onclick="deleteSticker(' + i + ')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;font-size:14px;text-align:center;line-height:20px;cursor:pointer;z-index:10;">×</span>';
    } else {
      // 正常模式下，点击图片进行发送
      html += '<img src="' + stickers[i] + '" onclick="sendSticker(' + i + ')" style="width:60px;height:60px;border-radius:8px;object-fit:cover;cursor:pointer;">';
    }
    
    html += '</div>';
  }
  html += '</div>';
  
  // 动态生成支持多选的文件输入框
  html += '<input type="file" id="stickerInput" accept="image/*" multiple style="display:none" onchange="addSticker(event)">';
  
  panel.innerHTML = html;
}

function addSticker(e) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  
  var totalFiles = files.length;
  var newStickers = [];
  
  showToast('正在处理 ' + totalFiles + ' 张图片...');
  
  function processFile(file) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var MAX_SIZE = 200;
          var width = img.width;
          var height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          newStickers.push(compressedDataUrl);
          resolve();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  
  var promises = [];
  for (var i = 0; i < totalFiles; i++) {
    promises.push(processFile(files[i]));
  }
  
  Promise.all(promises).then(function() {
    stickers = stickers.concat(newStickers);
    try {
      localStorage.setItem('dreamStickers', JSON.stringify(stickers));
      renderStickers();
      showToast('成功添加 ' + newStickers.length + ' 个表情包');
    } catch (err) {
      showToast('存储空间不足，请删除一些旧表情包');
    }
  });
  
  e.target.value = '';
}

function deleteSticker(idx) {
  // 直接删除，不再弹系统确认框
  stickers.splice(idx, 1);
  try {
    localStorage.setItem('dreamStickers', JSON.stringify(stickers));
  } catch(e) {}
  renderStickers();
  renderChatMessages();
  showToast('表情包已删除');
}

function setupChatBg() {
  var input = document.getElementById('chatBgInput');
  if (!input) return;
  input.onchange = function() {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      chatSettings.bg = e.target.result;
      localStorage.setItem('dreamChatBg', e.target.result);
      document.getElementById('chatBgStatus').textContent = '已设置 ✓';
      document.getElementById('chatBgPreview').style.display = 'block';
      document.getElementById('chatBgPreview').style.background = 'url(' + e.target.result + ') center/cover';
      showToast('聊天背景已设置');
    };
    reader.readAsDataURL(file);
  };
}

function clearCallHistory() {
  if (!confirm('确定清除所有通话记录？')) return;
  state.callHistory = [];
  saveState();
  renderCallHistory();
  showToast('通话记录已清除');
}

function clearCheckinHistory() {
  if (!confirm('确定清除所有查岗记录？')) return;
  state.checkinHistory = [];
  saveState();
  renderCheckinHistory();
  showToast('查岗记录已清除');
}

// ===== TOAST =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== RENDER ALL =====
function renderAll() {
  renderWordCards();
  renderCallHistory();
  renderCheckinHistory();
  loadProfileForm();
  renderDreamRoles();
  renderChatList();
}

// ===== START =====
init();

// Handle clicks on overlay background
document.querySelectorAll('.overlay-bg').forEach(bg => {
  bg.addEventListener('click', function(e) {
    e.stopPropagation();
  });
});

// Click on checkin overlay background closes it
document.getElementById('checkinOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeCheckin();
});

console.log('💜 Mind已启动！');
// ===== 外观美化的保存与重置 =====
// ===== 保存美化设置（增强版） =====
function saveBeautySettings() {
  var userBubbleColor = document.getElementById('beautyUserBubble').value;
  var dreamBubbleColor = document.getElementById('beautyDreamBubble').value;
  var fontColor = document.getElementById('beautyFontColor').value;
  var bubbleStyle = document.getElementById('beautyBubbleStyle').value;
  var fontSize = document.getElementById('globalFontSize').value;
  var themeColor = document.getElementById('themeColor').value;
  var customCSS = document.getElementById('customBubbleCSS').value;

  // 1. 更新聊天设置
  chatSettings.bubbleUser = userBubbleColor;
  chatSettings.bubbleDream = dreamBubbleColor;
  chatSettings.fontColor = fontColor;
  chatSettings.bubbleStyle = bubbleStyle;
  localStorage.setItem('dreamChatSettings', JSON.stringify(chatSettings));

  // 2. 保存高级美化设置（字体、主题、自定义CSS）
  if (!state.settings) state.settings = {};
  state.settings.fontSize = fontSize;
  state.settings.themeColor = themeColor;
  state.settings.customBubbleCSS = customCSS;
  saveState();

  // 3. 立刻应用效果
  applyBeautySettings();

  showToast('美化设置已保存并生效！');
}

// ===== 恢复默认 =====
function resetBeautySettings() {
  var defaultColor = '#e8e8ed';
  var defaultFont = '#1d1d1f';
  
  chatSettings.bubbleUser = defaultColor;
  chatSettings.bubbleDream = defaultColor;
  chatSettings.fontColor = defaultFont;
  chatSettings.bubbleStyle = 'default';
  localStorage.setItem('dreamChatSettings', JSON.stringify(chatSettings));

  if (state.settings) {
    state.settings.customIcons = {}; 
    state.settings.fontSize = 14;
    state.settings.themeColor = '#007aff';
    state.settings.customBubbleCSS = '';
    saveState();
    renderAppIcons();
    renderIconSettings();
  }

  document.getElementById('beautyUserBubble').value = defaultColor;
  document.getElementById('beautyDreamBubble').value = defaultColor;
  document.getElementById('beautyFontColor').value = defaultFont;
  document.getElementById('beautyBubbleStyle').value = 'default';
  document.getElementById('globalFontSize').value = 14;
  document.getElementById('fontSizeLabel').textContent = 14;
  document.getElementById('themeColor').value = '#007aff';
  document.getElementById('customBubbleCSS').value = '';

  applyBeautySettings();
  showToast('已恢复默认');
}

// ===== 应用美化效果（核心逻辑） =====
function applyBeautySettings() {
  if (!state.settings) return;
  
  var fontSize = state.settings.fontSize || 14;
  var ratio = fontSize / 14;
  
  // 只缩放所有文字的字体大小，布局不变
  document.querySelectorAll('.phone, .phone *').forEach(function(el) {
    if (!el.dataset.origFs) {
      el.dataset.origFs = parseFloat(window.getComputedStyle(el).fontSize) || 14;
    }
    var origFs = parseFloat(el.dataset.origFs);
    if (origFs) el.style.fontSize = (origFs * ratio) + 'px';
  });
  
  // 主题颜色
  var themeColor = state.settings.themeColor || '#007aff';
  document.documentElement.style.setProperty('--blue', themeColor);
  
  // 自定义 CSS
  var customCSS = state.settings.customBubbleCSS || '';
 var styleEl = document.getElementById('userCustomStyle');
if (styleEl) {
  styleEl.innerHTML = customCSS;
}
}

// ===== 导入 milk 字卡（自动识别分组终极版） =====
function handleImportCards(e) {
  var file = e.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var importedData = JSON.parse(ev.target.result);
      var newCards = [];
      
      // 1. 如果文件里带了分组信息 (customReplyGroups)，优先按分组导入
      if (importedData.customReplyGroups && Array.isArray(importedData.customReplyGroups)) {
        var existingCatNames = state.categories.map(function(c) { return c.name; });
        
        importedData.customReplyGroups.forEach(function(group) {
          var catName = group.name || '未命名分组';
          var targetCatId = '';
          
          // 检查网站里是否已有同名分类
          var existingCat = state.categories.find(function(c) { return c.name === catName; });
          if (existingCat) {
            targetCatId = existingCat.id;
          } else {
            // 没有的话，自动建一个！
            targetCatId = 'cat_imported_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
            state.categories.push({ id: targetCatId, name: catName, collapsed: false });
          }
          
          // 遍历这个分组里的所有字卡
          if (group.items && Array.isArray(group.items)) {
            group.items.forEach(function(text) {
              if (text && typeof text === 'string' && text.trim() !== '') {
                newCards.push({ 
                  text: text.trim(), 
                  cat: targetCatId 
                });
              }
            });
          }
        });
      } 
      // 2. 如果没有分组信息，退回原来的全放默认分组逻辑
      else if (importedData.customReplies && Array.isArray(importedData.customReplies)) {
        var defaultCatId = state.categories.find(function(c) { return c.id === 'default'; }) ? 'default' : state.categories[0].id;
        importedData.customReplies.forEach(function(text) {
          if (text && typeof text === 'string' && text.trim() !== '') {
            newCards.push({ 
              text: text.trim(), 
              cat: defaultCatId 
            });
          }
        });
      }

      if (newCards.length === 0) {
        showToast('没有找到可导入的字卡数据');
        return;
      }

      // 3. 去重合并（防止导入一堆重复的）
      var existingTexts = new Set(state.cards.map(function(c) { return c.text; }));
      var addedCount = 0;
      
      newCards.forEach(function(card) {
        if (!existingTexts.has(card.text)) {
          state.cards.push({
            id: 'imported_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            text: card.text,
            cat: card.cat
          });
          existingTexts.add(card.text);
          addedCount++;
        }
      });

      // 4. 保存并刷新界面
      if (addedCount > 0) {
        saveState();
        renderWordCards();
        showToast('成功按分组导入 ' + addedCount + ' 张字卡！');
      } else {
        showToast('所有字卡都已经存在了，无需重复导入');
      }
      
    } catch (err) {
      showToast('文件解析失败，请确认是有效的 JSON 格式');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // 清空选择框，方便下次再选
}


// ===== 3. 处理图标上传并自动裁剪成 1:1 =====
function handleIconUpload(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      
      if (!state.settings.customIcons) state.settings.customIcons = {};
      state.settings.customIcons[key] = compressedDataUrl;
      saveState();
      renderIconSettings();
      renderAppIcons();
      showToast('图标已更新（已自动裁剪为1:1）');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
// ===== 修复表情包历史记录消失问题（终极版） =====
var isSendingSticker = false;

function sendSticker(idx) {
  if (isSendingSticker) return; 
  if (!stickers[idx]) return;
  
  isSendingSticker = true; 
  setTimeout(function() { isSendingSticker = false; }, 500); 

  chatMessages.push({ from: 'user', text: '[表情]', time: Date.now(), stickerIdx: idx, stickerData: stickers[idx] });
  document.getElementById('chatInput').value = '';
  renderChatMessages();
  saveChatMessages();
  document.getElementById('stickerPanel').style.display = 'none';
  
  // 【核心修复】：使用全局闹钟！这样禁言时才能把它一并取消！
    scheduleAiReply();
}

function renderChatMessages() {
  // 1. 终极护甲
  if (!chatMessages || !Array.isArray(chatMessages)) {
    chatMessages = [];
  }
  chatMessages = chatMessages.filter(function(m) { return m && m.from !== undefined; });

  var container = document.getElementById('chatMessages');
  if (!container) return;
  if (chatMessages.length === 0) {
    container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#86868b;font-size:14px;">开始和梦角聊天吧</div>';
    return;
  }
  var html = '';
  var currentStyle = chatSettings.bubbleStyle || 'default';
  var styleClass = 'bubble-' + currentStyle;
  var useInlineStyle = (currentStyle === 'default');
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');

  for (var i = 0; i < chatMessages.length; i++) {
    var m = chatMessages[i];
    if (!m || !m.from) continue;

    var time = new Date(m.time);
    var h = time.getHours();
    var min = time.getMinutes();
    if (h < 10) h = '0' + h;
    if (min < 10) min = '0' + min;
    var timeStr = h + ':' + min;

    // 2. 系统消息（最高优先级）
        // 转发卡片
    if (m.type === 'forward') {
      var fwClass = m.from === 'user' ? 'message user bubble bubble-user' : 'message dream bubble bubble-dream';
      html += '<div data-msg-index="' + i + '" style="display:flex;justify-content:' + (m.from === 'user' ? 'flex-end' : 'flex-start') + ';align-items:flex-end;gap:8px;margin-bottom:6px;">';
      html += '<div style="max-width:70%;">';
      html += '<div class="' + fwClass + '" onclick="openForwardDetail(' + i + ')" style="cursor:pointer;background:#fff !important;">';
      html += '<div style="font-size:12px;color:#999;margin-bottom:4px;">📋 聊天记录</div>';
      html += '<div style="font-size:13px;color:#333;">' + (m.preview || '') + '</div>';
      html += '<div style="font-size:11px;color:#bbb;margin-top:4px;">' + (m.messages ? m.messages.length : 0) + ' 条消息</div>';
      html += '</div>';
      html += '<span style="font-size:9px;color:#b0b0b0;display:block;' + (m.from === 'user' ? 'text-align:right;' : '') + 'margin-top:2px;">' + timeStr + '</span>';
      html += '</div></div>';
      continue;
    }
    if (m.from === 'system') {
      html += '<div style="text-align:center;margin:12px 0;font-size:12px;color:#86868b;">' + m.text + '</div>';
      continue; 
    }

    // 3. 拍一拍消息（第二优先级，直接拦截，绝对不画气泡！）
    if (m.type === 'poke') {
      var pokeSenderName = m.senderName || (m.from === 'user' ? '我' : '梦角');
      if (!m.senderName && m.senderId) {
        var findMember = state.dreams.find(function(d){ return d.id === m.senderId; });
        if (findMember) pokeSenderName = findMember.name;
      }
      html += '<div style="text-align:center;margin:10px 0;font-size:12px;color:#86868b;">';
      html += '<span style="font-weight:600;color:#555;">' + pokeSenderName + '</span> ' + m.text;
      html += '</div>';
      continue; // 拦截成功，跳过后面的气泡渲染
    }

    // 4. 提取图片地址
    var imgSrc = '';
    if (m.type === 'image') {
      imgSrc = m.imageData;
    } else if (m.stickerData) {
      imgSrc = m.stickerData; 
    } else if (m.stickerIdx !== undefined && stickers[m.stickerIdx]) {
      imgSrc = stickers[m.stickerIdx]; 
    } else if (m.sticker) {
      imgSrc = m.sticker; 
    }

    var userBg = useInlineStyle ? 'background:' + chatSettings.bubbleUser + ';' : '';
    var dreamBg = useInlineStyle ? 'background:' + chatSettings.bubbleDream + ';' : '';
    var textColor = 'color:' + chatSettings.fontColor + ';';

    // 5. 用户消息气泡
    if (m.from === 'user') {
      html += '<div data-msg-index="' + i + '" style="display:flex;justify-content:flex-end;align-items:flex-end;gap:8px;margin-bottom:6px;">';
      html += '<div style="max-width:70%;">';
      if (imgSrc) {
        html += '<div class="chat-bubble bubble-user ' + styleClass + '" style="' + userBg + textColor + 'padding:4px;"><img src="' + imgSrc + '" style="width:120px;height:120px;border-radius:6px;object-fit:cover;display:block;"></div>';
      } else {
        html += '<div class="chat-bubble bubble-user ' + styleClass + '" style="' + userBg + textColor + '">' + m.text + '</div>';
      }
      var statusText = m.status === 'read' ? '已读' : '未读';
html += '<span style="font-size:9px;color:#b0b0b0;display:block;text-align:right;margin-top:2px;">' + statusText + ' &nbsp; ' + timeStr + '</span>';
      html += '</div>';
      var userAvatar = state.profile.avatar || '';
      html += '<img src="' + userAvatar + '" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
      html += '</div>';
    } else {
      // 6. 梦角消息气泡
      var displayAvatar = '';
      var senderName = '';

      if (isGroup) {
        if (m.senderId) {
          var member = state.dreams.find(function(item) { return item.id === m.senderId; });
          if (member) {
            senderName = member.name;
            displayAvatar = member.avatar || '';
          }
        }
        if (!senderName) senderName = '未知成员';
        if (!displayAvatar) displayAvatar = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23eee%27/%3E%3Ctext x=%2716%27 y=%2720%27 text-anchor=%27middle%27 fill=%27%23aaa%27 font-size=%2712%27%3E?%3C/text%3E%3C/svg%3E';
      } else {
        var d = state.dreams.find(function(item) { return item.id === state.currentChatId; });
        if (d) {
          senderName = d.name;
          displayAvatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2716%27 y=%2720%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2712%27%3E💜%3C/text%3E%3C/svg%3E';
        }
      }

      html += '<div data-msg-index="' + i + '" style="display:flex;justify-content:flex-start;align-items:flex-end;gap:8px;margin-bottom:6px;">';
      html += '<img src="' + displayAvatar + '" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
      html += '<div style="max-width:70%;">';
      
      if (isGroup && senderName) {
        html += '<span style="font-size:10px;color:#86868b;display:block;margin-bottom:2px;">' + senderName + '</span>';
      }
      if (imgSrc) {
        html += '<div class="chat-bubble bubble-dream ' + styleClass + '" style="' + dreamBg + textColor + 'padding:4px;"><img src="' + imgSrc + '" style="width:120px;height:120px;border-radius:6px;object-fit:cover;display:block;"></div>';
      } else {
        html += '<div class="chat-bubble bubble-dream ' + styleClass + '" style="' + dreamBg + textColor + '">' + m.text + '</div>';
      }
      html += '<span style="font-size:9px;color:#b0b0b0;display:block;margin-top:2px;">' + timeStr + '</span>';
      html += '</div>';
      html += '</div>';
    }
  }
  container.innerHTML = html;
    // 统一注入引用内容
  chatMessages.forEach(function(m, i) {
    if (m && m.quote) {
      var el = container.querySelector('[data-msg-index="' + i + '"] [class*="bubble"]');
      if (el && !el.querySelector('.quote-block')) {
        var q = document.createElement('div');
        q.className = 'quote-block';
        q.style.cssText = 'font-size:11px;opacity:0.75;padding:4px 8px;margin-bottom:4px;background:rgba(0,0,0,0.06);border-left:2px solid #999;border-radius:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;';
        q.textContent = m.quote.senderName + '：' + m.quote.text;
        el.insertBefore(q, el.firstChild);
      }
    }
  });
    // 多选模式：加勾选框 + 拦截点击
  if (isMultiSelectMode) {
    var items = container.querySelectorAll('[data-msg-index]');
    items.forEach(function(el) {
      var idx = parseInt(el.dataset.msgIndex);
      var isSelected = selectedIndices.indexOf(idx) > -1;
      // 视觉反馈
      el.style.transition = 'opacity 0.15s';
      el.style.opacity = isSelected ? '0.55' : '1';
      // 加勾选框
      var box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:6px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;border:2px solid var(--blue);background:' + (isSelected ? 'var(--blue)' : '#fff') + ';color:#fff;font-size:12px;line-height:20px;text-align:center;pointer-events:none;z-index:5;';
      box.textContent = isSelected ? '✓' : '';
      el.style.position = 'relative';
      el.appendChild(box);
      // 拦截点击（用 onclick 捕获）
      el.onclick = (function(i) {
        return function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          toggleSelectMessage(i);
        };
      })(idx);
    });
  } else {
    // 退出多选时，移除 onclick 拦截
    var items2 = container.querySelectorAll('[data-msg-index]');
    items2.forEach(function(el) { el.onclick = null; el.style.opacity = '1'; });
  }
  container.scrollTop = container.scrollHeight;
  attachLongPress();
}
// ===== 渲染聊天列表 =====
function renderChatList() {
  var container = document.getElementById('chatListContainer');
  if (!container) return;

  var html = '';

  // 1. 先渲染群聊列表
  if (state.groups && state.groups.length > 0) {
    state.groups.forEach(function(g) {
      var msgs = state.chatSessions[g.id] || [];
      var lastMsg = msgs[msgs.length - 1];
      if (lastMsg === undefined || lastMsg === null) lastMsg = null;
      var preview = lastMsg ? (lastMsg.stickerData || lastMsg.stickerIdx !== undefined ? '[表情]' : lastMsg.text) : '暂无消息';
      var time = '';
      if (lastMsg) {
        var d = new Date(lastMsg.time);
        var h = d.getHours(), m = d.getMinutes();
        time = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
      }
      html += `
        <div class="chat-list-item" onclick="openChat('${g.id}')">
          <img class="chat-list-avatar" src="${g.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23dff0ff%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23007aff%27 font-size=%2720%27%3E👥%3C/text%3E%3C/svg%3E'}">
          <div class="chat-list-info">
            <div class="chat-list-top">
              <span class="chat-list-name">${g.name} (${g.memberIds.length})${state.mutedChats && state.mutedChats.indexOf(g.id) === -1 && state.chatSessions[g.id] && state.chatSessions[g.id].some(function(x){return x.from==='dream' && x.time > (state.lastReadAt && state.lastReadAt[g.id] || 0)}) ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-left:6px;vertical-align:middle;"></span>' : ''}</span>
              <span class="chat-list-time">${time}</span>
            </div>
            <div class="chat-list-preview">${preview}</div>
          </div>
        </div>
      `;
    });
  }

  // 2. 再渲染私聊列表
  if (state.dreams && state.dreams.length > 0) {
    state.dreams.forEach(function(d) {
      var msgs = state.chatSessions[d.id] || [];
      var lastMsg = msgs[msgs.length - 1];
      var preview = lastMsg ? (lastMsg.stickerData || lastMsg.stickerIdx !== undefined ? '[表情]' : lastMsg.text) : '暂无消息';
      var time = '';
      if (lastMsg) {
        var date = new Date(lastMsg.time);
        var h = date.getHours(), m = date.getMinutes();
        time = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
      }
      var avatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
      html += `
        <div class="chat-list-item" onclick="openChat('${d.id}')">
          <img class="chat-list-avatar" src="${avatar}">
          <div class="chat-list-info">
            <div class="chat-list-top">
             <span class="chat-list-name">${d.name}${state.mutedChats && state.mutedChats.indexOf(d.id) === -1 && state.chatSessions[d.id] && state.chatSessions[d.id].some(function(x){return x.from==='dream' && x.time > (state.lastReadAt && state.lastReadAt[d.id] || 0)}) ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-left:6px;vertical-align:middle;"></span>' : ''}</span>
              <span class="chat-list-time">${time}</span>
            </div>
            <div class="chat-list-preview">${preview}</div>
          </div>
        </div>
      `;
    });
  }

  if (html === '') {
    html = '<div class="empty-state">还没有聊天对象，快去添加梦角或建群吧！</div>';
  }
  container.innerHTML = html;
}

// ===== 打开指定梦角的聊天窗口 =====
function openChat(id) {
    if (!state.lastReadAt) state.lastReadAt = {};
  state.lastReadAt[id] = Date.now();
  saveState();
  state.currentChatId = id;
  var isGroup = id && id.startsWith('group_');
  
  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === id; });
    if (g) {
      document.getElementById('chatHeaderName').textContent = g.name;
      checkExpiredMutes(g);
    } else {
      showToast('该群聊不存在');
      navigateTo('pageChatList');
      return;
    }
  } else {
    var d = state.dreams.find(function(item) { return item.id === id; });
    if (d) {
      state.dream = Object.assign({}, d);
      document.getElementById('chatHeaderName').textContent = d.name;
    } else {
      showToast('该梦角不存在');
      navigateTo('pageChatList');
      return;
    }
  }
  
  // 强制跳转到私聊页面
  navigateTo('pagePrivateChat');
}

// ===== 群聊占位（第三阶段实现） =====
// ===== 打开建群页面 =====
function createGroupChat() {
  if (!state.dreams || state.dreams.length === 0) {
    showToast('还没有梦角，无法建群哦');
    return;
  }
  var list = document.getElementById('groupMemberList');
  list.innerHTML = state.dreams.map(function(d) {
    var avatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27 viewBox=%270 0 40 40%27%3E%3Ccircle cx=%2720%27 cy=%2720%27 r=%2720%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2720%27 y=%2725%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2716%27%3E💜%3C/text%3E%3C/svg%3E';
    return `
      <label style="display:flex;align-items:center;background:var(--card);padding:12px 16px;border-radius:12px;border:1px solid var(--border);cursor:pointer;">
        <input type="checkbox" value="${d.id}" style="width:18px;height:18px;margin-right:12px;accent-color:var(--blue);">
        <img src="${avatar}" style="width:36px;height:36px;border-radius:50%;margin-right:10px;object-fit:cover;">
        <span style="font-size:15px;color:var(--text);">${d.name}</span>
      </label>
    `;
  }).join('');
  
  document.getElementById('groupNameInput').value = '我们的秘密基地';
  navigateTo('pageCreateGroup');
}

// ===== 保存群聊 =====
function saveGroup() {
  var name = document.getElementById('groupNameInput').value.trim() || '未命名群聊';
  var checkboxes = document.querySelectorAll('#groupMemberList input[type="checkbox"]:checked');
  var memberIds = [];
  checkboxes.forEach(function(cb) { memberIds.push(cb.value); });

  if (memberIds.length === 0) {
    showToast('至少要选一个群成员哦！');
    return;
  }

  var groupId = 'group_' + Date.now();
  state.groups.push({
    id: groupId,
    name: name,
    memberIds: memberIds,
    avatar: '',
    ownerId: 'user', // 新增：默认群主是用户自己
    mutedIds: []     // 新增：被禁言的成员名单
  });
  saveState();
    // 拉群系统消息
  var memberNames = memberIds.map(function(id) {
    var m = state.dreams.find(function(d) { return d.id === id; });
    return m ? m.name : '未知';
  });
  var myName = state.profile.name || '我';
  if (!state.chatSessions[groupId]) state.chatSessions[groupId] = [];
  state.chatSessions[groupId].push({ from: 'system', text: '「' + myName + '」邀请「' + memberNames.join('」「') + '」进入了群聊', time: Date.now() });
  showToast('群聊创建成功！');
  navigateTo('pageChatList');
}
// ===== 判断打开哪个设置 =====
function openChatSettings() {
  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    renderGroupSettings();
    navigateTo('pageGroupSettings');
  } else {
    initMuteToggle();
    initReadNoReplyToggle();
    navigateTo('pageChatSettings');
  }
}

// ===== 渲染群设置页面 =====
// ===== 渲染群设置页面 =====
function renderGroupSettings() {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  
  // 每次打开设置，先检查有没有禁言到期
  checkExpiredMutes(g);

  // 初始化：如果没有群头像，留空
  if (!g.avatar) g.avatar = '';
  
  var ownerName = '我';
  if (g.ownerId && g.ownerId !== 'user') {
    var owner = state.dreams.find(function(d) { return d.id === g.ownerId; });
    if (owner) ownerName = owner.name;
  }
  var isUserOwner = (g.ownerId === 'user');

  // 渲染群头像和群名区域
  var groupAvatarHtml = `
    <div class="avatar-edit" style="margin-bottom:16px;">
      <img class="avatar-preview" id="groupAvatarPreview" src="${g.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 80 80%27%3E%3Ccircle cx=%2740%27 cy=%2740%27 r=%2740%27 fill=%27%23dff0ff%27/%3E%3Ctext x=%2740%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%23007aff%27 font-size=%2728%27%3E👥%3C/text%3E%3C/svg%3E'}">
      <input type="file" id="groupAvatarInput" accept="image/*" style="display:none" onchange="handleGroupAvatar(event)">
      <span style="font-size:12px;color:var(--gray);cursor:pointer" onclick="document.getElementById('groupAvatarInput').click()">点击更换群头像</span>
    </div>
    <div class="form-group">
      <label>群聊名称</label>
      <input type="text" id="groupSettingsName" value="${g.name}" placeholder="给群聊起个名字">
    </div>
    <div style="font-size:13px; font-weight:500; color:var(--gray); margin-bottom:4px;">当前群主</div>
    <div style="background:var(--card); padding:12px 14px; border-radius:12px; border:1px solid var(--border); font-size:15px; color:var(--text); margin-bottom:16px;">
      ${ownerName} ${isUserOwner ? '（你自己）' : ''}
    </div>
  `;
  document.getElementById('groupOwnerArea').innerHTML = groupAvatarHtml;

  // 渲染添加成员区域（只对群主可见）
  var addMemberHtml = '';
  if (isUserOwner) {
    // 找出不在群里的梦角
    var availableDreams = state.dreams.filter(function(d) {
      return !g.memberIds.includes(d.id);
    });
    if (availableDreams.length > 0) {
      addMemberHtml = `
        <label style="font-size:14px;font-weight:600;color:var(--text);display:block;margin-top:16px;margin-bottom:8px;">添加新成员</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
      `;
      availableDreams.forEach(function(d) {
        addMemberHtml += `
          <div onclick="addGroupMember('${d.id}')" style="display:flex;align-items:center;background:var(--card);padding:6px 12px;border-radius:20px;border:1px dashed var(--border);cursor:pointer;font-size:13px;">
            <img src="${d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%2712%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2712%27 y=%2716%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2710%27%3E💜%3C/text%3E%3C/svg%3E'}" style="width:24px;height:24px;border-radius:50%;margin-right:6px;object-fit:cover;">
            ${d.name}
          </div>
        `;
      });
      addMemberHtml += `</div>`;
    }
  }

  // 渲染成员列表及操作按钮（只有群主才能操作禁言/移出/转让）
  var list = document.getElementById('groupMemberManageList');
  var membersHtml = '';
  g.memberIds.forEach(function(id) {
    var m = state.dreams.find(function(d) { return d.id === id; });
    if (!m) return;
    
    var isMuted = g.muteEndsAt && g.muteEndsAt[id] !== undefined;
    var isOwner = (g.ownerId === id);
    
    // 只有用户是群主时，才能操作别人
    var actionBtns = '';
    if (isUserOwner && !isOwner) {
      actionBtns = `
        <span style="font-size:12px;padding:4px 8px;border-radius:8px;cursor:pointer;background:#dff0ff;color:#007aff;margin-left:6px;" onclick="transferGroupOwner('${id}')">转让</span>
        <span style="font-size:12px;padding:4px 8px;border-radius:8px;cursor:pointer;background:${isMuted ? '#ffe0e0' : '#f0f0f5'};color:${isMuted ? 'var(--red)' : 'var(--gray)'};margin-left:6px;" onclick="selectMuteTime('${id}')">${isMuted ? '解除' : '禁言'}</span>
        <span style="font-size:12px;padding:4px 8px;border-radius:8px;cursor:pointer;background:#ffe0e0;color:var(--red);margin-left:6px;" onclick="removeGroupMember('${id}')">移出</span>
      `;
    } else if (isMuted) {
      actionBtns = `<span style="font-size:12px;color:var(--red);margin-left:6px;">已禁言</span>`;
    }
    
    membersHtml += `
      <div style="display:flex;align-items:center;background:var(--card);padding:10px 12px;border-radius:12px;border:1px solid var(--border);margin-bottom:8px;">
        <img src="${m.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2736%27 height=%2736%27 viewBox=%270 0 36 36%27%3E%3Ccircle cx=%2718%27 cy=%2718%27 r=%2718%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2718%27 y=%2723%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2714%27%3E💜%3C/text%3E%3C/svg%3E'}" style="width:36px;height:36px;border-radius:50%;margin-right:10px;object-fit:cover;">
        <span style="flex:1;font-size:15px;color:var(--text);">${m.name} ${isOwner ? '<span style="font-size:11px;color:#ff9500;">(群主)</span>' : ''}</span>
        ${actionBtns}
      </div>
    `;
  });
  
  // 将添加成员区域和成员列表拼在一起，放在群主区域下方
  document.getElementById('groupOwnerArea').innerHTML += addMemberHtml;
  list.innerHTML = membersHtml;
}

// ===== 用户主动转让群主 =====
function transferGroupOwner(memberId) {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  if (g.ownerId !== 'user') { showToast('只有群主才能转让哦'); return; }
  
  var member = state.dreams.find(function(d) { return d.id === memberId; });
  if (!member) return;
  if (!confirm('确定要把群主转让给「' + member.name + '」吗？')) return;

  var oldOwnerName = '你';
  g.ownerId = memberId;
  
  // 推送系统消息
  var sysMsg = { from: 'system', text: '「' + oldOwnerName + '」已将群主转让给「' + member.name + '」', time: Date.now() };
  if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
  state.chatSessions[g.id].push(sysMsg);
  
  saveState();
  renderGroupSettings();
  renderChatMessages(); // 如果此时在群里，刷新聊天界面
  showToast('群主已转让');
}

// ===== 修改群名 =====
function updateGroupName() {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  g.name = document.getElementById('groupSettingsName').value.trim() || '未命名';
  saveState();
  showToast('群名已修改');
}

// ===== 禁言/解除禁言 =====
function toggleMuteMember(id) {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  if (!g.mutedIds) g.mutedIds = [];
  
  var idx = g.mutedIds.indexOf(id);
  var member = state.dreams.find(function(d) { return d.id === id; });
  var memberName = member ? member.name : '未知';

  if (idx > -1) {
    g.mutedIds.splice(idx, 1);
    showToast('已解除 ' + memberName + ' 的禁言');
  } else {
    g.mutedIds.push(id);
    // 【系统消息】：在群里显示禁言提示
    var sysMsg = { from: 'system', text: '「' + memberName + '」已被群主禁言', time: Date.now() };
    // 把系统消息推送到聊天记录里
    if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
    state.chatSessions[g.id].push(sysMsg);
    showToast('已禁言 ' + memberName);
  }
  saveState();
  renderGroupSettings();
}

// ===== 移出群成员 =====
function removeGroupMember(id) {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  if (!confirm('确定要将该成员移出群聊吗？')) return;
  
  g.memberIds = g.memberIds.filter(function(mid) { return mid !== id; });
  if (g.mutedIds) g.mutedIds = g.mutedIds.filter(function(mid) { return mid !== id; });
  if (g.ownerId === id) g.ownerId = 'user'; // 如果群主被移出，群主自动回到用户身上
  saveState();
  renderGroupSettings();
  showToast('成员已移出');
}

// ===== 解散群聊 =====
function dissolveGroup() {
  if (!confirm('确定要解散该群聊吗？聊天记录也会被清除！')) return;
  state.groups = state.groups.filter(function(item) { return item.id !== state.currentChatId; });
  delete state.chatSessions[state.currentChatId];
  state.currentChatId = null;
  saveState();
  showToast('群聊已解散');
  navigateTo('pageChatList');
}
// ===== 检查禁言是否过期（自动解除） =====
function checkExpiredMutes(group) {
  if (!group || !group.muteEndsAt) return false;
  var now = Date.now();
  var hasChanges = false;
  
  Object.keys(group.muteEndsAt).forEach(function(memberId) {
    if (now >= group.muteEndsAt[memberId]) {
      // 到期了，解禁
      delete group.muteEndsAt[memberId];
      var member = state.dreams.find(function(d) { return d.id === memberId; });
      var memberName = member ? member.name : '未知成员';
      
      // 写入系统消息
      if (!state.chatSessions[group.id]) state.chatSessions[group.id] = [];
      state.chatSessions[group.id].push({
        from: 'system',
        text: '「' + memberName + '」的禁言时间已结束，已自动解除禁言',
        time: Date.now()
      });
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    saveState();
  }
  return hasChanges;
}
// ===== 保存群设置 =====
function saveGroupSettings() {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  g.name = document.getElementById('groupSettingsName').value.trim() || '未命名';
  saveState();
  showToast('群设置已保存');
  // 刷新聊天界面顶部的群名
  document.getElementById('chatHeaderName').textContent = g.name;
}

// ===== 群头像上传（带压缩） =====
function handleGroupAvatar(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_SIZE = 200;
      var width = img.width, height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // 更新预览和本地数据
      document.getElementById('groupAvatarPreview').src = compressedDataUrl;
      var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
      if (g) {
        g.avatar = compressedDataUrl;
        saveState();
        renderChatList(); // 刷新聊天列表里的群头像
        showToast('群头像已更新');
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== 添加群成员 =====
function addGroupMember(memberId) {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  if (g.memberIds.includes(memberId)) return;
  
  g.memberIds.push(memberId);
  saveState();
  renderGroupSettings(); // 重新渲染页面
  showToast('成员已添加');
  
  // 系统消息
  var member = state.dreams.find(function(d) { return d.id === memberId; });
  if (member) {
    if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
    state.chatSessions[g.id].push({ from: 'system', text: '「' + member.name + '」加入了群聊', time: Date.now() });
    saveState();
  }
}

// ===== 弹出禁言时间选择 =====
function selectMuteTime(memberId) {
  var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
  if (!g) return;
  
  if (g.muteEndsAt && g.muteEndsAt[String(memberId)] !== undefined) {
    delete g.muteEndsAt[String(memberId)];
    var member = state.dreams.find(function(d) { return d.id === memberId; });
    var memberName = member ? member.name : '未知';
    if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
    state.chatSessions[g.id].push({ from: 'system', text: '「' + memberName + '」已解除禁言', time: Date.now() });
    saveState();
    renderGroupSettings();
    renderChatMessages();
    showToast('已解除禁言');
    return;
  }
  
  var times = [
    { label: '5分钟', value: 5 * 60 * 1000 },
    { label: '10分钟', value: 10 * 60 * 1000 },
    { label: '15分钟', value: 15 * 60 * 1000 },
    { label: '30分钟', value: 30 * 60 * 1000 }
  ];
  
  var msg = '请选择禁言时长：\n1. 5分钟\n2. 10分钟\n3. 15分钟\n4. 30分钟\n（输入对应数字）';
  var choice = prompt(msg, '1');
  if (choice === null) return;
  
  var idx = parseInt(choice) - 1;
  if (idx < 0 || idx >= times.length) { showToast('选择无效'); return; }
  
  var duration = times[idx].value;
  if (!g.muteEndsAt) g.muteEndsAt = {};
  g.muteEndsAt[String(memberId)] = Date.now() + duration; // 强制转成字符串

  // 【核心】取消之前所有的 AI 回复闹钟，防止他在被禁言后还能发出声音
  if (window.replyTimeout) {
    clearTimeout(window.replyTimeout);
    window.replyTimeout = null;
  }
  
  var member = state.dreams.find(function(d) { return d.id === memberId; });
  var memberName = member ? member.name : '未知';
  if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
  state.chatSessions[g.id].push({ from: 'system', text: '「' + memberName + '」已被群主禁言 ' + times[idx].label, time: Date.now() });
  
  saveState();
  renderGroupSettings();
  renderChatMessages();
  showToast('已禁言 ' + times[idx].label);
}
// ===== 面板控制逻辑 =====
function toggleActionMenu() {
  var menu = document.getElementById('actionMenuPanel');
  var sticker = document.getElementById('stickerPanel');
  var poke = document.getElementById('pokePanel');
  
  if (menu.style.display === 'none' || menu.style.display === '') {
    menu.style.display = 'block';
    sticker.style.display = 'none';
    poke.style.display = 'none';
  } else {
    menu.style.display = 'none';
  }
}

function openStickerPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  document.getElementById('stickerPanel').style.display = 'block';
  renderStickers();
}

function openPokePanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  document.getElementById('pokePanel').style.display = 'block';
  renderPokes();
}

// ===== 拍一拍数据与逻辑 =====
// 初始化拍一拍词条（如果还没的话）
if (!state.pokes) {
  state.pokes = ["拍了拍对方", "戳了戳脸颊", "摸了摸头"];
}

function renderPokes() {
  var container = document.getElementById('pokeListContainer');
  if (!container) return;
  
  container.innerHTML = state.pokes.map(function(text, index) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg);padding:10px 12px;border-radius:10px;margin-bottom:6px;">
        <span style="font-size:14px;color:var(--text);cursor:pointer;flex:1;" onclick="sendPoke('${text}')">${text}</span>
        <span style="font-size:16px;color:var(--red);cursor:pointer;padding:0 6px;" onclick="deletePoke(${index})">×</span>
      </div>
    `;
  }).join('');
}

function addPokeText() {
  var text = prompt('输入拍一拍内容（例如：拍了拍对方）');
  if (!text || text.trim() === '') return;
  state.pokes.push(text.trim());
  saveState();
  renderPokes();
  showToast('拍一拍已添加');
}

function deletePoke(index) {
  state.pokes.splice(index, 1);
  saveState();
  renderPokes();
  showToast('已删除');
}

// ===== 发送拍一拍（用户） =====
function sendPoke(text) {
  var senderName = state.profile.name || '我';
  
  chatMessages.push({
    from: 'user',
    type: 'poke',
    text: text,  // 直接原样发送用户输入的内容
    senderName: senderName,
    time: Date.now()
  });
  
  document.getElementById('actionMenuPanel').style.display = 'none';
  document.getElementById('pokePanel').style.display = 'none';
  renderChatMessages();
  saveChatMessages();
  
    scheduleAiReply();
}

// ===== 发送图片（用户） =====
function sendImageMessage(e) {
  var file = e.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_WIDTH = 600;
      var width = img.width;
      var height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      
      // 新增：status: 'unread'
      chatMessages.push({ from: 'user', type: 'image', imageData: compressedDataUrl, time: Date.now(), status: 'unread' });
      document.getElementById('actionMenuPanel').style.display = 'none';
      renderChatMessages();
      saveChatMessages();
      
      scheduleAiReply();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ===== 正在输入 + 延迟回复调度器（终极唯一版） =====
function scheduleAiReply() {
  if (window.typingTimeout) clearTimeout(window.typingTimeout);
  if (window.replyTimeout) clearTimeout(window.replyTimeout);
  if (window.readTimeout) clearTimeout(window.readTimeout);

  // 提前选好回复的角色（群聊）
  window.nextReplySender = null;
  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (g && g.memberIds.length > 0) {
      var availableIds = g.memberIds.filter(function(id) {
        return !g.muteEndsAt || g.muteEndsAt[String(id)] === undefined;
      });
      if (availableIds.length > 0) {
        var randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
        var member = state.dreams.find(function(item) { return item.id === randomId; });
        if (member) {
          window.nextReplySender = { id: member.id, name: member.name, avatar: member.avatar || '' };
        }
      }
    }
  }

  // 【已读】：1.5-4 秒后所有消息变已读
  window.readTimeout = setTimeout(function() {
    var hasUnread = false;
    for (var i = 0; i < chatMessages.length; i++) {
      if (chatMessages[i].from === 'user' && chatMessages[i].status === 'unread') {
        chatMessages[i].status = 'read';
        hasUnread = true;
      }
    }
    if (hasUnread) { saveChatMessages(); renderChatMessages(); }
  }, 1500 + Math.random() * 2500);

  // 【已读不回】：开启后，30% 概率不回
  if (state.settings && state.settings.readNoReply) {
    if (Math.random() < 0.3) {
      // 只已读，不回
      return;
    }
  }

  // 正常回复：显示"正在输入" + 延迟发消息
  window.typingTimeout = setTimeout(function() { showTypingIndicator(); }, 1000 + Math.random() * 1000);

  var minS = (state.settings && state.settings.replyMinSec != null) ? state.settings.replyMinSec : 3;
  var maxS = (state.settings && state.settings.replyMaxSec != null) ? state.settings.replyMaxSec : 7;
  if (maxS < minS) maxS = minS;
  var delayMs = (minS + Math.random() * (maxS - minS)) * 1000;

  window.replyTimeout = setTimeout(function() { hideTypingIndicator(); dreamReply(); }, delayMs);
}

function showTypingIndicator() {
  var indicator = document.getElementById('typingIndicator');
  if (!indicator) return;
  var name = '';
  if (state.currentChatId && state.currentChatId.startsWith('group_')) {
    if (window.nextReplySender) name = window.nextReplySender.name;
    else { indicator.style.display = 'none'; return; }
  } else {
    var d = state.dreams.find(function(item) { return item.id === state.currentChatId; });
    if (d) name = d.name;
  }
  if (name) {
    indicator.innerHTML = '<span style="font-weight:600;color:#555;">' + name + '</span> 正在输入<span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>';
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}

function hideTypingIndicator() {
  var indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.style.display = 'none';
}

// ===== 长按消息菜单 =====
var pressTimer = null;

function attachLongPress() {
  var container = document.getElementById('chatMessages');
  if (!container) return;
  var bubbles = container.querySelectorAll('[data-msg-index]');
  bubbles.forEach(function(el) {
    var idx = parseInt(el.dataset.msgIndex);
    el.addEventListener('touchstart', function(e) {
      pressTimer = setTimeout(function() {
        showMsgMenu(idx, el);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 500);
    }, { passive: true });
    el.addEventListener('touchend', function() { clearTimeout(pressTimer); });
    el.addEventListener('touchmove', function() { clearTimeout(pressTimer); });
    el.addEventListener('touchcancel', function() { clearTimeout(pressTimer); });
    el.addEventListener('mousedown', function(e) {
      pressTimer = setTimeout(function() { showMsgMenu(idx, el); }, 500);
    });
    el.addEventListener('mouseup', function() { clearTimeout(pressTimer); });
    el.addEventListener('mouseleave', function() { clearTimeout(pressTimer); });
  });
}

function showMsgMenu(index, el) {
  var m = chatMessages[index];
  if (!m) return;
  var menu = document.getElementById('msgMenu');
  var mask = document.getElementById('msgMenuMask');
    var items = [];
   if (m.from === 'user') items.push({ label: '撤回', action: 'recall' });
  items.push({ label: '引用', action: 'quote' });
  items.push({ label: '多选', action: 'multi' });
  items.push({ label: '收藏', action: 'favorite' });
  items.push({ label: '删除', action: 'delete' });

  menu.innerHTML = items.map(function(item) {
    return '<button onclick="handleMsgAction(\'' + item.action + '\',' + index + ')">' + item.label + '</button>';
  }).join('');

  menu.style.visibility = 'hidden';
  menu.style.display = 'flex';
  var menuW = menu.offsetWidth;
  var menuH = menu.offsetHeight;

   var bubbleEl = el.querySelector('[class*="bubble"]');
  var rect = bubbleEl ? bubbleEl.getBoundingClientRect() : el.getBoundingClientRect();
  var isUser = m.from === 'user';
  var left;
  if (isUser) left = rect.right - menuW;
  else left = rect.left;
  left = Math.max(10, Math.min(left, window.innerWidth - menuW - 10));

  var top = rect.top - menuH - 8;
  if (top < 10) top = rect.bottom + 8;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.visibility = 'visible';

  // 显示遮罩
  mask.style.display = 'block';
}

function hideMsgMenu() {
  var menu = document.getElementById('msgMenu');
  var mask = document.getElementById('msgMenuMask');
  if (menu) menu.style.display = 'none';
  if (mask) mask.style.display = 'none';
}

function handleMsgAction(action, index) {
  var m = chatMessages[index];
  if (!m) { hideMsgMenu(); return; }

  // 多选
  if (action === 'multi') {
    hideMsgMenu();
    enterMultiSelect(index);
    return;
  }

  // 引用
  if (action === 'quote') {
    var senderName = '';
    if (m.from === 'user') {
      senderName = state.profile.name || '我';
    } else if (m.senderId) {
      var mem = state.dreams.find(function(d) { return d.id === m.senderId; });
      if (mem) senderName = mem.name;
    } else if (m.senderName) {
      senderName = m.senderName;
    } else {
      var dm = state.dreams.find(function(d) { return d.id === state.currentChatId; });
      if (dm) senderName = dm.name;
    }
    window.quoteData = { text: m.text || '[表情]', senderName: senderName, msgId: index };
    document.getElementById('quotePreview').style.display = 'block';
    document.getElementById('quoteText').textContent = senderName + '：' + (m.text || '[表情]');
    hideMsgMenu();
    document.getElementById('chatInput').focus();
    return;
  }

  // 收藏
  if (action === 'favorite') {
    if (!state.favorites) state.favorites = [];
    var who = '我';
    if (m.from === 'user') {
      who = state.profile.name || '我';
    } else if (m.senderId) {
      var mem2 = state.dreams.find(function(d) { return d.id === m.senderId; });
      who = mem2 ? mem2.name : '梦角';
    } else if (m.senderName) {
      who = m.senderName;
    } else if (state.currentChatId && !state.currentChatId.startsWith('group_')) {
      var dm2 = state.dreams.find(function(d) { return d.id === state.currentChatId; });
      who = dm2 ? dm2.name : '梦角';
    } else {
      who = '梦角';
    }
    var chatName = '';
    if (state.currentChatId && state.currentChatId.startsWith('group_')) {
      var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
      chatName = g ? ('群聊：' + g.name) : '';
    } else {
      var d2 = state.dreams.find(function(item) { return item.id === state.currentChatId; });
      chatName = d2 ? ('私聊：' + d2.name) : '';
    }
    state.favorites.push({
      id: 'fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: m.text || '[表情]',
      senderName: who,
      isUser: m.from === 'user',
      chatName: chatName,
      time: m.time,
      addedAt: Date.now()
    });
    saveState();
    hideMsgMenu();
    showToast('已收藏');
    return;
  }

  // 撤回
  if (action === 'recall') {
    if (m.from !== 'user') { hideMsgMenu(); return; }
    var name = state.profile.name || '我';
    chatMessages[index] = { from: 'system', text: '「' + name + '」撤回了一条消息', time: Date.now() };
    saveChatMessages();
    renderChatMessages();
    hideMsgMenu();
    showToast('已撤回');
    return;
  }

  // 删除
  if (action === 'delete') {
    chatMessages.splice(index, 1);
    saveChatMessages();
    renderChatMessages();
    hideMsgMenu();
    showToast('已删除');
    return;
  }

  hideMsgMenu();
}
function clearQuote() {
  window.quoteData = null;
  document.getElementById('quotePreview').style.display = 'none';
  document.getElementById('quoteText').textContent = '';
}
// ===== 多选模式 =====
var isMultiSelectMode = false;
var selectedIndices = [];

function enterMultiSelect(startIndex) {
  isMultiSelectMode = true;
  selectedIndices = [];
  if (typeof startIndex === 'number') selectedIndices.push(startIndex);
  document.getElementById('multiSelectBar').style.display = 'flex';
  updateMultiSelectUI();
  renderChatMessages();
}

function exitMultiSelect() {
  isMultiSelectMode = false;
  selectedIndices = [];
  document.getElementById('multiSelectBar').style.display = 'none';
  renderChatMessages();
}

function toggleSelectMessage(index) {
  var pos = selectedIndices.indexOf(index);
  if (pos > -1) selectedIndices.splice(pos, 1);
  else selectedIndices.push(index);
  updateMultiSelectUI();
  renderChatMessages();
}

function updateMultiSelectUI() {
  document.getElementById('multiSelectCount').textContent = '已选 ' + selectedIndices.length + ' 条';
}

function batchDeleteMessages() {
  if (selectedIndices.length === 0) { showToast('请先选择消息'); return; }
  if (!confirm('确定删除选中的 ' + selectedIndices.length + ' 条消息？')) return;
  // 从大到小删，防止索引错乱
  var sorted = selectedIndices.slice().sort(function(a, b) { return b - a; });
  sorted.forEach(function(i) { chatMessages.splice(i, 1); });
  exitMultiSelect();
  saveChatMessages();
  renderChatMessages();
  showToast('已删除');
}
// ===== 转发功能 =====
function openForwardPanel() {
  if (selectedIndices.length === 0) { showToast('请先选择消息'); return; }
  var panel = document.getElementById('forwardPanel');
  var mask = document.getElementById('forwardMask');
  var list = document.getElementById('forwardTargetList');
  var html = '';

  // 所有梦角
  if (state.dreams && state.dreams.length > 0) {
    state.dreams.forEach(function(d) {
      var avatar = d.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
      html += '<div onclick="doForward(\'' + d.id + '\')" style="display:flex;align-items:center;padding:12px 16px;cursor:pointer;border-bottom:1px solid #f5f5f5;"><img src="' + avatar + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin-right:12px;"><span style="font-size:15px;color:#333;">' + d.name + '</span></div>';
    });
  }
  // 所有群聊
  if (state.groups && state.groups.length > 0) {
    state.groups.forEach(function(g) {
      var avatar = g.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23dff0ff%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23007aff%27 font-size=%2720%27%3E👥%3C/text%3E%3C/svg%3E';
      html += '<div onclick="doForward(\'' + g.id + '\')" style="display:flex;align-items:center;padding:12px 16px;cursor:pointer;border-bottom:1px solid #f5f5f5;"><img src="' + avatar + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin-right:12px;"><span style="font-size:15px;color:#333;">' + g.name + '</span></div>';
    });
  }

  if (html === '') html = '<div style="padding:30px;text-align:center;color:#999;">没有可转发的目标</div>';
  list.innerHTML = html;
  panel.style.display = 'block';
  mask.style.display = 'block';
}

function closeForwardPanel() {
  document.getElementById('forwardPanel').style.display = 'none';
  document.getElementById('forwardMask').style.display = 'none';
}

function doForward(targetId) {
  if (selectedIndices.length === 0) { closeForwardPanel(); return; }

  // 收集选中的消息（按原顺序）
  var sorted = selectedIndices.slice().sort(function(a, b) { return a - b; });
   var fwdMessages = sorted.map(function(i) {
    var m = chatMessages[i];
    var who = '';
    if (m.from === 'user') {
      who = state.profile.name || '我';
    } else if (m.senderId) {
      var mem = state.dreams.find(function(d) { return d.id === m.senderId; });
      who = mem ? mem.name : '梦角';
    } else if (m.senderName) {
      who = m.senderName;
    } else if (state.currentChatId && !state.currentChatId.startsWith('group_')) {
      var dm = state.dreams.find(function(d) { return d.id === state.currentChatId; });
      who = dm ? dm.name : '梦角';
    } else {
      who = '梦角';
    }
    return { from: m.from, text: m.text || '[表情]', senderId: m.senderId, senderName: who };
  });

  // 构建转发卡片
  var previewText = fwdMessages[0] ? fwdMessages[0].text : '';
  var forwardCard = {
    from: 'user',
    type: 'forward',
    title: '聊天记录',
    messages: fwdMessages,
    preview: previewText,
    time: Date.now(),
    status: 'unread'
  };

  // 判断目标：私聊 or 群聊
  var isGroup = targetId.startsWith('group_');
  var targetName = isGroup
    ? (state.groups.find(function(g){ return g.id === targetId; }) || {}).name || '群聊'
    : (state.dreams.find(function(d){ return d.id === targetId; }) || {}).name || '梦角';

  // 保存当前聊天
  saveChatMessages();

  // 切到目标聊天，追加转发卡片
  state.currentChatId = targetId;
  var targetMsgs = state.chatSessions[targetId] || [];
  targetMsgs.push(forwardCard);
  state.chatSessions[targetId] = targetMsgs;
  saveState();

  exitMultiSelect();
  closeForwardPanel();
  showToast('已转发给「' + targetName + '」');

  // 切到目标聊天
  loadChatMessages();
  renderChat();
  navigateTo('pagePrivateChat');
}

// 点击转发卡片展开
function openForwardDetail(index) {
  var m = chatMessages[index];
  if (!m || m.type !== 'forward') return;
  var detail = m.messages.map(function(msg) {
        var who = msg.from === 'user' ? (state.profile.name || '我') : (msg.senderName || '梦角');
    if (msg.senderId) {
      var m2 = state.dreams.find(function(d) { return d.id === msg.senderId; });
      if (m2) who = m2.name;
    }
    return who + '：' + msg.text;
  }).join('\n');
  alert('聊天记录：\n\n' + detail);
}
// ===== 回复速度 & 主动找我 =====
function initSpeedSettings() {
  if (!state.settings) state.settings = {};
  
  var minInput = document.getElementById('replyMinSec');
  var maxInput = document.getElementById('replyMaxSec');
  
  if (minInput) {
    minInput.value = state.settings.replyMinSec != null ? state.settings.replyMinSec : 3;
    minInput.onchange = function() {
      var v = Math.max(0, parseInt(this.value) || 0);
      state.settings.replyMinSec = v;
      this.value = v;
      saveState();
    };
  }
  if (maxInput) {
    maxInput.value = state.settings.replyMaxSec != null ? state.settings.replyMaxSec : 7;
    maxInput.onchange = function() {
      var v = Math.max(0, parseInt(this.value) || 0);
      state.settings.replyMaxSec = v;
      this.value = v;
      saveState();
    };
  }
  
  // 主动找我（保留原来的）
  var autoSel = document.getElementById('autoMessageSelect');
  if (autoSel) {
    autoSel.value = state.settings.autoMessageDelay || '0';
    autoSel.onchange = function() {
      state.settings.autoMessageDelay = parseInt(this.value) || 0;
      saveState();
      showToast('主动找我：' + this.options[this.selectedIndex].text);
    };
  }
}
// ===== 消息统计 =====
function openStats() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  var content = document.getElementById('statsContent');
  if (!chatMessages || chatMessages.length === 0) {
    content.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">还没有消息</div>';
    document.getElementById('statsPanel').style.display = 'block';
    document.getElementById('statsMask').style.display = 'block';
    return;
  }

  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  var html = '';

  if (isGroup) {
    // 群聊：说话最多排行
    var speakerCount = {};
    chatMessages.forEach(function(m) {
      if (m.from !== 'dream' || !m.senderId) return;
      speakerCount[m.senderId] = (speakerCount[m.senderId] || 0) + 1;
    });
    var arr = Object.keys(speakerCount).map(function(id) {
      var mem = state.dreams.find(function(d) { return d.id === id; });
      return { name: mem ? mem.name : '未知', count: speakerCount[id] };
    }).sort(function(a, b) { return b.count - a.count; });

    html += '<div style="font-size:13px;color:#999;margin-bottom:10px;">群聊活跃榜</div>';
    if (arr.length === 0) {
      html += '<div style="text-align:center;color:#999;padding:20px;">暂无数据</div>';
    } else {
      var medals = ['🥇', '🥈', '🥉'];
      arr.slice(0, 3).forEach(function(item, i) {
        html += '<div style="display:flex;align-items:center;padding:10px 12px;background:#f8f8fa;border-radius:12px;margin-bottom:8px;">';
        html += '<span style="font-size:20px;margin-right:10px;">' + (medals[i] || '') + '</span>';
        html += '<span style="flex:1;font-size:14px;color:#333;">' + item.name + '</span>';
        html += '<span style="font-size:13px;color:#888;">' + item.count + ' 条</span>';
        html += '</div>';
      });
    }
  } else {
    // 私聊：用户和梦角的消息数 + 高频话排行
    var userCount = 0, dreamCount = 0;
    var textCount = {};
    chatMessages.forEach(function(m) {
      if (m.from === 'user') userCount++;
      else if (m.from === 'dream') dreamCount++;
      var t = m.text;
      if (t && typeof t === 'string' && t.trim() && t !== '[表情]') {
        textCount[t] = (textCount[t] || 0) + 1;
      }
    });

    var d = state.dreams.find(function(item) { return item.id === state.currentChatId; });
    var dreamName = d ? d.name : '梦角';

    html += '<div style="display:flex;gap:10px;margin-bottom:16px;">';
    html += '<div style="flex:1;text-align:center;padding:14px;background:#f8f8fa;border-radius:12px;">';
    html += '<div style="font-size:22px;font-weight:600;color:#333;">' + userCount + '</div>';
    html += '<div style="font-size:12px;color:#888;margin-top:4px;">我发的</div>';
    html += '</div>';
    html += '<div style="flex:1;text-align:center;padding:14px;background:#f8f8fa;border-radius:12px;">';
    html += '<div style="font-size:22px;font-weight:600;color:#333;">' + dreamCount + '</div>';
    html += '<div style="font-size:12px;color:#888;margin-top:4px;">' + dreamName + ' 发的</div>';
    html += '</div>';
    html += '</div>';

    var topArr = Object.keys(textCount).map(function(k) {
      return { text: k, count: textCount[k] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);

    if (topArr.length > 0) {
      html += '<div style="font-size:13px;color:#999;margin-bottom:10px;">说得最多的前 5 句</div>';
      topArr.forEach(function(item, i) {
        html += '<div style="display:flex;align-items:center;padding:8px 12px;background:#f8f8fa;border-radius:10px;margin-bottom:6px;">';
        html += '<span style="font-size:12px;color:#999;margin-right:10px;min-width:16px;">' + (i+1) + '</span>';
        html += '<span style="flex:1;font-size:13px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + item.text + '</span>';
        html += '<span style="font-size:12px;color:#888;margin-left:8px;">×' + item.count + '</span>';
        html += '</div>';
      });
    }
  }

  content.innerHTML = html;
  document.getElementById('statsPanel').style.display = 'block';
  document.getElementById('statsMask').style.display = 'block';
}

function closeStats() {
  document.getElementById('statsPanel').style.display = 'none';
  document.getElementById('statsMask').style.display = 'none';
}

// 点遮罩关闭
document.getElementById('statsMask').addEventListener('click', closeStats);
// ===== 用户主动拨号 =====
window.currentCallTargets = [];
window.currentCallType = '';
window.aiAnswerTimer = null;
window.dialTimeoutTimer = null;

function openCallPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (!g || g.memberIds.length === 0) { showToast('群成员为空'); return; }
    var list = document.getElementById('callSelectList');
    list.innerHTML = g.memberIds.map(function(id) {
      var m = state.dreams.find(function(d) { return d.id === id; });
      if (!m) return '';
      var avatar = m.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
      return '<label style="display:flex;align-items:center;padding:10px 12px;background:#f8f8fa;border-radius:12px;margin-bottom:8px;cursor:pointer;"><input type="checkbox" value="' + m.id + '" style="width:18px;height:18px;margin-right:12px;accent-color:#007aff;"><img src="' + avatar + '" style="width:40px;height:40px;border-radius:50%;margin-right:10px;object-fit:cover;"><span style="font-size:15px;color:#333;">' + m.name + '</span></label>';
    }).join('');
    document.getElementById('callSelectPanel').style.display = 'block';
    document.getElementById('callSelectMask').style.display = 'block';
    return;
  }
  // 私聊：直接拨号给当前梦角
  startUserDial([state.currentChatId]);
}

function closeCallSelect() {
  document.getElementById('callSelectPanel').style.display = 'none';
  document.getElementById('callSelectMask').style.display = 'none';
}

function confirmCallSelect() {
  var checked = document.querySelectorAll('#callSelectList input[type="checkbox"]:checked');
  var ids = [];
  checked.forEach(function(cb) { ids.push(cb.value); });
  if (ids.length === 0) { showToast('请至少选一个'); return; }
  closeCallSelect();
  startUserDial(ids);
}

function startUserDial(targetIds) {
  if (state.callState !== 'idle') { showToast('正在通话中'); return; }
  var targets = targetIds.map(function(id) {
    return state.dreams.find(function(d) { return d.id === id; });
  }).filter(function(d) { return d; });
  if (targets.length === 0) { showToast('目标不存在'); return; }

  state.callState = 'dialing';
  window.currentCallTargets = targetIds;
  window.currentCallType = 'user-dial';

  // 头像是多个人的话，用第一个
  var avatar = targets[0].avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2780%27 height=%2780%27 viewBox=%270 0 80 80%27%3E%3Ccircle cx=%2740%27 cy=%2740%27 r=%2740%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2740%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2728%27%3E💜%3C/text%3E%3C/svg%3E';
  document.getElementById('callAvatar').src = avatar;
  document.getElementById('callName').textContent = targets.length > 1 ? targets.length + '人通话' : targets[0].name;
  document.getElementById('callStatus').textContent = '正在呼叫…';
  document.getElementById('callTimer').classList.remove('show');
  document.getElementById('callButtons').innerHTML = '<button class="call-btn hangup" onclick="cancelDial()">☎</button>';

  if (state.settings.callBg) {
    document.getElementById('callCard').style.background = 'url(' + state.settings.callBg + ') center/cover, linear-gradient(145deg,#1a1a2e,#16213e)';
  } else {
    document.getElementById('callCard').style.background = 'linear-gradient(145deg,#1a1a2e,#16213e)';
  }
  document.getElementById('callOverlay').classList.add('active');
  document.getElementById('callMini').classList.remove('show');

  // 多人通话：只要有一个人接就算接通
  // 简化逻辑：整体随机 70% 接通、20% 拒绝、10% 超时
  var roll = Math.random();
  if (roll < 0.7) {
    var wait = 1000 + Math.random() * 2000;
    window.aiAnswerTimer = setTimeout(function() { aiAcceptCall(); }, wait);
  } else if (roll < 0.9) {
    var wait2 = 1500 + Math.random() * 2000;
    window.aiAnswerTimer = setTimeout(function() { aiRejectCall(); }, wait2);
  } else {
    window.dialTimeoutTimer = setTimeout(function() { aiTimeoutCall(); }, 15000);
  }
}

function aiAcceptCall() {
  if (state.callState !== 'dialing') return;
  state.callState = 'connected';
  state.callStartTime = Date.now();
  state.callElapsed = 0;
    // 多人通话时显示所有人头像
  if (window.currentCallTargets && window.currentCallTargets.length > 1) {
    var avatarsHtml = '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">';
    window.currentCallTargets.forEach(function(id) {
      var m = state.dreams.find(function(d) { return d.id === id; });
      if (!m) return;
      var av = m.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
      avatarsHtml += '<div style="text-align:center;"><img src="' + av + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);"><div style="font-size:11px;color:#fff;margin-top:4px;">' + m.name + '</div></div>';
    });
    avatarsHtml += '</div>';
    var card = document.getElementById('callCard');
    var existing = card.querySelector('.multi-avatars');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.className = 'multi-avatars';
    div.innerHTML = avatarsHtml;
    var originalAvatar = card.querySelector('.call-avatar');
    if (originalAvatar) originalAvatar.style.display = 'none';
    card.insertBefore(div, card.firstChild);
  }
  document.getElementById('callStatus').textContent = '通话中';
  document.getElementById('callTimer').classList.add('show');
  document.getElementById('callButtons').innerHTML = '<button class="call-btn minimize" onclick="minimizeCall()">−</button><button class="call-btn hangup" onclick="hangupCall()">☎</button>';
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(function() {
    state.callElapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    document.getElementById('callTimer').textContent = formatDuration(state.callElapsed);
    document.getElementById('miniTime').textContent = formatDuration(state.callElapsed).slice(0,5);
  }, 1000);
}

function aiRejectCall() {
  if (state.callState !== 'dialing') return;
  document.getElementById('callStatus').textContent = '对方已拒绝';
  document.getElementById('callButtons').innerHTML = '';

  if (state.currentChatId) {
    if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
    state.chatSessions[state.currentChatId].push({ from: 'system', text: '对方已拒绝', time: Date.now() });
    saveState();
    loadChatMessages();
    renderChatMessages();
  }

  setTimeout(function() {
    state.callState = 'idle';
    document.getElementById('callOverlay').classList.remove('active');
  }, 1500);
}

function aiTimeoutCall() {
  if (state.callState !== 'dialing') return;
  document.getElementById('callStatus').textContent = '对方无应答';
  document.getElementById('callButtons').innerHTML = '';

  if (state.currentChatId) {
    if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
    state.chatSessions[state.currentChatId].push({ from: 'system', text: '对方无应答', time: Date.now() });
    saveState();
    loadChatMessages();
    renderChatMessages();
  }

  setTimeout(function() {
    state.callState = 'idle';
    document.getElementById('callOverlay').classList.remove('active');
  }, 1500);
}

function cancelDial() {
  if (state.callState !== 'dialing') return;
  if (window.aiAnswerTimer) { clearTimeout(window.aiAnswerTimer); window.aiAnswerTimer = null; }
  if (window.dialTimeoutTimer) { clearTimeout(window.dialTimeoutTimer); window.dialTimeoutTimer = null; }

  if (state.currentChatId) {
    if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
    state.chatSessions[state.currentChatId].push({ from: 'system', text: '已取消', time: Date.now() });
    saveState();
    loadChatMessages();
    renderChatMessages();
  }

  state.callState = 'idle';
  document.getElementById('callOverlay').classList.remove('active');
}
// ===== 通话迷你悬浮球拖拽 =====
function initCallMiniDrag() {
  var mini = document.getElementById('callMini');
  if (!mini || mini.dataset.dragInit) return;
  mini.dataset.dragInit = '1';
  
  var isDragging = false;
  var startX, startY, startLeft, startTop;
  var moved = false;
  
  function getPhone() { return document.querySelector('.phone'); }
  
  function onStart(e) {
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var rect = mini.getBoundingClientRect();
    var phoneRect = getPhone().getBoundingClientRect();
    startX = clientX;
    startY = clientY;
    startLeft = rect.left - phoneRect.left;
    startTop = rect.top - phoneRect.top;
    moved = false;
    isDragging = true;
    mini.style.right = 'auto';
    mini.style.bottom = 'auto';
    mini.style.left = startLeft + 'px';
    mini.style.top = startTop + 'px';
    mini.style.transition = 'none';
  }
  
  function onMove(e) {
    if (!isDragging) return;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var dx = clientX - startX;
    var dy = clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
    if (!moved) return;
    if (e.cancelable) e.preventDefault();
    mini.style.left = (startLeft + dx) + 'px';
    mini.style.top = (startTop + dy) + 'px';
  }
  
  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    if (moved) {
      window.callMiniMoved = true;
      setTimeout(function() { window.callMiniMoved = false; }, 150);
    }
  }
  
  mini.addEventListener('touchstart', onStart, { passive: true });
  mini.addEventListener('touchmove', onMove, { passive: false });
  mini.addEventListener('touchend', onEnd);
  mini.addEventListener('touchcancel', onEnd);
  mini.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

// 立即执行
initCallMiniDrag();
  document.getElementById('callSelectMask').addEventListener('click', closeCallSelect);
// ===== 免打扰开关 =====
function initMuteToggle() {
  var toggle = document.getElementById('muteToggle');
  if (!toggle) return;
  if (!state.mutedChats) state.mutedChats = [];
  var isMuted = state.mutedChats.indexOf(state.currentChatId) > -1;
  toggle.classList.toggle('on', isMuted);
  toggle.onclick = function() {
    if (!state.currentChatId) return;
    if (!state.mutedChats) state.mutedChats = [];
    var idx = state.mutedChats.indexOf(state.currentChatId);
    if (idx > -1) {
      state.mutedChats.splice(idx, 1);
      toggle.classList.remove('on');
      showToast('已取消免打扰');
    } else {
      state.mutedChats.push(state.currentChatId);
      toggle.classList.add('on');
      showToast('已开启免打扰');
    }
    saveState();
    renderChatList();
  };
}
// ===== 主动发消息（超过设定时间没聊，AI主动开口） =====
function checkAutoMessage() {
  if (!state.settings || !state.settings.autoMessageDelay) return;
  var threshold = parseInt(state.settings.autoMessageDelay);
  if (!threshold || threshold <= 0) return;
  if (state.callState !== 'idle') return;
  if (!state.dreams || state.dreams.length === 0) return;
  if (!state.lastActivityAt) state.lastActivityAt = {};

  var now = Date.now();
  var candidates = [];
  state.dreams.forEach(function(d) {
    var lastAt = state.lastActivityAt[d.id] || 0;
    if (lastAt === 0) return; // 从没聊过，不主动
    if (now - lastAt >= threshold) candidates.push(d);
  });
  if (candidates.length === 0) return;

  // 50% 概率真的发，避免太机械
  if (Math.random() > 0.5) return;

  var picked = candidates[Math.floor(Math.random() * candidates.length)];
  var card = (state.cards && state.cards.length > 0)
    ? state.cards[Math.floor(Math.random() * state.cards.length)]
    : null;
  var text = card ? card.text : '……';

  if (!state.chatSessions[picked.id]) state.chatSessions[picked.id] = [];
  state.chatSessions[picked.id].push({
    from: 'dream',
    senderId: picked.id,
    senderAvatar: picked.avatar,
    text: text,
    time: now
  });
  state.lastActivityAt[picked.id] = now;
  saveState();

  // 如果用户正在这个聊天窗口，实时刷新
  if (state.currentChatId === picked.id) {
    loadChatMessages();
    renderChatMessages();
  }
  renderChatList();
  sendNotification(picked.name, text);
}
// ===== 群聊独立背景 =====
function handleGroupBg(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_WIDTH = 800, width = img.width, height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressed = canvas.toDataURL('image/jpeg', 0.6);
      var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
      if (g) {
        g.chatBg = compressed;
        saveState();
        showToast('群聊背景已设置');
        renderChat();
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
// ===== 收藏箱 =====
function renderFavorites() {
  var container = document.getElementById('favoritesList');
  if (!container) return;
  if (!state.favorites || state.favorites.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px 20px;text-align:center;color:var(--gray);">还没有收藏任何消息</div>';
    return;
  }

  // 按添加时间倒序
  var sorted = state.favorites.slice().sort(function(a, b) { return b.addedAt - a.addedAt; });

  container.innerHTML = sorted.map(function(fav) {
    var t = new Date(fav.time);
    var dateStr = (t.getMonth()+1) + '月' + t.getDate() + '日 ' + String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    return `
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--card);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;color:var(--text);">${fav.senderName}</span>
          <span style="font-size:11px;color:var(--gray);">${dateStr}</span>
        </div>
        <div style="font-size:14px;color:var(--text);line-height:1.4;margin-bottom:6px;word-break:break-word;">${fav.text}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:#bbb;">${fav.chatName}</span>
          <span onclick="deleteFavorite('${fav.id}')" style="font-size:12px;color:var(--red);cursor:pointer;padding:4px 8px;">删除</span>
        </div>
      </div>
    `;
  }).join('');
}

function deleteFavorite(id) {
  if (!confirm('确定删除这条收藏？')) return;
  state.favorites = state.favorites.filter(function(f) { return f.id !== id; });
  saveState();
  renderFavorites();
  showToast('已删除');
}

// ===== 日记系统 =====
function renderDiaryList() {
  var container = document.getElementById('diaryList');
  if (!container) return;
  if (!state.diaries || state.diaries.length === 0) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--gray);">还没有日记，点右上角 ✎ 写下第一篇吧</div>';
    return;
  }

  var sorted = state.diaries.slice().sort(function(a, b) { return b.time - a.time; });

  container.innerHTML = sorted.map(function(d) {
    var t = new Date(d.time);
    var timeStr = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    var dateStr = (t.getMonth()+1) + '月' + t.getDate() + '日';

    var avatar = d.authorAvatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27 viewBox=%270 0 40 40%27%3E%3Ccircle cx=%2720%27 cy=%2720%27 r=%2720%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2720%27 y=%2725%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2716%27%3E💜%3C/text%3E%3C/svg%3E';

    var commentsHtml = '';
    if (d.comments && d.comments.length > 0) {
      commentsHtml = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">';
      d.comments.forEach(function(c) {
        var cAvatar = c.authorAvatar || avatar;
        commentsHtml += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
        commentsHtml += '<img src="' + cAvatar + '" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;object-fit:cover;">';
        commentsHtml += '<div style="flex:1;">';
        commentsHtml += '<span style="font-size:12px;font-weight:600;color:var(--text);">' + c.authorName + '</span>';
        if (c.replyToName) commentsHtml += '<span style="font-size:12px;color:var(--gray);"> 回复 </span><span style="font-size:12px;font-weight:600;color:var(--text);">' + c.replyToName + '</span>';
        commentsHtml += '<span style="font-size:12px;color:var(--text);margin-left:4px;">：' + c.text + '</span>';
        commentsHtml += '</div></div>';
      });
      commentsHtml += '</div>';
    }

    return `
      <div style="background:var(--card);margin:10px 12px;padding:16px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);position:relative;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:var(--text);">${d.authorName}</div>
            <div style="font-size:11px;color:var(--gray);">${dateStr} ${timeStr}</div>
          </div>
          <span onclick="deleteDiary('${d.id}')" style="font-size:12px;color:var(--red);cursor:pointer;padding:4px 8px;border-radius:8px;user-select:none;-webkit-tap-highlight-color:transparent;">🗑 删除</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;">
          <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:#f0f0f5;color:#666;">🌤 ${d.weather}</span>
          <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:#f0f0f5;color:#666;">💭 ${d.mood}</span>
        </div>
        <div style="font-size:14px;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word;">${d.text}</div>
        <div style="margin-top:12px;">
          <span onclick="openDiaryComment('${d.id}')" style="font-size:12px;color:var(--blue);cursor:pointer;padding:4px 0;">💬 评论</span>
        </div>
        ${commentsHtml}
      </div>
    `;
  }).join('');
}
function deleteDiary(diaryId) {
  if (!confirm('确定删除这篇日记吗？此操作不可恢复！')) return;
  state.diaries = state.diaries.filter(function(d) { return d.id !== diaryId; });
  saveState();
  renderDiaryList();
  showToast('日记已删除');
}

// 打开写日记页面
var pickedMood = '';
var pickedWeather = '';

function openWriteDiary() {
  pickedMood = MOODS[0];
  pickedWeather = WEATHERS[0];

  var moodBox = document.getElementById('moodTags');
  moodBox.innerHTML = MOODS.map(function(m) {
    var isActive = m === pickedMood;
    return '<span onclick="pickMood(\'' + m + '\')" style="flex-shrink:0;font-size:13px;padding:6px 14px;border-radius:16px;cursor:pointer;background:' + (isActive ? 'var(--blue)' : 'var(--card)') + ';color:' + (isActive ? '#fff' : 'var(--text)') + ';border:1px solid var(--border);transition:all 0.15s;">' + m + '</span>';
  }).join('');

  var weatherBox = document.getElementById('weatherTags');
  weatherBox.innerHTML = WEATHERS.map(function(w) {
    var isActive = w === pickedWeather;
    return '<span onclick="pickWeather(\'' + w + '\')" style="flex-shrink:0;font-size:13px;padding:6px 14px;border-radius:16px;cursor:pointer;background:' + (isActive ? 'var(--blue)' : 'var(--card)') + ';color:' + (isActive ? '#fff' : 'var(--text)') + ';border:1px solid var(--border);transition:all 0.15s;">' + w + '</span>';
  }).join('');

  document.getElementById('diaryText').value = '';
  navigateTo('pageWriteDiary');
}

function pickMood(m) {
  pickedMood = m;
  var moodBox = document.getElementById('moodTags');
  moodBox.querySelectorAll('span').forEach(function(el) {
    var isActive = el.textContent === m;
    el.style.background = isActive ? 'var(--blue)' : 'var(--card)';
    el.style.color = isActive ? '#fff' : 'var(--text)';
  });
}

function pickWeather(w) {
  pickedWeather = w;
  var weatherBox = document.getElementById('weatherTags');
  weatherBox.querySelectorAll('span').forEach(function(el) {
    var isActive = el.textContent === w;
    el.style.background = isActive ? 'var(--blue)' : 'var(--card)';
    el.style.color = isActive ? '#fff' : 'var(--text)';
  });
}

// 保存用户日记
function saveUserDiary() {
  var text = document.getElementById('diaryText').value.trim();
  if (!text) { showToast('写点什么吧'); return; }
  var mood = pickedMood || MOODS[0];
  var weather = pickedWeather || WEATHERS[0];
  var now = Date.now();

  if (!state.diaries) state.diaries = [];
  state.diaries.push({
    id: 'diary_' + now,
    authorId: 'user',
    authorName: state.profile.name || '我',
    authorAvatar: state.profile.avatar || '',
    text: text,
    mood: mood,
    weather: weather,
    time: now,
    comments: []
  });

  var today = new Date().toISOString().slice(0, 10);
  state.userDiaryLastDate = today;
  saveState();

  showToast('日记已保存');
  navigateTo('pageDiary');
}

// 梦角自动写日记（每天每人一篇）
function checkAutoDiary() {
  if (!state.dreams || state.dreams.length === 0) return;
  if (!state.diaries) state.diaries = [];
  var today = new Date().toISOString().slice(0, 10);

  state.dreams.forEach(function(d) {
    // 检查今天是否已经写过
    var already = state.diaries.some(function(diary) {
      if (diary.authorId !== d.id) return false;
      var diaryDate = new Date(diary.time).toISOString().slice(0, 10);
      return diaryDate === today;
    });
    if (already) return;

    // 每天有 20% 概率在扫描时触发（保证一天至少一篇，最多几篇）
    if (Math.random() > 0.2) return;

    // 从字卡里随机选 3-8 条
    if (!state.cards || state.cards.length === 0) return;
    var count = 3 + Math.floor(Math.random() * 6);
    var shuffled = state.cards.slice().sort(function() { return Math.random() - 0.5; });
    var picked = shuffled.slice(0, Math.min(count, shuffled.length));
    var text = picked.map(function(c) { return c.text; }).join('\n');

    var weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    var mood = MOODS[Math.floor(Math.random() * MOODS.length)];

    state.diaries.push({
      id: 'diary_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      authorId: d.id,
      authorName: d.name,
      authorAvatar: d.avatar || '',
      text: text,
      mood: mood,
      weather: weather,
      time: Date.now() - Math.floor(Math.random() * 3600000 * 12), // 随机往前推一点时间
      comments: []
    });
    saveState();
  });
}

// 定时扫描
setInterval(checkAutoDiary, 60000);
setInterval(checkAutoDiaryComments, 60000);

// ===== 日记评论 =====
function openDiaryComment(diaryId) {
  var text = prompt('写下你的评论：');
  if (!text || !text.trim()) return;
  var diary = state.diaries.find(function(d) { return d.id === diaryId; });
  if (!diary) return;
  if (!diary.comments) diary.comments = [];
  diary.comments.push({
    id: 'cmt_' + Date.now(),
    authorId: 'user',
    authorName: state.profile.name || '我',
    authorAvatar: state.profile.avatar || '',
    text: text.trim(),
    time: Date.now()
  });
  saveState();
  renderDiaryList();
  showToast('评论已发布');

  // 触发 AI 回复（延迟 2-5 秒）
  setTimeout(function() { triggerAiComment(diaryId, 'user'); }, 2000 + Math.random() * 3000);
}

// AI 评论日记
function triggerAiComment(diaryId, replyToAuthorId) {
  var diary = state.diaries.find(function(d) { return d.id === diaryId; });
  if (!diary) return;
  if (!state.dreams || state.dreams.length === 0) return;
  if (!state.cards || state.cards.length === 0) return;

  // 随机挑一个梦角（不能是日记作者自己）
  var candidates = state.dreams.filter(function(d) { return d.id !== diary.authorId; });
  if (candidates.length === 0) return;
  var dream = candidates[Math.floor(Math.random() * candidates.length)];

  // 主动评论次数上限 2 次
  if (!diary.comments) diary.comments = [];
  var myActiveCount = diary.comments.filter(function(c) {
    return c.authorId === dream.id && !c.replyTo;
  }).length;

  var isReply = false;
  var replyTo = null;
  var replyProb = 0;

  // 如果是回复用户/别人，40% 概率
  if (replyToAuthorId && myActiveCount < 2) {
    replyProb = 0.4;
    if (Math.random() < replyProb) {
      isReply = true;
    }
  }

  // 如果已经主动评论了 2 次，必须回复
  if (myActiveCount >= 2) {
    isReply = true;
    if (Math.random() > 0.2) return; // 20% 概率才真回复
  }

  // 主动评论的概率：85%
  if (!isReply && myActiveCount === 0) {
    if (Math.random() > 0.85) return;
  }

  // 选一条字卡
  var card = state.cards[Math.floor(Math.random() * state.cards.length)];
  var text = card ? card.text : '……';

  var comment = {
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    authorId: dream.id,
    authorName: dream.name,
    authorAvatar: dream.avatar || '',
    text: text,
    time: Date.now()
  };

  // 如果回复别人，加上 replyTo
  if (isReply) {
    // 找最后一条不是自己发的评论来回复
    var others = diary.comments.filter(function(c) { return c.authorId !== dream.id; });
    if (others.length === 0) return;
    var target = others[others.length - 1];
    comment.replyTo = target.id;
    comment.replyToName = target.authorName;
  }

  diary.comments.push(comment);
  saveState();
  if (document.getElementById('pageDiary').classList.contains('active')) {
    renderDiaryList();
  }

  // 被回复者再回复：20% 概率
  if (isReply && comment.replyTo) {
    var targetCmt = diary.comments.find(function(c) { return c.id === comment.replyTo; });
    if (targetCmt && Math.random() < 0.2) {
      setTimeout(function() {
        // 再找一个别的梦角来回复这条
        var another = candidates.filter(function(d) { return d.id !== dream.id; });
        if (another.length === 0) return;
        var another2 = another[Math.floor(Math.random() * another.length)];
        var card2 = state.cards[Math.floor(Math.random() * state.cards.length)];
        diary.comments.push({
          id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          authorId: another2.id,
          authorName: another2.name,
          authorAvatar: another2.avatar || '',
          text: card2 ? card2.text : '……',
          replyTo: comment.id,
          replyToName: comment.authorName,
          time: Date.now()
        });
        saveState();
        if (document.getElementById('pageDiary').classList.contains('active')) renderDiaryList();
      }, 3000 + Math.random() * 3000);
    }
  }
}

// 定时让梦角主动评论日记（每 60 秒扫一次）
function checkAutoDiaryComments() {
  if (!state.diaries || state.diaries.length === 0) return;
  // 只处理最近 5 篇日记
  var recent = state.diaries.slice().sort(function(a, b) { return b.time - a.time; }).slice(0, 5);
  recent.forEach(function(diary) {
    if (Math.random() < 0.15) {
      triggerAiComment(diary.id, null);
    }
  });
}
// ===== 主屏幕背景 =====
function handleHomeBg(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_WIDTH = 900, width = img.width, height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressed = canvas.toDataURL('image/jpeg', 0.7);
      if (!state.settings) state.settings = {};
      state.settings.homeBg = compressed;
      saveState();
      applyHomeBg();
      showToast('主屏幕背景已设置');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function resetHomeBg() {
  if (!state.settings) return;
  state.settings.homeBg = null;
  saveState();
  applyHomeBg();
  showToast('已清除主屏幕背景');
}

function applyHomeBg() {
  var home = document.getElementById('pageHome');
  if (!home) return;
  var bg = state.settings && state.settings.homeBg;
  if (bg) {
    home.style.background = 'url("' + bg + '") center/cover no-repeat';
  } else {
    home.style.background = '';
  }
}

// ===== 陪伴页面 =====
var compLang='zh-CN',compAMode=null,compMTimer=null,compMSec=0,compMFcs=null,compMMod=null,compBTimer=null,compBAct=false,compFVis=false,compFTimer=null,compMAct=false,compVMode=false,compMSel=false,compCMS=[],compCMI=0,compMSI=null;
var compMOODS=['joy','sad','anxious','irritated','angry','calm','wronged','lost'];
var compMOOD_LABELS=['喜悦','伤心','焦虑','烦躁','愤怒','平静','委屈','迷茫'];
var compMOOD_SEN={
  joy:['真为你高兴！','保持这份快乐！','你的笑容是最好的礼物','今天真是美好的一天','好心情会传染的，我也开心了','你笑起来真好看','快乐是属于你的','继续这样开心下去吧','看到你开心我就满足了','幸福就是这么简单'],
  sad:['别难过了，我在这里','难过就哭出来吧，没关系的','我会一直陪着你的','一切都会好起来的','你的眼泪让我心疼','抱抱你，别哭了','难过是暂时的，我永远在','慢慢来，不着急好起来','我知道你很难过，让我陪着你','哭出来会好受些的'],
  anxious:['深呼吸，跟我一起','放轻松，没你想的那么糟','一切都会顺利的','别担心，有我在','你现在很安全，别怕','慢慢来，一步一步走','相信你自己，你可以的','来，跟着我呼吸','问题总会解决的','你已经做得很好了'],
  irritated:['消消气，别跟自己过不去','先冷静一下','我知道你很烦，但别气坏了自己','来，喝口水冷静一下','不值得为这点事生气','我理解你的烦躁','让那些烦心事都滚远点','烦躁是正常的，别憋着','先停下来，喝杯水','你的感受是合理的'],
  angry:['先深呼吸，别冲动','生气伤身体，别这样','我知道你很生气，我陪你','来，发泄出来，别憋着','世界上不值得生气的事太多了','我理解你的愤怒','打枕头也好，骂出来也好','别让愤怒控制你','等你冷静下来我们再聊','愤怒是火焰，别烧到自己'],
  calm:['平静的你就很美','享受这一刻的宁静','真好啊，能感受到你的平静','平和的心境是最珍贵的','继续保持这种状态','现在的你，像湖水一样安静','平静是最大的力量','好喜欢这样的时刻','你现在的状态真好','内心平静，万事安宁'],
  wronged:['委屈了？来我怀里','我知道你受了委屈','别憋着，说出来','你受的委屈我都知道','抱抱你，你明明那么好','凭什么要你受委屈','你不需要承受这些','委屈就哭出来吧','我懂你，你真的不容易','你明明没做错什么'],
  lost:['迷茫是正常的，别怕','不知道方向的时候，先停下来','我会陪你找到答案','迷茫只是暂时的','你不需要马上想清楚一切','慢慢来，路会越来越清晰的','迷茫的时候，就看看脚下的路','我陪着你一起找方向','不知道往哪走的时候，就先休息','你不需要现在就有答案']
};
var compCOMFORT=['谢谢你愿意把这一切告诉我，能成为你的倾听者是我最大的幸福。你不需要一个人扛着所有事情，我永远在这里。','我听到你所说的一切了，你的感受都是真实且重要的。不管别人怎么想，你值得被理解，被温柔对待。','你能够说出来，这本身就非常勇敢。我为你感到骄傲。','你的一切情绪都是合理的，没有所谓的"不应该这样想"。你的感受就是你的感受，我完全接纳。','有时候说出来并不会马上解决问题，但至少你不再是一个人面对了。我在这里，陪你一起。','被听见本身就是一种治愈。你不需要立刻好起来，慢慢来，我会一直在这里等你。','你比你以为的要坚强得多。经历了这么多还能好好说出来，真的很了不起。','我不会对你说的任何话做评判，因为我相信你做的每一个选择都有你的理由。你只需要被理解。','你说的话我都一一记在心里了。不是作为数据，而是作为一个在乎你的人。','有时候我们把太多压力都揽在自己身上了。你已经做得很好了，真的。','你不需要完美，你只需要做你自己，而我就在这里陪着你。','每一次你向我倾诉，我都感到无比荣幸。谢谢你信任我。'];

function compR(arr){return arr[Math.floor(Math.random()*arr.length)]}
// 【核心修改】：从字卡库随机抽取一条，如果字卡库为空则返回兜底
function compRandCard(){
  if (!state.cards || state.cards.length === 0) return '……';
  var c = state.cards[Math.floor(Math.random() * state.cards.length)];
  return c && c.text ? c.text : '……';
}

function compUClock(){var d=new Date();var el=document.getElementById('compClock');if(el)el.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}

function compTF(show){
  var bs=document.querySelectorAll('.comp-func-bubble');
  if(show){bs.forEach(function(b){b.classList.add('comp-show')});compFVis=true;clearTimeout(compFTimer);compFTimer=setTimeout(function(){compTF(false)},30000)}
  else{bs.forEach(function(b){b.classList.remove('comp-show')});compFVis=false;clearTimeout(compFTimer)}
}

function compSB(text,dur){
  var mb=document.getElementById('compMsgBubble');if(!mb)return;
  clearTimeout(compBTimer);
  mb.textContent=text;
  mb.classList.remove('comp-long');
  if(text.length>25)mb.classList.add('comp-long');
  mb.classList.add('comp-show');
  compBAct=true;
  var d=dur||3000;
  compBTimer=setTimeout(function(){mb.classList.remove('comp-show');compBAct=false},d);
}

function compOpenMood(){
  var mg=document.getElementById('compMoodGrid');if(!mg)return;
  mg.innerHTML='';
  compMOOD_LABELS.forEach(function(l,i){
    var d=document.createElement('div');d.className='comp-mood-tag';d.textContent=l;d.dataset.mood=compMOODS[i];
    d.addEventListener('click',function(){
      document.querySelectorAll('.comp-mood-tag').forEach(function(t){t.classList.remove('comp-selected')});
      this.classList.add('comp-selected');
      var mood=this.dataset.mood;
      setTimeout(function(){
        document.getElementById('compMoodModal').classList.remove('comp-show');
        compMSel=true;
        compCMS=compMOOD_SEN[mood]||compMOOD_SEN.joy;
        compCMI=0;
        document.getElementById('compEndBtn').classList.add('comp-show');
        compSB(compCMS[0]);
      },200);
    });
    mg.appendChild(d);
  });
  document.getElementById('compMoodModal').classList.add('comp-show');
}

function compNMood(){
  if(!compCMS.length)return;
  compCMI=(compCMI+1)%compCMS.length;
  compSB(compCMS[compCMI]);
  if(compCMI===compCMS.length-1)compMSel=false;
}

function compSMode(mode){
  compAMode=mode;compMAct=true;
  document.getElementById('compModesArea').style.display='none';
  document.getElementById('compModePanel').classList.add('comp-show');
  compMSec=0;
  var tmr=document.getElementById('compTimerDisplay');
  if(tmr)tmr.textContent='00:00:00';
  clearInterval(compMTimer);
  compMTimer=setInterval(function(){compMSec++;var h=String(Math.floor(compMSec/3600)).padStart(2,'0'),m=String(Math.floor((compMSec%3600)/60)).padStart(2,'0'),s=String(compMSec%60).padStart(2,'0');var el=document.getElementById('compTimerDisplay');if(el)el.textContent=h+':'+m+':'+s},1000);
  clearInterval(compMFcs);
  compMFcs=setInterval(function(){var s=['非常专注','有点走神','心思完全不在了！'];var el=document.getElementById('compFocusDisplay');if(el)el.textContent=compR(s)},5000+Math.random()*8000);
  clearInterval(compMMod);
  compMMod=setInterval(function(){var el=document.getElementById('compMoodDisplay');if(el)el.textContent=compR(compMOOD_LABELS)},12000+Math.random()*15000);
  clearInterval(compMSI);
  compMSI=setInterval(function(){
    if(!compMAct)return;
    // 【核心修改】：从字卡库随机抽取一句
    var t=compRandCard();
    var ca=document.getElementById('compChatArea');if(!ca)return;
    var d=document.createElement('div');d.className='comp-chat-msg comp-d';d.textContent=t;
    ca.appendChild(d);ca.scrollTop=ca.scrollHeight;
  },15000+Math.random()*20000);
}

function compEndM(){
  compMAct=false;compAMode=null;
  clearInterval(compMTimer);clearInterval(compMFcs);clearInterval(compMMod);clearInterval(compMSI);
  document.getElementById('compModePanel').classList.remove('comp-show');
  document.getElementById('compModesArea').style.display='flex';
  var tmr=document.getElementById('compTimerDisplay');if(tmr)tmr.textContent='00:00:00';
  var fc=document.getElementById('compFocusDisplay');if(fc)fc.textContent='—';
  var md=document.getElementById('compMoodDisplay');if(md)md.textContent='—';
  var ca=document.getElementById('compChatArea');if(ca)ca.innerHTML='';
}

function compInit(){
  if(compInit._done)return;
  compInit._done=true;
  compUClock();setInterval(compUClock,1000);

  // 头像点击
  var av=document.getElementById('compAvatar');
  if(av)av.addEventListener('click',function(e){
    e.stopPropagation();
    if(compBAct)return;
    if(compVMode){document.getElementById('compInputArea').classList.toggle('comp-show');var vi=document.getElementById('compVentInput');if(document.getElementById('compInputArea').classList.contains('comp-show')&&vi)vi.focus();return}
    if(compMSel){compNMood();return}
    compTF(!compFVis);
  });

  // 功能气泡
  document.querySelectorAll('.comp-func-bubble').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var a=this.dataset.action;
           if(a==='touch'||a==='hug'||a==='kiss'){
        if(compMAct){compSB('我在忙呢');compTF(false);return}
        compTF(false);
        compSB(compRandCard());
        return;
      }
      compTF(false);
      if(a==='mood'){compOpenMood();return}
      if(a==='vent'){
        compVMode=!compVMode;
        if(compVMode){
          document.getElementById('compEndBtn').classList.add('comp-show');
          var ca=document.getElementById('compChatArea');
          var p=document.createElement('div');p.className='comp-chat-msg comp-d';
          p.textContent='点击我的头像尽情向我倾诉吧！开心也好，难过也罢，想说的一切都告诉我。你所说的话并不会被保存，我也不会评价你的一切，我会当做一个合格的倾听者！';
          ca.appendChild(p);ca.scrollTop=ca.scrollHeight;
          document.getElementById('compInputArea').classList.add('comp-show');
        } else {
          document.getElementById('compEndBtn').classList.remove('comp-show');
          document.getElementById('compInputArea').classList.remove('comp-show');
          document.getElementById('compChatArea').innerHTML='';
        }
        return;
      }
      if(a==='random'){
        // 【核心修改】：从字卡库随机
        compSB(compRandCard());
        return;
      }
    });
  });

  // 结束按钮
  var eb=document.getElementById('compEndBtn');
  if(eb)eb.addEventListener('click',function(){
    if(compMSel){compMSel=false;eb.classList.remove('comp-show')}
    if(compVMode){compVMode=false;eb.classList.remove('comp-show');document.getElementById('compInputArea').classList.remove('comp-show');document.getElementById('compChatArea').innerHTML=''}
  });

  // 倾诉输入
  var vi=document.getElementById('compVentInput');
  if(vi)vi.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      var t=this.value.trim();if(!t)return;
      var ca=document.getElementById('compChatArea');
      var u=document.createElement('div');u.className='comp-chat-msg comp-u';u.textContent=t;
      ca.appendChild(u);ca.scrollTop=ca.scrollHeight;
      this.value='';
      setTimeout(function(){
        var d=document.createElement('div');d.className='comp-chat-msg comp-d';
        d.textContent=compR(compCOMFORT);
        ca.appendChild(d);ca.scrollTop=ca.scrollHeight;
      },800);
    }
  });

  // 模式按钮
  document.querySelectorAll('.comp-mode-btn').forEach(function(b){
    b.addEventListener('click',function(){compSMode(this.dataset.mode)});
  });
  var mb=document.getElementById('compModeEndBtn');
  if(mb)mb.addEventListener('click',compEndM);
  // 选择角色按钮
  var cbtn = document.getElementById('compCharBtn');
  if (cbtn) cbtn.addEventListener('click', compOpenCharModal);

  // 设置按钮
  var sb=document.getElementById('compSettingsBtn');
  if(sb)sb.addEventListener('click',function(){document.getElementById('compSettingsModal').classList.add('comp-show')});
  var cb=document.getElementById('compCloseSettings');
  if(cb)cb.addEventListener('click',function(){document.getElementById('compSettingsModal').classList.remove('comp-show')});

  // 滑块
  var br=document.getElementById('compBgBlurRange');
  if(br)br.addEventListener('input',function(){document.getElementById('compBgBlurVal').textContent=this.value+'px'});
  var fr=document.getElementById('compFontSizeRange');
  if(fr)fr.addEventListener('input',function(){document.getElementById('compFontSizeVal').textContent=this.value+'px'});

  // 保存
  var sv=document.getElementById('compSaveSettings');
  if(sv)sv.addEventListener('click',function(){
    var c=document.getElementById('compColorInput').value;
    var fs=fr.value;
    var bl=br.value;
    var page=document.getElementById('pageCompanion');
    page.style.setProperty('--comp-text-color',c);
    page.style.setProperty('--comp-font-size',fs+'px');
    page.style.setProperty('--comp-bg-blur',bl+'px');
    var fi=document.getElementById('compBgInput');
    if(fi.files.length>0){
      var r2=new FileReader();
      r2.onload=function(e){
        var u=e.target.result;
        var s=document.getElementById('comp-bg-style');
        if(s)s.remove();
        s=document.createElement('style');s.id='comp-bg-style';
        s.textContent='#pageCompanion .companion-page::before{background-image:url('+u+')!important;opacity:1!important}';
        document.head.appendChild(s);
        page.classList.add('has-bg');
        localStorage.setItem('comp_bg',u);
      };
      r2.readAsDataURL(fi.files[0]);
    }
    var ai=document.getElementById('compAvatarInput');
    if(ai.files.length>0){
      var r3=new FileReader();
      r3.onload=function(e){
        var u=e.target.result;
        var avEl=document.getElementById('compAvatar');
        avEl.style.backgroundImage='url('+u+')';
        avEl.textContent='';
        localStorage.setItem('comp_avatar',u);
                state.compSelectedDreamId = null;
        saveState();
      };
      r3.readAsDataURL(ai.files[0]);
    }
    localStorage.setItem('comp_color',c);
    localStorage.setItem('comp_fontsize',fs);
    localStorage.setItem('comp_bgblur',bl);
    document.getElementById('compSettingsModal').classList.remove('comp-show');
  });

  // 重置
  var rs=document.getElementById('compResetSettings');
  if(rs)rs.addEventListener('click',function(){
    var page=document.getElementById('pageCompanion');
    page.style.setProperty('--comp-text-color','#e0e0e0');
    page.style.setProperty('--comp-font-size','14px');
    page.style.setProperty('--comp-bg-blur','0px');
    document.getElementById('compColorInput').value='#e0e0e0';
    document.getElementById('compFontSizeRange').value=14;
    document.getElementById('compFontSizeVal').textContent='14px';
    document.getElementById('compBgBlurRange').value=0;
    document.getElementById('compBgBlurVal').textContent='0px';
    page.classList.remove('has-bg');
    var s=document.getElementById('comp-bg-style');if(s)s.remove();
    var avEl=document.getElementById('compAvatar');avEl.style.backgroundImage='';avEl.textContent='🐳';
    localStorage.removeItem('comp_bg');localStorage.removeItem('comp_color');localStorage.removeItem('comp_fontsize');localStorage.removeItem('comp_bgblur');localStorage.removeItem('comp_avatar');
  });

  // 恢复缓存
  var bg=localStorage.getItem('comp_bg');
  var c=localStorage.getItem('comp_color');
  var fs=localStorage.getItem('comp_fontsize');
  var bl=localStorage.getItem('comp_bgblur');
  var avImg=localStorage.getItem('comp_avatar');
  var page=document.getElementById('pageCompanion');
  if(bg){var s=document.createElement('style');s.id='comp-bg-style';s.textContent='#pageCompanion .companion-page::before{background-image:url('+bg+')!important;opacity:1!important}';document.head.appendChild(s);page.classList.add('has-bg')}
    if (state.compSelectedDreamId) {
    var _d = state.dreams.find(function(d) { return d.id === state.compSelectedDreamId; });
    if (_d && _d.avatar) {
      var _av = document.getElementById('compAvatar');
      _av.style.backgroundImage = 'url(' + _d.avatar + ')';
      _av.textContent = '';
    }
  } else if (avImg) {
    var avEl = document.getElementById('compAvatar');
    avEl.style.backgroundImage = 'url(' + avImg + ')';
    avEl.textContent = '';
  }
  if(c){page.style.setProperty('--comp-text-color',c);document.getElementById('compColorInput').value=c}
  if(fs){page.style.setProperty('--comp-font-size',fs+'px');document.getElementById('compFontSizeRange').value=fs;document.getElementById('compFontSizeVal').textContent=fs+'px'}
  if(bl){page.style.setProperty('--comp-bg-blur',bl+'px');document.getElementById('compBgBlurRange').value=bl;document.getElementById('compBgBlurVal').textContent=bl+'px'}

  // 弹窗点外面关闭
  document.querySelectorAll('.comp-modal-overlay').forEach(function(m){
    m.addEventListener('click',function(e){if(e.target===this)this.classList.remove('comp-show')});
  });
}
// ===== 陪伴：选择角色 =====
function compOpenCharModal() {
  var list = document.getElementById('compCharList');
  if (!state.dreams || state.dreams.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#999;padding:20px;font-size:13px;">还没有梦角，去主页添加一个吧</div>';
  } else {
    list.innerHTML = state.dreams.map(function(d) {
      var avatar = d.avatar || '';
      var imgHtml = avatar
        ? '<img src="' + avatar + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:12px;">'
        : '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-right:12px;font-size:18px;">💜</div>';
      var selected = state.compSelectedDreamId === d.id;
      return '<div onclick="compChooseChar(\'' + d.id + '\')" style="display:flex;align-items:center;padding:10px 12px;border-radius:12px;background:' + (selected ? 'rgba(126,200,227,0.16)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + (selected ? 'rgba(126,200,227,0.3)' : 'rgba(255,255,255,0.06)') + ';cursor:pointer;">' + imgHtml + '<span style="font-size:14px;color:#e0e0e0;flex:1;">' + d.name + '</span>' + (selected ? '<span style="color:#7ec8e3;font-size:16px;">✓</span>' : '') + '</div>';
    }).join('');
  }
  document.getElementById('compCharModal').classList.add('comp-show');
}

function compChooseChar(id) {
  state.compSelectedDreamId = id;
  saveState();
  var dream = state.dreams.find(function(d) { return d.id === id; });
  var avEl = document.getElementById('compAvatar');
  if (dream && dream.avatar) {
    avEl.style.backgroundImage = 'url(' + dream.avatar + ')';
    avEl.textContent = '';
  } else if (dream) {
    avEl.style.backgroundImage = '';
    avEl.textContent = '💜';
  }
  localStorage.removeItem('comp_avatar');
  document.getElementById('compCharModal').classList.remove('comp-show');
  showToast('已选择：' + (dream ? dream.name : ''));
}

// ===== 已读不回开关 =====
function initReadNoReplyToggle() {
  var toggle = document.getElementById('readNoReplyToggle');
  if (!toggle) return;
  if (!state.settings) state.settings = {};
  toggle.classList.toggle('on', !!state.settings.readNoReply);
  toggle.onclick = function() {
    state.settings.readNoReply = !state.settings.readNoReply;
    toggle.classList.toggle('on', state.settings.readNoReply);
    saveState();
    showToast(state.settings.readNoReply ? '已开启已读不回' : '已关闭已读不回');
  };
}

// ===== 信箱系统 =====
var currentMailTab = 'inbox';

// 生成送达时间（10-48小时）
function genDeliverTime() {
  var h = 10 + Math.random() * 38;
  return Date.now() + h * 3600 * 1000;
}

// 写信按钮
function openWriteLetter() {
  var sel = document.getElementById('letterTarget');
  if (!state.dreams || state.dreams.length === 0) { showToast('还没有梦角'); return; }
  sel.innerHTML = state.dreams.map(function(d) {
    return '<option value="' + d.id + '">' + d.name + '</option>';
  }).join('');
  document.getElementById('letterContent').value = '';
  navigateTo('pageWriteLetter');
}

// 发送信件
function sendLetter() {
  var targetId = document.getElementById('letterTarget').value;
  var content = document.getElementById('letterContent').value.trim();
  if (!content) { showToast('信件内容不能为空'); return; }
  if (!state.mails) state.mails = [];
  var target = state.dreams.find(function(d) { return d.id === targetId; });
  if (!target) return;

  state.mails.push({
    id: 'mail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from: 'user',
    fromId: 'user',
    fromName: state.profile.name || '我',
    toId: targetId,
    toName: target.name,
    content: content,
    sentAt: Date.now(),
    deliverAt: genDeliverTime(),
    delivered: false,
    isReply: false
  });
  saveState();
  showToast('信件已寄出，预计 10-48 小时送达');
  navigateTo('pageMailbox');
  switchMailTab('outbox');
}

// 切换收件箱/发件箱
function switchMailTab(tab) {
  currentMailTab = tab;
  var inbox = document.getElementById('mailTabInbox');
  var outbox = document.getElementById('mailTabOutbox');
  if (tab === 'inbox') {
    inbox.style.color = 'var(--blue)'; inbox.style.borderBottom = '2px solid var(--blue)';
    outbox.style.color = 'var(--gray)'; outbox.style.borderBottom = '2px solid transparent';
  } else {
    outbox.style.color = 'var(--blue)'; outbox.style.borderBottom = '2px solid var(--blue)';
    inbox.style.color = 'var(--gray)'; inbox.style.borderBottom = '2px solid transparent';
  }
  renderMailList();
}

// 渲染信件列表
function renderMailList() {
  var list = document.getElementById('mailList');
  if (!list) return;
  if (!state.mails) state.mails = [];

  var filtered = state.mails.filter(function(m) {
    if (currentMailTab === 'inbox') return m.from !== 'user';
    else return m.from === 'user';
  });
  filtered.sort(function(a, b) { return b.sentAt - a.sentAt; });

  // 更新未读徽标
  var unreadCount = state.mails.filter(function(m) { return m.from !== 'user' && !m.read; }).length;
  var badge = document.getElementById('mailUnreadBadge');
  if (badge) {
    if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:50px 20px;text-align:center;color:var(--gray);font-size:14px;">' + (currentMailTab === 'inbox' ? '还没有收到信' : '还没有寄出过信') + '</div>';
    return;
  }

  list.innerHTML = filtered.map(function(m) {
    var t = new Date(m.sentAt);
    var timeStr = (t.getMonth()+1) + '/' + t.getDate() + ' ' + String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    var statusHtml = '';
    var dotHtml = '';
    if (m.from === 'user') {
      // 发件箱显示送达状态
      if (m.delivered) statusHtml = '<span style="font-size:11px;color:var(--green);">已送达</span>';
      else {
        var left = Math.max(0, m.deliverAt - Date.now());
        var hLeft = Math.floor(left / 3600000);
        var mLeft = Math.floor((left % 3600000) / 60000);
        statusHtml = '<span style="font-size:11px;color:var(--gray);">运送中 · 剩 ' + hLeft + 'h' + mLeft + 'm</span>';
      }
    } else {
      // 收件箱显示未读红点
      if (!m.read) {
        dotHtml = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-right:6px;vertical-align:middle;"></span>';
      }
    }

    var whoText = m.from === 'user' ? ('寄给 ' + m.toName) : ('来自 ' + m.fromName);
    var preview = m.content.replace(/\n/g, ' ').slice(0, 30);

    return '<div onclick="openLetterDetail(\'' + m.id + '\')" style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--card);cursor:pointer;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:14px;font-weight:600;color:var(--text);">' + dotHtml + whoText + '</span>' +
        statusHtml +
      '</div>' +
      '<div style="font-size:13px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + preview + '</div>' +
      '<div style="font-size:11px;color:#bbb;margin-top:4px;">' + timeStr + '</div>' +
    '</div>';
  }).join('');
}

// 打开信件详情
function openLetterDetail(id) {
  var m = state.mails.find(function(x) { return x.id === id; });
  if (!m) return;
  // 标记为已读
  if (m.from !== 'user' && !m.read) {
    m.read = true;
    saveState();
  }
  var t = new Date(m.sentAt);
  var timeStr = (t.getMonth()+1) + '月' + t.getDate() + '日 ' + String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');

  document.getElementById('letterDetailTitle').textContent = m.from === 'user' ? '寄给 ' + m.toName : '来自 ' + m.fromName;
  var html = '<div style="padding:20px;">';
  html += '<div style="font-size:12px;color:var(--gray);margin-bottom:16px;text-align:center;">' + timeStr + '</div>';
  html += '<div style="background:var(--card);border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);line-height:1.8;font-size:14px;color:var(--text);white-space:pre-wrap;word-break:break-word;">' + m.content + '</div>';
  if (m.from === 'user' && !m.delivered) {
    html += '<div style="text-align:center;margin-top:16px;font-size:12px;color:var(--gray);">信件还在运送中……</div>';
  }
  html += '</div>';
  document.getElementById('letterDetailContent').innerHTML = html;
  navigateTo('pageLetterDetail');
  renderMailList();
}

// ===== 信箱定时：送达检查 + 梦角回信 =====
function checkMailDelivery() {
  if (!state.mails || state.mails.length === 0) return;
  var now = Date.now();
  var changed = false;

  // 1. 检查送达
  state.mails.forEach(function(m) {
    if (m.from === 'user' && !m.delivered && now >= m.deliverAt) {
      m.delivered = true;
      changed = true;
      // 触发梦角回信（延迟一会）
      setTimeout(function() { aiReplyLetter(m.id); }, 3000 + Math.random() * 5000);
    }
  });

  if (changed) { saveState(); renderMailList(); }
}

// 梦角回信：从字卡库随机挑 8-15 条组合
function aiReplyLetter(letterId) {
  var original = state.mails.find(function(x) { return x.id === letterId; });
  if (!original) return;
  var dream = state.dreams.find(function(d) { return d.id === original.toId; });
  if (!dream) return;
  if (!state.cards || state.cards.length === 0) return;

  // 从字卡库随机 8-15 条
  var count = 8 + Math.floor(Math.random() * 8);
  var shuffled = state.cards.slice().sort(function() { return Math.random() - 0.5; });
  var picked = shuffled.slice(0, Math.min(count, shuffled.length));
  var lines = picked.map(function(c) { return c.text; });
  var content = lines.join('\n');

  state.mails.push({
    id: 'mail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from: 'dream',
    fromId: dream.id,
    fromName: dream.name,
    fromAvatar: dream.avatar || '',
    toId: 'user',
    toName: state.profile.name || '我',
    content: content,
    sentAt: Date.now(),
    deliverAt: Date.now(),
    delivered: true,
    read: false,
    isReply: true,
    replyToId: original.id
  });
  saveState();
  renderMailList();
  sendNotification(dream.name, '给你回信了');
}

// 检测信箱未读（红点）
function updateMailboxBadge() {
  // 主页图标红点 - 暂时不做，先留着
}

// ===== 主屏幕拖拽 =====
window.appEditMode = false;
var appPressTimer = null;
var appDragState = null;
var appDragGhost = null;
var appDragStartPage = 0;

function enterAppEditMode() {
  if (window.appEditMode) return;
  window.appEditMode = true;
  var grids = document.querySelectorAll('.app-grid');
  grids.forEach(function(g) { g.classList.add('editing'); });
    var w = document.getElementById('anniversaryWidget');
  if (w) w.classList.add('editing');
  if (navigator.vibrate) navigator.vibrate(20);
}

function exitAppEditMode() {
  if (!window.appEditMode) return;
  window.appEditMode = false;
  var grids = document.querySelectorAll('.app-grid');
  grids.forEach(function(g) { g.classList.remove('editing'); });
    var w = document.getElementById('anniversaryWidget');
  if (w) w.classList.remove('editing');
  saveState();
}

function getPageFromPoint(clientX, clientY) {
  var container = document.getElementById('homeSwiper');
  if (!container) return null;
  var rect = container.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;
  var pageW = container.offsetWidth;
  var offsetX = clientX - rect.left + container.scrollLeft;
  var pageIdx = Math.floor(offsetX / pageW);
  if (pageIdx < 0) pageIdx = 0;
  if (pageIdx >= state.appPages.length) pageIdx = state.appPages.length - 1;
  // 页内槽位
  var inPageX = offsetX - pageIdx * pageW;
  var inPageY = clientY - rect.top + container.scrollTop;
  var grid = document.querySelector('.app-grid[data-page-index="' + pageIdx + '"]');
  if (!grid) return null;
  var gridRect = grid.getBoundingClientRect();
  var padLeft = 16, padTop = 24;
  var cellW = (grid.clientWidth - padLeft * 2) / 4;
  var col = Math.floor((clientX - gridRect.left - padLeft) / cellW);
  var row = Math.floor((clientY - gridRect.top - padTop) / 96);
  if (col < 0) col = 0; if (col > 3) col = 3;
  if (row < 0) row = 0; if (row > 5) row = 5;
  var slotIdx = row * 4 + col;
  return { page: pageIdx, slot: slotIdx };
}

function findAppKey(page, slot) {
  var pageKeys = state.appPages[page];
  if (!pageKeys) return null;
  return pageKeys[slot] || null;
}

function setAppKey(page, slot, key) {
  if (!state.appPages[page]) state.appPages[page] = [];
  state.appPages[page][slot] = key;
}

function swapAppKeys(fromPage, fromSlot, toPage, toSlot) {
  var fromKey = findAppKey(fromPage, fromSlot);
  var toKey = findAppKey(toPage, toSlot);
  if (fromPage === toPage && fromSlot === toSlot) return;
  setAppKey(toPage, toSlot, fromKey);
  setAppKey(fromPage, fromSlot, toKey || null);
}

function startAppDrag(e, iconEl) {
  var pageIdx = parseInt(iconEl.dataset.pageIndex);
  var slotIdx = parseInt(iconEl.dataset.slotIndex);
  var key = iconEl.dataset.appKey;
  if (!key) return;

  appDragState = { fromPage: pageIdx, fromSlot: slotIdx, key: key };
  iconEl.classList.add('dragging');

  // 生成幽灵元素
  appDragGhost = iconEl.cloneNode(true);
  appDragGhost.classList.add('app-drag-ghost');
  appDragGhost.classList.remove('dragging');
  appDragGhost.style.width = iconEl.offsetWidth + 'px';
  appDragGhost.style.height = iconEl.offsetHeight + 'px';
  var rect = iconEl.getBoundingClientRect();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  appDragGhost.dataset.offsetX = (clientX - rect.left);
  appDragGhost.dataset.offsetY = (clientY - rect.top);
  appDragGhost.style.left = (clientX - (clientX - rect.left)) + 'px';
  appDragGhost.style.top = (clientY - (clientY - rect.top)) + 'px';
  document.body.appendChild(appDragGhost);
}

function moveAppDrag(e) {
  if (!appDragState || !appDragGhost) return;
  if (e.cancelable) e.preventDefault();
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  appDragGhost.style.left = (clientX - parseFloat(appDragGhost.dataset.offsetX)) + 'px';
  appDragGhost.style.top = (clientY - parseFloat(appDragGhost.dataset.offsetY)) + 'px';

  // 拖到边缘自动翻页
  var container = document.getElementById('homeSwiper');
  if (container) {
    var rect = container.getBoundingClientRect();
    if (clientX < rect.left + 40) {
      container.scrollLeft -= 8;
    } else if (clientX > rect.right - 40) {
      container.scrollLeft += 8;
    }
  }
}

function endAppDrag(e) {
  if (!appDragState) return;
  var clientX, clientY;
  if (e.changedTouches && e.changedTouches[0]) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  var target = getPageFromPoint(clientX, clientY);
  if (target) {
    swapAppKeys(appDragState.fromPage, appDragState.fromSlot, target.page, target.slot);
  }
  if (appDragGhost) { appDragGhost.remove(); appDragGhost = null; }
  appDragState = null;
  // 重新渲染
  renderAppIcons();
  // 重新进入编辑模式
  var grids = document.querySelectorAll('.app-grid');
  grids.forEach(function(g) { g.classList.add('editing'); });
}

// 给所有图标绑定长按和拖拽
function bindAppDrag() {
  var icons = document.querySelectorAll('.app-icon[data-app-key]');
  icons.forEach(function(iconEl) {
    var pressTimer = null;
    var startX = 0, startY = 0;
    var isDragging = false;
    var activePointerId = null;
    var savedEvent = null;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      activePointerId = e.pointerId;
      isDragging = false;
      // 保存坐标副本，因为 e 对象在 setTimeout 里会失效
      savedEvent = { clientX: e.clientX, clientY: e.clientY, touches: null };

      pressTimer = setTimeout(function() {
        isDragging = true;
        if (!window.appEditMode) enterAppEditMode();
        try { iconEl.setPointerCapture(activePointerId); } catch(err) {}
        startAppDrag(savedEvent, iconEl);
      }, 600);

      iconEl.addEventListener('pointermove', onPointerMove);
      iconEl.addEventListener('pointerup', onPointerUp);
      iconEl.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      // 长按前，只要手指稍微移动，就取消长按（让用户正常滑动屏幕）
      if (!isDragging) {
        if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) {
          clearTimeout(pressTimer);
        }
        return;
      }
      moveAppDrag(e);
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      clearTimeout(pressTimer);

      iconEl.removeEventListener('pointermove', onPointerMove);
      iconEl.removeEventListener('pointerup', onPointerUp);
      iconEl.removeEventListener('pointercancel', onPointerUp);

      try { iconEl.releasePointerCapture(activePointerId); } catch(err) {}

      if (isDragging) {
        endAppDrag(e);
      }
      isDragging = false;
      activePointerId = null;
      savedEvent = null;
    }

    iconEl.addEventListener('pointerdown', onPointerDown);
  });
        }

    function onDown(e) {
      longPressed = false;
      // 长按检测
      appPressTimer = setTimeout(function() {
        longPressed = true;
        if (!window.appEditMode) enterAppEditMode();
        // 进入编辑模式后，立即开始拖拽
        startAppDrag(e, iconEl);
      }, 600);
    }

    function onUp(e) {
      clearTimeout(appPressTimer);
    }

    function onMove(e) {
      // 如果在拖动中，交给 moveAppDrag
      if (appDragState) {
        moveAppDrag(e);
      } else {
        // 移动了就取消长按
        clearTimeout(appPressTimer);
      }
    }

    iconEl.addEventListener('touchstart', onDown, { passive: true });
    iconEl.addEventListener('touchend', onUp);
    iconEl.addEventListener('touchcancel', onUp);
    iconEl.addEventListener('touchmove', onMove, { passive: false });

    iconEl.addEventListener('mousedown', onDown);
    iconEl.addEventListener('mouseup', onUp);
    iconEl.addEventListener('mouseleave', onUp);
    iconEl.addEventListener('mousemove', onMove);
  });
}

// 全局监听拖拽移动/结束
document.addEventListener('touchmove', function(e) {
  if (appDragState) moveAppDrag(e);
}, { passive: false });
document.addEventListener('touchend', function(e) {
  if (appDragState) endAppDrag(e);
});
document.addEventListener('mousemove', function(e) {
  if (appDragState) moveAppDrag(e);
});
document.addEventListener('mouseup', function(e) {
  if (appDragState) endAppDrag(e);
});

// 点击空白退出编辑模式
document.addEventListener('click', function(e) {
  if (!window.appEditMode) return;
  if (appDragState) return;
  var home = document.getElementById('pageHome');
  if (!home || home.style.display === 'none') return;
  if (e.target.closest('.app-icon')) return;
  exitAppEditMode();
});

// 每次渲染后重新绑定
var origRenderAppIcons = renderAppIcons;
renderAppIcons = function() {
  origRenderAppIcons();
  bindAppDrag();
};

// ===== 状态检测 =====
function getStatusData(dreamId) {
  if (!state.settings) state.settings = {};
  if (!state.settings.statusData) state.settings.statusData = {};
  if (!state.settings.statusData[dreamId]) {
    state.settings.statusData[dreamId] = {
      moodValues: ['开心', '平静', '想你', '有点累', '满足', '幸福'],
      doingValues: ['正在看书', '正在发呆', '正在想你', '正在工作', '正在休息', '正在散步'],
      cooldownUntil: 0
    };
  }
  return state.settings.statusData[dreamId];
}

function openStatusCheck() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (!g || g.memberIds.length === 0) { showToast('群成员为空'); return; }
    var list = document.getElementById('statusPickList');
    list.innerHTML = g.memberIds.map(function(id) {
      var m = state.dreams.find(function(d) { return d.id === id; });
      if (!m) return '';
      var avatar = m.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2736%27 height=%2736%27 viewBox=%270 0 36 36%27%3E%3Ccircle cx=%2718%27 cy=%2718%27 r=%2718%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2718%27 y=%2723%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2714%27%3E💜%3C/text%3E%3C/svg%3E';
      return '<div onclick="pickStatusTarget(\'' + m.id + '\')" style="display:flex;align-items:center;padding:10px 12px;border-radius:12px;background:#f8f8fa;cursor:pointer;"><img src="' + avatar + '" style="width:36px;height:36px;border-radius:50%;margin-right:10px;object-fit:cover;"><span style="font-size:14px;color:#333;">' + m.name + '</span></div>';
    }).join('');
    document.getElementById('statusPickPanel').style.display = 'block';
    document.getElementById('statusPickMask').style.display = 'block';
    return;
  }
  if (!state.currentChatId) { showToast('请先进入聊天'); return; }
  doStatusCheck(state.currentChatId);
}

function pickStatusTarget(dreamId) {
  closeStatusPick();
  doStatusCheck(dreamId);
}

function closeStatusPick() {
  document.getElementById('statusPickPanel').style.display = 'none';
  document.getElementById('statusPickMask').style.display = 'none';
}

function doStatusCheck(dreamId) {
  var dream = state.dreams.find(function(d) { return d.id === dreamId; });
  if (!dream) { showToast('梦角不存在'); return; }
  var data = getStatusData(dreamId);

  var now = Date.now();
  if (data.cooldownUntil > now) {
    showCooldownPanel(dream, data.cooldownUntil);
    return;
  }

  var moodVal = 30 + Math.floor(Math.random() * 70);
  var energyVal = 20 + Math.floor(Math.random() * 80);
  var moodText = data.moodValues.length > 0 ? data.moodValues[Math.floor(Math.random() * data.moodValues.length)] : '……';
  var doingText = data.doingValues.length > 0 ? data.doingValues[Math.floor(Math.random() * data.doingValues.length)] : '……';

  data.cooldownUntil = Date.now() + 5 * 60 * 1000;
  saveState();

  renderStatusPanel(dream, moodVal, energyVal, moodText, doingText);
}

function renderStatusPanel(dream, moodVal, energyVal, moodText, doingText) {
  var avatar = dream.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2744%27 height=%2744%27 viewBox=%270 0 44 44%27%3E%3Ccircle cx=%2722%27 cy=%2722%27 r=%2722%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2722%27 y=%2726%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
  var html = '';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
  html += '<img src="' + avatar + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">';
  html += '<span style="font-size:16px;font-weight:600;color:var(--text);">' + dream.name + '</span>';
  html += '</div>';

  html += '<div class="status-bar-item">';
  html += '<div class="status-icon">💗</div>';
  html += '<div class="status-info">';
  html += '<div class="status-label">心情值</div>';
  html += '<div style="display:flex;align-items:center;"><div class="status-bar-track"><div class="status-bar-fill mood" style="width:' + moodVal + '%;"></div></div><span class="status-bar-num">' + moodVal + '%</span></div>';
  html += '</div></div>';

  html += '<div class="status-bar-item">';
  html += '<div class="status-icon">⚡</div>';
  html += '<div class="status-info">';
  html += '<div class="status-label">能量值</div>';
  html += '<div style="display:flex;align-items:center;"><div class="status-bar-track"><div class="status-bar-fill energy" style="width:' + energyVal + '%;"></div></div><span class="status-bar-num">' + energyVal + '%</span></div>';
  html += '</div></div>';

  html += '<div class="status-card">';
  html += '<div class="status-mood-text">' + moodText + '</div>';
  html += '<div class="status-doing-label">正在做什么</div>';
  html += '<div class="status-doing-text">' + doingText + '</div>';
  html += '</div>';

  html += '<button class="btn-secondary" onclick="openStatusEdit(\'' + dream.id + '\')" style="width:100%;margin-top:8px;">编辑词库</button>';

  document.getElementById('statusContent').innerHTML = html;
  document.getElementById('statusPanel').style.display = 'block';
  document.getElementById('statusMask').style.display = 'block';
}

function showCooldownPanel(dream, cdUntil) {
  var html = '';
  html += '<div class="status-cooldown">';
  html += '<div style="font-size:13px;color:var(--gray);">' + dream.name + ' 的状态还在冷却中</div>';
  html += '<div class="cd-time" id="statusCdTime">00:00</div>';
  html += '<div style="font-size:12px;color:#bbb;">5 分钟后可再次检测</div>';
  html += '</div>';
  document.getElementById('statusContent').innerHTML = html;
  document.getElementById('statusPanel').style.display = 'block';
  document.getElementById('statusMask').style.display = 'block';

  if (window.statusCdTimer) clearInterval(window.statusCdTimer);
  window.statusCdTimer = setInterval(function() {
    var el = document.getElementById('statusCdTime');
    if (!el) { clearInterval(window.statusCdTimer); return; }
    var left = Math.max(0, cdUntil - Date.now());
    if (left <= 0) {
      clearInterval(window.statusCdTimer);
      window.statusCdTimer = null;
      doStatusCheck(dream.id);
      return;
    }
    var m = Math.floor(left / 60000);
    var s = Math.floor((left % 60000) / 1000);
    el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }, 1000);
}

function closeStatusCheck() {
  document.getElementById('statusPanel').style.display = 'none';
  document.getElementById('statusMask').style.display = 'none';
  if (window.statusCdTimer) { clearInterval(window.statusCdTimer); window.statusCdTimer = null; }
}

// ===== 编辑词库 =====
function openStatusEdit(dreamId) {
  var data = getStatusData(dreamId);
  var dream = state.dreams.find(function(d) { return d.id === dreamId; });
  if (!dream) return;

  var html = '';
  html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">心情文字</div>';
  html += '<div>';
  data.moodValues.forEach(function(v, i) {
    html += '<div class="status-edit-row"><input type="text" value="' + v.replace(/"/g, '&quot;') + '" onchange="updateStatusMood(\'' + dreamId + '\',' + i + ',this.value)"><span class="del-btn" onclick="deleteStatusMood(\'' + dreamId + '\',' + i + ')">×</span></div>';
  });
  html += '</div>';
  html += '<button class="status-add-btn" onclick="addStatusMood(\'' + dreamId + '\')">+ 添加心情</button>';

  html += '<div style="font-size:13px;font-weight:600;margin:16px 0 8px;">正在做什么</div>';
  html += '<div>';
  data.doingValues.forEach(function(v, i) {
    html += '<div class="status-edit-row"><input type="text" value="' + v.replace(/"/g, '&quot;') + '" onchange="updateStatusDoing(\'' + dreamId + '\',' + i + ',this.value)"><span class="del-btn" onclick="deleteStatusDoing(\'' + dreamId + '\',' + i + ')">×</span></div>';
  });
  html += '</div>';
  html += '<button class="status-add-btn" onclick="addStatusDoing(\'' + dreamId + '\')">+ 添加状态</button>';

  html += '<div style="display:flex;gap:8px;margin-top:20px;">';
  html += '<button class="btn-primary" onclick="closeStatusCheck()" style="flex:1;">完成</button>';
  html += '</div>';

  document.getElementById('statusContent').innerHTML = html;
}

function updateStatusMood(dreamId, idx, val) {
  var data = getStatusData(dreamId);
  if (idx >= 0 && idx < data.moodValues.length) { data.moodValues[idx] = val; saveState(); }
}
function deleteStatusMood(dreamId, idx) {
  var data = getStatusData(dreamId);
  data.moodValues.splice(idx, 1);
  if (data.moodValues.length === 0) data.moodValues.push('……');
  saveState();
  openStatusEdit(dreamId);
}
function addStatusMood(dreamId) {
  var data = getStatusData(dreamId);
  data.moodValues.push('新心情');
  saveState();
  openStatusEdit(dreamId);
}

function updateStatusDoing(dreamId, idx, val) {
  var data = getStatusData(dreamId);
  if (idx >= 0 && idx < data.doingValues.length) { data.doingValues[idx] = val; saveState(); }
}
function deleteStatusDoing(dreamId, idx) {
  var data = getStatusData(dreamId);
  data.doingValues.splice(idx, 1);
  if (data.doingValues.length === 0) data.doingValues.push('……');
  saveState();
  openStatusEdit(dreamId);
}
function addStatusDoing(dreamId) {
  var data = getStatusData(dreamId);
  data.doingValues.push('正在做什么');
  saveState();
  openStatusEdit(dreamId);
}

// 遮罩点击关闭
document.getElementById('statusMask').addEventListener('click', closeStatusCheck);
document.getElementById('statusPickMask').addEventListener('click', closeStatusPick);

// ===== 纪念日小组件 =====
function getAnniData() {
  if (!state.anniversaries) state.anniversaries = [];
  if (!state.settings) state.settings = {};
  if (!state.settings.anniActiveId) state.settings.anniActiveId = null;
  if (!state.settings.anniBg) state.settings.anniBg = null;
  return state.anniversaries;
}

function calcDays(dateStr) {
  if (!dateStr) return 0;
  var d = new Date(dateStr);
  var now = new Date();
  d.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.floor((now - d) / 86400000);
}

function renderAnniversaryWidget() {
  getAnniData();
  var home = document.getElementById('pageHome');
  if (!home) return;
  var old = document.getElementById('anniversaryWidget');
  if (old) old.remove();

  var widget = document.createElement('div');
  widget.id = 'anniversaryWidget';
  widget.className = 'anniversary-widget';
  // 关键：阻止浏览器手势干扰
  widget.style.touchAction = 'none';
  widget.style.userSelect = 'none';
  widget.style.webkitUserSelect = 'none';

  var widgetHeight = 140;
  var visibleHeight = home.clientHeight || 600;

  // 安全区：100px 到 (屏幕高度 - 卡片高度 - 20px)
  var minTop = 100;
  var maxTop = visibleHeight - widgetHeight - 20;
  if (maxTop < minTop + 100) maxTop = minTop + 100;

  // 图标区域底部
  var swiper = document.getElementById('homeSwiper');
  var iconsBottom = swiper ? (swiper.offsetTop + swiper.offsetHeight) : 380;

  // 首选位置：图标下方；如果放不下，就退到屏幕内最底部
  var preferredTop = iconsBottom + 10;
  if (preferredTop > maxTop) preferredTop = maxTop;
  if (preferredTop < minTop) preferredTop = minTop;

  // 读取缓存位置，如果无效则重置
  var savedTop = state.settings.anniPos ? parseFloat(state.settings.anniPos.y) : NaN;
  if (isNaN(savedTop) || savedTop < minTop || savedTop > maxTop) {
    savedTop = preferredTop;
    state.settings.anniPos = { x: 16, y: savedTop };
    saveState();
  }

  widget.style.left = '16px';
  widget.style.top = savedTop + 'px';

  if (state.settings.anniBg) {
    widget.style.backgroundImage = 'url("' + state.settings.anniBg + '")';
  }

  var active = state.settings.anniActiveId
    ? state.anniversaries.find(function(a) { return a.id === state.settings.anniActiveId; })
    : null;

  if (!active) {
    widget.innerHTML = '<div class="anni-empty">＋ 点击添加纪念日</div>';
  } else {
    var days = calcDays(active.date);
    var d = new Date(active.date);
    var dateStr = d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
    var html = '';
    if (state.settings.anniBg) html += '<div class="anni-overlay"></div>';
    html += '<div class="anni-content">';
    html += '<div class="anni-title">' + active.title + '</div>';
    html += '<div class="anni-days">' + days + '<span class="anni-days-unit">天</span></div>';
    html += '<div class="anni-date">' + dateStr + ' 起</div>';
    html += '</div>';
    widget.innerHTML = html;
  }

  // ===== 拖拽逻辑 =====
  var pressTimer = null;
  var isDragging = false;
  var startX = 0, startY = 0;
  var baseTop = 0;
  var moved = false;

  function onStart(cx, cy) {
    moved = false;
    startX = cx;
    startY = cy;
    baseTop = parseFloat(widget.style.top) || savedTop;

    pressTimer = setTimeout(function() {
      isDragging = true;
      if (!window.appEditMode) enterAppEditMode();
      widget.style.transition = 'none';
      if (navigator.vibrate) navigator.vibrate(20);
    }, 600);
  }

  function onMove(cx, cy) {
    var dx = cx - startX;
    var dy = cy - startY;

    if (!isDragging) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(pressTimer);
      }
      return;
    }

    moved = true;
    var newTop = baseTop + dy;
    var currentMaxTop = (home.clientHeight || 600) - widgetHeight - 20;
    if (newTop < minTop) newTop = minTop;
    if (newTop > currentMaxTop) newTop = currentMaxTop;
    widget.style.top = newTop + 'px';
  }

  function onEnd() {
    clearTimeout(pressTimer);
    if (isDragging) {
      isDragging = false;
      widget.style.transition = '';
      var top = parseFloat(widget.style.top) || savedTop;
      var currentMaxTop = (home.clientHeight || 600) - widgetHeight - 20;
      var rowH = 102;
      // 网格吸附
      top = Math.round((top - minTop) / rowH) * rowH + minTop;
      if (top < minTop) top = minTop;
      if (top > currentMaxTop) top = currentMaxTop;
      widget.style.top = top + 'px';
      state.settings.anniPos = { x: 16, y: top };
      saveState();
    } else if (!moved) {
      // 纯点击 → 打开面板
      if (!window.appEditMode) openAnniPanel();
    }
    moved = false;
  }

  // 触摸事件（关键：passive:false）
  widget.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    var t = e.touches[0];
    onStart(t.clientX, t.clientY);

    var moveH = function(ev) {
      if (ev.touches.length !== 1) return;
      if (isDragging) ev.preventDefault();
      var t2 = ev.touches[0];
      onMove(t2.clientX, t2.clientY);
    };
    var endH = function() {
      document.removeEventListener('touchmove', moveH);
      document.removeEventListener('touchend', endH);
      document.removeEventListener('touchcancel', endH);
      onEnd();
    };
    document.addEventListener('touchmove', moveH, { passive: false });
    document.addEventListener('touchend', endH);
    document.addEventListener('touchcancel', endH);
  }, { passive: false });

  // 鼠标事件
  widget.addEventListener('mousedown', function(e) {
    e.preventDefault();
    onStart(e.clientX, e.clientY);

    var moveH = function(ev) { onMove(ev.clientX, ev.clientY); };
    var endH = function() {
      document.removeEventListener('mousemove', moveH);
      document.removeEventListener('mouseup', endH);
      onEnd();
    };
    document.addEventListener('mousemove', moveH);
    document.addEventListener('mouseup', endH);
  });

  home.appendChild(widget);
}

function openAnniPanel() {
  getAnniData();
  renderAnniPanelList();
  document.getElementById('anniPanel').style.display = 'block';
  document.getElementById('anniMask').style.display = 'block';
}

function closeAnniPanel() {
  document.getElementById('anniPanel').style.display = 'none';
  document.getElementById('anniMask').style.display = 'none';
}

function renderAnniPanelList() {
  var content = document.getElementById('anniPanelContent');
  var html = '';

  // 背景设置
  html += '<div class="anni-form-row"><label>组件背景图</label>';
  html += '<button class="anni-bg-btn" onclick="document.getElementById(\'anniBgInput\').click()">选择图片</button>';
  if (state.settings.anniBg) {
    html += '<button class="anni-bg-btn" onclick="resetAnniBg()" style="color:var(--red);">清除背景图</button>';
  }
  html += '<input type="file" id="anniBgInput" accept="image/*" style="display:none" onchange="handleAnniBg(event)">';
  html += '</div>';

  // 纪念日列表
  html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin:16px 0 8px;">选择展示</div>';
  if (state.anniversaries.length === 0) {
    html += '<div style="text-align:center;color:var(--gray);font-size:13px;padding:16px;">还没有纪念日</div>';
  } else {
    state.anniversaries.forEach(function(a) {
      var isActive = state.settings.anniActiveId === a.id;
      html += '<div class="anni-list-item' + (isActive ? ' active' : '') + '" onclick="pickAnni(\'' + a.id + '\')">';
      html += '<div class="anni-item-info">';
      html += '<div class="anni-item-title">' + a.title + '</div>';
      html += '<div class="anni-item-date">' + a.date + ' · ' + calcDays(a.date) + ' 天</div>';
      html += '</div>';
      html += '<div class="anni-item-actions">';
      html += '<span class="edit" onclick="event.stopPropagation();editAnni(\'' + a.id + '\')">编辑</span>';
      html += '<span class="del" onclick="event.stopPropagation();deleteAnni(\'' + a.id + '\')">删除</span>';
      html += '</div>';
      html += '</div>';
    });
  }
  html += '<button class="anni-add-btn" onclick="addAnni()">+ 添加纪念日</button>';

  content.innerHTML = html;
}

function pickAnni(id) {
  state.settings.anniActiveId = id;
  saveState();
  renderAnniPanelList();
  renderAnniversaryWidget();
  showToast('已选择展示');
}

function addAnni() {
  var title = prompt('纪念日名称（如：在一起）');
  if (!title || !title.trim()) return;
  var date = prompt('日期（格式：2020-01-01）');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('日期格式不对，要 2020-01-01 这样'); return; }
  var id = 'anni_' + Date.now();
  state.anniversaries.push({ id: id, title: title.trim(), date: date });
  if (!state.settings.anniActiveId) state.settings.anniActiveId = id;
  saveState();
  renderAnniPanelList();
  renderAnniversaryWidget();
  showToast('已添加');
}

function editAnni(id) {
  var a = state.anniversaries.find(function(x) { return x.id === id; });
  if (!a) return;
  var title = prompt('修改名称', a.title);
  if (title === null) return;
  if (!title.trim()) return;
  var date = prompt('修改日期（格式：2020-01-01）', a.date);
  if (date === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { showToast('日期格式不对'); return; }
  a.title = title.trim();
  a.date = date;
  saveState();
  renderAnniPanelList();
  renderAnniversaryWidget();
  showToast('已修改');
}

function deleteAnni(id) {
  if (!confirm('确定删除这个纪念日？')) return;
  state.anniversaries = state.anniversaries.filter(function(x) { return x.id !== id; });
  if (state.settings.anniActiveId === id) {
    state.settings.anniActiveId = state.anniversaries[0] ? state.anniversaries[0].id : null;
  }
  saveState();
  renderAnniPanelList();
  renderAnniversaryWidget();
  showToast('已删除');
}

function handleAnniBg(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX_WIDTH = 800, width = img.width, height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressed = canvas.toDataURL('image/jpeg', 0.7);
      state.settings.anniBg = compressed;
      saveState();
      renderAnniversaryWidget();
      renderAnniPanelList();
      showToast('背景已设置');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function resetAnniBg() {
  state.settings.anniBg = null;
  saveState();
  renderAnniversaryWidget();
  renderAnniPanelList();
  showToast('已清除背景');
}

// 遮罩点击关闭
document.getElementById('anniMask').addEventListener('click', closeAnniPanel);
