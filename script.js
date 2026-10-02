// ===== 原生 IndexedDB 初始化（无需任何外部库） =====
var dbPromise = new Promise(function(resolve, reject) {
  var req = indexedDB.open('MindAppDB', 2);
  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    if (!db.objectStoreNames.contains('stateStore')) {
      db.createObjectStore('stateStore');
    }
    if (!db.objectStoreNames.contains('stickerStore')) {
      db.createObjectStore('stickerStore');
    }
  };
  req.onsuccess = function(e) { resolve(e.target.result); };
  req.onerror = function(e) { reject(e.target.error); };
});


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
  activeCalls: [], // 所有正在进行的通话（包括AI发起的）
  checkinHistory: [],
  settings: { callBg: null, checkinBg: null, pushEnabled: false, customIcons: {}, currentStickerGroupId: 'default' },
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
    giftItems: null,
      workShifts: [],   // 所有梦角的打工记录
        bannedDreams: [],         // 被封禁的梦角 [{ dreamId, until }]
  apologizingDreams: [],    // 强制道歉的梦角 [{ dreamId, until }]
  cheatUsage: { date: '', unbanGroups: [], seizeGroups: [] },  // 外挂使用记录
    musicLibrary: {
    songs: [],      // 所有导入的歌曲
    playlists: []   // 用户创建的播放列表
  },
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
  { key: 'pageStickers', name: '表情包', emoji: '😀', color: 'icon-blue' },
  { key: 'pageWork', name: '打工', emoji: '💼', color: 'icon-orange' },
  { key: 'pageMusic', name: '音乐', emoji: '🎵', color: 'icon-purple' },
];

// ===== 1. 渲染主页图标 =====
var APP_PER_PAGE = 24; // 每页 4×6
var MIN_APP_PAGES = 3; // 最少 3 页，第三页留空给用户自己拖

function initAppPages() {
  var allKeys = ICONS_CONFIG.map(function(item) { return item.key; });

  // 已有数据：校验 + 补齐槽位
  if (state.appPages && Array.isArray(state.appPages) && state.appPages.length > 0) {
    var existing = [];
    state.appPages.forEach(function(page) {
      if (Array.isArray(page)) {
        page.forEach(function(k) {
          if (k && existing.indexOf(k) === -1) existing.push(k);
        });
      }
    });
    var missing = allKeys.filter(function(k) { return existing.indexOf(k) === -1; });

    if (missing.length === 0 && existing.length === allKeys.length && state.appPages.length >= MIN_APP_PAGES) {
      // 补齐每页长度到 APP_PER_PAGE，并补足页数
      state.appPages.forEach(function(page) {
        while (page.length < APP_PER_PAGE) page.push(null);
      });
      while (state.appPages.length < MIN_APP_PAGES) {
        var blank = [];
        for (var z = 0; z < APP_PER_PAGE; z++) blank.push(null);
        state.appPages.push(blank);
      }
      return;
    }
    // 数据对不上（新增了图标 / 页数不够），重置
    state.appPages = null;
  }

  // 重新生成：第一页放全部图标，剩余页留空
  var keys = allKeys.slice();
  var pages = [];
  var firstPage = keys.slice(0, APP_PER_PAGE);
  while (firstPage.length < APP_PER_PAGE) firstPage.push(null);
  pages.push(firstPage);

  var totalPages = Math.max(MIN_APP_PAGES, Math.ceil(keys.length / APP_PER_PAGE));
  for (var p = 1; p < totalPages; p++) {
    var page = keys.slice(p * APP_PER_PAGE, (p + 1) * APP_PER_PAGE);
    while (page.length < APP_PER_PAGE) page.push(null);
    pages.push(page);
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
async function init() {
  await loadState(); 
    // 给所有梦角补上 balance 字段
  if (state.dreams && Array.isArray(state.dreams)) {
      if (!state.giftItems || !Array.isArray(state.giftItems) || state.giftItems.length === 0) {
    state.giftItems = [
      { id: 'gift_1', name: '蛋糕', price: 5 },
      { id: 'gift_2', name: '花',   price: 10 },
      { id: 'gift_3', name: '奶茶', price: 15 }
    ];
  }
    state.dreams.forEach(function(d) {
      if (d.balance == null) d.balance = 0;
      if (!d.statuses || !Array.isArray(d.statuses)) d.statuses = [];
      if (d.currentStatus === undefined) d.currentStatus = '';
      if (d.statusUpdateAt === undefined) d.statusUpdateAt = 0;
    });
  }
  loadChatMessages();
  renderChatMessages();
  renderAll();
  renderAppIcons();
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
  checkAutoLetter();
setInterval(checkAutoLetter, 3 * 60 * 60 * 1000);
    checkRedPacketExpiry();
  setInterval(checkRedPacketExpiry, 5 * 60 * 1000);
    startWorkSystem();
      checkAssistantExpiry();
  setInterval(checkAssistantExpiry, 30000);
  startDreamStatusTicker();
}

// ===== PERSISTENCE =====
function saveState() {
  var data = JSON.stringify(state);
  dbPromise.then(function(db) {
    var tx = db.transaction('stateStore', 'readwrite');
    tx.objectStore('stateStore').put(data, 'dreamCheckState');
  }).catch(function(e) {
    console.error('IndexedDB 保存失败，尝试回退到 localStorage', e);
    try { localStorage.setItem('dreamCheckState', data); } catch(err) {}
  });
}

function loadState() {
  return dbPromise.then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('stateStore', 'readonly');
      var req = tx.objectStore('stateStore').get('dreamCheckState');
      req.onsuccess = function(e) {
        var saved = e.target.result;
        if (!saved) {
          // 如果 IndexedDB 没数据，尝试从旧的 localStorage 迁移
          var oldData = localStorage.getItem('dreamCheckState');
          if (oldData) {
            saved = oldData;
            // 迁移到 IndexedDB 并清空 localStorage
            var tx2 = db.transaction('stateStore', 'readwrite');
            tx2.objectStore('stateStore').put(saved, 'dreamCheckState');
            localStorage.removeItem('dreamCheckState');
          }
        }
        if (saved) {
          try {
            var parsed = JSON.parse(saved);
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
            if (parsed.workShifts) state.workShifts = parsed.workShifts;
            if (parsed.bannedDreams) state.bannedDreams = parsed.bannedDreams;
            if (parsed.apologizingDreams) state.apologizingDreams = parsed.apologizingDreams;
            if (parsed.cheatUsage) state.cheatUsage = parsed.cheatUsage;
            if (parsed.musicLibrary) state.musicLibrary = parsed.musicLibrary;
            if (parsed.giftItems) state.giftItems = parsed.giftItems;
          } catch(err) {}
        }
        resolve();
      };
      req.onerror = function() {
        resolve();
      };
    });
  }).catch(function() {
    // 如果整个数据库都打不开，退回 localStorage 读取
    var saved = localStorage.getItem('dreamCheckState');
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        if (parsed.profile) state.profile = parsed.profile;
        if (parsed.dream) state.dream = parsed.dream;
        if (parsed.dreams) state.dreams = parsed.dreams;
        // ... (为了简洁，这里用同样的方式把剩下的字段读一遍) ...
      } catch(e) {}
    }
  });
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
    if (pageId === 'pageStickers') renderStickerGroups();
    if (pageId === 'pageWork') renderWorkCards();
    if (pageId === 'pageMusic') renderMusicList();
    if (pageId === 'pageCallHistory') renderCallHistory();
    if (pageId === 'pageCheckinHistory') renderCheckinHistory();
    if (pageId === 'pageProfile') loadProfileForm();
    if (pageId === 'pageDreamRole') renderDreamRoles();
    if (pageId === 'pageChatList') renderChatList();
    if (pageId === 'pageCompanion') compInit();
        if (pageId === 'pageMailbox') { switchMailTab('inbox'); renderMailList(); }
    if (pageId === 'pageWriteLetter') { /* 由 openWriteLetter 初始化 */ }
    if (pageId === 'pageFavorites') renderFavorites();
    if (pageId === 'pageDiary') { renderDiaryCover(); renderDiaryList(); }
    if (pageId === 'pageIconSettings') renderIconSettings();
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
    try { renderDiaryCover(); } catch(e) {}
    showToast('头像已更新');
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  state.profile.name = document.getElementById('profileName').value || '我';
  state.profile.status = document.getElementById('profileStatus').value || '在线';
  saveState();
  try { renderDiaryCover(); } catch(e) {}
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
            if (state.dreams[0].balance == null) state.dreams[0].balance = 0;
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
    state.dreams.push({ id: newId, name: '新梦角', gender: '男', avatar: '', balance: 0 });
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
  
  renderDreamStatusList();
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
    if (d.balance == null) d.balance = 0;
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
    // 清理这个梦角的打工记录
  if (state.workShifts && state.workShifts.length > 0) {
    state.workShifts = state.workShifts.filter(function(w) { return w.dreamId !== state.currentEditDreamId; });
  }
  state.currentEditDreamId = null;
  saveState();
  renderDreamRoles();
  showToast('梦角已删除');
  navigateTo('pageDreamRole');
}

// ===== WORD CARDS =====
// ===== 替换 renderWordCards 函数 =====
// 获取所有可用字卡（未被屏蔽）
function getUsableCards() {
  return (state.cards || []).filter(function(c) {
    return isCardUsable(c);
  });
}

// 根据拼接设置生成梦角要发送的文字
function buildCardText(availableCards) {
  if (!availableCards || availableCards.length === 0) return '…';
  var s = state.settings || {};
  var useJoin = !!s.cardJoinEnabled;
  var minN = Math.max(1, Math.min(7, parseInt(s.cardJoinMin) || 1));
  var maxN = Math.max(minN, Math.min(7, parseInt(s.cardJoinMax) || 1));
  var count = 1;
  if (useJoin) {
    count = minN + Math.floor(Math.random() * (maxN - minN + 1));
    if (count > availableCards.length) count = availableCards.length;
  }
  var shuffled = availableCards.slice().sort(function() { return Math.random() - 0.5; });
  var picked = shuffled.slice(0, count);
  var texts = picked.map(function(c) { return c.text; }).filter(function(t) { return t; });
  if (texts.length === 0) return '…';
  return texts.join('，');
}

function renderWordCards() {
  var container = document.getElementById('wordCardsContainer');
  if (!container) return;

  var searchTerm = (window._cardSearchTerm || '').trim();

  var toolbarHtml = '<div class="card-toolbar">';
  toolbarHtml += '<div class="card-toolbar-row">';
  toolbarHtml += '<button class="card-toolbar-btn" onclick="addCategory()">+ 分类</button>';
  toolbarHtml += '<button class="card-toolbar-btn" onclick="openAddCardModal()">+ 字卡</button>';
  toolbarHtml += '<button class="card-toolbar-btn" onclick="dedupeCards()">去重</button>';
  toolbarHtml += '</div>';
  toolbarHtml += '<input class="card-search" type="text" placeholder="🔍 搜索字卡" value="' + (searchTerm || '').replace(/"/g, '&quot;') + '" oninput="onCardSearch(this.value)">';
  toolbarHtml += '</div>';

  if (searchTerm) {
    var matched = state.cards.filter(function(c) {
      return c.text && c.text.indexOf(searchTerm) > -1;
    });
    var body = '';
    if (matched.length === 0) {
      body = '<div class="card-empty">没有找到包含「' + searchTerm + '」的字卡</div>';
    } else {
      body = '<div class="card-count">找到 ' + matched.length + ' 条</div>';
      body += '<div class="card-list">';
      matched.forEach(function(c) { body += renderSingleCardHtml(c); });
      body += '</div>';
    }
    container.innerHTML = toolbarHtml + body;
    return;
  }

  var groupsHtml = '';
  state.categories.forEach(function(cat) {
    var cards = state.cards.filter(function(c) { return c.cat === cat.id; });
    var collapsed = cat.collapsed || false;
    var catBlocked = cat.blocked || false;

    var cardsHtml = '';
    if (cards.length === 0) {
      cardsHtml = '<div class="card-empty-inline">暂无字卡</div>';
    } else {
      cardsHtml = '<div class="card-list">';
      cards.forEach(function(c) { cardsHtml += renderSingleCardHtml(c); });
      cardsHtml += '</div>';
    }

    groupsHtml += '<div class="category-group' + (catBlocked ? ' blocked' : '') + '">';
    groupsHtml += '<div class="category-header" onclick="toggleCategory(\'' + cat.id + '\')">';
    groupsHtml += '<span class="cat-name">' + cat.name + '（' + cards.length + '）</span>';
    groupsHtml += '<div class="cat-actions">';
    groupsHtml += '<span class="cat-action" onclick="event.stopPropagation();toggleBlockCategory(\'' + cat.id + '\')" title="屏蔽本组">' + (catBlocked ? '🔇' : '🔊') + '</span>';
    groupsHtml += '<span class="cat-action" onclick="event.stopPropagation();deleteCategory(\'' + cat.id + '\')" title="删除本组">🗑</span>';
    groupsHtml += '<span class="cat-toggle' + (collapsed ? ' collapsed' : '') + '">▼</span>';
    groupsHtml += '</div>';
    groupsHtml += '</div>';
    groupsHtml += '<div class="category-body' + (collapsed ? ' hidden' : '') + '">';
    groupsHtml += cardsHtml;
    groupsHtml += '</div>';
    groupsHtml += '</div>';
  });

  container.innerHTML = toolbarHtml + groupsHtml;
}

function renderSingleCardHtml(c) {
  var blocked = c.blocked || false;
  var html = '<div class="card-item' + (blocked ? ' blocked' : '') + '">';
  html += '<div class="card-item-text">' + (c.text || '') + '</div>';
  html += '<div class="card-item-actions">';
  html += '<span onclick="toggleBlockCard(\'' + c.id + '\')" title="' + (blocked ? '取消屏蔽' : '屏蔽') + '">' + (blocked ? '🔇' : '🔊') + '</span>';
  html += '<span onclick="editCard(\'' + c.id + '\')" title="编辑">✎</span>';
  html += '<span onclick="deleteCard(\'' + c.id + '\')" title="删除">🗑️</span>';
  html += '</div>';
  html += '</div>';
  return html;
}


window._addCardTab = 'single';

function openAddCardModal() {
  var sel = document.getElementById('addCardCatSelect');
  if (!sel) return;
  sel.innerHTML = state.categories.map(function(c) {
    return '<option value="' + c.id + '">' + c.name + '</option>';
  }).join('');
  document.getElementById('addCardTextInput').value = '';
  document.getElementById('addCardBatchInput').value = '';
  switchAddCardTab('single');
  document.getElementById('addCardModal').style.display = 'flex';
  setTimeout(function() {
    var inp = document.getElementById('addCardTextInput');
    if (inp) inp.focus();
  }, 100);
}

function switchAddCardTab(tab) {
  window._addCardTab = tab;
  var single = document.getElementById('addCardTabSingle');
  var batch = document.getElementById('addCardTabBatch');
  var textInp = document.getElementById('addCardTextInput');
  var batchInp = document.getElementById('addCardBatchInput');
  if (tab === 'single') {
    single.style.background = '#007aff';
    single.style.color = '#fff';
    batch.style.background = '#f0f0f5';
    batch.style.color = '#555';
    textInp.style.display = 'block';
    batchInp.style.display = 'none';
    textInp.focus();
  } else {
    batch.style.background = '#007aff';
    batch.style.color = '#fff';
    single.style.background = '#f0f0f5';
    single.style.color = '#555';
    textInp.style.display = 'none';
    batchInp.style.display = 'block';
    batchInp.focus();
  }
}

function closeAddCardModal() {
  var m = document.getElementById('addCardModal');
  if (m) m.style.display = 'none';
}

function confirmAddCard() {
  var catId = document.getElementById('addCardCatSelect').value;
  var tab = window._addCardTab || 'single';

  if (tab === 'single') {
    var text = (document.getElementById('addCardTextInput').value || '').trim();
    if (!text) { showToast('请输入字卡内容'); return; }
    var exists = state.cards.some(function(c) { return (c.text || '').trim() === text; });
    if (exists) { showToast('该字卡已存在，已跳过'); return; }
    state.cards.push({ id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), text: text, cat: catId });
    saveState();
    renderWordCards();
    closeAddCardModal();
    showToast('已添加');
  } else {
    var raw = document.getElementById('addCardBatchInput').value || '';
    var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
    if (lines.length === 0) { showToast('请输入字卡'); return; }
    var existing = {};
    state.cards.forEach(function(c) { existing[(c.text || '').trim()] = true; });
    var added = 0, skipped = 0;
    lines.forEach(function(line) {
      if (existing[line]) { skipped++; return; }
      state.cards.push({ id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), text: line, cat: catId });
      existing[line] = true;
      added++;
    });
    saveState();
    renderWordCards();
    closeAddCardModal();
    if (skipped > 0) showToast('已添加 ' + added + ' 条，跳过 ' + skipped + ' 条重复');
    else showToast('已添加 ' + added + ' 条');
  }
}

