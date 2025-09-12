/**
 * Vercel部署状态检查脚本
 * 快速验证GitHub修改后的Vercel部署是否成功
 */

const REMOTE_API = 'https://price-list-api-hub-m4f8.vercel.app';

async function checkDeployment() {
  console.log('🔍 检查Vercel部署状态...\n');

  const checks = [
    {
      name: '基础连接',
      url: `${REMOTE_API}/`,
      method: 'GET'
    },
    {
      name: '健康检查',
      url: `${REMOTE_API}/api/price-list/health`,
      method: 'GET'
    },
    {
      name: '轮胎搜索功能 (新功能)',
      url: `${REMOTE_API}/api/price-list/tire-search`,
      method: 'POST',
      body: {
        width: 155,
        aspect_ratio: 70,
        rim_diameter: 13
      }
    },
    {
      name: '轮胎解析功能 (新功能)',
      url: `${REMOTE_API}/api/price-list/tire-parse`,
      method: 'POST',
      body: {
        product_name: '155 70 13 75T MIRAGE MR-166 AUTO'
      }
    }
  ];

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    console.log(`${i + 1}. 检查 ${check.name}...`);
    
    try {
      const options = {
        method: check.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (check.body) {
        options.body = JSON.stringify(check.body);
      }

      const response = await fetch(check.url, options);
      const data = await response.json();

      if (response.ok) {
        console.log(`   ✅ 成功 (${response.status})`);
        
        // 显示关键信息
        if (check.name.includes('健康检查')) {
          console.log(`   📊 数据状态: ${data.dataLoaded ? '已加载' : '未加载'}`);
          console.log(`   📈 产品总数: ${data.totalRecords}`);
        }
        
        if (check.name.includes('轮胎搜索')) {
          console.log(`   🎯 搜索结果: ${data.total || 0} 个匹配项`);
          if (data.statistics) {
            console.log(`   📊 轮胎产品: ${data.statistics.total_tire_products} 个`);
          }
        }
        
        if (check.name.includes('轮胎解析')) {
          if (data.parsed_specs && data.parsed_specs.width) {
            console.log(`   🔧 解析成功: ${data.parsed_specs.width}/${data.parsed_specs.aspect_ratio}R${data.parsed_specs.rim_diameter}`);
          }
        }
        
        if (check.name.includes('基础连接')) {
          console.log(`   📝 版本: ${data.version || 'N/A'}`);
        }
        
      } else {
        console.log(`   ❌ 失败 (${response.status}): ${data.error || data.message || '未知错误'}`);
      }
    } catch (error) {
      console.log(`   ❌ 网络错误: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🎯 部署状态总结:');
  console.log('- 如果所有检查都显示 ✅，说明部署成功');
  console.log('- 如果轮胎搜索功能可用，说明最新代码已部署');
  console.log('- 如果出现 ❌，可能需要等待几分钟让Vercel完成部署\n');
  
  console.log('🔗 Vercel控制台: https://vercel.com/dashboard');
  console.log('🔗 API地址: ' + REMOTE_API);
}

// 运行检查
checkDeployment().catch(console.error); 