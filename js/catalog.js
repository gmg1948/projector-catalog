import { WIX_CLIENT_ID } from './wix/config.js';
import { queryItems } from './wix/items.js';

let pending;
export function loadCatalog() {
  if (pending) return pending;
  pending = (async () => {
    let lamps = [];
    if (WIX_CLIENT_ID) {
      let skip = 0;
      for (;;) {
        const page = await queryItems('ProjectorLamps', { limit: 200, skip, withTotal: true });
        lamps.push(...page.items);
        if (!page.hasNext) break;
        if (!page.items.length) throw new Error('Empty page before end of catalog');
        skip += page.items.length;
      }
    } else {
      const response = await fetch(new URL('../data/catalog.json', import.meta.url));
      if (!response.ok) throw new Error('Catalog failed to load');
      lamps = await response.json();
    }
    const models = [];
    for (const lamp of lamps) {
      const projectors = JSON.parse(lamp.projectorDetails);
      if (!Array.isArray(projectors)) throw new Error('Invalid catalog data');
      for (const projector of projectors) models.push({ ...projector, imagePath: new URL('..' + projector.imagePath, import.meta.url).href, lamp });
    }
    return { lamps, models };
  })().catch(error => { pending = null; throw error; });
  return pending;
}

// Retain '+' because EX7 and EX7+ are distinct projector model names.
export const normalize = value => String(value ?? '').normalize('NFKC').toUpperCase().replace(/[\s.\-_]/g, '');
export function findMatches(models, { brand = '', model = '', lamp = '' } = {}) {
  const modelNeedle = normalize(model), lampNeedle = normalize(lamp);
  let candidates = models.filter(item => (!brand || item.brand === brand)
    && (!modelNeedle || normalize(item.model).includes(modelNeedle))
    && (!lampNeedle || normalize(item.lamp.lampPartNumber).includes(lampNeedle)));
  if (modelNeedle && candidates.some(item => normalize(item.model) === modelNeedle)) {
    candidates = candidates.filter(item => normalize(item.model) === modelNeedle);
  }
  if (lampNeedle && candidates.some(item => normalize(item.lamp.lampPartNumber) === lampNeedle)) {
    candidates = candidates.filter(item => normalize(item.lamp.lampPartNumber) === lampNeedle);
  }
  return candidates.sort((a, b) => {
      const aExact = modelNeedle ? normalize(a.model) === modelNeedle : normalize(a.lamp.lampPartNumber) === lampNeedle;
      const bExact = modelNeedle ? normalize(b.model) === modelNeedle : normalize(b.lamp.lampPartNumber) === lampNeedle;
      return Number(bExact) - Number(aExact) || a.brand.localeCompare(b.brand, 'en') || a.model.localeCompare(b.model, 'en', { numeric: true });
    });
}
export function itemUrl(item) {
  if (item.staticPath) return new URL('..' + item.staticPath, import.meta.url).href;
  const params = new URLSearchParams({ lamp: item.lamp.slug, model: item.modelKey });
  return '/lamp.html?' + params;
}
export function priceText(lamp) {
  return typeof lamp.price === 'number' && Number.isFinite(lamp.price) && lamp.price > 0
    ? new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(lamp.price)
    : '540–750 ₪ לרוב דגמי המקרנים';
}
export function whatsappUrl(item) {
  const message = `שלום, אני מעוניין בנורה מקורית למקרן ${item.brand} ${item.model}.\nמספר הנורה: ${item.lamp.lampPartNumber}.\nאשמח לאישור התאמה, מחיר וזמינות במלאי.`;
  return 'https://wa.me/972524132938?text=' + encodeURIComponent(message);
}
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
