import * as fs from 'fs';
import * as path from 'path';
import { CHECKS, CheckDoc } from './apps/app/src/content/score-guide/checks';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateCheckPage(check: CheckDoc): string {
  const goodExamples = check.examples.good.map((ex) => {
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

  const badExamples = check.examples.bad.map((ex) => {
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

  console.log(`Generated page for ${check.slug}`);
  return `<!doctype html><html><head><title>${check.title}</title></head><body><h1>${check.title}</h1></body></html>`;
}

// Generate pages
const outputDir = './apps/web/public/score-guide';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

CHECKS.forEach(check => {
  const html = generateCheckPage(check);
  const filename = path.join(outputDir, `${check.slug}.html`);
  fs.writeFileSync(filename, html);
  console.log(`✓ Generated ${check.slug}.html`);
});

console.log(`\n✅ Generated ${CHECKS.length} pages`);
