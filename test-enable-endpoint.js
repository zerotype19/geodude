// Test the new /api/sources/enable endpoint
const testEnableEndpoint = async () => {
  console.log('Testing POST /api/sources/enable endpoint...\n');
  
  try {
    const response = await fetch('https://api.optiview.ai/api/sources/enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'optiview_session=test' // This will fail auth, but should reach the endpoint
      },
      body: JSON.stringify({
        project_id: 'prj_cTSh3LZ8qMVZ',
        ai_source_id: 10
      })
    });
    
    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}`);
    
    if (response.status === 401) {
      console.log('✅ Endpoint exists and handles authentication correctly');
    } else if (response.status === 404) {
      console.log('❌ Endpoint still returning 404 - not found');
    } else {
      console.log(`✅ Endpoint exists, got status: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
};

testEnableEndpoint();
