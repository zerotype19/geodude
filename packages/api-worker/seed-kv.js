// Simple script to seed KV with staging data
const promptPack = {
  "intents": ["definition","bestof"],
  "prompts": [
    "What is generative engine optimization?",
    "Best tools for AI citation tracking"
  ],
  "topics": ["generative engine optimization","ai citation analytics"],
  "cadence": "weekly"
};

console.log('Prompt pack to seed:', JSON.stringify(promptPack, null, 2));
console.log('Use this command to seed KV:');
console.log('wrangler kv:key put "prj_staging" \'{"intents":["definition","bestof"],"prompts":["What is generative engine optimization?","Best tools for AI citation tracking"],"topics":["generative engine optimization","ai citation analytics"],"cadence":"weekly"}\' --binding PROMPT_PACKS');
