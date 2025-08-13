// Optiview Customer Worker Template
// Deploy this on your own Cloudflare zone for edge-level AI traffic classification
// and signed event sending to Optiview

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    
    // Pass-through to origin first, but tee metadata for Optiview
    const res = await fetch(req);
    
    // Send event to Optiview in background (don't block response)
    ctx.waitUntil(sendEventToOptiview(env, req, res));
    
    return res;
  }
};

async function sendEventToOptiview(env, req, res) {
  try {
    // Extract metadata from request
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    const host = req.headers.get("host") || "";
    const path = new URL(req.url).pathname;
    
    // Classify traffic using local patterns (simplified version)
    const trafficClass = classifyTraffic(userAgent, referer);
    
    // Prepare event payload
    const eventPayload = {
      project_id: env.OPTIVIEW_PROJECT_ID,
      property_id: env.OPTIVIEW_PROPERTY_ID,
      event_type: "view",
      metadata: {
        class: trafficClass,
        ua: await hashString(userAgent),
        ref: await hashString(referer),
        host: host,
        path: path,
        status: res.status,
        worker: "customer_edge"
      }
    };
    
    // Sign the request
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(eventPayload);
    const signature = await createHmacSignature(`${timestamp}.${body}`, env.OPTIVIEW_SECRET);
    
    // Send to Optiview
    const optiviewResponse = await fetch("https://app.optiview.io/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-optiview-key-id": env.OPTIVIEW_KEY_ID,
        "x-optiview-signature": signature,
        "x-optiview-timestamp": timestamp.toString()
      },
      body: body
    });
    
    if (!optiviewResponse.ok) {
      console.error("Optiview event send failed:", optiviewResponse.status);
    }
    
  } catch (error) {
    console.error("Error sending event to Optiview:", error);
  }
}

function classifyTraffic(userAgent, referer) {
  // Simplified traffic classification
  if (!userAgent) return "unknown_ai_like";
  
  // Check for AI bots
  const aiBots = ["PerplexityBot", "GPTBot", "ClaudeBot", "Google-Extended"];
  if (aiBots.some(bot => userAgent.includes(bot))) {
    return "ai_agent_crawl";
  }
  
  // Check for AI referrals
  const aiReferers = ["chat.openai.com", "claude.ai", "gemini.google.com", "perplexity.ai"];
  if (referer && aiReferers.some(ref => referer.includes(ref))) {
    return "human_via_ai";
  }
  
  // Check for suspicious patterns
  if (userAgent.includes("AI") || userAgent.includes("Bot")) {
    return "unknown_ai_like";
  }
  
  return "direct_human";
}

async function hashString(str) {
  if (!str) return "";
  
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    return hashBase64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  } catch (error) {
    return `hash_error_${str.length}`;
  }
}

async function createHmacSignature(message, secret) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  } catch (error) {
    throw new Error("HMAC signature creation failed");
  }
}

// Environment variables needed:
// OPTIVIEW_PROJECT_ID: Your Optiview project ID
// OPTIVIEW_PROPERTY_ID: Your Optiview property ID  
// OPTIVIEW_KEY_ID: Your Optiview API key ID
// OPTIVIEW_SECRET: Your Optiview API secret
