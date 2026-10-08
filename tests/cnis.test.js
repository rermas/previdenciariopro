// Testes da lógica de análise. Rodar com: node tests/cnis.test.js
// Todos os dados são fictícios. Os valores esperados foram calculados à mão.
const assert = require('node:assert/strict');
const CNIS = require('../assets/cnis.js');

const HOJE = { y: 2020, m: 8, d: 31 };
const texto = (...l) => l.join('\n');

// ---------- Utilidades ----------
assert.equal(CNIS.valorDe('1.234,56'), 1234.56);
assert.equal(CNIS.valorDe('0,00'), 0);
assert.equal(CNIS.dataDe('31/02/2010'), null, 'data inexistente');
assert.equal(CNIS.dataDe('29/02/2000').d, 29, '2000 foi bissexto');
assert.equal(CNIS.dataDe('29/02/1900'), null, '1900 não foi bissexto');
assert.equal(CNIS.formatarDuracao(1232), '3 anos, 4 meses e 17 dias');
assert.equal(CNIS.formatarDuracao(365), '1 ano, 0 meses e 5 dias'.replace('5 dias', '0 dias'));
assert.equal(CNIS.rotuloMes(CNIS.mesDe(2010, 5)), '05/2010');
assert.deepEqual(
  CNIS.agrupar([CNIS.mesDe(2010, 1), CNIS.mesDe(2010, 2), CNIS.mesDe(2010, 4)]),
  [{ de: '01/2010', ate: '02/2010', qtd: 2 }, { de: '04/2010', ate: '04/2010', qtd: 1 }]
);

// ---------- Leitura de remunerações ----------
const lido = CNIS.interpretar(texto(
  '1 EMPRESA Y Empregado 01/03/2010 31/12/2010',
  '03/2010 12345,67',
  '04/2010 10/05/2010 1.234,56 PREC-MENOR-MIN',
  '05/2010'
));
assert.equal(lido.vinculos.length, 1);
const rem = lido.vinculos[0].remuneracoes;
assert.equal(rem[0].valor, 12345.67, 'valor sem separador de milhar');
assert.equal(rem[1].valor, 1234.56, 'data no meio da linha não atrapalha o valor');
assert.deepEqual(rem[1].indicadores, ['PREC-MENOR-MIN']);
assert.equal(rem[2].valor, null, 'competência sem valor');

// ---------- Extrato de exemplo completo ----------
const r = CNIS.analisar(CNIS.EXEMPLO, HOJE);
const v = r.vinculos;

assert.equal(v.length, 5, 'cinco vínculos (a data de nascimento do cabeçalho é ignorada)');
assert.match(v[0].rotulo, /MERCADO EXEMPLO LTDA/);

assert.equal(v[0].dias, 275, 'abr a dez/1994');
assert.equal(v[0].comRemuneracao, 6);
assert.equal(v[0].anteriores94, 3, 'abr, mai e jun/1994 ficam fora da conta');
assert.equal(v[0].faltantes, 0);

assert.equal(v[1].dias, 546, '02/01/2000 a 30/06/2001, com ano bissexto');
assert.equal(v[1].comRemuneracao, 17, 'a competência com 0,00 não conta');
assert.equal(v[1].faltantes, 1);
assert.equal(v[1].zeradas, 1);
assert.deepEqual(v[1].faixasFaltantes, [{ de: '03/2000', ate: '03/2000', qtd: 1 }]);

assert.equal(v[2].dias, 306);
assert.equal(v[2].faltantes, 1, 'falta 05/2010');
assert.deepEqual(v[2].faixasFaltantes, [{ de: '05/2010', ate: '05/2010', qtd: 1 }]);

assert.equal(v[3].dias, 92);
assert.equal(v[3].faltantes, 0);

assert.equal(v[4].dias, 105, 'fev a 15/mai/2020, com ano bissexto');
assert.equal(v[4].faltantes, 1, 'falta 05/2020');

const s = r.resumo;
assert.equal(s.diasUnicos, 1232, '275 + 546 + 306 + 105; o vínculo 4 está dentro do 3');
assert.equal(s.diasBrutos, 1324, 'a soma bruta repete os 92 dias concomitantes');
assert.equal(s.duracao, '3 anos, 4 meses e 17 dias');
assert.equal(s.competencias, 35, '6 + 17 + 9 + 3, sem repetir as competências concomitantes');
assert.equal(s.mesesSemRemuneracao, 3);
assert.equal(s.mesesAnteriores94, 3);
assert.equal(s.erros, 0);
assert.equal(s.atencoes, 3, 'PREM-EXT, PREC-MENOR-MIN e PEXT');
assert.equal(s.infos, 1, 'concomitância');

