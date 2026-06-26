const INVALID_NAME_TOKENS = new Set([
  'staff', 'n a', 'na', 'none', 'nil', 'test', 'employee',
  'unknown', 'anonymous', 'tbd', 'x', 'xx', 'xxx'
]);
function isValidEmployeeName(raw) {
  if (!raw) return false;
  const trimmed = String(raw).trim();
  if (trimmed.length < 2) return false;
  if (/^[-_.\s]+$/.test(trimmed)) return false;
  const stripped = trimmed.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  if (INVALID_NAME_TOKENS.has(stripped)) return false;
  return true;
}
function normalizeName(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}
function buildAutoAliases(canonicalName) {
  const full = normalizeName(canonicalName);
  const parts = full.split(' ').filter(Boolean);
  const out = new Set([full]);
  if (parts.length) out.add(parts[0]);
  if (parts.length > 1) out.add(parts.map(p => p[0]).join(''));
  return Array.from(out);
}
module.exports = { isValidEmployeeName, normalizeName, buildAutoAliases, INVALID_NAME_TOKENS };