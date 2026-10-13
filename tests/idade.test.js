// Testes da aposentadoria por idade. Rodar: node tests/idade.test.js (dados fictícios)
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
require('../assets/direito.js');
const I = require('../assets/idade.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 13 };
const pad = (n) => String(n).padStart(2, '0');
function vinculo(ini, ate, fim, valor, tipo) {
  const meses = []; let y = ini[0], m = ini[1];
  while (y < ate[0] || (y === ate[0] && m <= ate[1])) { meses.push(`${pad(m)}/${y} ${valor || '2.000,00'}`); if (++m > 12) { m = 1; y++; } }
  const linhas = []; for (let i = 0; i < meses.length; i += 3) linhas.push(meses.slice(i, i + 3).join(' '));
  return [`1 ${NIT} 11.111.111/0001-11 EMPRESA ${tipo || 'Empregado'} 01/${pad(ini[1])}/${ini[0]}${fim ? ' ' + fim : ''}`, 'Remunerações', ...linhas].join('\n');
}
const ap = (txt, ent) => I.aposentadoriaIdade(C.analisar(txt, HOJE), Object.assign({ modalidade: 'urbana' }, ent), HOJE);

// mulher filiada antes de 13/11/2019: idade progressiva
assert.equal(I.dataIdadeMulherTransicao({ y: 1959, m: 3, d: 10, ord: C.ordemDe(1959, 3, 10) }).R, 60);
assert.equal(I.dataIdadeMulherTransicao({ y: 1962, m: 3, d: 10, ord: C.ordemDe(1962, 3, 10) }).R, 62);
let d = I.dataIdadeMulherTransicao({ y: 1960, m: 6, d: 1, ord: C.ordemDe(1960, 6, 1) });
assert.equal(d.R, 60.5); // 60,5 completados em 12/2020
assert.equal(I.carenciaExigida(2005, true), 144);
assert.equal(I.carenciaExigida(2005, false), 180);

// homem 65, 15 anos de empregado: cumpre
let r = ap(vinculo([2000, 1], [2016, 12], '31/12/2016'), { sexo: 'M', nascimento: '1955-01-01', der: '2021-01-10' });
assert.equal(r.conclusao.status, 'provavel');
assert.ok(r.carencia.total >= 180);
// idade não atingida
r = ap(vinculo([2000, 1], [2016, 12], '31/12/2016'), { sexo: 'M', nascimento: '1960-01-01', der: '2021-01-10' });
assert.equal(r.conclusao.status, 'nao_demonstrado');
// filiado depois de 13/11/2019: homem exige 20 anos
r = ap(vinculo([2020, 1], [2036 - 20, 12]), { sexo: 'M', nascimento: '1955-01-01', der: '2026-01-10' });
assert.equal(r.tempo.exigidoAnos, 20);
// segurado especial não conta na urbana, conta na rural
const esp = `1 ${NIT} Segurado Especial 01/01/2000 31/12/2016\n`;
r = ap(esp, { sexo: 'M', nascimento: '1955-01-01', der: '2021-01-10' });
assert.equal(r.carencia.total, 0);
const rr = I.aposentadoriaIdade(C.analisar(esp, HOJE), { modalidade: 'rural', sexo: 'M', nascimento: '1955-01-01', der: '2021-01-10' }, HOJE);
assert.ok(rr.carencia.total >= 180);
// sem datas: incompleta
assert.equal(ap(esp, { sexo: 'F' }).conclusao.status, 'incompleta');
// inscrito até 1991, idade em 2005: só carência (144), sem 15 anos
r = ap(vinculo([1990, 1], [2002, 12], '31/12/2002'), { sexo: 'M', nascimento: '1940-01-01', der: '2005-02-01' });
assert.equal(r.tempo.exigidoAnos, 0);
assert.equal(r.conclusao.status, 'provavel');
// direito adquirido antes da EC: 65 anos em 2018, 12 anos de carência 180 cumpridos, DER em 2022
r = ap(vinculo([2000, 1], [2014, 12], '31/12/2014'), { sexo: 'M', nascimento: '1953-01-01', der: '2022-01-10' });
assert.equal(r.tempo.exigidoAnos, 0);
// idade só depois da EC: continua exigindo 15 anos
r = ap(vinculo([2000, 1], [2010, 12], '31/12/2010'), { sexo: 'M', nascimento: '1956-01-01', der: '2022-01-10' });
assert.equal(r.tempo.exigidoAnos, 15);
console.log('idade.test.js: ok');
