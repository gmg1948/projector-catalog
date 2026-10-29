import { loadCatalog, findMatches, itemUrl, priceText, whatsappUrl, element, normalize } from './catalog.js';
const root = document.getElementById('lamp-finder');
const form = root.querySelector('form');
const brand = root.querySelector('#lf-brand');
const model = root.querySelector('#lf-model');
const lamp = root.querySelector('#lf-lamp');
const suggestions = root.querySelector('#lf-models');
const status = root.querySelector('#lf-status');
const results = root.querySelector('#lf-results');
const more = root.querySelector('#lf-more');
const stats = root.querySelector('#lf-stats');
const submit = root.querySelector('button[type="submit"]');
let catalog, mode = 'projector', matches = [], shown = 0;
const batchSize = 12;
function updateSuggestions() {
  suggestions.replaceChildren();
  if (!catalog) return;
  const names = [...new Set(catalog.models.filter(x => !brand.value || x.brand === brand.value).map(x => x.model))];
  names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const name of names) {
    const option = element('option'); option.value = name; suggestions.append(option);
  }
}
async function ensureCatalog() {
  if (catalog) return catalog;
  submit.disabled = true;
  stats.textContent = 'טוען את קטלוג הנורות…';
  try {
    catalog = await loadCatalog();
    const brands = [...new Set(catalog.models.map(x => x.brand))].sort((a, b) => a.localeCompare(b, 'en'));
    for (const name of brands) {
      const option = element('option', '', name); option.value = name; brand.append(option);
    }
    stats.textContent = `${catalog.models.length.toLocaleString('he-IL')} דגמי מקרנים · ${brands.length} יצרנים`;
    updateSuggestions();
    status.textContent = '';
    status.className = 'lf-status';
    return catalog;
  } catch (error) {
    stats.textContent = '';
    status.textContent = 'לא ניתן לטעון כעת את הקטלוג. אפשר לנסות שוב או לפנות אלינו בטלפון 052-4132938.';
    status.className = 'lf-status lf-error';
    throw error;
  } finally { submit.disabled = false; }
}
function card(item) {
  const article = element('article', 'lf-card');
  const photo = element('div', 'lf-card-photo');
  if (item.imagePath || item.lamp.imagePath) {
    const img = element('img'); img.src = item.imagePath || item.lamp.imagePath;
    img.alt = 'נורת מקרן — תמונה להמחשה בלבד'; img.loading = 'lazy'; img.width = 220; img.height = 180;
    photo.append(img);
  }
  photo.append(element('span', 'lf-illustration', 'תמונה להמחשה בלבד'));
  const body = element('div', 'lf-card-body');
  body.append(element('span', 'lf-brand', item.brand), element('h3', '', item.model));
  const part = element('p', 'lf-part', 'מספר נורה: ');
  part.append(element('bdi', '', item.lamp.lampPartNumber));
  const link = element('a', 'lf-card-link', 'פרטי הנורה והזמנה'); link.href = itemUrl(item);
  const heading = element('p', 'lf-eyebrow', 'נורת OEM מקורית עם בית נורה');
  body.prepend(heading);
  const stock = element('p', 'lf-stock', 'זמינות במלאי: 3 יחידות');
  const warranty = element('p', 'lf-note', 'אחריות: 180 יום או 1,000 שעות — המוקדם מביניהם.');
  const actions = element('div', 'lf-detail-actions');
  const order = element('a', 'lf-primary', 'להזמנה ב־WhatsApp'); order.href = whatsappUrl(item); order.target = '_blank'; order.rel = 'noopener noreferrer';
  const call = element('a', 'lf-secondary', '052-4132938 — התקשרו'); call.href = 'tel:+972524132938';
  actions.append(order, call);
  const help = element('p', 'lf-contact-help', 'לבדיקת זמינות והתאמה למקרן — ');
  const number = element('a', 'lf-phone-number', '052-4132938'); number.href = 'tel:+972524132938'; number.dir = 'ltr';
  help.append(number);
  body.append(part, element('p', 'lf-price', priceText(item.lamp)), element('p', 'lf-note', 'המחיר המדויק יימסר לפי דגם הנורה.'), stock, help, warranty, actions, link);
  article.append(photo, body); return article;
}
function showMore() {
  const next = matches.slice(shown, shown + batchSize);
  for (const item of next) results.append(card(item));
  shown += next.length; more.hidden = shown >= matches.length;
  more.textContent = `הצגת תוצאות נוספות (${shown.toLocaleString('he-IL')} מתוך ${matches.length.toLocaleString('he-IL')})`;
}
function renderMatches() {
  results.replaceChildren(); shown = 0;
  status.className = 'lf-status';
  if (!matches.length) {
    status.className = 'lf-status lf-empty';
    status.replaceChildren(element('p', '', 'לא נמצאה התאמה בחיפוש הזה. נסו את דגם המקרן או את מספר הנורה ללא שם היצרן.'));
    const contact = element('a', '', 'לא מצאתם? נאתר עבורכם את הנורה'); contact.href = '#contact'; status.append(contact);
    more.hidden = true; return;
  }
  status.textContent = `נמצאו ${matches.length.toLocaleString('he-IL')} התאמות בקטלוג`;
  showMore();
}
root.querySelectorAll('.lf-tab').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  clearTimeout(autoTimer); results.replaceChildren(); status.textContent = ''; more.hidden = true;
  root.querySelectorAll('.lf-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  root.querySelectorAll('[data-field-mode]').forEach(field => field.hidden = field.dataset.fieldMode !== mode);
  (mode === 'lamp' ? lamp : model).focus();
}));
brand.addEventListener('change', () => { model.value = ''; updateSuggestions(); results.replaceChildren(); status.textContent = 'בחרו דגם מקרן להצגת הנורה המתאימה.'; more.hidden = true; });
let autoTimer;
async function automaticSearch(navigate = false) {
  if (!catalog) return;
  const query = mode === 'lamp' ? lamp.value.trim() : model.value.trim();
  if (!query) { results.replaceChildren(); status.textContent = ''; more.hidden = true; return; }
  matches = findMatches(catalog.models, mode === 'lamp' ? { lamp: query } : { brand: brand.value, model: query });
  if (navigate && matches.length === 1 && normalize(mode === 'lamp' ? matches[0].lamp.lampPartNumber : matches[0].model) === normalize(query)) { window.location.assign(itemUrl(matches[0])); return; }
  renderMatches();
}
for (const input of [model, lamp]) {
  input.addEventListener('input', () => { clearTimeout(autoTimer); autoTimer = setTimeout(automaticSearch, 180); });
  input.addEventListener('change', () => { clearTimeout(autoTimer); automaticSearch(true); });
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await ensureCatalog();
    if (mode === 'lamp' && !lamp.value.trim()) { lamp.focus(); status.textContent = 'הקלידו מספר נורה לחיפוש.'; return; }
    matches = findMatches(catalog.models, mode === 'lamp' ? { lamp: lamp.value.trim() } : { brand: brand.value, model: model.value.trim() });
    if (matches.length === 1) { window.location.assign(itemUrl(matches[0])); return; }
    renderMatches();
  } catch { /* ensureCatalog shows an explicit retryable error. */ }
});
more.addEventListener('click', showMore);
root.querySelector('#lf-reset').addEventListener('click', () => {
  form.reset(); matches = []; shown = 0; results.replaceChildren(); status.textContent = ''; status.className = 'lf-status'; more.hidden = true; updateSuggestions();
});
ensureCatalog().catch(() => {});

