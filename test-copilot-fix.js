// Test Copilot fix
const testClassification = async () => {
  console.log('Testing Copilot classification fix...\n');
  
  const response = await fetch('https://api.optiview.ai/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-optiview-key-id': 'key_gkYVllfLoA1k'
    },
    body: JSON.stringify({
      project_id: 'prj_cTSh3LZ8qMVZ',
      property_id: 2,
      events: [{
        event_type: 'pageview',
        metadata: {
          url: 'https://rhythm90.io/test-copilot-fix',
          referrer: 'https://copilot.microsoft.com/',
          title: 'Test Copilot fix',
          user_agent: 'Test-Agent/1.0'
        },
        occurred_at: new Date().toISOString()
      }]
    })
  });
  
  if (response.ok) {
    console.log('✅ Copilot test event created successfully');
  } else {
    const error = await response.text();
    console.log(`❌ Error: ${response.status} ${error}`);
  }
};

testClassification();
