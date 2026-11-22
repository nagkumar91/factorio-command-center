// The supplier guides (green circuits, advanced circuits, processing units, plastic bars, oil products) and the line that links them.
// Pure data and one string function, so the essentials guide (green circuits) and the supplier guides
// (scripts/circuit-supplier-pages.mjs, scripts/plastic-bar-pages.mjs, scripts/oil-product-pages.mjs) can share it without importing each other.
export const SUPPLIERS = [
  {id: 'green-circuits', label: 'Green circuits'},
  {id: 'advanced-circuits', label: 'Advanced circuits'},
  {id: 'processing-units', label: 'Processing units'},
  {id: 'plastic-bars', label: 'Plastic bars'},
  {id: 'oil-products', label: 'Oil products'},
];

/** One short line of links between the supplier guides; the current page is plain text. Pages live in site/<id>/. */
export function suppliersLine(currentId) {
  const links = SUPPLIERS.map(s => s.id === currentId
    ? `<strong aria-current="page" data-supplier="${s.id}">${s.label}</strong>`
    : `<a href="../${s.id}/index.html" data-supplier="${s.id}">${s.label}</a>`).join(' · ');
  return `<p class="suppliers" data-suppliers>Suppliers: ${links}</p>`;
}
export const SUPPLIERS_STYLE = '.suppliers{padding:10px 14px;border:1px solid #465249;border-radius:6px;background:#1b2621}.suppliers a{white-space:nowrap}';
