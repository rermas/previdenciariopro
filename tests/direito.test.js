// Testes do módulo "Verificar direito" (salário-maternidade). Rodar: node tests/direito.test.js
// Dados fictícios. Datas de vencimento calculadas à mão (dia 15 do mês seguinte; fim de semana passa à segunda).
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
const D = require('../assets/direito.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 8 };
const v = (s, n, i, f) => `${s} ${NIT} 11.111.111/0001-11 ${n} Empregado ${i}${f ? ' ' + f : ''}`;
const rodar = (txt, ent) => D.salarioMaternidade(C.analisar(txt, HOJE), ent, HOJE);
const texto = (...l) => l.join('\n');
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
assert.equal(r.conclusao.status, 'prescrito');
assert.equal(r.conclusao.pendencias.length, 0);
r = rodar(v(1, 'EMP A', '01/03/2010'), { tipo: 'aborto', data: '2026-01-10' });
assert.equal(r.fatoGerador.duracaoDias, 14);
assert.equal(r.fatoGerador.prazoExcedido, false);

// Parto sem qualidade na data, mas com qualidade 28 dias antes (DAT): vínculo encerrado em 31/03/2025, graça até 15/05/2026
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2026-06-05' });
assert.equal(r.qualidade.status, 'provavel');
assert.equal(dia(r.qualidade.antecipada), '8/5/2026');
assert.equal(dia(r.fatoGerador.inicioBeneficio), '8/5/2026');
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2026-06-20' });
assert.notEqual(r.qualidade.status, 'provavel');
assert.equal(r.qualidade.antecipada, undefined);
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'aborto', data: '2026-06-05' });
assert.equal(r.qualidade.antecipada, undefined, 'a antecipação vale só para parto');

// Facultativa (6 meses) vencida: usa a graça do vínculo de empregada anterior
const fac = texto(
  v(1, 'EMP A', '01/01/2020', '31/12/2023'),
  `2 ${NIT} RECOLHIMENTO Facultativo 01/01/2024 31/03/2024`, 'Contribuições',
  '01/2024 20/02/2024 55,00 1.100,00 02/2024 20/03/2024 55,00 1.100,00', '03/2024 20/04/2024 55,00 1.100,00'
);
r = rodar(fac, { tipo: 'parto', data: '2024-12-10' });
assert.equal(r.qualidade.status, 'confirmada');
assert.equal(r.qualidade.graca.categoria, 'Empregada');
assert.match(r.qualidade.linhas.join(' '), /Como facultativa, o prazo de 6 meses terminou em 15\/11\/2024/);
// Antes do fim dos 6 meses continua facultativa
r = rodar(fac, { tipo: 'parto', data: '2024-08-10' });
assert.equal(r.qualidade.graca.categoria, 'Segurada facultativa');
assert.equal(r.qualidade.status, 'confirmada');

// O último vínculo de empregado, em aberto, é tratado como ativo mesmo sem recolhimento recente
const aberto = texto(v(1, 'EMP A', '01/01/2015'), 'Remunerações', '01/2015 1.000,00 02/2015 1.000,00 03/2015 1.000,00');
r = rodar(aberto, { tipo: 'parto', data: '2018-07-01' });
assert.equal(r.categoria.ativos.length, 1);
assert.equal(r.categoria.ativos[0].aviso, null);
assert.equal(r.cnis.filter((x) => /sem data de fim/.test(x.achado)).length, 0, 'vínculo aberto, último de empregado: sem registro de "sem data de fim"');
assert.equal(r.qualidade.graca, null);
// Vínculo antigo em aberto que não é o último: continua tratado como encerrado na última remuneração
const doisAbertos = texto(v(1, 'EMP A', '01/01/2015'), 'Remunerações', '01/2015 1.000,00 02/2015 1.000,00 03/2015 1.000,00',
  v(2, 'EMP B', '01/06/2016', '30/06/2016'), 'Remunerações', '06/2016 1.000,00');
r = rodar(doisAbertos, { tipo: 'parto', data: '2018-07-01' });
assert.equal(r.categoria.ativos.length, 0);
assert.equal(r.qualidade.graca.competenciaCessacao, '06/2016');
assert.match(r.qualidade.linhas.join(' '), /tratados como encerrados na última remuneração/);
// Recente (menos de 3 meses sem movimento): continua ativo, com aviso
r = rodar(aberto, { tipo: 'parto', data: '2015-05-10' });
assert.equal(r.categoria.ativos.length, 1);

// Carência: contribuinte individual antes de 05/04/2024 exige 10; empregada nunca; depois da data, dispensada
const ci = (n) => texto(`4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2022 28/${String(n).padStart(2, '0')}/2022`, 'Contribuições',
  ...Array.from({ length: n }, (_, i) => `${String(i + 1).padStart(2, '0')}/2022 10/${String(i + 1).padStart(2, '0')}/2022 220,00 2.000,00`));
