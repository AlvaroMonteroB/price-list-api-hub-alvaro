const https = require('https');

console.log('🌐 测试远程API - 175/65R15 轮胎搜索...\n');

const testData = {
  width: '175',
  aspectRatio: '65',
  diameter: '15'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'price-list-api-hub-zhu.vercel.app',
  port: 443,
  path: '/api/price-list/tire-search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('📊 远程API搜索结果:');
      console.log(`状态码: ${res.statusCode}`);
      console.log(`搜索规格: ${result.raw?.searchSpec || '未知'}`);
      console.log(`找到数量: ${result.raw?.totalFound || 0}`);
      console.log(`搜索类型: ${result.raw?.searchType || '未知'}`);
      
      if (result.raw?.results && result.raw.results.length > 0) {
        console.log('\n✅ 远程API找到的轮胎:');
        result.raw.results.forEach((tire, index) => {
          console.log(`${index + 1}. ${tire.product} - $${tire.price}`);
        });
      } else {
        console.log('\n❌ 远程API没有找到匹配的轮胎');
        if (result.error) {
          console.log('错误信息:', result.error);
        }
      }
      
    } catch (error) {
      console.error('❌ 解析远程响应失败:', error.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 远程请求失败:', e.message);
});

req.write(postData);
req.end();

// 同时测试健康检查
console.log('\n🔍 检查远程API健康状态...\n');

const healthOptions = {
  hostname: 'price-list-api-hub-zhu.vercel.app',
  port: 443,
  path: '/api/price-list/health',
  method: 'GET'
};

const healthReq = https.request(healthOptions, (res) => {
  let healthData = '';
  
  res.on('data', (chunk) => {
    healthData += chunk;
  });
  
  res.on('end', () => {
    try {
      const healthResult = JSON.parse(healthData);
      console.log('🏥 远程API健康状态:');
      console.log(`数据加载: ${healthResult.raw?.dataLoaded ? '✅' : '❌'}`);
      console.log(`总记录数: ${healthResult.raw?.totalRecords || 0}`);
      console.log(`轮胎数量: ${healthResult.raw?.tireCount || '未知'}`);
      
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      console.log('健康检查原始响应:', healthData);
    }
  });
});

healthReq.on('error', (e) => {
  console.error('❌ 健康检查请求失败:', e.message);
});

healthReq.end(); 