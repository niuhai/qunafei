/**
 * 项目配置文件
 * 
 * 注意：此文件包含敏感信息（API Key），请勿提交到公共代码仓库！
 * 建议后续使用环境变量方式管理密钥
 */

module.exports = {
  /**
   * 高德地图API配置
   * 用于地理编码、路径规划等功能
   * 申请地址：https://lbs.amap.com/
   */
  amap: {
    key: '724e0612e6014b4b03060ae7b10f8508',
    // 地理编码API地址
    geocodeUrl: 'https://restapi.amap.com/v3/geocode/geo',
    // 路径规划API地址
    directionUrl: 'https://restapi.amap.com/v3/direction/driving',
    // 每日免费额度：30万次
    dailyQuota: 300000
  },

  /**
   * 服务器配置
   */
  server: {
    // 服务端口
    port: process.env.PORT || 3000,
    // 环境：development | production
    env: process.env.NODE_ENV || 'development'
  },

  /**
   * 缓存配置
   */
  cache: {
    // 航班数据缓存时间（分钟）
    expireMinutes: 60,
    // 缓存文件路径
    cacheFile: './data/cache.json'
  },

  /**
   * 爬虫配置
   */
  crawler: {
    // 请求间隔（毫秒）：2-5秒随机
    minDelay: 2000,
    maxDelay: 5000,
    // 失败重试次数
    maxRetries: 3,
    // 请求超时时间（毫秒）
    timeout: 30000
  },

  /**
   * 交通费用估算配置（MVP阶段备用）
   * 当高德API不可用时使用
   */
  transport: {
    // 自驾：0.5元/km，速度60km/h
    car: { costPerKm: 0.5, speedKmh: 60 },
    // 高铁：0.4元/km，速度200km/h
    train: { costPerKm: 0.4, speedKmh: 200 },
    // 大巴：0.3元/km，速度80km/h
    bus: { costPerKm: 0.3, speedKmh: 80 }
  },

  /**
   * 搜索默认配置
   */
  search: {
    // 默认搜索半径（公里）
    defaultRadius: 200,
    // 最大搜索半径
    maxRadius: 500,
    // 默认排序方式：totalCost | totalTime | price
    defaultSortBy: 'totalCost'
  }
};
