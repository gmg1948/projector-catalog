import { loadCatalog, itemUrl, priceText, whatsappUrl, element } from './catalog.js';
function spec(list, label, value) {
  if (value === undefined || value === null || value === '') return;
  const row = element('div'); const dd = element('dd'); dd.append(element('bdi', '', String(value)));
  row.append(element('dt', '', label), dd); list.append(row);
}
export async function renderProduct(container, params = new URLSearchParams(location.search)) {
try {
  const catalog = await loadCatalog();
  const item = catalog.models.find(x => x.lamp.slug === params.get('lamp') && x.modelKey === params.get('model'));
  if (!item) {
    document.title = 'הנורה לא נמצאה | Project-OR';
    container.replaceChildren(element('h1', '', 'לא נמצאה נורה בכתובת הזו'), element('p', 'lf-intro', 'אפשר לחזור לחיפוש ולאתר את דגם המקרן שלכם.'));
  } else {
    document.title = `נורה למקרן ${item.brand} ${item.model} | ${item.lamp.lampPartNumber} | Project-OR`;
    const description = document.querySelector('meta[name="description"]');
    description.content = `נורה מקורית למקרן ${item.brand} ${item.model}, מספר נורה ${item.lamp.lampPartNumber}. בדיקת התאמה, מחיר וזמינות והזמנה מפרויקט אור.`;
    container.replaceChildren();
    const grid = element('div', 'lf-detail-grid');
    const info = element('div'); info.append(element('p', 'lf-eyebrow', 'נורה מקורית עם בית נורה'));
    const title = element('h1', '', 'נורה למקרן '); title.append(element('bdi', '', `${item.brand} ${item.model}`)); info.append(title);
    const specs = element('dl', 'lf-specs');
    spec(specs, 'יצרן מקרן', item.brand); spec(specs, 'דגם מקרן', item.model); spec(specs, 'מספר נורה', item.lamp.lampPartNumber);
    spec(specs, 'מחיר', priceText(item.lamp));
    if (typeof item.lamp.stock === 'number') spec(specs, 'זמינות במלאי', item.lamp.stock > 0 ? `${item.lamp.stock} יחידות — בכפוף לאישור` : 'צרו קשר לבדיקת זמינות');
    spec(specs, 'טכנולוגיה לפי הקטלוג', item.technology); spec(specs, 'אורך חיים לפי הקטלוג (שעות)', item.lifetime);
    info.append(specs);
    if (item.specs) info.append(element('p', 'lf-intro', item.specs));
    const actions = element('div', 'lf-detail-actions');
    const whatsapp = element('a', 'lf-primary', 'להזמנה ב־WhatsApp'); whatsapp.href = whatsappUrl(item); whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer';
    const phone = element('a', 'lf-secondary', '052-4132938 — לבדיקת זמינות והתאמה'); phone.href = 'tel:+972524132938';
    actions.append(whatsapp, phone);
    const callHelp = element('p', 'lf-contact-help', 'שאלות על הנורה? התקשרו עכשיו: ');
    const callNumber = element('a', 'lf-phone-number', '052-4132938'); callNumber.href = 'tel:+972524132938'; callNumber.dir = 'ltr'; callHelp.append(callNumber);
    info.append(actions, callHelp, element('p', 'lf-note', 'נאשר את ההתאמה המדויקת, המחיר והזמינות לפני התשלום.'));
    const visual = element('div');
    const img = element('img', 'lf-detail-image'); img.src = item.imagePath || item.lamp.imagePath; img.alt = 'נורת מקרן — תמונה להמחשה בלבד';
    visual.append(img, element('span', 'lf-illustration', 'תמונה להמחשה בלבד — מראה בית הנורה עשוי להשתנות לפי הדגם'));
    grid.append(info, visual); container.append(grid);
    const related = catalog.models.filter(x => x.lamp.slug === item.lamp.slug && x.modelKey !== item.modelKey);
    if (related.length) {
      const section = element('section', 'lf-related'); section.append(element('h2', '', 'מקרנים נוספים עם אותו מספר נורה בקטלוג'));
      const links = element('div', 'lf-related-links');
      for (const other of related) { const link = element('a', '', `${other.brand} ${other.model}`); link.href = itemUrl(other); links.append(link); }
      section.append(links); container.append(section);
    }
  }
} catch (error) {
  container.replaceChildren(element('p', 'lf-status lf-error', 'לא ניתן לטעון כעת את פרטי הנורה. נסו לרענן את הדף או התקשרו ל־052-4132938.'));
}

}
const productContainer = document.getElementById('lf-product');
if (productContainer) renderProduct(productContainer);
