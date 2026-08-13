# 小鹅通企学院 PK赛产品 Demo

GitHub Pages 静态分享版，包含：

- B端企学院管理台配置与活动列表
- C端学员H5的1v1、组队、答题、结算与回顾流程
- 同一浏览器内通过 `localStorage` 和 `BroadcastChannel` 演示B/C端联动

## 演示边界

GitHub Pages不运行Node.js后端，因此本版本使用浏览器本地数据演示产品逻辑。真实多人匹配、跨设备共享活动数据、服务端结算和数据持久化需要部署 `pk-backend/server.js` 到支持Node.js的服务。
