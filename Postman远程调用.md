# 📮 Postman远程调用指南

## 🌐 使用远程API地址

部署完成后，将本地地址 `http://localhost:3000` 替换为您的远程地址。

### 常见远程地址格式：
- **Vercel**: `https://price-list-api-username.vercel.app`
- **Railway**: `https://price-list-api-production.up.railway.app`
- **Render**: `https://price-list-api.onrender.com`

## 🔧 Postman配置步骤

### 1. 创建Environment
1. 点击Postman右上角的 "Environment" 下拉菜单
2. 点击 "+" 创建新环境
3. 命名为 "生产环境"
4. 添加变量：
   - **Variable**: `baseUrl`
   - **Initial Value**: `https://your-app-name.vercel.app`
   - **Current Value**: `https://your-app-name.vercel.app`

### 2. 更新请求URL
将所有请求中的 `http://localhost:3000` 替换为 `{{baseUrl}}`

## 📋 远程API测试

### 1. 健康检查 ✅
**Method**: `GET`  
**URL**: `{{baseUrl}}/api/health`

**预期响应**:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-30T...",
  "dataLoaded": true,
  "totalRecords": 296
}
```

### 2. 搜索产品 🔍
**Method**: `POST`  
**URL**: `{{baseUrl}}/api/product/search`  
**Headers**: `Content-Type: application/json`  
**Body**:
```json
{
  "query": "1100"
}
```

### 3. 根据ID查询 🎯
**Method**: `GET`  
**URL**: `{{baseUrl}}/api/product/id/CCCC137`

### 4. 获取所有产品 📊
**Method**: `GET`  
**URL**: `{{baseUrl}}/api/products`

## 🔄 环境切换

### 本地开发环境
- **Variable**: `baseUrl`
- **Value**: `http://localhost:3000`

### 生产环境
- **Variable**: `baseUrl`
- **Value**: `https://your-app-name.vercel.app`

通过切换Environment快速在本地和远程之间切换测试。

## 🧪 完整测试Collection

创建名为 "价格清单API - 远程" 的Collection，包含以下请求：

### Collection Variables
```
baseUrl: {{baseUrl}}
```

### 请求列表
1. **健康检查** - `GET {{baseUrl}}/api/health`
2. **API文档** - `GET {{baseUrl}}/`
3. **搜索产品** - `POST {{baseUrl}}/api/product/search`
4. **查询特定产品** - `GET {{baseUrl}}/api/product/id/CCCC137`
5. **获取所有产品** - `GET {{baseUrl}}/api/products`
6. **重新加载数据** - `POST {{baseUrl}}/api/reload`

## 📱 Agent集成示例

### JavaScript (浏览器/Node.js)
```javascript
const API_BASE = 'https://your-app-name.vercel.app';

// 搜索产品
async function searchProduct(query) {
  const response = await fetch(`${API_BASE}/api/product/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return await response.json();
}

// 使用示例
searchProduct('1100').then(data => {
  console.log('搜索结果:', data.results);
});
```

### Python
```python
import requests

API_BASE = 'https://your-app-name.vercel.app'

def search_product(query):
    response = requests.post(f'{API_BASE}/api/product/search', 
                           json={'query': query})
    return response.json()

# 使用示例
result = search_product('1100')
print('搜索结果:', result['results'])
```

## 🚨 常见问题

### 1. CORS错误
如果在浏览器中调用API出现CORS错误，这是正常的。我们的API已经配置了CORS允许跨域请求。

### 2. 响应缓慢
第一次调用可能较慢（冷启动），后续调用会快很多。

### 3. 超时错误
如果请求超时，可能是：
- 网络连接问题
- 服务器冷启动
- 请求数据量过大

### 4. 404错误
检查URL是否正确，确保：
- 基础URL正确
- API路径拼写正确
- 服务已正常部署

## ✅ 测试清单

部署后测试以下功能：

- [ ] 健康检查正常
- [ ] 可以获取所有产品
- [ ] 搜索功能正常
- [ ] 根据ID查询正常
- [ ] 返回数据格式正确
- [ ] 错误处理正常

## 🎯 性能建议

1. **缓存响应**: 对于不经常变化的数据，可以缓存API响应
2. **分页查询**: 对于大量数据，考虑实现分页
3. **错误重试**: 实现自动重试机制
4. **监控**: 设置API监控和报警

## 🔗 有用链接

- **Postman文档**: https://learning.postman.com/
- **API测试最佳实践**: https://www.postman.com/api-platform/api-testing/
- **环境管理**: https://learning.postman.com/docs/sending-requests/managing-environments/

🎉 **现在您可以在世界任何地方使用Postman测试您的API了！** 