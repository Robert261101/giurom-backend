const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testEndpoints() {
  console.log('🧪 Testing Recipe API Endpoints...\n');

  try {
    // Test 1: Get all recipe categories
    console.log('1️⃣ Testing GET /recipes/categories');
    try {
      const categoriesResponse = await axios.get(`${BASE_URL}/recipes/categories`);
      console.log('✅ Categories endpoint working');
      console.log(`   Found ${categoriesResponse.data.total || 0} categories\n`);
    } catch (error) {
      console.log('❌ Categories endpoint failed:', error.message);
    }

    // Test 2: Get all recipes
    console.log('2️⃣ Testing GET /recipes');
    try {
      const recipesResponse = await axios.get(`${BASE_URL}/recipes`);
      console.log('✅ Recipes endpoint working');
      console.log(`   Found ${recipesResponse.data.total || 0} recipes\n`);
    } catch (error) {
      console.log('❌ Recipes endpoint failed:', error.message);
    }

    // Test 3: Get recipe statistics
    console.log('3️⃣ Testing GET /recipes/statistics/overview');
    try {
      const statsResponse = await axios.get(`${BASE_URL}/recipes/statistics/overview`);
      console.log('✅ Statistics endpoint working');
      console.log('   Statistics:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Statistics endpoint failed:', error.message);
    }

    // Test 4: Test Swagger documentation
    console.log('\n4️⃣ Testing Swagger Documentation');
    try {
      const swaggerResponse = await axios.get(`${BASE_URL}/api/docs-json`);
      console.log('✅ Swagger documentation available');
      
      // Check if recipe-products endpoints are documented
      const paths = swaggerResponse.data.paths;
      const recipeProductEndpoints = Object.keys(paths).filter(path => 
        path.includes('recipe-products')
      );
      
      if (recipeProductEndpoints.length > 0) {
        console.log('✅ Recipe-product endpoints documented:');
        recipeProductEndpoints.forEach(endpoint => {
          console.log(`   - ${endpoint}`);
        });
      } else {
        console.log('⚠️  No recipe-product endpoints found in documentation');
      }
    } catch (error) {
      console.log('❌ Swagger documentation failed:', error.message);
    }

  } catch (error) {
    console.log('❌ General error:', error.message);
  }
}

// Run the tests
testEndpoints().then(() => {
  console.log('\n🏁 Testing completed!');
  console.log('💡 To view full API documentation, visit: http://localhost:3001/api/docs');
}).catch(console.error);