function onCardSearch(val) {
  window._cardSearchTerm = val || '';
  renderWordCards();
  var inp = document.querySelector('.card-search');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function dedupeCards() {
  var seen = {};
  var dupes = [];
  state.cards.forEach(function(c) {
    var key = (c.text || '').trim();
    if (!key) return;
    if (seen[key] !== undefined) dupes.push(c.id);
    else seen[key] = c.id;
  });
  if (dupes.length === 0) {
    alert('没有发现重复的字卡 ✓');
    return;
  }
  if (!confirm('发现 ' + dupes.length + ' 条重复字卡，是否删除？\n\n（每组重复只保留一条）')) return;
  state.cards = state.cards.filter(function(c) { return dupes.indexOf(c.id) === -1; });
  saveState();
  renderWordCards();
  showToast('已删除 ' + dupes.length + ' 条重复字卡');
}

function toggleBlockCard(cardId) {
  var c = state.cards.find(function(x) { return x.id === cardId; });
  if (!c) return;
  c.blocked = !c.blocked;
  saveState();
  renderWordCards();
  showToast(c.blocked ? '已屏蔽' : '已启用');
}

function toggleBlockCategory(catId) {
  var cat = state.categories.find(function(x) { return x.id === catId; });
  if (!cat) return;
  cat.blocked = !cat.blocked;
  saveState();
  renderWordCards();
  showToast(cat.blocked ? '已屏蔽此分组' : '已启用此分组');
}

function isCardUsable(card) {
  if (!card) return false;
  if (card.blocked) return false;
  var cat = state.categories.find(function(c) { return c.id === card.cat; });
  if (cat && cat.blocked) return false;
  return true;
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

function deleteCard(cardId) {
  state.cards = state.cards.filter(c => c.id !== cardId);
  saveState();
  renderWordCards();
}

function batchAddCards() {
  var text = document.getElementById('batchText').value;
  var lines = text.split('\n').map(function(s){return s.trim();}).filter(function(s){return s;});
  if (lines.length === 0) { showToast('请输入字卡'); return; }
  var targetCat = document.getElementById('batchCategory').value || (state.categories[0] && state.categories[0].id) || 'default';
  var existing = {};
  state.cards.forEach(function(c) { existing[(c.text || '').trim()] = true; });
  var added = 0, skipped = 0;
  lines.forEach(function(line) {
    if (existing[line]) { skipped++; return; }
    state.cards.push({ id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), text: line, cat: targetCat });
    existing[line] = true;
    added++;
  });
  saveState();
  renderWordCards();
  if (skipped > 0) showToast('已添加 ' + added + ' 条，跳过 ' + skipped + ' 条重复');
  else showToast('已添加 ' + added + ' 条');
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
       <div class="hi-main">${c.dreamName || '梦角'}：${c.message || '查岗消息'}</div>
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
    stickerGroups: stickerGroups,
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
           // 恢复表情包（新结构）
if (data.stickerGroups && Array.isArray(data.stickerGroups)) {
  stickerGroups = data.stickerGroups;
  saveStickerGroups();
} else if (data.stickers && Array.isArray(data.stickers)) {
  stickerGroups = [{ id: 'default', name: '默认', items: data.stickers }];
  saveStickerGroups();
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
  if (r < 0.05) {
  if (state.callState === 'idle') triggerCall();
} else if (r < 0.075) {
  if (state.callState === 'idle') triggerCheckin();
} else {
          var allCards = getUsableCards();
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
    // 【修复】过滤掉被禁言的成员
    var availableIds = g.memberIds.filter(function(id) {
      return !g.muteEndsAt || g.muteEndsAt[String(id)] === undefined;
    });
    if (availableIds.length > 0) {
      var randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
      var member = state.dreams.find(function(d) { return d.id === randomId; });
      if (member) randomDream = member;
    } else {
      return;
    }
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

    var allCards = getUsableCards();
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
    dreamName: checker.name,
    dreamId: checker.id,
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
  icon: '',
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
// ===== 表情包分组数据 =====
var stickerGroups = loadStickerGroups();
var currentStickerGroupId = 'default';

function loadStickerGroups() {
  var saved = localStorage.getItem('dreamStickerGroups');
  var groups = null;
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) groups = parsed;
    } catch(e) {}
  }
  if (!groups) {
    var old = [];
    try { old = JSON.parse(localStorage.getItem('dreamStickers') || '[]'); } catch(e) {}
    groups = [{ id: 'default', name: '默认', items: old }];
  }

  dbPromise.then(function(db) {
    var tx = db.transaction('stickerStore', 'readonly');
    var req = tx.objectStore('stickerStore').get('stickerGroups');
    req.onsuccess = function(e) {
      var result = e.target.result;
      if (result) {
        try {
          var latest = JSON.parse(result);
          if (Array.isArray(latest) && latest.length > 0) {
            stickerGroups = latest;
            try { renderStickerGroups(); } catch(err) {}
            try { renderStickers(); } catch(err) {}
          }
        } catch(err) {}
      } else {
        saveStickerGroups();
      }
    };
  }).catch(function(e) {
    console.error('读取表情包 IndexedDB 失败', e);
  });

  return groups;
}

function saveStickerGroups() {
  var data = JSON.stringify(stickerGroups);
  dbPromise.then(function(db) {
    var tx = db.transaction('stickerStore', 'readwrite');
    tx.objectStore('stickerStore').put(data, 'stickerGroups');
  }).catch(function(e) {
    console.error('表情包保存失败', e);
    showToast('表情包保存失败');
  });
  try { localStorage.setItem('dreamStickerGroups', data); } catch(e) {}
}

function getCurrentStickerGroup() {
  var g = stickerGroups.find(function(x) { return x.id === currentStickerGroupId; });
  if (!g) {
    g = stickerGroups[0];
    currentStickerGroupId = g ? g.id : 'default';
  }
  return g;
}

// 兼容旧代码：把所有分组的表情包平铺成一个数组
function getAllStickers() {
  var arr = [];
  stickerGroups.forEach(function(g) {
    (g.items || []).forEach(function(item, idx) {
      arr.push({ groupId: g.id, index: idx, data: item });
    });
  });
  return arr;
}

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
   var cards = getUsableCards();
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
                  // AI 主动发起群聊通话（10% 概率）
      if (Math.random() < 0.10 && state.activeCalls.length < 3) {
        // 发起人必须不在任何通话中
        var idleCandidates = g.memberIds.filter(function(id) {
          return String(id) !== 'user' && !isDreamBusy(id);
        });
        if (idleCandidates.length > 0) {
          var initiatorId = idleCandidates[Math.floor(Math.random() * idleCandidates.length)];
          var initiator = state.dreams.find(function(d) { return d.id === initiatorId; });
          if (initiator) {
            // 被邀请人必须不在任何通话中
            var candidates = g.memberIds.filter(function(id) {
              return String(id) !== String(initiatorId) && String(id) !== 'user' && !isDreamBusy(id);
            });
            if (candidates.length > 0) {
              var inviteCount = Math.min(candidates.length, 1 + Math.floor(Math.random() * 2));
              var invited = [];
              for (var i = 0; i < inviteCount; i++) {
                var pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
                invited.push(pick);
              }
              if (invited.length > 0) {
                var session = {
                  id: 'call_' + Date.now(),
                  chatId: g.id,
                  type: 'group',
                  initiator: initiatorId,
                  participants: [initiatorId].concat(invited),
                  invited: [],
                  startTime: Date.now(),
                  status: 'connected',
                  userInCall: false
                };
                state.activeCalls.push(session);
                var names = invited.map(function(id) { return getDreamName(id); });
                addSystemMessage(g.id, '「' + initiator.name + '」发起了群聊通话\n通话成员有：' + [initiator.name].concat(names).join('、'));
                startAICallSimulation(session, g);
              }
            }
          }
        }
      }
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
      // 【核心修复】：立刻刷新界面，并弹个小提示
      if (state.currentChatId === g.id) {
        loadChatMessages();
        renderChatMessages();
      }
      showToast('「' + leaver.name + '」退出了群聊');
    }
  }
}
      
      if (g.ownerId !== 'user' && Math.random() < 0.4) {
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
    // 【新增】：群聊或私聊，AI有5%概率发拍一拍
  var usePoke = false;
  if (state.pokes && state.pokes.length > 0 && Math.random() < 0.05) {
    usePoke = true;
  }
  
  // 决定发字卡还是表情包
  var stickers = getAllStickers().map(function(x) { return x.data; });
var hasCards = cards.length > 0;
var hasStickers = stickers.length > 0;
if (hasCards && hasStickers) {
  if (Math.random() < 0.85) useCard = true; else useSticker = true;
} else if (hasCards) {
  useCard = true;
} else if (hasStickers) {
  useSticker = true;
}

  // ===== 梦角主动引用用户消息（15% 概率） =====
  var autoQuote = null;
  if (state.settings && state.settings.dreamQuoteEnabled !== false && Math.random() < 0.15) {
    var userMsgs = [];
    for (var qi = chatMessages.length - 1; qi >= 0 && userMsgs.length < 5; qi--) {
      if (chatMessages[qi] && chatMessages[qi].from === 'user') userMsgs.push(chatMessages[qi]);
    }
    if (userMsgs.length > 0) {
      var picked = userMsgs[Math.floor(Math.random() * userMsgs.length)];
      autoQuote = {
        text: picked.text || '[表情]',
        senderName: state.profile.name || '我',
        msgId: -1
      };
    }
  }

  // ===== 梦角主动收藏用户消息（30% 概率） =====
  if (Math.random() < 0.30) {
    var userMsgs2 = [];
    for (var fi = chatMessages.length - 1; fi >= 0 && userMsgs2.length < 5; fi--) {
      if (chatMessages[fi] && chatMessages[fi].from === 'user') userMsgs2.push(chatMessages[fi]);
    }
    if (userMsgs2.length > 0) {
      if (!state.favorites) state.favorites = [];
      var pickedFav = userMsgs2[Math.floor(Math.random() * userMsgs2.length)];
      var fromName = '梦角';
      var fromId = 'dream';
      if (isGroup && senderId) {
        var senderD = state.dreams.find(function(d) { return d.id === senderId; });
        if (senderD) { fromName = senderD.name; fromId = senderD.id; }
      } else if (state.currentChatId) {
        var senderD2 = state.dreams.find(function(d) { return d.id === state.currentChatId; });
        if (senderD2) { fromName = senderD2.name; fromId = senderD2.id; }
      }
      var chatName2 = '';
      if (isGroup) {
        var gFav = state.groups.find(function(x) { return x.id === state.currentChatId; });
        chatName2 = gFav ? ('群聊：' + gFav.name) : '';
      } else {
        var dFav = state.dreams.find(function(x) { return x.id === state.currentChatId; });
        chatName2 = dFav ? ('私聊：' + dFav.name) : '';
      }
      state.favorites.push({
        id: 'fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text: pickedFav.text || '[表情]',
        senderName: state.profile.name || '我',
        isUser: true,
        chatName: chatName2,
        time: pickedFav.time,
        addedAt: Date.now(),
        favBy: fromName,
        favById: fromId
      });
      saveState();
    }
  }

  // 【核心修复】：优先处理拍一拍
if (usePoke) {
  var pokeText = state.pokes[Math.floor(Math.random() * state.pokes.length)];
  var pokeSenderName = senderId ? getDreamName(senderId) : (state.dream.name || '梦角');
  chatMessages.push({
    from: 'dream',
    type: 'poke',
    text: pokeText,
    senderName: pokeSenderName,
    senderId: senderId,
    time: Date.now()
  });
} else   if (useCard) {
    var finalText = buildCardText(cards);
    var _cMsg = { from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: finalText, time: Date.now() };
    if (autoQuote) _cMsg.quote = autoQuote;
    chatMessages.push(_cMsg);
  } else if (useSticker) {
  var lastMsg = chatMessages[chatMessages.length - 1];
  if (lastMsg === undefined || lastMsg === null) lastMsg = { from: 'system' };
  if (stickers.length > 1 && lastMsg.from === 'user' && lastMsg.stickerIdx !== undefined) {
    do { stickerIdx = Math.floor(Math.random() * stickers.length); } while (stickerIdx === lastMsg.stickerIdx);
  } else {
    stickerIdx = Math.floor(Math.random() * stickers.length);
  }
  var _sMsg = { from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: '[表情]', stickerIdx: stickerIdx, stickerData: stickers[stickerIdx], time: Date.now() };
  if (autoQuote) _sMsg.quote = autoQuote;
  chatMessages.push(_sMsg);
} else {
  var _tMsg = { from: 'dream', senderId: senderId, senderAvatar: senderAvatar, text: '…', time: Date.now() };
  if (autoQuote) _tMsg.quote = autoQuote;
  chatMessages.push(_tMsg);
}

// ===== 梦角随机撤回自己发的消息（3% 概率）=====
var _lastMsg = chatMessages[chatMessages.length - 1];
var _chatIdAtSend = state.currentChatId;
if (_lastMsg && _lastMsg.from === 'dream' && Math.random() < 0.03) {
  var _withdrawSenderName = '';
  if (isGroup && _lastMsg.senderId) {
    _withdrawSenderName = getDreamName(_lastMsg.senderId);
  } else {
    var _wd = state.dreams.find(function(d){ return d.id === _chatIdAtSend; });
    _withdrawSenderName = _wd ? _wd.name : '梦角';
  }
  setTimeout(function() {
    if (state.currentChatId !== _chatIdAtSend) return;
    var _idx = chatMessages.indexOf(_lastMsg);
    if (_idx > -1 && chatMessages[_idx] === _lastMsg) {
      chatMessages[_idx] = { from: 'system', text: '「' + _withdrawSenderName + '」撤回了一条消息', time: Date.now() };
      saveChatMessages();
      renderChatMessages();
    }
  }, 3000 + Math.random() * 4000);
}
  
  // ===== 梦角主动发红包（5% 概率） =====
  if (Math.random() < 0.02) {
    var rpSenderId = isGroup ? senderId : state.currentChatId;
    if (rpSenderId) {
      var rpSender = state.dreams.find(function(d) { return d.id === rpSenderId; });
      if (rpSender) {
        var balance = getDreamBalance(rpSenderId);
        if (balance < 0.01) {
          chatMessages.push({ from: 'system', text: '「' + rpSender.name + '」的零花钱已花完，希望你为他充值', time: Date.now() });
        } else {
          var amt = 0.01 + Math.random() * (balance - 0.01);
          amt = Math.floor(amt * 100) / 100;
          if (amt < 0.01) amt = 0.01;
          if (amt > balance) amt = balance;
          setDreamBalance(rpSenderId, balance - amt);

          var usableForRp = getUsableCards();
          var rpMsg = usableForRp.length > 0 ? usableForRp[Math.floor(Math.random() * usableForRp.length)].text : '大吉大利，恭喜发财';

          var rpMaxPeople = 1;
          if (isGroup) {
            var rpGroup = state.groups.find(function(x) { return x.id === state.currentChatId; });
            var groupSize = rpGroup ? (rpGroup.memberIds.length + 1) : 2;
            rpMaxPeople = 1 + Math.floor(Math.random() * groupSize);
          }

          var rpPacket = {
            from: 'dream',
            senderId: rpSenderId,
            senderName: rpSender.name,
            type: 'redpacket',
            packetId: 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            totalAmount: amt,
            message: rpMsg,
            maxPeople: rpMaxPeople,
            claimed: [],
            refunded: false,
            chatId: state.currentChatId,
            time: Date.now()
          };
          chatMessages.push(rpPacket);

          if (isGroup) {
            var rpGroup2 = state.groups.find(function(x) { return x.id === state.currentChatId; });
            if (rpGroup2) {
              var rpCandidates = rpGroup2.memberIds.filter(function(id) { return id !== rpSenderId; });
              rpCandidates.forEach(function(id) {
                if (Math.random() < 0.6) {
                  setTimeout(function() {
                    claimRedPacket(rpPacket.packetId, id);
                  }, 1500 + Math.random() * 5000);
                }
              });
            }
          }
        }
      }
    }
  }

   // ===== 梦角主动送礼物（2% 概率） =====
  if (Math.random() < 0.02) {
    var giftSenderId = isGroup ? senderId : state.currentChatId;
    if (giftSenderId) {
      var giftSender = state.dreams.find(function(d) { return d.id === giftSenderId; });
      if (giftSender) {
        var giftBalance = getDreamBalance(giftSenderId);
        var giftList = getGiftItems();
        if (giftList.length > 0) {
          var pickedGift = giftList[Math.floor(Math.random() * giftList.length)];
          var count = 1 + Math.floor(Math.random() * 3);
          var totalCost = Math.floor(pickedGift.price * count * 100) / 100;

          if (giftBalance < totalCost) {
            chatMessages.push({ from: 'system', text: '「' + giftSender.name + '」的零花钱不够买礼物了，希望你为他充值', time: Date.now() });
          } else {
            setDreamBalance(giftSenderId, giftBalance - totalCost);
            var giftPacket = {
              from: 'dream',
              senderId: giftSenderId,
              senderName: giftSender.name,
              type: 'gift',
              packetId: 'gf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              giftName: pickedGift.name,
              unitPrice: pickedGift.price,
              count: count,
              totalPrice: totalCost,
              claimed: [],
              refunded: false,
              chatId: state.currentChatId,
              time: Date.now()
            };
            chatMessages.push(giftPacket);
          }
        }
      }
    }
  } 

  renderChatMessages();
saveChatMessages();
// 【修复】：找到真正的发件人名字
var notifyName = '梦角';
if (isGroup && senderId) {
  var notifyMember = state.dreams.find(function(d) { return d.id === senderId; });
  if (notifyMember) notifyName = notifyMember.name;
} else if (state.currentChatId) {
  var notifyDream = state.dreams.find(function(d) { return d.id === state.currentChatId; });
  if (notifyDream) notifyName = notifyDream.name;
}
sendNotification(notifyName, '发来一条消息');
}

// ===== AI 群主的管理行为 =====
// ===== AI 群主的管理行为 =====
function aiGroupOwnerAction(g) {
  var owner = state.dreams.find(function(d) { return d.id === g.ownerId; });
  if (!owner) return;

  var otherMembers = g.memberIds.filter(function(id) { return String(id) !== String(g.ownerId); });
  if (Math.random() < 1) otherMembers.push('user');
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
    if (targetId === 'user') {
  target = { id: 'user', name: state.profile.name || '我' };
} else {
  target = state.dreams.find(function(d) { return d.id === targetId; });
}
if (!target) return;

    // 让 AI 有概率把群主转让给用户
if (Math.random() < 1) otherMembers.push('user');
    var subAction = Math.random();
    if (subAction < 0.25) {
      if (!g.muteEndsAt) g.muteEndsAt = {};
      if (g.muteEndsAt[String(targetId)] !== undefined) return; 
      var durations = [5, 10, 15, 30];
      var mins = durations[Math.floor(Math.random() * durations.length)];
      g.muteEndsAt[String(targetId)] = Date.now() + mins * 60 * 1000; // 强制转字符串
      sysText = '群主「' + owner.name + '」禁言了「' + target.name + '」' + mins + '分钟';
    } else if (subAction < 0.5) {
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
    if (d) document.getElementById('chatHeaderName').textContent = d.name + (d.currentStatus ? ' · ' + d.currentStatus : '');
  }

  // ===== 更新通话横条（只有被邀请才显示） =====
  // ===== 更新通话横条（只要有人在通话就显示横幅，但按钮只对被邀请者显示） =====
  var banner = document.getElementById('activeCallBanner');
  if (banner) {
    var bannerCall = null;
    if (state.currentChatId && state.currentChatId.startsWith('group_') && state.activeCalls) {
      for (var bi = 0; bi < state.activeCalls.length; bi++) {
        var c = state.activeCalls[bi];
        if (c.chatId === state.currentChatId && c.participants.indexOf('user') === -1) {
          bannerCall = c; break;
        }
      }
    }
    if (bannerCall) {
      var names = bannerCall.participants.map(function(id) { return getDreamName(id); }).join('、');
      document.getElementById('activeCallBannerText').textContent = '📞 ' + names + ' 正在通话中';
      banner.style.display = 'flex';
      // 只有被邀请时，才显示「加入」按钮
      var joinBtn = document.getElementById('activeCallJoinBtn');
      if (joinBtn) {
        if (bannerCall.invited && bannerCall.invited.indexOf('user') > -1) {
          joinBtn.style.display = 'inline-block';
        } else {
          joinBtn.style.display = 'none';
        }
      }
    } else {
      banner.style.display = 'none';
    }
  }

  renderChatMessages(); // 
} // 

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

// ===== 表情包功能完整版 =====

function toggleStickerEditMode() {
  isEditingStickers = !isEditingStickers;
  renderStickers();
}

var isEditingStickers = false;

function renderStickers() {
  var panel = document.getElementById('stickerPanel');
  if (!panel) return;

  if (state.settings && state.settings.currentStickerGroupId) {
    currentStickerGroupId = state.settings.currentStickerGroupId;
  }

  var html = '';

  html += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border);flex-shrink:0;position:sticky;top:0;background:var(--card);z-index:5;-webkit-overflow-scrolling:touch;">';
  stickerGroups.forEach(function(g) {
    var active = g.id === currentStickerGroupId;
    html += '<span onclick="switchStickerGroup(\'' + g.id + '\')" style="flex-shrink:0;padding:6px 16px;border-radius:16px;font-size:13px;cursor:pointer;background:' + (active ? 'var(--blue)' : '#f0f0f5') + ';color:' + (active ? '#fff' : 'var(--text)') + ';white-space:nowrap;">' + g.name + '</span>';
  });
  html += '</div>';

  var currentGroup = getCurrentStickerGroup();
  var items = currentGroup ? (currentGroup.items || []) : [];

  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
  html += '<span style="font-size:12px;color:var(--gray);">' + (isEditingStickers ? '点击表情删除' : '表情包') + '</span>';
  html += '<button onclick="toggleStickerEditMode()" style="font-size:12px;padding:2px 10px;border-radius:10px;border:1px solid var(--border);background:' + (isEditingStickers ? 'var(--red)' : 'var(--card)') + ';color:' + (isEditingStickers ? '#fff' : 'var(--blue)') + ';">' + (isEditingStickers ? '完成' : '编辑') + '</button>';
  html += '</div>';

  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px;">';
  if (items.length === 0) {
    html += '<div style="width:100%;text-align:center;color:var(--gray);font-size:13px;padding:20px;">这个分组还没有表情包<br><span style="font-size:11px;">去主屏幕的「表情包」图标里添加</span></div>';
  } else {
    for (var i = 0; i < items.length; i++) {
      html += '<div class="sticker-item" style="position:relative;width:60px;height:60px;flex-shrink:0;">';
      if (isEditingStickers) {
        html += '<img src="' + items[i] + '" style="width:60px;height:60px;max-width:60px;max-height:60px;object-fit:contain;display:block;opacity:0.5;pointer-events:none;">';
        html += '<span onclick="deleteStickerFromChatPanel(\'' + currentStickerGroupId + '\',' + i + ')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;font-size:14px;text-align:center;line-height:20px;cursor:pointer;z-index:10;">×</span>';
      } else {
        html += '<img src="' + items[i] + '" onclick="sendStickerFromGroup(\'' + currentStickerGroupId + '\',' + i + ')" style="width:60px;height:60px;max-width:60px;max-height:60px;object-fit:contain;display:block;cursor:pointer;">';
      }
      html += '</div>';
    }
  }
  html += '</div>';

  panel.innerHTML = html;
}

function switchStickerGroup(groupId) {
  currentStickerGroupId = groupId;
  if (!state.settings) state.settings = {};
  state.settings.currentStickerGroupId = groupId;
  saveState();
  renderStickers();
}

function deleteStickerFromChatPanel(groupId, itemIdx) {
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;
  g.items.splice(itemIdx, 1);
  saveStickerGroups();
  renderStickers();
  renderChatMessages();
  showToast('表情包已删除');
}

