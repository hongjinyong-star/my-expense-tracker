import {PAYMENTS, LEGACY_PAYMENTS, STORAGE_KEY, validateExpenses, parseBackup, monthlySummary} from './model.js';
const $ = selector => document.querySelector(selector);
const form = $('#expense-form');
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const money = amount => `${amount.toLocaleString('ko-KR')}원`;
let expenses = [], editingId = null, storageHealthy = true;
function message(text) { $('#message').textContent = text; }
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) expenses = validateExpenses(JSON.parse(saved));
} catch {
  storageHealthy = false;
  message('저장된 데이터를 읽을 수 없습니다. 기존 데이터를 보호하기 위해 저장을 중지했습니다. 정상 백업을 복원하거나 브라우저 저장 설정을 확인하세요.');
}
$('#month').value = localDate.slice(0, 7);
form.elements.date.value = localDate;
function commit(next, recovery = false) {
  if (!storageHealthy && !recovery) { message('저장할 수 없습니다. 정상 JSON 백업을 복원하거나 저장 설정을 확인하세요.'); return false; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); expenses = next; storageHealthy = true; return true; }
  catch { message('저장 공간이 부족하거나 브라우저 저장이 차단되었습니다. 변경 사항을 저장하지 못했습니다.'); return false; }
}
function paymentOptions(current) {
  const select = form.elements.payment;
  select.replaceChildren(...PAYMENTS.map(payment => new Option(payment, payment)));
  if (LEGACY_PAYMENTS.includes(current)) {
    select.add(new Option(`${current} (기존 기록)`, current));
  }
  if (current) select.value = current;
}
paymentOptions();
function resetForm() {
  paymentOptions();
  editingId = null; form.reset(); form.elements.date.value = localDate;
  $('#form-title').textContent = '지출 등록'; form.querySelector('[type=submit]').textContent = '등록하기'; $('#cancel').hidden = true;
}
function cell(row, text) { const td = document.createElement('td'); td.textContent = text; row.append(td); return td; }
function render() {
  const {selected, totals, total} = monthlySummary(expenses, $('#month').value);
  $('#summary').replaceChildren();
  for (const [label, value] of [['월간 총 지출', total], ...PAYMENTS.map(p => [p, totals[p]]), ...LEGACY_PAYMENTS.filter(p => selected.some(item => item.payment === p)).map(p => [`${p} (기존 기록)`, totals[p]])]) {
    const card = document.createElement('div'); card.className = 'summary-card';
    const title = document.createElement('span'); title.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = money(value); card.append(title, amount); $('#summary').append(card);
  }
  $('#count').textContent = `${selected.length}건`; $('#empty').hidden = selected.length > 0; $('#expenses').replaceChildren();
  for (const item of selected.toSorted((a, b) => b.date.localeCompare(a.date))) {
    const row = document.createElement('tr'); cell(row, item.date); cell(row, item.description); cell(row, item.payment); cell(row, money(item.amount));
    const actions = cell(row, '');
    for (const action of ['수정', '삭제']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = action; button.setAttribute('aria-label', `${item.description} ${action}`);
      button.addEventListener('click', () => {
        if (action === '수정') {
          editingId = item.id;
          paymentOptions(item.payment);
          for (const key of ['date', 'description', 'amount', 'payment']) form.elements[key].value = item[key];
          $('#form-title').textContent = '지출 수정'; form.querySelector('[type=submit]').textContent = '수정 저장'; $('#cancel').hidden = false; form.elements.description.focus();
        } else if (confirm(`“${item.description}” 지출을 삭제할까요?`)) {
          if (commit(expenses.filter(e => e.id !== item.id))) { if (editingId === item.id) resetForm(); render(); message('지출을 삭제했습니다.'); }
        }
      }); actions.append(button);
    }
    $('#expenses').append(row);
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const item = {id: editingId || crypto.randomUUID(), date: form.elements.date.value, description: form.elements.description.value, amount: Number(form.elements.amount.value), payment: form.elements.payment.value};
  try { validateExpenses([item]); } catch (error) { message(error.message); return; }
  const next = editingId ? expenses.map(e => e.id === editingId ? item : e) : [...expenses, item];
  if (commit(next)) { $('#month').value = item.date.slice(0, 7); resetForm(); render(); message('지출을 저장했습니다.'); }
});
$('#cancel').addEventListener('click', resetForm);
$('#month').addEventListener('change', () => { if ($('#month').value) render(); });
$('#export').addEventListener('click', () => {
  if (!storageHealthy) { message('저장된 데이터를 읽을 수 없어 백업을 중지했습니다.'); return; }
  const blob = new Blob([JSON.stringify({version: 1, expenses}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `my-expenses-${localDate}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('JSON 백업을 다운로드했습니다.');
});
$('#import').addEventListener('click', () => $('#backup-file').click());
$('#backup-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 백업 파일을 선택하세요.');
    const next = parseBackup(await file.text());
    if (!confirm(`${next.length}건을 복원합니다. 현재 지출 내역 전체가 교체됩니다. 계속할까요?`)) return;
    if (commit(next, true)) { resetForm(); render(); message(`${next.length}건의 지출을 복원했습니다.`); }
  } catch (error) { message(`복원 실패: ${error.message}`); }
  finally { event.target.value = ''; }
});
render();
