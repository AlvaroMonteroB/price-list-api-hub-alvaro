const http = require('http');

// 配置
const API_BASE = 'http://localhost:3000';

// HTTP请求辅助函数
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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

async function demo() {
  console.log('🚀 价格清单API使用演示\n');

  try {
    // 1. 检查服务状态
    console.log('1️⃣ 检查API服务状态');
    const health = await makeRequest('GET', '/api/health');
    console.log(`✅ 服务状态: ${health.status}`);
    console.log(`📊 已加载产品: ${health.totalRecords} 条\n`);

    // 2. 获取前几个产品查看数据结构
    console.log('2️⃣ 获取产品数据');
    const products = await makeRequest('GET', '/api/products');
    console.log(`✅ 总共有 ${products.total} 个产品`);
    
         if (products.data && products.data.length > 0) {
       console.log('📝 前3个产品示例:');
       products.data.slice(0, 3).forEach((product, index) => {
         console.log(`${index + 1}. ID: ${product['ID Producto']}`);
         console.log(`   名称: ${product['Producto']}`);
         console.log(`   单位成本: ${product['Costo Uni Unitario']}`);
         console.log(`   库存: ${product['Exit.']}`);
         console.log(`   含税成本: ${product['COSTO CON IVA']}`);
         console.log(`   最终价格: ${product['PRECIO FINAL']}\n`);
       });

       // 3. 搜索产品
       console.log('3️⃣ 搜索产品演示');
       const firstProduct = products.data[0];
       const searchTerm = firstProduct['Producto'].split(' ')[0]; // 取第一个词作为搜索关键词
       
       console.log(`🔍 搜索关键词: "${searchTerm}"`);
       const searchResult = await makeRequest('POST', '/api/product/search', { query: searchTerm });
       
       if (searchResult.success) {
         console.log(`✅ 搜索成功: 找到 ${searchResult.total} 个匹配产品`);
         if (searchResult.results && searchResult.results.length > 0) {
           console.log('📋 搜索结果:');
           searchResult.results.slice(0, 2).forEach((product, index) => {
             console.log(`${index + 1}. ${product['ID Producto']} - ${product['Producto']} (${product['PRECIO FINAL']})`);
           });
         }
       } else {
         console.log(`❌ 搜索失败: ${searchResult.error}`);
       }
       console.log('');

       // 4. 根据产品ID查询
       console.log('4️⃣ 根据产品ID查询');
       const productId = firstProduct['ID Producto'];
       console.log(`🔍 查询产品ID: ${productId}`);
       
       const productDetail = await makeRequest('GET', `/api/product/id/${productId}`);
       if (productDetail.success) {
         console.log('✅ 查询成功');
         console.log(`📦 产品详情:`);
         console.log(`   ID: ${productDetail.producto['ID Producto']}`);
         console.log(`   名称: ${productDetail.producto['Producto']}`);
         console.log(`   单位成本: ${productDetail.producto['Costo Uni Unitario']}`);
         console.log(`   库存: ${productDetail.producto['Exit.']}`);
         console.log(`   含税成本: ${productDetail.producto['COSTO CON IVA']}`);
         console.log(`   最终价格: ${productDetail.producto['PRECIO FINAL']}`);
       } else {
         console.log(`❌ 查询失败: ${productDetail.message}`);
       }
     }

  } catch (error) {
    console.error('❌ 演示过程中出错:', error.message);
    console.log('\n请确保API服务已启动 (npm start)');
  }

  console.log('\n🎉 演示完成!');
  console.log('\n📚 使用说明:');
  console.log('- 启动服务: npm start');
  console.log('- 搜索产品: POST /api/product/search { "query": "关键词" }');
  console.log('- 查询产品: GET /api/product/id/产品ID');
  console.log('- 获取所有: GET /api/products');
  console.log('- 健康检查: GET /api/health');
}

// 运行演示
demo(); 