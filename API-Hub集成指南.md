# 🌐 API Hub 集成指南

## 🎯 目标
将价格清单API集成到API Hub中，实现类似 `https://api-hub-sigma.vercel.app/api/price-list/` 的访问模式

## 📋 新的API结构

### 🏠 API Hub 首页
```
GET https://api-hub-sigma.vercel.app/
```

**响应示例:**
```json
{
  "message": "API Hub - 价格清单服务",
  "version": "2.0.0",
  "description": "API集成中心 - 价格清单模块",
  "modules": {
    "price-list": {
      "name": "价格清单API",
      "endpoints": {
        "/api/price-list/health": "GET - 健康检查",
        "/api/price-list/products": "GET - 获取所有产品",
        "/api/price-list/search": "POST - 搜索产品",
        "/api/price-list/tire-search": "POST - 轮胎规格搜索",
        "/api/price-list/tire-parse": "POST - 轮胎规格解析",
        "/api/price-list/product/:id": "GET - 根据产品ID获取产品信息",
        "/api/price-list/reload": "POST - 重新加载Excel数据"
      }
    }
  }
}
```

### 🔧 价格清单模块端点

#### 1. 模块信息
```
GET https://api-hub-sigma.vercel.app/api/price-list
```

#### 2. 健康检查 ✅
```
GET https://api-hub-sigma.vercel.app/api/price-list/health
```

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-30T...",
  "dataLoaded": true,
  "totalRecords": 296,
  "module": "price-list"
}
```

#### 3. 搜索产品 🔍 (重要)
```
POST https://api-hub-sigma.vercel.app/api/price-list/search
Content-Type: application/json

{
  "query": "1100"
}
```

**响应:**
```json
{
  "success": true,
  "message": "搜索成功",
  "query": "1100",
  "results": [
    {
      "ID Producto": "CCCC137",
      "Producto": "1100 R22 T-2400 14/C",
      "Costo Uni Unitario": 3663.79,
      "Exit.": 1,
      "COSTO CON IVA": 4249.9964,
      "PRECIO FINAL": 5099.99568
    }
  ],
  "total": 1
}
```

#### 4. 根据产品ID查询 🎯
```
GET https://api-hub-sigma.vercel.app/api/price-list/product/CCCC137
```

#### 5. 获取所有产品 📊
```
GET https://api-hub-sigma.vercel.app/api/price-list/products
```

#### 6. 🚗 轮胎规格搜索 (新功能)
```
POST https://api-hub-sigma.vercel.app/api/price-list/tire-search
Content-Type: application/json

# 小型轿车轮胎搜索（3参数）
{
  "width": 155,
  "aspect_ratio": 70,
  "rim_diameter": 13
}

# 货车轮胎搜索（2参数）
{
  "width": 1100,
  "rim_diameter": 22
}
```

**响应:**
```json
{
  "success": true,
  "message": "找到 1 个匹配的小型轿车轮胎",
  "search_params": {
    "width": 155,
    "aspect_ratio": 70,
    "rim_diameter": 13,
    "type": "car"
  },
  "results": [
    {
      "ID Producto": "LL-C29834",
      "Producto": "155 70 13 75T MIRAGE MR-166 AUTO",
      "Exit.": 3,
      "PRECIO FINAL": 932.36,
      "tire_specs": {
        "width": 155,
        "aspect_ratio": 70,
        "rim_diameter": 13,
        "type": "car"
      }
    }
  ],
  "total": 1
}
```

#### 7. 🔬 轮胎规格解析
```
POST https://api-hub-sigma.vercel.app/api/price-list/tire-parse
Content-Type: application/json

{
  "product_name": "155 70 13 75T MIRAGE MR-166 AUTO"
}
```

#### 8. 重新加载数据 🔄
```
POST https://api-hub-sigma.vercel.app/api/price-list/reload
```

## 🤖 Agent 调用示例

### JavaScript/Node.js
```javascript
const API_BASE = 'https://api-hub-sigma.vercel.app';
const PRICE_LIST_MODULE = '/api/price-list';

