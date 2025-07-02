/**
 * Agent 调用示例
 * 展示如何使用价格清单API进行产品查询
 */

const API_BASE_URL = 'http://localhost:3000'; // 替换为您的实际API地址

class PriceListAgent {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * 搜索产品
   * @param {string} query - 搜索关键词（产品代码或产品名称）
   * @returns {Promise<Object>} 搜索结果
   */
  async searchProduct(query) {
    try {
      const response = await fetch(`${this.baseUrl}/api/product/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ 搜索成功: 找到 ${data.total} 个匹配的产品`);
        return data.results;
      } else {
        console.log(`❌ 搜索失败: ${data.error}`);
        return [];
      }
    } catch (error) {
      console.error('API调用错误:', error);
      return [];
    }
  }

  /**
   * 根据产品代码获取产品信息
   * @param {string} codigo - 产品代码
   * @returns {Promise<Object|null>} 产品信息
   */
  async getProductByCode(codigo) {
    try {
      const response = await fetch(`${this.baseUrl}/api/product/code/${codigo}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ 产品查询成功: ${data.producto.PRODUCTO}`);
        return data.producto;
      } else {
        console.log(`❌ 未找到产品代码: ${codigo}`);
        return null;
      }
    } catch (error) {
      console.error('API调用错误:', error);
      return null;
    }
  }

  /**
   * 格式化产品信息显示
   * @param {Object} product - 产品信息
   * @returns {string} 格式化的产品信息
   */
  formatProductInfo(product) {
    if (!product) return '未找到产品信息';
    
    return `
📦 产品信息:
   代码: ${product.CODIGO || 'N/A'}
   名称: ${product.PRODUCTO || 'N/A'}
   单位: ${product.UM || 'N/A'}
   价格: ${product.PRECIO || 'N/A'}
    `.trim();
  }

  /**
   * 检查API服务状态
   * @returns {Promise<boolean>} 服务是否正常
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const data = await response.json();
      
      if (data.status === 'healthy') {
        console.log(`✅ API服务正常 - 已加载 ${data.totalRecords} 条产品数据`);
        return true;
      } else {
        console.log('❌ API服务异常');
        return false;
      }
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }
}

// 使用示例
async function main() {
  const agent = new PriceListAgent();
  
  console.log('🚀 开始Agent调用示例...\n');
  
  // 1. 检查服务状态
  console.log('1️⃣ 检查API服务状态');
  const isHealthy = await agent.checkHealth();
  if (!isHealthy) {
    console.log('❌ API服务不可用，请先启动服务');
    return;
  }
  console.log('');
  
  // 2. 搜索产品示例
  console.log('2️⃣ 搜索产品示例');
  const searchResults = await agent.searchProduct('ACEITE');
  if (searchResults.length > 0) {
    console.log('📋 搜索结果:');
    searchResults.slice(0, 3).forEach((product, index) => {
      console.log(`${index + 1}. ${agent.formatProductInfo(product)}`);
    });
  }
  console.log('');
  
  // 3. 根据代码查询示例（需要替换为实际存在的产品代码）
  console.log('3️⃣ 根据产品代码查询示例');
  if (searchResults.length > 0) {
    const firstProduct = searchResults[0];
    const productCode = firstProduct.CODIGO;
    const productDetail = await agent.getProductByCode(productCode);
    if (productDetail) {
      console.log('📦 产品详情:');
      console.log(agent.formatProductInfo(productDetail));
    }
  }
  
  console.log('\n🎉 Agent调用示例完成!');
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PriceListAgent; 