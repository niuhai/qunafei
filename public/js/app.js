const API_BASE = '';
const STORAGE_KEY = 'qunafei_history';
const MAX_HISTORY = 10;

let selectedCities = [];
let selectedDestinations = [];
let allCities = [];
let allAirports = [];
let searchHistory = [];
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth() + 1;
let calendarFrom = '';
let calendarTo = '';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDateInput();
  loadCities();
  loadAirports();
  loadHistory();
  bindEvents();
  bindLocationEvent();
  renderHistory();
  initMobileEnhancements();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('发现新版本，刷新页面以更新', 'success');
            }
          });
        });
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('qunafei_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (prefersDark) {
    document.documentElement.removeAttribute('data-theme');
  }
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('qunafei_theme')) {
      if (e.matches) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  let newTheme;
  if (currentTheme === 'dark') {
    newTheme = 'light';
  } else if (currentTheme === 'light') {
    newTheme = 'dark';
  } else {
    newTheme = prefersDark ? 'light' : 'dark';
  }
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('qunafei_theme', newTheme);
  
  hapticFeedback('light');
  showToast(`已切换到${newTheme === 'dark' ? '暗色' : '亮色'}模式`, 'success');
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || getSystemTheme();
}

function initMobileEnhancements() {
  if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
  }
  
  initPullToRefresh();
  initTouchGestures();
  initViewportHeight();
  initNetworkStatus();
}

function initPullToRefresh() {
  let startY = 0;
  let pulling = false;
  const threshold = 80;
  
  const container = document.querySelector('.container');
  if (!container) return;
  
  const pullIndicator = document.createElement('div');
  pullIndicator.className = 'pull-to-refresh';
  pullIndicator.innerHTML = '<span class="pull-to-refresh-icon">🔄</span>';
  container.style.position = 'relative';
  container.insertBefore(pullIndicator, container.firstChild);
  
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].pageY;
      pulling = true;
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;
    
    if (diff > 0 && diff < threshold * 2) {
      pullIndicator.classList.add('pulling');
      pullIndicator.style.transform = `translateX(-50%) translateY(${Math.min(diff, threshold)}px)`;
    }
  }, { passive: true });
  
  document.addEventListener('touchend', () => {
    if (pullIndicator.classList.contains('pulling')) {
      const wasPulled = parseInt(pullIndicator.style.transform.match(/\d+/)?.[0] || 0) >= threshold;
      
      if (wasPulled) {
        handleSearch();
      }
      
      pullIndicator.classList.remove('pulling');
      pullIndicator.style.transform = '';
    }
    pulling = false;
  }, { passive: true });
}

function initTouchGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  
  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        handleSwipeRight();
      } else {
        handleSwipeLeft();
      }
    }
  }, { passive: true });
}

function handleSwipeRight() {
  const calendarPanel = document.getElementById('calendarPanel');
  if (calendarPanel.style.display !== 'none') {
    changeMonth(-1);
  }
}

function handleSwipeLeft() {
  const calendarPanel = document.getElementById('calendarPanel');
  if (calendarPanel.style.display !== 'none') {
    changeMonth(1);
  }
}

function initViewportHeight() {
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => {
    setTimeout(setVH, 100);
  });
}

function initNetworkStatus() {
  const updateOnlineStatus = () => {
    if (!navigator.onLine) {
      showOfflineBanner();
    } else {
      hideOfflineBanner();
    }
  };
  
  window.addEventListener('online', () => {
    hideOfflineBanner();
    showToast('网络已恢复', 'success');
  });
  
  window.addEventListener('offline', () => {
    showOfflineBanner();
  });
  
  updateOnlineStatus();
}

function showOfflineBanner() {
  let banner = document.getElementById('offlineBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.className = 'offline-banner';
    banner.innerHTML = `
      <span class="offline-banner-icon">📡</span>
      <span class="offline-banner-text">网络连接已断开，部分功能可能不可用</span>
      <button class="offline-banner-close" onclick="hideOfflineBanner()">✕</button>
    `;
    document.querySelector('.container').insertBefore(banner, document.querySelector('.header').nextSibling);
  }
  banner.style.display = 'flex';
}

function hideOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window;
}

function vibrate(pattern = [10]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

function hapticFeedback(type = 'light') {
  if ('vibrate' in navigator) {
    switch(type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 10, 30]);
        break;
      case 'success':
        navigator.vibrate([10, 50, 10]);
        break;
      case 'error':
        navigator.vibrate([50, 50, 50]);
        break;
    }
  }
}

function initDateInput() {
  const dateInput = document.getElementById('departDate');
  const returnDateInput = document.getElementById('returnDate');
  if (!dateInput || !returnDateInput) {
    console.error('Date input elements not found');
    return;
  }
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = tomorrow.toISOString().split('T')[0];
  dateInput.min = today.toISOString().split('T')[0];
  returnDateInput.min = tomorrow.toISOString().split('T')[0];
  
  dateInput.addEventListener('change', () => {
    if (returnDateInput.value && returnDateInput.value < dateInput.value) {
      returnDateInput.value = dateInput.value;
    }
    returnDateInput.min = dateInput.value;
  });
}

async function loadCities() {
  try {
    const response = await fetch(`${API_BASE}/api/airports/cities/all`);
    const data = await response.json();
    if (data.code === 0) {
      allCities = data.data;
    }
  } catch (err) {
    console.error('Failed to load cities:', err);
  }
}

async function loadAirports() {
  try {
    const response = await fetch(`${API_BASE}/api/airports/search?keyword=`);
    const data = await response.json();
    if (data.code === 0) {
      allAirports = data.data;
    }
  } catch (err) {
    console.error('Failed to load airports:', err);
  }
}

function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      searchHistory = JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searchHistory));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

function addToHistory(origin, dest, date) {
  const entry = { origin, dest, date, timestamp: Date.now() };
  searchHistory = searchHistory.filter(h => 
    !(h.origin === origin && h.dest === dest && h.date === date)
  );
  searchHistory.unshift(entry);
  if (searchHistory.length > MAX_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_HISTORY);
  }
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const panel = document.getElementById('historyPanel');
  const list = document.getElementById('historyList');
  
  if (!panel || !list) {
    console.error('History panel elements not found');
    return;
  }
  
  if (searchHistory.length === 0) {
    panel.style.display = 'none';
    return;
  }

  list.innerHTML = searchHistory.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-route">${item.origin} → ${item.dest}</div>
      <div class="history-date">${item.date}</div>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      const history = searchHistory[index];
      applyHistory(history);
    });
  });

  panel.style.display = 'block';
}

function applyHistory(history) {
  selectedCities = [history.origin];
  renderSelectedCities();
  const destination = document.getElementById('destination');
  const departDate = document.getElementById('departDate');
  if (destination) destination.value = history.dest;
  if (departDate) departDate.value = history.date;
  showToast('已填充搜索条件', 'success');
}

function clearHistory() {
  searchHistory = [];
  saveHistory();
  renderHistory();
  showToast('历史记录已清空', 'success');
}

function resetAllSelections() {
  selectedCities = [];
  selectedDestinations = [];
  renderSelectedCities();
  renderSelectedDestinations();
  const originCity = document.getElementById('originCity');
  const destination = document.getElementById('destination');
  const radius = document.getElementById('radius');
  const sortBy = document.getElementById('sortBy');
  const flexDays = document.getElementById('flexDays');
  const directOnly = document.getElementById('directOnly');
  const morningOnly = document.getElementById('morningOnly');
  const afternoonOnly = document.getElementById('afternoonOnly');
  const welcomePanel = document.getElementById('welcomePanel');
  
  if (originCity) originCity.value = '';
  if (destination) destination.value = '';
  if (radius) radius.value = '200';
  if (sortBy) sortBy.value = 'totalCost';
  if (flexDays) flexDays.value = '3';
  if (directOnly) directOnly.checked = false;
  if (morningOnly) morningOnly.checked = false;
  if (afternoonOnly) afternoonOnly.checked = false;
  
  initDateInput();
  
  hideError();
  hidePanels();
  if (welcomePanel) {
    welcomePanel.style.display = 'block';
  }
  
  showToast('已重置所有选项', 'success');
}

function bindLocationEvent() {
  const btnLocation = document.getElementById('btnLocation');
  if (btnLocation) {
    btnLocation.addEventListener('click', handleGetCurrentLocation);
  }
}

async function handleGetCurrentLocation() {
  const btnLocation = document.getElementById('btnLocation');
  
  if (!navigator.geolocation) {
    showToast('您的浏览器不支持定位功能', 'error');
    return;
  }

  btnLocation.classList.add('loading');
  showToast('正在获取位置...', 'default');

  const tryGeolocation = (options) => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  try {
    const position = await tryGeolocation({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 600000
    });

    const { latitude, longitude } = position.coords;
    const city = await getCityFromCoordinates(latitude, longitude);
    
    if (city) {
      if (!selectedCities.includes(city)) {
        addCity(city);
        showToast(`已设置出发城市: ${city}`, 'success');
      } else {
        showToast(`${city} 已添加`, 'default');
      }
    } else {
      showToast('未找到对应的城市', 'error');
    }
  } catch (error) {
    let message = '定位失败';
    if (error.code === 1) {
      message = '请允许获取位置权限';
    } else if (error.code === 2) {
      message = '无法获取位置信息，请检查网络或GPS';
    } else if (error.code === 3) {
      message = '定位超时，请检查网络连接或手动输入城市';
    }
    showToast(message, 'error');
    console.error('定位错误:', error);
  } finally {
    btnLocation.classList.remove('loading');
  }
}

async function getCityFromCoordinates(lat, lng) {
  try {
    const nearbyAirports = await getNearbyAirportsByCoords(lat, lng, 50);
    if (nearbyAirports.length > 0) {
      return nearbyAirports[0].city;
    }
    
    const cityMap = getCityCoordinateMap();
    let nearestCity = null;
    let minDistance = Infinity;
    
    for (const [cityName, coords] of Object.entries(cityMap)) {
      const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCity = cityName;
      }
    }
    
    if (nearestCity && minDistance < 100) {
      return nearestCity;
    }
    
    return null;
  } catch (err) {
    console.error('Failed to get city from coordinates:', err);
    return null;
  }
}

