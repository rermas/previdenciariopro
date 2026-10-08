// Testes da lógica de análise. Rodar com: node tests/cnis.test.js
// Todos os dados são fictícios, no layout do extrato do Portal CNIS. Valores esperados calculados à mão.
const assert = require('node:assert/strict');
const CNIS = require('../assets/cnis.js');

const HOJE = { y: 2026, m: 10, d: 8 };
const texto = (...l) => l.join('\n');
const NIT = '1.234.567.890-1';
const vinc = (seq, nome, ini, fim) => `${seq} ${NIT} 11.111.111/0001-11 ${nome} Empregado ${ini}${fim ? ' ' + fim : ''}`;

// ---------- Utilidades ----------
assert.equal(CNIS.valorDe('1.234,56'), 1234.56);
assert.equal(CNIS.valorDe('0,00'), 0);
assert.equal(CNIS.dataDe('31/02/2010'), null, 'data inexistente');
assert.equal(CNIS.dataDe('29/02/2000').d, 29, '2000 foi bissexto');
assert.equal(CNIS.dataDe('29/02/1900'), null, '1900 não foi bissexto');
assert.equal(CNIS.formatarDuracao(1263), '3 anos, 5 meses e 18 dias');
assert.equal(CNIS.formatarDuracao(365), '1 ano, 0 meses e 0 dias');
assert.equal(CNIS.rotuloMes(CNIS.mesDe(2010, 5)), '05/2010');
assert.deepEqual(
  CNIS.agrupar([CNIS.mesDe(2010, 1), CNIS.mesDe(2010, 2), CNIS.mesDe(2010, 4)]),
  [{ de: '01/2010', ate: '02/2010', qtd: 2 }, { de: '04/2010', ate: '04/2010', qtd: 1 }]
);

// ---------- Junção das linhas do PDF ----------
const it = (s, x, y, w) => ({ str: s, transform: [1, 0, 0, 1, x, y], width: w });
assert.equal(CNIS.textoDaPagina({ items: [
  it('05/2005', 10, 700, 40), it('300,00', 90, 700.8, 30), it('06/2005', 200, 699.5, 40), it('300,00', 280, 700, 30), // mesma linha, alturas levemente diferentes
  it('11/2005', 10, 688, 40), it('354,00', 90, 688, 30), it('', 120, 688, 0),
  it('Indicadores:', 10, 720, 50)
] }), 'Indicadores:\n05/2005 300,00 06/2005 300,00\n11/2005 354,00');
assert.equal(CNIS.textoDaPagina({ items: [it('1.2', 10, 5, 10), it('94,00', 20, 5, 20)] }), '1.294,00', 'pedaços colados sem espaço');

// ---------- Grade de 3 colunas, indicadores por competência, 13º separado ----------
const lido = CNIS.interpretar(texto(
  vinc(1, 'EMPRESA Y', '01/03/2010', '31/12/2010'),
  'Indicadores:',
  'Remunerações',
  'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
  '03/2010 12345,67 04/2010 1.234,56 PREC-MENOR-MIN 05/2010 10,00',
  '06/2010',
  'Remunerações Décimo Terceiro',
  '12/2010 500,00'
));
assert.equal(lido.vinculos.length, 1);
const l0 = lido.vinculos[0];
assert.deepEqual(l0.remuneracoes.map(x => x.valor), [12345.67, 1234.56, 10, null], 'três por linha; competência sem valor');
assert.deepEqual(l0.remuneracoes[1].indicadores, ['PREC-MENOR-MIN'], 'o indicador fica com a competência certa');
assert.deepEqual(l0.remuneracoes[0].indicadores, []);
assert.equal(l0.decimos.length, 1, 'o 13º não entra nas remunerações');
assert.equal(l0.remuneracoes.length, 4);

// Datas completas e carimbos de página não viram competência nem vínculo
const ruido = CNIS.interpretar(texto(
  'Data de Nascimento: 27/08/1983 Nome da Mãe: FULANA',
  vinc(1, 'EMPRESA Y', '01/03/2010', '31/03/2010'),
  '08/10/2026 14:32:05 Página 1 de 14',
  '03/2010 1.000,00'
));
assert.equal(ruido.vinculos.length, 1);
assert.equal(ruido.vinculos[0].remuneracoes.length, 1);

