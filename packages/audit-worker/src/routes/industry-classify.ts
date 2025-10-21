/**
 * Industry Classification API Route
 * POST /industry/classify
 */

import { classifyIndustry, type ClassifyRequest, type ClassifyResponse } from '../lib/industry-classifier';

export async function handleIndustryClassify(
  req: Request,
  env: Env
): Promise<Response> {
  try {
    const body: ClassifyRequest = await req.json();

    // Validate required fields
    if (!body.domain || !body.root_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: domain, root_url' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[INDUSTRY_AI] Classifying domain: ${body.domain}`);

    // Run classification
    const result = await classifyIndustry(body);

    console.log(
      `[INDUSTRY_AI] domain=${body.domain} primary=${result.primary.industry_key} score=${result.primary.confidence.toFixed(3)} signals=${Object.keys(result.evidence).join(',')}`
    );

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[INDUSTRY_AI ERROR]', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Classification failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

