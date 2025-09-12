# API Hub - Price List Service

This is an API integration center based on Node.js and Express, designed specifically for AI Agent calls, providing price list queries and tire specification search services.

## 🎯 Features

- 📊 **Excel Data Processing**: Automatically read and parse Excel files (296 product records)
- 🔍 **Smart Search**: Support multi-parameter product search and price filtering
- 🚗 **Tire Specification Search**: Professional tire specification matching system (supports 116 tire products)
- 🤖 **Agent Friendly**: Unified response format (raw/markdown/type/desc)
- 🔬 **Smart Parsing**: Automatically parse tire product specification parameters
- 🚀 **RESTful API**: Provide standard REST API interfaces
- 🛡️ **Security**: Includes rate limiting, CORS, and security headers

## 📡 API Endpoints

### Main Entry
- `GET /` - API Hub information and module list

### Price List Module (`/api/price-list/`)

#### Basic Endpoints
- `GET /api/price-list/health` - Health check and data statistics
- `GET /api/price-list/products` - Get all products
- `POST /api/price-list/reload` - Reload Excel data

#### Product Query Endpoints
- `POST /api/price-list/search` - Product search (supports multi-parameters)
- `GET /api/price-list/product/:id` - Get product details by ID

#### 🚗 Tire Specific Endpoints
- `POST /api/price-list/tire-search` - Tire specification search
- `POST /api/price-list/tire-search-es` - Tire specification search (Spanish)
- `POST /api/price-list/tire-parse` - Tire specification parsing test

## 🔧 Agent Response Format

All APIs return a unified Agent-friendly format:

```json
{
  "raw": {
    // Structured data for program processing
  },
  "markdown": "| Column1 | Column2 |\n|:-------|:--------|\n| Value1 | Value2 |",
  "type": "markdown",
  "desc": "Detailed text description for user reading"
}
```

## 🚗 Tire Search System

### Supported Tire Types

1. **Car Tires** (114 products)
   - Formats: `155/70R13`, `185/60R15`, `175 65 R15`, `155 70 13`, etc.
   - Parameters: `width`, `aspectRatio`, `diameter`
   - Smart format recognition: Support multiple input formats

2. **Truck Tires** (2 products)  
   - Formats: `1100R22`, `1100 R22`, etc.
   - Parameters: `width`, `diameter`

### 🔧 Smart Tire Format Recognition

The system supports multiple tire specification input formats:

**Car Tire Format Support:**
- `155/70R13` (Standard format)
- `155/70-13` (Dash format)  
- `155 70 13` (Space separated)
- `155 70 R13` (Space + R format) ✨ **New Support**
- `175 65 R15 84H SAFERICH` (Full product name)

**Smart Matching Features:**
- 🧠 Automatically ignore R character differences (user input "15" or "R15" both match)
- 🔍 Fuzzy matching specification parameters
- 📊 Return results sorted by price

### Tire Search Parameters

```json
{
  "width": "155",           // Required: Tire width
  "aspectRatio": "70",      // Optional: Aspect ratio (car tires)
  "diameter": "13",         // Optional: Diameter
  "exactMatch": false,      // Optional: Whether to exact match
  "limit": 10               // Optional: Return count (1-100, default 10) ✨ **New**
}
```

**Parameter Description:**
- `width`: Tire width, required parameter
- `aspectRatio`: Aspect ratio, recommended for car tires
- `diameter`: Rim diameter, supports "15" or "R15" format
- `exactMatch`: Exact match mode, default false
- `limit`: Return result count, range 1-100, default 10

## 🛠️ Installation and Running

### Local Development

1. Clone repository:
```bash
git clone https://github.com/zhuchenyu876/price-list-api-hub.git
cd price-list-api-hub
```

2. Install dependencies:
```bash
npm install
```

3. Ensure Excel file is in root directory:
```
LISTA DE PRECIOS 25062025.xlsx
```

4. Start service:
```bash
npm start
```

Service will start at `http://localhost:3000`

### Online Access

🌐 **Deployment URL**: `https://price-list-api-hub-zhu.vercel.app`

## 📝 API Usage Examples

### 1. Health Check
```bash
curl https://price-list-api-hub-zhu.vercel.app/api/price-list/health
```