r = rodar(ci(6), { tipo: 'parto', data: '2022-08-10' });
assert.equal(r.qualidade.status, 'confirmada');
assert.equal(r.carencia.status, 'nao_cumprida');
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.match(r.conclusao.rotulo, /carência/);
r = rodar(ci(12), { tipo: 'parto', data: '2023-01-10' });
assert.equal(r.carencia.status, 'cumprida');
r = rodar(ci(6), { tipo: 'parto', data: '2024-06-10' });
assert.notEqual(r.carencia.status, 'nao_cumprida');
r = rodar(v(1, 'EMP A', '01/03/2020'), { tipo: 'parto', data: '2021-06-10' });
assert.equal(r.carencia.status, 'dispensada');

// Categoria na data: desempregada (vínculo com fim ou encerrado por presunção) e última contribuição de CI/facultativa
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2025-09-10' });
assert.equal(r.categoria.usada, 'desempregada');
r = rodar(doisAbertos, { tipo: 'parto', data: '2016-12-01' });
assert.equal(r.categoria.usada, 'desempregada', 'vínculo antigo sem fim, encerrado na última remuneração, mais de 2 meses antes');
r = rodar(fac, { tipo: 'parto', data: '2024-08-10' });
assert.equal(r.categoria.usada, 'facultativa');
r = rodar(v(1, 'EMP A', '01/03/2024', '31/03/2025'), { tipo: 'parto', data: '2025-09-10', categoria: 'empregada' });
assert.equal(r.categoria.usada, 'empregada', 'categoria informada prevalece');

// Seguro-desemprego/SINE soma 12 meses ao último vínculo de empregado, mesmo com CI depois
const rex = texto(
  v(1, 'EMPRESA REX', '17/10/2018', '15/01/2019'), 'Remunerações',
  '10/2018 1.200,00 11/2018 1.200,00 12/2018 1.200,00', '01/2019 600,00',
  `2 ${NIT} RECOLHIMENTO Contribuinte Individual 01/10/2020 30/11/2020`, 'Contribuições',
  '10/2020 10/11/2020 220,00 2.000,00 11/2020 10/12/2020 220,00 2.000,00'
);
r = D.salarioMaternidade(C.analisar(rex, { y: 2021, m: 6, d: 1 }), { tipo: 'parto', data: '2021-02-01' }, { y: 2021, m: 6, d: 1 });
assert.equal(r.carencia.status, 'nao_cumprida', 'sem seguro-desemprego: houve perda e só 2 contribuições no retorno');
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.match(r.qualidade.linhas.join(' '), /Com seguro-desemprego\/SINE, a qualidade desse vínculo iria até 15\/03\/2021/);
r = D.salarioMaternidade(C.analisar(rex, { y: 2021, m: 6, d: 1 }), { tipo: 'parto', data: '2021-02-01', desemprego: true }, { y: 2021, m: 6, d: 1 });
assert.doesNotMatch(r.qualidade.linhas.join(' '), /Interrupções.*01\/2019/, 'o seguro-desemprego evita a perda entre o vínculo e o CI');
// Como CI não há carência (6 de 10), mas o vínculo de empregado ainda mantém a qualidade: concede como desempregada
assert.equal(r.categoria.usada, 'desempregada');
assert.equal(r.carencia.status, 'dispensada');
assert.equal(r.concessaoDesemprego.categoriaAnterior, 'ci');
assert.notEqual(r.conclusao.status, 'nao_demonstrado');
assert.match(r.conclusao.texto, /Observação: concedido pela qualidade de desempregada/);
assert.match(r.qualidade.linhas.join(' '), /Concedido pelo desemprego.*15\/03\/2021/);
// Vínculo de empregado já vencido: continua sem direito, como CI
r = D.salarioMaternidade(C.analisar(rex, { y: 2022, m: 6, d: 1 }), { tipo: 'parto', data: '2021-06-01', desemprego: true }, { y: 2022, m: 6, d: 1 });
assert.equal(r.categoria.usada, 'ci');
assert.equal(r.carencia.status, 'nao_cumprida');
assert.equal(r.concessaoDesemprego, undefined);


// Sem qualidade de segurado: carência mostra só as regras possíveis do salário-maternidade
{
  const Cn = require('../assets/cnis.js');
  const txt = ['1 1.234.567.890-1 11.111.111/0001-11 EMPRESA Empregado 01/01/2010 31/12/2010', 'Remunerações', '01/2010 600,00 02/2010 600,00 03/2010 600,00'].join('\n');
  const rr = require('../assets/direito.js').salarioMaternidade(Cn.analisar(txt, { y: 2026, m: 10, d: 8 }), { tipo: 'parto', data: '2023-05-10' }, { y: 2026, m: 10, d: 8 });
  assert.equal(rr.carencia.semQualidade, true);
  assert.match(rr.carencia.linhas.join(' '), /10 contribuições/);
  assert.match(rr.carencia.linhas.join(' '), /metade/);
}