async function getNearbyAirportsByCoords(lat, lng, radius) {
  const nearby = allAirports.filter(airport => {
    if (!airport.enabled) return false;
    const dist = calculateDistance(lat, lng, airport.lat, airport.lng);
    return dist <= radius;
  }).sort((a, b) => {
    const distA = calculateDistance(lat, lng, a.lat, a.lng);
    const distB = calculateDistance(lat, lng, b.lat, b.lng);
    return distA - distB;
  });
  return nearby;
}

function getCityCoordinateMap() {
  const map = {};
  for (const city of allCities) {
    if (city.lat && city.lng) {
      map[city.name] = { lat: city.lat, lng: city.lng };
    }
  }
  return map;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function bindEvents() {
  const originInput = document.getElementById('originCity');
  const cityDropdown = document.getElementById('cityDropdown');
  
  originInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (value.length > 0) {
      showCityDropdown(value);
    } else {
      hideCityDropdown();
    }
  });

  originInput.addEventListener('focus', () => {
    if (originInput.value.trim().length > 0) {
      showCityDropdown(originInput.value.trim());
    }
  });

  const destInput = document.getElementById('destination');
  const destDropdown = document.getElementById('destDropdown');
  
  destInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (value.length > 0) {
      showDestDropdown(value);
    } else {
      hideDestDropdown();
    }
  });

  destInput.addEventListener('focus', () => {
    if (destInput.value.trim().length > 0) {
      showDestDropdown(destInput.value.trim());
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) {
      hideCityDropdown();
      hideDestDropdown();
    }
  });

  const btnSearch = document.getElementById('btnSearch');
  const btnRetry = document.getElementById('btnRetry');
  const toggleFiltersBtn = document.getElementById('toggleFilters');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const btnCalendar = document.getElementById('btnCalendar');
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');
  const btnMap = document.getElementById('btnMap');
  const closeMap = document.getElementById('closeMap');
  const btnExport = document.getElementById('btnExport');
  const btnInterline = document.getElementById('btnInterline');
  const closeInterline = document.getElementById('closeInterline');
  
  if (btnSearch) btnSearch.addEventListener('click', handleSearch);
  if (btnRetry) btnRetry.addEventListener('click', handleSearch);
  if (toggleFiltersBtn) toggleFiltersBtn.addEventListener('click', toggleFilters);
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
  if (btnCalendar) btnCalendar.addEventListener('click', handleCalendar);
  if (prevMonth) prevMonth.addEventListener('click', () => changeMonth(-1));
  if (nextMonth) nextMonth.addEventListener('click', () => changeMonth(1));
  if (btnMap) btnMap.addEventListener('click', toggleMap);
  if (closeMap) closeMap.addEventListener('click', closeMapPanel);
  if (btnExport) btnExport.addEventListener('click', exportResults);
  if (btnInterline) btnInterline.addEventListener('click', handleInterline);
  if (closeInterline) closeInterline.addEventListener('click', closeInterlinePanel);
  
  const specialPriceCheckbox = document.getElementById('specialPriceOnly');
  if (specialPriceCheckbox) {
    specialPriceCheckbox.addEventListener('change', (e) => {
      const options = document.getElementById('specialPriceOptions');
      if (options) {
        options.style.display = e.target.checked ? 'block' : 'none';
      }
      if (e.target.checked) {
        const flexDays = document.getElementById('flexDays');
        if (flexDays && flexDays.value === '0') {
          flexDays.value = '3';
          showToast('已自动开启灵活日期搜索', 'default');
        }
      }
    });
  }
  
  initDraggableSearchBtn();
  
  document.querySelectorAll('.interline-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.interline-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterInterlineResults(btn.dataset.tab);
    });
  });

  document.querySelectorAll('.tip-item').forEach(tip => {
    tip.addEventListener('click', () => {
      const city = tip.dataset.city;
      if (!selectedCities.includes(city)) {
        addCity(city);
        showToast(`已添加 ${city}`, 'success');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.closest('.city-dropdown')) {
      const btnSearch = document.getElementById('btnSearch');
      const isSearching = btnSearch && !btnSearch.disabled;
      if (isSearching) {
        handleSearch();
      }
    }
    if (e.key === 'Escape') {
      hideCityDropdown();
      hideDestDropdown();
      closeMap();
      const calendarPanel = document.getElementById('calendarPanel');
      if (calendarPanel) {
        calendarPanel.style.display = 'none';
      }
    }
    
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'k':
          e.preventDefault();
          const originCityInput = document.getElementById('originCity');
          if (originCityInput) originCityInput.focus();
          break;
        case 'l':
          e.preventDefault();
          const destinationInput = document.getElementById('destination');
          if (destinationInput) destinationInput.focus();
          break;
        case 'd':
          e.preventDefault();
          const departDateInput = document.getElementById('departDate');
          if (departDateInput) departDateInput.focus();
          break;
        case 'm':
          e.preventDefault();
          toggleMap();
          break;
        case 't':
          e.preventDefault();
          toggleTheme();
          break;
        case 'r':
          e.preventDefault();
          resetSearch();
          break;
        case 'h':
          e.preventDefault();
          const historyPanel = document.getElementById('historyPanel');
          if (historyPanel) {
            historyPanel.style.display = historyPanel.style.display === 'none' ? 'block' : 'none';
          }
          break;
      }
    }
    
    if (e.key === '/' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      document.getElementById('originCity').focus();
    }
    
    if (e.key === '?' && e.shiftKey) {
      e.preventDefault();
      showKeyboardShortcuts();
    }
  });
}

function showKeyboardShortcuts() {
  const shortcuts = [
    { key: 'Ctrl/Cmd + K', action: '聚焦出发城市' },
    { key: 'Ctrl/Cmd + L', action: '聚焦目的地' },
    { key: 'Ctrl/Cmd + D', action: '聚焦日期' },
    { key: 'Ctrl/Cmd + M', action: '切换地图' },
    { key: 'Ctrl/Cmd + T', action: '切换主题' },
    { key: 'Ctrl/Cmd + R', action: '重置搜索' },
    { key: 'Ctrl/Cmd + H', action: '显示/隐藏历史' },
    { key: 'Enter', action: '执行搜索' },
    { key: 'Escape', action: '关闭弹窗' },
    { key: '/', action: '快速聚焦搜索' },
    { key: '?', action: '显示快捷键帮助' }
  ];
  
  const modal = document.createElement('div');
  modal.className = 'shortcuts-modal';
  modal.innerHTML = `
    <div class="shortcuts-content">
      <div class="shortcuts-header">
        <h3>⌨️ 键盘快捷键</h3>
        <button class="btn-close-shortcuts" onclick="this.closest('.shortcuts-modal').remove()">✕</button>
      </div>
      <div class="shortcuts-list">
        ${shortcuts.map(s => `
          <div class="shortcut-item">
            <kbd>${s.key}</kbd>
            <span>${s.action}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showCityDropdown(keyword) {
  const dropdown = document.getElementById('cityDropdown');
  const filtered = allCities.filter(c => 
    c.name.includes(keyword) || 
    (keyword.length > 0 && c.name.toLowerCase().startsWith(keyword.toLowerCase()))
  ).slice(0, 10);

  if (filtered.length === 0) {
    hideCityDropdown();
    return;
  }

  dropdown.innerHTML = filtered.map(city => `
    <div class="city-item" data-city="${city.name}" role="option">
      <strong>${city.name}</strong>
      ${city.province ? `<small style="color:#999;margin-left:8px;">${city.province}</small>` : ''}
    </div>
  `).join('');

  dropdown.querySelectorAll('.city-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      addCity(item.dataset.city);
      hideCityDropdown();
      const originCityInput = document.getElementById('originCity');
      if (originCityInput) originCityInput.value = '';
    });
  });

  dropdown.classList.add('show');
}

function hideCityDropdown() {
  const dropdown = document.getElementById('cityDropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
}

function showDestDropdown(keyword) {
  const dropdown = document.getElementById('destDropdown');
  const lowerKeyword = keyword.toLowerCase();
  
  let filtered = allAirports.filter(a => 
    a.code.toLowerCase().includes(lowerKeyword) ||
    a.name.includes(keyword) ||
    a.city.includes(keyword) ||
    (a.province && a.province.includes(keyword))
  ).slice(0, 15);

  if (filtered.length === 0) {
    const countryMatch = allCities.find(city => 
      city.name && city.name === keyword && city.alias
    );
    if (countryMatch && countryMatch.alias) {
      filtered = allAirports.filter(a => 
        countryMatch.alias.includes(a.city) && a.enabled
      ).slice(0, 10);
    }
  }

  if (filtered.length === 0) {
    hideDestDropdown();
    return;
  }

  dropdown.innerHTML = filtered.map(airport => {
    const isSelected = selectedDestinations.some(d => d.code === airport.code);
    return `
    <div class="city-item ${isSelected ? 'selected' : ''}" data-code="${airport.code}" data-name="${airport.name}" data-city="${airport.city}" role="option">
      <span class="city-checkbox">${isSelected ? '✓' : ''}</span>
      <strong>${airport.name}</strong>
      ${airport.international ? '<span class="intl-badge">国际</span>' : ''}
      <small style="color:#999;margin-left:8px;">${airport.code} - ${airport.city}${airport.province ? `, ${airport.province}` : ''}</small>
    </div>
  `}).join('');

  dropdown.querySelectorAll('.city-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = item.dataset.code;
      const name = item.dataset.name;
      const city = item.dataset.city;
      
      if (selectedDestinations.some(d => d.code === code)) {
        removeDestination(code);
      } else {
        addDestination(code, name, city);
      }
      
      const destinationInput = document.getElementById('destination');
      if (destinationInput) {
        destinationInput.value = '';
        destinationInput.focus();
      }
      showDestDropdown(keyword);
    });
  });

  dropdown.classList.add('show');
}

