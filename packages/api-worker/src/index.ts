// Optiview API Worker - DISABLED
// This worker has been disabled as part of the cleanup process

export default {
  async fetch(request: Request): Promise<Response> {
    return new Response('Optiview API is currently disabled', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  },

  // Empty scheduled handler to satisfy Cloudflare's requirements
  async scheduled(event: any, env: any, ctx: any): Promise<void> {
    // Do nothing - worker is disabled
  },

  // Empty queue handler to satisfy Cloudflare's requirements
  async queue(batch: any, env: any, ctx: any): Promise<void> {
    // Do nothing - worker is disabled
  }
};