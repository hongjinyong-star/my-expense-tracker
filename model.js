export const PAYMENTS = ['신용카드', '체크카드', '현금', '계좌이체', '기타'];
export const STORAGE_KEY = 'my-expense-tracker.v1';
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateExpenses(data) {
  if (!Array.isArray(data)) throw new Error('지출 목록 형식이 올바르지 않습니다.');
  const ids = new Set();
  return data.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || !validDate(item.date) || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 100 || !Number.isSafeInteger(item.amount) || item.amount < 1 || item.amount > 999999999999 || !PAYMENTS.includes(item.payment)) throw new Error('올바르지 않거나 중복된 지출 데이터가 있습니다.');
    ids.add(item.id);
    return {id: item.id, date: item.date, description: item.description.trim(), amount: item.amount, payment: item.payment};
  });
}
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 1) throw new Error('지원하지 않는 백업 버전입니다.');
  return validateExpenses(data.expenses);
}
export function monthlySummary(expenses, month) {
  const selected = expenses.filter(item => item.date.slice(0, 7) === month);
  const totals = Object.fromEntries(PAYMENTS.map(payment => [payment, 0]));
  for (const item of selected) totals[item.payment] += item.amount;
  return {selected, totals, total: selected.reduce((sum, item) => sum + item.amount, 0)};
}