function sendStickerFromGroup(groupId, itemIdx) {
  if (isSendingSticker) return;
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g || !g.items[itemIdx]) return;
  isSendingSticker = true;
  setTimeout(function() { isSendingSticker = false; }, 500);

  chatMessages.push({ from: 'user', text: '[表情]', time: Date.now(), stickerData: g.items[itemIdx] });
  document.getElementById('chatInput').value = '';
  renderChatMessages();
  saveChatMessages();
  document.getElementById('stickerPanel').style.display = 'none';
  scheduleAiReply();
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
        if (m.type === 'report_notice') {
      var lines = (m.text || '').split('\n');
      html += '<div style="margin:14px 0;padding:12px 14px;background:rgba(250,81,81,0.08);border:1px solid rgba(250,81,81,0.3);border-radius:12px;font-size:12px;color:#c0392b;line-height:1.7;white-space:pre-wrap;">';
      html += lines.join('<br>');
      html += '</div>';
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
        if (m.type === 'redpacket') {
      var isMine = m.from === 'user';
      var rpHtml = '<div data-msg-index="' + i + '" style="display:flex;justify-content:' + (isMine ? 'flex-end' : 'flex-start') + ';margin-bottom:10px;">';
      rpHtml += '<div onclick="openRedPacketDetail(\'' + m.packetId + '\')" style="cursor:pointer;width:210px;background:linear-gradient(135deg,#fa5151,#d13333);border-radius:12px;padding:14px 16px;color:#fff;box-shadow:0 4px 14px rgba(250,81,81,0.3);' + (m.refunded ? 'opacity:0.55;' : '') + '">';
      rpHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      rpHtml += '<span style="font-size:22px;">🧧</span>';
      rpHtml += '<span style="font-size:14px;font-weight:600;">' + (isMine ? '我发的红包' : m.senderName + ' 发的红包') + '</span>';
      rpHtml += '</div>';
      rpHtml += '<div style="font-size:12px;opacity:0.9;line-height:1.4;">' + m.message + '</div>';
      rpHtml += '<div style="font-size:11px;opacity:0.75;margin-top:6px;">' + (m.refunded ? '已退回' : ('已领 ' + (m.claimed ? m.claimed.length : 0) + '/' + m.maxPeople)) + '</div>';
      rpHtml += '</div>';
      rpHtml += '</div>';
      html += rpHtml;
      continue;
    }

    if (m.type === 'gift') {
      if (!m.claimed) m.claimed = [];
      var isMineG = m.from === 'user';
      var gHtml = '<div data-msg-index="' + i + '" style="display:flex;justify-content:' + (isMineG ? 'flex-end' : 'flex-start') + ';margin-bottom:10px;">';
      gHtml += '<div onclick="openGiftDetail(\'' + m.packetId + '\')" style="cursor:pointer;width:210px;background:linear-gradient(135deg,#f5f5f7,#e8e8ed);border-radius:12px;padding:14px 16px;color:#333;box-shadow:0 4px 14px rgba(0,0,0,0.08);border:1px solid rgba(255,255,255,0.7);' + (m.refunded ? 'opacity:0.55;' : '') + '">';
      gHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      gHtml += '<span style="font-size:22px;">🎁</span>';
      gHtml += '<span style="font-size:14px;font-weight:600;">' + (isMineG ? '我送的礼物' : m.senderName + ' 送的礼物') + '</span>';
      gHtml += '</div>';
      gHtml += '<div style="font-size:13px;color:#333;line-height:1.4;">' + m.giftName + ' ×' + m.count + '</div>';
      gHtml += '<div style="font-size:11px;color:#888;margin-top:6px;">' + formatMoney(m.totalPrice) + ' 元 · ' + (m.refunded ? '已退回' : (m.claimed.length > 0 ? '已领取' : '待领取')) + '</div>';
      gHtml += '</div>';
      gHtml += '</div>';
      html += gHtml;
      continue;
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
        html += '<div class="chat-bubble bubble-user ' + styleClass + '" style="' + userBg + textColor + 'padding:4px;"><img src="' + imgSrc + '" style="max-width:120px;max-height:180px;border-radius:6px;object-fit:contain;display:block;"></div>';
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
      var banStatusCheck = getDreamBanStatus(isGroup ? m.senderId : state.currentChatId);
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
          var _banCheck = getDreamBanStatus(isGroup ? m.senderId : state.currentChatId, m.time);
      if (_banCheck === 'banned') {
        html += '<div class="chat-bubble bubble-dream ' + styleClass + '" style="' + dreamBg + textColor + 'opacity:0.6;font-style:italic;">此账号已被封禁</div>';
      } else if (_banCheck === 'apologizing') {
        if (!m._apologyText) {
          m._apologyText = pickApology();
        }
        html += '<div class="chat-bubble bubble-dream ' + styleClass + '" style="' + dreamBg + textColor + '">';
        if (imgSrc) {
          html += '<div style="font-size:11px;opacity:0.7;padding:4px 8px;margin-bottom:4px;background:rgba(0,0,0,0.06);border-left:2px solid #999;border-radius:4px;">[表情]</div>';
        } else {
          html += '<div style="font-size:11px;opacity:0.7;padding:4px 8px;margin-bottom:4px;background:rgba(0,0,0,0.06);border-left:2px solid #999;border-radius:4px;">' + m.text + '</div>';
        }
        html += m._apologyText;
        html += '</div>';
      } else if (imgSrc) {
        html += '<div class="chat-bubble bubble-dream ' + styleClass + '" style="' + dreamBg + textColor + 'padding:4px;"><img src="' + imgSrc + '" style="max-width:120px;max-height:180px;border-radius:6px;object-fit:contain;display:block;"></div>';
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
             <span class="chat-list-name">${d.name}${d.currentStatus ? '<span style="font-size:11px;color:var(--gray);font-weight:400;margin-left:6px;">' + d.currentStatus + '</span>' : ''}${state.mutedChats && state.mutedChats.indexOf(d.id) === -1 && state.chatSessions[d.id] && state.chatSessions[d.id].some(function(x){return x.from==='dream' && x.time > (state.lastReadAt && state.lastReadAt[d.id] || 0)}) ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-left:6px;vertical-align:middle;"></span>' : ''}</span>
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
      document.getElementById('chatHeaderName').textContent = d.name + (d.currentStatus ? ' · ' + d.currentStatus : '');
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

  // 【已读不回】：开启后，10% 概率不回
  if (state.settings && state.settings.readNoReply) {
    if (Math.random() < 0.1) {
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

// ===== 长按消息菜单（事件委托版，修复红包/礼物卡片无法删除） =====
var pressTimer = null;
var pressTarget = null;
var pressStartX = 0;
var pressStartY = 0;
var pressTriggered = false;

// 长按触发后，拦截下一次 click（防止打开红包/礼物详情把菜单盖掉）
(function initClickSuppress() {
  if (window._clickSuppressBound) return;
  window._clickSuppressBound = true;
  window._suppressNextClick = false;
  document.addEventListener('click', function(e) {
    if (window._suppressNextClick) {
      e.preventDefault();
      e.stopPropagation();
      window._suppressNextClick = false;
    }
  }, true);
})();

function attachLongPress() {
  var container = document.getElementById('chatMessages');
  if (!container) return;
  if (container._msgPressBound) return;
  container._msgPressBound = true;

  function findMsgEl(el) {
    while (el && el !== container) {
      if (el.dataset && el.dataset.msgIndex !== undefined) return el;
      el = el.parentNode;
    }
    return null;
  }

  function onStart(e, el) {
    if (!el) return;
    var t = e.touches && e.touches[0] ? e.touches[0] : e;
    pressStartX = t.clientX;
    pressStartY = t.clientY;
    pressTarget = el;
    pressTriggered = false;

    clearTimeout(pressTimer);
    pressTimer = setTimeout(function() {
      if (!pressTarget) return;
      pressTriggered = true;
      var idx = parseInt(pressTarget.dataset.msgIndex);
      showMsgMenu(idx, pressTarget);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }

  function onMove(e) {
    if (!pressTarget) return;
    var t = e.touches && e.touches[0] ? e.touches[0] : e;
    var dx = t.clientX - pressStartX;
    var dy = t.clientY - pressStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearTimeout(pressTimer);
      pressTarget = null;
    }
  }

  function onEnd(e) {
    clearTimeout(pressTimer);
    if (pressTriggered) {
      window._suppressNextClick = true;
      setTimeout(function() { window._suppressNextClick = false; }, 300);
    }
    pressTarget = null;
    pressTriggered = false;
  }

  container.addEventListener('touchstart', function(e) {
    var el = findMsgEl(e.target);
    if (el) onStart(e, el);
  }, { passive: true });

  container.addEventListener('touchmove', onMove, { passive: true });

  container.addEventListener('touchend', function(e) {
    if (!pressTarget && !pressTriggered) return;
    onEnd(e);
  });

  container.addEventListener('touchcancel', function(e) {
    clearTimeout(pressTimer);
    pressTarget = null;
    pressTriggered = false;
  });

  container.addEventListener('mousedown', function(e) {
    var el = findMsgEl(e.target);
    if (el) onStart(e, el);
  });

  container.addEventListener('mousemove', onMove);

  container.addEventListener('mouseup', function(e) {
    if (!pressTarget && !pressTriggered) return;
    onEnd(e);
  });
}

// 消息文本兜底（让红包/礼物卡片也能被引用、收藏）
function getMsgDisplayText(m) {
  if (!m) return '消息';
  if (m.type === 'redpacket') return '🧧 红包';
  if (m.type === 'gift') return '🎁 礼物';
  if (m.type === 'forward') return '📋 聊天记录';
  if (m.type === 'image') return '[图片]';
  if (m.text) return m.text;
  return '[表情]';
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
        var _dispTxt = getMsgDisplayText(m);
    window.quoteData = { text: _dispTxt, senderName: senderName, msgId: index };
    document.getElementById('quotePreview').style.display = 'block';
    document.getElementById('quoteText').textContent = senderName + '：' + _dispTxt;
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
      text: getMsgDisplayText(m),
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
    // ===== 拼接字卡设置 =====
  var joinToggle = document.getElementById('cardJoinToggle');
  var joinMin = document.getElementById('cardJoinMin');
  var joinMax = document.getElementById('cardJoinMax');
  if (joinToggle) {
    if (!state.settings) state.settings = {};
    joinToggle.classList.toggle('on', !!state.settings.cardJoinEnabled);
    joinToggle.onclick = function() {
      state.settings.cardJoinEnabled = !state.settings.cardJoinEnabled;
      joinToggle.classList.toggle('on', state.settings.cardJoinEnabled);
      saveState();
      showToast(state.settings.cardJoinEnabled ? '已开启拼接字卡' : '已关闭拼接字卡');
    };
  }
  if (joinMin) {
    joinMin.value = state.settings.cardJoinMin != null ? state.settings.cardJoinMin : 1;
    joinMin.onchange = function() {
      var v = Math.max(1, Math.min(7, parseInt(this.value) || 1));
      state.settings.cardJoinMin = v;
      this.value = v;
      saveState();
    };
  }
  if (joinMax) {
    joinMax.value = state.settings.cardJoinMax != null ? state.settings.cardJoinMax : 3;
    joinMax.onchange = function() {
      var v = Math.max(1, Math.min(7, parseInt(this.value) || 3));
      state.settings.cardJoinMax = v;
      this.value = v;
      saveState();
    };
  }

  // 梦角主动引用开关
  var quoteToggle = document.getElementById('dreamQuoteToggle');
  if (quoteToggle) {
    if (!state.settings) state.settings = {};
    var quoteOn = state.settings.dreamQuoteEnabled !== false;
    quoteToggle.classList.toggle('on', quoteOn);
    quoteToggle.onclick = function() {
      state.settings.dreamQuoteEnabled = !(state.settings.dreamQuoteEnabled !== false);
      quoteToggle.classList.toggle('on', state.settings.dreamQuoteEnabled !== false);
      saveState();
      showToast(state.settings.dreamQuoteEnabled !== false ? '已开启梦角引用' : '已关闭梦角引用');
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

// ===== 通话系统（完整版） =====

function getDreamName(id) {
  if (id === 'user') return state.profile.name || '我';
  var d = state.dreams.find(function(x) { return x.id === id; });
  return d ? d.name : '未知';
}

function addSystemMessage(chatId, text) {
  if (!chatId) return;
  if (!state.chatSessions[chatId]) state.chatSessions[chatId] = [];
  state.chatSessions[chatId].push({ from: 'system', text: text, time: Date.now() });
  saveState();
  if (state.currentChatId === chatId) {
    loadChatMessages();
    // 刷新横条 + 聊天
    try { renderChat(); } catch(e) { renderChatMessages(); }
  }
  renderChatList();
}

function isDreamBusy(dreamId) {
  if (!state.activeCalls) return false;
  for (var i = 0; i < state.activeCalls.length; i++) {
    if (state.activeCalls[i].participants.indexOf(dreamId) > -1) return true;
  }
  return false;
}

function openCallPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  if (isGroup) {
    var g = state.groups.find(function(item) { return item.id === state.currentChatId; });
    if (!g || g.memberIds.length === 0) { showToast('群成员为空'); return; }
        var list = document.getElementById('callSelectList');
    // 【核心修复】：每次打开选择面板，先清空所有勾选
    list.innerHTML = '';
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
  startUserDial([state.currentChatId], false);
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
  startUserDial(ids, true);
}

function startUserDial(targetIds, isGroup) {
  if (state.callState !== 'idle') { showToast('正在通话中'); return; }
  if (!targetIds || targetIds.length === 0) { showToast('未选择通话对象'); return; }

  // 检查忙线
  var busy = targetIds.filter(function(id) { return isDreamBusy(id); });
  if (busy.length > 0) {
    var names = busy.map(getDreamName).join('、');
    addSystemMessage(state.currentChatId, names + ' 正忙，请稍候再试');
    showToast(names + ' 正忙');
    return;
  }

  var session = {
    id: 'call_' + Date.now(),
    chatId: state.currentChatId,
    type: isGroup ? 'group' : 'private',
    initiator: 'user',
    participants: ['user'],   // 只有用户先在里面
    invited: targetIds.slice(), // 邀请的人
    startTime: null,
    status: 'dialing',
    userInCall: true
  };
  state.activeCalls.push(session);
  state.callSession = session;
  state.callState = 'dialing';
  renderCallUI();

  var connectedOnce = false;
  var pendingCount = targetIds.length;

  function checkAllDone() {
    // 所有人都处理完了，且一个都没接，就结束通话
    if (pendingCount === 0 && session.participants.length <= 1 && !session.startTime) {
      endCallSession('对方已拒绝');
    }
  }

  // 给每个人独立抽签
  targetIds.forEach(function(id) {
    var roll = Math.random();

    if (roll < 0.65) {
      // ===== 接听 =====
      var delay = 1000 + Math.random() * 2500;
      setTimeout(function() {
        if (state.activeCalls.indexOf(session) === -1) return;
        if (session.invited.indexOf(id) === -1) return; // 已被处理过
        session.invited.splice(session.invited.indexOf(id), 1);
        session.participants.push(id);
        addSystemMessage(session.chatId, '「' + getDreamName(id) + '」加入了通话');

        // 第一个人接了，正式开始计时
        if (!session.startTime) {
          session.startTime = Date.now();
          session.status = 'connected';
          state.callState = 'connected';
          startCallTimer();
          connectedOnce = true;
        }
        renderCallUI();
        pendingCount--;
        checkAllDone();
      }, delay);

    } else if (roll < 0.85) {
      // ===== 拒绝 =====
      var delay2 = 1000 + Math.random() * 2000;
      setTimeout(function() {
        if (state.activeCalls.indexOf(session) === -1) return;
        if (session.invited.indexOf(id) === -1) return;
        session.invited.splice(session.invited.indexOf(id), 1);
        addSystemMessage(session.chatId, '「' + getDreamName(id) + '」拒绝了通话');
        renderCallUI();
        pendingCount--;
        checkAllDone();
      }, delay2);

    } else {
      // ===== 超时 =====
      setTimeout(function() {
        if (state.activeCalls.indexOf(session) === -1) return;
        if (session.invited.indexOf(id) === -1) return;
        session.invited.splice(session.invited.indexOf(id), 1);
        addSystemMessage(session.chatId, '「' + getDreamName(id) + '」无应答');
        renderCallUI();
        pendingCount--;
        checkAllDone();
      }, 15000);
    }
  });
}

function endCallSession(reason) {
  if (!state.callSession) return;
  var session = state.callSession;
  var duration = 0;
  if (session.startTime) duration = Math.floor((Date.now() - session.startTime) / 1000);
  var idx = state.activeCalls.indexOf(session);
  if (idx > -1) state.activeCalls.splice(idx, 1);
  var msg = session.startTime ? '通话结束，时长 ' + formatDuration(duration).slice(3) : (reason || '通话已取消');
  addSystemMessage(session.chatId, msg);
  state.callSession = null;
  state.callState = 'idle';
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = null;
  document.getElementById('callOverlay').classList.remove('active');
  document.getElementById('callMini').classList.remove('show');
  saveState();
  renderCallUI();
}

function hangupCall() {
    // 清理通话界面残留的多人头像
  try {
    var cardEl = document.getElementById('callCard');
    if (cardEl) {
      var olds = cardEl.querySelectorAll('.multi-avatars');
      for (var i = 0; i < olds.length; i++) olds[i].remove();
      var oa = cardEl.querySelector('.call-avatar');
      if (oa) oa.style.display = '';
    }
  } catch(e) {}
  
  // ===== 第一步：无论如何，先强制关闭界面，防止用户卡死 =====
  try {
    var ov = document.getElementById('callOverlay');
    if (ov) ov.classList.remove('active');
    var mini = document.getElementById('callMini');
    if (mini) mini.classList.remove('show');
  } catch(e) {}
  if (state.callTimerInterval) { clearInterval(state.callTimerInterval); state.callTimerInterval = null; }

  // ===== 第二步：确定要写消息的聊天窗口，和通话开始时间 =====
  var chatId = null;
  var startTime = null;

  if (state.callSession) {
    chatId = state.callSession.chatId;
    startTime = state.callSession.startTime;
    // 从 activeCalls 里移除（防御式，检查字段是否存在）
    if (state.activeCalls && Array.isArray(state.activeCalls)) {
      var i = state.activeCalls.indexOf(state.callSession);
      if (i > -1) state.activeCalls.splice(i, 1);
    }
    state.callSession = null;
  } else if (state.currentChatId) {
    chatId = state.currentChatId;
    startTime = state.callStartTime;
  }

  // ===== 第三步：往聊天界面写入系统小字 =====
  var msg = '';
  if (startTime) {
    var dur = Math.floor((Date.now() - startTime) / 1000);
    msg = '通话结束，时长 ' + formatDuration(dur).slice(3);
  } else {
    msg = '已挂断';
  }

  if (chatId) {
    if (!state.chatSessions[chatId]) state.chatSessions[chatId] = [];
    state.chatSessions[chatId].push({ from: 'system', text: msg, time: Date.now() });
    if (state.currentChatId === chatId) {
      try { loadChatMessages(); renderChatMessages(); } catch(e) {}
    }
  }

  // ===== 第四步：清空状态 =====
  state.callState = 'idle';
  state.callStartTime = null;
  state.callElapsed = 0;
  try { saveState(); } catch(e) {}

  // ===== 调试信息：按 F12 能在控制台看到，方便定位问题 =====
  console.log('[hangupCall] 已执行，chatId =', chatId, '，msg =', msg);
}

function startCallTimer() {
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(function() {
    if (!state.callSession || !state.callSession.startTime) return;
    var elapsed = Math.floor((Date.now() - state.callSession.startTime) / 1000);
    var el = document.getElementById('callTimer');
    if (el) el.textContent = formatDuration(elapsed);
    var mini = document.getElementById('miniTime');
    if (mini) mini.textContent = formatDuration(elapsed).slice(0, 5);
  }, 1000);
}

function renderCallUI() {
  var overlay = document.getElementById('callOverlay');
  var card = document.getElementById('callCard');
  if (!overlay || !card) return;

  if (!state.callSession) {
    overlay.classList.remove('active');
    var olds0 = card.querySelectorAll('.multi-avatars');
    for (var i0 = 0; i0 < olds0.length; i0++) olds0[i0].remove();
    var oa0 = card.querySelector('.call-avatar');
    if (oa0) oa0.style.display = '';
    return;
  }

  var session = state.callSession;
  // 【修复1】严格过滤掉一切不是真实梦角的空数据
  var participants = session.participants.filter(function(id) {
    return id && id !== 'user' && id !== 'undefined' && id !== 'null';
  });

  var olds = card.querySelectorAll('.multi-avatars');
  for (var i = 0; i < olds.length; i++) olds[i].remove();

  var avatarsHtml = '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">';
  var showList = participants.length > 0 ? participants : (session.invited || []);
  showList = showList.filter(function(id){ return id && id !== 'user' && id !== 'undefined' && id !== 'null'; });
  showList.forEach(function(id) {
    var av = getDreamAvatar(id);
    avatarsHtml += '<div style="text-align:center;"><img src="' + av + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);"><div style="font-size:11px;color:#fff;margin-top:4px;">' + getDreamName(id) + '</div></div>';
  });
  avatarsHtml += '</div>';

  var div = document.createElement('div');
  div.className = 'multi-avatars';
  div.innerHTML = avatarsHtml;
  var originalAvatar = card.querySelector('.call-avatar');
  if (originalAvatar) originalAvatar.style.display = 'none';
  card.insertBefore(div, card.firstChild);

  // 【修复2】动态更新中间的名字，干掉“沈屿”
  var callNameEl = document.getElementById('callName');
  if (callNameEl) {
    if (participants.length === 0) {
      if (session.invited && session.invited.length > 0) {
        var names = session.invited.map(getDreamName).join('、');
        callNameEl.textContent = '正在呼叫 ' + names;
      } else {
        callNameEl.textContent = '正在呼叫…';
      }
    } else if (participants.length === 1) {
      callNameEl.textContent = getDreamName(participants[0]);
    } else {
      callNameEl.textContent = '多人通话';
    }
  }

  var statusEl = document.getElementById('callStatus');
  if (statusEl) {
    if (session.status === 'dialing') statusEl.textContent = '正在呼叫…';
    else if (session.status === 'ringing') statusEl.textContent = '来电中…';
    else if (session.status === 'connected') statusEl.textContent = '通话中';
    else statusEl.textContent = '';
  }

  var timerEl = document.getElementById('callTimer');
  if (timerEl) {
    if (session.status === 'connected') timerEl.classList.add('show');
    else timerEl.classList.remove('show');
  }

  var btns = document.getElementById('callButtons');
  if (btns) {
    if (session.status === 'dialing') {
      btns.innerHTML = '<button class="call-btn hangup" onclick="cancelDial()">☎</button>';
    } else if (session.status === 'ringing') {
      btns.innerHTML = '<button class="call-btn hangup" onclick="hangupCall()">☎</button><button class="call-btn answer" onclick="answerCall()">📞</button>';
    } else {
      btns.innerHTML = '<button class="call-btn minimize" onclick="minimizeCall()">−</button><button class="call-btn hangup" onclick="hangupCall()">☎</button>';
    }
  }

  var bg = state.settings && state.settings.callBg;
  if (bg) card.style.background = 'url(' + bg + ') center/cover, linear-gradient(145deg,#1a1a2e,#16213e)';
  else card.style.background = 'linear-gradient(145deg,#1a1a2e,#16213e)';

  overlay.classList.add('active');
}

function getDreamAvatar(id) {
  var d = state.dreams.find(function(x) { return x.id === id; });
  if (d && d.avatar) return d.avatar;
  return 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2750%27 height=%2750%27 viewBox=%270 0 50 50%27%3E%3Ccircle cx=%2725%27 cy=%2725%27 r=%2725%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2725%27 y=%2730%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2720%27%3E💜%3C/text%3E%3C/svg%3E';
}

function cancelDial() {
  if (!state.callSession || state.callSession.status !== 'dialing') return;
  endCallSession('已取消');
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
    if (now - lastAt >= threshold) candidates.push(d);
  });
  if (candidates.length === 0) return;

  // 10% 概率真的发，避免太机械
  if (Math.random() > 0.1) return;

  var picked = candidates[Math.floor(Math.random() * candidates.length)];
    var usableCards = getUsableCards();
  var card = usableCards.length > 0
    ? usableCards[Math.floor(Math.random() * usableCards.length)]
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
        <div style="font-size:11px;color:#576b95;margin-bottom:4px;">由 ${fav.favBy || (fav.isUser ? '我' : '梦角')} 收藏</div>
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
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--gray);font-size:14px;">还没有日记，点右上角 ✎ 写下第一篇吧</div>';
    return;
  }

  var sorted = state.diaries.slice().sort(function(a, b) { return b.time - a.time; });

  container.innerHTML = sorted.map(function(d) {
    var t = new Date(d.time);
    var timeStr = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    var dateStr = (t.getMonth() + 1) + '月' + t.getDate() + '日';
    var avatar = d.authorAvatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2744%27 height=%2744%27 viewBox=%270 0 44 44%27%3E%3Ccircle cx=%2722%27 cy=%2722%27 r=%2722%27 fill=%27%23ffe0e8%27/%3E%3Ctext x=%2722%27 y=%2727%27 text-anchor=%27middle%27 fill=%27%23d6336c%27 font-size=%2718%27%3E💜%3C/text%3E%3C/svg%3E';

    var commentsHtml = '';
    if (d.comments && d.comments.length > 0) {
      commentsHtml = '<div class="diary-item-comments">';
      d.comments.forEach(function(c) {
        var cAvatar = c.authorAvatar || avatar;
        var canReply = (c.authorId !== 'user');
        var clickAttr = canReply
          ? ' onclick="replyToDiaryComment(\'' + d.id + '\', \'' + c.id + '\')" style="cursor:pointer;"'
          : '';
        commentsHtml += '<div class="diary-comment-item"' + clickAttr + '>';
        commentsHtml += '<img class="diary-comment-item-avatar" src="' + cAvatar + '">';
        commentsHtml += '<div style="flex:1;font-size:13px;line-height:1.5;word-break:break-word;">';
        commentsHtml += '<span style="font-weight:600;color:#576b95;">' + c.authorName + '</span>';
        if (c.replyToName) commentsHtml += '<span style="color:var(--gray);"> 回复 </span><span style="font-weight:600;color:#576b95;">' + c.replyToName + '</span>';
        commentsHtml += '<span style="color:var(--text);margin-left:4px;">：' + c.text + '</span>';
        commentsHtml += '</div></div>';
      });
      commentsHtml += '</div>';
    }

    return '<div class="diary-item">' +
      '<img class="diary-item-avatar" src="' + avatar + '">' +
      '<div class="diary-item-body">' +
        '<div class="diary-item-name">' + d.authorName + '</div>' +
        '<div class="diary-item-content">' + d.text + '</div>' +
        '<div class="diary-item-tags">' +
          '<span>🌤 ' + d.weather + '</span>' +
          '<span>💭 ' + d.mood + '</span>' +
        '</div>' +
        '<div class="diary-item-foot">' +
          '<span class="diary-item-time">' + dateStr + ' ' + timeStr + '</span>' +
          '<span class="diary-item-del" onclick="deleteDiary(\'' + d.id + '\')">删除</span>' +
        '</div>' +
        '<div style="margin-top:8px;">' +
          '<span class="diary-comment-btn" onclick="openDiaryComment(\'' + d.id + '\')">💬 评论</span>' +
        '</div>' +
        commentsHtml +
      '</div>' +
    '</div>';
  }).join('');
}

// ===== 日记封面 =====
function renderDiaryCover() {
  if (!state.settings) state.settings = {};
  var cover = document.getElementById('diaryCover');
  if (!cover) return;
  if (state.settings.diaryCover) {
    cover.style.background = 'url("' + state.settings.diaryCover + '") center/cover no-repeat';
  } else {
    cover.style.background = 'linear-gradient(135deg, #a8c8e0, #7ec8e3)';
  }

  var nameEl = document.getElementById('diaryCoverName');
  var statusEl = document.getElementById('diaryCoverStatus');
  var avatarEl = document.getElementById('diaryCoverAvatar');
  if (nameEl) nameEl.textContent = state.profile.name || '我';
  if (statusEl) statusEl.textContent = state.profile.status || '';
  if (avatarEl) {
    avatarEl.src = state.profile.avatar || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2776%27 height=%2776%27 viewBox=%270 0 76 76%27%3E%3Crect width=%2776%27 height=%2776%27 rx=%2712%27 fill=%27%23e8e8ed%27/%3E%3Ctext x=%2738%27 y=%2744%27 text-anchor=%27middle%27 fill=%27%2386868b%27 font-size=%2728%27%3E👤%3C/text%3E%3C/svg%3E';
  }
}

function changeDiaryCover() {
  var input = document.getElementById('diaryCoverInput');
  if (input) input.click();
}

function handleDiaryCover(e) {
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
      var compressed = canvas.toDataURL('image/jpeg', 0.75);
      if (!state.settings) state.settings = {};
      state.settings.diaryCover = compressed;
      saveState();
      renderDiaryCover();
      showToast('封面已更新');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function deleteDiary(id) {
  if (!confirm('确定删除这篇日记吗？此操作不可恢复！')) return;
  state.diaries = state.diaries.filter(function(d) { return d.id !== id; });
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
    // 检查今天真实写了几篇，限制最多 2 篇
var todayCount = state.diaries.filter(function(diary) {
  if (diary.authorId !== d.id) return false;
  // 【核心修复】：从日记 ID 中提取真实的生成时间戳 (格式: diary_时间戳_随机数)
  var createdTs = parseInt((diary.id || '').split('_')[1]);
  if (!createdTs || isNaN(createdTs)) {
    createdTs = diary.time || Date.now(); // 兼容以前的老日记
  }
  var diaryDate = new Date(createdTs).toISOString().slice(0, 10);
  return diaryDate === today;
}).length;
if (todayCount >= 2) return;

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

// 点击梦角评论 → 回复
function replyToDiaryComment(diaryId, commentId) {
  var diary = state.diaries.find(function(d) { return d.id === diaryId; });
  if (!diary || !diary.comments) return;
  var target = diary.comments.find(function(c) { return c.id === commentId; });
  if (!target) return;

  var text = prompt('回复 ' + target.authorName + '：');
  if (!text || !text.trim()) return;

  diary.comments.push({
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    authorId: 'user',
    authorName: state.profile.name || '我',
    authorAvatar: state.profile.avatar || '',
    text: text.trim(),
    time: Date.now(),
    replyTo: target.id,
    replyToName: target.authorName
  });
  saveState();
  renderDiaryList();
  showToast('回复已发布');

  // 触发梦角回应（延迟 2-5 秒）
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

  // 【核心修复】：限制每个梦角在这篇日记下的总评论数（含回复）最多 3 条
if (!diary.comments) diary.comments = [];
var myTotalComments = diary.comments.filter(function(c) {
  return c.authorId === dream.id;
}).length;
if (myTotalComments >= 3) return;
  
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
      if (m.delivered) statusHtml = '<span style="font-size:11px;color:var(--green);">已送达</span>';
      else {
        var left = Math.max(0, m.deliverAt - Date.now());
        var hLeft = Math.floor(left / 3600000);
        var mLeft = Math.floor((left % 3600000) / 60000);
        statusHtml = '<span style="font-size:11px;color:var(--gray);">运送中 · 剩 ' + hLeft + 'h' + mLeft + 'm</span>';
      }
    } else {
      if (!m.read) {
        dotHtml = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;margin-right:6px;vertical-align:middle;"></span>';
      }
    }

    var whoText = m.from === 'user' ? ('寄给 ' + m.toName) : ('来自 ' + m.fromName);
if (m.isAutoLetter) whoText += ' <span style="font-size:10px;color:#ff9500;background:rgba(255,149,0,0.1);padding:1px 4px;border-radius:4px;margin-left:4px;font-weight:400;">主动来信</span>';
    var preview = m.content.replace(/\n/g, ' ').slice(0, 30);

    return '<div onclick="openLetterDetail(\'' + m.id + '\')" style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--card);cursor:pointer;position:relative;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:14px;font-weight:600;color:var(--text);">' + dotHtml + whoText + '</span>' +
        '<div style="display:flex;align-items:center;">' +
          statusHtml +
          '<span onclick="event.stopPropagation();deleteMail(\'' + m.id + '\')" style="font-size:12px;color:var(--red);cursor:pointer;padding:4px 8px;margin-left:8px;border-radius:8px;background:rgba(255,59,48,0.1);user-select:none;">🗑 删除</span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + preview + '</div>' +
      '<div style="font-size:11px;color:#bbb;margin-top:4px;">' + timeStr + '</div>' +
    '</div>';
  }).join('');
}

function deleteMail(id) {
  if (!confirm('确定删除这封信吗？此操作不可恢复！')) return;
  state.mails = state.mails.filter(function(m) { return m.id !== id; });
  saveState();
  renderMailList();
  showToast('信件已删除');
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
if (m.isAutoLetter) document.getElementById('letterDetailTitle').textContent += ' · 主动来信';
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

function checkAutoLetter() {
  if (!state.dreams || state.dreams.length === 0) return;
  if (!state.cards || state.cards.length === 0) return;
  if (!state.mails) state.mails = [];

  // 4.5% 概率触发，想调大就改这里：0.0001 = 0.01%，0.01 = 1%，0.001 = 0.1%
  if (Math.random() > 0.045) return;

  // 随机挑一个梦角
  var dream = state.dreams[Math.floor(Math.random() * state.dreams.length)];

  // 从字卡库随机挑 8-15 条，组合成一封信
  var count = 8 + Math.floor(Math.random() * 8);
  var shuffled = state.cards.slice().sort(function() { return Math.random() - 0.5; });
  var picked = shuffled.slice(0, Math.min(count, shuffled.length));
  var content = picked.map(function(c) { return c.text; }).join('\n');

  // 创建信件（立即送达）
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
    isReply: false,
    isAutoLetter: true
  });

  saveState();

  // 如果你正在信箱页面，实时刷新列表
  var mailboxPage = document.getElementById('pageMailbox');
  if (mailboxPage && mailboxPage.classList.contains('active')) {
    renderMailList();
  }

  // 弹通知
  sendNotification(dream.name, '给你写了一封信');
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

// ===== 主屏幕图标拖拽（事件委托重写版） =====
window.appEditMode = false;
var appDragState = null;
var appPressTimer = null;
var appPressStartX = 0;
var appPressStartY = 0;
var appPressTarget = null;
var appDragGhost = null;

function enterAppEditMode() {
  if (window.appEditMode) return;
  window.appEditMode = true;
  document.querySelectorAll('.app-grid').forEach(function(g) { g.classList.add('editing'); });
  if (navigator.vibrate) navigator.vibrate(20);
}

function exitAppEditMode() {
  if (!window.appEditMode) return;
  window.appEditMode = false;
  document.querySelectorAll('.app-grid').forEach(function(g) { g.classList.remove('editing'); });
  saveState();
}

function getPageFromPoint(clientX, clientY) {
  var container = document.getElementById('homeSwiper');
  if (!container) return null;
  var rect = container.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;

  var pageW = container.offsetWidth || 390;
  var offsetX = clientX - rect.left + container.scrollLeft;
  var pageIdx = Math.floor(offsetX / pageW);
  if (pageIdx < 0) pageIdx = 0;
  if (pageIdx >= state.appPages.length) pageIdx = state.appPages.length - 1;

  var grid = container.querySelector('.app-grid[data-page-index="' + pageIdx + '"]');
  if (!grid) return null;

  var gridRect = grid.getBoundingClientRect();
  var padLeft = 16, padTop = 24, gapX = 12, gapY = 20;
  var cellW = (gridRect.width - padLeft * 2 - gapX * 3) / 4;
  var cellH = 82 + gapY;

  var col = Math.floor((clientX - gridRect.left - padLeft) / (cellW + gapX));
  var row = Math.floor((clientY - gridRect.top - padTop) / cellH);
  if (col < 0) col = 0; if (col > 3) col = 3;
  if (row < 0) row = 0; if (row > 5) row = 5;

  return { page: pageIdx, slot: row * 4 + col };
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
  if (fromPage === toPage && fromSlot === toSlot) return;
  var fromKey = findAppKey(fromPage, fromSlot);
  var toKey = findAppKey(toPage, toSlot);
  setAppKey(toPage, toSlot, fromKey);
  setAppKey(fromPage, fromSlot, toKey || null);
}

function createDragGhost(iconEl, cx, cy) {
  var rect = iconEl.getBoundingClientRect();
  var ghost = iconEl.cloneNode(true);
  ghost.classList.add('app-drag-ghost');
  ghost.classList.remove('dragging');
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost._offsetX = cx - rect.left;
  ghost._offsetY = cy - rect.top;
  document.body.appendChild(ghost);
  return ghost;
}

function onIconPressStart(e, iconEl) {
  if (!iconEl || !iconEl.dataset.appKey) return;
  var touch = e.touches && e.touches[0] ? e.touches[0] : e;
  appPressStartX = touch.clientX;
  appPressStartY = touch.clientY;
  appPressTarget = iconEl;

  clearTimeout(appPressTimer);
  appPressTimer = setTimeout(function() {
    if (!appPressTarget) return;
    if (!window.appEditMode) enterAppEditMode();
    appDragGhost = createDragGhost(appPressTarget, appPressStartX, appPressStartY);
    appPressTarget.classList.add('dragging');
    appDragState = {
      fromPage: parseInt(appPressTarget.dataset.pageIndex),
      fromSlot: parseInt(appPressTarget.dataset.slotIndex),
      key: appPressTarget.dataset.appKey,
      iconEl: appPressTarget
    };
    if (navigator.vibrate) navigator.vibrate(30);
  }, 400);
}

function onIconPressMove(e) {
  if (!appPressTarget && !appDragState) return;
  var touch = e.touches && e.touches[0] ? e.touches[0] : e;

  if (!appDragState) {
    var dx = touch.clientX - appPressStartX;
    var dy = touch.clientY - appPressStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearTimeout(appPressTimer);
      appPressTarget = null;
    }
    return;
  }

  if (appDragGhost) {
    appDragGhost.style.left = (touch.clientX - appDragGhost._offsetX) + 'px';
    appDragGhost.style.top = (touch.clientY - appDragGhost._offsetY) + 'px';
  }

  var container = document.getElementById('homeSwiper');
  if (container) {
    var rect = container.getBoundingClientRect();
    if (touch.clientX < rect.left + 50) container.scrollLeft -= 10;
    else if (touch.clientX > rect.right - 50) container.scrollLeft += 10;
  }
  if (e.cancelable) e.preventDefault();
}

function onIconPressEnd(e) {
  clearTimeout(appPressTimer);

  if (!appDragState) { appPressTarget = null; return; }

  var touch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
  var target = getPageFromPoint(touch.clientX, touch.clientY);
  if (target) {
    swapAppKeys(appDragState.fromPage, appDragState.fromSlot, target.page, target.slot);
  }
  if (appDragGhost) { appDragGhost.remove(); appDragGhost = null; }
  if (appDragState.iconEl) appDragState.iconEl.classList.remove('dragging');
  appDragState = null;
  appPressTarget = null;

  renderAppIcons();
  if (window.appEditMode) {
    document.querySelectorAll('.app-grid').forEach(function(g) { g.classList.add('editing'); });
  }
}

// 全局事件委托——只绑一次，永不丢失
(function initAppDragListeners() {
  function findIcon(el) {
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('app-icon')) return el;
      el = el.parentNode;
    }
    return null;
  }

  document.addEventListener('touchstart', function(e) {
    var icon = findIcon(e.target);
    if (icon) onIconPressStart(e, icon);
  }, { passive: false, capture: true });

  document.addEventListener('touchmove', function(e) {
    if (!appPressTarget && !appDragState) return;
    onIconPressMove(e);
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (!appPressTarget && !appDragState) return;
    onIconPressEnd(e);
  });

  document.addEventListener('touchcancel', function(e) {
    if (!appPressTarget && !appDragState) return;
    onIconPressEnd(e);
  });

  document.addEventListener('mousedown', function(e) {
    var icon = findIcon(e.target);
    if (icon) onIconPressStart(e, icon);
  });

  document.addEventListener('mousemove', function(e) {
    if (!appPressTarget && !appDragState) return;
    onIconPressMove(e);
  });

  document.addEventListener('mouseup', function(e) {
    if (!appPressTarget && !appDragState) return;
    onIconPressEnd(e);
  });
})();

// 点击空白处退出编辑模式
document.addEventListener('click', function(e) {
  if (!window.appEditMode) return;
  if (appDragState) return;
  if (e.target.closest && e.target.closest('.app-icon')) return;
  var pageHome = document.getElementById('pageHome');
  if (!pageHome) return;
  if (pageHome.offsetParent === null) return;
  exitAppEditMode();
});

// 兼容旧调用（空的，因为现在用事件委托）
function bindAppDrag() {}

// 点击空白退出编辑模式
document.addEventListener('click', function(e) {
  if (!window.appEditMode) return;
  if (appDragState) return;
  var home = document.getElementById('pageHome');
  if (!home || home.style.display === 'none') return;
  if (e.target.closest('.app-icon')) return;
  exitAppEditMode();
});

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

// ===== 覆盖 AI 群主行为：只增加禁言用户，不踢人 =====
var originalAiGroupOwnerAction = aiGroupOwnerAction;
aiGroupOwnerAction = function(g) {
  var owner = state.dreams.find(function(d) { return d.id === g.ownerId; });
  if (!owner) return;

  // 新增：AI群主有 20% 的概率禁言用户
  if (g.ownerId !== 'user' && Math.random() < 0.2) {
    if (!g.muteEndsAt) g.muteEndsAt = {};
    if (g.muteEndsAt['user'] === undefined) {
      var mins = [5, 10, 15][Math.floor(Math.random() * 3)];
      g.muteEndsAt['user'] = Date.now() + mins * 60000;
      var sysText = '群主「' + owner.name + '」禁言了你 ' + mins + ' 分钟';
      if (!state.chatSessions[g.id]) state.chatSessions[g.id] = [];
      state.chatSessions[g.id].push({ from: 'system', text: sysText, time: Date.now() });
      saveState();
      if (state.currentChatId === g.id) {
        loadChatMessages();
        renderChatMessages();
      }
      showToast(sysText);
      return; // 禁言完成后直接返回，不执行后面的踢人/转让逻辑
    }
  }

  // 如果没有触发禁言，就调用原有的逻辑（保证以前的功能不丢失）
  originalAiGroupOwnerAction(g);
};

function joinActiveCall(sessionId) {
  if (!state.activeCalls) return;
  var session = state.activeCalls.find(function(c) { return c.id === sessionId; });
  if (!session) { showToast('该通话已结束'); renderChatMessages(); return; }
  if (session.participants.indexOf('user') > -1) { showToast('你已经在这个通话里了'); return; }
  if (state.callState !== 'idle') { showToast('你正在其他通话中，无法加入'); return; }

  session.participants.push('user');
  session.userInCall = true;
  state.callSession = session;
  state.callState = session.startTime ? 'connected' : 'dialing';

  addSystemMessage(session.chatId, '「' + (state.profile.name || '我') + '」加入了通话');
  saveState();

  if (session.startTime) {
    startCallTimer();
    document.getElementById('callOverlay').classList.add('active');
  }
  renderCallUI();
}

// ===== AI 通话模拟：AI 之间互相加入/退出，偶尔邀请用户 =====
function startAICallSimulation(session, group) {
  function getAIParticipants() {
    return session.participants.filter(function(id) { return String(id) !== 'user'; });
  }

  function tick() {
    if (state.activeCalls.indexOf(session) === -1) return;
    var aiParts = getAIParticipants();

    // 【修复2】如果 AI 都退出了，只剩下用户，自动帮用户挂断
    if (aiParts.length === 0 && session.participants.indexOf('user') > -1) {
      addSystemMessage(group.id, '其他成员已全部退出，通话结束');
      if (state.callSession && state.callSession.id === session.id) {
        state.callSession = null;
        state.callState = 'idle';
        document.getElementById('callOverlay').classList.remove('active');
        if (state.callTimerInterval) { clearInterval(state.callTimerInterval); state.callTimerInterval = null; }
        renderCallUI();
      }
      endAICall(session, group);
      return;
    }

    if (session.participants.length < 2 && session.participants.indexOf('user') === -1) {
      endAICall(session, group); return;
    }

    var roll = Math.random();

    // 30% 一个 AI 退出
    if (roll < 0.30 && aiParts.length > 0) {
      var leaver = aiParts[Math.floor(Math.random() * aiParts.length)];
      var li = session.participants.indexOf(leaver);
      if (li > -1) session.participants.splice(li, 1);
      addSystemMessage(group.id, '「' + getDreamName(leaver) + '」退出了通话');
      
      // 【修复3】AI 退出时，如果用户在看通话界面，立刻刷新让头像消失
      if (state.callSession && state.callSession.id === session.id) {
        renderCallUI();
      }
    }
    // 25% 一个不在通话里的 AI 加入
    else if (roll < 0.55) {
      var notInCall = group.memberIds.filter(function(id) {
        return String(id) !== 'user' && session.participants.indexOf(id) === -1;
      });
      if (notInCall.length > 0) {
        var joiner = notInCall[Math.floor(Math.random() * notInCall.length)];
        session.participants.push(joiner);
        addSystemMessage(group.id, '「' + getDreamName(joiner) + '」加入了通话');
        if (state.callSession && state.callSession.id === session.id) {
          renderCallUI();
        }
      }
    }
    // 15% AI 邀请用户加入
    else if (roll < 0.70) {
      if (session.participants.indexOf('user') === -1 && aiParts.length > 0 && !session.userInvited) {
        var inviter = aiParts[Math.floor(Math.random() * aiParts.length)];
        if (state.callState === 'idle') {
          session.userInvited = true;
          if (!session.invited) session.invited = [];
          if (session.invited.indexOf('user') === -1) session.invited.push('user');
          addSystemMessage(group.id, '「' + getDreamName(inviter) + '」邀请你加入通话');
          setTimeout(function() {
            var userConfirmed = confirm('「' + getDreamName(inviter) + '」邀请你加入通话，是否加入？');
            if (userConfirmed) {
              joinActiveCall(session.id);
            } else {
              var ui = session.invited.indexOf('user');
              if (ui > -1) session.invited.splice(ui, 1);
              addSystemMessage(group.id, '你拒绝了通话邀请');
              saveState();
            }
          }, 100);
        }
      }
    }

    saveState();
    setTimeout(tick, 8000 + Math.random() * 10000);
  }

  setTimeout(tick, 8000 + Math.random() * 7000);
}

function endAICall(session, group) {
  var idx = state.activeCalls.indexOf(session);
  if (idx === -1) return;
  state.activeCalls.splice(idx, 1);
  var dur = 0;
  if (session.startTime) dur = Math.floor((Date.now() - session.startTime) / 1000);
  addSystemMessage(group.id, '通话结束，时长 ' + formatDuration(dur).slice(3));
  saveState();

  // 【核心修复】如果用户还在这个通话界面上，强行帮用户关掉！
  if (state.callSession && state.callSession.id === session.id) {
    state.callSession = null;
    state.callState = 'idle';
    if (state.callTimerInterval) { clearInterval(state.callTimerInterval); state.callTimerInterval = null; }
    var ov = document.getElementById('callOverlay');
    if (ov) ov.classList.remove('active');
    var mini = document.getElementById('callMini');
    if (mini) mini.classList.remove('show');
    renderCallUI();
  }
}

function joinActiveCallFromBanner() {
  if (!state.activeCalls || !state.currentChatId) return;
  var bannerCall = null;
  for (var i = 0; i < state.activeCalls.length; i++) {
    var c = state.activeCalls[i];
    if (c.chatId === state.currentChatId && c.participants.indexOf('user') === -1) {
      bannerCall = c; break;
    }
  }
  if (bannerCall) joinActiveCall(bannerCall.id);
}

// ===== 首次进入欢迎面板 =====
function showWelcomeIfFirstTime() {
  try {
    if (!localStorage.getItem('mind_welcome_shown')) {
      var el = document.getElementById('welcomeOverlay');
      if (el) el.style.display = 'flex';
    }
  } catch(e) {}
}

function closeWelcome() {
  var el = document.getElementById('welcomeOverlay');
  if (el) el.style.display = 'none';
  try { localStorage.setItem('mind_welcome_shown', '1'); } catch(e) {}
}

// 等页面加载后自动检查

// ===== 修复长按菜单：点遮罩关闭 =====
(function() {
  function bind() {
    var mask = document.getElementById('msgMenuMask');
    if (mask && !mask._bound) {
      mask._bound = true;
      mask.addEventListener('click', function() {
        hideMsgMenu();
      });
      mask.addEventListener('touchstart', function(e) {
        e.preventDefault();
        hideMsgMenu();
      }, { passive: false });
    }
  }
  bind();
  setTimeout(bind, 500);
})();

// ===== 表情包管理页面 =====
function renderStickerGroups() {
  var container = document.getElementById('stickerGroupsContainer');
  if (!container) return;
  var html = '';

  stickerGroups.forEach(function(g, idx) {
    var count = (g.items || []).length;
    var collapsed = g.collapsed || false;

    html += '<div class="sticker-group-card" style="background:var(--card);border-radius:14px;padding:14px 16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div onclick="toggleStickerGroupCollapse(\'' + g.id + '\')" style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">';
    html += '<span style="font-size:12px;color:var(--gray);transition:transform 0.2s;display:inline-block;' + (collapsed ? 'transform:rotate(-90deg);' : '') + '">▼</span>';
    html += '<span style="font-size:15px;font-weight:600;color:var(--text);">' + g.name + '（' + count + '）</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;">';
    html += '<span onclick="renameStickerGroup(\'' + g.id + '\')" style="cursor:pointer;font-size:14px;padding:2px 6px;">✎</span>';
    html += '<span onclick="moveStickerGroup(\'' + g.id + '\',-1)" style="cursor:pointer;font-size:14px;padding:2px 6px;">↑</span>';
    html += '<span onclick="moveStickerGroup(\'' + g.id + '\',1)" style="cursor:pointer;font-size:14px;padding:2px 6px;">↓</span>';
    html += '<span onclick="deleteStickerGroup(\'' + g.id + '\')" style="cursor:pointer;font-size:14px;padding:2px 6px;">🗑</span>';
    html += '</div>';
    html += '</div>';

    if (!collapsed) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:10px;">';
      (g.items || []).forEach(function(item, itemIdx) {
        html += '<div style="position:relative;width:60px;height:60px;flex-shrink:0;">';
        html += '<img src="' + item + '" style="width:60px;height:60px;max-width:60px;max-height:60px;border-radius:8px;object-fit:contain;display:block;background:#f0f0f5;">';
        html += '<span onclick="deleteStickerFromGroup(\'' + g.id + '\',' + itemIdx + ')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;font-size:14px;text-align:center;line-height:20px;cursor:pointer;z-index:10;">×</span>';
        html += '</div>';
      });
      html += '</div>';

      html += '<button onclick="addStickersToGroup(\'' + g.id + '\')" style="padding:8px 14px;border:1px dashed var(--border);border-radius:10px;background:transparent;color:var(--blue);font-size:13px;cursor:pointer;">+ 添加表情包（最多 20 个）</button>';
      html += '<input type="file" id="stickerFileInput_' + g.id + '" accept="image/*" multiple style="display:none" onchange="handleStickerGroupUpload(event,\'' + g.id + '\')">';
    }

    html += '</div>';
  });

  if (stickerGroups.length === 0) {
    html = '<div style="text-align:center;color:var(--gray);padding:40px;">还没有分组，点右上角 + 新建</div>';
  }

  container.innerHTML = html;
}

