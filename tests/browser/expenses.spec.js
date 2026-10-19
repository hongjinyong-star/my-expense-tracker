import {test, expect} from '@playwright/test';
const key = 'my-expense-tracker.v1';
const legacy = [
  {id:'credit', date:'2026-10-01', description:'과거 신용', amount:12345, payment:'신용카드'},
  {id:'debit', date:'2026-10-02', description:'과거 체크', amount:6789, payment:'체크카드'},
  {id:'previous', date:'2026-09-30', description:'지난달', amount:999, payment:'현금'},
];
async function month(page) {
  await page.locator('#month').fill('2026-10');
  await page.locator('#month').dispatchEvent('change');
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function seed(page) {
  await page.goto('/');
  await page.evaluate(({key, legacy}) => localStorage.setItem(key, JSON.stringify(legacy)), {key, legacy});
  await page.reload();
  await month(page);
}
async function card(page, label, amount) {
  await expect(page.locator('.summary-card').filter({has: page.locator('span', {hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`)})})).toContainText(amount);
}
test('기존 저장 유지, 6개 신규 결제수단과 월간 합계, 새로고침', async ({page}) => {
  await seed(page);
  expect(await stored(page)).toEqual(legacy);
  await expect(page.locator('#expenses')).toContainText('신용카드');
  await expect(page.locator('#expenses')).toContainText('체크카드');
  await card(page, '월간 총 지출', '19,134원');
  await card(page, '신용카드 (기존 기록)', '12,345원');
  await card(page, '체크카드 (기존 기록)', '6,789원');
  const payments = ['삼성카드','KB카드','수원페이','현금','계좌이체','기타'];
  expect(await page.locator('select[name=payment] option').allTextContents()).toEqual(payments);
  for (const [index, payment] of payments.entries()) {
    await page.locator('[name=date]').fill('2026-10-19');
    await page.locator('[name=description]').fill(`신규 ${payment}`);
    await page.locator('[name=amount]').fill(String((index + 1) * 100));
    await page.locator('[name=payment]').selectOption(payment);
    await page.getByRole('button', {name:'등록하기', exact:true}).click();
    await card(page, payment, `${(index + 1) * 100}원`);
  }
  await card(page, '월간 총 지출', '21,234원');
  expect((await stored(page)).slice(0,3)).toEqual(legacy);
  await page.reload(); await month(page);
  await card(page, '월간 총 지출', '21,234원');
});
test('기존 기록 수정 보존, 새 결제수단 변경, 취소와 삭제', async ({page}) => {
  await seed(page);
  await page.getByRole('button', {name:'과거 신용 수정', exact:true}).click();
  await expect(page.locator('[name=payment]')).toHaveValue('신용카드');
  await page.getByRole('button', {name:'수정 저장', exact:true}).click();
  expect(await stored(page)).toEqual(legacy);
  await page.getByRole('button', {name:'과거 신용 수정', exact:true}).click();
  await page.locator('[name=payment]').selectOption('삼성카드');
  await page.getByRole('button', {name:'수정 저장', exact:true}).click();
  expect((await stored(page))[0]).toEqual({...legacy[0], payment:'삼성카드'});
  await card(page, '월간 총 지출', '19,134원');
  await card(page, '삼성카드', '12,345원');
  await page.getByRole('button', {name:'과거 체크 수정', exact:true}).click();
  await page.getByRole('button', {name:'수정 취소', exact:true}).click();
  await expect(page.locator('[name=payment] option')).toHaveCount(6);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name:'과거 체크 삭제', exact:true}).click();
  await card(page, '월간 총 지출', '12,345원');
  expect((await stored(page)).map(item => item.id)).toEqual(['credit','previous']);
});
test('기존 JSON 복원과 신규·과거 혼합 백업 왕복, 잘못된 복원 보호', async ({page}) => {
  await page.goto('/');
  page.on('dialog', dialog => dialog.accept());
  async function restore(data) {
    await page.locator('#backup-file').setInputFiles({name:'backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data))});
  }
  await restore({version:1, expenses:legacy});
  await expect(page.locator('#message')).toHaveText('3건의 지출을 복원했습니다.');
  expect(await stored(page)).toEqual(legacy);
  const mixed = [...legacy, {...legacy[0], id:'new', payment:'수원페이', amount:321}];
  await restore({version:1, expenses:mixed});
  await expect(page.locator('#message')).toHaveText('4건의 지출을 복원했습니다.');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'JSON 백업', exact:true}).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup).toEqual({version:1, expenses:mixed});
  await restore({version:1, expenses:[]});
  await expect(page.locator('#message')).toHaveText('0건의 지출을 복원했습니다.');
  await restore(backup);
  await expect(page.locator('#message')).toHaveText('4건의 지출을 복원했습니다.');
  expect(await stored(page)).toEqual(mixed);
  await restore({version:1, expenses:[{...legacy[0], payment:'미지원'}]});
  await expect(page.locator('#message')).toContainText('복원 실패');
  expect(await stored(page)).toEqual(mixed);
});