const msgs = r.pendencias.map(p => p.msg).join(' | ');
assert.match(msgs, /PREM-EXT: remuneração informada fora do prazo em 1 competência\(s\): 06\/2000/);
assert.match(msgs, /PREC-MENOR-MIN: contribuição abaixo do salário mínimo em 1 competência\(s\): 06\/2010/);
assert.match(msgs, /PEXT: vínculo extemporâneo/);
assert.match(msgs, /concomitante com "COMERCIAL BETA S\.A\. Empregado" \(92 dias em comum\)/);

assert.equal(r.beneficios.length, 2);
assert.equal(r.beneficios[0].nb, '123.456.789-0');
assert.equal(r.beneficios[0].indeferido, false);
assert.equal(r.beneficios[1].indeferido, true, 'benefício sem datas');

assert.equal(r.mapa[CNIS.mesDe(1994, 5)], 'pre94');
assert.equal(r.mapa[CNIS.mesDe(1994, 7)], 'ok');
assert.equal(r.mapa[CNIS.mesDe(2000, 3)], 'falta');
assert.equal(r.mapa[CNIS.mesDe(2010, 5)], 'falta');
assert.equal(r.mapa[CNIS.mesDe(2010, 11)], 'ok');
assert.equal(r.mapa[CNIS.mesDe(2020, 5)], 'falta');

assert.match(CNIS.resumoEmTexto(r), /Tempo contado: 3 anos, 4 meses e 17 dias/);

// ---------- Mês coberto por dois vínculos, com remuneração em só um deles ----------
const parcial = CNIS.analisar(texto(
  '1 A Empregado 01/01/2015 31/03/2015', '01/2015 1.000,00', '03/2015 1.000,00',
  '2 B Empregado 01/02/2015 28/02/2015', '02/2015 900,00'
), HOJE);
assert.equal(parcial.vinculos[0].faltantes, 1);
assert.equal(parcial.mapa[CNIS.mesDe(2015, 2)], 'parcial', 'B tem remuneração em fevereiro, A não');
assert.equal(parcial.mapa[CNIS.mesDe(2015, 1)], 'ok');
const parcial2 = CNIS.analisar(texto(
  '1 A Empregado 01/01/2015 31/03/2015', '01/2015 1.000,00', '02/2015 1.000,00', '03/2015 1.000,00',
  '2 B Empregado 01/02/2015 28/02/2015', '03/2015 900,00'
), HOJE);
assert.equal(parcial2.mapa[CNIS.mesDe(2015, 2)], 'parcial', 'A tem remuneração em fevereiro, B não');
assert.equal(parcial2.mapa[CNIS.mesDe(2015, 3)], 'ok', 'março: A tem e B está fora do período');

// ---------- Vínculo em aberto ----------
const aberto = CNIS.analisar(texto('1 X Empregado 01/06/2011', '06/2011 2.000,00', '07/2011 2.000,00'), { y: 2011, m: 12, d: 31 });
assert.equal(aberto.vinculos[0].emAberto, true);
assert.equal(aberto.vinculos[0].dias, 214, '01/06 a 31/12/2011');
assert.equal(aberto.vinculos[0].faltantes, 0, 'meses depois da última remuneração não são faltantes');
const am = aberto.pendencias.map(p => p.msg).join(' | ');
assert.match(am, /sem data de fim/);
assert.match(am, /última remuneração em 07\/2011/);

// ---------- Competência repetida ----------
const rep = CNIS.analisar(texto('1 X Empregado 01/03/2010 30/04/2010', '03/2010 100,00', '03/2010 100,00', '04/2010 100,00'), HOJE);
assert.match(rep.pendencias.map(p => p.msg).join(' | '), /Competência repetida: 03\/2010/);

// ---------- Erros de dado ----------
const ruim = CNIS.analisar('9 EMPRESA X Empregado 31/02/2010 01/01/2011', HOJE);
assert.equal(ruim.resumo.erros, 1);
assert.equal(ruim.resumo.validos, 0);
const invertido = CNIS.analisar('9 EMPRESA X Empregado 01/06/2010 01/01/2010', HOJE);
assert.match(invertido.pendencias[0].msg, /Data de fim anterior/);

// ---------- Texto sem remunerações: não inventa salários faltantes ----------
const sem = CNIS.analisar('1 EMPRESA Z Empregado 01/03/2015 31/12/2015', HOJE);
assert.equal(sem.faltantes.length, 0);
assert.match(sem.pendencias.map(p => p.msg).join(' | '), /Nenhuma remuneração foi reconhecida/);

// ---------- Texto vazio ----------
const vazio = CNIS.analisar('', HOJE);
assert.equal(vazio.resumo.totalVinculos, 0);
assert.equal(vazio.resumo.diasUnicos, 0);

console.log('Todos os testes passaram.');