// NIT nos dois formatos e nome em duas linhas
const nomes = CNIS.interpretar(texto(
  '1 123.45678.90-1 12.345.678/0001-90 SEGUNDO TABELIONATO DE NOTAS DE SEEDITORAP0 Empregado 02/05/2005 31/01/2008',
  'CORONEL FABRICIANO',
  'Indicadores: IREM-INDPEND 000309',
  '2 1.294.491.109-2 51.212.60994/02 ESPOLIO DE MARIA Empregado 01/12/2011 02/09/2014',
  'ALMEIDA',
  'INSS'
));
assert.equal(nomes.vinculos.length, 2);
assert.equal(nomes.vinculos[0].nome, 'SEGUNDO TABELIONATO DE NOTAS DE CORONEL FABRICIANO', 'continuação do nome; matrícula descartada');
assert.deepEqual(nomes.vinculos[0].indicadores, ['IREM-INDPEND']);
assert.equal(nomes.vinculos[1].nome, 'ESPOLIO DE MARIA ALMEIDA', 'o cabeçalho "INSS" da página não entra no nome');

// ---------- Extrato de exemplo completo ----------
const r = CNIS.analisar(CNIS.EXEMPLO, HOJE);
const v = r.vinculos;

assert.equal(v.length, 6, 'seis vínculos (benefícios e evento ficam de fora)');
assert.deepEqual(v.map(x => x.seq), [1, 3, 2, 4, 5, 9], 'ordem cronológica pela data de início, não pela sequência do extrato');
assert.equal(v[0].nome, 'MERCADO EXEMPLO LTDA');
assert.equal(v[2].nome, 'SERVIÇOS ALFA LTDA FILIAL SUL', 'nome em duas linhas, sem a matrícula AB1234567');

assert.equal(v[0].dias, 275, 'abr a dez/1994');
assert.equal(v[0].comRemuneracao, 6);
assert.equal(v[0].anteriores94, 3, 'abr, mai e jun/1994 ficam fora da conta');
assert.equal(v[0].faltantes, 0);

assert.equal(v[1].dias, 546, '02/01/2000 a 30/06/2001, com ano bissexto');
assert.equal(v[1].comRemuneracao, 16, '0,00 em 03/2000 não conta; o 06/2000 repetido conta uma vez');
assert.equal(v[1].faltantes, 2);
assert.equal(v[1].zeradas, 1);
assert.deepEqual(v[1].faixasFaltantes, [{ de: '03/2000', ate: '03/2000', qtd: 1 }, { de: '08/2000', ate: '08/2000', qtd: 1 }]);

assert.equal(v[2].dias, 184);
assert.equal(v[2].comRemuneracao, 5);
assert.equal(v[2].decimos, 1);
assert.equal(v[2].faltantes, 1, 'falta 05/2010; o 13º de 08/2010 não cobre nada');
assert.deepEqual(v[2].faixasFaltantes, [{ de: '05/2010', ate: '05/2010', qtd: 1 }]);

assert.equal(v[3].dias, 92);
assert.equal(v[3].faltantes, 0);

assert.equal(v[4].dias, 105, 'fev a 15/mai/2020, com ano bissexto');
assert.equal(v[4].faltantes, 2, 'faltam 04/2020 e 05/2020');
assert.equal(r.faltantes.find(f => f.seq === 5).emBeneficio, 2, 'os dois meses estão dentro do benefício 15/04 a 20/05/2020');

assert.equal(v[5].emAberto, true);
assert.equal(v[5].dias, 92, 'sem data de fim: 01/06 a 31/08/2023, fim do mês da última remuneração');
assert.equal(v[5].faltantes, 0);

assert.deepEqual(r.faltantes.map(f => f.seq), [3, 2, 5], 'faltantes também em ordem cronológica');

const s = r.resumo;
assert.equal(s.diasBrutos, 1294);
assert.equal(s.diasUnicos, 1263, 'desconta os 31 dias de agosto/2010 em comum entre os vínculos 2 e 4');
assert.equal(s.duracao, '3 anos, 5 meses e 18 dias');
assert.equal(s.competencias, 34, '6 + 16 + 7 + 2 + 3, sem repetir agosto/2010');
assert.equal(s.mesesSemRemuneracao, 5);
assert.equal(s.mesesAnteriores94, 3);
assert.equal(s.erros, 0);
assert.equal(s.atencoes, 3, 'PREM-EXT, PREC-MENOR-MIN e PEXT');
assert.equal(s.infos, 4, 'AVRC-DEF, competência repetida, vínculo em aberto e concomitância');