function hideDestDropdown() {
  const dropdown = document.getElementById('destDropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
}

function addDestination(code, name, city) {
  if (selectedDestinations.some(d => d.code === code)) {
    showToast('该目的地已添加', 'error');
    return;
  }
  selectedDestinations.push({ code, name, city });
  renderSelectedDestinations();
  showToast(`已添加 ${name}`, 'success');
}

function removeDestination(code) {
  selectedDestinations = selectedDestinations.filter(d => d.code !== code);
  renderSelectedDestinations();
}

function renderSelectedDestinations() {
  const container = document.getElementById('selectedDestinations');
  if (!container) {
    console.error('Selected destinations container not found');
    return;
  }
  if (selectedDestinations.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = selectedDestinations.map(d => `
    <span class="city-tag">
      ${d.name} (${d.code})
      <button class="remove-tag" onclick="removeDestination('${d.code}')" aria-label="移除${d.name}">×</button>
    </span>
  `).join('');
}

function addCity(cityName) {
  if (selectedCities.includes(cityName)) {
    showToast('该城市已添加', 'error');
    return;
  }
  selectedCities.push(cityName);
  renderSelectedCities();
}

function removeCity(cityName) {
  selectedCities = selectedCities.filter(c => c !== cityName);
  renderSelectedCities();
}

function renderSelectedCities() {
  const container = document.getElementById('selectedCities');
  if (!container) {
    console.error('Selected cities container not found');
    return;
  }
  container.innerHTML = selectedCities.map(city => `
    <span class="city-tag">
      ${city}
      <span class="remove" data-city="${city}" aria-label="移除 ${city}">×</span>
    </span>
  `).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => removeCity(btn.dataset.city));
  });
}

function toggleFilters() {
  const filters = document.getElementById('advancedFilters');
  const btn = document.getElementById('toggleFilters');
  if (!filters || !btn) return;
  const icon = btn.querySelector('.toggle-icon');
  if (filters.style.display === 'none') {
    filters.style.display = 'block';
    if (icon) icon.textContent = '▼';
  } else {
    filters.style.display = 'none';
    if (icon) icon.textContent = '⚙️';
  }
}

async function handleSearch() {
  const originCityInput = document.getElementById('originCity');
  const destinationInput = document.getElementById('destination');
  const departDateInput = document.getElementById('departDate');
  const returnDateInput = document.getElementById('returnDate');
  const radiusInput = document.getElementById('radius');
  const sortByInput = document.getElementById('sortBy');
  const flexDaysInput = document.getElementById('flexDays');
  const specialPriceOnlyInput = document.getElementById('specialPriceOnly');
  const priceThresholdInput = document.getElementById('priceThreshold');
  
  const originCity = selectedCities.length > 0 ? selectedCities.join(',') : (originCityInput ? originCityInput.value.trim() : '');
  const destinations = selectedDestinations.length > 0 
    ? selectedDestinations.map(d => d.code) 
    : [destinationInput ? destinationInput.value.trim() : ''].filter(Boolean);
  const date = departDateInput ? departDateInput.value : '';
  const returnDate = returnDateInput ? returnDateInput.value : '';
  const radius = radiusInput ? radiusInput.value : '200';
  const sortBy = sortByInput ? sortByInput.value : 'totalCost';
  const flexDays = parseInt(flexDaysInput ? flexDaysInput.value : '0') || 0;
  const specialPriceOnly = specialPriceOnlyInput?.checked || false;
  const priceThreshold = parseInt(priceThresholdInput?.value) || 100;

  if (!originCity) {
    showError('请输入出发城市');
    return;
  }

  if (destinations.length === 0 || !destinations[0]) {
    showError('请输入目的地');
    return;
  }

  if (!date) {
    showError('请选择出发日期');
    return;
  }

  setLoading(true);
  hideError();
  hidePanels();
  const welcomePanel = document.getElementById('welcomePanel');
  const calendarPanel = document.getElementById('calendarPanel');
  if (welcomePanel) {
    welcomePanel.style.display = 'none';
  }
  if (calendarPanel) {
    calendarPanel.style.display = 'none';
  }

  try {
    if (specialPriceOnly && flexDays > 0) {
      await searchSpecialPriceFlights(originCity, destinations[0], date, radius, sortBy, flexDays, priceThreshold);
    } else if (destinations.length > 1) {
      showToast(`正在查询 ${destinations.length} 个目的地...`, 'default');
      await searchMultipleDestinations(originCity, destinations, date, returnDate, radius, sortBy, flexDays);
    } else if (returnDate && returnDate !== date) {
      await searchDateRange(originCity, destinations[0], date, returnDate, radius, sortBy);
    } else if (flexDays > 0) {
      await searchWithFlexibleDates(originCity, destinations[0], date, radius, sortBy, flexDays);
    } else {
      await searchSingleDate(originCity, destinations[0], date, radius, sortBy);
    }

  } catch (err) {
    showError('网络错误: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function searchMultipleDestinations(originCity, destinations, date, returnDate, radius, sortBy, flexDays) {
  const allResults = [];
  const allAirports = [];
  
  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    showToast(`正在查询 ${dest} (${i + 1}/${destinations.length})...`, 'default');
    
    try {
      let response;
      if (returnDate && returnDate !== date) {
        response = await fetch(`${API_BASE}/api/calculate/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originCity: selectedCities.length > 0 ? selectedCities[0] : originCity,
            destination: dest,
            date,
            radius: parseInt(radius),
            preferences: { sortBy }
          })
        });
      } else {
        response = await fetch(`${API_BASE}/api/calculate/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originCity: selectedCities.length > 0 ? selectedCities[0] : originCity,
            destination: dest,
            date,
            radius: parseInt(radius),
            preferences: { sortBy }
          })
        });
      }
      
      const data = await response.json();
      
      if (data.code === 0 && data.data) {
        data.data.recommendations.forEach(r => {
          r.destinationCode = dest;
        });
        allResults.push(...data.data.recommendations);
        
        if (i === 0 && data.data.airports) {
          allAirports.push(...data.data.airports);
        }
      }
    } catch (err) {
      console.error(`查询 ${dest} 失败:`, err);
    }
  }
  
  if (allResults.length === 0) {
    showError('所有目的地均未找到航班');
    return;
  }
  
  allResults.sort((a, b) => a.totalCost.total - b.totalCost.total);
  
  const mergedData = {
    recommendations: allResults.slice(0, 20),
    airports: allAirports,
    originCities: selectedCities.length > 0 ? selectedCities : [originCity],
    destination: destinations.join(', '),
    date,
    radius
  };
  
  showAirports(mergedData);
  showResults(mergedData);
  showToast(`查询完成！共找到 ${allResults.length} 个方案`, 'success');
}

async function searchDateRange(originCity, destination, startDate, endDate, radius, sortBy) {
  showToast('正在查询日期范围...', 'default');
  
  const nearbyResponse = await fetch(`${API_BASE}/api/airports/nearby?city=${encodeURIComponent(selectedCities.length > 0 ? selectedCities[0] : originCity)}&radius=${radius}`);
  const nearbyData = await nearbyResponse.json();

  if (nearbyData.code !== 0 || !nearbyData.data.airports || nearbyData.data.airports.length === 0) {
    showError('未找到周边机场');
    return;
  }

  const airportCodes = nearbyData.data.airports.map(a => a.code).join(',');
  
  const rangeResponse = await fetch(`${API_BASE}/api/flights/range?from=${airportCodes}&to=${destination}&startDate=${startDate}&endDate=${endDate}`);
  const rangeData = await rangeResponse.json();

  if (rangeData.code !== 0) {
    showError(rangeData.message || '日期范围查询失败');
    return;
  }

  addToHistory(selectedCities.length > 0 ? selectedCities[0] : originCity, destination, `${startDate} ~ ${endDate}`);
  showDateRangeResults(rangeData.data, nearbyData.data.airports);
  showToast('日期范围查询成功！', 'success');
}

function showDateRangeResults(data, airports) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  const resultsPanel = document.getElementById('resultsPanel');
  const resultsList = document.getElementById('resultsList');
  const summary = document.getElementById('resultsSummary');
  const count = document.getElementById('airportCount');

  if (!panel || !list || !resultsPanel || !resultsList || !summary || !count) {
    console.error('Date range results elements not found');
    return;
  }

  panel.style.display = 'block';
  count.textContent = `${airports.length} 个机场`;
  
  list.innerHTML = airports.map(a => `
    <div class="airport-card">
      <div class="airport-code">${a.code}</div>
      <div class="airport-name">${a.name}</div>
      <div class="airport-distance">距离: ${a.distance}km</div>
    </div>
  `).join('');

  if (!data.results || data.results.length === 0) {
    resultsList.innerHTML = '<div class="loading">暂无航班信息</div>';
    resultsPanel.style.display = 'block';
    return;
  }

  summary.innerHTML = `
    <div class="summary-item">
      <div class="summary-label">查询范围</div>
      <div class="summary-value">${data.startDate} ~ ${data.endDate}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">最低价</div>
      <div class="summary-value" style="color: var(--success);">¥${data.lowestPrice || '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">平均价</div>
      <div class="summary-value">¥${data.avgPrice || '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">可订天数</div>
      <div class="summary-value">${data.availableDays}/${data.totalDays}</div>
    </div>
  `;

  resultsList.innerHTML = `
    <div class="date-range-results">
      ${data.results.map(r => {
        const isBest = r.minPrice === data.lowestPrice && r.minPrice !== null;
        return `
          <div class="date-range-item ${isBest ? 'best' : ''}" onclick="showDateFlights('${r.date}', ${r.flightCount})">
            <div class="date-info">
              <div class="date-main">${r.date.slice(5)}</div>
              <div class="date-weekday">${r.weekday}</div>
            </div>
            <div class="price-info">
              ${r.minPrice !== null ? `
                <div class="price-main ${isBest ? 'low' : ''}">¥${r.minPrice}</div>
                <div class="price-detail">${r.flightCount} 个航班</div>
              ` : '<div class="price-empty">无航班</div>'}
            </div>
            ${isBest ? '<span class="best-badge">最低</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (data.bestDate && data.bestDate.bestFlight) {
    const best = data.bestDate;
    const fromCityName = data.fromName || getAirportNameByCode(best.bestFlight.from);
    const toCityName = data.toName || getAirportNameByCode(data.to);
    const flightDuration = calculateFlightDuration(best.bestFlight.depTime, best.bestFlight.arrTime);
    const bookingUrl = generateBookingUrl(best.bestFlight.from, data.to, best.date, best.bestFlight.flightNo);
    
    resultsList.innerHTML += `
      <div class="result-card best" style="margin-top: 20px;">
        <div class="result-header">
          <div class="result-airport">
            🏆 最佳出行日期: ${best.date} (${best.weekday})
          </div>
          <span class="result-badge">最低价 ¥${best.minPrice}</span>
        </div>
        <div class="result-flight">
          <div class="flight-time">
            <div class="time">${best.bestFlight.depTime}</div>
            <div class="airport">${fromCityName}</div>
          </div>
          <div class="flight-duration">
            <div class="line"></div>
            <div class="flight-info">
              <span class="flight-no">${best.bestFlight.flightNo}</span>
              <span class="flight-duration-time">${flightDuration}</span>
            </div>
            <div class="flight-type ${best.bestFlight.isDirect ? 'direct' : 'transfer'}">
              ${best.bestFlight.isDirect ? '✈️ 直飞' : '🔄 中转'}
            </div>
          </div>
          <div class="flight-time">
            <div class="time">${best.bestFlight.arrTime}</div>
            <div class="airport">${toCityName}</div>
          </div>
        </div>
        <div class="result-actions">
          <a href="${bookingUrl}" target="_blank" class="btn-booking">
            🔗 前往携程订票
          </a>
          <span class="price-note">价格仅供参考，以实际订票为准</span>
        </div>
      </div>
    `;
  }

  resultsPanel.style.display = 'block';
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showDateFlights(date, count) {
  const departDateInput = document.getElementById('departDate');
  const returnDateInput = document.getElementById('returnDate');
  const flexDaysInput = document.getElementById('flexDays');
  if (departDateInput) departDateInput.value = date;
  if (returnDateInput) returnDateInput.value = '';
  if (flexDaysInput) flexDaysInput.value = '0';
  handleSearch();
}

