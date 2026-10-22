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
// Contas com a pendência PEXT do Seq. 5 tratada como regularizada (a exclusão padrão é testada logo depois).
const r = CNIS.analisar(CNIS.EXEMPLO, HOJE, { incluirPendentes: true });
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
assert.equal(s.duracaoVinculos, '3 anos, 5 meses e 18 dias'); assert.equal(s.duracao, require('../assets/cnis.js').formatarDuracao(s.diasUnicos + s.diasBenInc), 'o tempo contado inclui o benefício intercalado');
assert.equal(s.competencias, 34, '6 + 16 + 7 + 2 + 3, sem repetir agosto/2010');
assert.equal(s.mesesSemRemuneracao, 5);
assert.equal(s.mesesAnteriores94, 3);
assert.equal(s.erros, 0);
assert.equal(s.atencoes, 3, 'PREM-EXT, PREC-MENOR-MIN e PEXT');
assert.equal(s.infos, 6, 'AVRC-DEF, competência repetida, vínculo em aberto, concomitância, lacunas longas e benefício por incapacidade intercalado');

const msgs = r.pendencias.map(p => p.msg).join(' | ');
assert.match(msgs, /PREM-EXT: remuneração informada fora do prazo, passível de comprovação em 1 competência\(s\): 06\/2000\. É pendência que impede o cômputo/);
assert.match(msgs, /PREC-MENOR-MIN: recolhimento abaixo do valor mínimo em 1 competência\(s\): 06\/2010/);
assert.match(msgs, /PEXT: vínculo com informação extemporânea/);
assert.match(msgs, /AVRC-DEF: acerto confirmado pelo INSS/);
assert.match(msgs, /Competência com mais de uma remuneração \(valores somados\): 06\/2000/);
assert.match(msgs, /contado até 31\/08\/2023/);
assert.match(msgs, /Período concomitante com Seq\. 4 \(31 dias\)/);
assert.deepEqual(r.pendencias.map(p => p.sev), ['atencao', 'atencao', 'atencao', 'info', 'info', 'info', 'info', 'info', 'info'], 'atenção antes de nota');
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
assert.equal(r.mapa[CNIS.mesDe(2020, 5)], 'beninc-e', 'maio/2020: mês de saída do auxílio por incapacidade (15/04 a 20/05), antes marcado como falta');

const txt = CNIS.resumoEmTexto(r);
assert.match(txt, /Tempo contado: 3 anos, 5 meses e 23 dias/); assert.match(txt, /Só vínculos: 3 anos, 5 meses e 18 dias/);
assert.ok(txt.indexOf('Seq. 1 -') < txt.indexOf('Seq. 3 -') && txt.indexOf('Seq. 3 -') < txt.indexOf('Seq. 2 -'), 'resumo em ordem cronológica');

// ---------- Mesmo extrato, com a exclusão padrão das pendências do Anexo V ----------
{
  const rx = CNIS.analisar(CNIS.EXEMPLO, HOJE);
  const v5 = rx.vinculos.find((x) => x.seq === 5);
  assert.equal(v5.valido, false, 'PEXT sem acerto: vínculo fora da contagem');
  assert.deepEqual(v5.excluidoPendencia, ['PEXT']);
  assert.equal(rx.resumo.diasUnicos, 1263 - 105, 'tira os 105 dias do vínculo extemporâneo');
  assert.equal(rx.resumo.vinculosExcluidos, 1);
  assert.equal(rx.mapa[CNIS.mesDe(2020, 3)], 'pend', 'março/2020 só tinha o vínculo pendente');
  assert.match(rx.pendencias.map((p) => p.msg).join(' | '), /Vínculo com pendência que impede o cômputo: PEXT/);
  assert.equal(rx.resumo.foraPendencias.dias, rx.semExclusao.resumo.diasTotal - rx.resumo.diasTotal, 'tempo fora da contagem = diferença entre as duas contas');
  assert.ok(rx.resumo.foraPendencias.dias > 0 && /\d/.test(rx.resumo.foraPendencias.duracao));
  assert.match(CNIS.resumoEmTexto(rx), /Fora da contagem por pendências do Anexo V: .* Se forem regularizadas, o tempo contado passa a/);
  const op = rx.origemPend[CNIS.mesDe(2020, 3)];
  assert.ok(op && op.length === 1 && op[0].seq === 5 && op[0].codigos.includes('PEXT') && op[0].nome, 'mês pendente informa o vínculo e o código');
  assert.ok(rx.semExclusao && rx.semExclusao.resumo.diasUnicos === 1263, 'guarda a conta com a pendência regularizada');
  assert.ok(!rx.faltantes.some((f) => f.seq === 5), 'vínculo excluído não gera salário faltante');
}

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
assert.deepEqual(r.valores[CNIS.mesDe(2000, 6)], [{ seq: 3, nome: 'OFICINA MODELO ME', tipo: 'Empregado', valor: 450 }], '400,00 + 50,00 no mesmo vínculo viram um valor');
assert.deepEqual(r.valores[CNIS.mesDe(2010, 8)].map(x => [x.seq, x.valor]), [[2, 1000], [4, 600]], 'dois vínculos na mesma competência: dois valores');
assert.equal(r.valores[CNIS.mesDe(2000, 3)], undefined, 'valor zerado não aparece');
assert.equal(r.valores[CNIS.mesDe(2010, 5)], undefined);

// ---------- Salário mínimo ----------
const ciAnt = CNIS.analisar(texto(`4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2015 31/03/2015`, 'Contribuições',
  '01/2015 20/02/2015 50,00 500,00 02/2015 24/03/2015 50,00 500,00', '03/2015 22/04/2015 78,80 788,00'), HOJE);
assert.equal(ciAnt.abaixoMinimo.length, 2, 'contribuinte individual abaixo do mínimo vale para qualquer época');
assert.equal(ciAnt.carencia.validas, 1);
assert.match(ciAnt.pendencias.map(p => p.sev + ' ' + p.msg).join(' | '), /atencao Contribuinte individual ou facultativo/);
assert.equal(CNIS.minimoDe(CNIS.mesDe(1994, 6)), null, 'antes do Plano Real');
assert.equal(CNIS.minimoDe(CNIS.mesDe(1994, 8)), 64.79);
assert.equal(CNIS.minimoDe(CNIS.mesDe(2005, 4)), 260);
assert.equal(CNIS.minimoDe(CNIS.mesDe(2005, 5)), 300);
assert.equal(CNIS.minimoDe(CNIS.mesDe(2020, 1)), 1039);
assert.equal(CNIS.minimoDe(CNIS.mesDe(2020, 2)), 1045);
assert.equal(CNIS.minimoDe(CNIS.mesDe(2026, 10)), 1621);

