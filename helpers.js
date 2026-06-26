// ── Period calculation ──────────────────────────────────
function currentPeriod() {
  const n = new Date();
  return {
    year:  n.getFullYear(),
    month: n.getMonth() + 1,
    week:  Math.min(Math.ceil(n.getDate() / 7), 4),
  };
}
// ── Employee name validation ────────────────────────────
const INVALID_NAME_TOKENS = new Set([
  'staff', 'n a', 'na', 'none', 'nil', 'test', 'employee',
  'unknown', 'anonymous', 'tbd', 'x', 'xx', 'xxx',
]);
function isValidEmployeeName(raw) {
  if (!raw) return false;
  const trimmed = String(raw).trim();
  if (trimmed.length < 2) return false;
  if (/^[-_.\s]+$/.test(trimmed)) return false;
  const stripped = trimmed.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  return !INVALID_NAME_TOKENS.has(stripped);
}
function normalizeName(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}
function buildAutoAliases(canonicalName) {
  const full  = normalizeName(canonicalName);
  const parts = full.split(' ').filter(Boolean);
  const out   = new Set([full]);
  if (parts.length)     out.add(parts[0]);                       // first name
  if (parts.length > 1) out.add(parts.map(p => p[0]).join(''));  // initials
  return Array.from(out);
}
module.exports = {
  currentPeriod,
  isValidEmployeeName,
  normalizeName,
  buildAutoAliases,
};