async function searchSingleDate(originCity, destination, date, radius, sortBy) {
  const directOnly = document.getElementById('directOnly').checked;
  const morningOnly = document.getElementById('morningOnly').checked;
  const afternoonOnly = document.getElementById('afternoonOnly').checked;
  
  let timeFilter = null;
  if (morningOnly && !afternoonOnly) {
    timeFilter = 'morning';
  } else if (afternoonOnly && !morningOnly) {
    timeFilter = 'afternoon';
  }
  
  const response = await fetch(`${API_BASE}/api/calculate/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      originCity: selectedCities.length > 0 ? selectedCities[0] : originCity,
      destination,
      date,
      radius: parseInt(radius),
      preferences: {
        sortBy,
        directOnly,
        timeFilter
      }
    })
  });

  const data = await response.json();

  if (data.code !== 0) {
    showError(data.message || '查询失败');
    return;
  }

  addToHistory(selectedCities.length > 0 ? selectedCities[0] : originCity, destination, date);
  showAirports(data.data);
  showResults(data.data);
  showToast('查询成功！', 'success');
}

async function searchWithFlexibleDates(originCity, destination, date, radius, sortBy, flexDays) {
  showToast('正在查询灵活日期...', 'default');
  
  const nearbyResponse = await fetch(`${API_BASE}/api/airports/nearby?city=${encodeURIComponent(selectedCities.length > 0 ? selectedCities[0] : originCity)}&radius=${radius}`);
  const nearbyData = await nearbyResponse.json();

  if (nearbyData.code !== 0 || !nearbyData.data.airports || nearbyData.data.airports.length === 0) {
    showError('未找到周边机场');
    return;
  }

  const airportCodes = nearbyData.data.airports.map(a => a.code).join(',');
  
  const flexResponse = await fetch(`${API_BASE}/api/flights/flexible?from=${airportCodes}&to=${destination}&date=${date}&days=${flexDays}`);
  const flexData = await flexResponse.json();

  if (flexData.code !== 0) {
    showError(flexData.message || '灵活日期查询失败');
    return;
  }

  addToHistory(selectedCities.length > 0 ? selectedCities[0] : originCity, destination, date);
  showFlexibleResults(flexData.data, nearbyData.data.airports);
  showToast('灵活日期查询成功！', 'success');
}

async function searchSpecialPriceFlights(originCity, destination, date, radius, sortBy, flexDays, priceThreshold) {
  showToast(`正在搜索特价航班（比选定日期低${priceThreshold}元以上）...`, 'default');
  
  const nearbyResponse = await fetch(`${API_BASE}/api/airports/nearby?city=${encodeURIComponent(selectedCities.length > 0 ? selectedCities[0] : originCity)}&radius=${radius}`);
  const nearbyData = await nearbyResponse.json();

  if (nearbyData.code !== 0 || !nearbyData.data.airports || nearbyData.data.airports.length === 0) {
    showError('未找到周边机场');
    return;
  }

  const airportCodes = nearbyData.data.airports.map(a => a.code).join(',');
  
  const flexResponse = await fetch(`${API_BASE}/api/flights/flexible?from=${airportCodes}&to=${destination}&date=${date}&days=${flexDays}`);
  const flexData = await flexResponse.json();

  if (flexData.code !== 0) {
    showError(flexData.message || '灵活日期查询失败');
    return;
  }

  const originDateResult = flexData.data.results.find(r => r.date === flexData.data.originDate);
  const originDatePrice = originDateResult?.minPrice || 0;

  if (!originDatePrice) {
    showError('选定日期无航班信息，无法比较价格');
    return;
  }

  const specialPriceResults = flexData.data.results.filter(r => {
    if (r.minPrice === null || r.date === flexData.data.originDate) return false;
    const savings = originDatePrice - r.minPrice;
    return savings >= priceThreshold;
  });

  if (specialPriceResults.length === 0) {
    addToHistory(selectedCities.length > 0 ? selectedCities[0] : originCity, destination, date);
    showNoSpecialPriceResult(originDatePrice, priceThreshold, flexDays, nearbyData.data.airports);
    showToast('未找到符合条件的特价航班', 'default');
    return;
  }

  specialPriceResults.sort((a, b) => a.minPrice - b.minPrice);

  addToHistory(selectedCities.length > 0 ? selectedCities[0] : originCity, destination, date);
  showSpecialPriceResults(specialPriceResults, originDatePrice, priceThreshold, flexData.data, nearbyData.data.airports);
  showToast(`找到 ${specialPriceResults.length} 个特价航班！`, 'success');
}

function showNoSpecialPriceResult(originPrice, threshold, flexDays, airports) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  const resultsPanel = document.getElementById('resultsPanel');
  const resultsList = document.getElementById('resultsList');
  const count = document.getElementById('airportCount');

  if (!panel || !list || !resultsPanel || !resultsList || !count) {
    console.error('No special price result elements not found');
    return;
  }

  panel.style.display = 'block';
  count.textContent = `${airports.length} 个机场`;
  
  list.innerHTML = airports.map(a => `
    <div class="airport-card">
      <div class="airport-code">${a.code}</div>
      <div class="airport-name">${a.name}</div>
      <div class="airport-distance">距离: ${a.distance}km</div>
    </div>
  `).join('');

  resultsList.innerHTML = `
    <div class="no-special-price">
      <div class="no-result-icon">😕</div>
      <h3>未找到符合条件的特价航班</h3>
      <div class="no-result-info">
        <p>选定日期价格: <strong>¥${originPrice}</strong></p>
        <p>筛选条件: 比选定日期低 <strong>${threshold}元</strong> 以上</p>
        <p>搜索范围: 前后 <strong>${flexDays}天</strong></p>
      </div>
      <div class="no-result-tips">
        <p>💡 建议：</p>
        <ul>
          <li>降低价格阈值（如改为50元）</li>
          <li>扩大日期范围（如前后7天）</li>
          <li>尝试其他目的地</li>
        </ul>
      </div>
    </div>
  `;

  resultsPanel.style.display = 'block';
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showSpecialPriceResults(specialResults, originPrice, threshold, flexData, airports) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  const resultsPanel = document.getElementById('resultsPanel');
  const resultsList = document.getElementById('resultsList');
  const summary = document.getElementById('resultsSummary');
  const count = document.getElementById('airportCount');

  if (!panel || !list || !resultsPanel || !resultsList || !summary || !count) {
    console.error('Special price results elements not found');
    return;
  }

  panel.style.display = 'block';
  count.textContent = `${airports.length} 个机场`;
  
  list.innerHTML = airports.map(a => `
    <div class="airport-card">
      <div class="airport-code">${a.code}</div>
      <div class="airport-name">${a.name}</div>
      <div class="airport-distance">距离: ${a.distance}km</div>
    </div>
  `).join('');

  const maxSavings = originPrice - specialResults[0].minPrice;
  const avgSavings = Math.round(specialResults.reduce((sum, r) => sum + (originPrice - r.minPrice), 0) / specialResults.length);

  summary.innerHTML = `
    <div class="summary-item highlight">
      <div class="summary-label">🏷️ 特价筛选</div>
      <div class="summary-value">找到 ${specialResults.length} 个特价</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">选定日期价格</div>
      <div class="summary-value">¥${originPrice}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">最高节省</div>
      <div class="summary-value" style="color: var(--success); font-weight: bold;">¥${maxSavings}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">平均节省</div>
      <div class="summary-value" style="color: var(--success);">¥${avgSavings}</div>
    </div>
  `;

  resultsList.innerHTML = `
    <div class="special-price-header">
      <span class="special-badge">🏷️ 特价航班</span>
      <span class="special-note">以下日期比选定日期便宜 ${threshold} 元以上</span>
    </div>
    <div class="special-price-list">
      ${specialResults.map((r, index) => {
        const savings = originPrice - r.minPrice;
        const isBest = index === 0;
        return `
          <div class="special-price-item ${isBest ? 'best' : ''}" onclick="selectFlexibleDate('${r.date}')">
            <div class="special-rank">${isBest ? '🏆' : index + 1}</div>
            <div class="special-date-info">
              <div class="special-date">${r.date}</div>
              <div class="special-weekday">${r.weekday}${r.dayOffset === 0 ? '' : r.dayOffset > 0 ? ` (+${r.dayOffset}天)` : ` (${r.dayOffset}天)`}</div>
            </div>
            <div class="special-price-info">
              <div class="special-price">¥${r.minPrice}</div>
              <div class="special-savings">省 ¥${savings}</div>
            </div>
            <div class="special-flights">${r.flightCount} 个航班</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (specialResults[0]?.bestFlight) {
    const best = specialResults[0];
    const fromCityName = getAirportNameByCode(best.bestFlight.from);
    const toCityName = flexData.toName || getAirportNameByCode(flexData.to);
    const flightDuration = calculateFlightDuration(best.bestFlight.depTime, best.bestFlight.arrTime);
    const bookingUrl = generateBookingUrl(best.bestFlight.from, flexData.to, best.date, best.bestFlight.flightNo);
    const savings = originPrice - best.minPrice;
    
    resultsList.innerHTML += `
      <div class="result-card best special-best" style="margin-top: 20px;">
        <div class="result-header">
          <div class="result-airport">
            🏆 最佳特价: ${best.date} (${best.weekday})
          </div>
          <div class="result-badges">
            <span class="result-badge price-badge">¥${best.minPrice}</span>
            <span class="result-badge savings-badge">省¥${savings}</span>
          </div>
        </div>
        <div class="result-flight">
          <div class="flight-time">
            <div class="time">${best.bestFlight.depTime}</div>
            <div class="airport">${fromCityName}</div>
          </div>
          <div class="flight-duration">
            <div class="line"></div>
            <div class="flight-info">
              <span class="flight-no">${best.bestFlight.flightNo}</span>
              <span class="flight-duration-time">${flightDuration}</span>
            </div>
            <div class="flight-type ${best.bestFlight.isDirect ? 'direct' : 'transfer'}">
              ${best.bestFlight.isDirect ? '✈️ 直飞' : '🔄 中转'}
            </div>
          </div>
          <div class="flight-time">
            <div class="time">${best.bestFlight.arrTime}</div>
            <div class="airport">${toCityName}</div>
          </div>
        </div>
        <div class="result-actions">
          <a href="${bookingUrl}" target="_blank" class="btn-booking special-booking">
            🔗 前往携程订票
          </a>
          <span class="price-note">价格仅供参考，以实际订票为准</span>
        </div>
      </div>
    `;
  }

  resultsPanel.style.display = 'block';
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFlexibleResults(data, airports) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  const resultsPanel = document.getElementById('resultsPanel');
  const resultsList = document.getElementById('resultsList');
  const count = document.getElementById('airportCount');

  if (!panel || !list || !resultsPanel || !resultsList || !count) {
    console.error('Flexible results elements not found');
    return;
  }

  panel.style.display = 'block';
  count.textContent = `${airports.length} 个机场`;
  
  list.innerHTML = airports.map(a => `
    <div class="airport-card">
      <div class="airport-code">${a.code}</div>
      <div class="airport-name">${a.name}</div>
      <div class="airport-distance">距离: ${a.distance}km</div>
    </div>
  `).join('');

  if (!data.results || data.results.length === 0) {
    resultsList.innerHTML = '<div class="loading">暂无航班信息</div>';
    resultsPanel.style.display = 'block';
    return;
  }

  const bestPrice = data.results.find(r => r.minPrice !== null)?.minPrice || 0;
  const originDatePrice = data.results.find(r => r.date === data.originDate)?.minPrice || 0;

  resultsList.innerHTML = `
    <div class="flexible-list">
      ${data.results.map(r => {
        const isBest = r.minPrice === bestPrice && r.minPrice !== null;
        const isSelected = r.date === data.originDate;
        const savings = originDatePrice && r.minPrice ? originDatePrice - r.minPrice : 0;
        
        return `
          <div class="flexible-item ${isBest ? 'best' : ''} ${isSelected ? 'selected' : ''}" 
               onclick="selectFlexibleDate('${r.date}')">
            <div class="date">${r.date.slice(5)}</div>
            <div class="weekday">${r.weekday}${r.dayOffset === 0 ? ' (当天)' : r.dayOffset > 0 ? ` (+${r.dayOffset})` : ` (${r.dayOffset})`}</div>
            ${r.minPrice !== null ? `
              <div class="price ${isBest ? 'low' : ''}">¥${r.minPrice}</div>
              ${savings > 0 ? `<div class="savings">省¥${savings}</div>` : ''}
            ` : '<div class="no-flight">无航班</div>'}
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (data.bestDate && data.bestDate.bestFlight) {
    const best = data.bestDate;
    const fromCityName = getAirportNameByCode(best.bestFlight.from);
    const toCityName = data.toName || getAirportNameByCode(data.to);
    const flightDuration = calculateFlightDuration(best.bestFlight.depTime, best.bestFlight.arrTime);
    const bookingUrl = generateBookingUrl(best.bestFlight.from, data.to, best.date, best.bestFlight.flightNo);
    
    resultsList.innerHTML += `
      <div class="result-card best" style="margin-top: 20px;">
        <div class="result-header">
          <div class="result-airport">
            🏆 最佳出行日期: ${best.date} (${best.weekday})
          </div>
          <span class="result-badge">最低价 ¥${best.minPrice}</span>
        </div>
        <div class="result-flight">
          <div class="flight-time">
            <div class="time">${best.bestFlight.depTime}</div>
            <div class="airport">${fromCityName}</div>
          </div>
          <div class="flight-duration">
            <div class="line"></div>
            <div class="flight-info">
              <span class="flight-no">${best.bestFlight.flightNo}</span>
              <span class="flight-duration-time">${flightDuration}</span>
            </div>
            <div class="flight-type ${best.bestFlight.isDirect ? 'direct' : 'transfer'}">
              ${best.bestFlight.isDirect ? '✈️ 直飞' : '🔄 中转'}
            </div>
          </div>
          <div class="flight-time">
            <div class="time">${best.bestFlight.arrTime}</div>
            <div class="airport">${toCityName}</div>
          </div>
        </div>
        <div class="result-actions">
          <a href="${bookingUrl}" target="_blank" class="btn-booking">
            🔗 前往携程订票
          </a>
          <span class="price-note">价格仅供参考，以实际订票为准</span>
        </div>
      </div>
    `;
  }

  resultsPanel.style.display = 'block';
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectFlexibleDate(date) {
  document.getElementById('departDate').value = date;
  document.getElementById('flexDays').value = '0';
  handleSearch();
}

function setLoading(loading) {
  const btn = document.getElementById('btnSearch');
  if (!btn) {
    console.error('Search button not found');
    return;
  }
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');
  
  btn.disabled = loading;
  if (btnText) btnText.style.display = loading ? 'none' : 'inline';
  if (btnLoading) btnLoading.style.display = loading ? 'inline' : 'none';
  
  if (loading) {
    showLoadingSkeleton();
  } else {
    hideLoadingSkeleton();
  }
}

function showLoadingSkeleton() {
  const airportsPanel = document.getElementById('airportsPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  
  if (!airportsPanel || !resultsPanel) {
    console.error('Loading skeleton elements not found');
    return;
  }
  
  airportsPanel.style.display = 'block';
  airportsPanel.innerHTML = `
    <div class="skeleton-panel" style="margin: 0; padding: 0; background: transparent; box-shadow: none; border: none;">
      <div class="panel-header">
        <h3><span class="pulse-dot"></span>正在搜索周边机场...</h3>
        <span class="skeleton skeleton-badge"></span>
      </div>
      <div class="skeleton-cards">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>
  `;
  
  resultsPanel.style.display = 'block';
  resultsPanel.innerHTML = `
    <div class="skeleton-panel" style="margin: 0; padding: 0; background: transparent; box-shadow: none; border: none;">
      <div class="panel-header">
        <h3><span class="pulse-dot"></span>正在分析最优方案...</h3>
      </div>
      <div class="skeleton-flight">
        <div class="skeleton skeleton-time"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-time"></div>
      </div>
      <div class="skeleton-costs">
        <div class="skeleton skeleton-cost"></div>
        <div class="skeleton skeleton-cost"></div>
        <div class="skeleton skeleton-cost"></div>
      </div>
    </div>
  `;
}

function hideLoadingSkeleton() {
}

function hidePanels() {
  const airportsPanel = document.getElementById('airportsPanel');
  const resultsPanel = document.getElementById('resultsPanel');
  if (airportsPanel) {
    airportsPanel.style.display = 'none';
  }
  if (resultsPanel) {
    resultsPanel.style.display = 'none';
  }
}

function showError(message) {
  const panel = document.getElementById('errorPanel');
  const msg = document.getElementById('errorMessage');
  if (!panel || !msg) {
    console.error('Error panel elements not found:', message);
    alert(message);
    return;
  }
  msg.textContent = message;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
  const panel = document.getElementById('errorPanel');
  if (panel) {
    panel.style.display = 'none';
  }
}

function showAirports(data) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  const count = document.getElementById('airportCount');
  
  if (!panel || !list || !count) {
    console.error('Airports panel elements not found');
    return;
  }
  
  count.textContent = `${data.recommendations.length} 个机场`;
  
  list.innerHTML = data.recommendations.map(r => `
    <div class="airport-card ${r.airport.distance === 0 ? 'local' : ''}">
      <div class="airport-code">${r.airport.code}</div>
      <div class="airport-name">${r.airport.name}</div>
      <div class="airport-distance">距离: ${r.airport.distance}km</div>
      <div class="airport-transport">${r.transport.type === 'local' ? '🏠 本地机场' : `🚄 ${r.transport.type} ${r.transport.time}分钟 ¥${r.transport.cost}`}</div>
    </div>
  `).join('');

  panel.style.display = 'block';
  
  const airportsWithCoords = data.recommendations.map(r => {
    const airportData = allAirports.find(a => a.code === r.airport.code);
    return {
      ...r.airport,
      transport: r.transport,
      flight: r.flight,
      lat: airportData?.lat,
      lng: airportData?.lng
    };
  });
  updateMapWithAirports(airportsWithCoords, data.recommendations);
}

function getAirportNameByCode(code) {
  const airport = allAirports.find(a => a.code === code);
  return airport ? `${airport.city} (${code})` : code;
}

function getAirportCityByCode(code) {
  const airport = allAirports.find(a => a.code === code);
  return airport ? airport.city : code;
}

function generateBookingUrl(from, to, date, flightNo) {
  const fromCity = getAirportCityByCode(from);
  const toCity = getAirportCityByCode(to);
  return `https://flights.ctrip.com/online/list/oneway-${encodeURIComponent(fromCity)}-${encodeURIComponent(toCity)}?depdate=${date}`;
}

function showResults(data) {
  const panel = document.getElementById('resultsPanel');
  const list = document.getElementById('resultsList');
  const summary = document.getElementById('resultsSummary');
  
  if (!panel || !list || !summary) {
    console.error('Results panel elements not found');
    return;
  }
  
  currentResultsData = data;
  
  if (data.recommendations.length === 0) {
    list.innerHTML = '<div class="loading">暂无航班信息</div>';
    panel.style.display = 'block';
    return;
  }

  const best = data.recommendations[0];
  const avgPrice = Math.round(data.recommendations.reduce((sum, r) => sum + r.totalCost.total, 0) / data.recommendations.length);
  const searchDate = document.getElementById('departDate').value;

  summary.innerHTML = `
    <div class="summary-item">
      <div class="summary-label">找到方案</div>
      <div class="summary-value">${data.recommendations.length} 个</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">最优价格</div>
      <div class="summary-value">¥${best.totalCost.total}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">平均价格</div>
      <div class="summary-value">¥${avgPrice}</div>
    </div>
    ${best.savings > 0 ? `
    <div class="summary-item">
      <div class="summary-label">最多节省</div>
      <div class="summary-value" style="color: var(--success);">¥${best.savings}</div>
    </div>
    ` : ''}
    <div class="summary-item price-source">
      <div class="summary-label">价格来源</div>
      <div class="summary-value" style="font-size: 0.8rem; color: var(--gray);">模拟数据，仅供参考</div>
    </div>
  `;

  list.innerHTML = data.recommendations.map((r, index) => {
    const fromCityName = getAirportNameByCode(r.airport.code);
    const toCityName = r.flight.toName || getAirportNameByCode(r.flight.to);
    const toCity = getAirportCityByCode(r.flight.to);
    const bookingUrl = generateBookingUrl(r.airport.code, r.flight.to, searchDate, r.flight.flightNo);
    const flightDuration = calculateFlightDuration(r.flight.depTime, r.flight.arrTime);
    const destLabel = r.destinationCode ? `<span class="dest-badge">📍 ${r.destinationCode}</span>` : '';
    
    return `
    <div class="result-card ${index === 0 ? 'best' : ''}" onclick="showFlightDetail(currentResultsData.recommendations[${index}], ${index})" tabindex="0" role="button" aria-label="查看航班详情">
      <div class="select-indicator"></div>
      <div class="result-header">
        <div class="result-airport">
          ${r.airport.name}
          <span style="font-size: 0.875rem; color: #999; margin-left: 8px;">${r.airport.code}</span>
          ${destLabel}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${index === 0 ? '<span class="result-badge">⭐ 最优推荐</span>' : ''}
          ${r.savings > 0 ? `<span class="result-badge" style="background: var(--success); color: white;">💰 节省 ¥${r.savings}</span>` : ''}
        </div>
      </div>
      
      <div class="result-flight ${!r.flight.isDirect ? 'transfer' : ''}">
        <div class="flight-time">
          <div class="time">${r.flight.depTime}</div>
          <div class="airport">${fromCityName}</div>
        </div>
        <div class="flight-duration">
          <div class="line"></div>
          <div class="flight-info">
            <span class="flight-no">${r.flight.flightNo}</span>
            <span class="flight-duration-time">${flightDuration}</span>
          </div>
          <div class="flight-type ${r.flight.isDirect ? 'direct' : 'transfer'}">
            ${r.flight.isDirect ? '✈️ 直飞' : '🔄 中转'}
          </div>
          ${!r.flight.isDirect && r.flight.transferInfo ? `
          <div class="transfer-info">
            <span class="transfer-airport">${r.flight.transferInfo.airport}</span>
            <span class="transfer-time">中转 ${r.flight.transferInfo.waitTime}</span>
          </div>
          ` : ''}
        </div>
        <div class="flight-time">
          <div class="time">${r.flight.arrTime}</div>
          <div class="airport">${toCityName}</div>
        </div>
      </div>

      <div class="result-costs">
        <div class="cost-item">
          <div class="label">机票</div>
          <div class="value">¥${r.flight.price}</div>
        </div>
        <div class="cost-item">
          <div class="label">交通</div>
          <div class="value">¥${r.transport.cost}</div>
        </div>
        <div class="cost-item total">
          <div class="label">总计</div>
          <div class="value">¥${r.totalCost.total}</div>
        </div>
        ${r.savings > 0 ? `
        <div class="cost-item savings">
          <div class="label">节省</div>
          <div class="value">¥${r.savings}</div>
        </div>
        ` : ''}
      </div>

      ${r.transport.type !== 'local' ? `
      <div class="result-transport">
        🚄 交通方式: ${r.transport.type} | ⏱️ 耗时 ${r.transport.time} 分钟 | 💴 费用 ¥${r.transport.cost}
      </div>
      ` : ''}

      <div class="result-actions">
        <a href="${bookingUrl}" target="_blank" class="btn-booking" onclick="event.stopPropagation()">
          🔗 前往携程订票
        </a>
        <span class="price-note">点击卡片查看详情 · 价格仅供参考</span>
      </div>
    </div>
  `}).join('');

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  setTimeout(() => {
    animateCards();
    animatePriceDisplay();
    addHoverEffects();
  }, 100);
}

function calculateFlightDuration(depTime, arrTime) {
  if (!depTime || !arrTime) return '';
  
  const [depH, depM] = depTime.split(':').map(Number);
  const [arrH, arrM] = arrTime.split(':').map(Number);
  
  let totalMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
}

function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Toast element not found:', message);
    return;
  }
  toast.textContent = message;
  toast.className = 'toast';
  if (type === 'success' || type === 'error') {
    toast.classList.add(type);
  }
  toast.classList.add('show');
  
  if (type === 'success') {
    triggerSuccessAnimation();
  }
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function triggerSuccessAnimation() {
  const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      createConfetti(colors[i % colors.length]);
    }, i * 50);
  }
}

function createConfetti(color) {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.style.left = Math.random() * 100 + 'vw';
  confetti.style.top = '-10px';
  confetti.style.background = color;
  confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
  document.body.appendChild(confetti);
  
  setTimeout(() => {
    confetti.remove();
  }, 3000);
}

function animateCards() {
  const cards = document.querySelectorAll('.result-card, .airport-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.animation = `fadeInUp 0.5s ease-out ${index * 0.1}s forwards`;
  });
}

function animateValue(element, start, end, duration) {
  const startTime = performance.now();
  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeProgress);
    element.textContent = '¥' + current;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };
  requestAnimationFrame(update);
}

