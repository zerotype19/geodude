// Optiview Reco Consumer Worker - DISABLED
// This worker has been disabled as part of the cleanup process

export default {
  async fetch(request: Request): Promise<Response> {
    return new Response('Optiview Reco Consumer is currently disabled', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  // Empty queue handler to satisfy Cloudflare's requirements
  async queue(batch: any, env: any, ctx: any): Promise<void> {
    // Do nothing - worker is disabled
  }
};