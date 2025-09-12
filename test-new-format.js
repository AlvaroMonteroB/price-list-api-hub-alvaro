const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const http = require('http');

// 简化版本的测试
let priceListData = [];

// 加载数据
function loadExcelData() {
  try {
    const excelPath = path.join(__dirname, 'LISTA DE PRECIOS 25062025.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    priceListData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ 成功加载 ${priceListData.length} 条数据`);
    return true;
  } catch (error) {
    console.error('❌ 加载Excel文件失败:', error.message);
    return false;
  }
}

// 轮胎规格解析函数
function parseTireSpecification(productName) {
  const name = String(productName || '').trim();
  
  const specs = {
    width: null,
    aspect_ratio: null,
    rim_diameter: null,
    type: null,
    original: name
  };

  // 小型轿车轮胎格式
  const carTirePattern = /^(\d{3})\s+(\d{2})\s+(\d{2})\s/;
  const carMatch = name.match(carTirePattern);
  
  if (carMatch) {
    specs.width = parseInt(carMatch[1]);
    specs.aspect_ratio = parseInt(carMatch[2]);
    specs.rim_diameter = parseInt(carMatch[3]);
    specs.type = 'car';
    return specs;
  }

  // 货车轮胎格式
  const truckTirePattern = /^(\d{3,4})\s+R(\d{2})\s/;
  const truckMatch = name.match(truckTirePattern);
  
  if (truckMatch) {
    specs.width = parseInt(truckMatch[1]);
    specs.rim_diameter = parseInt(truckMatch[2]);
    specs.type = 'truck';
    return specs;
  }

  // 标准格式
  const standardPattern = /(\d{3})\/(\d{2})[-R](\d{2})/;
  const standardMatch = name.match(standardPattern);
  
  if (standardMatch) {
    specs.width = parseInt(standardMatch[1]);
    specs.aspect_ratio = parseInt(standardMatch[2]);
    specs.rim_diameter = parseInt(standardMatch[3]);
    specs.type = 'car';
    return specs;
  }

  return specs;
}

// 测试轮胎搜索新格式
function testTireSearchNewFormat(searchParams) {
  const { 
    width, 
    aspectRatio, 
    diameter, 
    exact_match = false 
  } = searchParams;
  
  // 参数映射处理
  const finalAspectRatio = aspectRatio;
  const finalRimDiameter = diameter;
  
  // 确定搜索类型
  const searchType = finalAspectRatio ? 'car' : 'truck';
  
  console.log(`🔍 轮胎规格搜索: ${searchType} - 宽度:${width}, 扁平比:${finalAspectRatio || 'N/A'}, 直径:${finalRimDiameter || 'N/A'}`);

  // 解析所有产品的轮胎规格
  const tireProducts = priceListData.map(product => {
    const specs = parseTireSpecification(product['Producto']);
    return {
      ...product,
      tire_specs: specs
    };
  }).filter(product => product.tire_specs.width !== null);

  // 搜索匹配的轮胎
  const matchingTires = tireProducts.filter(product => {
    const specs = product.tire_specs;
    
    // 基础匹配：宽度必须匹配
    if (specs.width != width) return false;
    
    if (searchType === 'car') {
      // 小型轿车：需要匹配宽度、扁平比、直径
      if (exact_match) {
        return specs.aspect_ratio == finalAspectRatio && specs.rim_diameter == finalRimDiameter;
      } else {
        // 允许一定的规格范围匹配
        const aspectMatch = !finalAspectRatio || Math.abs(specs.aspect_ratio - finalAspectRatio) <= 5;
        const rimMatch = !finalRimDiameter || specs.rim_diameter == finalRimDiameter;
        return aspectMatch && rimMatch;
      }
    } else {
      // 货车：只需要匹配宽度和直径
      return !finalRimDiameter || specs.rim_diameter == finalRimDiameter;
    }
  });

  // 按价格排序
  matchingTires.sort((a, b) => {
    const priceA = parseFloat(a['PRECIO FINAL']) || 0;
    const priceB = parseFloat(b['PRECIO FINAL']) || 0;
    return priceA - priceB;
  });

  // 格式化结果为统一的Agent响应格式
  const tireType = searchType === 'car' ? '小型轿车' : '货车';
  const searchSpec = searchType === 'car' 
    ? `${width}/${finalAspectRatio}R${finalRimDiameter}`
    : `${width}R${finalRimDiameter}`;
  
  // 原始数据
  const rawData = {
    searchType: searchType,
    searchSpec: searchSpec,
    totalFound: matchingTires.length,
    results: matchingTires.slice(0, 10).map(tire => ({
      id: tire['ID Producto'],
      product: tire['Producto'],
      stock: tire['Exit.'],
      price: tire['PRECIO FINAL'],
      specs: tire.tire_specs
    })),
    searchParams: {
      width: width,
      aspectRatio: finalAspectRatio || null,
      diameter: finalRimDiameter || null,
      type: searchType,
      exactMatch: exact_match
    }
  };

  // Markdown表格格式
  let markdownTable = "| 产品ID | 产品名称 | 库存 | 价格 |\n|:-------|:---------|:-----|:-----|\n";
  if (matchingTires.length > 0) {
    matchingTires.slice(0, 5).forEach(tire => {
      markdownTable += `| ${tire['ID Producto']} | ${tire['Producto']} | ${tire['Exit.']} | $${tire['PRECIO FINAL']} |\n`;
    });
  } else {
    markdownTable += "| - | 未找到匹配轮胎 | - | - |\n";
  }

  // 描述信息
  let description = `🔍 轮胎搜索结果 - ${tireType}轮胎 (${searchSpec})\n\n`;
  description += `📊 搜索统计:\n`;
  description += `• 匹配轮胎: ${matchingTires.length} 个\n`;
  description += `• 轮胎类型: ${tireType}\n`;
  description += `• 搜索规格: ${searchSpec}\n\n`;
  
  if (matchingTires.length > 0) {
    description += `💰 价格范围: $${matchingTires[0]['PRECIO FINAL']} - $${matchingTires[matchingTires.length-1]['PRECIO FINAL']}\n\n`;
    description += `🏆 推荐轮胎:\n`;
    matchingTires.slice(0, 3).forEach((tire, index) => {
      description += `${index + 1}. ${tire['Producto']} - $${tire['PRECIO FINAL']}\n`;
    });
    
    if (matchingTires.length > 3) {
      description += `\n... 还有 ${matchingTires.length - 3} 个其他选项`;
    }
  } else {
    description += `❌ 未找到匹配的${tireType}轮胎\n`;
    description += `💡 建议:\n`;
    description += `• 检查轮胎规格是否正确\n`;
    description += `• 尝试其他尺寸规格\n`;
    description += `• 联系客服获取更多选项`;
  }

  // 返回统一格式
  return {
    raw: rawData,
    markdown: markdownTable,
    type: "markdown",
    desc: description
  };
}

// 运行测试
async function runTests() {
  console.log('🧪 测试新的Agent响应格式...\n');
  
  if (!loadExcelData()) {
    console.log('❌ 无法加载数据，测试终止');
    return;
  }
  
  const testCase = {
    width: "155",
    aspectRatio: "70",
    diameter: "13"
  };
  
  console.log(`📋 测试轮胎搜索: ${JSON.stringify(testCase)}\n`);
  
  const result = testTireSearchNewFormat(testCase);
  
  console.log('📄 返回格式测试结果:');
  console.log('='.repeat(50));
  console.log('\n🔧 Raw Data:');
  console.log(JSON.stringify(result.raw, null, 2));
  
  console.log('\n📊 Markdown Table:');
  console.log(result.markdown);
  
  console.log('\n📝 Description:');
  console.log(result.desc);
  
  console.log('\n✅ 格式类型:', result.type);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 新格式测试完成！');
}

runTests();

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
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

    req.write(postData);
    req.end();
  });
}