const minAnt = CNIS.analisar(texto(
  vinc(1, 'A', '01/01/2015', '31/05/2015'), '01/2015 300,00 02/2015 300,00 03/2015 1.000,00', '04/2015 1.000,00 05/2015 300,00'
), HOJE);
assert.equal(minAnt.abaixoMinimo.length, 0, 'empregado abaixo do mínimo antes de 11/2019 conta normalmente e não é listado');
assert.equal(minAnt.carencia.validas, 5);
assert.equal(minAnt.carencia.todas, 5);
assert.equal(minAnt.carencia.linhas[0].faltamValidas, 7, '12 menos 5');
assert.equal(minAnt.carencia.linhas[0].faltamTodas, 7);
assert.equal(minAnt.pendencias.filter(p => p.sev === 'atencao').length, 0, 'antes da EC 103 não há pendência');

const minPos = CNIS.analisar(texto(vinc(1, 'A', '01/01/2021', '30/06/2021'), '01/2021 1.100,00 02/2021 500,00 03/2021 1.100,00', '04/2021 1.100,00 05/2021 1.100,00 06/2021 1.100,00'), HOJE);
assert.equal(minPos.abaixoMinimo.length, 1);
assert.equal(minPos.abaixoMinimo[0].posEC103, true);
assert.match(minPos.pendencias.map(p => p.sev + ' ' + p.msg).join(' | '), /atencao Valor total da competência abaixo do salário mínimo.*02\/2021/);
const somaMes = CNIS.analisar(texto(
  vinc(1, 'A', '01/01/2021', '31/03/2021'), '01/2021 1.100,00 02/2021 600,00 03/2021 1.100,00',
  vinc(2, 'B', '01/02/2021', '28/02/2021'), '02/2021 600,00'
), HOJE);
assert.equal(somaMes.abaixoMinimo.length, 0, 'dois vínculos somam 1.200 e passam do mínimo de 1.100');

const ciMin = CNIS.analisar(texto(
  `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2025 31/03/2025`, 'Contribuições',
  '01/2025 20/02/2025 50,00 1.000,00 02/2025 24/03/2025 50,00 1.000,00', '03/2025 22/04/2025 75,90 1.518,00'
), HOJE);
assert.equal(ciMin.abaixoMinimo.length, 2);
assert.equal(ciMin.abaixoMinimo[0].ci, true, 'janeiro conta como contribuinte individual, mesmo sendo o primeiro mês');
assert.match(ciMin.pendencias.map(p => p.sev + ' ' + p.msg).join(' | '), /atencao Contribuinte individual ou facultativo/);

// ---------- Lacunas ----------
assert.equal(r.lacunas.length, 6);
assert.equal(r.lacunas[0].dias, 1827, '01/01/1995 a 01/01/2000');
assert.deepEqual([r.lacunas[0].antes, r.lacunas[0].depois], [1, 3]);
assert.equal(r.lacunas[2].dias, 731, 'o seguro-desemprego de 2012/2013 divide a lacuna');
assert.equal(r.lacunas[4].dias, 1106, 'o benefício até 20/05/2020 conta como cobertura');
assert.equal(r.lacunas[5].atual, true);
assert.equal(r.lacunas[5].dias, 1134, '01/09/2023 a 08/10/2026');
assert.equal(r.resumo.lacunasLongas, 6);
const curta = CNIS.analisar(texto(vinc(1, 'A', '01/01/2020', '31/01/2020'), '01/2020 1.100,00', vinc(2, 'B', '10/02/2020', '29/02/2020'), '02/2020 1.100,00'), { y: 2020, m: 3, d: 1 });
assert.equal(curta.lacunas.length, 1, 'o dia entre 29/02 e hoje (01/03) é curto demais para listar');
assert.equal(curta.lacunas[0].dias, 9, '01 a 09/02/2020');
const trocas = CNIS.analisar(texto(vinc(1, 'A', '01/01/2020', '31/01/2020'), '01/2020 1.100,00', vinc(2, 'B', '05/02/2020', '29/02/2020'), '02/2020 1.100,00'), { y: 2020, m: 2, d: 29 });
assert.equal(trocas.lacunas.length, 0, '3 dias entre empregos não é lacuna');
assert.equal(CNIS.duracaoCurta(9), '9 dias');
assert.equal(CNIS.duracaoCurta(400), '1 ano, 1 mês e 5 dias');
assert.equal(CNIS.duracaoCurta(365), '1 ano');
assert.equal(CNIS.duracaoCurta(1457), '4 anos e 2 dias', '3 anos + 362 dias: 12 meses de 30 dias fecham um ano');
assert.equal(CNIS.formatarDuracao(1457), '4 anos, 0 meses e 2 dias');
assert.equal(CNIS.formatarDuracao(364), '1 ano, 0 meses e 4 dias', '364 = 12 x 30 + 4');

// ---------- Carência no exemplo ----------
assert.equal(r.carencia.validas, 34, 'todas as 34 competências estão no mínimo ou acima');
assert.equal(r.carencia.linhas[2].faltamValidas, 146);
assert.equal(r.abaixoMinimo.length, 0);
assert.equal(r.carencia.linhas[2].exigido, 180);
assert.equal(r.carencia.mesesAntes94, 3, 'abr a jun/1994');

