export function formatRupees(amount) {
  return `\u20B9${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