function toggleStickerGroupCollapse(groupId) {
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;
  g.collapsed = !g.collapsed;
  saveStickerGroups();
  renderStickerGroups();
}

function addStickerGroup() {
  var name = prompt('新分组名称：');
  if (!name || !name.trim()) return;
  var id = 'sg_' + Date.now();
  stickerGroups.push({ id: id, name: name.trim(), items: [] });
  saveStickerGroups();
  renderStickerGroups();
  showToast('分组已添加');
}

function renameStickerGroup(groupId) {
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;
  var name = prompt('修改分组名称：', g.name);
  if (name === null) return;
  if (!name.trim()) return;
  g.name = name.trim();
  saveStickerGroups();
  renderStickerGroups();
  showToast('已修改');
}

function moveStickerGroup(groupId, dir) {
  var idx = stickerGroups.findIndex(function(x) { return x.id === groupId; });
  if (idx < 0) return;
  var target = idx + dir;
  if (target < 0 || target >= stickerGroups.length) return;
  var tmp = stickerGroups[idx];
  stickerGroups[idx] = stickerGroups[target];
  stickerGroups[target] = tmp;
  saveStickerGroups();
  renderStickerGroups();
}

function deleteStickerGroup(groupId) {
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;
  if (!confirm('确定删除「' + g.name + '」分组吗？\n\n组内 ' + (g.items || []).length + ' 个表情包会一起删除，不可恢复！')) return;
  stickerGroups = stickerGroups.filter(function(x) { return x.id !== groupId; });
  if (stickerGroups.length === 0) {
    stickerGroups.push({ id: 'default', name: '默认', items: [] });
  }
  saveStickerGroups();
  renderStickerGroups();
  showToast('分组已删除');
}