// ---------- Alertas ----------
const salto = CNIS.analisar(texto(
  vinc(1, 'A', '01/01/2020', '31/12/2020'),
  '01/2020 1.500,00 02/2020 1.500,00 03/2020 1.500,00', '04/2020 1.500,00 05/2020 4.000,00 06/2020 1.500,00',
  '07/2020 1.500,00 08/2020 1.500,00 09/2020 1.500,00', '10/2020 600,00 11/2020 1.500,00 12/2020 1.500,00'
), HOJE);
const sm = salto.pendencias.map(p => p.msg).join(' | ');
assert.match(sm, /Valor muito diferente dos meses vizinhos.*05\/2020 \(4\.000,00 contra cerca de 1\.500,00\).*10\/2020 \(600,00/);
assert.doesNotMatch(sm, /01\/2020 \(|12\/2020 \(/, 'primeiro e último mês não entram na comparação');
const dupl = CNIS.analisar(texto(vinc(1, 'MESMA EMPRESA', '01/01/2020', '31/03/2020'), '01/2020 1.100,00', vinc(2, 'MESMA EMPRESA', '01/02/2020', '31/03/2020'), '02/2020 1.100,00'), HOJE);
assert.match(dupl.pendencias.map(p => p.sev + ' ' + p.msg).join(' | '), /atencao Mesmo empregador em vínculos concomitantes \(Seq\. 2\)/);

// ---------- Antes de 07/1994 o valor não é mostrado ----------
assert.equal(r.valores[CNIS.mesDe(1994, 6)], undefined);
assert.ok(r.valores[CNIS.mesDe(1994, 7)], 'a partir de 07/1994 aparece');
const ant = CNIS.analisar(texto(vinc(1, 'A', '01/01/1990', '31/12/1990'), '01/1990 50,00 02/1990 50,00', '03/1990 50,00'), HOJE);
assert.equal(Object.keys(ant.valores).length, 0, 'sem valores no mapa');
assert.equal(ant.mapa[CNIS.mesDe(1990, 1)], 'ok', 'o mês continua marcado, sem o valor');
assert.equal(ant.vinculos[0].contribuicoes[CNIS.mesDe(1990, 1)], 50, 'o dado fica disponível para outras verificações');

// ---------- Data de pagamento das contribuições ----------
const pg = CNIS.analisar(texto(
  `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2025 28/02/2025`, 'Contribuições',
  '01/2025 20/02/2025 75,90 1.518,00 IREC-MEI 02/2025 24/03/2025 75,90 1.518,00'
), HOJE);
assert.deepEqual(pg.vinculos[0].pagamentos[CNIS.mesDe(2025, 1)], [CNIS.dataDe('20/02/2025').ord]);
assert.deepEqual(pg.vinculos[0].codigosIndicadores, ['IREC-MEI']);

// ---------- CI sem recolhimento não conta no tempo ----------
const ciSem = CNIS.analisar(texto(
  `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2025 30/04/2025`, 'Contribuições',
  '01/2025 20/02/2025 303,60 1.518,00 02/2025 20/03/2025 303,60 1.518,00 04/2025 20/05/2025 303,60 1.518,00'
), HOJE);
assert.equal(ciSem.vinculos[0].dias, 31 + 28 + 30, 'março sem recolhimento fora da contagem');
assert.equal(ciSem.resumo.diasUnicos, 31 + 28 + 30);
console.log('CI sem recolhimento ok');

// ---------- Abaixo do mínimo não conta no tempo ----------
const emp20 = CNIS.analisar(texto(vinc(1, 'A', '01/01/2020', '30/04/2020'), '01/2020 1.045,00 02/2020 500,00 03/2020 1.045,00', '04/2020 1.045,00'), HOJE);
assert.equal(emp20.vinculos[0].dias, 31 + 31 + 30, 'empregado abaixo do mínimo após a EC 103 sai do tempo');
const emp18 = CNIS.analisar(texto(vinc(1, 'A', '01/01/2018', '30/04/2018'), '01/2018 954,00 02/2018 500,00 03/2018 954,00', '04/2018 954,00'), HOJE);
assert.equal(emp18.vinculos[0].dias, 31 + 28 + 31 + 30, 'antes da EC 103 conta normalmente');
const ciMin2 = CNIS.analisar(texto(
  `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2025 30/04/2025`, 'Contribuições',
  '01/2025 20/02/2025 303,60 1.518,00 02/2025 20/03/2025 100,00 500,00 03/2025 20/04/2025 303,60 1.518,00 04/2025 20/05/2025 303,60 1.518,00'
), HOJE);
assert.equal(ciMin2.vinculos[0].dias, 31 + 31 + 30, 'CI abaixo do mínimo sai do tempo');
console.log('abaixo do mínimo fora do tempo ok');

// ---------- Segurado especial sem data de fim e célula quebrada em duas linhas ----------
(function () {
  const N = '1.111.111.111-1';
  const txt = [
    'Seq. NIT Código Emp./NB Origem do Vínculo Tipo Filiado no Vínculo Trabalhador Data Início Data Fim Últ. Remun. Indicadores',
    `1 ${N} 50.002.36589/84 EMPRESA TESTE Empregado 01/06/2010 04/2011 PEXT`,
    'PERÍODO DE ATIVIDADE DE SEGURADO PSE-POS',
    `2 ${N} Segurado Especial 13/11/2012`,
    'ESPECIAL ISE-CVU',
    '32 - APOSENTADORIA INVALIDEZ',
    `3 ${N} 7301413786 Não Informado 02/05/2022`,
    'PREVIDENCIARIA'
  ].join('\n');
  const r = CNIS.analisar(txt, { y: 2026, m: 10, d: 16 });
  assert.equal(r.vinculos.length, 2, 'a aposentadoria não vira vínculo');
  assert.equal(r.beneficios.length, 1);
  assert.equal(r.vinculos[0].nome, 'EMPRESA TESTE');
  const se = r.vinculos.find((v) => v.seq === 2);
  assert.equal(se.nome, 'PERÍODO DE ATIVIDADE DE SEGURADO ESPECIAL');
  assert.equal(se.valido, true, 'segurado especial sem fim conta');
  assert.equal(se.fimOrd, CNIS.dataDe('01/05/2022').ord, 'até o dia anterior à aposentadoria');
  assert.match(r.pendencias.map((p) => p.msg).join(' | '), /O tempo contado inclui tempo rural \(segurado especial\)/);
  const r2 = CNIS.analisar(`1 ${N} Segurado Especial 01/01/2020`, { y: 2026, m: 10, d: 16 });
  assert.equal(r2.vinculos[0].fimOrd, CNIS.dataDe('16/10/2026').ord, 'sem aposentadoria, conta até hoje');
  // empregado rural: marrom mais escuro no mapa; segurado especial, marrom claro
  const r3 = CNIS.analisar(`1 ${N} 11.111.111/0001-11 FAZENDA SANTA FÉ Empregado 01/01/1992 31/03/1992\nRemunerações\n01/1992 100,00 02/1992 100,00 03/1992 100,00`, { y: 2026, m: 10, d: 16 });
  assert.equal(r3.mapa[CNIS.mesDe(1992, 2)], 'ruralemp');
  assert.match(r3.pendencias.map((p) => p.msg).join(' | '), /Empregado rural a partir de 01\/11\/1991 conta normalmente/);
})();
console.log('segurado especial sem fim ok');

// ---------- Benefício por incapacidade intercalado: mostrado à parte ----------
(function () {
  const N = '1.111.111.111-1';
  const txt = [
    `1 ${N} 11.111.111/0001-11 EMPRESA A Empregado 01/01/2000 31/12/2000`,
    `2 ${N} 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 01/01/2001 31/03/2001 2 - CESSADO`,
    `3 ${N} 22.222.222/0001-22 EMPRESA B Empregado 01/04/2001 31/12/2001`
  ].join('\n');
  const r = CNIS.analisar(txt, { y: 2026, m: 10, d: 16 });
  assert.equal(r.resumo.diasUnicos, 366 + 275);
  assert.equal(r.resumo.diasBenInc, 31 + 28 + 31, 'benefício intercalado soma à parte');
  const r2 = CNIS.analisar(`1 ${N} 11.111.111/0001-11 EMPRESA A Empregado 01/01/2000 31/12/2000\n2 ${N} 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 01/01/2001 31/03/2001 2 - CESSADO`, { y: 2026, m: 10, d: 16 });
  assert.equal(r2.resumo.diasBenInc, 0, 'sem atividade depois, não é intercalado');
})();
console.log('benefício intercalado ok');

// ---------- Texto vazio ----------
const vazio = CNIS.analisar('', HOJE);
assert.equal(vazio.resumo.totalVinculos, 0);
assert.equal(vazio.resumo.diasUnicos, 0);

// ---------- Gerador de exemplos fictícios ----------
(function () {
  let sem = 1; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const vistos = new Set(), tipos = new Set(); let anterior = null;
  for (let i = 0; i < 80; i++) {
    const g = CNIS.gerarExemplo(rnd);
    assert.notEqual(g.descricao, anterior, 'nunca repete o mesmo cenário em seguida');
    anterior = g.descricao; vistos.add(g.descricao);
    const a = CNIS.analisar(g.texto, { y: 2026, m: 10, d: 11 });
    assert.ok(a.vinculos.length >= 1, g.descricao);
    a.vinculos.forEach((v) => tipos.add(v.tipo || v.categoria || ''));
  }
  assert.ok(vistos.size >= 10, 'vários cenários diferentes');
  const fac = CNIS.analisar(texto(
    `5 ${NIT} RECOLHIMENTO Facultativo 01/01/2015 31/03/2015`, 'Contribuições',
    '01/2015 20/02/2015 180,00 900,00 02/2015 24/03/2015 180,00 900,00'
  ), HOJE);
  assert.equal(fac.mapa[2015 * 12], 'okfac', 'só facultativo: verde mais claro');
})();

// ---------- Mapa: cores para valores abaixo do mínimo ----------
(function () {
  const emp = CNIS.analisar(texto(
    `1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/01/2015 31/03/2021`, 'Remunerações',
    '01/2015 400,00 02/2015 1.500,00', '11/2020 500,00 12/2020 1.500,00 01/2021 1.500,00'
  ), HOJE);
  const m = emp.mapa;
  assert.equal(m[2015 * 12], 'ok', 'empregado abaixo do mínimo antes de 11/2019 conta normalmente');
  assert.equal(m[2020 * 12 + 10], 'abaixoemp', 'empregado abaixo do mínimo desde 11/2019');
  assert.equal(m[2020 * 12 + 11], 'ok');
  const ci2 = CNIS.analisar(texto(
    `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2015 31/03/2015`, 'Contribuições',
    '01/2015 20/02/2015 30,00 200,00 02/2015 24/03/2015 180,00 900,00'
  ), HOJE);
  assert.equal(ci2.mapa[2015 * 12], 'abaixoci', 'contribuinte individual abaixo do mínimo em qualquer época');
  assert.equal(ci2.mapa[2015 * 12 + 1], 'okci', 'só contribuinte individual, regular: verde médio');
  const misto = CNIS.analisar(texto(
    `1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/02/2015 28/02/2015`, 'Remunerações', '02/2015 1.500,00',
    `4 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2015 31/03/2015`, 'Contribuições',
    '01/2015 20/02/2015 180,00 900,00 02/2015 24/03/2015 180,00 900,00 03/2015 24/04/2015 180,00 900,00'
  ), HOJE);
  assert.equal(misto.mapa[2015 * 12 + 1], 'ok', 'empregado e contribuinte individual no mesmo mês: prevalece o verde de empregado');
  assert.equal(misto.mapa[2015 * 12 + 2], 'okci');
})();

// ---------- Mapa: meses em benefício ----------
(function () {
  const b = CNIS.analisar(texto(
    `1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/01/2021 31/12/2021`, 'Remunerações', '01/2021 1.500,00 02/2021 1.500,00',
    `2 ${NIT} 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 15/04/2021 20/07/2021`,
    `3 ${NIT} 2234567890 Benefício 80 - SALARIO MATERNIDADE 10/09/2021 07/01/2022`
  ), HOJE).mapa;
  const k = (y, m) => y * 12 + m - 1;
  assert.equal(b[k(2021, 4)], 'beninc-e');
  assert.equal(b[k(2021, 5)], 'beninc');
  assert.equal(b[k(2021, 6)], 'beninc');
  assert.equal(b[k(2021, 7)], 'beninc-e');
  assert.equal(b[k(2021, 8)], 'falta', 'fora dos benefícios continua sem remuneração');
  assert.equal(b[k(2021, 9)], 'bensm-e');
  assert.equal(b[k(2021, 11)], 'bensm');
  assert.equal(b[k(2022, 1)], 'bensm-e');
  assert.equal(b[k(2021, 1)], 'ok');
})();

// ---------- Mapa: seguro-desemprego sem recolhimento ----------
(function () {
  const m = CNIS.analisar(texto(
    `1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/01/2021 31/03/2021`, 'Remunerações', '01/2021 1.500,00 02/2021 1.500,00 03/2021 1.500,00',
    `2 ${NIT} SEGURO DESEMPREGO/SINE Possuidor de evento previdenciário 01/04/2021 31/07/2021`
  ), HOJE).mapa;
  const k = (y, mm) => y * 12 + mm - 1;
  assert.equal(m[k(2021, 3)], 'ok');
  assert.equal(m[k(2021, 4)], 'segdes');
  assert.equal(m[k(2021, 7)], 'segdes');
  assert.equal(m[k(2021, 8)], undefined);
})();

// ---------- PDF com página girada (paisagem): texto rotacionado ----------
(function () {
  const rot = (s, e, f, w) => ({ str: s, width: w, transform: [0, 8, -8, 0, e, f] });
  const conteudo = { items: [
    // linha de cima: e menor; dentro da linha, x cresce com f
    rot('Remunerações', 250, 54, 66),
    rot('03/2007', 282, 55, 33), rot('2.334,36', 282, 144, 36), rot('04/2007', 282, 318, 33), rot('2.027,87', 282, 407, 36),
    rot('06/2007', 297, 55, 33), rot('2.027,87', 297, 144, 36)
  ] };
  const t = CNIS.textoDaPagina(conteudo).split('\n');
  assert.deepEqual(t, ['Remunerações', '03/2007 2.334,36 04/2007 2.027,87', '06/2007 2.027,87']);
})();

console.log('Todos os testes passaram.');

// ---------- Benefício por incapacidade integral não conta como carência ----------
{
  const NITb = '1.234.567.890-1';
  const rem = (a, b) => { const o = []; for (let k = a; k <= b; k++) o.push(String(k % 12 + 1).padStart(2, '0') + '/' + Math.floor(k / 12) + ' 3.000,00'); return o.join(' '); };
  const mk = (ini, fim) => texto(`1 ${NITb} 11.111.111/0001-11 EMPRESA Empregado 01/01/2020`, 'Remunerações', rem(2020 * 12, 2020 * 12 + 11),
    `2 ${NITb} 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO ${ini} ${fim}`);
  const base = CNIS.analisar(texto(`1 ${NITb} 11.111.111/0001-11 EMPRESA Empregado 01/01/2020`, 'Remunerações', rem(2020 * 12, 2020 * 12 + 11)), HOJE);
  assert.equal(base.carencia.validas, 12);
  // Benefício de 10/03/2020 a 20/06/2020: março conta (começou depois do dia 1), abril e maio não, junho conta (terminou antes do fim do mês)
  const a = CNIS.analisar(mk('10/03/2020', '20/06/2020'), HOJE);
  assert.ok(a.beneficios.length > 0);
  {
    assert.equal(!!a.mesesBenIncapacidade[CNIS.mesDe(2020, 4)], true);
    assert.equal(!!a.mesesBenIncapacidade[CNIS.mesDe(2020, 5)], true);
    assert.equal(!!a.mesesBenIncapacidade[CNIS.mesDe(2020, 3)], false);
    assert.equal(!!a.mesesBenIncapacidade[CNIS.mesDe(2020, 6)], false);
    assert.equal(a.carencia.validas, 10);
  }
  // Benefício de 01/03/2020 a 30/06/2020: março a junho inteiros ficam de fora
  const b = CNIS.analisar(mk('01/03/2020', '30/06/2020'), HOJE);
  assert.equal(b.carencia.validas, 8);
  console.log('benefício integral na carência:', a.beneficios.length, b.beneficios.length);
}

// ---------- Facultativo só conta em meses sem outra atividade ou benefício concomitante ----------
{
  const NITf = '1.234.567.890-1';
  const fac = `5 ${NITf} RECOLHIMENTO Facultativo 01/01/2020 30/06/2020\nContribuições\n01/2020 15/02/2020 110,00 1.100,00 02/2020 15/03/2020 110,00 1.100,00 03/2020 15/04/2020 110,00 1.100,00 04/2020 15/05/2020 110,00 1.100,00 05/2020 15/06/2020 110,00 1.100,00 06/2020 15/07/2020 110,00 1.100,00`;
  const emp = `1 ${NITf} 11.111.111/0001-11 EMPRESA Empregado 10/03/2020 15/04/2020\nRemunerações\n03/2020 1.100,00 04/2020 1.100,00`;
  const sozinho = CNIS.analisar(fac, HOJE);
  assert.equal(sozinho.resumo.diasUnicos, 182);
  assert.equal(sozinho.carencia.validas, 6);
  const junto = CNIS.analisar(emp + '\n' + fac, HOJE);
  // março e abril: só vale o empregado (1 valor por mês); o facultativo fica de fora de carência, mapa e tempo
  assert.equal(junto.valores[CNIS.mesDe(2020, 3)].length, 1);
  assert.equal(junto.valores[CNIS.mesDe(2020, 4)].length, 1);
  assert.equal(junto.valores[CNIS.mesDe(2020, 1)].length, 1);
  assert.equal(junto.mapa[CNIS.mesDe(2020, 3)], 'ok');
  assert.equal(junto.carencia.validas, 6);
  assert.equal(junto.resumo.diasUnicos, 182 - 61 + 37);
  const ex = junto.vinculos.find((x) => /facultativ/i.test(x.tipo));
  assert.deepEqual(ex.excluidosFacultativo, [CNIS.mesDe(2020, 3), CNIS.mesDe(2020, 4)]);
  // salário-maternidade concomitante, mesmo que por um dia do mês
  const sm = CNIS.analisar(fac + `\n2 ${NITf} 1234567890 Benefício 80 - SALARIO MATERNIDADE 30/05/2020 28/09/2020`, HOJE);
  assert.deepEqual(sm.vinculos.find((x) => /facultativ/i.test(x.tipo)).excluidosFacultativo, [CNIS.mesDe(2020, 5), CNIS.mesDe(2020, 6)]);
}
console.log('facultativo concomitante ok');

// ---------- Segurado especial e empregado rural: marrom claro ----------
{
  const NITr = '1.234.567.890-1';
  const r1 = CNIS.analisar(`1 ${NITr} 11.111.111/0001-11 SÍTIO BOA VISTA Segurado Especial 01/01/2020 31/03/2020`, HOJE);
  assert.equal(r1.mapa[CNIS.mesDe(2020, 2)], 'rural');
  const r2 = CNIS.analisar(`1 ${NITr} 11.111.111/0001-11 FAZENDA TRÊS IRMÃOS Empregado 01/01/2020 31/03/2020\nRemunerações\n01/2020 1.500,00 02/2020 1.500,00 03/2020 1.500,00`, HOJE);
  assert.equal(r2.mapa[CNIS.mesDe(2020, 2)], 'ruralemp', 'empregado rural pelo nome do empregador: marrom mais escuro');
  const r3 = CNIS.analisar(`1 ${NITr} 11.111.111/0001-11 LOJA CENTRO Empregado 01/01/2020 31/03/2020\nRemunerações\n01/2020 1.500,00 02/2020 1.500,00 03/2020 1.500,00`, HOJE);
  assert.equal(r3.mapa[CNIS.mesDe(2020, 2)], 'ok');
  const r4 = CNIS.analisar(`1 ${NITr} 11.111.111/0001-11 SÍTIO BOA VISTA Segurado Especial 01/01/2020 31/03/2020\n2 ${NITr} 22.222.222/0001-22 LOJA CENTRO Empregado 01/02/2020 29/02/2020\nRemunerações\n02/2020 1.500,00`, HOJE);
  assert.equal(r4.mapa[CNIS.mesDe(2020, 2)], 'ok', 'remuneração de outra atividade prevalece');
  assert.equal(r4.mapa[CNIS.mesDe(2020, 1)], 'rural');
}
console.log('rural ok');

// ---------- Categoria AUTÔNOMO = contribuinte individual ----------
{
  const NITa = '1.234.567.890-1';
  const au = CNIS.analisar(texto(
    `4 ${NITa} RECOLHIMENTO AUTÔNOMO 01/01/2015 31/03/2015`, 'Contribuições',
    '01/2015 20/02/2015 30,00 200,00 02/2015 24/03/2015 180,00 900,00'
  ), HOJE);
  assert.equal(au.vinculos.length, 1);
  assert.equal(au.mapa[2015 * 12], 'abaixoci', 'autônomo abaixo do mínimo, como contribuinte individual');
  assert.equal(au.mapa[2015 * 12 + 1], 'okci');
  assert.equal(require('../assets/direito.js').classeDe(au.vinculos[0]), 'ci');
}
console.log('autônomo ok');

// Mapa: vínculos por competência (para o texto ao passar o mouse)
{
  const NITv = '1.234.567.890-1';
  const rv = CNIS.analisar(`1 ${NITv} 11.111.111/0001-11 EMPRESA ANTIGA Empregado 01/01/1993 30/06/1993\nRemunerações\n01/1993 1.000,00 02/1993 1.000,00`, HOJE);
  assert.deepEqual(rv.vinculosPorMes[CNIS.mesDe(1993, 2)], [{ seq: 1, nome: 'EMPRESA ANTIGA' }]);
}
console.log('vínculos por mês ok');

// Lançamento manual: extrato sintético com salário mínimo em todas as competências
{
  const P = (tipo, ini, fim) => ({ tipo, ini, fim, campoTipo: 't', campoIni: 'i', campoFim: 'f' });
  const t = CNIS.gerarTextoManual([
    P('Empregado', { y: 2010, m: 1, d: 1 }, { y: 2010, m: 12, d: 31 }),
    P('Contribuinte Individual', { y: 2011, m: 1, d: 1 }, { y: 2011, m: 6, d: 30 }),
    P('Empregado Doméstico', { y: 2012, m: 1, d: 10 }, null),
    P('Segurado Especial', { y: 1990, m: 1, d: 1 }, { y: 1990, m: 12, d: 31 }),
    P('Facultativo', { y: 2020, m: 1, d: 1 }, { y: 2020, m: 3, d: 31 })
  ], HOJE);
  const a = CNIS.analisar(t, HOJE);
  assert.equal(a.vinculos.length, 5);
  assert.ok(a.vinculos.every((v) => v.valido), 'todos os períodos contam');
  assert.equal(a.resumo.erros, 0);
  assert.equal(a.vinculos.find((v) => v.tipo === 'Empregado').faltantes, 0, 'sem competência faltante');
  assert.equal(a.vinculos.find((v) => v.tipo === 'Empregado').dias, 365);
  assert.match(t, /01\/2010 510,00/, 'salário mínimo de 01/2010');
  assert.match(t, /01\/2020 [\d.,]+ [\d.,]+ ?/, 'recolhimento do facultativo');
  const erroCom = (periodos, re, campo) => assert.throws(() => CNIS.gerarTextoManual(periodos, HOJE), (e) => re.test(e.message) && (!campo || e.campos.includes(campo)));
  erroCom([], /ao menos um período/);
  erroCom([{ tipo: '', ini: { y: 2010, m: 1, d: 1 }, campoTipo: 't1' }], /tipo de vínculo/, 't1');
  erroCom([{ tipo: 'Empregado', ini: null, campoIni: 'i1' }], /data de início/, 'i1');
  erroCom([{ tipo: 'Empregado', ini: { y: 2010, m: 2, d: 30 }, campoIni: 'i1' }], /inválida/, 'i1');
  erroCom([{ tipo: 'Empregado', ini: { y: 2027, m: 1, d: 1 }, campoIni: 'i1' }], /futuro/, 'i1');
  erroCom([{ tipo: 'Empregado', ini: { y: 2010, m: 5, d: 1 }, fim: { y: 2010, m: 4, d: 1 }, campoFim: 'f1' }], /anterior ao início/, 'f1');
}
console.log('lançamento manual ok');

// ---------- Pendências do Anexo V (Portaria DIRBEN/INSS 990/2022) ----------
{
  const o = (y, m, d) => CNIS.ordemDe(y, m, d);
  // Competência com PREM-EMPR: fora do tempo e da carência, sem virar salário faltante
  const a = CNIS.analisar(texto(vinc(1, 'A', '01/01/2015', '31/03/2015'), '01/2015 1.000,00 02/2015 1.000,00 PREM-EMPR 03/2015 1.000,00'), HOJE);
  assert.equal(a.resumo.diasUnicos, 62, 'jan e mar/2015');
  assert.equal(a.vinculos[0].faltantes, 0);
  assert.deepEqual(Object.keys(a.vinculos[0].mesesPendentes).map(Number), [CNIS.mesDe(2015, 2)]);
  assert.equal(a.mapa[CNIS.mesDe(2015, 2)], 'pend');
  assert.equal(a.pendentesExcluidos.competencias.length, 1);
  assert.equal(a.semExclusao.resumo.diasUnicos, 90);
  // Acerto confirmado cancela a pendência do vínculo extemporâneo
  const b = CNIS.analisar(texto(vinc(1, 'B', '01/01/2015', '31/03/2015'), 'Indicadores: PEXT AEXT-VT', '01/2015 1.000,00 02/2015 1.000,00 03/2015 1.000,00'), HOJE);
  assert.equal(b.vinculos[0].valido, true);
  assert.equal(b.semExclusao, undefined, 'nada excluído');
  // Mandato eletivo: só conta como empregado a partir de 19/09/2004
  const c = CNIS.analisar(texto(vinc(1, 'CAMARA MUNICIPAL', '01/01/2001', '31/12/2008'), 'Indicadores: PVIN-MAND-ELETIVO-TOTAL', '01/2001 1.000,00 01/2008 1.000,00'), HOJE);
  assert.equal(c.resumo.diasUnicos, o(2008, 12, 31) - o(2004, 9, 19) + 1);
  assert.equal(c.vinculos[0].inicioCNIS.y, 2001, 'guarda a data original');
  // Desligamento por processo trabalhista: o que passa da última remuneração fica de fora
  const d = CNIS.analisar(texto(vinc(1, 'D', '01/01/2018', '31/12/2018'), 'Indicadores: PVIN-DESLIG-PROC-TRAB', '01/2018 1.000,00 02/2018 1.000,00 03/2018 1.000,00', '04/2018 1.000,00 05/2018 1.000,00 06/2018 1.000,00'), HOJE);
  assert.equal(d.resumo.diasUnicos, o(2018, 6, 30) - o(2018, 1, 1) + 1);
  assert.match(d.pendencias.map((p) => p.msg).join(' '), /fora da contagem 01\/07\/2018 a 31\/12\/2018/);
  // Idade mínima: com a data de nascimento no extrato, só conta a partir dos 16 anos (EC 20/1998)
  const e = CNIS.analisar('Data de Nascimento: 10/05/1990 Nome da Mãe: X\n' + texto(vinc(1, 'E', '01/01/2004', '31/12/2008'), 'Indicadores: PDT-NASC-FIL-INV', '01/2004 500,00'), HOJE);
  assert.equal(e.nascimento.y, 1990);
  assert.equal(e.resumo.diasUnicos, o(2008, 12, 31) - o(2006, 5, 10) + 1);
  // Vínculo inteiro: PDIV-DADOS-GFIP no cabeçalho
  const f = CNIS.analisar(texto(vinc(1, 'F', '01/01/2015', '31/03/2015'), 'Indicadores: PDIV-DADOS-GFIP', '01/2015 1.000,00'), HOJE);
  assert.equal(f.vinculos[0].valido, false);
  assert.equal(f.resumo.diasUnicos, 0);
  // Recolhimento de contribuinte individual com pendência na competência
  const g = CNIS.analisar([`1 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2020 31/03/2020`, 'Contribuições',
    '01/2020 15/02/2020 209,00 1.045,00 02/2020 15/03/2020 209,00 1.045,00 PREC-CDCONC', '03/2020 15/04/2020 209,00 1.045,00'].join('\n'), HOJE);
  assert.deepEqual(g.pendentesExcluidos.competencias.map((x) => x.mes), [CNIS.mesDe(2020, 2)]);
  assert.equal(g.vinculos[0].contribuicoes[CNIS.mesDe(2020, 2)], undefined);
  // Plano simplificado: marcado para a aposentadoria por tempo, sem sair da análise
  const h = CNIS.analisar([`1 ${NIT} RECOLHIMENTO Contribuinte Individual 01/01/2020 31/01/2020`, 'Contribuições', '01/2020 15/02/2020 114,95 1.045,00 IREC-LC123'].join('\n'), HOJE);
  assert.equal(h.vinculos[0].mesesTC[CNIS.mesDe(2020, 1)], true);
  assert.equal(h.resumo.diasUnicos, 31);
  // Códigos novos são lidos, inclusive com Ç e sublinhado
  const i = CNIS.analisar(texto(vinc(1, 'I', '01/01/2015', '31/03/2015'), 'Indicadores: PVIN-DESLIG-JUSTIÇA-TRAB', '01/2015 1.000,00 PREC-COD1821_FORA_VIG 02/2015 1.000,00'), HOJE);
  assert.ok(i.vinculos[0].codigosIndicadores.indexOf('PREC-COD1821_FORA_VIG') >= 0);
  assert.ok(i.pendencias.some((p) => /PVIN-DESLIG-JUSTICA-TRAB/.test(p.msg)));
  // A tabela da ferramenta é a mesma de dados/indicadores.json
  const dados = require('../dados/indicadores.json');
  assert.deepEqual(Object.keys(CNIS.INDICADORES).sort(), dados.indicadores.map((x) => x.cod).sort(), 'rode node tools/gerar-indicadores.js');
}
console.log('pendências do Anexo V ok');

// ---------- Facultativo de baixa renda: PREC-FBR com o motivo (FBR-AUT-...) completo ou cortado pelo PDF ----------
{
  const cab = `5 ${NIT} RECOLHIMENTO Facultativo 01/01/2015 31/03/2015`;
  const legenda = (...c) => ['Legenda de Indicadores', ...c.map((x) => `${x} Recolhimento de segurado Facultativo de Baixa Renda`)];
  const msgs = (a) => a.pendencias.map((q) => q.msg).join(' | ');
  const completo = CNIS.analisar(texto(cab, 'Contribuições',
    '01/2015 20/02/2015 180,00 900,00 PREC-FBR(FBR-AUT-EXPCAD) 02/2015 24/03/2015 180,00 900,00 PREC-FBR(FBR-AUT-PENDCAD)'), HOJE);
  assert.match(msgs(completo), /FBR-AUT-EXPCAD \([^)]*atualização bienal[^)]*\) em 1 competência\(s\): 01\/2015/);
  assert.match(msgs(completo), /FBR-AUT-PENDCAD \([^)]*cadastro no CadÚnico\) em 1 competência\(s\): 02\/2015/);
  assert.ok(!/legenda do extrato/.test(msgs(completo)), 'motivo completo: sem aviso de corte');
  const cortado = CNIS.analisar(texto(cab, 'Contribuições',
    '01/2015 20/02/2015 180,00 900,00 PREC-FBR(FBR-AUT 02/2015 24/03/2015 180,00 900,00 PREC-FBR(FBR-AUT',
    ...legenda('FBR-AUT-EXPCAD', 'FBR-AUT-PENDCAD')), HOJE);
  assert.match(msgs(cortado), /PREC-FBR \([^)]*\) em 2 competência\(s\): 01\/2015 a 02\/2015/);
  assert.match(msgs(cortado), /A legenda do extrato traz FBR-AUT-EXPCAD[^|]*e FBR-AUT-PENDCAD[^|]*não diz qual vale para cada competência/);
  const unico = CNIS.analisar(texto(cab, 'Contribuições',
    '01/2015 20/02/2015 180,00 900,00 PREC-FBR(FBR-AUT', ...legenda('FBR-AUT-EXPCAD')), HOJE);
  assert.match(msgs(unico), /legenda do extrato traz apenas FBR-AUT-EXPCAD[^|]*que é o motivo/);
  const semLegenda = CNIS.analisar(texto(cab, 'Contribuições', '01/2015 20/02/2015 180,00 900,00 PREC-FBR(FBR-AUT'), HOJE);
  assert.match(msgs(semLegenda), /Veja o motivo na tela do CNIS/);
  console.log('facultativo de baixa renda (motivo) ok');
}

