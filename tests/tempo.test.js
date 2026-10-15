// Testes da aposentadoria por tempo de contribuição. Rodar: node tests/tempo.test.js (dados fictícios)
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
require('../assets/direito.js');
require('../assets/idade.js');
const T = require('../assets/tempo.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 15 };
const pad = (n) => String(n).padStart(2, '0');
function vinculo(ini, ate, fim, valor, n) {
  const meses = []; let y = ini[0], m = ini[1];
  while (y < ate[0] || (y === ate[0] && m <= ate[1])) { meses.push(`${pad(m)}/${y} ${valor || '3.000,00'}`); if (++m > 12) { m = 1; y++; } }
  const linhas = []; for (let i = 0; i < meses.length; i += 3) linhas.push(meses.slice(i, i + 3).join(' '));
  return [`${n || 1} ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/${pad(ini[1])}/${ini[0]}${fim ? ' ' + fim : ''}`, 'Remunerações', ...linhas].join('\n');
}
const ap = (txt, ent) => T.aposentadoriaTempo(C.analisar(txt, HOJE), ent, HOJE);

// Tabelas
assert.equal(T.pontosExigidos('F', 2019), 86); assert.equal(T.pontosExigidos('F', 2026), 93); assert.equal(T.pontosExigidos('F', 2040), 100);
assert.equal(T.pontosExigidos('M', 2019), 96); assert.equal(T.pontosExigidos('M', 2030), 105);
assert.equal(T.idadeProgressivaMeses('F', 2026), 59 * 12 + 6); assert.equal(T.idadeProgressivaMeses('M', 2030), 65 * 12);

// Mulher, 33 anos de contribuição (1992-2025) e 60 anos em 2026: pontos e idade cumpridas
let r = ap(vinculo([1992, 1], [2025, 12], '31/12/2025'), { sexo: 'F', nascimento: '1966-03-10', der: '2026-02-02' });
const pontos = r.avaliacoes.find((a) => a.regra.id === 'pontos');
assert.equal(pontos.ok, true);
assert.equal(r.avaliacoes.find((a) => a.regra.id === 'idade').ok, true);
assert.equal(r.conclusao.status, 'provavel');

// Homem com 20 anos de tempo e 50 anos: nada cumprido, com data prevista
r = ap(vinculo([2005, 1], [2025, 12], '31/12/2025'), { sexo: 'M', nascimento: '1976-01-01', der: '2026-02-02' });
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.ok(r.avaliacoes.some((a) => a.quando));

// Filiado depois da EC: não se aplica
r = ap(vinculo([2021, 1], [2025, 12], '31/12/2025'), { sexo: 'F', nascimento: '1970-01-01', der: '2026-02-02' });
assert.match(r.conclusao.rotulo, /não se aplicam/i);

// Enquadramento especial 25 anos converte só até a EC
const txt = vinculo([1995, 1], [2019, 10], '31/10/2019');
const base = ap(txt, { sexo: 'M', nascimento: '1970-01-01', der: '2019-11-13' });
const com = ap(txt, { sexo: 'M', nascimento: '1970-01-01', der: '2019-11-13', enquadramento: [{ seq: 1, inicio: C.dataDe('01/01/1995'), fim: C.dataDe('31/10/2019'), natureza: 'esp25' }] });
assert.ok(com.tempo.convEC > base.tempo.convEC * 1.35, 'conversão 1,40');
assert.equal(com.tempo.brutoEC, base.tempo.brutoEC);
// Desconsiderar período
const sem = ap(txt, { sexo: 'M', nascimento: '1970-01-01', der: '2019-11-13', enquadramento: [{ seq: 1, inicio: C.dataDe('01/01/2000'), fim: C.dataDe('31/12/2009'), natureza: 'desconsiderar' }] });
assert.ok(sem.tempo.brutoEC < base.tempo.brutoEC - 3000);
// Período fora do CNIS
const fora = ap('', { sexo: 'M', nascimento: '1970-01-01', der: '2026-01-02', enquadramento: [{ seq: 0, inicio: C.dataDe('01/01/2000'), fim: C.dataDe('31/12/2009'), natureza: 'indenizado' }] });
assert.ok(fora.tempo.brutoDer >= 3650);
// Serialização
const salvo = T.carregar(T.serializar(com.entrada.enquadramento));
assert.equal(salvo[0].natureza, 'esp25');
// Pedágio de 50%: 33 anos em 13/11/2019 (mulher falta ... ), sem erro
r = ap(vinculo([1990, 1], [2019, 10], '31/10/2019'), { sexo: 'F', nascimento: '1965-05-05', der: '2022-01-10' });
assert.ok(r.avaliacoes.find((a) => a.regra.id === 'pedagio50'));
// Segurado especial: até 31/10/1991 conta sem recolhimento; de 11/1991 em diante só se indenizar
const rural = `1 ${NIT} Segurado Especial 01/01/1985 31/12/1995\n` + vinculo([1996, 1], [2010, 12], '31/12/2010', null, 2);
let semInd = ap(rural, { sexo: 'M', nascimento: '1965-01-01', der: '2026-01-02' });
let com2 = ap(rural, { sexo: 'M', nascimento: '1965-01-01', der: '2026-01-02', indenizaEspecial: true });
const dias = (r) => r.tempo.brutoDer;
assert.ok(semInd.perguntas.some((q) => q.id === 'indenizaEspecial' && q.resposta === null));
// 01/01/1985 a 31/10/1991 = 6 anos e 10 meses (aprox. 2495 dias) + 15 anos urbanos
assert.ok(dias(semInd) > 2400 + 5400 && dias(semInd) < 2600 + 5500, 'sem indenização: ' + dias(semInd));
// com indenização: + 01/11/1991 a 31/12/1995 (~1522 dias)
assert.ok(dias(com2) - dias(semInd) > 1500 && dias(com2) - dias(semInd) < 1540, 'diferença: ' + (dias(com2) - dias(semInd)));
assert.equal(com2.perguntas.find((q) => q.id === 'indenizaEspecial').resposta, true);
// sem segurado especial a partir de 11/1991, a pergunta não aparece
assert.ok(!ap(vinculo([2000, 1], [2010, 12], '31/12/2010'), { sexo: 'M', nascimento: '1965-01-01', der: '2026-01-02' }).perguntas.some((q) => q.id === 'indenizaEspecial'));
// Contribuinte individual: competência sem recolhimento (lacuna) não conta como tempo
const ciTxt = `1 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/1990 31/12/1993
Indicadores:
Contribuições
Compet. Data Pgto. Contribuição Salário Contrib. Indicadores Compet. Data Pgto. Contribuição Salário Contrib. Indicadores
01/1990 200,00 1.000,00 02/1990 200,00 1.000,00`;
assert.equal(ap(ciTxt, { sexo: 'M', nascimento: '1965-01-01', der: '2026-01-02' }).tempo.brutoDer, 59);
console.log('tempo.test.js: ok');
