const kesFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatKES(value) {
  const amount = Number(value);
  return kesFormatter.format(Number.isFinite(amount) ? amount : 0);
}
