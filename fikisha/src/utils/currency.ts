const kesFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatKES(value: number): string {
  return kesFormatter.format(Number.isFinite(value) ? value : 0);
}
