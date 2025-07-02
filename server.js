const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Global variable to store Excel data
let priceListData = [];

// Load Excel file
function loadExcelData() {
  try {
    // Use absolute path to ensure file can be found in Vercel environment
    const excelPath = path.join(__dirname, 'LISTA DE PRECIOS 25062025.xlsx');
    console.log('Attempting to load Excel file:', excelPath);
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON format
    priceListData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Successfully loaded ${priceListData.length} records`);
    console.log('Data sample:', priceListData.slice(0, 2));
    return true;
  } catch (error) {
    console.error('Failed to load Excel file:', error.message);
    console.error('Current working directory:', process.cwd());
    console.error('__dirname:', __dirname);
    
    // Try to list files in current directory
    try {
      const files = fs.readdirSync(process.cwd());
      console.error('Current directory files:', files.filter(f => f.includes('.xlsx')));
    } catch (fsError) {
      console.error('Cannot read directory:', fsError.message);
    }
    
    return false;
  }
}

// Load data on startup
loadExcelData();

// Tire specification parsing function
function parseTireSpecification(productName) {
  const name = String(productName || '').trim();
  
  // Tire specification parsing result
  const specs = {
    width: null,
    aspect_ratio: null,
    rim_diameter: null,
    type: null, // 'car' or 'truck'
    original: name
  };

  // Car tire format: 155 70 13 75T MIRAGE MR-166 AUTO
  // Format: width aspect_ratio diameter [other info]
  const carTirePattern = /^(\d{3})\s+(\d{2})\s+(\d{2})\s/;
  const carMatch = name.match(carTirePattern);
  
  if (carMatch) {
    specs.width = parseInt(carMatch[1]);
    specs.aspect_ratio = parseInt(carMatch[2]);
    specs.rim_diameter = parseInt(carMatch[3]);
    specs.type = 'car';
    return specs;
  }

  // New: Car tire format: 175 65 R15 84H SAFERICH FRC16
  // Format: width aspect_ratio R-diameter [other info]
  const carTireWithRPattern = /^(\d{3})\s+(\d{2})\s+R(\d{2})\s/;
  const carWithRMatch = name.match(carTireWithRPattern);
  
  if (carWithRMatch) {
    specs.width = parseInt(carWithRMatch[1]);
    specs.aspect_ratio = parseInt(carWithRMatch[2]);
    specs.rim_diameter = parseInt(carWithRMatch[3]);
    specs.type = 'car';
    return specs;
  }

  // Truck tire format: 1100 R22 T-2400 14/C
  // Format: width R-diameter [other info]
  const truckTirePattern = /^(\d{3,4})\s+R(\d{2})\s/;
  const truckMatch = name.match(truckTirePattern);
  
  if (truckMatch) {
    specs.width = parseInt(truckMatch[1]);
    specs.rim_diameter = parseInt(truckMatch[2]);
    specs.type = 'truck';
    return specs;
  }

  // Other possible tire formats
  // Format: 155/70R13 or 155/70-13
  const standardPattern = /(\d{3})\/(\d{2})[-R](\d{2})/;
  const standardMatch = name.match(standardPattern);
  
  if (standardMatch) {
    specs.width = parseInt(standardMatch[1]);
    specs.aspect_ratio = parseInt(standardMatch[2]);
    specs.rim_diameter = parseInt(standardMatch[3]);
    specs.type = 'car';
    return specs;
  }

  return specs; // Unable to parse
}

// Root path
app.get('/', (req, res) => {
  res.json({
    message: 'API Hub - Price List Service',
    version: '2.0.0',
    description: 'API Integration Center - Price List Module',
    modules: {
      'price-list': {
        name: 'Price List API',
        endpoints: {
          '/api/price-list/health': 'GET - Health check',
          '/api/price-list/products': 'GET - Get all products',
          '/api/price-list/search': 'POST - Search products',
          '/api/price-list/tire-search': 'POST - Tire specification search',
          '/api/price-list/tire-search-es': 'POST - Tire specification search (Spanish)',
          '/api/price-list/tire-parse': 'POST - Tire specification parsing',
          '/api/price-list/product/:id': 'GET - Get product by ID',
          '/api/price-list/reload': 'POST - Reload Excel data'
        }
      }
    },
    usage: {
      input: 'query - Product ID or product name',
      output: 'producto - Complete product information'
    }
  });
});

// API module routing - Price list
app.get('/api/price-list', (req, res) => {
  res.json({
    module: 'Price List API',
    version: '2.0.0',
    endpoints: {
      '/api/price-list/health': 'GET - Health check',
      '/api/price-list/products': 'GET - Get all products',
      '/api/price-list/search': 'POST - Search products',
      '/api/price-list/tire-search': 'POST - Tire specification search',
      '/api/price-list/tire-search-es': 'POST - Tire specification search (Spanish)',
      '/api/price-list/tire-parse': 'POST - Tire specification parsing',
      '/api/price-list/product/:id': 'GET - Get product by ID',
      '/api/price-list/reload': 'POST - Reload Excel data'
    },
    dataFields: {
      'ID Producto': 'Product ID',
      'Producto': 'Product Name',
      'Costo Uni Unitario': 'Unit Cost',
      'Exit.': 'Stock',
      'COSTO CON IVA': 'Cost with Tax',
      'PRECIO FINAL': 'Final Price'
    }
  });
});

// Health check endpoint
app.get('/api/price-list/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dataLoaded: priceListData.length > 0,
    totalRecords: priceListData.length,
    module: 'price-list'
  });
});

// Get all products
app.get('/api/price-list/products', (req, res) => {
  res.json({
    success: true,
    message: 'Successfully retrieved all products',
    module: 'price-list',
    data: priceListData,
    total: priceListData.length
  });
});

// Product search API - supports multi-parameter search
app.post('/api/price-list/search', (req, res) => {
  try {
    const { 
      query,           // General search (product ID or name)
      productId,       // Exact product ID search
      productName,     // Product name search
      priceMin,        // Minimum price
      priceMax,        // Maximum price
      limit = 50       // Limit result count, default 50
    } = req.body;
    
    // At least one search condition is required
    if (!query && !productId && !productName && !priceMin && !priceMax) {
      return res.status(400).json({
        success: false,
        error: 'At least one search parameter is required',
        supportedParams: {
          query: 'General search (product ID or name)',
          productId: 'Exact product ID search',
          productName: 'Product name search',
          priceMin: 'Minimum price filter',
          priceMax: 'Maximum price filter',
          limit: 'Limit result count (default 50)'
        },
        examples: {
          basic: { query: "1100" },
          advanced: { 
            productName: "tire",
            priceMin: 100,
            priceMax: 500,
            limit: 10
          },
          multiParam: {
            query: "CCCC",
            priceMin: 200
          }
        }
      });
    }

    let results = [...priceListData];

    // Apply search filters
    if (query) {
      const searchTerm = String(query).toLowerCase().trim();
      results = results.filter(item => {
        const idProducto = String(item['ID Producto'] || '').toLowerCase();
        const producto = String(item['Producto'] || '').toLowerCase();
        return idProducto.includes(searchTerm) || producto.includes(searchTerm);
      });
    }

    // Exact product ID search
    if (productId) {
      const searchId = String(productId).toLowerCase().trim();
      results = results.filter(item => {
        const idProducto = String(item['ID Producto'] || '').toLowerCase();
        return idProducto.includes(searchId);
      });
    }

    // Product name search
    if (productName) {
      const searchName = String(productName).toLowerCase().trim();
      results = results.filter(item => {
        const producto = String(item['Producto'] || '').toLowerCase();
        return producto.includes(searchName);
      });
    }

    // Price range filtering
    if (priceMin !== undefined || priceMax !== undefined) {
      results = results.filter(item => {
        const finalPrice = parseFloat(item['PRECIO FINAL']) || 0;
        let passesMin = true;
        let passesMax = true;
        
        if (priceMin !== undefined) {
          passesMin = finalPrice >= parseFloat(priceMin);
        }
        if (priceMax !== undefined) {
          passesMax = finalPrice <= parseFloat(priceMax);
        }
        
        return passesMin && passesMax;
      });
    }

    // Limit result count
    const limitNum = parseInt(limit) || 50;
    if (results.length > limitNum) {
      results = results.slice(0, limitNum);
    }

    // Sort: by price (optional)
    results.sort((a, b) => {
      const priceA = parseFloat(a['PRECIO FINAL']) || 0;
      const priceB = parseFloat(b['PRECIO FINAL']) || 0;
      return priceA - priceB;
    });

    // Format as unified Agent response format
    const searchQuery = query || productId || productName || `price ${priceMin || 0}-${priceMax || '∞'}`;
    
    // Raw data
    const rawData = {
      totalFound: results.length,
      searchQuery: searchQuery,
      results: results.slice(0, 10).map(item => ({
        id: item['ID Producto'],
        product: item['Producto'],
        unitCost: item['Costo Uni Unitario'],
        stock: item['Exit.'],
        costWithTax: item['COSTO CON IVA'],
        finalPrice: item['PRECIO FINAL']
      })),
      searchParams: {
        query: query || null,
        productId: productId || null,
        productName: productName || null,
        priceRange: {
          min: priceMin || null,
          max: priceMax || null
        },
        limit: limitNum
      },
      isLimited: priceListData.length > limitNum && results.length === limitNum
    };

    // Markdown table format
    let markdownTable = "| Product ID | Product Name | Stock | Final Price |\n|:-----------|:-------------|:------|:------------|\n";
    if (results.length > 0) {
      // Keep consistent with raw.results, display up to 10 results
      results.slice(0, 10).forEach(item => {
        markdownTable += `| ${item['ID Producto']} | ${item['Producto']} | ${item['Exit.']} | $${item['PRECIO FINAL']} |\n`;
      });
    } else {
      markdownTable += "| - | No matching products found | - | - |\n";
    }

    // Description information
    let description = `🔍 Product Search Results\n\n`;
    description += `📊 Search Statistics:\n`;
    description += `• Products found: ${results.length}\n`;
    description += `• Search query: ${searchQuery}\n\n`;
    
    if (results.length > 0) {
      const prices = results.map(item => parseFloat(item['PRECIO FINAL']) || 0).sort((a, b) => a - b);
      description += `💰 Price range: $${prices[0]} - $${prices[prices.length-1]}\n\n`;
      description += `🏆 Recommended products:\n`;
      results.slice(0, 3).forEach((item, index) => {
        description += `${index + 1}. ${item['Producto']} - $${item['PRECIO FINAL']}\n`;
      });
      
      if (results.length > 3) {
        description += `\n... and ${results.length - 3} other products`;
      }
    } else {
      description += `❌ No matching products found\n`;
      description += `💡 Suggestions:\n`;
      description += `• Check search keyword spelling\n`;
      description += `• Try using more general keywords\n`;
      description += `• Use product ID for exact search`;
    }

    // 返回统一格式
    res.json({
      raw: rawData,
      markdown: markdownTable,
      type: "markdown",
      desc: description
    });

  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({
      success: false,
      error: '搜索过程中发生错误'
    });
  }
});

// 根据产品ID精确查询
app.get('/api/price-list/product/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '产品ID不能为空'
      });
    }

    // 精确匹配产品ID
    const product = priceListData.find(item => 
      String(item['ID Producto'] || '').toLowerCase() === id.toLowerCase()
    );

    if (product) {
      // 格式化为统一的Agent响应格式
      const rawData = {
        id: product['ID Producto'],
        product: product['Producto'],
        unitCost: product['Costo Uni Unitario'],
        stock: product['Exit.'],
        costWithTax: product['COSTO CON IVA'],
        finalPrice: product['PRECIO FINAL'],
        searchedId: id
      };

      // Markdown table format
      const markdownTable = "| Field | Value |\n|:------|:------|\n" +
        `| Product ID | ${product['ID Producto']} |\n` +
        `| Product Name | ${product['Producto']} |\n` +
        `| Unit Cost | $${product['Costo Uni Unitario']} |\n` +
        `| Stock | ${product['Exit.']} |\n` +
        `| Cost with Tax | $${product['COSTO CON IVA']} |\n` +
        `| Final Price | $${product['PRECIO FINAL']} |`;

      // Description information
      const description = `🔍 Product Details Query Result\n\n` +
        `📦 Product Information:\n` +
        `• Product ID: ${product['ID Producto']}\n` +
        `• Product Name: ${product['Producto']}\n` +
        `• Stock Status: ${product['Exit.']}\n` +
        `• Final Price: $${product['PRECIO FINAL']}\n\n` +
        `💰 Price Details:\n` +
        `• Unit Cost: $${product['Costo Uni Unitario']}\n` +
        `• Cost with Tax: $${product['COSTO CON IVA']}\n` +
        `• Final Price: $${product['PRECIO FINAL']}\n\n` +
        `✅ Product available for ordering or inquiry.`;

      res.json({
        raw: rawData,
        markdown: markdownTable,
        type: "markdown",
        desc: description
      });
    } else {
      // Product not found unified format
      const rawData = {
        searchedId: id,
        found: false,
        error: "Product not found"
      };

      const markdownTable = "| Field | Value |\n|:------|:------|\n" +
        `| Search ID | ${id} |\n` +
        `| Status | Not Found |`;

      const description = `❌ Product Query Failed\n\n` +
        `🔍 Searched Product ID: ${id}\n\n` +
        `💡 Suggestions:\n` +
        `• Check if the product ID is correct\n` +
        `• Use product search function to find similar products\n` +
        `• Contact customer service to confirm product information`;

      res.status(404).json({
        raw: rawData,
        markdown: markdownTable,
        type: "markdown",
        desc: description
      });
    }

  } catch (error) {
    console.error('Product query error:', error);
    res.status(500).json({
      success: false,
      error: 'Error occurred during product query'
    });
  }
});

// Reload Excel data
app.post('/api/price-list/reload', (req, res) => {
  const success = loadExcelData();
  res.json({
    success: success,
    message: success ? 'Data reloaded successfully' : 'Data loading failed',
    module: 'price-list',
    total: priceListData.length
  });
});

// Tire specification search API
app.post('/api/price-list/tire-search', (req, res) => {
  try {
    // Support two parameter formats for compatibility
    const { 
      width, 
      aspect_ratio, 
      aspectRatio, 
      rim_diameter, 
      diameter, 
      exact_match = false,
      limit = 10  // New: user can specify return count, default 10
    } = req.body;
    
    // Parameter mapping processing
    const finalAspectRatio = aspect_ratio || aspectRatio;
    const finalRimDiameter = rim_diameter || diameter;
    
    // Parameter validation
    if (!width) {
      return res.status(400).json({
        success: false,
        error: 'Tire width (width) is a required parameter',
        usage: {
          car: 'Car tire: { "width": 155, "aspect_ratio": 70, "rim_diameter": 13, "limit": 20 }',
          truck: 'Truck tire: { "width": 1100, "rim_diameter": 22, "limit": 20 }'
        },
        parameters: {
          width: 'Required - Tire width',
          aspect_ratio: 'Optional - Aspect ratio (car tire)',
          rim_diameter: 'Optional - Diameter',
          exact_match: 'Optional - Whether to exact match (default false)',
          limit: 'Optional - Result count (1-100, default 10)'
        },
        examples: {
          car_search: {
            width: 155,
            aspect_ratio: 70,
            rim_diameter: 13,
            limit: 20
          },
          truck_search: {
            width: 1100,
            rim_diameter: 22,
            limit: 50
          },
          show_all: {
            width: 185,
            aspect_ratio: 55,
            rim_diameter: 15,
            limit: 100
          }
        }
      });
    }

    // Determine search type
    const searchType = finalAspectRatio ? 'car' : 'truck';
    
    console.log(`🔍 Tire specification search: ${searchType} - width:${width}, aspect ratio:${finalAspectRatio || 'N/A'}, diameter:${finalRimDiameter || 'N/A'}`);

    // Parse tire specifications for all products
    const tireProducts = priceListData.map(product => {
      const specs = parseTireSpecification(product['Producto']);
      return {
        ...product,
        tire_specs: specs
      };
    }).filter(product => product.tire_specs.width !== null); // Only keep products with parseable specs

    console.log(`📊 Successfully parsed ${tireProducts.length} tire products`);

    // Search for matching tires
    const matchingTires = tireProducts.filter(product => {
      const specs = product.tire_specs;
      
      // Basic match: width must match
      if (specs.width != width) return false;
      
      if (searchType === 'car') {
        // Car tire: need to match width, aspect ratio, diameter
        if (exact_match) {
          return specs.aspect_ratio == finalAspectRatio && specs.rim_diameter == finalRimDiameter;
        } else {
          // Allow certain specification range matching
          const aspectMatch = !finalAspectRatio || Math.abs(specs.aspect_ratio - finalAspectRatio) <= 5;
          
          // Diameter match: intelligent matching, ignore R character
          // Whether user inputs 15 or R15, should match both 15 and R15
          let rimMatch = true;
          if (finalRimDiameter) {
            const userDiameter = parseInt(String(finalRimDiameter).replace(/[rR]/g, ''));
            const productDiameter = parseInt(String(specs.rim_diameter).replace(/[rR]/g, ''));
            rimMatch = userDiameter === productDiameter;
          }
          
          return aspectMatch && rimMatch;
        }
      } else {
        // Truck tire: only need to match width and diameter
        if (!finalRimDiameter) return true;
        
        // Diameter match: intelligent matching, ignore R character
        const userDiameter = parseInt(String(finalRimDiameter).replace(/[rR]/g, ''));
        const productDiameter = parseInt(String(specs.rim_diameter).replace(/[rR]/g, ''));
        return userDiameter === productDiameter;
      }
    });

    // Sort by price
    matchingTires.sort((a, b) => {
      const priceA = parseFloat(a['PRECIO FINAL']) || 0;
      const priceB = parseFloat(b['PRECIO FINAL']) || 0;
      return priceA - priceB;
    });

    // Format results as unified Agent response format
    const tireType = searchType === 'car' ? 'Car' : 'Truck';
    const searchSpec = searchType === 'car' 
      ? `${width}/${finalAspectRatio}R${finalRimDiameter}`
      : `${width}R${finalRimDiameter}`;
    
    // Apply user-specified result count limit
    const resultLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100); // 1-100 range, default 10
    
    // Raw data
    const rawData = {
      searchType: searchType,
      searchSpec: searchSpec,
      totalFound: matchingTires.length,
      results: matchingTires.slice(0, resultLimit).map(tire => ({
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
        exactMatch: exact_match,
        limit: resultLimit
      },
      statistics: {
        totalTireProducts: tireProducts.length,
        carTires: tireProducts.filter(p => p.tire_specs.type === 'car').length,
        truckTires: tireProducts.filter(p => p.tire_specs.type === 'truck').length
      }
    };

    // Markdown table format
    let markdownTable = "| Product ID | Product Name | Stock | Price |\n|:-----------|:-------------|:------|:------|\n";
    if (matchingTires.length > 0) {
      // Use user-specified result count limit
      matchingTires.slice(0, resultLimit).forEach(tire => {
        markdownTable += `| ${tire['ID Producto']} | ${tire['Producto']} | ${tire['Exit.']} | $${tire['PRECIO FINAL']} |\n`;
      });
    } else {
      markdownTable += "| - | No matching tires found | - | - |\n";
    }

    // Description information
    let description = `🔍 Tire Search Results - ${tireType} Tire (${searchSpec})\n\n`;
    description += `📊 Search Statistics:\n`;
    description += `• Matching tires: ${matchingTires.length}\n`;
    description += `• Displayed count: ${Math.min(matchingTires.length, resultLimit)}\n`;
    description += `• Tire type: ${tireType}\n`;
    description += `• Search specification: ${searchSpec}\n\n`;
    
    if (matchingTires.length > 0) {
      description += `💰 Price range: $${matchingTires[0]['PRECIO FINAL']} - $${matchingTires[matchingTires.length-1]['PRECIO FINAL']}\n\n`;
      description += `🏆 Recommended tires:\n`;
      matchingTires.slice(0, 3).forEach((tire, index) => {
        description += `${index + 1}. ${tire['Producto']} - $${tire['PRECIO FINAL']}\n`;
      });
      
      if (matchingTires.length > 3) {
        description += `\n... and ${matchingTires.length - 3} other options`;
      }
    } else {
      description += `❌ No matching ${tireType.toLowerCase()} tires found\n`;
      description += `💡 Suggestions:\n`;
      description += `• Check if tire specifications are correct\n`;
      description += `• Try other size specifications\n`;
      description += `• Contact customer service for more options`;
    }

    // 返回统一格式
    res.json({
      raw: rawData,
      markdown: markdownTable,
      type: "markdown",
      desc: description
    });

  } catch (error) {
    console.error('Tire search error:', error);
    res.status(500).json({
      success: false,
      error: 'Error occurred during tire search'
    });
  }
});

// Tire specification search API - Spanish version
app.post('/api/price-list/tire-search-es', (req, res) => {
  try {
    // Support two parameter formats for compatibility
    const { 
      width, 
      aspect_ratio, 
      aspectRatio, 
      rim_diameter, 
      diameter, 
      exact_match = false,
      limit = 10  // New: user can specify return count, default 10
    } = req.body;
    
    // Parameter mapping processing
    const finalAspectRatio = aspect_ratio || aspectRatio;
    const finalRimDiameter = rim_diameter || diameter;
    
    // Parameter validation
    if (!width) {
      return res.status(400).json({
        success: false,
        error: 'El ancho del neumático (width) es un parámetro requerido',
        usage: {
          car: 'Neumático de auto: { "width": 155, "aspect_ratio": 70, "rim_diameter": 13, "limit": 20 }',
          truck: 'Neumático de camión: { "width": 1100, "rim_diameter": 22, "limit": 20 }'
        },
        parameters: {
          width: 'Requerido - Ancho del neumático',
          aspect_ratio: 'Opcional - Relación de aspecto (neumático de auto)',
          rim_diameter: 'Opcional - Diámetro',
          exact_match: 'Opcional - Si hacer coincidencia exacta (predeterminado false)',
          limit: 'Opcional - Cantidad de resultados (1-100, predeterminado 10)'
        },
        examples: {
          car_search: {
            width: 155,
            aspect_ratio: 70,
            rim_diameter: 13,
            limit: 20
          },
          truck_search: {
            width: 1100,
            rim_diameter: 22,
            limit: 50
          },
          show_all: {
            width: 185,
            aspect_ratio: 55,
            rim_diameter: 15,
            limit: 100
          }
        }
      });
    }

    // Determine search type
    const searchType = finalAspectRatio ? 'car' : 'truck';
    
    console.log(`🔍 Tire specification search (ES): ${searchType} - width:${width}, aspect ratio:${finalAspectRatio || 'N/A'}, diameter:${finalRimDiameter || 'N/A'}`);

    // Parse tire specifications for all products
    const tireProducts = priceListData.map(product => {
      const specs = parseTireSpecification(product['Producto']);
      return {
        ...product,
        tire_specs: specs
      };
    }).filter(product => product.tire_specs.width !== null); // Only keep products with parseable specs

    console.log(`📊 Successfully parsed ${tireProducts.length} tire products (ES)`);

    // Search for matching tires
    const matchingTires = tireProducts.filter(product => {
      const specs = product.tire_specs;
      
      // Basic match: width must match
      if (specs.width != width) return false;
      
      if (searchType === 'car') {
        // Car tire: need to match width, aspect ratio, diameter
        if (exact_match) {
          return specs.aspect_ratio == finalAspectRatio && specs.rim_diameter == finalRimDiameter;
        } else {
          // Allow certain specification range matching
          const aspectMatch = !finalAspectRatio || Math.abs(specs.aspect_ratio - finalAspectRatio) <= 5;
          
          // Diameter match: intelligent matching, ignore R character
          // Whether user inputs 15 or R15, should match both 15 and R15
          let rimMatch = true;
          if (finalRimDiameter) {
            const userDiameter = parseInt(String(finalRimDiameter).replace(/[rR]/g, ''));
            const productDiameter = parseInt(String(specs.rim_diameter).replace(/[rR]/g, ''));
            rimMatch = userDiameter === productDiameter;
          }
          
          return aspectMatch && rimMatch;
        }
      } else {
        // Truck tire: only need to match width and diameter
        if (!finalRimDiameter) return true;
        
        // Diameter match: intelligent matching, ignore R character
        const userDiameter = parseInt(String(finalRimDiameter).replace(/[rR]/g, ''));
        const productDiameter = parseInt(String(specs.rim_diameter).replace(/[rR]/g, ''));
        return userDiameter === productDiameter;
      }
    });

    // Sort by price
    matchingTires.sort((a, b) => {
      const priceA = parseFloat(a['PRECIO FINAL']) || 0;
      const priceB = parseFloat(b['PRECIO FINAL']) || 0;
      return priceA - priceB;
    });

    // Format results as unified Agent response format
    const tireType = searchType === 'car' ? 'Auto' : 'Camión';
    const searchSpec = searchType === 'car' 
      ? `${width}/${finalAspectRatio}R${finalRimDiameter}`
      : `${width}R${finalRimDiameter}`;
    
    // Apply user-specified result count limit
    const resultLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100); // 1-100 range, default 10
    
    // Raw data
    const rawData = {
      searchType: searchType,
      searchSpec: searchSpec,
      totalFound: matchingTires.length,
      results: matchingTires.slice(0, resultLimit).map(tire => ({
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
        exactMatch: exact_match,
        limit: resultLimit
      },
      statistics: {
        totalTireProducts: tireProducts.length,
        carTires: tireProducts.filter(p => p.tire_specs.type === 'car').length,
        truckTires: tireProducts.filter(p => p.tire_specs.type === 'truck').length
      }
    };

    // Markdown table format (Spanish)
    let markdownTable = "| ID Producto | Nombre del Producto | Stock | Precio |\n|:------------|:--------------------|:------|:-------|\n";
    if (matchingTires.length > 0) {
      // Use user-specified result count limit
      matchingTires.slice(0, resultLimit).forEach(tire => {
        markdownTable += `| ${tire['ID Producto']} | ${tire['Producto']} | ${tire['Exit.']} | $${tire['PRECIO FINAL']} |\n`;
      });
    } else {
      markdownTable += "| - | No se encontraron neumáticos | - | - |\n";
    }

    // Description information (Spanish)
    let description = `🔍 Resultados de Búsqueda de Neumáticos - Neumático de ${tireType} (${searchSpec})\n\n`;
    description += `📊 Estadísticas de Búsqueda:\n`;
    description += `• Neumáticos encontrados: ${matchingTires.length}\n`;
    description += `• Cantidad mostrada: ${Math.min(matchingTires.length, resultLimit)}\n`;
    description += `• Tipo de neumático: ${tireType}\n`;
    description += `• Especificación de búsqueda: ${searchSpec}\n\n`;
    
    if (matchingTires.length > 0) {
      description += `💰 Rango de precios: $${matchingTires[0]['PRECIO FINAL']} - $${matchingTires[matchingTires.length-1]['PRECIO FINAL']}\n\n`;
      description += `🏆 Neumáticos recomendados:\n`;
      matchingTires.slice(0, 3).forEach((tire, index) => {
        description += `${index + 1}. ${tire['Producto']} - $${tire['PRECIO FINAL']}\n`;
      });
      
      if (matchingTires.length > 3) {
        description += `\n... y ${matchingTires.length - 3} opciones más`;
      }
    } else {
      description += `❌ No se encontraron neumáticos de ${tireType.toLowerCase()} que coincidan\n`;
      description += `💡 Sugerencias:\n`;
      description += `• Verifique si las especificaciones del neumático son correctas\n`;
      description += `• Pruebe con otras especificaciones de tamaño\n`;
      description += `• Contacte al servicio al cliente para más opciones`;
    }

    // Return unified format
    res.json({
      raw: rawData,
      markdown: markdownTable,
      type: "markdown",
      desc: description
    });

  } catch (error) {
    console.error('Tire search error (ES):', error);
    res.status(500).json({
      success: false,
      error: 'Ocurrió un error durante la búsqueda de neumáticos'
    });
  }
});

// Tire specification parsing test endpoint
app.post('/api/price-list/tire-parse', (req, res) => {
  try {
    const { product_name } = req.body;
    
    if (!product_name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide product name (product_name) for parsing'
      });
    }

    const specs = parseTireSpecification(product_name);
    
    res.json({
      success: true,
      message: 'Tire specification parsing completed',
      input: product_name,
      parsed_specs: specs,
      is_parseable: specs.width !== null
    });

  } catch (error) {
    console.error('Tire parsing error:', error);
    res.status(500).json({
      success: false,
      error: 'Error occurred during tire specification parsing'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Backward compatible route redirects
app.get('/api/health', (req, res) => res.redirect('/api/price-list/health'));
app.get('/api/products', (req, res) => res.redirect('/api/price-list/products'));
app.post('/api/product/search', (req, res) => {
  // Forward request to new endpoint
  req.url = '/api/price-list/search';
  app.handle(req, res);
});
app.get('/api/product/id/:id', (req, res) => {
  res.redirect(`/api/price-list/product/${req.params.id}`);
});
app.post('/api/reload', (req, res) => {
  req.url = '/api/price-list/reload';
  app.handle(req, res);
});

// 404 handling
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint does not exist',
    availableEndpoints: {
      'price-list': [
        'GET /api/price-list/health',
        'GET /api/price-list/products', 
        'POST /api/price-list/search',
        'GET /api/price-list/product/:id',
        'POST /api/price-list/reload'
      ]
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view API documentation`);
});

module.exports = app; 