function addStickersToGroup(groupId) {
  var input = document.getElementById('stickerFileInput_' + groupId);
  if (input) input.click();
}

function handleStickerGroupUpload(e, groupId) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  if (files.length > 20) {
    showToast('一次最多添加 20 个，已自动取前 20 个');
  }
  var totalFiles = Math.min(files.length, 20);
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;

  showToast('正在处理 ' + totalFiles + ' 张图片...');

  var promises = [];
  for (var i = 0; i < totalFiles; i++) {
    promises.push(compressSticker(files[i]));
  }

  Promise.all(promises).then(function(results) {
    g.items = (g.items || []).concat(results);
    saveStickerGroups();
    renderStickerGroups();
    showToast('成功添加 ' + results.length + ' 个表情包');
  }).catch(function(err) {
    showToast('添加失败：' + err.message);
  });

  e.target.value = '';
}

function compressSticker(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var MAX_SIZE = 400;
        var width = img.width, height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = function() { reject(new Error('图片加载失败')); };
      img.src = ev.target.result;
    };
    reader.onerror = function() { reject(new Error('读取失败')); };
    reader.readAsDataURL(file);
  });
}

function deleteStickerFromGroup(groupId, itemIdx) {
  var g = stickerGroups.find(function(x) { return x.id === groupId; });
  if (!g) return;
  g.items.splice(itemIdx, 1);
  saveStickerGroups();
  renderStickerGroups();
  showToast('已删除');
}

// ===== 红包基础函数 =====
function getDreamBalance(dreamId) {
  var d = state.dreams.find(function(x) { return x.id === dreamId; });
  return d && d.balance != null ? d.balance : 0;
}

function setDreamBalance(dreamId, amount) {
  var d = state.dreams.find(function(x) { return x.id === dreamId; });
  if (!d) return;
  var n = parseFloat(amount) || 0;
  if (n < 0) n = 0;
  if (n > 99999999) n = 99999999;
  d.balance = Math.floor(n * 100) / 100;
  saveState();
}

function addDreamBalance(dreamId, amount) {
  var cur = getDreamBalance(dreamId);
  setDreamBalance(dreamId, cur + (parseFloat(amount) || 0));
}

// 微信风格随机分配：把 total 分成 count 份，总和严格等于 total
function randomSplit(total, count) {
  if (count <= 0) return [];
  if (count === 1) return [Math.floor(total * 100) / 100];
  var remainCents = Math.round(total * 100);
  var result = [];
  for (var i = 0; i < count - 1; i++) {
    var slotsLeft = count - i;
    var avg = remainCents / slotsLeft;
    var maxCents = Math.floor(avg * 2);
    var minCents = 1;
    if (maxCents < minCents) maxCents = minCents;
    var pickCents = minCents + Math.floor(Math.random() * (maxCents - minCents + 1));
    if (pickCents > remainCents - (slotsLeft - 1) * 1) {
      pickCents = remainCents - (slotsLeft - 1) * 1;
    }
    if (pickCents < 1) pickCents = 1;
    result.push(pickCents / 100);
    remainCents -= pickCents;
  }
  result.push(remainCents / 100);
  return result;
}

function formatMoney(n) {
  return (parseFloat(n) || 0).toFixed(2);
}

// ===== 红包面板 =====
function openRedPacketPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  var balanceSection = document.getElementById('rpBalanceSection');
  var peopleRow = document.getElementById('rpPeopleRow');

  if (isGroup) {
    balanceSection.style.display = 'none';
    peopleRow.style.display = 'block';
    var g = state.groups.find(function(x) { return x.id === state.currentChatId; });
    var maxPeople = g ? g.memberIds.length + 1 : 1;
    document.getElementById('rpPeople').max = maxPeople;
    document.getElementById('rpPeople').placeholder = '1 ~ ' + maxPeople;
  } else {
    balanceSection.style.display = 'block';
    peopleRow.style.display = 'none';
    document.getElementById('rpBalanceNum').textContent = formatMoney(getDreamBalance(state.currentChatId));
  }

  document.getElementById('rpAmount').value = '';
  document.getElementById('rpMessage').value = '';
  document.getElementById('redPacketPanel').style.display = 'flex';
}

function closeRedPacketPanel() {
  document.getElementById('redPacketPanel').style.display = 'none';
}

function openTopupDialog() {
  if (!state.currentChatId || state.currentChatId.startsWith('group_')) return;
  var dreamId = state.currentChatId;
  var v = prompt('给「' + getDreamName(dreamId) + '」充值（最多 99999999）：', '100');
  if (v === null) return;
  var n = parseFloat(v);
  if (isNaN(n) || n <= 0) { showToast('请输入有效金额'); return; }
  if (n > 99999999) n = 99999999;
  n = Math.floor(n * 100) / 100;

  var remaining = n;

  // 【新增】优先还债
  if (state.workShifts && state.workShifts.length > 0) {
    var debtWorks = state.workShifts.filter(function(w) {
      return w.dreamId === dreamId && w.debt > 0;
    });
    debtWorks.forEach(function(w) {
      if (remaining <= 0) return;
      var pay = Math.min(remaining, w.debt);
      pay = Math.round(pay * 100) / 100;
      w.debt = Math.round((w.debt - pay) * 100) / 100;
      remaining = Math.round((remaining - pay) * 100) / 100;
      w.todayLog.push({
        hour: new Date().getHours(),
        min: new Date().getMinutes(),
        text: '用充值还债 ' + pay.toFixed(2) + ' 元' + (w.debt > 0 ? '（剩欠债 ' + w.debt.toFixed(2) + ' 元）' : '（已还清）'),
        type: 'repay'
      });
    });
  }

  // 还完剩下的进金库
  if (remaining > 0) {
    addDreamBalance(dreamId, remaining);
  }

  saveState();
  document.getElementById('rpBalanceNum').textContent = formatMoney(getDreamBalance(dreamId));
  renderWorkCards();

  if (remaining < n) {
    showToast('充值 ' + formatMoney(n) + '，其中 ' + formatMoney(n - remaining) + ' 用于还债');
  } else {
    showToast('已充值 ' + formatMoney(n));
  }
}

function sendRedPacket() {
  var amount = parseFloat(document.getElementById('rpAmount').value);
  if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); return; }
  if (amount > 99999999) amount = 99999999;
  amount = Math.floor(amount * 100) / 100;

  var msg = (document.getElementById('rpMessage').value || '').trim() || '大吉大利，恭喜发财';
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  var maxPeople = 1;
  var isGroup = state.currentChatId && state.currentChatId.startsWith('group_');
  var maxPeople = 1;
  if (isGroup) {
    var g = state.groups.find(function(x) { return x.id === state.currentChatId; });
    var groupLimit = g ? (g.memberIds.length + 1) : 1;
    var people = parseInt(document.getElementById('rpPeople').value) || 1;
    if (people < 1) people = 1;
    if (people > groupLimit) people = groupLimit;
    maxPeople = people;
  } else {
    maxPeople = 1;
  }

  var packet = {
    from: 'user',
    senderId: 'user',
    senderName: state.profile.name || '我',
    type: 'redpacket',
    packetId: 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    totalAmount: amount,
    message: msg,
    maxPeople: isGroup ? maxPeople : 1,
    claimed: [],
    refunded: false,
    chatId: state.currentChatId,
    time: Date.now()
  };

  if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
  state.chatSessions[state.currentChatId].push(packet);
  saveState();
  loadChatMessages();
  renderChatMessages();
  closeRedPacketPanel();

  if (!isGroup && state.currentChatId) {
    var dreamId = state.currentChatId;
    setTimeout(function() {
      if (Math.random() < 0.85) {
        claimRedPacket(packet.packetId, dreamId);
      } else {
       refundRedPacket(packet.packetId, dreamId, '梦角退回') ;
      }
    }, 2000 + Math.random() * 3000);
  } else if (isGroup) {
    var g2 = state.groups.find(function(x) { return x.id === state.currentChatId; });
    if (g2) {
      g2.memberIds.forEach(function(id) {
        if (Math.random() < 0.65) {
          setTimeout(function() {
            claimRedPacket(packet.packetId, id);
          }, 1500 + Math.random() * 6000);
        }
      });
    }
  }
}

function claimRedPacket(packetId, claimerId) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'redpacket' && m.packetId === packetId) {
        if (m.refunded) return;
        if (m.claimed.length >= m.maxPeople) return;
        if (m.claimed.some(function(c) { return c.userId === claimerId; })) return;

        var remain = m.totalAmount - m.claimed.reduce(function(s, c) { return s + c.amount; }, 0);
        remain = Math.round(remain * 100) / 100;
        var slots = m.maxPeople - m.claimed.length;
        var splits = randomSplit(remain, slots);
        var got = splits[0];
        if (got < 0.01) got = 0.01;
        if (got > remain) got = remain;
        got = Math.round(got * 100) / 100;

        m.claimed.push({
          userId: claimerId,
          name: claimerId === 'user' ? (state.profile.name || '我') : getDreamName(claimerId),
          amount: got,
          time: Date.now()
        });

        // 【新增】：梦角领到的钱，优先还债
        if (claimerId !== 'user') {
          var remaining = got;
          // 找出这个梦角所有欠债的打工记录
          if (state.workShifts && state.workShifts.length > 0) {
            var debtWorks = state.workShifts.filter(function(w) {
              return w.dreamId === claimerId && w.debt > 0;
            });
            debtWorks.forEach(function(w) {
              if (remaining <= 0) return;
              var pay = Math.min(remaining, w.debt);
              pay = Math.round(pay * 100) / 100;
              w.debt = Math.round((w.debt - pay) * 100) / 100;
              remaining = Math.round((remaining - pay) * 100) / 100;
              // 在打工记录里也留一条
              w.todayLog.push({
                hour: new Date().getHours(),
                min: new Date().getMinutes(),
                text: '用红包还债 ' + pay.toFixed(2) + ' 元' + (w.debt > 0 ? '（剩欠债 ' + w.debt.toFixed(2) + ' 元）' : '（已还清）'),
                type: 'repay'
              });
            });
          }
          // 还完债剩下的才进金库
          if (remaining > 0) {
            addDreamBalance(claimerId, remaining);
          }
          saveState();
          renderWorkCards();
        }

        var claimName = claimerId === 'user' ? (state.profile.name || '我') : getDreamName(claimerId);
        state.chatSessions[chatId].push({ from: 'system', text: '「' + claimName + '」领取了红包', time: Date.now() });

        saveState();
        if (state.currentChatId === chatId) {
          loadChatMessages();
          renderChatMessages();
        }
        return;
      }
    }
  }
}

function refundRedPacket(packetId, rejecterId, reason) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'redpacket' && m.packetId === packetId) {
        if (m.refunded) return;
        var remain = m.totalAmount - m.claimed.reduce(function(s, c) { return s + c.amount; }, 0);
        remain = Math.max(0, Math.round(remain * 100) / 100);
        if (m.from === 'dream' && m.senderId) {
          addDreamBalance(m.senderId, remain);
        }
        m.refunded = true;
        m.refundReason = reason || '已退回';
        var rejName = rejecterId === 'user' ? (state.profile.name || '我') : getDreamName(rejecterId);
        state.chatSessions[chatId].push({ from: 'system', text: '「' + rejName + '」退回了红包', time: Date.now() });
        saveState();
        if (state.currentChatId === chatId) {
          loadChatMessages();
          renderChatMessages();
        }
        return;
      }
    }
  }
}

