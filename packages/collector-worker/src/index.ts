// Optiview Collector Worker - DISABLED
// This worker has been disabled as part of the cleanup process

export default {
  async fetch(request: Request): Promise<Response> {
    return new Response('Optiview Collector is currently disabled', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