async function testNewTireFormats() {
  console.log('🔧 测试新轮胎格式支持');
  console.log('='.repeat(60));

  // 测试解析不同格式
  const parseTests = [
    '185/60 R15 JK TYRE VECTRA 88 H',
    '185/60R15 JK TYRE VECTRA 88 H',
    '185 60 R15 JK TYRE VECTRA 88 H',
    '185 60 15 JK TYRE VECTRA 88 H',
    '185/65R15 COMPASAL BLAZER HP 88H'
  ];

  console.log('\n📝 测试轮胎规格解析:');
  for (const productName of parseTests) {
    try {
      const result = await makeRequest('/api/price-list/tire-parse', {
        product_name: productName
      });
      
      if (result.status === 200 && result.data.success) {
        const specs = result.data.parsed_specs;
        console.log(`✅ "${productName}"`);
        console.log(`   → 宽度: ${specs.width}, 扁平比: ${specs.aspect_ratio}, 直径: ${specs.rim_diameter}, 类型: ${specs.type}`);
      } else {
        console.log(`❌ 解析失败: "${productName}"`);
      }
    } catch (error) {
      console.log(`❌ 请求失败: "${productName}" - ${error.message}`);
    }
  }

  // 测试搜索 185 60 R15
  console.log('\n🔍 测试搜索 185 60 R15:');
  try {
    const searchResult = await makeRequest('/api/price-list/tire-search', {
      width: 185,
      aspect_ratio: 60,
      rim_diameter: 15
    });
    
    if (searchResult.status === 200) {
      const data = searchResult.data;
      console.log(`✅ 找到 ${data.raw.totalFound} 个匹配结果`);
      
      if (data.raw.results && data.raw.results.length > 0) {
        console.log('匹配的轮胎:');
        data.raw.results.forEach((tire, index) => {
          console.log(`  ${index + 1}. ${tire.product} - $${tire.price}`);
        });
      }
    } else {
      console.log('❌ 搜索失败');
    }
  } catch (error) {
    console.log(`❌ 搜索请求失败: ${error.message}`);
  }
}

testNewTireFormats(); 