import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateFile } from '../lib/server/extraction.ts';
import { exportVault } from '../lib/server/vault-export.ts';
import { localOnly, database, storeDocument, confirmDocument, listDocuments, originalFile } from '../lib/server/vault.ts';
import ExcelJS from 'exceljs';
import { PGlite } from '@electric-sql/pglite';

test('uploads reject disguised files, empty files and oversized images', () => {
  assert.throws(()=>validateFile(Buffer.from('not a PDF'),'invoice.pdf','application/pdf'));
  assert.throws(()=>validateFile(Buffer.from('%PDF-1.7'),'invoice.png','image/png'));
  assert.throws(()=>validateFile(Buffer.alloc(0),'invoice.pdf','application/pdf'));
  const png=Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(10000,16); png.writeUInt32BE(10000,20);
  assert.throws(()=>validateFile(png,'invoice.png','image/png'));
});
test('unauthenticated vault fails closed outside local development and rejects cross-origin writes', () => {
  const original=process.env.NODE_ENV;
  process.env.NODE_ENV='production'; assert.throws(()=>localOnly(new Request('http://localhost:3000/api/vault')));
  process.env.NODE_ENV='development';
  assert.throws(()=>localOnly(new Request('http://example.com/api/vault')));
  assert.throws(()=>localOnly(new Request('http://localhost:3000/api/vault',{method:'POST',headers:{origin:'https://example.com','x-invoiceflow-vault':'local'}})));
  assert.throws(()=>localOnly(new Request('http://localhost:3000/api/vault',{method:'POST'})));
  assert.doesNotThrow(()=>localOnly(new Request('http://localhost:3000/api/vault',{method:'POST',headers:{origin:'http://localhost:3000','x-invoiceflow-vault':'local'}})));
  if(original===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=original;
});
test('Excel export preserves numbers, dates, source IDs, FY and selected GST allocations', async () => {
  const record={supplier:'=Example supplier',number:'001',issued:'2026-07-01',kind:'Expense',category:'Software & subscriptions',treatment:'GST included',currency:'AUD',total:'110.00',gst:'10.00',businessPercent:'75',gstRegistered:true,claimGst:true,notes:'Reviewed',confirmed:true};
  const bytes=await exportVault([{id:'test-id',name:'test.pdf',hash:'abc',method:'PDF text',record}]);
  const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  const sheet=workbook.getWorksheet('Records');
  assert.equal(sheet.getCell('B2').value,'=Example supplier'); assert.equal(sheet.getCell('C2').value,'001'); assert.equal(sheet.getCell('E2').value,'2026–2027');
  assert.equal(sheet.getCell('J2').value,110); assert.equal(sheet.getCell('O2').value,82.5); assert.equal(sheet.getCell('P2').value,7.5); assert.equal(sheet.getCell('Q2').value,75);
  assert.equal(sheet.getCell('B2').type,ExcelJS.ValueType.String);
  assert.equal(workbook.getWorksheet('Overview').getCell('B7').value,7.5);
});
test('embedded PostgreSQL records survive closing and reopening their data directory', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'invoiceflow-db-test-'));
  let db;
  try {
    db=new PGlite(directory); await db.exec('CREATE TABLE records (id TEXT PRIMARY KEY, payload JSONB NOT NULL)'); await db.query('INSERT INTO records VALUES ($1,$2)',['test',JSON.stringify({total:'110.00'})]); await db.close();
    db=new PGlite(directory); const result=await db.query('SELECT payload FROM records WHERE id=$1',['test']); assert.equal(result.rows[0].payload.total,'110.00'); await db.close(); db=undefined;
  } finally { if(db) await db.close(); assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir())); assert.ok(path.basename(directory).startsWith('invoiceflow-db-test-')); await rm(directory,{recursive:true,force:true}); }
});
test('vault retains exact originals, deduplicates files and confirms a record only once', async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'invoiceflow-vault-test-'));
  const previous=process.env.INVOICEFLOW_DATA_DIR;
  process.env.INVOICEFLOW_DATA_DIR=directory;
  let db;
  try {
    db=await database();
    const workspaceId='00000000-0000-4000-8000-000000000001';
    await db.query('INSERT INTO business_workspace(id,name,onboarding_complete) VALUES($1,$2,true)',[workspaceId,'Fixture business']);
    const bytes=Buffer.from('Disposable original document fixture');
    const candidate={supplier:'Example',number:'1',issued:'2026-07-01',total:'11.00',gst:'1.00'};
    const value={name:'fixture.pdf',mime:'application/pdf',status:'Review',method:'Manual review',text:'',candidate,notice:'',record:null};
    const first=await storeDocument(workspaceId,bytes,value), duplicate=await storeDocument(workspaceId,bytes,value);
    assert.equal(duplicate.duplicate,true); assert.equal(duplicate.document.id,first.document.id);
    assert.deepEqual(await originalFile(workspaceId,first.document.id),bytes);
    assert.equal((await listDocuments(workspaceId)).length,1); assert.equal(first.document.record,null);
    const record={...candidate,kind:'Expense',category:'Other',treatment:'GST included',businessPercent:'100',gstRegistered:true,claimGst:true,notes:'',currency:'AUD',confirmed:true};
    assert.equal((await confirmDocument(workspaceId,first.document.id,record)).status,'Confirmed');
    await assert.rejects(()=>confirmDocument(workspaceId,first.document.id,record),error=>error.status===409);
    assert.equal((await listDocuments(workspaceId))[0].record.total,'11.00');
    db=await database();
  } finally {
    if(db) await db.close();
    if(previous===undefined) delete process.env.INVOICEFLOW_DATA_DIR; else process.env.INVOICEFLOW_DATA_DIR=previous;
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir())); assert.ok(path.basename(directory).startsWith('invoiceflow-vault-test-')); await rm(directory,{recursive:true,force:true});
  }
});
