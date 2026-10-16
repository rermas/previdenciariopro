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

// Competência paga no vencimento, mesmo depois da DER, conta; paga em atraso depois da DER não conta
(function () {
  const mk = (pag) => [`4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/07/2026`, 'Contribuições',
    '07/2026 15/08/2026 400,00 2.000,00 08/2026 15/09/2026 400,00 2.000,00', `09/2026 ${pag} 400,00 2.000,00`].join('\n');
  const dias = (pag) => T.aposentadoriaTempo(C.analisar(mk(pag), HOJE), { sexo: 'M', nascimento: '1966-10-01', der: '2026-10-01' }, HOJE).tempo.brutoDer;
  assert.equal(dias('14/10/2026') - dias('20/10/2026'), 30, 'setembro conta se pago até o vencimento');
})();
console.log('pago no vencimento depois da DER ok');

// Quem já tinha o tempo mínimo em 13/11/2019 cumpre o requisito "faltavam até 2 anos" (nada faltava, pedágio zero)
(function () {
  const r2 = ap(vinculo([1985, 1], [2025, 12], '31/12/2025'), { sexo: 'M', nascimento: '1966-10-01', der: '2026-10-01' });
  const p50 = r2.avaliacoes.find((a) => a.regra.id === 'pedagio50');
  assert.equal(p50.reqs[0].ok, true);
  assert.equal(p50.ok, true);
})();
console.log('pedágio 50% com tempo já cumprido ok');

// Regras do enquadramento por tipo de vínculo
(function () {
  const N = '1.111.111.111-1';
  const txt = [
    `1 ${N} 11.111.111/0001-11 FÁBRICA Empregado 01/01/1980 31/12/1990`,
    'Remunerações',
    `2 ${N} RECOLHIMENTO Contribuinte Individual 01/01/1990 31/12/1999`,
    `3 ${N} RECOLHIMENTO Facultativo 01/01/2000 31/12/2005`,
    `4 ${N} Segurado Especial 01/01/1970 31/12/1979`,
    `5 ${N} 22.222.222/0001-22 FAZENDA SANTA FÉ Empregado 01/01/1988 31/12/1995`
  ].join('\n');
  const a = C.analisar(txt, HOJE);
  const v = (s) => a.vinculos.find((x) => x.seq === s);
  assert.equal(T.regraEnq(v(1)).max, null);
  assert.equal(T.regraEnq(v(2)).max, C.ordemDe(1995, 4, 28), 'CI só até 28/04/1995');
  assert.equal(T.regraEnq(v(3)), null, 'facultativo não admite');
  assert.equal(T.regraEnq(v(4)), null, 'segurado especial não admite');
  assert.equal(T.regraEnq(v(5)).min, C.ordemDe(1991, 11, 1), 'empregado rural só a partir de 11/1991');
  // o contar() também limita
  const base = { sexo: 'M', nascimento: '1960-01-01', der: '2026-10-01' };
  const r0 = T.aposentadoriaTempo(a, base, HOJE);
  const r1 = T.aposentadoriaTempo(a, Object.assign({}, base, { enquadramento: [
    { seq: 2, inicio: C.dataDe('01/01/1990'), fim: C.dataDe('31/12/1999'), natureza: 'esp25' },
    { seq: 3, inicio: C.dataDe('01/01/2000'), fim: C.dataDe('31/12/2005'), natureza: 'esp25' }
  ] }), HOJE);
  assert.ok(r1.tempo.linhas.join(' ').length > 0);
  assert.match(r1.avisos.join(' | '), /Seq\. 3: este tipo de vínculo não admite enquadramento/);
  assert.match(r1.avisos.join(' | '), /Seq\. 2: enquadramento ajustado a 01\/01\/1990 a 28\/04\/1995/);
  assert.ok(r1.tempo.brutoDer === r0.tempo.brutoDer, 'enquadramento não muda o tempo bruto');
})();
console.log('regras do enquadramento ok');