const msgs = r.pendencias.map(p => p.msg).join(' | ');
assert.match(msgs, /PREM-EXT: remuneração informada fora do prazo em 1 competência\(s\): 06\/2000/);
assert.match(msgs, /PREC-MENOR-MIN: contribuição abaixo do salário mínimo em 1 competência\(s\): 06\/2010/);
assert.match(msgs, /PEXT: vínculo extemporâneo/);
assert.match(msgs, /AVRC-DEF: acerto confirmado pelo INSS/);
assert.match(msgs, /Competência com mais de uma remuneração \(valores somados\): 06\/2000/);
assert.match(msgs, /contado até 31\/08\/2023/);
assert.match(msgs, /Período concomitante com Seq\. 4 \(31 dias\)/);
assert.deepEqual(r.pendencias.map(p => p.sev), ['atencao', 'atencao', 'atencao', 'info', 'info', 'info', 'info'], 'atenção antes de nota');
assert.match(r.pendencias[0].ref, /Seq\. 3/, 'dentro do grupo, ordem cronológica');

assert.equal(r.beneficios.length, 2);
assert.equal(r.beneficios[0].nb, '1234567890');
assert.equal(r.beneficios[0].indeferido, false);
assert.equal(r.beneficios[1].indeferido, true, 'benefício sem datas');
assert.equal(r.eventos.length, 1);
assert.match(r.eventos[0].texto, /SEGURO DESEMPREGO/);
assert.equal(r.eventos[0].inicio.m, 11);

assert.equal(r.mapa[CNIS.mesDe(1994, 5)], 'pre94');
assert.equal(r.mapa[CNIS.mesDe(1994, 7)], 'ok');
assert.equal(r.mapa[CNIS.mesDe(2000, 3)], 'falta');
assert.equal(r.mapa[CNIS.mesDe(2010, 5)], 'falta');
assert.equal(r.mapa[CNIS.mesDe(2010, 8)], 'ok', 'agosto/2010 tem remuneração nos dois vínculos');
assert.equal(r.mapa[CNIS.mesDe(2020, 5)], 'falta');

const txt = CNIS.resumoEmTexto(r);
assert.match(txt, /Tempo contado: 3 anos, 5 meses e 18 dias/);
assert.ok(txt.indexOf('Seq. 1 -') < txt.indexOf('Seq. 3 -') && txt.indexOf('Seq. 3 -') < txt.indexOf('Seq. 2 -'), 'resumo em ordem cronológica');

// ---------- Mês coberto por dois vínculos, com remuneração em só um deles ----------
const parcial = CNIS.analisar(texto(
  vinc(1, 'A', '01/01/2015', '31/03/2015'), '01/2015 1.000,00 03/2015 1.000,00',
  vinc(2, 'B', '01/02/2015', '28/02/2015'), '02/2015 900,00'
), HOJE);
assert.equal(parcial.vinculos[0].faltantes, 1);
assert.equal(parcial.faltantes[0].comOutroVinculo, 1, 'fevereiro tem remuneração no vínculo B');
assert.equal(parcial.mapa[CNIS.mesDe(2015, 2)], 'parcial', 'B tem remuneração em fevereiro, A não');
assert.equal(parcial.mapa[CNIS.mesDe(2015, 1)], 'ok');
const parcial2 = CNIS.analisar(texto(
  vinc(1, 'A', '01/01/2015', '31/03/2015'), '01/2015 1.000,00 02/2015 1.000,00 03/2015 1.000,00',
  vinc(2, 'B', '01/02/2015', '28/02/2015'), '03/2015 900,00'
), HOJE);
assert.equal(parcial2.mapa[CNIS.mesDe(2015, 2)], 'parcial', 'A tem remuneração em fevereiro, B não');
assert.equal(parcial2.mapa[CNIS.mesDe(2015, 3)], 'ok', 'março: A tem e B está fora do período');