**Response Example:**
```json
{
  "raw": {
    "status": "healthy",
    "dataLoaded": true,
    "totalRecords": 296,
    "timestamp": "2025-07-02T07:08:25.825Z"
  },
  "markdown": "| Status | Value |\n|:-------|:------|\n| Service Status | Healthy |\n| Data Loaded | Success |\n| Product Count | 296 |",
  "type": "markdown", 
  "desc": "✅ API service running normally\n📊 Loaded 296 product records\n🚗 Contains 116 tire products"
}
```

### 2. Tire Specification Search

#### English Version (`/tire-search`)
**Standard Search Example:**
```bash
curl -X POST https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search \
  -H "Content-Type: application/json" \
  -d '{
    "width": "155",
    "aspectRatio": "70", 
    "diameter": "13"
  }'
```

**Smart Format Search Example (New Feature):**
```bash
curl -X POST https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search \
  -H "Content-Type: application/json" \
  -d '{
    "width": "175",
    "aspectRatio": "65", 
    "diameter": "R15",
    "limit": 5
  }'
```

#### Spanish Version (`/tire-search-es`)
**Búsqueda de Neumáticos en Español:**
```bash
curl -X POST https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search-es \
  -H "Content-Type: application/json" \
  -d '{
    "width": "175",
    "aspect_ratio": "65", 
    "rim_diameter": "15",
    "limit": 10
  }'
```

**Response Example (English):**
```json
{
  "raw": {
    "searchType": "car",
    "searchSpec": "155/70R13",
    "totalFound": 1,
    "results": [
      {
        "id": "LL-C29834",
        "product": "155 70 13 75T MIRAGE MR-166 AUTO",
        "stock": 3,
        "price": 932.3616,
        "specs": {
          "width": 155,
          "aspect_ratio": 70,
          "rim_diameter": 13,
          "type": "car"
        }
      }
    ]
  },
  "markdown": "| Product ID | Product Name | Stock | Price |\n|:-----------|:-------------|:------|:------|\n| LL-C29834 | 155 70 13 75T MIRAGE MR-166 AUTO | 3 | $932.3616 |",
  "type": "markdown",
  "desc": "🔍 Tire Search Results - Car Tire (155/70R13)\n\n📊 Search Statistics:\n• Matching tires: 1\n• Tire type: Car\n• Search specification: 155/70R13\n\n💰 Price range: $932.3616 - $932.3616\n\n🏆 Recommended tires:\n1. 155 70 13 75T MIRAGE MR-166 AUTO - $932.3616"
}
```

**Response Example (Spanish):**
```json
{
  "raw": {
    "searchType": "car",
    "searchSpec": "175/65R15",
    "totalFound": 2,
    "results": [...]
  },
  "markdown": "| ID Producto | Nombre del Producto | Stock | Precio |\n|:------------|:--------------------|:------|:-------|\n| ...",
  "type": "markdown",
  "desc": "🔍 Resultados de Búsqueda de Neumáticos - Neumático de Auto (175/65R15)\n\n📊 Estadísticas de Búsqueda:\n• Neumáticos encontrados: 2\n• Cantidad mostrada: 2\n• Tipo de neumático: Auto\n• Especificación de búsqueda: 175/65R15\n\n💰 Rango de precios: $1234.56 - $1456.78\n\n🏆 Neumáticos recomendados:\n1. 175 65 R15 84H SAFERICH FRC16 - $1234.56\n2. 175 65 R15 84H WANLI SP601 - $1456.78"
}
```

### 3. Product Search
```bash
curl -X POST https://price-list-api-hub-zhu.vercel.app/api/price-list/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "155",
    "limit": 5
  }'
```

### 4. Product Details Query
```bash
curl https://price-list-api-hub-zhu.vercel.app/api/price-list/product/LL-C29834
```

## 🤖 Agent Call Examples

### JavaScript/Node.js
```javascript
// Tire search (English)
async function searchTires(width, aspectRatio, diameter) {
  const response = await fetch('https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      width: width,
      aspectRatio: aspectRatio,
      diameter: diameter
    })
  });

  const data = await response.json();
  
  // Agent can use different formats of data
  console.log('Structured data:', data.raw);      // Program processing
  console.log('Table display:', data.markdown);   // Markdown rendering
  console.log('User description:', data.desc);    // User reading
  
  return data;
}

// Tire search (Spanish)
async function searchTiresSpanish(width, aspectRatio, diameter) {
  const response = await fetch('https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search-es', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      width: width,
      aspect_ratio: aspectRatio,
      rim_diameter: diameter
    })
  });

  const data = await response.json();
  
  // Agent can use different formats of data
  console.log('Datos estructurados:', data.raw);      // Program processing
  console.log('Visualización de tabla:', data.markdown);   // Markdown rendering
  console.log('Descripción para usuario:', data.desc);    // User reading
  
  return data;
}

// Call example
searchTires("185", "60", "15").then(result => {
  console.log(`Found ${result.raw.totalFound} tires`);
});

// Spanish call example
searchTiresSpanish("175", "65", "15").then(result => {
  console.log(`Se encontraron ${result.raw.totalFound} neumáticos`);
});
```

