# 项目配置说明

## 配置文件位置

- **主配置文件**：`config/index.js`
- **说明文档**：`config/README.md`（本文件）

## 高德Key信息

| 项目 | 内容 |
|------|------|
| Key | `724e0612e6014b4b03060ae7b10f8508` |
| 平台 | Web服务 |
| 每日额度 | 30万次 |

## 配置项说明

### amap - 高德地图配置

```javascript
amap: {
  key: '你的高德Key',
  geocodeUrl: '地理编码API地址',
  directionUrl: '路径规划API地址',
  dailyQuota: 300000
}
```

### server - 服务器配置

```javascript
server: {
  port: 3000,           // 服务端口
  env: 'development'    // 运行环境
}
```

### cache - 缓存配置

```javascript
cache: {
  expireMinutes: 60,    // 缓存过期时间（分钟）
  cacheFile: './data/cache.json'
}
```

### crawler - 爬虫配置

```javascript
crawler: {
  minDelay: 2000,       // 最小请求间隔（毫秒）
  maxDelay: 5000,       // 最大请求间隔（毫秒）
  maxRetries: 3,        // 失败重试次数
  timeout: 30000        // 请求超时时间
}
```

### transport - 交通估算配置

```javascript
transport: {
  car: { costPerKm: 0.5, speedKmh: 60 },    // 自驾
  train: { costPerKm: 0.4, speedKmh: 200 }, // 高铁
  bus: { costPerKm: 0.3, speedKmh: 80 }     // 大巴
}
```

## 环境变量方式（推荐用于生产环境）

### Windows PowerShell
```powershell
$env:AMAP_KEY="724e0612e6014b4b03060ae7b10f8508"
$env:PORT="3000"
$env:NODE_ENV="development"
```

### Windows CMD
```cmd
set AMAP_KEY=724e0612e6014b4b03060ae7b10f8508
set PORT=3000
set NODE_ENV=development
```

### Linux/Mac
```bash
export AMAP_KEY=724e0612e6014b4b03060ae7b10f8508
export PORT=3000
export NODE_ENV=development
```

## 验证Key是否有效

在浏览器中访问：
```
https://restapi.amap.com/v3/geocode/geo?key=724e0612e6014b4b03060ae7b10f8508&address=烟台
```

如果返回JSON数据且 `status` 为 `1`，说明配置成功。

## 安全提示

⚠️ **请勿将包含真实Key的配置文件提交到GitHub等公共仓库！**

建议做法：
1. 将 `config/index.js` 添加到 `.gitignore`
2. 创建一个 `config/index.example.js` 作为模板（不含真实Key）
3. 新开发者复制模板文件并填入自己的Key