// ---------- Vínculo em aberto ----------
const aberto = CNIS.analisar(texto(vinc(1, 'X', '01/06/2011'), '06/2011 2.000,00 07/2011 2.000,00'), { y: 2011, m: 12, d: 31 });
assert.equal(aberto.vinculos[0].emAberto, true);
assert.equal(aberto.vinculos[0].dias, 61, '01/06 a 31/07/2011: fim do mês da última remuneração');
assert.equal(aberto.vinculos[0].faltantes, 0);
assert.match(aberto.pendencias.map(p => p.msg).join(' | '), /contado até 31\/07\/2011/);
const recente = CNIS.analisar(texto(vinc(1, 'X', '01/06/2011'), '06/2011 2.000,00 07/2011 2.000,00'), { y: 2011, m: 7, d: 10 });
assert.equal(recente.vinculos[0].dias, 40, 'nunca conta depois de hoje: 01/06 a 10/07/2011');
const abertoSem = CNIS.analisar(texto(vinc(1, 'X', '01/06/2011')), HOJE);
assert.equal(abertoSem.vinculos[0].valido, false);
assert.equal(abertoSem.resumo.diasUnicos, 0, 'sem data de fim e sem remuneração, não conta');

// ---------- Competência repetida soma, não duplica ----------
const rep = CNIS.analisar(texto(vinc(1, 'X', '01/03/2010', '30/04/2010'), '03/2010 100,00 03/2010 50,00 04/2010 100,00'), HOJE);
assert.equal(rep.vinculos[0].comRemuneracao, 2);
assert.equal(rep.vinculos[0].faltantes, 0);
assert.match(rep.pendencias.map(p => p.msg).join(' | '), /mais de uma remuneração.*03\/2010/);

// ---------- Mês sem remuneração dentro de benefício ----------
const ben = CNIS.analisar(texto(
  vinc(1, 'X', '01/01/2020', '30/06/2020'), '01/2020 1.000,00 02/2020 1.000,00 05/2020 1.000,00 06/2020 1.000,00',
  `2 ${NIT} 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 10/03/2020 20/04/2020`
), HOJE);
assert.equal(ben.vinculos.length, 1);
assert.equal(ben.faltantes[0].meses, 2);
assert.equal(ben.faltantes[0].emBeneficio, 2, 'março e abril/2020');

// ---------- Erros de dado ----------
const ruim = CNIS.analisar(vinc(9, 'EMPRESA X', '31/02/2010', '01/01/2011'), HOJE);
assert.equal(ruim.resumo.erros, 1);
assert.equal(ruim.resumo.validos, 0);
const invertido = CNIS.analisar(vinc(9, 'EMPRESA X', '01/06/2010', '01/01/2010'), HOJE);
assert.match(invertido.pendencias[0].msg, /Data de fim anterior/);

// ---------- Fim do extrato: tabela de consolidados e legenda não viram dado ----------
const fim = CNIS.interpretar(texto(
  vinc(1, 'X', '01/01/2020', '31/01/2020'), '01/2020 1.000,00',
  'Salários de Contribuição Consolidados por Ano Civil',
  '2020 1.000,00',
  'Legenda de Indicadores',
  'IREM-ACD Remuneração possui parcela de Acordo 03/2020 999,00'
));
assert.equal(fim.vinculos[0].remuneracoes.length, 1);
assert.equal(fim.orfas.length, 0);

// ---------- Texto sem remunerações: não inventa salários faltantes ----------
const sem = CNIS.analisar(vinc(1, 'EMPRESA Z', '01/03/2015', '31/12/2015'), HOJE);
assert.equal(sem.faltantes.length, 0);
assert.match(sem.pendencias.map(p => p.msg).join(' | '), /não traz remunerações nem recolhimentos/);

