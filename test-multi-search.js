/**
 * 多参数搜索API测试
 * 展示新的搜索功能和各种参数组合
 */

const API_BASE = 'https://price-list-api-hub-m4f8.vercel.app';
// const API_BASE = 'http://localhost:3000'; // 本地测试

async function testMultiSearch() {
  console.log('🔍 测试增强版多参数搜索API\n');

  const tests = [
    {
      name: '基础搜索 - 单个query参数',
      params: {
        query: '1100'
      }
    },
    {
      name: '产品ID精确搜索',
      params: {
        productId: 'CCCC137'
      }
    },
    {
      name: '产品名称搜索',
      params: {
        productName: '产品'
      }
    },
    {
      name: '价格范围筛选',
      params: {
        priceMin: 100,
        priceMax: 500
      }
    },
    {
      name: '组合搜索 - ID + 价格范围',
      params: {
        productId: 'CCCC',
        priceMin: 200,
        limit: 5
      }
    },
    {
      name: '全参数搜索',
      params: {
        query: 'CCCC',
        priceMin: 50,
        priceMax: 1000,
        limit: 10
      }
    },
    {
      name: '仅价格筛选 - 高价产品',
      params: {
        priceMin: 500,
        limit: 3
      }
    }
  ];

  for (const test of tests) {
    await runSearchTest(test.name, test.params);
  }
}

async function runSearchTest(testName, params) {
  try {
    console.log(`\n📋 ${testName}`);
    console.log('请求参数:', JSON.stringify(params, null, 2));
    
    const response = await fetch(`${API_BASE}/api/price-list/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ 搜索成功: 找到 ${data.total} 个产品`);
      
      // 显示搜索参数摘要
      if (data.searchParams) {
        console.log('搜索条件摘要:', {
          通用搜索: data.searchParams.query,
          产品ID: data.searchParams.productId,
          产品名称: data.searchParams.productName,
          价格范围: `${data.searchParams.priceRange.min || '不限'} ~ ${data.searchParams.priceRange.max || '不限'}`,
          结果限制: data.searchParams.limit
        });
      }
      
      // 显示前3个结果
      if (data.results && data.results.length > 0) {
        console.log('前3个结果:');
        data.results.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ID: ${product['ID Producto']}`);
          console.log(`     名称: ${product['Producto']}`);
          console.log(`     最终价格: $${product['PRECIO FINAL']}`);
        });
        
        if (data.results.length > 3) {
          console.log(`     ... 还有 ${data.results.length - 3} 个结果`);
        }
      }
      
      if (data.isLimited) {
        console.log('⚠️  结果已被限制，可能还有更多匹配的产品');
      }
    } else {
      console.log(`❌ 搜索失败: ${data.error}`);
      if (data.supportedParams) {
        console.log('支持的参数:', data.supportedParams);
      }
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
  }
  
  console.log('─'.repeat(60));
}

// 测试参数验证
async function testParameterValidation() {
  console.log('\n🔧 测试参数验证\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/price-list/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}) // 空参数
    });

    const data = await response.json();
    console.log('空参数测试结果:', data);
    
    if (data.examples) {
      console.log('\n📚 API使用示例:');
      console.log('基础搜索:', JSON.stringify(data.examples.basic, null, 2));
      console.log('高级搜索:', JSON.stringify(data.examples.advanced, null, 2));
      console.log('多参数搜索:', JSON.stringify(data.examples.multiParam, null, 2));
    }
  } catch (error) {
    console.log(`❌ 参数验证测试失败: ${error.message}`);
  }
}

// 性能测试
async function performanceTest() {
  console.log('\n⚡ 性能测试\n');
  
  const startTime = Date.now();
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch(`${API_BASE}/api/price-list/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'CCCC', limit: 10 })
      })
    );
  }
  
  try {
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`✅ 并发测试完成: 5个请求耗时 ${endTime - startTime}ms`);
    console.log(`📊 平均响应时间: ${(endTime - startTime) / 5}ms`);
    
    const results = await Promise.all(responses.map(r => r.json()));
    const successCount = results.filter(r => r.success).length;
    console.log(`📈 成功率: ${successCount}/5 (${(successCount/5*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.log(`❌ 性能测试失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  console.log('🚀 开始测试增强版搜索API...\n');
  
  // 首先测试健康检查
  try {
    const healthResponse = await fetch(`${API_BASE}/api/price-list/health`);
    const healthData = await healthResponse.json();
    console.log('📊 API状态:', healthData);
    console.log('═'.repeat(80));
  } catch (error) {
    console.log(`❌ 无法连接到API: ${error.message}`);
    console.log('请确保API服务正在运行');
    return;
  }
  
  // 运行所有测试
  await testMultiSearch();
  await testParameterValidation();
  await performanceTest();
  
  console.log('\n🎉 所有测试完成！');
  console.log('\n📖 使用指南:');
  console.log('1. 基础搜索: { "query": "关键词" }');
  console.log('2. 价格筛选: { "priceMin": 100, "priceMax": 500 }');
  console.log('3. 组合搜索: { "query": "CCCC", "priceMin": 200, "limit": 10 }');
  console.log('4. 产品ID搜索: { "productId": "CCCC137" }');
  console.log('5. 产品名称搜索: { "productName": "产品名" }');
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testMultiSearch,
  testParameterValidation,
  performanceTest
}; 