function openRedPacketDetail(packetId) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'redpacket' && m.packetId === packetId) {
        document.getElementById('rpdSender').textContent = '来自 ' + m.senderName + ' 的红包';
        document.getElementById('rpdAmount').textContent = formatMoney(m.totalAmount);
        document.getElementById('rpdMessage').textContent = m.message;

        var list = document.getElementById('rpdClaimList');
        var html = '';

        // 判断：是不是梦角发的，且用户还没领，且没退回 → 显示领取/退回按钮
        var fromDream = (m.from === 'dream');
        var userClaimed = m.claimed.some(function(c) { return c.userId === 'user'; });
                var isGroupChat = chatId && chatId.startsWith('group_');
        var needUserAction = !userClaimed && !m.refunded && m.claimed.length < m.maxPeople &&
          ((m.from === 'dream') || (m.from === 'user' && isGroupChat));

        if (needUserAction) {
          html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';
          html += '<button onclick="userClaimRedPacket(\'' + m.packetId + '\')" style="flex:1;padding:11px;border:none;border-radius:12px;background:#fa5151;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">领取</button>';
          html += '<button onclick="userRejectRedPacket(\'' + m.packetId + '\')" style="flex:1;padding:11px;border:1px solid #e5e5ea;background:transparent;border-radius:12px;font-size:14px;cursor:pointer;color:#1d1d1f;">退回</button>';
          html += '</div>';
        }

        if (m.claimed.length === 0) {
          html += '<div style="text-align:center;color:#86868b;font-size:13px;padding:20px 0;">暂无人领取</div>';
        } else {
          var sorted = m.claimed.slice().sort(function(a, b) { return b.amount - a.amount; });
          html += '<div style="font-size:12px;color:#86868b;margin-bottom:10px;">已领取 ' + m.claimed.length + '/' + m.maxPeople + ' 个</div>';
          sorted.forEach(function(c, idx) {
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f5;">';
            html += '<span style="font-size:14px;color:#1d1d1f;">' + (idx === 0 ? '👑 ' : '') + c.name + '</span>';
            html += '<span style="font-size:14px;font-weight:600;color:#fa5151;">' + formatMoney(c.amount) + '</span>';
            html += '</div>';
          });
          if (m.refunded) {
            html += '<div style="margin-top:10px;text-align:center;font-size:12px;color:#86868b;">已退回（' + (m.refundReason || '') + '）</div>';
          }
        }
        list.innerHTML = html;
        document.getElementById('redPacketDetail').style.display = 'flex';
        return;
      }
    }
  }
}

// 用户领取梦角发的红包
function userClaimRedPacket(packetId) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'redpacket' && m.packetId === packetId) {
        if (m.refunded) { showToast('红包已退回'); return; }
        if (m.claimed.length >= m.maxPeople) { showToast('红包已被领完'); return; }
        if (m.claimed.some(function(c) { return c.userId === 'user'; })) { showToast('你已经领过了'); return; }
        if (m.from === 'user' && !chatId.startsWith('group_')) { showToast('私聊里不能领自己发的红包'); return; }

        var remain = m.totalAmount - m.claimed.reduce(function(s, c) { return s + c.amount; }, 0);
        remain = Math.round(remain * 100) / 100;
        var slots = m.maxPeople - m.claimed.length;
        var splits = randomSplit(remain, slots);
        var got = splits[0];
        if (got < 0.01) got = 0.01;
        if (got > remain) got = remain;

        m.claimed.push({
          userId: 'user',
          name: state.profile.name || '我',
          amount: Math.round(got * 100) / 100,
          time: Date.now()
        });

        state.chatSessions[chatId].push({ from: 'system', text: '「' + (state.profile.name || '我') + '」领取了红包', time: Date.now() });
        saveState();
        closeRedPacketDetail();
        if (state.currentChatId === chatId) {
          loadChatMessages();
          renderChatMessages();
        }
        showToast('已领取 ' + formatMoney(got));
        return;
      }
    }
  }
}

// 用户退回梦角发的红包
function userRejectRedPacket(packetId) {
  if (!confirm('确定退回这个红包吗？')) return;
  refundRedPacket(packetId, 'user', '用户退回');
  closeRedPacketDetail();
}

function closeRedPacketDetail() {
  document.getElementById('redPacketDetail').style.display = 'none';
}

// ===== 红包 24 小时超时退回 =====
function checkRedPacketExpiry() {
  if (!state.chatSessions) return;
  var now = Date.now();
  var EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 小时
  var changed = false;

  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    if (!Array.isArray(msgs)) continue;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (!m || m.type !== 'redpacket') continue;
      if (m.refunded) continue;                                // 已退回
      if (now - m.time < EXPIRE_MS) continue;                  // 还没到 24 小时
      if (m.claimed.length >= m.maxPeople) continue;           // 已领完

      var remain = m.totalAmount - m.claimed.reduce(function(s, c) { return s + c.amount; }, 0);
      remain = Math.max(0, Math.round(remain * 100) / 100);

      // 如果是梦角发的，剩余金额退回梦角金库
      if (m.from === 'dream' && m.senderId && remain > 0) {
        addDreamBalance(m.senderId, remain);
      }

      m.refunded = true;
      m.refundReason = '超时未领完';
      m.refundAt = now;

      msgs.push({
        from: 'system',
        text: '红包超时未领完，剩余 ' + formatMoney(remain) + ' 已退回给「' + m.senderName + '」',
        time: now
      });
      changed = true;
    }
  }

  if (changed) {
    saveState();
    if (state.currentChatId) {
      loadChatMessages();
      renderChatMessages();
    }
  }
}

// ===== 送礼模块 · 数据层 =====
var DEFAULT_GIFTS = [
  { id: 'gift_1', name: '蛋糕', price: 5 },
  { id: 'gift_2', name: '花',   price: 10 },
  { id: 'gift_3', name: '奶茶', price: 15 }
];

function getGiftItems() {
  if (!state.giftItems || !Array.isArray(state.giftItems) || state.giftItems.length === 0) {
      if (!state.workShifts || !Array.isArray(state.workShifts)) {
      if (!state.bannedDreams || !Array.isArray(state.bannedDreams)) state.bannedDreams = [];
  if (!state.apologizingDreams || !Array.isArray(state.apologizingDreams)) state.apologizingDreams = [];
  if (!state.cheatUsage || typeof state.cheatUsage !== 'object') {
      if (!state.musicLibrary || typeof state.musicLibrary !== 'object') {
    state.musicLibrary = { songs: [], playlists: [] };
  }
    state.cheatUsage = { date: '', unbanGroups: [], seizeGroups: [] };
  }
    state.workShifts = [];
  }
      if (!state.workShifts || !Array.isArray(state.workShifts)) {
    state.workShifts = [];
  }
    state.giftItems = JSON.parse(JSON.stringify(DEFAULT_GIFTS));
    saveState();
  }
  return state.giftItems;
}

function saveGiftItems() {
  saveState();
}

// ===== 送礼模块 · 面板 =====
var giftEditMode = false;

function openGiftPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';

  // 只允许私聊
  if (!state.currentChatId || state.currentChatId.startsWith('group_')) {
    showToast('送礼只能在私聊里使用');
    return;
  }

  giftEditMode = false;
  updateGiftEditBtn();
  renderGiftList();
  document.getElementById('giftPanel').style.display = 'flex';
}

function closeGiftPanel() {
  document.getElementById('giftPanel').style.display = 'none';
}

function toggleGiftEditMode() {
  giftEditMode = !giftEditMode;
  updateGiftEditBtn();
  renderGiftList();
}

function updateGiftEditBtn() {
  var btn = document.getElementById('giftEditBtn');
  if (!btn) return;
  btn.textContent = giftEditMode ? '完成' : '编辑';
  btn.style.background = giftEditMode ? '#ff3b30' : '#fff';
  btn.style.color = giftEditMode ? '#fff' : '#007aff';
}

function renderGiftList() {
  var container = document.getElementById('giftListContainer');
  if (!container) return;
  var items = getGiftItems();

  var html = '';

  if (giftEditMode) {
    // 编辑模式：可以改名、改价、删除，底部加「+ 添加礼品」
    items.forEach(function(g, idx) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f5;">';
      html += '<input type="text" value="' + (g.name || '').replace(/"/g, '&quot;') + '" onchange="updateGiftName(' + idx + ', this.value)" style="flex:2;padding:6px 10px;border:1px solid #e5e5ea;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;">';
      html += '<input type="number" value="' + g.price + '" step="0.01" min="0.01" max="99999999" onchange="updateGiftPrice(' + idx + ', this.value)" style="flex:1;padding:6px 10px;border:1px solid #e5e5ea;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;width:70px;">';
      html += '<span onclick="deleteGiftItem(' + idx + ')" style="color:#ff3b30;cursor:pointer;font-size:16px;padding:0 4px;">×</span>';
      html += '</div>';
    });
    html += '<button onclick="addGiftItem()" style="width:100%;margin-top:10px;padding:9px;border:1px dashed #e5e5ea;background:transparent;border-radius:10px;color:#007aff;font-size:13px;cursor:pointer;">+ 添加礼品</button>';
  } else {
    // 正常模式：点一下选礼品
    if (items.length === 0) {
      html = '<div style="text-align:center;color:#86868b;padding:30px 0;font-size:13px;">还没有礼品，点右上角「编辑」添加</div>';
    } else {
      items.forEach(function(g, idx) {
        html += '<div onclick="sendGiftByIndex(' + idx + ')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-bottom:8px;background:#f8f8fa;border-radius:12px;cursor:pointer;">';
        html += '<span style="font-size:14px;color:#1d1d1f;">' + g.name + '</span>';
        html += '<span style="font-size:13px;color:#fa5151;font-weight:600;">' + formatMoney(g.price) + ' 元</span>';
        html += '</div>';
      });
    }
  }

  container.innerHTML = html;
}

function addGiftItem() {
  var items = getGiftItems();
  items.push({ id: 'gift_' + Date.now(), name: '新礼品', price: 1 });
  saveGiftItems();
  renderGiftList();
}

function updateGiftName(idx, val) {
  var items = getGiftItems();
  if (idx < 0 || idx >= items.length) return;
  items[idx].name = (val || '').trim() || '未命名';
  saveGiftItems();
}

function updateGiftPrice(idx, val) {
  var items = getGiftItems();
  if (idx < 0 || idx >= items.length) return;
  var n = parseFloat(val) || 0;
  if (n < 0.01) n = 0.01;
  if (n > 99999999) n = 99999999;
  items[idx].price = Math.floor(n * 100) / 100;
  saveGiftItems();
}

function deleteGiftItem(idx) {
  var items = getGiftItems();
  if (idx < 0 || idx >= items.length) return;
  items.splice(idx, 1);
  saveGiftItems();
  renderGiftList();
}

// ===== 送礼模块 · 发送逻辑 =====
function sendGiftByIndex(idx) {
  var items = getGiftItems();
  if (idx < 0 || idx >= items.length) return;
  var gift = items[idx];

  var countStr = prompt('送几份「' + gift.name + '」？', '1');
  if (countStr === null) return;
  var count = parseInt(countStr) || 0;
  if (count < 1) { showToast('请输入有效份数'); return; }

  var totalPrice = Math.floor(gift.price * count * 100) / 100;

  var packet = {
    from: 'user',
    senderId: 'user',
    senderName: state.profile.name || '我',
    type: 'gift',
    packetId: 'gf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    giftName: gift.name,
    unitPrice: gift.price,
    count: count,
    totalPrice: totalPrice,
    claimed: [],
    refunded: false,
    chatId: state.currentChatId,
    time: Date.now()
  };

  if (!state.chatSessions[state.currentChatId]) state.chatSessions[state.currentChatId] = [];
  state.chatSessions[state.currentChatId].push(packet);
  saveState();
  loadChatMessages();
  renderChatMessages();
  closeGiftPanel();

  // 梦角决定领不领
  var dreamId = state.currentChatId;
  setTimeout(function() {
    if (Math.random() < 0.8) {
      // 领取
      state.chatSessions[dreamId].push({ from: 'system', text: '「' + getDreamName(dreamId) + '」领取了礼物', time: Date.now() });
      packet.claimed.push({ userId: dreamId, name: getDreamName(dreamId), time: Date.now() });
      saveState();
    } else {
      // 拒绝
      packet.refunded = true;
      packet.refundReason = '梦角拒绝';
      state.chatSessions[dreamId].push({ from: 'system', text: '「' + getDreamName(dreamId) + '」拒绝了礼物', time: Date.now() });
      saveState();
    }
    if (state.currentChatId === dreamId) {
      loadChatMessages();
      renderChatMessages();
    }
  }, 2000 + Math.random() * 3000);
}

function openGiftDetail(packetId) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'gift' && m.packetId === packetId) {
        document.getElementById('gdSender').textContent = '来自 ' + m.senderName + ' 的礼物';
        document.getElementById('gdName').textContent = m.giftName + ' ×' + m.count;
        document.getElementById('gdPrice').textContent = formatMoney(m.totalPrice) + ' 元';

        var actionArea = document.getElementById('gdActionArea');
        var html = '';

        var fromDream = (m.from === 'dream');
        var userClaimed = m.claimed.some(function(c) { return c.userId === 'user'; });
        var needUserAction = fromDream && !userClaimed && !m.refunded;

        if (needUserAction) {
          html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';
          html += '<button onclick="userClaimGift(\'' + m.packetId + '\')" style="flex:1;padding:11px;border:none;border-radius:12px;background:#fa5151;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">领取</button>';
          html += '<button onclick="userRejectGift(\'' + m.packetId + '\')" style="flex:1;padding:11px;border:1px solid #e5e5ea;background:transparent;border-radius:12px;font-size:14px;cursor:pointer;color:#1d1d1f;">拒绝</button>';
          html += '</div>';
        }

        if (m.claimed.length === 0) {
          html += '<div style="text-align:center;color:#86868b;font-size:13px;padding:10px 0;">暂无人领取</div>';
        } else {
          html += '<div style="font-size:12px;color:#86868b;margin-bottom:8px;">已领取</div>';
          m.claimed.forEach(function(c) {
            html += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#1d1d1f;">';
            html += '<span>' + c.name + '</span>';
            html += '<span style="color:#fa5151;font-weight:600;">' + formatMoney(m.totalPrice) + ' 元</span>';
            html += '</div>';
          });
        }
        if (m.refunded) {
          html += '<div style="margin-top:10px;text-align:center;font-size:12px;color:#86868b;">已退回（' + (m.refundReason || '') + '）</div>';
        }

        actionArea.innerHTML = html;
        document.getElementById('giftDetail').style.display = 'flex';
        return;
      }
    }
  }
}

function closeGiftDetail() {
  document.getElementById('giftDetail').style.display = 'none';
}

function userClaimGift(packetId) {
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'gift' && m.packetId === packetId) {
        if (m.refunded) { showToast('礼物已退回'); return; }
        if (m.claimed.some(function(c) { return c.userId === 'user'; })) { showToast('你已经领取了'); return; }

        m.claimed.push({ userId: 'user', name: state.profile.name || '我', time: Date.now() });
        state.chatSessions[chatId].push({ from: 'system', text: '「' + (state.profile.name || '我') + '」领取了礼物', time: Date.now() });
        saveState();
        closeGiftDetail();
        if (state.currentChatId === chatId) {
          loadChatMessages();
          renderChatMessages();
        }
        showToast('已领取');
        return;
      }
    }
  }
}

function userRejectGift(packetId) {
  if (!confirm('确定拒绝这个礼物吗？')) return;
  if (!state.chatSessions) return;
  for (var chatId in state.chatSessions) {
    var msgs = state.chatSessions[chatId];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.type === 'gift' && m.packetId === packetId) {
        if (m.refunded) return;
        // 如果是梦角发的，钱退回梦角金库
        if (m.from === 'dream' && m.senderId) {
          addDreamBalance(m.senderId, m.totalPrice);
        }
        m.refunded = true;
        m.refundReason = '用户拒绝';
        state.chatSessions[chatId].push({ from: 'system', text: '「' + (state.profile.name || '我') + '」拒绝了礼物', time: Date.now() });
        saveState();
        closeGiftDetail();
        if (state.currentChatId === chatId) {
          loadChatMessages();
          renderChatMessages();
        }
        showToast('已拒绝');
        return;
      }
    }
  }
}

// ===== 打工系统 · 场景配置 =====
var WORK_SCENES = [
  {
    id: 'cafe',
    name: '咖啡馆',
    hourlyWage: 15,
    shifts: [[8, 11], [14, 17]]
  },
  {
    id: 'library',
    name: '图书馆',
    hourlyWage: 10,
    shifts: [[8, 12], [14, 16]]
  },
  {
    id: 'milktea',
    name: '奶茶店',
    hourlyWage: 10,
    shifts: [[8, 16]]
  },
  {
    id: 'catcafe',
    name: '猫咖馆',
    hourlyWage: 20,
    shifts: [[9, 11], [14, 18]]
  },
  {
    id: 'convenience_day',
    name: '便利店白班',
    hourlyWage: 25,
    shifts: [[6, 12], [14, 17]]
  },
  {
    id: 'convenience_night',
    name: '便利店晚班',
    hourlyWage: 15,
    shifts: [[18, 23]]
  }
];

// 扣钱原因
var WORK_PENALTIES = [
  { reason: '玩手机', amount: 5 },
  { reason: '摸鱼', amount: 3 },
  { reason: '损坏工作器材', amount: 20 },
  { reason: '顶撞老板', amount: 10 },
  { reason: '迟到', amount: 5 }
];

// 奖金原因
var WORK_BONUSES = [
  { reason: '优秀员工', amount: 5, weight: 45 },
  { reason: '效率高效', amount: 3, weight: 45 },
  { reason: '模范员工', amount: 10, weight: 10 }
];

