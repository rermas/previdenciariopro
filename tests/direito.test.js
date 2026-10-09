// Testes do módulo "Verificar direito" (salário-maternidade). Rodar: node tests/direito.test.js
// Dados fictícios. Datas de vencimento calculadas à mão (dia 15 do mês seguinte; fim de semana passa à segunda).
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
const D = require('../assets/direito.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 8 };
const v = (s, n, i, f) => `${s} ${NIT} 11.111.111/0001-11 ${n} Empregado ${i}${f ? ' ' + f : ''}`;
const rodar = (txt, ent) => D.salarioMaternidade(C.analisar(txt, HOJE), ent, HOJE);
const dia = (o) => o.d + '/' + o.m + '/' + o.y;

// Vencimento: contribuição de abril/2026 vence 15/05/2026 (sexta); de maio/2026 vence 15/06 (segunda); de junho/2026, 15/07 (quarta)
// 15/11/2025 foi sábado -> segunda 17/11
assert.equal(dia(C.dataDeOrd(D.vencimento(C.mesDe(2026, 4)))), '15/5/2026');
assert.equal(dia(C.dataDeOrd(D.vencimento(C.mesDe(2025, 10)))), '17/11/2025');

// Vínculo ativo na data
let r = rodar(v(1, 'EMP A', '01/03/2024'), { tipo: 'parto', data: '2026-06-10' });
assert.equal(r.qualidade.status !== 'nao_demonstrada', true);
assert.equal(r.carencia.status, 'dispensada');

// Vínculo encerrado 31/03/2025: graça de 12 meses vai até 15/05/2026
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2026-05-15' });
assert.equal(r.qualidade.status, 'confirmada');
assert.equal(dia(r.qualidade.graca.ateBase), '15/5/2026');
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2026-05-16' });
assert.notEqual(r.qualidade.status, 'confirmada');
assert.equal(dia(r.qualidade.graca.ateComDesemprego), '17/5/2027');
assert.equal(r.qualidade.graca.extensao120, false);

// Sem data
r = rodar(v(1, 'EMP A', '01/03/2024'), { tipo: 'parto', data: '' });
assert.equal(r.conclusao.status, 'incompleta');

// Sem nenhum registro anterior
r = rodar(v(1, 'EMP A', '01/03/2027'), { tipo: 'parto', data: '2026-06-10' });
assert.equal(r.qualidade.status, 'nao_demonstrada');

// Prazo de 5 anos
r = rodar(v(1, 'EMP A', '01/03/2010'), { tipo: 'parto', data: '2020-01-10' });
assert.equal(r.fatoGerador.prazoExcedido, true);
r = rodar(v(1, 'EMP A', '01/03/2010'), { tipo: 'aborto', data: '2026-01-10' });
assert.equal(r.fatoGerador.duracaoDias, 14);
assert.equal(r.fatoGerador.prazoExcedido, false);

console.log('direito.test.js: ok');
