/**
 * Generate static HTML score guide pages from checks.ts
 */
import fs from 'fs';
import path from 'path';

// Read and parse the checks.ts file
const checksPath = './apps/app/src/content/score-guide/checks.ts';
const checksContent = fs.readFileSync(checksPath, 'utf-8');

// Extract CHECKS array - simple regex approach
const checksMatch = checksContent.match(/export const CHECKS: CheckDoc\[\] = \[([\s\S]*)\];/);
if (!checksMatch) {
  console.error('Could not find CHECKS array');
  process.exit(1);
}

// Parse the checks data (this is a simplified parser)
// For production, you'd want to use TypeScript compiler API
const checksArrayText = checksMatch[1];

// For now, let's use a simple eval approach (safe since we control the source)
const CHECKS = eval(`[${checksArrayText}]`);

console.log(`Found ${CHECKS.length} checks to convert`);

// HTML template for individual check pages
function generateCheckPage(check) {
  const goodExamples = check.examples.good.map((ex, i) => {
    const code = ex.schema || ex.html || ex.text || '';
    const lang = ex.schema ? 'json' : ex.html ? 'html' : 'text';
    return `
      <div class="example">
        <div class="example-caption">${ex.caption}</div>
        <div class="code-block">
          <button class="copy-btn" onclick="copyCode(this)" aria-label="Copy code">Copy</button>
          <pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>
        </div>
      </div>
    `;
  }).join('');

  const badExamples = check.examples.bad.map((ex, i) => {
    const code = ex.schema || ex.html || ex.text || '';
    const lang = ex.schema ? 'json' : ex.html ? 'html' : 'text';
    return `
      <div class="example">
        <div class="example-caption">${ex.caption}</div>
        <div class="code-block">
          <button class="copy-btn" onclick="copyCode(this)" aria-label="Copy code">Copy</button>
          <pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>
        </div>
      </div>
    `;
  }).join('');

  const detectionNotes = check.detectionNotes ? `
    <section id="detection" class="section">
      <h2 class="section-heading">
        <span class="heading-text">How Optiview detects/scores this</span>
        <button class="anchor-btn" onclick="copyAnchor('detection')" aria-label="Copy link">#</button>
      </h2>
      <ul class="detection-list">
        ${check.detectionNotes.map(note => `<li>${note}</li>`).join('')}
      </ul>
    </section>
  ` : '';

  const implementationSteps = check.implementation.map((step, i) => 
    `<li>${step}</li>`
  ).join('');

  const qaItems = check.qaChecklist.map((item, i) => 
    `<li>${item}</li>`
  ).join('');

  const references = check.links ? `
    <section class="section">
      <h2 class="section-heading">References</h2>
      <ul class="reference-list">
        ${check.links.map(link => `
          <li><a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${check.title} - Optiview Score Guide</title>
  <meta name="description" content="${check.summary}">
  <link rel="canonical" href="https://optiview.ai/score-guide/${check.slug}" />
  
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-CY45NV4CNE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-CY45NV4CNE');
  </script>
  
  <style>
    :root {
      --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --purple: #667eea;
      --border: #e5e7eb;
      --bg-light: #fafafa;
      --card-bg: #fff;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.7;
      color: #111;
      background: var(--bg-light);
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
    }
    .logo {
      font-size: 1.25rem;
      font-weight: 700;
      background: var(--gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-decoration: none;
    }
    nav { display: flex; gap: 2rem; align-items: center; }
    nav a {
      text-decoration: none;
      color: #666;
      font-weight: 500;
      transition: color 0.2s;
    }
    nav a:hover { color: var(--purple); }
    
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }
    
    .breadcrumb {
      margin-bottom: 2rem;
      font-size: 0.875rem;
    }
    .breadcrumb a {
      color: var(--purple);
      text-decoration: none;
    }
    .breadcrumb a:hover { text-decoration: underline; }
    
    .page-header {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .check-meta {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: var(--gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .summary {
      font-size: 1.125rem;
      color: #4b5563;
      margin-bottom: 1.5rem;
    }
    .mini-toc {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .mini-toc a {
      color: var(--purple);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .mini-toc a:hover { text-decoration: underline; }
    
    .section {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      scroll-margin-top: 80px;
    }
    .section-heading {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #111;
    }
    .anchor-btn {
      opacity: 0;
      background: none;
      border: none;
      color: var(--purple);
      cursor: pointer;
      font-size: 1.25rem;
      transition: opacity 0.2s;
    }
    .section-heading:hover .anchor-btn { opacity: 0.5; }
    .anchor-btn:hover { opacity: 1 !important; }
    
    .why-box {
      background: #f0f4ff;
      border-left: 4px solid var(--purple);
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1.5rem 0;
    }
    .why-box p {
      color: #374151;
      margin: 0;
    }
    
    .examples-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 1.5rem;
    }
    @media (max-width: 768px) {
      .examples-grid { grid-template-columns: 1fr; }
    }
    .examples-column h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .examples-column.good h3 { color: #059669; }
    .examples-column.bad h3 { color: #d97706; }
    
    .example {
      margin-bottom: 1.5rem;
    }
    .example-caption {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.5rem;
    }
    .code-block {
      position: relative;
      background: #1f2937;
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
    }
    .copy-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 0.375rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .copy-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .copy-btn.copied {
      background: #059669;
      border-color: #059669;
    }
    pre {
      margin: 0;
      padding: 0;
      overflow-x: auto;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      color: #f9fafb;
    }
    
    .implementation-list,
    .qa-list,
    .detection-list,
    .reference-list {
      list-style: decimal;
      padding-left: 1.5rem;
      color: #4b5563;
    }
    .implementation-list li,
    .qa-list li,
    .detection-list li,
    .reference-list li {
      margin: 0.75rem 0;
    }
    
    .reference-list {
      list-style: none;
      padding-left: 0;
    }
    .reference-list a {
      color: var(--purple);
      text-decoration: none;
    }
    .reference-list a:hover { text-decoration: underline; }
    
    footer {
      text-align: center;
      padding: 2rem 1.5rem;
      color: #666;
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      background: var(--card-bg);
    }
    footer a { color: var(--purple); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <a href="/" class="logo">OPTIVIEW.AI</a>
      <nav>
        <a href="https://app.optiview.ai">Audits</a>
        <a href="/score-guide">Score Guide</a>
        <a href="/docs/citations.html">Citations Guide</a>
      </nav>
    </div>
  </header>

  <main>
    <nav class="breadcrumb">
      <a href="/score-guide">← All checks</a>
    </nav>

    <div class="page-header">
      <div class="check-meta">
        ${check.category} · W${check.weight} · ${check.id}
      </div>
      <h1>${check.title}</h1>
      <p class="summary">${check.summary}</p>
      
      <div class="mini-toc">
        <a href="#why">→ Why</a>
        <span>·</span>
        <a href="#examples">→ Examples</a>
        <span>·</span>
        <a href="#implementation">→ Implementation</a>
        <span>·</span>
        <a href="#qa">→ QA</a>
        ${check.detectionNotes ? '<span>·</span><a href="#detection">→ Detection</a>' : ''}
      </div>
    </div>

    <section id="why" class="section">
      <h2 class="section-heading">
        <span class="heading-text">Why it matters</span>
        <button class="anchor-btn" onclick="copyAnchor('why')" aria-label="Copy link">#</button>
      </h2>
      <div class="why-box">
        <p>${check.whyItMatters}</p>
      </div>
    </section>

    ${detectionNotes}

    <section id="examples" class="section">
      <h2 class="section-heading">
        <span class="heading-text">Examples</span>
        <button class="anchor-btn" onclick="copyAnchor('examples')" aria-label="Copy link">#</button>
      </h2>
      <div class="examples-grid">
        <div class="examples-column good">
          <h3>✅ Good examples</h3>
          ${goodExamples}
        </div>
        <div class="examples-column bad">
          <h3>⚠️ Missing / Bad examples</h3>
          ${badExamples}
        </div>
      </div>
    </section>

    <section id="implementation" class="section">
      <h2 class="section-heading">
        <span class="heading-text">Implementation steps</span>
        <button class="anchor-btn" onclick="copyAnchor('implementation')" aria-label="Copy link">#</button>
      </h2>
      <ol class="implementation-list">
        ${implementationSteps}
      </ol>
    </section>

    <section id="qa" class="section">
      <h2 class="section-heading">
        <span class="heading-text">QA checklist</span>
        <button class="anchor-btn" onclick="copyAnchor('qa')" aria-label="Copy link">#</button>
      </h2>
      <ul class="qa-list">
        ${qaItems}
      </ul>
    </section>

    ${references}

    <div style="margin-top: 3rem; padding: 1.5rem; background: #f0f4ff; border-radius: 8px; text-align: center;">
      <p style="color: #374151; margin-bottom: 1rem;">Ready to test your site against this check?</p>
      <a href="https://app.optiview.ai" style="display: inline-block; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Run Free Audit →</a>
    </div>
  </main>

  <footer>
    <p>
      <a href="https://app.optiview.ai">Audits</a> ·
      <a href="/score-guide">Scoring Guide</a> ·
      <a href="/docs/citations.html">Citations Guide</a> ·
      <a href="/methodology">Methodology</a> ·
      <a href="/terms">Terms</a> ·
      <a href="/privacy">Privacy</a> ·
      <a href="/bot">Bot Info</a>
    </p>
    <p style="margin-top: 0.5rem;">© 2025 Optiview.ai · AEO + GEO auditing for modern search.</p>
  </footer>

  <script>
    function copyCode(btn) {
      const codeBlock = btn.nextElementSibling;
      const code = codeBlock.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    function copyAnchor(id) {
      const url = window.location.origin + window.location.pathname + '#' + id;
      navigator.clipboard.writeText(url).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1500);
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Create output directory
const outputDir = './apps/web/public/score-guide';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate individual check pages
CHECKS.forEach(check => {
  const html = generateCheckPage(check);
  const filename = path.join(outputDir, `${check.slug}.html`);
  fs.writeFileSync(filename, html);
  console.log(`✓ Generated ${check.slug}.html`);
});

console.log(`\n✅ Generated ${CHECKS.length} check pages in ${outputDir}/`);
console.log('\nNext: Update the index page to link to these detail pages');

