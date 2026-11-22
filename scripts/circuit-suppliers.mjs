// The three circuit suppliers and the line that links their guide pages ("Circuit suppliers").
// Pure data and one string function, so the essentials guide (green circuits) and the supplier guides
// (scripts/circuit-supplier-pages.mjs) can share it without importing each other.
export const CIRCUIT_SUPPLIERS = [
  {id: 'green-circuits', label: 'Green circuits'},
  {id: 'advanced-circuits', label: 'Advanced circuits'},
  {id: 'processing-units', label: 'Processing units'},
];

/** One short line of links between the circuit supplier guides; the current page is plain text. Pages live in site/<id>/. */
export function circuitSuppliersLine(currentId) {
  const links = CIRCUIT_SUPPLIERS.map(s => s.id === currentId
    ? `<strong aria-current="page" data-circuit-supplier="${s.id}">${s.label}</strong>`
    : `<a href="../${s.id}/index.html" data-circuit-supplier="${s.id}">${s.label}</a>`).join(' · ');
  return `<p class="circuit-suppliers" data-circuit-suppliers>Circuit suppliers: ${links}</p>`;
}