// Vínculos incluídos manualmente: contam como vínculos do extrato, sem tempo em dobro nas sobreposições
(function () {
  const D = require('../assets/direito.js');
  const base = C.analisar(vinculo([2000, 1], [2010, 12], '31/12/2010'), HOJE);
  const ent = { sexo: 'M', nascimento: '1970-01-01', der: '2026-10-01' };
  const sem = T.aposentadoriaTempo(base, ent, HOJE).tempo.brutoDer;
  const mk = (tipo, i, f) => ({ nome: 'Teste', tipo, inicio: C.dataDe(i), fim: C.dataDe(f) });
  // CTC de 1995 a 2002 sobrepõe 2000-2002 do extrato: só 1995-1999 (1826 dias) entra a mais
  const comCtc = T.aposentadoriaTempo(D.comExtras(base, [mk('ctc', '01/01/1995', '31/12/2002')]), ent, HOJE).tempo.brutoDer;
  assert.equal(comCtc - sem, 1826, 'sobreposição não soma em dobro');
  // mesmo período repetido duas vezes não duplica
  const dobro = T.aposentadoriaTempo(D.comExtras(base, [mk('ctc', '01/01/1995', '31/12/2002'), mk('emp', '01/01/1995', '31/12/2002')]), ent, HOJE).tempo.brutoDer;
  assert.equal(dobro, comCtc);
  // contribuinte individual: recolhido em todo o período (sem tempo antes de 04/1991: o limite do enquadramento é outro assunto)
  const comCi = T.aposentadoriaTempo(D.comExtras(base, [mk('ci', '01/01/1998', '31/12/1999')]), ent, HOJE).tempo.brutoDer;
  assert.equal(comCi - sem, 730);
  // segurado especial até 31/10/1991 conta como tempo
  const comSe = T.aposentadoriaTempo(D.comExtras(base, [mk('esp', '01/01/1985', '31/12/1989')]), ent, HOJE).tempo.brutoDer;
  assert.equal(comSe - sem, 1826);
  // a análise original não é alterada
  assert.equal(base.vinculos.length, 1);
})();
console.log('vínculos incluídos manualmente ok');

// ===== Aposentadoria especial (IN 128, arts. 260 a 262) =====
(function () {
  const D = C.dataDe;
  const esp = (txt, ent, enq) => T.aposentadoriaEspecial(C.analisar(txt, HOJE), Object.assign({ enquadramento: enq || [] }, ent), HOJE);
  const bl = (r, n) => r.blocos.find((b) => b.esp.n === n);
  const regra = (b, id) => b.regras.find((a) => a.regra.id === id);
  // Sem enquadramento: nada a avaliar
  let r = esp(vinculo([1995, 1], [2019, 10], '31/10/2019'), { nascimento: '1970-01-01', der: '2026-02-02' });
  assert.equal(r.blocos.length, 0); assert.equal(r.conclusao.status, 'nao_demonstrado');
  // Direito adquirido: 25 anos especiais completos até 13/11/2019 (01/1995 a 10/2019 = 24a10m) não completam; 01/1994 sim
  let txt = vinculo([1994, 1], [2019, 10], '31/10/2019');
  const enq = [{ seq: 0, inicio: D('01/01/1994'), fim: D('31/10/2019'), natureza: 'esp25' }];
  r = esp(txt, { nascimento: '1975-01-01', der: '2026-02-02' }, enq);
  assert.equal(regra(bl(r, 25), 'adquirido').ok, true);
  assert.equal(r.conclusao.status, 'provavel');
  // Pontos: nascido em 1975, 51 anos na DER + 25,8 anos de exposição, mas só 25 anos até 2019 e depois sem atividade: tempo 25a10m = 25,8; pontos 51,1+25,8 = 76,9 < 86
  assert.equal(regra(bl(r, 25), 'pontos').ok, false);
  // Filiado antes da EC: a regra permanente de idade não se aplica
  assert.equal(regra(bl(r, 25), 'idade').aplicavel, false);
  // Filiado depois da EC: só a regra de idade; 55 anos e 15 anos de exposição
  txt = vinculo([2020, 1], [2036, 1], null);
  const enq2 = [{ seq: 0, inicio: D('01/01/2020'), fim: D('31/12/2035'), natureza: 'esp15' }];
  r = esp(txt, { nascimento: '1975-01-01', der: '2036-01-01' }, enq2);
  assert.equal(regra(bl(r, 15), 'idade').aplicavel, true);
  assert.equal(regra(bl(r, 15), 'adquirido').aplicavel, false);
  assert.equal(regra(bl(r, 15), 'pontos').aplicavel, false);
  // Natureza não completa a outra: 10 anos de 25 + 10 de 15 não somam
  r = esp(vinculo([2000, 1], [2019, 10], '31/10/2019'), { nascimento: '1970-01-01', der: '2026-02-02' }, [
    { seq: 0, inicio: D('01/01/2000'), fim: D('31/12/2009'), natureza: 'esp25' },
    { seq: 0, inicio: D('01/01/2010'), fim: D('31/12/2019'), natureza: 'esp15' }]);
  assert.ok(bl(r, 25).tempo < 25 * 365 && bl(r, 15).tempo < 15 * 365);
  assert.equal(r.conclusao.status, 'nao_demonstrado');
  // Não quebra na renderização por texto
  assert.ok(r.valor.linhas.length && r.documentos.length);
})();
console.log('aposentadoria especial ok');
