import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExpenses, parseBackup, monthlySummary, validDate} from '../model.js';
const expense = {id:'one', date:'2026-10-19', description:'점심', amount:12000, payment:'현금'};
test('월과 결제수단별 합계', () => {
 const result = monthlySummary([expense, {...expense,id:'two',payment:'신용카드',amount:5000}, {...expense,id:'old',date:'2026-09-19'}], '2026-10');
 assert.equal(result.total,17000); assert.equal(result.totals['현금'],12000); assert.equal(result.totals['신용카드'],5000); assert.equal(result.selected.length,2);
});
test('백업 왕복과 빈 목록 복원', () => {assert.deepEqual(parseBackup(JSON.stringify({version:1,expenses:[expense]})),[expense]);assert.deepEqual(parseBackup('{"version":1,"expenses":[]}'),[]);});
test('손상된 백업, 중복 ID, 잘못된 값 거부', () => {
 for (const text of ['bad','null','{}','{"version":2,"expenses":[]}']) assert.throws(()=>parseBackup(text));
 assert.throws(()=>validateExpenses([expense,expense]));
 for (const patch of [{amount:0},{amount:-1},{amount:1.5},{amount:'100'},{date:'2026-02-30'},{description:' '},{payment:'unknown'},{id:''}]) assert.throws(()=>validateExpenses([{...expense,...patch}]));
});
test('실제 달력 날짜 검사',()=>{assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2025-02-29'),false);assert.equal(validDate('0000-01-01'),false);});
test('v1.1과 과거 결제수단 혼합 검증 및 백업에서 금액·날짜 보존', () => {
 const payments = ['삼성카드','KB카드','수원페이','현금','계좌이체','기타','신용카드','체크카드'];
 const items = payments.map((payment, index) => ({...expense, id:String(index), date:'2024-02-29', amount:index+1, payment}));
 assert.deepEqual(validateExpenses(items), items);
 assert.deepEqual(parseBackup(JSON.stringify({version:1, expenses:items})), items);
 const summary = monthlySummary([...items, {...expense,id:'outside',date:'2024-03-01'}], '2024-02');
 assert.equal(summary.total,36);
 assert.deepEqual(summary.totals, Object.fromEntries(payments.map((p,i)=>[p,i+1])));
 assert.deepEqual(monthlySummary(items,'2025-01').totals, Object.fromEntries(payments.map(p=>[p,0])));
});