function animatePriceDisplay() {
  const priceElements = document.querySelectorAll('.cost-item.total .value, .price-main');
  priceElements.forEach(el => {
    const text = el.textContent;
    const match = text.match(/¥?(\d+)/);
    if (match) {
      const endValue = parseInt(match[1]);
      animateValue(el, 0, endValue, 800);
    }
  });
}

function addHoverEffects() {
  document.querySelectorAll('.result-card, .airport-card').forEach(card => {
    card.classList.add('hover-lift');
  });
  
  document.querySelectorAll('.btn-search, .btn-secondary').forEach(btn => {
    btn.classList.add('ripple', 'click-feedback');
  });
}

function triggerErrorShake(element) {
  element.classList.add('animate-shake');
  setTimeout(() => {
    element.classList.remove('animate-shake');
  }, 500);
}

async function handleCalendar() {
  const originCityInput = document.getElementById('originCity');
  const destinationInput = document.getElementById('destination');
  const originCity = selectedCities.length > 0 ? selectedCities[0] : (originCityInput ? originCityInput.value.trim() : '');
  const destination = destinationInput ? destinationInput.value.trim() : '';

  if (!originCity) {
    showToast('请输入出发城市', 'error');
    return;
  }

  if (!destination) {
    showToast('请输入目的地', 'error');
    return;
  }

  try {
    const nearbyResponse = await fetch(`${API_BASE}/api/airports/nearby?city=${encodeURIComponent(originCity)}&radius=200`);
    const nearbyData = await nearbyResponse.json();

    if (nearbyData.code !== 0 || !nearbyData.data.airports || nearbyData.data.airports.length === 0) {
      showToast('未找到周边机场', 'error');
      return;
    }

    calendarFrom = nearbyData.data.airports[0].code;
    calendarTo = destination;

    loadCalendar();
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error');
  }
}

