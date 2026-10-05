import test from 'node:test';
import assert from 'node:assert/strict';
import { allocations, financialYear, suggestFields, taxRecordSchema } from '../lib/domain/tax-record.ts';
import { filterRecords } from '../lib/domain/vault-filter.ts';
const record = { supplier:'Example',number:'AU-01',issued:'2026-06-30',kind:'Expense',category:'Software & subscriptions',treatment:'GST included',total:'110.00',gst:'10.00',businessPercent:'75',gstRegistered:true,claimGst:true,notes:'',currency:'AUD',confirmed:true };
test('Australian FY rolls at July 1 and rejects invalid dates', () => {
  assert.equal(financialYear('2026-06-30'),'2025–2026'); assert.equal(financialYear('2026-07-01'),'2026–2027'); assert.equal(financialYear('2026-02-30'),'Unassigned');
});
test('GST is allocated from the actual invoice amount and business percentage', () => {
  assert.deepEqual(allocations(taxRecordSchema.parse(record)), {allocated:8250n,credit:750n,costExCredit:7500n});
  assert.equal(allocations(taxRecordSchema.parse({...record,claimGst:false})).credit,0n);
  assert.equal(allocations(taxRecordSchema.parse({...record,kind:'Personal',businessPercent:'0',claimGst:false})).allocated,0n);
});
test('tax records require review, valid numbers and valid GST eligibility selections', () => {
  for (const change of [{confirmed:false},{gst:'110.01'},{businessPercent:'100.01'},{gstRegistered:false},{kind:'Income'},{treatment:'GST-free'},{total:'1.001'},{issued:'2026-02-30'}]) assert.equal(taxRecordSchema.safeParse({...record,...change}).success,false,JSON.stringify(change));
});
test('extraction does not infer a GST claim or fill missing dates from filenames', () => {
  const candidate = suggestFields('Example Pty Ltd\nInvoice number: INV-1\nInvoice date: 30/06/2026\nSubtotal 100.00\nGST 10.00\nTotal 110.00');
  assert.deepEqual(candidate,{supplier:'Example Pty Ltd',number:'INV-1',issued:'2026-06-30',total:'110.00',gst:'10.00'});
  assert.equal(suggestFields('A file without a date').issued,'');
});
test('unreviewed documents never enter record totals or exports', () => {
  const documents = [{id:'a',name:'a.pdf',status:'Confirmed',record},{id:'b',name:'b.pdf',status:'Review',record:null}];
  assert.deepEqual(filterRecords(documents,{year:'2025–2026',query:'example',kind:'Expense',category:''}).map(doc=>doc.id),['a']);
  assert.equal(filterRecords(documents,{year:'2026–2027',query:'',kind:'',category:''}).length,0);
});