// 按权重随机抽奖金
function pickRandomBonus() {
  var total = WORK_BONUSES.reduce(function(s, b) { return s + b.weight; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < WORK_BONUSES.length; i++) {
    if (r < WORK_BONUSES[i].weight) return WORK_BONUSES[i];
    r -= WORK_BONUSES[i].weight;
  }
  return WORK_BONUSES[0];
}

// 按 id 找场景
function getWorkScene(sceneId) {
  return WORK_SCENES.find(function(s) { return s.id === sceneId; });
}

// 计算某个场景今天的总工时（小时）
function getSceneDailyHours(scene) {
  if (!scene) return 0;
  var total = 0;
  scene.shifts.forEach(function(s) { total += (s[1] - s[0]); });
  return total;
}

// 判断某个场景在某个时刻是否处于工作时段
function isSceneWorkingAt(scene, date) {
  if (!scene) return false;
  var h = date.getHours();
  for (var i = 0; i < scene.shifts.length; i++) {
    if (h >= scene.shifts[i][0] && h < scene.shifts[i][1]) return true;
  }
  return false;
}

// 格式化时间：8 → "08:00"
function fmtHour(h, m) {
  var hh = String(h).padStart(2, '0');
  var mm = String(m || 0).padStart(2, '0');
  return hh + ':' + mm;
}

// ===== 打工系统 · 面板 =====
var workSelectedSceneId = null;

function openWorkPicker() {
  // 填充梦角下拉
  var sel = document.getElementById('workDreamSelect');
  var idleDreams = state.dreams.filter(function(d) {
    return !state.workShifts.some(function(w) { return w.dreamId === d.id && w.active; });
  });
  if (idleDreams.length === 0) {
    showToast('所有梦角都在打工中，没有空闲的');
    return;
  }
  sel.innerHTML = idleDreams.map(function(d) {
    return '<option value="' + d.id + '">' + d.name + '</option>';
  }).join('');

  // 渲染场景列表
  workSelectedSceneId = WORK_SCENES[0].id;
  renderWorkSceneList();
  document.getElementById('workPickerModal').style.display = 'flex';
}

function renderWorkSceneList() {
  var list = document.getElementById('workSceneList');
  list.innerHTML = WORK_SCENES.map(function(s) {
    var active = s.id === workSelectedSceneId;
    var hours = getSceneDailyHours(s);
    var dailyPay = (hours * s.hourlyWage).toFixed(0);
    return '<div onclick="pickWorkScene(\'' + s.id + '\')" style="padding:10px 12px;border-radius:12px;margin-bottom:8px;cursor:pointer;border:2px solid ' + (active ? '#007aff' : '#f0f0f5') + ';background:' + (active ? 'rgba(0,122,255,0.06)' : '#f8f8fa') + ';">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:14px;font-weight:600;color:#1d1d1f;">' + s.name + '</span>'
      + '<span style="font-size:13px;color:#fa5151;font-weight:600;">' + s.hourlyWage + ' 元/时</span>'
      + '</div>'
      + '<div style="font-size:11px;color:#86868b;margin-top:4px;">工时 ' + hours + ' 小时 · 日薪 ' + dailyPay + ' 元</div>'
      + '<div style="font-size:11px;color:#86868b;margin-top:2px;">' + s.shifts.map(function(p) { return fmtHour(p[0]) + '-' + fmtHour(p[1]); }).join('、') + '</div>'
      + '</div>';
  }).join('');
}

function pickWorkScene(id) {
  workSelectedSceneId = id;
  renderWorkSceneList();
}

function closeWorkPicker() {
  document.getElementById('workPickerModal').style.display = 'none';
}

function confirmWorkPicker() {
  var dreamId = document.getElementById('workDreamSelect').value;
  if (!dreamId) return;
  var sceneId = workSelectedSceneId;
  if (!sceneId) { showToast('请选择工作'); return; }

  var dream = state.dreams.find(function(d) { return d.id === dreamId; });
  var scene = getWorkScene(sceneId);
  if (!dream || !scene) return;

  // 建议打工：90% 接受
  var accept = Math.random() < 0.90;
  closeWorkPicker();

  if (!accept) {
    showToast('「' + dream.name + '」拒绝了去' + scene.name + '打工');
    return;
  }

  // 创建打工记录
  var today = new Date();
  var todayStr = today.toISOString().slice(0, 10);
  var record = {
    id: 'ws_' + Date.now(),
    dreamId: dreamId,
    dreamName: dream.name,
    sceneId: sceneId,
    sceneName: scene.name,
    hourlyWage: scene.hourlyWage,
    mood: 100,              // 心情值
    active: true,           // 是否还在打工（辞职后变 false）
    startedDate: todayStr,  // 开始打工的日期
    createdAt: Date.now(),
    todayLog: [],           // 今天的事件记录
    todayEarnings: 0,       // 今天累计（奖金-扣钱）
    debt: 0,                // 欠债
    todayDate: '',          // 当前记录归属的日期
    isWorking: false,       // 当前是否在工作时段内
    lastEventCheck: 0,      // 上次事件检测时间戳
    hasLateToday: false,    // 今天是否已迟到
    hasLeaveToday: false    // 今天是否请假
  };

  // 初始心情值：60%~100%
  record.mood = 40 + Math.floor(Math.random() * 61);
  record.todayDate = todayStr;
  record.lastEventCheck = Date.now();
    record.lastSettledDate = '';
  record.todaySettledAmount = null;

  // 判断今天是否请假（5%）
  if (Math.random() < 0.05) {
    record.hasLeaveToday = true;
    record.todayLog.push({ hour: 0, min: 0, text: '今日请假', type: 'leave' });
  }
  // 判断今天是否迟到（10%）
  else if (Math.random() < 0.10) {
    record.hasLateToday = true;
  }

  state.workShifts.push(record);
  saveState();
  renderWorkCards();
  showToast('「' + dream.name + '」接受了，明天开始去' + scene.name + '打工');
}

function renderWorkCards() {
  var container = document.getElementById('workCardsContainer');
  if (!container) return;

  if (!state.workShifts || state.workShifts.length === 0) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:#86868b;font-size:14px;">还没有梦角在打工<br>点右上角 + 建议梦角去打工吧</div>';
    return;
  }

  var html = '';
  state.workShifts.forEach(function(w) {
    var moodColor = w.mood >= 70 ? '#34c759' : (w.mood >= 30 ? '#ff9500' : '#ff3b30');
    var statusText;
    if (!w.active) statusText = '已辞职';
    else if (w.hasLeaveToday) statusText = '今日请假';
    else if (w.isWorking) statusText = '正在工作';
    else statusText = '已下班';

    html += '<div style="background:rgba(240,240,245,0.75);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:14px;padding:14px 16px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border:1px solid rgba(255,255,255,0.7);">';

    html += '<div onclick="toggleWorkHistory(\'' + w.id + '\')" style="display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;">';
    html += '<div>';
    html += '<div style="font-size:15px;font-weight:600;color:#1d1d1f;">' + w.dreamName + '</div>';
    if (w.debt > 0) {
      html += '<div style="font-size:11px;color:#ff3b30;margin-top:2px;">欠债 ' + formatMoney(w.debt) + ' 元</div>';
    }
    html += '</div>';
    html += '<div style="font-size:12px;color:#86868b;text-align:right;">';
    html += '<div>心情值：<span style="color:' + moodColor + ';font-weight:600;">' + w.mood + '%</span></div>';
    html += '<div style="margin-top:2px;">' + w.sceneName + ' · ' + statusText + '</div>';
    html += '</div>';
    html += '</div>';

    if (!w.active) {
      html += '<button onclick="event.stopPropagation();deleteWorkCard(\'' + w.id + '\')" style="margin-top:10px;width:100%;padding:8px;border:1px solid #ff3b30;background:transparent;color:#ff3b30;border-radius:10px;font-size:13px;cursor:pointer;">删除卡片</button>';
    }

    html += '<div class="work-history" id="wh_' + w.id + '" style="display:none;margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);">';

    var todayTotal = 0;
    if (w.todaySettledAmount != null) {
      todayTotal = w.todaySettledAmount;
    } else if (w.hasLeaveToday) {
      todayTotal = 0;
    } else {
      todayTotal = w.todayEarnings || 0;
    }
    var todayTotalText;
    var todayTotalColor;
    if (todayTotal > 0) { todayTotalText = '+' + todayTotal.toFixed(2) + ' 元'; todayTotalColor = '#34c759'; }
    else if (todayTotal < 0) { todayTotalText = todayTotal.toFixed(2) + ' 元'; todayTotalColor = '#ff3b30'; }
    else { todayTotalText = '0.00 元'; todayTotalColor = '#86868b'; }

    html += '<div style="font-size:13px;font-weight:600;color:' + todayTotalColor + ';margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed rgba(0,0,0,0.08);">';
    html += '今日累计：' + todayTotalText;
    if (w.hasLeaveToday) html += ' <span style="font-size:11px;color:#86868b;font-weight:400;">（今日请假）</span>';
    html += '</div>';

    html += '<div style="font-size:12px;color:#86868b;margin-bottom:8px;">今天的工作记录（最上方最新）</div>';
    html += '<div style="max-height:240px;overflow-y:auto;">';
    if (!w.todayLog || w.todayLog.length === 0) {
      html += '<div style="font-size:12px;color:#bbb;text-align:center;padding:10px 0;">今天还没有记录</div>';
    } else {
      var reversed = w.todayLog.slice().reverse();
      reversed.forEach(function(ev) {
        html += '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#555;border-bottom:1px solid rgba(0,0,0,0.03);">';
        html += '<span style="color:#86868b;">' + fmtHour(ev.hour, ev.min) + '</span>';
        html += '<span style="flex:1;text-align:right;margin-left:8px;">' + ev.text + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    html += '</div>';
  });
  container.innerHTML = html;
}

function deleteWorkCard(workId) {
  if (!confirm('确定删除这张打工卡片吗？')) return;
  state.workShifts = state.workShifts.filter(function(x) { return x.id !== workId; });
  saveState();
  renderWorkCards();
}

function toggleWorkHistory(workId) {
  var el = document.getElementById('wh_' + workId);
  if (!el) return;
  el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}

// ===== 打工系统 · 定时运行 =====
var workTickInterval = null;

function startWorkSystem() {
  if (workTickInterval) clearInterval(workTickInterval);
  // 每 1 分钟跑一次
  workTickInterval = setInterval(tickWorkSystem, 60 * 1000);
  // 启动时也立刻跑一次
  tickWorkSystem();
}

function tickWorkSystem() {
  if (!state.workShifts || state.workShifts.length === 0) return;
  var now = new Date();
  var nowTs = now.getTime();
  var todayStr = now.toISOString().slice(0, 10);
  var nowHour = now.getHours();
  var nowMin = now.getMinutes();

  state.workShifts.forEach(function(w) {
    if (!w.active) return;

    var scene = getWorkScene(w.sceneId);
    if (!scene) return;

    // 1. 跨天检测
    if (w.todayDate !== todayStr) {
      // 昨天还没结算 → 先结算昨天的
      if (w.lastSettledDate !== w.todayDate) {
        settleDailyWage(w);
      }
      dailyResetWork(w, todayStr);
    }

    // 请假的话今天就什么都不做
    if (w.hasLeaveToday) return;

    // 2. 判断是否处于工作时段
    var inShift = isSceneWorkingAt(scene, now);

  // 3. 上/下班切换
if (inShift && !w.isWorking) {
  w.isWorking = true;
  
  // 【核心修复】：找出当前时间对应的是今天哪一段班次，而不是死板地取第一段班
  var currentShift = null;
  for (var si = 0; si < scene.shifts.length; si++) {
    var s = scene.shifts[si];
    if (nowHour >= s[0] && nowHour < s[1]) {
      currentShift = s;
      break;
    }
  }
  
  // 如果找到了当前班次，就用当前班次的开始时间补录
  var shiftStartHour = currentShift ? currentShift[0] : nowHour; 
  var isCatchUp = (nowHour > shiftStartHour) || (nowHour === shiftStartHour && nowMin > 0);
  var recordHour = isCatchUp ? shiftStartHour : nowHour;
  var recordMin = isCatchUp ? 0 : nowMin;
  
  var checkinText = isCatchUp 
    ? '开始上班（离线补录，原定 ' + fmtHour(shiftStartHour, 0) + ' 上班）' 
    : '开始上班';

  if (w.hasLateToday && !w.lateLogged) {
    w.lateLogged = true;
    w.todayEarnings -= 5;
    w.todayLog.push({
      hour: nowHour, min: nowMin,
      text: '迟到，' + fmtHour(nowHour, nowMin) + ' 才到',
      type: 'checkin'
    });
    w.todayLog.push({
      hour: nowHour, min: nowMin,
      text: '因「迟到」被扣 5 元',
      type: 'penalty',
      amount: 5
    });
  } else {
    w.todayLog.push({
      hour: recordHour, min: recordMin,
      text: checkinText,
      type: 'checkin'
    });
  }
  saveState();
} else if (!inShift && w.isWorking) {
  // 下班逻辑
  w.isWorking = false;
  w.todayLog.push({
    hour: nowHour, min: nowMin,
    text: '下班休息',
    type: 'checkout'
  });
  saveState();
}

    // 4. 到了最后下班时间，且今天还没结算 → 结算
    var lastEnd = scene.shifts[scene.shifts.length - 1][1];
    var hasCheckinToday = (w.todayLog || []).some(function(ev) { return ev.type === 'checkin'; });
    if (nowHour >= lastEnd && w.lastSettledDate !== todayStr && hasCheckinToday) {
      settleDailyWage(w);
    }

    // 5. 每 5 分钟检测事件（只在工作时段内）
    if (w.isWorking) {
      if (!w.lastEventCheck) w.lastEventCheck = nowTs;
      if (nowTs - w.lastEventCheck >= 5 * 60 * 1000) {
        w.lastEventCheck = nowTs;
        triggerWorkEvent(w, scene, now);
      }
    } else {
      w.lastEventCheck = nowTs;
    }
  });

  renderWorkCards();
  saveState();
}

function triggerWorkEvent(w, scene, now) {
  var r = Math.random();
  var hour = now.getHours();
  var min = now.getMinutes();
  var mood = w.mood;

  // 心情 ≤ 70% 时，扣钱概率从 2% 升到 7%（原2% + 5%）
  var penaltyRate = (mood <= 70) ? 0.07 : 0.02;
  var bonusRate = 0.03;
  var customerRate = 0.01;
  var fishRate = (mood <= 70) ? 0.15 : 0.05;
  var quitRate = 0.007;
  if (mood <= 15) quitRate = 0.03;
  if (mood === 0) quitRate = 1;

  var cursor = 0;

  // 1. 遇到客人
  cursor += customerRate;
  if (r < cursor) {
    enqueueWorkCustomerEvent(w.id);
    return;
  }

  // 2. 扣钱
  cursor += penaltyRate;
  if (r < cursor) {
    var p = WORK_PENALTIES[Math.floor(Math.random() * WORK_PENALTIES.length)];
    w.todayLog.push({
      hour: hour, min: min,
      text: '因「' + p.reason + '」被扣 ' + p.amount + ' 元',
      type: 'penalty',
      amount: p.amount
    });
    w.todayEarnings -= p.amount;
    var drop = 3 + Math.floor(Math.random() * 13); // 3~15
    w.mood = Math.max(0, w.mood - drop);
    saveState();
    return;
  }

  // 3. 奖金
  cursor += bonusRate;
  if (r < cursor) {
    var b = pickRandomBonus();
    w.todayLog.push({
      hour: hour, min: min,
      text: '获得「' + b.reason + '」奖金 ' + b.amount + ' 元',
      type: 'bonus',
      amount: b.amount
    });
    w.todayEarnings += b.amount;
    var up = 3 + Math.floor(Math.random() * 13); // 3~15
    w.mood = Math.min(100, w.mood + up);
    saveState();
    return;
  }

  // 4. 摸鱼
  cursor += fishRate;
  if (r < cursor) {
    w.todayLog.push({
      hour: hour, min: min,
      text: '偷偷摸了一会鱼',
      type: 'fish'
    });
    // 摸鱼被发现 3%
    if (Math.random() < 0.03) {
      var fmin = min + 1;
      var fhour = hour;
      if (fmin >= 60) { fmin -= 60; fhour += 1; }
      w.todayLog.push({
        hour: fhour, min: fmin,
        text: '摸鱼被老板发现，被扣 3 元',
        type: 'penalty',
        amount: 3
      });
      w.todayEarnings -= 3;
    }
    saveState();
    return;
  }

  // 5. 辞职
  cursor += quitRate;
  if (r < cursor) {
    w.active = false;
    w.isWorking = false;
    w.todayLog.push({
      hour: hour, min: min,
      text: '辞职了',
      type: 'quit'
    });
    saveState();
    renderWorkCards();
    return;
  }
}

// ===== 打工系统 · 遇到客人弹窗 =====
var workCustomerQueue = [];       // 排队
var workCustomerCurrent = null;   // 当前正在弹的 { workId }

function enqueueWorkCustomerEvent(workId) {
  workCustomerQueue.push(workId);
  tryShowNextCustomerEvent();
}

function tryShowNextCustomerEvent() {
  if (workCustomerCurrent) return; // 已经在弹了
  if (workCustomerQueue.length === 0) return;

  var workId = workCustomerQueue.shift();
  var w = state.workShifts.find(function(x) { return x.id === workId; });
  if (!w || !w.active) {
    // 记录已失效，直接下一个
    setTimeout(tryShowNextCustomerEvent, 100);
    return;
  }

  workCustomerCurrent = { workId: workId };

  document.getElementById('wcTitle').textContent = '⚠️ 遇到麻烦了';
  document.getElementById('wcBody').textContent = '「' + w.dreamName + '」在工作时遇到了胡搅蛮缠的客人，请求你的帮助';
  document.getElementById('wcBody').style.display = 'block';
  document.getElementById('wcSpin').style.display = 'none';
  document.getElementById('wcBtns').style.display = 'flex';
  document.getElementById('wcConfirm').style.display = 'none';
  document.getElementById('workCustomerModal').style.display = 'flex';
}

function workCustomerIgnore() {
  if (!workCustomerCurrent) return;
  var w = state.workShifts.find(function(x) { return x.id === workCustomerCurrent.workId; });
  if (w) {
    var drop = 3 + Math.floor(Math.random() * 13); // 3~15
    w.mood = Math.max(0, w.mood - drop);
    var now = new Date();
    w.todayLog.push({
      hour: now.getHours(), min: now.getMinutes(),
      text: '遇到刁难客人，未处理，心情值 -' + drop + '%',
      type: 'customer_ignore'
    });
    saveState();
    renderWorkCards();
    showToast('「' + w.dreamName + '」心情值 -' + drop + '%');
  }
  closeWorkCustomerModal();
}

function workCustomerHelp() {
  if (!workCustomerCurrent) return;
  var w = state.workShifts.find(function(x) { return x.id === workCustomerCurrent.workId; });
  if (!w) { closeWorkCustomerModal(); return; }

  // 进入转圈状态
  document.getElementById('wcTitle').textContent = '💬 正在争辩';
  document.getElementById('wcBody').style.display = 'none';
  document.getElementById('wcSpin').style.display = 'block';
  document.getElementById('wcBtns').style.display = 'none';

  // 3-8 秒后出结果
  var duration = 3000 + Math.random() * 5000;
  setTimeout(function() {
    var win = Math.random() < 0.6;
    var now = new Date();
    if (win) {
      document.getElementById('wcTitle').textContent = '🎉 赢了';
      document.getElementById('wcBody').textContent = '客人被你怼得哑口无言，离开了' + w.sceneName;
      w.todayLog.push({
        hour: now.getHours(), min: now.getMinutes(),
        text: '帮梦角吵赢了客人',
        type: 'customer_win'
      });
    } else {
      var drop = 3 + Math.floor(Math.random() * 13); // 3~15
      w.mood = Math.max(0, w.mood - drop);
      document.getElementById('wcTitle').textContent = '😞 吵输了';
      document.getElementById('wcBody').innerHTML = '客人再次胡搅蛮缠，争辩失败<br><span style="font-size:12px;color:#ff3b30;">' + w.dreamName + ' 心情值 -' + drop + '%</span>';
      w.todayLog.push({
        hour: now.getHours(), min: now.getMinutes(),
        text: '帮梦角吵架失败，心情值 -' + drop + '%',
        type: 'customer_lose'
      });
    }
    saveState();
    document.getElementById('wcBody').style.display = 'block';
    document.getElementById('wcSpin').style.display = 'none';
    document.getElementById('wcConfirm').style.display = 'block';
    renderWorkCards();
  }, duration);
}

function workCustomerConfirm() {
  closeWorkCustomerModal();
}

function closeWorkCustomerModal() {
  document.getElementById('workCustomerModal').style.display = 'none';
  workCustomerCurrent = null;
  // 处理下一个排队中的事件
  setTimeout(tryShowNextCustomerEvent, 300);
}

// ===== 打工系统 · 每日结算 =====
function settleDailyWage(w) {
  var scene = getWorkScene(w.sceneId);
  if (!scene) return;

  var total;
  if (w.hasLeaveToday) {
    total = 0;
  } else {
    var hours = getSceneDailyHours(scene);
    var baseWage = hours * scene.hourlyWage;
    total = baseWage + (w.todayEarnings || 0);
  }
  total = Math.round(total * 100) / 100;

  var displayText = '';

  // 处理欠债
  if (w.debt > 0 && total > 0) {
    var payDebt = Math.min(total, w.debt);
    w.debt = Math.round((w.debt - payDebt) * 100) / 100;
    total = Math.round((total - payDebt) * 100) / 100;
    displayText = '今日工资 +' + (total + payDebt).toFixed(2) + '，扣欠债 ' + payDebt.toFixed(2) + '，实收 +' + total.toFixed(2);
  } else if (total >= 0) {
    displayText = '今日工资 +' + total.toFixed(2) + ' 元';
  } else {
    displayText = '今日工资 ' + total.toFixed(2) + ' 元';
  }

  // 工资进/扣金库
  if (total > 0) {
    addDreamBalance(w.dreamId, total);
  } else if (total < 0) {
    var balance = getDreamBalance(w.dreamId);
    var need = Math.abs(total);
    if (balance >= need) {
      setDreamBalance(w.dreamId, balance - need);
    } else {
      // 金库不够，剩下的变成欠债
      var remain = need - balance;
      setDreamBalance(w.dreamId, 0);
      w.debt = Math.round((w.debt + remain) * 100) / 100;
      displayText += '（金库不足，欠债 ' + w.debt.toFixed(2) + ' 元）';
    }
  }

  w.todayLog.push({
    hour: new Date().getHours(),
    min: new Date().getMinutes(),
    text: displayText,
    type: 'settle'
  });

  w.todaySettledAmount = total;
  w.lastSettledDate = w.todayDate;
  saveState();
  renderWorkCards();
}

// ===== 打工系统 · 跨天重置 =====
function dailyResetWork(w, todayStr) {
  w.todayDate = todayStr;
  w.todayLog = [];
  w.todayEarnings = 0;
  w.todaySettledAmount = null;
  w.hasLateToday = false;
  w.hasLeaveToday = false;
  w.lateLogged = false;
  w.isWorking = false;
  w.lastEventCheck = Date.now();

  // 心情值刷新到 60%~100%
  w.mood = 40 + Math.floor(Math.random() * 61);

  // 判断今天是否请假（1%）
  if (Math.random() < 0.01) {
    w.hasLeaveToday = true;
    w.todayLog.push({ hour: 0, min: 0, text: '今日请假', type: 'leave' });
  } else if (Math.random() < 0.05) {
    w.hasLateToday = true;
  }
  saveState();
}

// ===== 小助手 · 主面板 =====
function openAssistantPanel() {
  document.getElementById('actionMenuPanel').style.display = 'none';
  document.getElementById('assistantModal').style.display = 'flex';
}

function closeAssistantModal() {
  document.getElementById('assistantModal').style.display = 'none';
}

// ===== 小助手 · 举报顶号 =====
function openReportPanel() {
  closeAssistantModal();
  if (!state.dreams || state.dreams.length < 2) {
    showToast('梦角不足 2 个，无法举报顶号');
    return;
  }
  var topSel = document.getElementById('reportTopSelect');
  var victimSel = document.getElementById('reportVictimSelect');
  var opts = state.dreams.map(function(d) {
    return '<option value="' + d.id + '">' + d.name + '</option>';
  }).join('');
  topSel.innerHTML = opts;
  victimSel.innerHTML = opts;
  topSel.selectedIndex = 0;
  victimSel.selectedIndex = Math.min(1, state.dreams.length - 1);
  document.getElementById('reportModal').style.display = 'flex';
}

function closeReportPanel() {
  document.getElementById('reportModal').style.display = 'none';
}

function submitReport() {
  var topId = document.getElementById('reportTopSelect').value;
  var victimId = document.getElementById('reportVictimSelect').value;

  if (!topId || !victimId) { showToast('请选择梦角'); return; }
  if (topId === victimId) { showToast('顶号者和被顶号者不能是同一个人'); return; }

  var top = state.dreams.find(function(d) { return d.id === topId; });
  var victim = state.dreams.find(function(d) { return d.id === victimId; });
  if (!top || !victim) return;

  var now = Date.now();
  var until = now + 5 * 60 * 1000;

  // 封禁被顶号者
  state.bannedDreams = (state.bannedDreams || []).filter(function(x) { return x.dreamId !== victimId; });
   state.bannedDreams.push({ dreamId: victimId, until: until, startAt: now });
  // 顶号者强制道歉
  state.apologizingDreams = (state.apologizingDreams || []).filter(function(x) { return x.dreamId !== topId; });
  state.apologizingDreams.push({ dreamId: topId, until: until, startAt: now });

  // 在聊天界面加通知面板
  var chatId = state.currentChatId;
  if (chatId) {
    var myName = state.profile.name || '我';
    if (!state.chatSessions[chatId]) state.chatSessions[chatId] = [];
    state.chatSessions[chatId].push({
      from: 'system',
      type: 'report_notice',
      text: '「' + myName + '」举报了「' + top.name + '」的顶号行为\n违规顶号者：' + top.name + '\n被顶号者：' + victim.name + '\n处罚开始',
      time: now
    });
    saveState();
    loadChatMessages();
    renderChatMessages();
  }

  saveState();
  closeReportPanel();
  showToast('举报成功，「' + victim.name + '」已被封禁 5 分钟');
}

// ===== 小助手 · 外挂 =====
function openCheatPanel() {
  closeAssistantModal();
  if (!state.currentChatId || !state.currentChatId.startsWith('group_')) {
    showToast('外挂只能用于群聊模式');
    return;
  }
  var today = new Date().toISOString().slice(0, 10);
  if (!state.cheatUsage || state.cheatUsage.date !== today) {
    state.cheatUsage = { date: today, unbanGroups: [], seizeGroups: [] };
    saveState();
  }
  var gid = state.currentChatId;
  var unbanUsed = state.cheatUsage.unbanGroups.indexOf(gid) > -1;
  var seizeUsed = state.cheatUsage.seizeGroups.indexOf(gid) > -1;
  document.getElementById('cheatUnbanHint').textContent = unbanUsed ? '今日已在本群使用' : '每天一次';
  document.getElementById('cheatSeizeHint').textContent = seizeUsed ? '今日已在本群使用' : '每天一次';
  document.getElementById('cheatModal').style.display = 'flex';
}

function closeCheatPanel() {
  document.getElementById('cheatModal').style.display = 'none';
}

function cheatUnbanSelf() {
  if (!state.currentChatId || !state.currentChatId.startsWith('group_')) return;
  var today = new Date().toISOString().slice(0, 10);
  if (!state.cheatUsage || state.cheatUsage.date !== today) {
    state.cheatUsage = { date: today, unbanGroups: [], seizeGroups: [] };
  }
  var gid = state.currentChatId;
  if (state.cheatUsage.unbanGroups.indexOf(gid) > -1) { showToast('今日已在本群使用过'); return; }

  var g = state.groups.find(function(x) { return x.id === gid; });
  if (!g) return;
  if (!g.muteEndsAt || g.muteEndsAt['user'] === undefined) { showToast('你当前没有被禁言'); return; }

  delete g.muteEndsAt['user'];
  state.cheatUsage.unbanGroups.push(gid);

  var myName = state.profile.name || '我';
  if (!state.chatSessions[gid]) state.chatSessions[gid] = [];
  state.chatSessions[gid].push({ from: 'system', text: '「' + myName + '」利用外挂解除了自己的禁言！', time: Date.now() });
  saveState();
  loadChatMessages();
  renderChatMessages();
  closeCheatPanel();
  showToast('已解除禁言');
}

function cheatSeizeOwner() {
  if (!state.currentChatId || !state.currentChatId.startsWith('group_')) return;
  var today = new Date().toISOString().slice(0, 10);
  if (!state.cheatUsage || state.cheatUsage.date !== today) {
    state.cheatUsage = { date: today, unbanGroups: [], seizeGroups: [] };
  }
  var gid = state.currentChatId;
  if (state.cheatUsage.seizeGroups.indexOf(gid) > -1) { showToast('今日已在本群使用过'); return; }

  var g = state.groups.find(function(x) { return x.id === gid; });
  if (!g) return;
  if (g.ownerId === 'user') { showToast('你已经是群主了'); return; }

  g.ownerId = 'user';
  state.cheatUsage.seizeGroups.push(gid);

  var myName = state.profile.name || '我';
  if (!state.chatSessions[gid]) state.chatSessions[gid] = [];
  state.chatSessions[gid].push({ from: 'system', text: '「' + myName + '」利用外挂夺回了群主！', time: Date.now() });
  saveState();
  loadChatMessages();
  renderChatMessages();
  closeCheatPanel();
  showToast('已夺回群主');
}

// ===== 小助手 · 状态查询 =====
var APOLOGY_PHRASES = ['我错了', '我再也不顶号了', '下次再也不犯了', '对不起，是我不对', '我保证这是最后一次'];

function pickApology() {
  return APOLOGY_PHRASES[Math.floor(Math.random() * APOLOGY_PHRASES.length)];
}

function getDreamBanStatus(dreamId, msgTime) {
  if (!dreamId) return 'normal';
  var t = msgTime || Date.now();

  // 找该梦角所有封禁记录
  var bans = (state.bannedDreams || []).filter(function(x) { return x.dreamId === dreamId; });
  for (var i = 0; i < bans.length; i++) {
    var x = bans[i];
    // 消息发送时间落在处罚期间内 → 永久显示为封禁
    if (t >= (x.startAt || 0) && t <= x.until) return 'banned';
  }

  var apolos = (state.apologizingDreams || []).filter(function(x) { return x.dreamId === dreamId; });
  for (var j = 0; j < apolos.length; j++) {
    var y = apolos[j];
    if (t >= (y.startAt || 0) && t <= y.until) return 'apologizing';
  }

  return 'normal';
}

// ===== 小助手 · 处罚到期检测 =====
function checkAssistantExpiry() {
  var now = Date.now();
  var changed = false;

  // 检查封禁
  (state.bannedDreams || []).forEach(function(x) {
    if (x.until <= now && !x.notified) {
      x.notified = true;
      changed = true;
      var victim = state.dreams.find(function(d) { return d.id === x.dreamId; });
      if (victim) {
        var notice = '对「' + victim.name + '」的封禁已结束，账号恢复正常';
        Object.keys(state.chatSessions || {}).forEach(function(cid) {
          var inPrivate = (cid === victim.id);
          var g = state.groups.find(function(g) { return g.id === cid; });
          var inGroup = g && g.memberIds.indexOf(victim.id) > -1;
          if (inPrivate || inGroup) {
            state.chatSessions[cid].push({ from: 'system', text: notice, time: now });
          }
        });
      }
    }
  });

  // 检查强制道歉
  (state.apologizingDreams || []).forEach(function(x) {
    if (x.until <= now && !x.notified) {
      x.notified = true;
      changed = true;
      var top = state.dreams.find(function(d) { return d.id === x.dreamId; });
      if (top) {
        var notice2 = '对「' + top.name + '」的强制道歉已结束，账号恢复正常';
        Object.keys(state.chatSessions || {}).forEach(function(cid) {
          var inPrivate = (cid === top.id);
          var g = state.groups.find(function(g) { return g.id === cid; });
          var inGroup = g && g.memberIds.indexOf(top.id) > -1;
          if (inPrivate || inGroup) {
            state.chatSessions[cid].push({ from: 'system', text: notice2, time: now });
          }
        });
      }
    }
  });

  if (changed) {
    saveState();
    if (state.currentChatId) {
      loadChatMessages();
      renderChatMessages();
    }
  }
}

// ===== 音乐功能 · 本地导入 =====
function renderMusicList() {
  var container = document.getElementById('musicListContainer');
  if (!container) return;
  var songs = state.musicLibrary.songs || [];
  if (songs.length === 0) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:#86868b;font-size:14px;">还没有音乐，点右上角 + 导入吧</div>';
    return;
  }
  var html = '';
  songs.forEach(function(song, idx) {
    html += '<div onclick="playMusic(' + idx + ')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;">';
    html += '<span style="font-size:13px;color:#86868b;width:20px;text-align:center;">' + (idx + 1) + '</span>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:14px;font-weight:500;color:#1d1d1f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (song.title || song.fileName) + '</div>';
    html += '<div style="font-size:12px;color:#86868b;margin-top:2px;">' + (song.artist || '未知艺术家') + '</div>';
    html += '</div>';
    html += '<span style="font-size:12px;color:#c7c7cc;">' + (song.duration ? formatMinSec(song.duration) : '--:--') + '</span>';
    html += '<span onclick="event.stopPropagation();deleteMusic(' + idx + ')" style="font-size:16px;color:#ff3b30;padding:6px 10px;cursor:pointer;user-select:none;">🗑</span>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function deleteMusic(idx) {
  var songs = state.musicLibrary.songs || [];
  if (idx < 0 || idx >= songs.length) return;
  var song = songs[idx];
  if (!confirm('确定删除「' + (song.title || song.fileName) + '」吗？')) return;

  songs.splice(idx, 1);

  // 处理正在播放的情况
  if (currentMusicIndex === idx) {
    // 删的就是当前播放的 → 停止
    musicPlayer.pause();
    musicPlayer.removeAttribute('src');
    musicPlayer.load();
    currentMusicIndex = -1;
    var ball = document.getElementById('musicBall');
    if (ball) ball.style.display = 'none';
    var panel = document.getElementById('musicPanel');
    if (panel) panel.style.display = 'none';
  } else if (currentMusicIndex > idx) {
    // 删的在当前播放的前面 → 索引前移 1
    currentMusicIndex--;
  }

  saveState();
  renderMusicList();
  showToast('已删除');
}

function openMusicImport() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.multiple = true;
  input.onchange = function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    var loaded = 0;
    var total = files.length;
    for (var i = 0; i < files.length; i++) {
      (function(file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var audio = new Audio();
          audio.src = ev.target.result;
          audio.addEventListener('loadedmetadata', function() {
            var song = {
              id: 'song_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              fileName: file.name,
              title: file.name.replace(/\.[^.]+$/, ''),
              artist: '未知艺术家',
              duration: Math.floor(audio.duration) || 0,
              dataUrl: ev.target.result,
              addedAt: Date.now()
            };
            state.musicLibrary.songs.push(song);
            loaded++;
            if (loaded === total) {
              saveState();
              renderMusicList();
              showToast('成功导入 ' + total + ' 首音乐');
            }
          });
        };
        reader.readAsDataURL(file);
      })(files[i]);
    }
  };
  input.click();
}

// ===== 音乐功能 · 播放器 =====
var musicPlayer = new Audio();
var currentMusicIndex = -1;
musicPlayer.addEventListener('timeupdate', function() {
  updateMusicBar();
});
musicPlayer.addEventListener('loadedmetadata', function() {
  updateMusicBar();
});
musicPlayer.addEventListener('ended', function() {
  nextMusic();
});
musicPlayer.addEventListener('play', function() {
  var btn = document.getElementById('musicBarPlayBtn');
  if (btn) btn.textContent = '⏸';
  updateMusicBar();
});
musicPlayer.addEventListener('pause', function() {
  var btn = document.getElementById('musicBarPlayBtn');
  if (btn) btn.textContent = '▶';
});

setTimeout(function() {
  var ball = document.getElementById('musicBall');
  if (ball) ball.style.display = 'none';
  var panel = document.getElementById('musicPanel');
  if (panel) panel.style.display = 'none';
}, 100);

function playMusic(idx) {
  var songs = state.musicLibrary.songs || [];
  if (idx < 0 || idx >= songs.length) return;
  currentMusicIndex = idx;
  musicPlayer.src = songs[idx].dataUrl;
  // 立刻刷新一次，把歌名和时长填上
  updateMusicBar();
  document.getElementById('musicBall').style.display = 'none';
  document.getElementById('musicPanel').style.display = 'block';
  musicPlayer.play().then(function() {
    updateMusicBar();
  }).catch(function(e) {
    showToast('播放失败：' + e.message);
  });
}

function showMusicBall() {
  document.getElementById('musicBall').style.display = 'flex';
}

function expandMusicPanel() {
  document.getElementById('musicBall').style.display = 'none';
  document.getElementById('musicPanel').style.display = 'block';
  updateMusicBar();
}

function collapseMusicPanel() {
  document.getElementById('musicPanel').style.display = 'none';
  document.getElementById('musicBall').style.display = 'flex';
}

function togglePlayMusic() {
  if (!musicPlayer.src) return;
  if (musicPlayer.paused) {
    musicPlayer.play();
    updateMusicBar();
  } else {
    musicPlayer.pause();
    updateMusicBar();
  }
}

function updateMusicBar() {
  var songs = state.musicLibrary.songs || [];
  if (currentMusicIndex < 0 || currentMusicIndex >= songs.length) {
    var ball = document.getElementById('musicBall');
    if (ball) ball.style.display = 'none';
    var panel = document.getElementById('musicPanel');
    if (panel) panel.style.display = 'none';
    return;
  }
  var s = songs[currentMusicIndex];
  var titleEl = document.getElementById('musicBarTitle');
  var artistEl = document.getElementById('musicBarArtist');
  if (titleEl) titleEl.textContent = s.title || s.fileName || '未命名';
  if (artistEl) artistEl.textContent = s.artist || '未知艺术家';
  var playBtn = document.getElementById('musicBarPlayBtn');
  if (playBtn) playBtn.textContent = musicPlayer.paused ? '▶' : '⏸';

  var cur = musicPlayer.currentTime || 0;
  // 【修复】duration 优先从歌曲元数据读，避免加载延迟
  var dur = musicPlayer.duration;
  if (!dur || isNaN(dur) || dur === Infinity) {
    dur = s.duration || 0;
  }
  var curEl = document.getElementById('musicBarCurrent');
  var durEl = document.getElementById('musicBarDuration');
  if (curEl) curEl.textContent = formatMinSec(cur);
  if (durEl) durEl.textContent = formatMinSec(dur);
  var prog = document.getElementById('musicBarProgress');
  if (prog && dur > 0) prog.value = (cur / dur) * 100;

  var innerProg = document.getElementById('musicBallProgressInner');
  if (innerProg && dur > 0) innerProg.style.width = ((cur / dur) * 100) + '%';
}

function formatMinSec(sec) {
  sec = Math.floor(sec) || 0;
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function stopMusic() {
  musicPlayer.pause();
  musicPlayer.currentTime = 0;
  currentMusicIndex = -1;
  document.getElementById('musicBall').style.display = 'none';
  document.getElementById('musicPanel').style.display = 'none';
}

function nextMusic() {
  var songs = state.musicLibrary.songs || [];
  if (songs.length === 0) return;
  currentMusicIndex = (currentMusicIndex + 1) % songs.length;
  playMusic(currentMusicIndex);
}

function prevMusic() {
  var songs = state.musicLibrary.songs || [];
  if (songs.length === 0) return;
  currentMusicIndex = (currentMusicIndex - 1 + songs.length) % songs.length;
  playMusic(currentMusicIndex);
}

// 进度条拖动
document.addEventListener('input', function(e) {
  if (e.target && e.target.id === 'musicBarProgress') {
    var dur = musicPlayer.duration || 0;
    if (dur > 0) {
      musicPlayer.currentTime = (e.target.value / 100) * dur;
    }
  }
  });

  // ===== 音乐悬浮球 · 点击展开 + 拖拽 =====
(function bindMusicBall() {
  var ball = document.getElementById('musicBall');
  if (!ball) { setTimeout(bindMusicBall, 300); return; }
  if (ball._bound) return;
  ball._bound = true;

  var isDragging = false;
  var moved = false;
  var startX = 0, startY = 0;
  var startLeft = 0, startTop = 0;
  var phone = document.querySelector('.phone');
  var lastDragTime = 0;

  function onStart(e) {
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    var phoneRect = phone.getBoundingClientRect();
    var ballRect = ball.getBoundingClientRect();
    startX = cx;
    startY = cy;
    startLeft = ballRect.left - phoneRect.left;
    startTop = ballRect.top - phoneRect.top;
    moved = false;
    isDragging = true;
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
    ball.style.left = startLeft + 'px';
    ball.style.top = startTop + 'px';
    ball.classList.add('dragging');
  }

  function onMove(e) {
    if (!isDragging) return;
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    var dx = cx - startX;
    var dy = cy - startY;
    // 阈值改成 15px，避免误判
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) moved = true;
    if (!moved) return;
    if (e.cancelable) e.preventDefault();
    var phoneRect = phone.getBoundingClientRect();
    var newLeft = startLeft + dx;
    var newTop = startTop + dy;
    newLeft = Math.max(4, Math.min(newLeft, phoneRect.width - ball.offsetWidth - 4));
    newTop = Math.max(4, Math.min(newTop, phoneRect.height - ball.offsetHeight - 4));
    ball.style.left = newLeft + 'px';
    ball.style.top = newTop + 'px';
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    ball.classList.remove('dragging');

    if (moved) {
      // 拖拽过 → 吸附到左右边
      var phoneRect = phone.getBoundingClientRect();
      var curLeft = parseFloat(ball.style.left) || 0;
      var curTop = parseFloat(ball.style.top) || 0;
      var snapLeft = (curLeft + ball.offsetWidth / 2 < phoneRect.width / 2)
        ? 20
        : (phoneRect.width - ball.offsetWidth - 20);
      ball.style.left = snapLeft + 'px';
      ball.style.top = curTop + 'px';
      lastDragTime = Date.now();
    } else {
      // 纯点击 → 打开面板
      expandMusicPanel();
    }
  }

  ball.addEventListener('touchstart', onStart, { passive: true });
  ball.addEventListener('touchmove', onMove, { passive: false });
  ball.addEventListener('touchend', onEnd);
  ball.addEventListener('touchcancel', onEnd);
  ball.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();

// ===== 梦角状态系统 =====
function tickDreamStatus() {
  if (!state.dreams || state.dreams.length === 0) return;
  var now = Date.now();
  var changed = false;
  state.dreams.forEach(function(d) {
    if (!d.statuses || d.statuses.length === 0) return;
    // 兜底：如果状态池有内容但当前状态为空，立刻选一个
    if (!d.currentStatus) {
      d.currentStatus = d.statuses[0];
      changed = true;
    }
    var last = d.statusUpdateAt || 0;
    if (now - last < 60 * 60 * 1000) return;
    d.statusUpdateAt = now;
    if (Math.random() < 0.5) {
      d.currentStatus = d.statuses[Math.floor(Math.random() * d.statuses.length)];
      changed = true;
    }
  });

  if (changed) {
    saveState();
    try { renderChatList(); } catch(e) {}
    if (state.currentChatId && !state.currentChatId.startsWith('group_')) {
      var d2 = state.dreams.find(function(x){ return x.id === state.currentChatId; });
      var header = document.getElementById('chatHeaderName');
      if (d2 && header) header.textContent = d2.name + (d2.currentStatus ? ' · ' + d2.currentStatus : '');
    }
  }
}

function startDreamStatusTicker() {
  tickDreamStatus();
  setInterval(tickDreamStatus, 5 * 60 * 1000);
}

// ===== 编辑页状态池 =====
function renderDreamStatusList() {
  var d = state.dreams.find(function(x) { return x.id === state.currentEditDreamId; });
  if (!d) return;
  if (!d.statuses) d.statuses = [];
  var list = document.getElementById('dreamStatusList');
  if (!list) return;
  if (d.statuses.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--gray);padding:6px 0;">还没有状态，添加一条试试</div>';
    return;
  }
  list.innerHTML = d.statuses.map(function(s, i) {
    var isCurrent = (d.currentStatus === s);
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:' + (isCurrent ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.03)') + ';border-radius:10px;">' +
      '<span style="font-size:13px;color:var(--text);">' + s + (isCurrent ? ' <span style="color:var(--blue);font-size:11px;">（当前）</span>' : '') + '</span>' +
      '<span onclick="deleteDreamStatus(' + i + ')" style="color:var(--red);cursor:pointer;font-size:16px;padding:0 4px;">×</span>' +
      '</div>';
  }).join('');
}

function addDreamStatus() {
  var d = state.dreams.find(function(x) { return x.id === state.currentEditDreamId; });
  if (!d) return;
  if (!d.statuses) d.statuses = [];
  var input = document.getElementById('newStatusInput');
  var val = (input.value || '').trim();
  if (!val) return;
  if (d.statuses.indexOf(val) > -1) { showToast('该状态已存在'); return; }
  d.statuses.push(val);
  // 如果当前还没有选中的状态，就把这条设为当前
  if (!d.currentStatus) d.currentStatus = val;
  input.value = '';
  saveState();
  renderDreamStatusList();
}

function batchAddDreamStatus() {
  var d = state.dreams.find(function(x) { return x.id === state.currentEditDreamId; });
  if (!d) return;
  var raw = prompt('批量添加状态，每行一个：');
  if (!raw) return;
  var lines = raw.split('\n').map(function(s){return s.trim();}).filter(function(s){return s;});
  if (lines.length === 0) return;
  if (!d.statuses) d.statuses = [];
  var added = 0;
  lines.forEach(function(l) {
    if (d.statuses.indexOf(l) === -1) { d.statuses.push(l); added++; }
  });
  // 如果当前还没有选中的状态，就把新加的第一条设为当前
  if (!d.currentStatus && d.statuses.length > 0) d.currentStatus = d.statuses[0];
  saveState();
  renderDreamStatusList();
  showToast('已添加 ' + added + ' 条');
}

function deleteDreamStatus(i) {
  var d = state.dreams.find(function(x) { return x.id === state.currentEditDreamId; });
  if (!d || !d.statuses) return;
  var removed = d.statuses[i];
  d.statuses.splice(i, 1);
  if (d.currentStatus === removed) d.currentStatus = '';
  saveState();
  renderDreamStatusList();
}