async function loadCalendar() {
  const panel = document.getElementById('calendarPanel');
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calendarTitle');
  const summary = document.getElementById('calendarSummary');

  if (!panel || !grid || !title || !summary) {
    console.error('Calendar elements not found');
    return;
  }

  title.textContent = `${currentCalendarYear}年${currentCalendarMonth}月 价格日历`;
  grid.innerHTML = '<div class="loading">加载中...</div>';
  panel.style.display = 'block';

  try {
    const response = await fetch(`${API_BASE}/api/flights/calendar?from=${calendarFrom}&to=${calendarTo}&year=${currentCalendarYear}&month=${currentCalendarMonth}`);
    const data = await response.json();

    if (data.code !== 0) {
      grid.innerHTML = '<div class="error-message">加载失败</div>';
      return;
    }

    const { calendar, summary: sum } = data.data;

    summary.innerHTML = `
      <div class="stat">
        <div class="stat-label">最低价</div>
        <div class="stat-value low">${sum.lowestPrice ? '¥' + sum.lowestPrice : '-'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">最高价</div>
        <div class="stat-value high">${sum.highestPrice ? '¥' + sum.highestPrice : '-'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">平均价</div>
        <div class="stat-value">${sum.avgPrice ? '¥' + sum.avgPrice : '-'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">可订天数</div>
        <div class="stat-value">${sum.availableDays}/${sum.totalDays}</div>
      </div>
    `;

    const firstDay = new Date(currentCalendarYear, currentCalendarMonth - 1, 1).getDay();
    const today = new Date().toISOString().split('T')[0];
    const selectedDate = document.getElementById('departDate').value;
    const bestPrice = sum.lowestPrice;

    let html = '';
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    calendar.forEach(day => {
      const isToday = day.date === today;
      const isSelected = day.date === selectedDate;
      const isBest = day.minPrice === bestPrice && day.minPrice !== null;
      
      let classes = 'calendar-day';
      if (day.status === 'past') classes += ' past';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      if (isBest) classes += ' best';

      html += `
        <div class="${classes}" onclick="selectCalendarDate('${day.date}', ${day.minPrice !== null})">
          <div class="day-num">${day.day}</div>
          ${day.minPrice !== null ? `<div class="price ${isBest ? '' : 'low'}">¥${day.minPrice}</div>` : ''}
        </div>
      `;
    });

    grid.innerHTML = html;

  } catch (err) {
    grid.innerHTML = '<div class="error-message">加载失败: ' + err.message + '</div>';
  }
}

