export function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function parseCsvList(input) {
  return String(input || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}
