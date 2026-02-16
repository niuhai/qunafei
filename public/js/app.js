const API_BASE = '';

let selectedCities = [];
let allCities = [];
let allAirports = [];

document.addEventListener('DOMContentLoaded', () => {
  initDateInput();
  loadCities();
  loadAirports();
  bindEvents();
});

function initDateInput() {
  const dateInput = document.getElementById('departDate');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = tomorrow.toISOString().split('T')[0];
  dateInput.min = today.toISOString().split('T')[0];
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

  document.getElementById('btnSearch').addEventListener('click', handleSearch);
}

function showCityDropdown(keyword) {
  const dropdown = document.getElementById('cityDropdown');
  const filtered = allCities.filter(c => 
    c.name.includes(keyword) || 
    keyword.length > 0 && c.name.toLowerCase().startsWith(keyword.toLowerCase())
  ).slice(0, 10);

  if (filtered.length === 0) {
    hideCityDropdown();
    return;
  }

  dropdown.innerHTML = filtered.map(city => `
    <div class="city-item" data-city="${city.name}">${city.name}</div>
  `).join('');

  dropdown.querySelectorAll('.city-item').forEach(item => {
    item.addEventListener('click', () => {
      addCity(item.dataset.city);
      hideCityDropdown();
      document.getElementById('originCity').value = '';
    });
  });

  dropdown.classList.add('show');
}

function hideCityDropdown() {
  document.getElementById('cityDropdown').classList.remove('show');
}

function showDestDropdown(keyword) {
  const dropdown = document.getElementById('destDropdown');
  const lowerKeyword = keyword.toLowerCase();
  
  const filtered = allAirports.filter(a => 
    a.code.toLowerCase().includes(lowerKeyword) ||
    a.name.includes(keyword) ||
    a.city.includes(keyword)
  ).slice(0, 10);

  if (filtered.length === 0) {
    hideDestDropdown();
    return;
  }

  dropdown.innerHTML = filtered.map(airport => `
    <div class="city-item" data-value="${airport.code}" data-display="${airport.name} (${airport.code})">
      <strong>${airport.name}</strong>
      <small style="color:#999;margin-left:8px;">${airport.code} - ${airport.city}</small>
    </div>
  `).join('');

  dropdown.querySelectorAll('.city-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('destination').value = item.dataset.value;
      hideDestDropdown();
    });
  });

  dropdown.classList.add('show');
}

function hideDestDropdown() {
  document.getElementById('destDropdown').classList.remove('show');
}

function addCity(cityName) {
  if (selectedCities.includes(cityName)) return;
  selectedCities.push(cityName);
  renderSelectedCities();
}

function removeCity(cityName) {
  selectedCities = selectedCities.filter(c => c !== cityName);
  renderSelectedCities();
}

function renderSelectedCities() {
  const container = document.getElementById('selectedCities');
  container.innerHTML = selectedCities.map(city => `
    <span class="city-tag">
      ${city}
      <span class="remove" data-city="${city}">×</span>
    </span>
  `).join('');

  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => removeCity(btn.dataset.city));
  });
}

async function handleSearch() {
  const originCity = selectedCities.length > 0 ? selectedCities[0] : document.getElementById('originCity').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const date = document.getElementById('departDate').value;
  const radius = document.getElementById('radius').value;
  const sortBy = document.getElementById('sortBy').value;

  if (!originCity) {
    showError('请输入出发城市');
    return;
  }

  if (!destination) {
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

  try {
    const response = await fetch(`${API_BASE}/api/calculate/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originCity,
        destination,
        date,
        radius: parseInt(radius),
        preferences: {
          sortBy
        }
      })
    });

    const data = await response.json();

    if (data.code !== 0) {
      showError(data.message || '查询失败');
      return;
    }

    showAirports(data.data);
    showResults(data.data);

  } catch (err) {
    showError('网络错误: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  const btn = document.getElementById('btnSearch');
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');
  
  btn.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline';
  btnLoading.style.display = loading ? 'inline' : 'none';
}

function hidePanels() {
  document.getElementById('airportsPanel').style.display = 'none';
  document.getElementById('resultsPanel').style.display = 'none';
}

function showError(message) {
  const panel = document.getElementById('errorPanel');
  const msg = document.getElementById('errorMessage');
  msg.textContent = message;
  panel.style.display = 'block';
}

function hideError() {
  document.getElementById('errorPanel').style.display = 'none';
}

function showAirports(data) {
  const panel = document.getElementById('airportsPanel');
  const list = document.getElementById('airportsList');
  
  list.innerHTML = data.recommendations.map(r => `
    <div class="airport-card ${r.airport.distance === 0 ? 'local' : ''}">
      <div class="airport-code">${r.airport.code}</div>
      <div class="airport-name">${r.airport.name}</div>
      <div class="airport-distance">距离: ${r.airport.distance}km</div>
      <div class="airport-transport">${r.transport.type === 'local' ? '本地机场' : `${r.transport.type} ${r.transport.time}分钟 ¥${r.transport.cost}`}</div>
    </div>
  `).join('');

  panel.style.display = 'block';
}

function showResults(data) {
  const panel = document.getElementById('resultsPanel');
  const list = document.getElementById('resultsList');
  
  if (data.recommendations.length === 0) {
    list.innerHTML = '<div class="loading">暂无航班信息</div>';
    panel.style.display = 'block';
    return;
  }

  list.innerHTML = data.recommendations.map((r, index) => `
    <div class="result-card ${index === 0 ? 'best' : ''}">
      <div class="result-header">
        <div class="result-airport">
          ${r.airport.name}
          <span style="font-size: 0.875rem; color: #999; margin-left: 8px;">${r.airport.code}</span>
        </div>
        ${index === 0 ? '<span class="result-badge">⭐ 最优推荐</span>' : ''}
        ${r.savings > 0 ? `<span class="result-badge" style="background: #28a745; color: white;">节省 ¥${r.savings}</span>` : ''}
      </div>
      
      <div class="result-flight">
        <div class="flight-time">
          <div class="time">${r.flight.depTime}</div>
          <div class="airport">${r.airport.code}</div>
        </div>
        <div class="flight-duration">
          <div class="line"></div>
          <div class="flight-info">
            <span class="flight-no">${r.flight.flightNo}</span>
            ${r.flight.isDirect ? ' | 直飞' : ' | 中转'}
          </div>
        </div>
        <div class="flight-time">
          <div class="time">${r.flight.arrTime}</div>
          <div class="airport">${data.destination}</div>
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
        🚄 交通方式: ${r.transport.type} | 耗时 ${r.transport.time} 分钟 | 费用 ¥${r.transport.cost}
      </div>
      ` : ''}
    </div>
  `).join('');

  panel.style.display = 'block';
}