function selectCalendarDate(date, hasFlight) {
  if (!hasFlight) return;
  const departDateInput = document.getElementById('departDate');
  const calendarPanel = document.getElementById('calendarPanel');
  if (departDateInput) departDateInput.value = date;
  if (calendarPanel) calendarPanel.style.display = 'none';
  handleSearch();
}

function changeMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth > 12) {
    currentCalendarMonth = 1;
    currentCalendarYear++;
  } else if (currentCalendarMonth < 1) {
    currentCalendarMonth = 12;
    currentCalendarYear--;
  }
  loadCalendar();
}

let mapInstance = null;
let mapMarkers = [];
let currentAirportsData = [];

function toggleMap() {
  const mapPanel = document.getElementById('mapPanel');
  if (!mapPanel) {
    console.error('Map panel not found');
    return;
  }
  if (mapPanel.style.display === 'none') {
    showMap();
  } else {
    closeMap();
  }
}

function closeMap() {
  const mapPanel = document.getElementById('mapPanel');
  if (mapPanel) {
    mapPanel.style.display = 'none';
  }
}

function showMap() {
  const mapPanel = document.getElementById('mapPanel');
  const mapContainer = document.getElementById('mapContainer');
  
  if (!mapPanel || !mapContainer) {
    console.error('Map elements not found');
    return;
  }
  
  mapPanel.style.display = 'block';
  mapPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  if (!mapInstance) {
    mapInstance = L.map('mapContainer').setView([35.8617, 104.1954], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(mapInstance);
  }
  
  setTimeout(() => {
    mapInstance.invalidateSize();
    renderAirportMarkers();
  }, 100);
}

function renderAirportMarkers() {
  if (!mapInstance) return;
  
  mapMarkers.forEach(marker => marker.remove());
  mapMarkers = [];
  
  if (currentAirportsData.length === 0) return;
  
  const bounds = [];
  
  currentAirportsData.forEach((airport, index) => {
    if (!airport.lat || !airport.lng) return;
    
    const isLocal = airport.distance === 0;
    const isBest = index === 0;
    
    const markerClass = isBest ? 'airport-marker best' : 
                         isLocal ? 'airport-marker local' : 
                         'airport-marker';
    
    const icon = L.divIcon({
      className: markerClass,
      html: airport.code,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    
    const marker = L.marker([airport.lat, airport.lng], { icon })
      .addTo(mapInstance);
    
    const popupContent = `
      <div class="airport-popup">
        <h4>${airport.name}</h4>
        <p>📍 ${airport.city} · ${airport.code}</p>
        <p>📏 距离: ${airport.distance} km</p>
        ${airport.transport ? `
          <p>🚄 交通: ${airport.transport.type} · ${airport.transport.time}分钟</p>
          <p>💰 交通费: ¥${airport.transport.cost}</p>
        ` : ''}
        ${airport.flight ? `
          <div class="popup-price">✈️ ¥${airport.flight.price}</div>
          <p>${airport.flight.flightNo} · ${airport.flight.depTime}-${airport.flight.arrTime}</p>
        ` : ''}
        ${isBest ? '<span class="popup-badge">⭐ 最优推荐</span>' : ''}
        ${isLocal ? '<span class="popup-badge" style="background: var(--success);">🏠 本地机场</span>' : ''}
      </div>
    `;
    
    marker.bindPopup(popupContent);
    mapMarkers.push(marker);
    bounds.push([airport.lat, airport.lng]);
  });
  
  if (bounds.length > 0) {
    mapInstance.fitBounds(bounds, { padding: [50, 50] });
  }
}

function updateMapWithAirports(airports, recommendations) {
  currentAirportsData = airports.map(airport => {
    const rec = recommendations?.find(r => r.airport?.code === airport.code);
    return {
      ...airport,
      flight: rec?.flight,
      transport: rec?.transport
    };
  });
  
  const mapPanel = document.getElementById('mapPanel');
  if (mapPanel.style.display !== 'none' && mapInstance) {
    renderAirportMarkers();
  }
}

let currentResultsData = null;

function exportResults() {
  if (!currentResultsData || !currentResultsData.recommendations || currentResultsData.recommendations.length === 0) {
    showToast('没有可导出的数据', 'error');
    return;
  }
  
  const format = prompt('请选择导出格式：\n1. CSV\n2. JSON\n3. 复制到剪贴板\n请输入数字 (1/2/3)', '1');
  
  switch(format) {
    case '1':
      exportAsCSV();
      break;
    case '2':
      exportAsJSON();
      break;
    case '3':
      copyToClipboard();
      break;
    default:
      showToast('已取消导出', 'default');
  }
}

function exportAsCSV() {
  const headers = ['排名', '机场代码', '机场名称', '城市', '距离(km)', '航班号', '航空公司', '起飞时间', '到达时间', '机票价格', '交通费用', '总成本', '节省金额'];
  
  const rows = currentResultsData.recommendations.map((r, index) => [
    index + 1,
    r.airport.code,
    r.airport.name,
    r.airport.city,
    r.airport.distance,
    r.flight.flightNo,
    r.flight.airline,
    r.flight.depTime,
    r.flight.arrTime,
    r.flight.price,
    r.transport.cost,
    r.totalCost.total,
    r.savings
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  downloadFile(blob, `航班搜索结果_${currentResultsData.date || new Date().toISOString().split('T')[0]}.csv`);
  showToast('CSV 导出成功！', 'success');
}

function exportAsJSON() {
  const exportData = {
    exportTime: new Date().toISOString(),
    searchParams: {
      originCities: currentResultsData.originCities,
      destination: currentResultsData.destination,
      date: currentResultsData.date,
      radius: currentResultsData.radius
    },
    results: currentResultsData.recommendations.map((r, index) => ({
      rank: index + 1,
      airport: {
        code: r.airport.code,
        name: r.airport.name,
        city: r.airport.city,
        distance: r.airport.distance
      },
      flight: {
        flightNo: r.flight.flightNo,
        airline: r.flight.airline,
        from: r.flight.from,
        to: r.flight.to,
        depTime: r.flight.depTime,
        arrTime: r.flight.arrTime,
        price: r.flight.price,
        isDirect: r.flight.isDirect
      },
      transport: {
        type: r.transport.type,
        time: r.transport.time,
        cost: r.transport.cost
      },
      totalCost: r.totalCost,
      savings: r.savings
    }))
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  downloadFile(blob, `航班搜索结果_${currentResultsData.date || new Date().toISOString().split('T')[0]}.json`);
  showToast('JSON 导出成功！', 'success');
}

function copyToClipboard() {
  const text = currentResultsData.recommendations.map((r, index) => {
    return `${index + 1}. ${r.airport.name}(${r.airport.code}) - ${r.flight.flightNo} ${r.flight.depTime}-${r.flight.arrTime} ¥${r.totalCost.total}${r.savings > 0 ? ` (省¥${r.savings})` : ''}`;
  }).join('\n');
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板！', 'success');
  }).catch(() => {
    showToast('复制失败，请手动选择', 'error');
  });
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function showFlightDetail(result, index) {
  const modal = document.createElement('div');
  modal.className = 'flight-detail-modal';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  const flight = result.flight;
  const transport = result.transport;
  const airport = result.airport;
  const totalCost = result.totalCost;
  
  const duration = calculateFlightDuration(flight.depTime, flight.arrTime);
  
  modal.innerHTML = `
    <div class="flight-detail-content">
      <div class="flight-detail-header">
        <h3>✈️ ${flight.flightNo} 航班详情</h3>
        <button class="btn-close-detail" onclick="this.closest('.flight-detail-modal').remove()">✕</button>
      </div>
      <div class="flight-detail-body">
        <div class="flight-route-visual">
          <div class="route-point">
            <div class="time">${flight.depTime}</div>
            <div class="city">${flight.from.split('-')[0]}</div>
            <div class="airport">${airport.name}</div>
          </div>
          <div class="route-line">
            <div class="duration">${duration}</div>
            <div class="line"></div>
          </div>
          <div class="route-point">
            <div class="time">${flight.arrTime}</div>
            <div class="city">${flight.to.split('-')[0]}</div>
            <div class="airport">${flight.to.split('-')[1] || ''}</div>
          </div>
        </div>
        
        <div class="flight-info-grid">
          <div class="info-item">
            <div class="label">航空公司</div>
            <div class="value">${flight.airline}</div>
          </div>
          <div class="info-item">
            <div class="label">航班类型</div>
            <div class="value">${flight.isDirect ? '直飞' : '经停'}</div>
          </div>
          <div class="info-item">
            <div class="label">出发机场</div>
            <div class="value">${airport.code} · ${airport.city}</div>
          </div>
          <div class="info-item">
            <div class="label">距离城市</div>
            <div class="value">${airport.distance} km</div>
          </div>
        </div>
        
        <div class="cost-breakdown">
          <h4>💰 费用明细</h4>
          <div class="cost-row">
            <span class="label">机票价格</span>
            <span class="value">¥${flight.price}</span>
          </div>
          <div class="cost-row">
            <span class="label">${transport.type === 'local' ? '本地交通' : transport.type + '交通'}</span>
            <span class="value">¥${transport.cost}${transport.type !== 'local' ? ` (${transport.time}分钟)` : ''}</span>
          </div>
          ${totalCost.otherFees ? `
          <div class="cost-row">
            <span class="label">其他费用</span>
            <span class="value">¥${totalCost.otherFees}</span>
          </div>
          ` : ''}
          <div class="cost-row total">
            <span class="label">总成本</span>
            <span class="value">¥${totalCost.total}</span>
          </div>
        </div>
        
        <div class="price-chart-container">
          <div class="price-chart-header">
            <h4>📊 近期价格趋势</h4>
            <span style="color: var(--success); font-size: 0.85rem;">当前为最低价</span>
          </div>
          <div class="price-trend" id="priceTrendChart">
            ${generatePriceTrend(flight.price)}
          </div>
          <div class="trend-labels">
            <span class="trend-label">7天前</span>
            <span class="trend-label">今天</span>
          </div>
        </div>
        
        <div class="flight-actions">
          <button class="btn-book" onclick="bookFlight('${flight.flightNo}', '${flight.depTime}')">
            🔗 前往预订
          </button>
          <button class="btn-share" onclick="shareFlight(${index})">
            📤 分享
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  hapticFeedback('light');
}

function calculateFlightDuration(depTime, arrTime) {
  const [depH, depM] = depTime.split(':').map(Number);
  const [arrH, arrM] = arrTime.split(':').map(Number);
  
  let totalMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}小时${minutes}分钟`;
}

function generatePriceTrend(currentPrice) {
  const bars = [];
  const basePrice = currentPrice;
  let lowestPrice = currentPrice;
  let lowestIndex = 6;
  
  for (let i = 0; i < 7; i++) {
    const variance = (Math.random() - 0.4) * 0.3;
    const price = Math.round(basePrice * (1 + variance));
    if (price < lowestPrice) {
      lowestPrice = price;
      lowestIndex = i;
    }
    bars.push({ price, isLowest: false });
  }
  bars[lowestIndex].isLowest = true;
  bars[6].price = currentPrice;
  bars[6].isLowest = true;
  
  const maxPrice = Math.max(...bars.map(b => b.price));
  
  return bars.map((bar, i) => {
    const height = (bar.price / maxPrice) * 100;
    return `
      <div class="trend-bar ${bar.isLowest ? 'lowest' : ''}" style="height: ${height}%;">
        <div class="tooltip">¥${bar.price}</div>
      </div>
    `;
  }).join('');
}

function bookFlight(flightNo, depTime) {
  const bookingUrls = {
    'ctrip': `https://flights.ctrip.com/online/list/oneway-${flightNo}?depdate=${depTime}`,
    'qunar': `https://flight.qunar.com/site/oneway_list.htm?searchText=${flightNo}`,
    'skyscanner': `https://www.skyscanner.net/transport/flights/${flightNo}/`
  };
  
  const choice = prompt('选择预订平台：\n1. 携程\n2. 去哪儿\n3. Skyscanner\n请输入数字', '1');
  
  const urls = {
    '1': bookingUrls.ctrip,
    '2': bookingUrls.qunar,
    '3': bookingUrls.skyscanner
  };
  
  if (urls[choice]) {
    window.open(urls[choice], '_blank');
    showToast('已打开预订页面', 'success');
  }
}

function shareFlight(index) {
  if (!currentResultsData || !currentResultsData.recommendations[index]) {
    showToast('分享失败', 'error');
    return;
  }
  
  const result = currentResultsData.recommendations[index];
  const flight = result.flight;
  const airport = result.airport;
  
  const shareText = `✈️ 发现超值航班！
${flight.flightNo} ${flight.airline}
${flight.from} → ${flight.to}
${flight.depTime} - ${flight.arrTime}
💰 机票 ¥${flight.price} + 交通 ¥${result.transport.cost} = 总计 ¥${result.totalCost.total}
📍 出发机场：${airport.name} (${airport.code})
#航班比价 #旅行省钱`;
  
  if (navigator.share) {
    navigator.share({
      title: '航班推荐 - 周边机场筛选',
      text: shareText,
      url: window.location.href
    }).then(() => {
      showToast('分享成功！', 'success');
    }).catch(() => {
      copyShareText(shareText);
    });
  } else {
    copyShareText(shareText);
  }
}

function copyShareText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板！', 'success');
  }).catch(() => {
    showToast('复制失败', 'error');
  });
}

let isDragging = false;
let isFloating = false;
let dragStartX, dragStartY;
let btnOriginalRect = null;

function initDraggableSearchBtn() {
  const btn = document.getElementById('btnSearch');
  if (!btn) return;
  
  const hint = document.createElement('span');
  hint.className = 'drag-hint';
  hint.textContent = '拖拽可悬浮';
  btn.appendChild(hint);
  
  btn.addEventListener('mousedown', handleDragStart);
  btn.addEventListener('touchstart', handleDragStart, { passive: false });
  
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  
  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchend', handleDragEnd);
  
  loadFloatingBtnPosition();
}

function handleDragStart(e) {
  if (e.target.closest('.btn-booking') || e.target.closest('a')) return;
  
  const btn = document.getElementById('btnSearch');
  
  if (isFloating) {
    isDragging = true;
    const pos = e.type === 'touchstart' ? e.touches[0] : e;
    dragStartX = pos.clientX - btn.offsetLeft;
    dragStartY = pos.clientY - btn.offsetTop;
    btn.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  
  const pos = e.type === 'touchstart' ? e.touches[0] : e;
  dragStartX = pos.clientX;
  dragStartY = pos.clientY;
  
  btnOriginalRect = btn.getBoundingClientRect();
  
  isDragging = true;
  btn.classList.add('dragging');
  
  btn.style.left = btnOriginalRect.left + 'px';
  btn.style.top = btnOriginalRect.top + 'px';
  btn.style.width = btnOriginalRect.width + 'px';
  
  e.preventDefault();
}

function handleDragMove(e) {
  if (!isDragging) return;
  
  const btn = document.getElementById('btnSearch');
  const pos = e.type === 'touchmove' ? e.touches[0] : e;
  
  const deltaX = pos.clientX - dragStartX;
  const deltaY = pos.clientY - dragStartY;
  
  if (isFloating) {
    const newX = pos.clientX - dragStartX;
    const newY = pos.clientY - dragStartY;
    
    btn.style.left = Math.max(0, Math.min(window.innerWidth - 56, newX)) + 'px';
    btn.style.top = Math.max(0, Math.min(window.innerHeight - 56, newY)) + 'px';
  } else {
    btn.style.left = (btnOriginalRect.left + deltaX) + 'px';
    btn.style.top = (btnOriginalRect.top + deltaY) + 'px';
  }
  
  e.preventDefault();
}

function handleDragEnd(e) {
  if (!isDragging) return;
  
  const btn = document.getElementById('btnSearch');
  isDragging = false;
  
  if (isFloating) {
    btn.style.cursor = 'grab';
    saveFloatingBtnPosition(btn.offsetLeft, btn.offsetTop);
    return;
  }
  
  const rect = btn.getBoundingClientRect();
  const searchPanel = document.querySelector('.search-panel');
  const panelRect = searchPanel.getBoundingClientRect();
  
  const isOutsidePanel = rect.top < panelRect.top - 50 || 
                          rect.bottom > panelRect.bottom + 50 ||
                          rect.left < panelRect.left - 50 || 
                          rect.right > panelRect.right + 50;
  
  if (isOutsidePanel) {
    makeBtnFloating(btn);
    showToast('已切换为悬浮按钮，点击搜索', 'success');
  } else {
    resetBtnPosition(btn);
  }
}

function makeBtnFloating(btn) {
  btn.classList.remove('dragging');
  btn.classList.add('floating');
  
  const rect = btn.getBoundingClientRect();
  btn.style.left = Math.min(rect.left, window.innerWidth - 70) + 'px';
  btn.style.top = Math.min(rect.top, window.innerHeight - 70) + 'px';
  btn.style.width = '56px';
  
  isFloating = true;
  
  btn.removeEventListener('click', handleSearch);
  btn.addEventListener('click', handleFloatingBtnClick);
  
  const savedPos = localStorage.getItem('floatingBtnPos');
  if (savedPos) {
    const { x, y } = JSON.parse(savedPos);
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
  }
}

function resetBtnPosition(btn) {
  btn.classList.remove('dragging');
  btn.style.position = '';
  btn.style.left = '';
  btn.style.top = '';
  btn.style.width = '';
}

function handleFloatingBtnClick(e) {
  if (isDragging) return;
  
  const btn = document.getElementById('btnSearch');
  
  if (e.shiftKey) {
    returnBtnToOriginal(btn);
    return;
  }
  
  handleSearch(e);
  hapticFeedback('medium');
}

function returnBtnToOriginal(btn) {
  btn.classList.remove('floating');
  btn.style.position = '';
  btn.style.left = '';
  btn.style.top = '';
  btn.style.width = '';
  isFloating = false;
  
  btn.removeEventListener('click', handleFloatingBtnClick);
  btn.addEventListener('click', handleSearch);
  
  localStorage.removeItem('floatingBtnPos');
  showToast('按钮已恢复原位', 'success');
}

function saveFloatingBtnPosition(x, y) {
  localStorage.setItem('floatingBtnPos', JSON.stringify({ x, y }));
}

function loadFloatingBtnPosition() {
  const savedPos = localStorage.getItem('floatingBtnPos');
  if (savedPos) {
    const btn = document.getElementById('btnSearch');
    const { x, y } = JSON.parse(savedPos);
    
    btn.classList.add('floating');
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    isFloating = true;
    
    btn.removeEventListener('click', handleSearch);
    btn.addEventListener('click', handleFloatingBtnClick);
  }
}

function closeInterlinePanel() {
  const panel = document.getElementById('interlinePanel');
  if (panel) {
    panel.style.display = 'none';
  }
}

function handleInterline() {
  showToast('联程查询功能开发中', 'default');
}
