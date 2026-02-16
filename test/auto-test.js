/**
 * 航班价格周边机场筛选程序 - 自动化测试脚本
 * 运行方式: node test/auto-test.js
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_DATE = '2026-02-20';

let serverProcess = null;
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  cases: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data,
            json: () => JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            json: () => null
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function startServer() {
  log('正在启动服务器...', 'info');
  
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('服务已启动')) {
        log('服务器启动成功', 'success');
        resolve(true);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      log(`服务器错误: ${data.toString()}`, 'error');
    });

    serverProcess.on('error', (err) => {
      log(`启动失败: ${err.message}`, 'error');
      reject(err);
    });

    setTimeout(() => {
      log('服务器启动超时，尝试继续测试...', 'warn');
      resolve(true);
    }, 10000);
  });
}

function stopServer() {
  if (serverProcess) {
    log('正在停止服务器...', 'info');
    serverProcess.kill();
  }
}

function recordTest(testId, testName, passed, message = '', duration = 0) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✓ ${testId}: ${testName} (${duration}ms)`, 'success');
  } else {
    testResults.failed++;
    log(`✗ ${testId}: ${testName} - ${message}`, 'error');
  }
  
  testResults.cases.push({
    id: testId,
    name: testName,
    passed,
    message,
    duration,
    timestamp: new Date().toISOString()
  });
}

function skipTest(testId, testName, reason) {
  testResults.total++;
  testResults.skipped++;
  log(`⊘ ${testId}: ${testName} - 跳过: ${reason}`, 'warn');
  
  testResults.cases.push({
    id: testId,
    name: testName,
    passed: null,
    skipped: true,
    message: reason,
    timestamp: new Date().toISOString()
  });
}

async function runApiTests() {
  log('\n========== API接口测试 ==========', 'info');

  await testHealthCheck();
  await testConfigApi();
  await testNearbyAirports();
  await testAirportSearch();
  await testAirportInfo();
  await testCitiesApi();
  await testFlightSearch();
  await testRecommendApi();
  await testCostApi();
  await testHistoryApi();
}

async function testHealthCheck() {
  log('\n--- 健康检查接口测试 ---', 'info');
  
  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/health`);
    const data = res.json();
    const duration = Date.now() - startTime;
    
    recordTest('TC-A000', '健康检查接口', 
      res.status === 200 && data.code === 0,
      data.message || 'OK', duration);
  } catch (err) {
    recordTest('TC-A000', '健康检查接口', false, err.message);
  }
}

async function testConfigApi() {
  log('\n--- 配置接口测试 ---', 'info');
  
  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/config`);
    const data = res.json();
    const duration = Date.now() - startTime;
    
    const passed = res.status === 200 && 
                   data.code === 0 && 
                   data.data.defaultRadius !== undefined;
    
    recordTest('TC-A001', '配置接口返回默认值', passed, '', duration);
  } catch (err) {
    recordTest('TC-A001', '配置接口返回默认值', false, err.message);
  }
}

async function testNearbyAirports() {
  log('\n--- 周边机场接口测试 ---', 'info');

  const testCases = [
    { id: 'TC-A010', name: '获取周边机场-正常', params: 'city=烟台&radius=200', expectSuccess: true },
    { id: 'TC-A011', name: '获取周边机场-默认半径', params: 'city=烟台', expectSuccess: true },
    { id: 'TC-A012', name: '获取周边机场-空城市', params: 'city=', expectSuccess: false },
    { id: 'TC-A013', name: '获取周边机场-无效城市', params: 'city=不存在城市xyz', expectSuccess: false },
    { id: 'TC-A014', name: '获取周边机场-超大半径', params: 'city=烟台&radius=9999', expectSuccess: true },
    { id: 'TC-A015', name: '获取周边机场-多城市', params: 'cities=烟台,青岛&radius=200', expectSuccess: true }
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const res = await makeRequest(`${BASE_URL}/api/airports/nearby?${tc.params}`);
      const data = res.json();
      const duration = Date.now() - startTime;
      
      let passed;
      if (tc.expectSuccess) {
        passed = data.code === 0 && (data.data.airports || data.data).length > 0;
      } else {
        passed = data.code !== 0;
      }
      
      recordTest(tc.id, tc.name, passed, '', duration);
    } catch (err) {
      recordTest(tc.id, tc.name, false, err.message);
    }
    await sleep(100);
  }
}

async function testAirportSearch() {
  log('\n--- 机场搜索接口测试 ---', 'info');

  const testCases = [
    { id: 'TC-A020', name: '机场搜索-按代码', params: 'keyword=YNT', expectCount: 1 },
    { id: 'TC-A021', name: '机场搜索-按城市', params: 'keyword=烟台', expectMinCount: 1 },
    { id: 'TC-A022', name: '机场搜索-空关键词', params: '', expectMinCount: 10 }
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const res = await makeRequest(`${BASE_URL}/api/airports/search?${tc.params}`);
      const data = res.json();
      const duration = Date.now() - startTime;
      
      let passed = data.code === 0;
      if (tc.expectCount) {
        passed = passed && data.data.length === tc.expectCount;
      } else if (tc.expectMinCount) {
        passed = passed && data.data.length >= tc.expectMinCount;
      }
      
      recordTest(tc.id, tc.name, passed, `返回${data.data?.length || 0}条`, duration);
    } catch (err) {
      recordTest(tc.id, tc.name, false, err.message);
    }
    await sleep(100);
  }
}

async function testAirportInfo() {
  log('\n--- 机场信息接口测试 ---', 'info');

  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/airports/YNT`);
    const data = res.json();
    const duration = Date.now() - startTime;
    
    const passed = data.code === 0 && data.data.code === 'YNT';
    recordTest('TC-A030', '获取机场信息-正常', passed, '', duration);
  } catch (err) {
    recordTest('TC-A030', '获取机场信息-正常', false, err.message);
  }

  await sleep(100);
  
  const startTime2 = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/airports/INVALID`);
    const data = res.json();
    const duration = Date.now() - startTime2;
    
    recordTest('TC-A031', '获取机场信息-无效代码', data.code !== 0, '', duration);
  } catch (err) {
    recordTest('TC-A031', '获取机场信息-无效代码', false, err.message);
  }
}

async function testCitiesApi() {
  log('\n--- 城市接口测试 ---', 'info');

  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/airports/cities/all`);
    const data = res.json();
    const duration = Date.now() - startTime;
    
    const passed = data.code === 0 && data.data.length > 0;
    recordTest('TC-A040', '获取所有城市', passed, `返回${data.data?.length || 0}个城市`, duration);
  } catch (err) {
    recordTest('TC-A040', '获取所有城市', false, err.message);
  }

  await sleep(100);
  
  const startTime2 = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/airports/cities/search?keyword=烟`);
    const data = res.json();
    const duration = Date.now() - startTime2;
    
    const passed = data.code === 0 && data.data.length > 0;
    recordTest('TC-A041', '搜索城市', passed, `返回${data.data?.length || 0}个城市`, duration);
  } catch (err) {
    recordTest('TC-A041', '搜索城市', false, err.message);
  }
}

async function testFlightSearch() {
  log('\n--- 航班查询接口测试 ---', 'info');

  const testCases = [
    { 
      id: 'TC-A050', 
      name: '航班查询-正常', 
      params: `from=YNT&to=SHA&date=${TEST_DATE}`,
      expectSuccess: true 
    },
    { 
      id: 'TC-A051', 
      name: '航班查询-多机场', 
      params: `from=YNT,TAO&to=SHA&date=${TEST_DATE}`,
      expectSuccess: true 
    },
    { 
      id: 'TC-A052', 
      name: '航班查询-缺少参数', 
      params: `from=YNT&to=SHA`,
      expectSuccess: false 
    },
    { 
      id: 'TC-A053', 
      name: '航班查询-日期格式错误', 
      params: `from=YNT&to=SHA&date=2026/02/20`,
      expectSuccess: true
    },
    { 
      id: 'TC-A054', 
      name: '航班查询-带筛选条件', 
      params: `from=YNT&to=SHA&date=${TEST_DATE}&directOnly=true&minPrice=100&maxPrice=2000`,
      expectSuccess: true 
    }
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const res = await makeRequest(`${BASE_URL}/api/flights/search?${tc.params}`);
      const data = res.json();
      const duration = Date.now() - startTime;
      
      let passed;
      if (tc.expectSuccess) {
        passed = data.code === 0;
      } else {
        passed = data.code !== 0;
      }
      
      recordTest(tc.id, tc.name, passed, `返回${data.data?.length || 0}条航班`, duration);
    } catch (err) {
      recordTest(tc.id, tc.name, false, err.message);
    }
    await sleep(500);
  }
}

async function testRecommendApi() {
  log('\n--- 综合推荐接口测试 ---', 'info');

  const testCases = [
    {
      id: 'TC-A060',
      name: '综合推荐-正常',
      body: {
        originCity: '烟台',
        destination: '上海',
        date: TEST_DATE,
        radius: 200
      },
      expectSuccess: true
    },
    {
      id: 'TC-A061',
      name: '综合推荐-带偏好',
      body: {
        originCity: '烟台',
        destination: '上海',
        date: TEST_DATE,
        radius: 200,
        preferences: {
          sortBy: 'totalTime',
          directOnly: true
        }
      },
      expectSuccess: true
    },
    {
      id: 'TC-A062',
      name: '综合推荐-缺少必填项',
      body: {
        originCity: '烟台'
      },
      expectSuccess: false
    },
    {
      id: 'TC-A063',
      name: '综合推荐-多出发城市',
      body: {
        originCities: ['烟台', '青岛'],
        destination: '上海',
        date: TEST_DATE,
        radius: 200
      },
      expectSuccess: true
    }
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const res = await makeRequest(`${BASE_URL}/api/calculate/recommend`, {
        method: 'POST',
        body: tc.body
      });
      const data = res.json();
      const duration = Date.now() - startTime;
      
      let passed;
      if (tc.expectSuccess) {
        passed = data.code === 0 && data.data.recommendations !== undefined;
      } else {
        passed = data.code !== 0;
      }
      
      recordTest(tc.id, tc.name, passed, `返回${data.data?.recommendations?.length || 0}条推荐`, duration);
    } catch (err) {
      recordTest(tc.id, tc.name, false, err.message);
    }
    await sleep(500);
  }
}

async function testCostApi() {
  log('\n--- 成本计算接口测试 ---', 'info');

  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/calculate/cost`, {
      method: 'POST',
      body: {
        flight: { price: 500 },
        transport: { time: 60, cost: 100 }
      }
    });
    const data = res.json();
    const duration = Date.now() - startTime;
    
    const passed = data.code === 0 && 
                   data.data.total === 630 &&
                   data.data.ticket === 500 &&
                   data.data.transport === 100 &&
                   data.data.timeValue === 30;
    
    recordTest('TC-A070', '成本计算-正常', passed, `总计: ${data.data?.total}`, duration);
  } catch (err) {
    recordTest('TC-A070', '成本计算-正常', false, err.message);
  }

  await sleep(100);
  
  const startTime2 = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/calculate/cost`, {
      method: 'POST',
      body: {}
    });
    const data = res.json();
    const duration = Date.now() - startTime2;
    
    recordTest('TC-A071', '成本计算-缺少参数', data.code !== 0, '', duration);
  } catch (err) {
    recordTest('TC-A071', '成本计算-缺少参数', false, err.message);
  }
}

async function testHistoryApi() {
  log('\n--- 历史记录接口测试 ---', 'info');

  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/api/calculate/history`);
    const data = res.json();
    const duration = Date.now() - startTime;
    
    const passed = data.code === 0 && Array.isArray(data.data);
    recordTest('TC-A080', '获取历史记录', passed, `返回${data.data?.length || 0}条记录`, duration);
  } catch (err) {
    recordTest('TC-A080', '获取历史记录', false, err.message);
  }
}

async function runFrontendTests() {
  log('\n========== 前端页面测试 ==========', 'info');

  await testPageLoad();
  await testStaticResources();
}

async function testPageLoad() {
  log('\n--- 页面加载测试 ---', 'info');

  const startTime = Date.now();
  try {
    const res = await makeRequest(`${BASE_URL}/`);
    const duration = Date.now() - startTime;
    
    const passed = res.status === 200 && 
                   res.data.includes('<!DOCTYPE html>') &&
                   res.data.includes('航班');
    
    recordTest('TC-U001', '首页加载', passed, `${duration}ms`, duration);
  } catch (err) {
    recordTest('TC-U001', '首页加载', false, err.message);
  }
}

async function testStaticResources() {
  log('\n--- 静态资源测试 ---', 'info');

  const resources = [
    { id: 'TC-U010', name: 'CSS样式文件', path: '/css/style.css' },
    { id: 'TC-U011', name: 'JavaScript文件', path: '/js/app.js' }
  ];

  for (const res of resources) {
    const startTime = Date.now();
    try {
      const response = await makeRequest(`${BASE_URL}${res.path}`);
      const duration = Date.now() - startTime;
      
      const passed = response.status === 200 && response.data.length > 0;
      recordTest(res.id, res.name, passed, `${response.data.length} bytes, ${duration}ms`, duration);
    } catch (err) {
      recordTest(res.id, res.name, false, err.message);
    }
    await sleep(100);
  }
}

async function runPerformanceTests() {
  log('\n========== 性能测试 ==========', 'info');

  const tests = [
    { name: '健康检查', url: `${BASE_URL}/api/health` },
    { name: '周边机场', url: `${BASE_URL}/api/airports/nearby?city=烟台&radius=200` },
    { name: '城市列表', url: `${BASE_URL}/api/airports/cities/all` }
  ];

  for (const test of tests) {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      try {
        await makeRequest(test.url);
        times.push(Date.now() - startTime);
      } catch (err) {
        times.push(-1);
      }
      await sleep(200);
    }
    
    const avgTime = times.filter(t => t > 0).reduce((a, b) => a + b, 0) / times.filter(t => t > 0).length;
    const passed = avgTime < 3000;
    
    recordTest(`TC-P00${tests.indexOf(test) + 1}`, `${test.name}响应时间`, passed, `平均: ${Math.round(avgTime)}ms`);
  }
}

function generateReport() {
  log('\n========== 测试报告 ==========', 'info');
  
  const passRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(1) 
    : 0;

  console.log('\n┌──────────────────────────────────────┐');
  console.log('│           浏览器测试结果汇总           │');
  console.log('├──────────────────────────────────────┤');
  console.log(`│  总计: ${String(testResults.total).padStart(3)} 条测试用例              │`);
  console.log(`│  通过: \x1b[32m${String(testResults.passed).padStart(3)}\x1b[0m 条 (${passRate}%)            │`);
  console.log(`│  失败: \x1b[31m${String(testResults.failed).padStart(3)}\x1b[0m 条                       │`);
  console.log(`│  跳过: \x1b[33m${String(testResults.skipped).padStart(3)}\x1b[0m 条                       │`);
  console.log('└──────────────────────────────────────┘');

  const reportPath = path.join(__dirname, 'test-report.json');
  const report = {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      passRate: `${passRate}%`,
      timestamp: new Date().toISOString()
    },
    cases: testResults.cases
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`\n测试报告已保存到: ${reportPath}`, 'success');

  if (testResults.failed > 0) {
    log('\n失败的测试用例:', 'error');
    testResults.cases
      .filter(c => c.passed === false)
      .forEach(c => log(`  - ${c.id}: ${c.name} - ${c.message}`, 'error'));
  }

  return testResults.failed === 0;
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     航班价格周边机场筛选程序 - 自动化测试                   ║');
  console.log('║     Flight Price Nearby Airport Filter - Auto Test         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await startServer();
    await sleep(2000);

    await runApiTests();
    await runFrontendTests();
    await runPerformanceTests();

  } catch (err) {
    log(`测试执行出错: ${err.message}`, 'error');
  } finally {
    const success = generateReport();
    stopServer();
    
    console.log('\n');
    if (success) {
      log('🎉 所有测试通过！', 'success');
    } else {
      log('⚠️ 部分测试失败，请检查报告', 'warn');
    }
    console.log('');
    
    process.exit(success ? 0 : 1);
  }
}

main();