// ---------- Salário-maternidade tem contribuição: conta como tempo e como carência (meses inteiros), sem repetir o que o vínculo já cobre ----------
{
  const N = '123.45678.90-1';
  const base = `1 ${N} 11.111.111/0001-11 A Empregado 01/01/2015 31/03/2015\nContribuições\n01/2015 1.000,00 02/2015 1.000,00 03/2015 1.000,00`;
  const sem = CNIS.analisar(base, HOJE);
  const com = CNIS.analisar(base + `\n2 ${N} 1234567890 Benefício 80 - SALARIO MATERNIDADE 01/06/2015 28/09/2015 2 - CESSADO`, HOJE);
  assert.equal(com.resumo.diasSalMat, 120, '01/06 a 28/09/2015 = 120 dias fora dos vínculos');
  assert.equal(com.resumo.diasTotal, sem.resumo.diasTotal + 120, 'entra no tempo contado');
  assert.equal(com.resumo.mesesSalMat, 4, 'junho (começa no dia 1), julho, agosto e setembro (mês de saída conta sempre)');
  assert.equal(com.carencia.validas, sem.carencia.validas + com.resumo.mesesSalMat);
  assert.match(CNIS.resumoEmTexto(com), /Inclui salário-maternidade fora dos vínculos: /);
  // Dentro do vínculo, o período já conta: não soma duas vezes.
  const dentro = CNIS.analisar(base + `\n2 ${N} 1234567890 Benefício 80 - SALARIO MATERNIDADE 01/02/2015 28/03/2015 2 - CESSADO`, HOJE);
  assert.equal(dentro.resumo.diasSalMat, 0);
  assert.equal(dentro.resumo.diasTotal, sem.resumo.diasTotal);
  // Mais de um salário-maternidade: dias e meses somam, sem contar duas vezes o mesmo mês.
  const dois = CNIS.analisar(base + `\n2 ${N} 1234567890 Benefício 80 - SALARIO MATERNIDADE 01/06/2015 28/09/2015 2 - CESSADO\n3 ${N} 2234567890 Benefício 80 - SALARIO MATERNIDADE 01/06/2018 28/09/2018 2 - CESSADO`, HOJE);
  assert.equal(dois.resumo.qtdSalMat, 2);
  assert.equal(dois.resumo.diasSalMat, 240);
  assert.equal(dois.resumo.mesesSalMat, 8, 'quatro meses em cada benefício');
  assert.match(CNIS.resumoEmTexto(dois), /Competências com remuneração: 3 \+ 8 mês\(es\) de salário-maternidade/);
  assert.match(CNIS.resumoEmTexto(dois), /Inclui 2 benefícios de salário-maternidade/);
  // Entrada no meio do mês: o mês de entrada não conta sem recolhimento; o de saída conta.
  const meio = CNIS.analisar(base + `\n2 ${N} 1234567890 Benefício 80 - SALARIO MATERNIDADE 15/06/2015 11/10/2015 2 - CESSADO`, HOJE);
  assert.equal(meio.resumo.mesesSalMat, 4, 'julho, agosto, setembro e outubro (saída); junho parcial não conta');
  const meioComRec = CNIS.analisar(base + `\n2 ${N} 1234567890 Benefício 80 - SALARIO MATERNIDADE 15/06/2015 11/10/2015 2 - CESSADO\n3 ${N} 22.222.222/0001-22 B Empregado 01/06/2015 14/06/2015\n06/2015 500,00`, HOJE);
  assert.ok(meioComRec.carencia.todas >= meio.carencia.todas + 1, 'com remuneração em junho, o mês passa a contar como remunerado');
  console.log('salário-maternidade ok');
}

// Todo estado do mapa de competências (classe .c-xxx no CSS) precisa de rótulo; senão o tooltip mostra "undefined".
{
  const fs = require('fs'), path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cnis.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'style.css'), 'utf8');
  const rot = js.match(/var ROTULO_MAPA = \{([^}]*)\}/)[1];
  const chaves = new Set([...rot.matchAll(/(?:^|,)\s*'?([a-z0-9-]+)'?\s*:/g)].map((m) => m[1]));
  const estados = new Set([...css.matchAll(/\.c-([a-z0-9-]+)/g)].map((m) => m[1]));
  estados.delete('vazio');
  for (const e of estados) require('node:assert/strict').ok(chaves.has(e), 'rótulo ausente no mapa: ' + e);
  console.log('rótulos do mapa ok (' + estados.size + ' estados)');
}