// Fato gerador durante vínculo de empregada: observação sobre MEI x pagamento pela empresa
{
  const txt = ['1 1.234.567.890-1 11.111.111/0001-11 EMPRESA Empregado 01/01/2024 31/12/2024', 'Remunerações', '01/2024 1.500,00 02/2024 1.500,00 03/2024 1.500,00'].join('\n');
  const rr = rodar(txt, { tipo: 'parto', data: '2024-02-10' });
  assert.match(rr.fatoGerador.notas.join(' '), /MEI/);
  assert.match(rr.fatoGerador.notas.join(' '), /pago diretamente pela empresa/);
  const rc = rodar(txt, { tipo: 'parto', data: '2025-03-10' });
  assert.doesNotMatch(rc.fatoGerador.notas.join(' '), /pago diretamente pela empresa/, 'fora do vínculo não se aplica');
}
console.log('direito.test.js: ok');

// ---- Perguntas de complementação / vínculo comprovado (carência) ----
{
  const ci = (comp, val) => `${1} ${NIT} 22.222.222/0001-22 Contribuinte Individual 01/01/2020`; // placeholder não usado
  // CI com 8 competências no mínimo e 4 abaixo do mínimo (2022), parto em 2022-12: carência 10 exige complementar
  const idx = [];
  const analise = C.analisar(texto(
    '1 ' + NIT + ' 33.333.333/0001-33 EMP Z Empregado 01/01/2015 31/12/2015',
    '2 ' + NIT + ' CI Contribuinte Individual 01/01/2022'
  ), HOJE);
  const compl = D.complementosEm(analise, C.mesDe(2022, 12));
  assert.ok(Array.isArray(compl.empBaixo) && Array.isArray(compl.ciBaixo) && Array.isArray(compl.empSem));
  const p = D.perguntasCarencia({ empBaixo: [1, 2], empSem: [], ciBaixo: [] }, {}, true, 8, 10);
  assert.equal(p.length, 1);
  assert.equal(p[0].id, 'compEmp');
  const p2 = D.perguntasCarencia({ empBaixo: [1], empSem: [], ciBaixo: [] }, {}, true, 5, 10);
  assert.equal(p2.length, 0);
  const p3 = D.perguntasCarencia({ empBaixo: [1, 2], empSem: [3], ciBaixo: [4] }, { compEmp: true, vincComprovado: false }, true, 7, 10);
  assert.ok(p3.some((x) => x.id === 'compEmp' && x.resposta === true));
  assert.equal(D.contarComplementos({ empBaixo: [1, 2], empSem: [3], ciBaixo: [4, 5] }, { compEmp: true, vincComprovado: true, compCI: false }), 3);
  assert.equal(D.contarComplementos({ empBaixo: [1, 2], empSem: [3], ciBaixo: [4, 5] }, { compEmp: true, compCI: true }, 3), 2);
}
console.log('perguntas ok');

// Integração: CI com 6 meses no mínimo e 4 abaixo; parto em 11/2022 exige 10
{
  const ciTxt = texto(`4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2022 31/10/2022`, 'Contribuições',
    '01/2022 15/02/2022 133,32 1.212,00 02/2022 15/03/2022 133,32 1.212,00 03/2022 15/04/2022 133,32 1.212,00',
    '04/2022 15/05/2022 133,32 1.212,00 05/2022 15/06/2022 133,32 1.212,00 06/2022 15/07/2022 133,32 1.212,00',
    '07/2022 15/08/2022 50,00 500,00 08/2022 15/09/2022 50,00 500,00 09/2022 15/10/2022 50,00 500,00 10/2022 15/11/2022 50,00 500,00');
  const base = { tipo: 'parto', data: '2022-11-10' };
  let a = rodar(ciTxt, base);
  assert.equal(a.carencia.status, 'nao_cumprida');
  assert.equal(a.carencia.perguntas.length, 1);
  assert.equal(a.carencia.perguntas[0].id, 'compCI');
  a = rodar(ciTxt, Object.assign({ compCI: true }, base));
  assert.equal(a.carencia.status, 'cumprida');
  assert.equal(a.carencia.rotulo, 'Cumprida, com as premissas informadas');
  a = rodar(ciTxt, Object.assign({ compCI: false }, base));
  assert.equal(a.carencia.status, 'nao_cumprida');
  assert.equal(a.carencia.perguntas[0].resposta, false);
}
console.log('integração perguntas ok');
