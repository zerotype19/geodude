// Test reconciled classifier
const testReferrers = [
  'https://chat.openai.com/',
  'https://copilot.microsoft.com/',
  'https://www.bing.com/chat?q=test', // Should match bing_chat due to path hint
];

const testClassification = async () => {
  console.log('Testing reconciled AI classifier...\n');
  
  for (const referrer of testReferrers) {
    try {
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
              url: 'https://rhythm90.io/test-reconciled',
              referrer: referrer,
              title: `Test reconciled from ${new URL(referrer).hostname}`,
              user_agent: 'Test-Agent/1.0'
            },
            occurred_at: new Date().toISOString()
          }]
        })
      });
      
      if (response.ok) {
        console.log(`✅ ${referrer} -> Event created successfully`);
      } else {
        const error = await response.text();
        console.log(`❌ ${referrer} -> Error: ${response.status} ${error}`);
      }
    } catch (error) {
      console.log(`❌ ${referrer} -> Error: ${error.message}`);
    }
  }
};

testClassification();