// 搜索产品
async function searchProduct(query) {
  const response = await fetch(`${API_BASE}${PRICE_LIST_MODULE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return await response.json();
}

// 根据ID查询产品
async function getProductById(id) {
  const response = await fetch(`${API_BASE}${PRICE_LIST_MODULE}/product/${id}`);
  return await response.json();
}

// 使用示例
searchProduct('1100').then(data => {
  console.log('搜索结果:', data.results);
});

getProductById('CCCC137').then(data => {
  console.log('产品信息:', data.producto);
});
```

### Python
```python
import requests

API_BASE = 'https://api-hub-sigma.vercel.app'
PRICE_LIST_MODULE = '/api/price-list'

def search_product(query):
    response = requests.post(f'{API_BASE}{PRICE_LIST_MODULE}/search', 
                           json={'query': query})
    return response.json()

def get_product_by_id(product_id):
    response = requests.get(f'{API_BASE}{PRICE_LIST_MODULE}/product/{product_id}')
    return response.json()

# 使用示例
result = search_product('1100')
print('搜索结果:', result['results'])

product = get_product_by_id('CCCC137')
print('产品信息:', product['producto'])
```

## 📮 Postman 配置

### Environment 设置
- **Variable**: `apiHub`
- **Value**: `https://api-hub-sigma.vercel.app`

### Collection 请求

#### 1. API Hub 首页
- **Method**: GET
- **URL**: `{{apiHub}}/`

#### 2. 价格清单模块信息
- **Method**: GET
- **URL**: `{{apiHub}}/api/price-list`

#### 3. 搜索产品
- **Method**: POST
- **URL**: `{{apiHub}}/api/price-list/search`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "query": "1100"
}
```

#### 4. 查询特定产品
- **Method**: GET
- **URL**: `{{apiHub}}/api/price-list/product/CCCC137`

#### 5. 健康检查
- **Method**: GET
- **URL**: `{{apiHub}}/api/price-list/health`

## 🔄 向后兼容性

为了保持向后兼容，我们保留了原有的API端点，这些端点会重定向到新的结构：

### 旧端点 → 新端点
- `/api/health` → `/api/price-list/health`
- `/api/products` → `/api/price-list/products`
- `/api/product/search` → `/api/price-list/search`
- `/api/product/id/:id` → `/api/price-list/product/:id`
- `/api/reload` → `/api/price-list/reload`

## 🚀 部署到 API Hub

### 方案A: 作为独立应用部署
1. 按照之前的部署指南部署到Vercel
2. 使用自定义域名或子路径

### 方案B: 集成到现有 API Hub
1. 将代码集成到现有的 `api-hub-sigma` 项目中
2. 作为一个模块添加到现有的路由结构

### 方案C: 使用代理/网关
1. 在 API Gateway 中配置路由
2. 将 `/api/price-list/*` 路由到价格清单服务

## 🧪 测试新结构

运行新的演示脚本：
```bash
node demo-api-hub.js
```

## 📊 API Hub 架构优势

1. **模块化**: 每个API作为独立模块
2. **可扩展**: 容易添加新的API模块
3. **统一入口**: 所有API通过同一个Hub访问
4. **版本管理**: 每个模块可以独立版本控制
5. **监控集中**: 统一的日志和监控

## 🔗 相关链接

- **本地测试**: `http://localhost:3000/api/price-list`
- **演示脚本**: `node demo-api-hub.js`
- **API文档**: `GET /api/price-list`
- **健康检查**: `GET /api/price-list/health`

## 📝 注意事项

1. **URL结构**: 新的URL包含 `/api/price-list` 前缀
2. **响应格式**: 增加了 `module` 字段标识
3. **错误处理**: 404响应包含可用端点列表
4. **兼容性**: 旧端点仍然可用（重定向）

🎉 **现在您的API可以通过 API Hub 风格的URL进行访问了！** 