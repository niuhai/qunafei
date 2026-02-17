/**
 * 持续迭代优化脚本
 * 功能：
 * 1. 监控文件变化
 * 2. 自动运行测试
 * 3. 记录优化历史
 * 4. 生成优化报告
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG = {
  watchDirs: ['public', 'routes', 'services', 'utils', 'data'],
  testInterval: 300000,
  maxHistory: 50,
  historyFile: path.join(__dirname, '..', 'data', 'optimization-history.json')
};

let optimizationHistory = [];
let lastTestTime = 0;

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

function loadHistory() {
  try {
    if (fs.existsSync(CONFIG.historyFile)) {
      const data = fs.readFileSync(CONFIG.historyFile, 'utf-8');
      optimizationHistory = JSON.parse(data);
    }
  } catch (err) {
    log('加载历史记录失败: ' + err.message, 'warn');
    optimizationHistory = [];
  }
}

function saveHistory() {
  try {
    const dir = path.dirname(CONFIG.historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (optimizationHistory.length > CONFIG.maxHistory) {
      optimizationHistory = optimizationHistory.slice(-CONFIG.maxHistory);
    }
    
    fs.writeFileSync(CONFIG.historyFile, JSON.stringify(optimizationHistory, null, 2), 'utf-8');
  } catch (err) {
    log('保存历史记录失败: ' + err.message, 'error');
  }
}

function recordOptimization(type, data) {
  const entry = {
    type,
    timestamp: new Date().toISOString(),
    ...data
  };
  optimizationHistory.push(entry);
  saveHistory();
}

async function runTests() {
  log('\n========== 运行自动化测试 ==========', 'info');
  
  return new Promise((resolve) => {
    const testProcess = spawn('node', ['test/auto-test.js'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      const success = code === 0;
      log(`测试结束 - ${success ? '通过' : '失败'}`, success ? 'success' : 'error');
      
      recordOptimization('test', {
        success,
        exitCode: code
      });
      
      resolve(success);
    });
  });
}

function watchFiles() {
  log('开始监控文件变化...', 'info');
  
  CONFIG.watchDirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) return;
    
    fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
      if (filename && !filename.startsWith('.')) {
        log(`文件变化: ${dir}/${filename}`, 'info');
        handleFileChange(dir, filename);
      }
    });
  });
}

function handleFileChange(dir, filename) {
  const now = Date.now();
  
  if (now - lastTestTime < 10000) {
    log('防抖：等待更多文件变化...', 'warn');
    return;
  }
  
  lastTestTime = now;
  
  recordOptimization('file_change', {
    directory: dir,
    file: filename
  });
  
  setTimeout(() => {
    runTests();
  }, 2000);
}

function showStatus() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         持续迭代优化系统 - 状态监控                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  监控目录: ${CONFIG.watchDirs.join(', ')}`);
  console.log(`  历史记录: ${optimizationHistory.length} 条`);
  console.log(`  历史文件: ${CONFIG.historyFile}`);
  console.log('\n  按 Ctrl+C 停止监控\n');
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         持续迭代优化系统 - Continuous Optimization          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  loadHistory();
  showStatus();

  log('首次运行完整测试...', 'info');
  await runTests();
  
  watchFiles();
  
  setInterval(() => {
    log('定时健康检查...', 'info');
    showStatus();
  }, CONFIG.testInterval);
}

main();
