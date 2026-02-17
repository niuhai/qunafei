/**
 * 性能监控脚本
 * 功能：
 * 1. 监控API响应时间
 * 2. 生成性能报告
 * 3. 性能趋势分析
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const REPORT_FILE = path.join(__dirname, '..', 'data', 'performance-report.json');

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
    
    const startTime = Date.now();
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
        const endTime = Date.now();
        try {
          resolve({
            status: res.statusCode,
            data: data,
            json: () => JSON.parse(data),
            responseTime: endTime - startTime
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            json: () => null,
            responseTime: endTime - startTime
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

function loadPerformanceHistory() {
  try {
    if (fs.existsSync(REPORT_FILE)) {
      return JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
    }
  } catch (err) {
    log('加载性能历史失败: ' + err.message, 'warn');
  }
  return { history: [] };
}

function savePerformanceReport(report) {
  try {
    const dir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  } catch (err) {
    log('保存性能报告失败: ' + err.message, 'error');
  }
}

async function benchmarkEndpoint(name, url, options = {}) {
  const results = [];
  
  log(`\n--- 性能基准测试: ${name} ---`, 'info');
  
  for (let i = 0; i < 3; i++) {
    try {
      const res = await makeRequest(url, options);
      results.push({
        attempt: i + 1,
        responseTime: res.responseTime,
        status: res.status,
        success: res.status === 200
      });
      log(`  尝试 ${i + 1}: ${res.responseTime}ms, 状态: ${res.status}`, res.status === 200 ? 'success' : 'warn');
    } catch (err) {
      results.push({
        attempt: i + 1,
        error: err.message,
        success: false
      });
      log(`  尝试 ${i + 1}: 失败 - ${err.message}`, 'error');
    }
    await sleep(200);
  }
  
  const successResults = results.filter(r => r.success);
  const avgTime = successResults.length > 0 
    ? Math.round(successResults.reduce((sum, r) => sum + r.responseTime, 0) / successResults.length)
    : null;
  
  return {
    name,
    url,
    results,
    avgTime,
    successRate: Math.round((successResults.length / results.length) * 100),
    timestamp: new Date().toISOString()
  };
}

async function runAllBenchmarks() {
  const benchmarks = [
    {
      name: '健康检查',
      url: `${BASE_URL}/api/health`
    },
    {
      name: '配置接口',
      url: `${BASE_URL}/api/config`
    },
    {
      name: '周边机场查询',
      url: `${BASE_URL}/api/airports/nearby?city=烟台&radius=200`
    },
    {
      name: '机场搜索',
      url: `${BASE_URL}/api/airports/search?keyword=上海`
    },
    {
      name: '城市列表',
      url: `${BASE_URL}/api/airports/cities/all`
    }
  ];

  const results = [];
  
  for (const bm of benchmarks) {
    const result = await benchmarkEndpoint(bm.name, bm.url);
    results.push(result);
  }
  
  return results;
}

function generateSummary(results) {
  const summary = {
    total: results.length,
    passed: results.filter(r => r.successRate === 100).length,
    avgOverallTime: null,
    fastest: null,
    slowest: null
  };
  
  const validResults = results.filter(r => r.avgTime !== null);
  
  if (validResults.length > 0) {
    summary.avgOverallTime = Math.round(validResults.reduce((sum, r) => sum + r.avgTime, 0) / validResults.length);
    summary.fastest = validResults.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
    summary.slowest = validResults.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
  }
  
  return summary;
}

function printReport(results, summary) {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║               性能监控报告 - Performance Report             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  整体统计                                                  │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  测试端点: ${String(summary.total).padStart(2)} 个                                  │`);
  console.log(`│  通过:     \x1b[32m${String(summary.passed).padStart(2)}\x1b[0m 个 (${Math.round((summary.passed / summary.total) * 100)}%)                       │`);
  if (summary.avgOverallTime) {
    console.log(`│  平均响应: ${String(summary.avgOverallTime).padStart(4)}ms                                   │`);
  }
  console.log('└─────────────────────────────────────────────────────────────┘');
  
  console.log('\n  详细结果:');
  results.forEach((r, i) => {
    const statusColor = r.successRate === 100 ? '\x1b[32m' : '\x1b[33m';
    const timeDisplay = r.avgTime ? `${r.avgTime}ms` : 'N/A';
    console.log(`    ${statusColor}${String(i + 1).padStart(2)}. ${r.name.padEnd(15)} ${timeDisplay.padEnd(8)} (${r.successRate}%通过)\x1b[0m`);
  });
  
  if (summary.fastest) {
    console.log(`\n  🚀 最快: ${summary.fastest.name} (${summary.fastest.avgTime}ms)`);
  }
  if (summary.slowest) {
    console.log(`  🐢 最慢: ${summary.slowest.name} (${summary.slowest.avgTime}ms)`);
  }
  
  console.log('');
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║             性能监控脚本 - Performance Monitor              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    const history = loadPerformanceHistory();
    
    log('开始性能基准测试...', 'info');
    const results = await runAllBenchmarks();
    const summary = generateSummary(results);
    
    printReport(results, summary);
    
    history.history.push({
      timestamp: new Date().toISOString(),
      summary,
      results
    });
    
    if (history.history.length > 50) {
      history.history = history.history.slice(-50);
    }
    
    savePerformanceReport(history);
    log(`\n性能报告已保存到: ${REPORT_FILE}`, 'success');
    
    if (summary.passed === summary.total) {
      log('🎉 所有性能测试通过！', 'success');
    } else {
      log('⚠️ 部分测试需要关注', 'warn');
    }
    
  } catch (err) {
    log('性能监控出错: ' + err.message, 'error');
    console.error(err);
  }
  
  console.log('');
}

main();
