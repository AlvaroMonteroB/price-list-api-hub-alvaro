/**
 * 轮胎规格搜索API测试
 * 测试新的智能轮胎规格匹配功能
 */

const API_BASE = 'http://localhost:3000'; // 本地测试
// const API_BASE = 'https://price-list-api-hub-m4f8.vercel.app'; // 生产环境

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error('请求失败:', error.message);
    return { status: 500, data: { error: error.message } };
  }
}

async function testTireSearch() {
  console.log('🚗 轮胎规格搜索API测试\n');

  const tests = [
    {
      name: '小型轿车轮胎搜索 - 155/70R13',
      endpoint: '/api/price-list/tire-search',
      method: 'POST',
      body: {
        width: 155,
        aspect_ratio: 70,
        rim_diameter: 13
      }
    },
    {
      name: '货车轮胎搜索 - 1100R22',
      endpoint: '/api/price-list/tire-search',
      method: 'POST',
      body: {
        width: 1100,
        rim_diameter: 22
      }
    },
    {
      name: '只搜索宽度 - 165mm轮胎',
      endpoint: '/api/price-list/tire-search',
      method: 'POST',
      body: {
        width: 165
      }
    },
    {
      name: '精确匹配模式 - 175/65R14',
      endpoint: '/api/price-list/tire-search',
      method: 'POST',
      body: {
        width: 175,
        aspect_ratio: 65,
        rim_diameter: 14,
        exact_match: true
      }
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📋 测试 ${i + 1}: ${test.name}`);
    console.log(`🔍 搜索参数:`, JSON.stringify(test.body, null, 2));
    
    const result = await makeRequest(`${API_BASE}${test.endpoint}`, {
      method: test.method,
      body: JSON.stringify(test.body)
    });
    
    if (result.status === 200 && result.data.success) {
      console.log(`✅ 成功: ${result.data.message}`);
      console.log(`📊 统计信息:`, result.data.statistics);
      console.log(`🎯 找到轮胎数量: ${result.data.total}`);
      
      if (result.data.results && result.data.results.length > 0) {
        console.log(`\n前3个匹配结果:`);
        result.data.results.slice(0, 3).forEach((tire, idx) => {
          console.log(`  ${idx + 1}. ID: ${tire['ID Producto']}`);
          console.log(`     产品: ${tire['Producto']}`);
          console.log(`     价格: $${tire['PRECIO FINAL']}`);
          console.log(`     规格: 宽度${tire.tire_specs.width}${tire.tire_specs.aspect_ratio ? `/${tire.tire_specs.aspect_ratio}` : ''}R${tire.tire_specs.rim_diameter}`);
        });
      }
    } else {
      console.log(`❌ 失败: ${result.data.error || '未知错误'}`);
    }
    
    console.log('─'.repeat(80));
  }
}

async function testTireParsing() {
  console.log('\n\n🔬 轮胎规格解析测试\n');

  const parseTests = [
    '155 70 13 75T MIRAGE MR-166 AUTO',
    '1100 R22 T-2400 14/C',
    '165 65 14 79T MIRAGE MR-166',
    '175 65 R14 82H AGATE AG-266',
    '无效的产品名称'
  ];

  for (let i = 0; i < parseTests.length; i++) {
    const productName = parseTests[i];
    console.log(`\n解析测试 ${i + 1}: "${productName}"`);
    
    const result = await makeRequest(`${API_BASE}/api/price-list/tire-parse`, {
      method: 'POST',
      body: JSON.stringify({ product_name: productName })
    });
    
    if (result.status === 200 && result.data.success) {
      const specs = result.data.parsed_specs;
      if (specs.width) {
        console.log(`✅ 解析成功:`);
        console.log(`   类型: ${specs.type === 'car' ? '小型轿车' : '货车'}`);
        console.log(`   宽度: ${specs.width}mm`);
        if (specs.aspect_ratio) console.log(`   扁平比: ${specs.aspect_ratio}`);
        console.log(`   直径: ${specs.rim_diameter}英寸`);
      } else {
        console.log(`⚠️  无法解析轮胎规格`);
      }
    } else {
      console.log(`❌ 解析失败: ${result.data.error}`);
    }
  }
}

async function runAllTests() {
  try {
    // 检查服务器是否运行
    console.log('🔗 检查API服务器连接...\n');
    const healthCheck = await makeRequest(`${API_BASE}/api/price-list/health`);
    
    if (healthCheck.status !== 200) {
      console.log('❌ API服务器未响应，请确保服务器正在运行');
      console.log('💡 运行命令: npm start');
      return;
    }
    
    console.log('✅ API服务器连接正常');
    console.log(`📊 数据状态: ${healthCheck.data.dataLoaded ? '已加载' : '未加载'}`);
    console.log(`📈 产品总数: ${healthCheck.data.totalRecords}`);
    
    // 运行测试
    await testTireSearch();
    await testTireParsing();
    
    console.log('\n🎉 所有测试完成！');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
runAllTests(); 