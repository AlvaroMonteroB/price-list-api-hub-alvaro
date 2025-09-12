// API 测试脚本
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 测试用例
async function testAPI() {
  console.log('🚀 开始API测试...\n');

  // 测试1: 健康检查
  try {
    console.log('📋 测试 1: 健康检查');
    const healthResponse = await makeRequest('GET', '/api/health');
    console.log('✅ 健康检查通过:', healthResponse.status);
    console.log('📊 数据状态:', healthResponse.dataLoaded ? '已加载' : '未加载');
    console.log('📈 数据总数:', healthResponse.totalRecords);
    console.log('');
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
  }

  // 测试2: 获取所有产品
  try {
    console.log('📋 测试 2: 获取所有产品');
    const dataResponse = await makeRequest('GET', '/api/products');
    console.log('✅ 产品获取成功, 总条数:', dataResponse.total);
    if (dataResponse.data && dataResponse.data.length > 0) {
      console.log('📝 第一条产品示例:', JSON.stringify(dataResponse.data[0], null, 2));
    }
    console.log('');
  } catch (error) {
    console.log('❌ 产品获取失败:', error.message);
  }

  // 测试3: 产品搜索API
  try {
    console.log('📋 测试 3: 产品搜索');
    const searchData = {
      query: 'ACEITE'  // 搜索包含 ACEITE 的产品
    };
    
    const searchResponse = await makeRequest('POST', '/api/product/search', searchData);
    console.log('✅ 搜索成功, 结果数量:', searchResponse.total);
    console.log('🔍 搜索关键词:', searchResponse.query);
    if (searchResponse.results && searchResponse.results.length > 0) {
      console.log('📝 第一个搜索结果:', JSON.stringify(searchResponse.results[0], null, 2));
    }
    console.log('');
  } catch (error) {
    console.log('❌ 搜索失败:', error.message);
  }

  // 测试4: 根据产品代码查询
  try {
    console.log('📋 测试 4: 根据产品代码查询');
    // 这里使用一个假设的产品代码，实际使用时需要替换为真实的代码
    const codigoResponse = await makeRequest('GET', '/api/product/code/001');
    console.log('✅ 代码查询成功');
    console.log('📦 产品信息:', JSON.stringify(codigoResponse.producto, null, 2));
    console.log('');
  } catch (error) {
    console.log('❌ 代码查询失败:', error.message);
  }

  // 测试5: 根路径
  try {
    console.log('📋 测试 5: 根路径API文档');
    const rootResponse = await makeRequest('GET', '/');
    console.log('✅ 根路径访问成功');
    console.log('📚 API文档:', rootResponse.message);
    console.log('🔧 API版本:', rootResponse.version);
    console.log('');
  } catch (error) {
    console.log('❌ 根路径访问失败:', error.message);
  }

  console.log('🎉 API测试完成!');
}

// HTTP请求辅助函数
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 运行测试
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = { testAPI }; 