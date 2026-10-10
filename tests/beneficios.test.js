// Testes do auxílio-reclusão e do auxílio por incapacidade temporária. Rodar: node tests/beneficios.test.js
// Dados fictícios.
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
require('../assets/direito.js');
require('../assets/pensao.js');
const B = require('../assets/beneficios.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 8 };
const dia = (o) => o.d + '/' + o.m + '/' + o.y;
const pad = (n) => String(n).padStart(2, '0');

function vinculo(ini, ate, fim, valor) {
  const meses = [];
  let y = ini[0], m = ini[1];
  while (y < ate[0] || (y === ate[0] && m <= ate[1])) { meses.push(`${pad(m)}/${y} ${valor || '1.500,00'}`); if (++m > 12) { m = 1; y++; } }
  const linhas = [];
  for (let i = 0; i < meses.length; i += 3) linhas.push(meses.slice(i, i + 3).join(' '));
  return [`1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/${pad(ini[1])}/${ini[0]}${fim ? ' ' + fim : ''}`, 'Remunerações', ...linhas].join('\n');
}
const reclusao = (txt, ent) => B.auxilioReclusao(C.analisar(txt, HOJE), ent, HOJE);
const incap = (txt, ent) => B.auxilioIncapacidade(C.analisar(txt, HOJE), ent, HOJE);

// ===== Auxílio-reclusão =====
// 30 contribuições, salário de R$ 1.500 (abaixo do limite de 2023: 1.754,18), preso em 15/03/2023
const v30 = vinculo([2020, 10], [2023, 3], '15/03/2023');
const par = { prisao: '2023-03-15', regime: 'fechado', dependente: 'conjuge', nascimento: '1990-05-05', uniao: '2015-01-01' };
let r = reclusao(v30, par);
assert.equal(r.carencia.status, 'cumprida');
assert.equal(r.duracao.anos, undefined);
assert.equal(r.duracao.rotulo, '15 anos');
assert.equal(dia(r.duracao.fim), '15/3/2038');
assert.equal(r.conclusao.status, 'provavel');
assert.match(r.valor.linhas[0], /um salário mínimo/);
// união com menos de 2 anos: 4 meses
r = reclusao(v30, Object.assign({}, par, { uniao: '2022-01-01' }));
assert.equal(r.duracao.rotulo, '4 meses');
// 23 contribuições: sem carência de 24
r = reclusao(vinculo([2021, 5], [2023, 3], '15/03/2023'), par);
assert.equal(r.carencia.status, 'nao_cumprida');
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.match(r.conclusao.rotulo, /carência/);
// 24 contribuições: cumprida
r = reclusao(vinculo([2021, 4], [2023, 3], '15/03/2023'), par);
assert.equal(r.carencia.status, 'cumprida');
// Renda acima do limite (2023: R$ 1.754,18)
r = reclusao(vinculo([2020, 10], [2023, 3], '15/03/2023', '2.500,00'), par);
assert.match(r.conclusao.rotulo, /renda/);
// Renda exatamente no limite
r = reclusao(vinculo([2020, 10], [2023, 3], '15/03/2023', '1.754,18'), par);
assert.equal(r.conclusao.status, 'provavel');
// Regime semiaberto e aberto
r = reclusao(v30, Object.assign({}, par, { regime: 'semiaberto' }));
assert.match(r.conclusao.rotulo, /regime/);
r = reclusao(v30, Object.assign({}, par, { regime: 'aberto' }));
assert.equal(r.conclusao.status, 'nao_demonstrado');
r = reclusao(v30, Object.assign({}, par, { regime: 'provisorio' }));
assert.equal(r.conclusao.status, 'provavel');
// Sem qualidade na prisão
r = reclusao(vinculo([2010, 1], [2012, 12], '31/12/2012'), Object.assign({}, par, { prisao: '2023-03-15' }));
assert.match(r.conclusao.rotulo, /qualidade/);
// Prisão antes de 18/01/2019 fica fora
r = reclusao(vinculo([2015, 1], [2018, 6], '30/06/2018'), Object.assign({}, par, { prisao: '2018-06-30' }));
assert.equal(r.conclusao.status, 'incompleta');
// Início: 90 dias da prisão
assert.equal(dia(reclusao(v30, Object.assign({ requerimento: '2023-06-13' }, par)).inicio.dib), '15/3/2023');
assert.equal(dia(reclusao(v30, Object.assign({ requerimento: '2023-06-14' }, par)).inicio.dib), '14/6/2023');
// Filho: até 21 anos
r = reclusao(v30, Object.assign({}, par, { dependente: 'filho', nascimento: '2015-01-01' }));
assert.equal(dia(r.duracao.fim), '1/1/2036');
r = reclusao(v30, Object.assign({}, par, { dependente: 'filho', nascimento: '2000-01-01' }));
assert.equal(r.conclusao.status, 'nao_demonstrado');
// Pais exigem prova de dependência econômica
r = reclusao(v30, Object.assign({}, par, { dependente: 'pai_mae' }));
assert.equal(r.conclusao.status, 'depende');
// Benefício incompatível em gozo na prisão
r = reclusao(v30 + '\n2 ' + NIT + ' 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 01/03/2023', par);
assert.equal(r.conclusao.status, 'nao_demonstrado');
// Carência após perda de qualidade: metade (12) a partir da nova filiação
const comPerda = vinculo([2015, 1], [2017, 12], '31/12/2017') + '\n' + vinculo([2021, 4], [2023, 3], '15/03/2023').replace(/^1 /, '2 ');
r = reclusao(comPerda, par);
assert.equal(r.carencia.status, 'cumprida', 'depois da perda, 24 contribuições no retorno cumprem a metade');
const comPerda2 = vinculo([2015, 1], [2017, 12], '31/12/2017') + '\n' + vinculo([2022, 7], [2023, 3], '15/03/2023').replace(/^1 /, '2 ');
r = reclusao(comPerda2, par);
assert.equal(r.carencia.status, 'nao_cumprida', 'só 9 contribuições depois do retorno (< 12)');
// Limite 2026
assert.equal(B.LIMITE_RENDA[2026], 1980.38);

// ===== Auxílio por incapacidade temporária =====
const v13 = vinculo([2022, 1], [2023, 1], '31/01/2023');
const base = { dii: '2023-01-10', origem: 'comum', preexistente: 'nao' };
r = incap(v13, base);
assert.equal(r.carencia.status, 'cumprida');
assert.equal(r.conclusao.status, 'depende');
assert.match(r.conclusao.rotulo, /perícia/);
// 11 contribuições: sem carência de 12
const v11 = vinculo([2022, 3], [2023, 1], '31/01/2023');
r = incap(v11, base);
assert.equal(r.carencia.status, 'nao_cumprida');
assert.equal(r.conclusao.status, 'nao_demonstrado');
// Acidente dispensa a carência
r = incap(v11, Object.assign({}, base, { origem: 'acidente' }));
assert.equal(r.carencia.status, 'dispensada');
assert.equal(r.conclusao.status, 'depende');
r = incap(v11, Object.assign({}, base, { origem: 'doenca_lista' }));
assert.equal(r.carencia.status, 'dispensada');
// Incapacidade anterior à filiação
r = incap(v13, Object.assign({}, base, { preexistente: 'sim' }));
assert.equal(r.conclusao.status, 'nao_demonstrado');
r = incap(v13, Object.assign({}, base, { preexistente: 'agravamento' }));
assert.equal(r.conclusao.status, 'depende');
// Qualidade perdida na DII
r = incap(vinculo([2010, 1], [2012, 12], '31/12/2012'), { dii: '2023-01-10', origem: 'comum', preexistente: 'nao' });
assert.match(r.conclusao.rotulo, /qualidade/);
// Período de graça: DII até 12 meses depois do fim do vínculo, mesmo com pedido tardio
r = incap(vinculo([2021, 1], [2022, 12], '31/12/2022'), { dii: '2023-06-01', origem: 'comum', preexistente: 'nao', requerimento: '2026-01-01' });
assert.notEqual(r.conclusao.status, 'nao_demonstrado');
// Início: empregado a partir do 16º dia; pedido com mais de 30 dias: DER
r = incap(v13, Object.assign({}, base, { afastamento: '2023-01-10', requerimento: '2023-02-01' }));
assert.equal(dia(r.inicio.dib), '25/1/2023');
r = incap(v13, Object.assign({}, base, { afastamento: '2023-01-10', requerimento: '2023-03-01' }));
assert.equal(dia(r.inicio.dib), '1/3/2023');
// Sem DII
assert.equal(incap(v13, {}).conclusao.status, 'incompleta');
// Carência após perda: metade (6) a partir da nova filiação
const perdaInc = vinculo([2015, 1], [2017, 12], '31/12/2017') + '\n' + vinculo([2022, 8], [2023, 1], '31/01/2023').replace(/^1 /, '2 ');
r = incap(perdaInc, base);
assert.equal(r.carencia.status, 'cumprida', '6 contribuições depois do retorno');
const perdaInc2 = vinculo([2015, 1], [2017, 12], '31/12/2017') + '\n' + vinculo([2022, 10], [2023, 1], '31/01/2023').replace(/^1 /, '2 ');
r = incap(perdaInc2, base);
assert.equal(r.carencia.status, 'nao_cumprida', 'só 4 contribuições depois do retorno');

console.log('beneficios.test.js: ok');
