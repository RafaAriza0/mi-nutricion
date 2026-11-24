import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftDate, weekDateKeys, weekLoggedDateKeys } from './domain.ts';

test('la semana empieza el lunes y contiene siete días consecutivos',()=>{
 assert.deepEqual(weekDateKeys('2026-10-16'),[
  '2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18',
 ]);
});

test('la semana y el cambio de siete días cruzan correctamente meses y años',()=>{
 assert.deepEqual(weekDateKeys('2026-12-31'),[
  '2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03',
 ]);
 assert.equal(shiftDate('2026-12-31',7),'2027-01-07');
 assert.equal(shiftDate('2026-01-01',-7),'2025-12-25');
});

test('marca solo los días con registros de la semana visible y elimina fechas duplicadas',()=>{
 const logs=[
  {date:'2026-10-12'},
  {date:'2026-10-12'},
  {date:'2026-10-18'},
  {date:'2026-10-19'},
 ];
 assert.deepEqual([...weekLoggedDateKeys(logs,'2026-10-16')],['2026-10-12','2026-10-18']);
 assert.deepEqual([...weekLoggedDateKeys([],'2026-10-16')],[]);
});