### Python
```python
import requests

# English version
def search_tires(width, aspect_ratio, diameter):
    url = "https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search"
    payload = {
        "width": width,
        "aspectRatio": aspect_ratio, 
        "diameter": diameter
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    return data

# Spanish version
def search_tires_spanish(width, aspect_ratio, diameter):
    url = "https://price-list-api-hub-zhu.vercel.app/api/price-list/tire-search-es"
    payload = {
        "width": width,
        "aspect_ratio": aspect_ratio, 
        "rim_diameter": diameter
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    return data

# Call example
result = search_tires("155", "70", "13")
print(f"Found {result['raw']['totalFound']} matching tires")

# Spanish call example  
resultado = search_tires_spanish("175", "65", "15")
print(f"Se encontraron {resultado['raw']['totalFound']} neumáticos coincidentes")
```

## 📊 Supported Search Parameters

### Product Search Parameters
```json
{
  "query": "search keyword",    // General search
  "productId": "product ID",    // Exact ID search  
  "productName": "product name", // Name search
  "priceMin": 100,             // Minimum price
  "priceMax": 500,             // Maximum price
  "limit": 50                  // Result count limit
}
```

### Tire Search Parameters
```json
{
  "width": "155",           // Required: Width
  "aspectRatio": "70",      // Optional: Aspect ratio (car tires)
  "diameter": "13",         // Optional: Diameter (supports "13" or "R13" format)
  "exactMatch": false,      // Optional: Exact match
  "limit": 10               // Optional: Return count (1-100, default 10)
}
```

## 🗂️ Data Structure

### Excel Data Fields
- **ID Producto**: Product ID
- **Producto**: Product Name  
- **Costo Uni Unitario**: Unit Cost
- **Exit.**: Stock Quantity
- **COSTO CON IVA**: Cost with Tax
- **PRECIO FINAL**: Final Price

### Tire Product Statistics
- **Total Products**: 296
- **Tire Products**: 116
  - Car Tires: 114
  - Truck Tires: 2

## 🚀 Deployment Information

- **Platform**: Vercel
- **Domain**: `https://price-list-api-hub-zhu.vercel.app`
- **GitHub**: `https://github.com/zhuchenyu876/price-list-api-hub`
- **Auto Deploy**: Automatically triggered when pushing to main branch

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes
- **CORS**: Cross-Origin Resource Sharing support
- **Helmet**: Security headers configuration
- **Input Validation**: Parameter type and range validation

## 📚 Related Documentation

- `agent-example.js` - Agent call examples
- `test-tire-search.js` - Tire search testing
- `API-Hub集成指南.md` - Detailed integration guide
- `使用指南.md` - Complete usage instructions

## 🧪 Testing

```bash
# Run all tests
npm test

# Tire search testing
node test-tire-search.js

# API endpoint testing
node test-api.js
```

## Tech Stack

- **Node.js v22** - Runtime environment
- **Express.js** - Web framework
- **xlsx** - Excel file processing
- **cors** - Cross-Origin Resource Sharing
- **helmet** - Security headers
- **express-rate-limit** - Request rate limiting

## 🔄 Update Log

### v1.2.0 (Latest) - Tire Search Enhancement
- ✨ **New**: Support for "175 65 R15" format tire search
- 🧠 **Smart**: Automatic R character matching ("15" ↔ "R15")
- 🔢 **New**: limit parameter to control return count (1-100)
- 🔧 **Fix**: Data display consistency issues
- 📊 **Optimize**: Tire search results sorted by price

### v1.1.0 - API Hub Format
- 🤖 **New**: Agent standard response format
- 📋 **New**: Markdown table output
- 📝 **New**: Detailed description information
- 🔍 **Optimize**: Search algorithm improvements

### v1.0.0 - Basic Features
- 📊 Excel data processing
- 🔍 Product search functionality
- 🚗 Tire specification search
- 🚀 RESTful API interfaces

## License

MIT License

## Contact

For any questions, please create a [GitHub Issue](https://github.com/zhuchenyu876/price-list-api-hub/issues). 