// ---------- Resumo "Relações Previdenciárias" (sem remunerações) ----------
const resumoPdf = CNIS.textoDaPagina({ items: [
  it('1', 49, 349.1, 5), it(NIT, 69, 349.1, 60), it('42.894.733/0001-67', 140, 349.1, 70), it('LOJA UM LTDA', 227, 349.1, 60), it('Empregado', 417, 349.1, 40),
  it('20/09/2005', 572, 349.1, 40), it('05/08/2006', 623, 349.1, 40), it('08/2006', 683, 349.1, 30),
  it('2', 49, 333.1, 5), it(NIT, 69, 333.1, 60), it('046.450.966-13', 147, 333.1, 60), it('PESSOA DOIS', 219, 333.1, 60), it('Empregado', 417, 333.1, 40),
  it('45', 523, 333.1, 10), it('19/05/2014', 572, 333.1, 40), it('04/01/2021', 623, 333.1, 40), it('11/2020', 683, 333.1, 30),
  it('IVIN-PROC-TRAB', 736, 337.7, 60), it('IREM-INDPEND', 739, 328.4, 60),
  it('3', 49, 317.1, 5), it(NIT, 69, 317.1, 60), it('2387621080', 153, 317.1, 50), it('31 - AUXILIO DOENCA PREVIDENCIARIO', 226, 317.1, 150), it('Não Informado', 412, 317.1, 60),
  it('17/09/2020', 572, 317.1, 40), it('21/10/2020', 623, 317.1, 40),
  it('4', 49, 304.1, 5), it(NIT, 69, 304.1, 60), it('RECOLHIMENTO', 271, 304.1, 60), it('Contribuinte Individual', 398, 304.1, 90),
  it('01/01/2025', 572, 304.1, 40), it('31/07/2026', 623, 304.1, 40), it('IREC-INDPEND', 740, 304.1, 60)
] });
const rs = CNIS.analisar(resumoPdf, HOJE);
assert.equal(rs.resumo.semRemuneracoes, true);
assert.deepEqual(rs.vinculos.map(x => x.seq), [1, 2, 4]);
assert.equal(rs.vinculos[1].nome, 'PESSOA DOIS', 'matrícula "45" não entra no nome');
assert.equal(rs.vinculos[0].dias, 320);
assert.equal(rs.vinculos[1].dias, 2423);
assert.equal(rs.vinculos[2].dias, 577);
assert.equal(rs.resumo.diasUnicos, 3320);
assert.equal(rs.beneficios.length, 1, 'benefício com tipo "Não Informado" e sem a palavra Benefício');
assert.equal(rs.beneficios[0].nb, '2387621080');
const rsm = rs.pendencias.map(p => (p.ref || '') + ' ' + p.msg).join(' | ');
assert.match(rsm, /Seq\. 2 .*IVIN-PROC-TRAB/, 'indicador solto entre duas linhas vai para o vínculo mais próximo');
assert.match(rsm, /Seq\. 2 .*IREM-INDPEND/);
assert.match(rsm, /Seq\. 4 .*IREC-INDPEND/);
assert.doesNotMatch(rsm, /Seq\. 1 .*IVIN-PROC-TRAB/);
assert.match(rsm, /Última remuneração informada em 11\/2020.*12\/2020 a 01\/2021/);

// ---------- Contribuições de contribuinte individual (competência, pagamento, contribuição, salário) ----------
const ci = CNIS.analisar(texto(
  `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2025 31/03/2025`,
  'Indicadores: IREC-INDPEND',
  'Contribuições',
  'Compet. Data Pgto. Contribuição Salário Contrib. Indicadores Compet. Data Pgto. Contribuição Salário Contrib. Indicadores',
  '01/2025 20/02/2025 75,90 1.518,00 IREC-MEI 02/2025 24/03/2025 75,90 1.518,00 IREC-MEI',
  'IREC-LC123 IREC-LC123',
  '03/2025 22/04/2025 75,90 1.518,00 IREC-MEI'
), HOJE);
assert.equal(ci.vinculos[0].comRemuneracao, 3);
assert.equal(ci.vinculos[0].faltantes, 0);
assert.match(ci.pendencias.map(p => p.msg).join(' | '), /IREC-MEI.* em 3 competência\(s\): 01\/2025 a 03\/2025/);
assert.match(ci.pendencias.map(p => p.msg).join(' | '), /IREC-LC123: recolhimento/);

// ---------- Valores por competência (um por vínculo; mesmo vínculo soma) ----------
assert.equal(CNIS.formatarValor(1234.5), '1.234,50');
assert.equal(CNIS.formatarValor(0.05), '0,05');
assert.deepEqual(r.valores[CNIS.mesDe(2000, 6)], [{ seq: 3, nome: 'OFICINA MODELO ME', valor: 450 }], '400,00 + 50,00 no mesmo vínculo viram um valor');
assert.deepEqual(r.valores[CNIS.mesDe(2010, 8)].map(x => [x.seq, x.valor]), [[2, 1000], [4, 500]], 'dois vínculos na mesma competência: dois valores');
assert.equal(r.valores[CNIS.mesDe(2000, 3)], undefined, 'valor zerado não aparece');
assert.equal(r.valores[CNIS.mesDe(2010, 5)], undefined);

// ---------- Texto vazio ----------
const vazio = CNIS.analisar('', HOJE);
assert.equal(vazio.resumo.totalVinculos, 0);
assert.equal(vazio.resumo.diasUnicos, 0);

console.log('Todos os testes passaram.');
