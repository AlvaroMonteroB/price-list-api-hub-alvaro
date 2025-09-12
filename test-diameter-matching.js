const http = require('http');

// 测试配置
const TEST_CONFIG = {
  hostname: 'localhost',
  port: 3000,
  timeout: 10000
};

// 创建HTTP请求的辅助函数
function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: TEST_CONFIG.hostname,
      port: TEST_CONFIG.port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: TEST_CONFIG.timeout
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: result
          });
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// 测试用例
async function testDiameterMatching() {
  console.log('🔧 测试轮胎直径匹配修复');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: '测试 185 65 R15 (带R字符)',
      params: {
        width: 185,
        aspect_ratio: 65,
        rim_diameter: 15
      },
      expectedMessage: '应该能匹配到 185 65 15 和 185 65 R15 格式的轮胎'
    },
    {
      name: '测试 185 65 15 (不带R字符)',
      params: {
        width: 185,
        aspect_ratio: 65,
        rim_diameter: 15
      },
      expectedMessage: '应该能匹配到 185 65 15 和 185 65 R15 格式的轮胎'
    },
    {
      name: '测试 175 65 R14 (另一个规格)',
      params: {
        width: 175,
        aspect_ratio: 65,
        rim_diameter: 14
      },
      expectedMessage: '应该能匹配到 175 65 14 和 175 65 R14 格式的轮胎'
    },
    {
      name: '测试显式 exact_match=false',
      params: {
        width: 185,
        aspect_ratio: 65,
        rim_diameter: 15,
        exact_match: false
      },
      expectedMessage: '使用非精确匹配模式'
    },
    {
      name: '测试显式 exact_match=true',
      params: {
        width: 185,
        aspect_ratio: 65,
        rim_diameter: 15,
        exact_match: true
      },
      expectedMessage: '使用精确匹配模式（应该支持R字符智能匹配）'
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 测试 ${i + 1}: ${testCase.name}`);
    console.log(`🔍 搜索参数: ${JSON.stringify(testCase.params)}`);
    console.log(`💭 期望结果: ${testCase.expectedMessage}`);

    try {
      const result = await makeRequest('/api/price-list/tire-search', testCase.params);
      
      if (result.status === 200) {
        const data = result.data;
        
        if (data.raw) {
          console.log(`✅ 成功响应`);
          console.log(`   - 找到轮胎数量: ${data.raw.totalFound}`);
          console.log(`   - 搜索类型: ${data.raw.searchType}`);
          console.log(`   - 搜索规格: ${data.raw.searchSpec}`);
          console.log(`   - 精确匹配: ${data.raw.searchParams.exactMatch}`);
          
          if (data.raw.results && data.raw.results.length > 0) {
            console.log(`   - 前3个匹配结果:`);
            data.raw.results.slice(0, 3).forEach((tire, index) => {
              console.log(`     ${index + 1}. ${tire.product} - $${tire.price}`);
              if (tire.specs) {
                console.log(`        规格: ${tire.specs.width}/${tire.specs.aspect_ratio}R${tire.specs.rim_diameter}`);
              }
            });
          } else {
            console.log(`   ⚠️  没有找到匹配的轮胎`);
          }
        } else {
          console.log(`❌ 响应格式异常`);
        }
      } else {
        console.log(`❌ 响应失败: HTTP ${result.status}`);
        console.log(`   错误信息: ${result.data.error || '未知错误'}`);
      }
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
    }
    
    console.log('-'.repeat(60));
  }
}

// 测试轮胎规格解析
async function testTireParsing() {
  console.log('\n🔬 测试轮胎规格解析');
  console.log('='.repeat(60));

  const parseTestCases = [
    '185 65 15 82H SAFERICH FRC16',
    '185 65 R15 82H SAFERICH FRC16',
    '185/65R15 82H SAFERICH FRC16',
    '175 65 14 82H MIRAGE MR-166',
    '175 65 R14 82H MIRAGE MR-166'
  ];

  for (let i = 0; i < parseTestCases.length; i++) {
    const productName = parseTestCases[i];
    console.log(`\n📝 解析测试 ${i + 1}: "${productName}"`);
    
    try {
      const result = await makeRequest('/api/price-list/tire-parse', {
        product_name: productName
      });
      
      if (result.status === 200 && result.data.success) {
        const specs = result.data.parsed_specs;
        console.log(`✅ 解析成功:`);
        console.log(`   - 类型: ${specs.type === 'car' ? '小型轿车' : '货车'}`);
        console.log(`   - 宽度: ${specs.width}mm`);
        if (specs.aspect_ratio) {
          console.log(`   - 扁平比: ${specs.aspect_ratio}`);
        }
        console.log(`   - 直径: ${specs.rim_diameter}英寸`);
      } else {
        console.log(`❌ 解析失败: ${result.data.error || '未知错误'}`);
      }
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
    }
  }
}

// 主测试函数
async function runTests() {
  console.log('🚗 轮胎直径匹配功能测试');
  console.log(`🌐 测试服务器: http://${TEST_CONFIG.hostname}:${TEST_CONFIG.port}`);
  console.log(`⏱️  超时时间: ${TEST_CONFIG.timeout}ms`);
  console.log('='.repeat(60));

  try {
    // 首先测试服务器是否运行 - 使用GET请求
    console.log('🔗 检查服务器连接...');
    
    // 修改健康检查为GET请求
    const healthOptions = {
      hostname: TEST_CONFIG.hostname,
      port: TEST_CONFIG.port,
      path: '/api/price-list/health',
      method: 'GET',
      timeout: TEST_CONFIG.timeout
    };

    const healthResult = await new Promise((resolve, reject) => {
      const req = http.request(healthOptions, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              data: result
            });
          } catch (error) {
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
    
    if (healthResult.status === 200) {
      console.log('✅ 服务器运行正常');
      console.log(`   - 数据加载状态: ${healthResult.data.dataLoaded ? '已加载' : '未加载'}`);
      console.log(`   - 总记录数: ${healthResult.data.totalRecords}`);
    } else {
      console.log(`❌ 服务器健康检查失败: HTTP ${healthResult.status}`);
      return;
    }

    // 运行轮胎匹配测试
    await testDiameterMatching();
    
    // 运行轮胎解析测试
    await testTireParsing();
    
    console.log('\n🎉 所有测试完成！');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 测试运行失败:', error.message);
    console.log('\n💡 请确保：');
    console.log('   1. 服务器正在运行 (npm start)');
    console.log('   2. 服务器监听在 localhost:3000');
    console.log('   3. 数据文件已正确加载');
  }
}

// 运行测试
runTests(); 