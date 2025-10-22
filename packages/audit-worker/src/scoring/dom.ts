import { parseHTML } from "linkedom";

export const loadDom = (html: string) => parseHTML(html);
export const q  = (doc: Document, sel: string) => doc.querySelector(sel);
export const qa = (doc: Document, sel: string) => Array.from(doc.querySelectorAll(sel));
export const txt = (el: Element | null | undefined) => (el ? el.textContent?.trim() ?? "" : "");
export const attr = (el: Element | null | undefined, name: string) => (el ? el.getAttribute(name) : null);
export const isInternal = (href: string, host: string) => {
  try { const u = new URL(href, `https://${host}`); return u.hostname === host; } catch { return false; }
};

