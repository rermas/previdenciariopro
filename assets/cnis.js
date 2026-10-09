/*
 * Análise de CNIS: tempo contado, competências, salários faltantes e pendências.
 * Todo o processamento acontece no navegador. Nada é enviado, gravado ou lembrado.
 *
 * Layout lido (extrato do Portal CNIS):
 *   - cada registro começa por "Seq. NIT ..." e pode ser vínculo, benefício ou evento previdenciário;
 *   - as remunerações vêm em grade de até 3 pares "competência valor [indicadores]" por linha;
 *   - "Remunerações Décimo Terceiro" é uma seção à parte e não entra na contagem de competências;
 *   - o fim do extrato traz a tabela de salários consolidados e a legenda, que são ignoradas.
 */
(function (root) {
  'use strict';

  var BASE = '';
  try { BASE = document.currentScript.src.replace(/[^\/]*$/, ''); } catch (e) { /* node */ }

  // Competências são contadas como índice de mês: ano * 12 + (mês - 1).
  var INICIO_PBC = 1994 * 12 + 6; // 07/1994: antes disso o CNIS costuma não trazer remunerações

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Indicadores do CNIS. Os da legenda oficial do extrato usam o texto dela; os demais vêm de
  // artigos de escritórios de advocacia previdenciária. O código original sempre aparece junto.
  var INDICADORES = {
    'AVRC-DEF': ['info', 'acerto confirmado pelo INSS'],
    'IREM-ACD': ['info', 'remuneração possui parcela de acordo, convenção ou dissídio coletivo'],
    'IREM-INDPEND': ['atencao', 'remunerações com indicadores ou pendências'],
    'PSC-MEN-SM-EC103': ['atencao', 'salário de contribuição menor que o mínimo mensal; a competência pode ser complementada, utilizada ou agrupada conforme a EC 103/2019'],
    'IVIN-PROC-TRAB': ['atencao', 'vínculo possui processo trabalhista'],
    'IREC-MEI': ['info', 'contribuição da competência recolhida com código MEI'],
    'PREC-MENOR-MIN': ['atencao', 'contribuição abaixo do salário mínimo'],
    'PREM-EXT': ['atencao', 'remuneração informada fora do prazo'],
    'PEXT': ['atencao', 'vínculo extemporâneo (registrado fora do prazo)'],
    'IREC-INDPEND': ['atencao', 'recolhimentos com indicadores ou pendências'],
    'PREM-FVIN': ['atencao', 'remuneração depois do fim do vínculo'],
    'PREM-IVIN': ['atencao', 'remuneração antes do início do vínculo'],
    'PADM-EMPR': ['atencao', 'admissão anterior ao início da atividade do empregador'],
    'PREM-EMPR': ['atencao', 'remuneração anterior ao início da atividade do empregador'],
    'PRES-EMPR': ['atencao', 'rescisão anterior ao início da atividade do empregador'],
    'PEMP-CAD': ['atencao', 'dados cadastrais do empregador ausentes ou inconsistentes'],
    'PREC-FACULTCONC': ['atencao', 'contribuição facultativa concomitante com outro vínculo'],
    'PRPPS': ['info', 'período em regime próprio de previdência'],
    'IEAN': ['info', 'exposição a agente nocivo informada pelo empregador'],
    'AEXT-VT': ['info', 'correção de vínculo extemporâneo validada pelo INSS'],
    'IREC-LC123': ['info', 'recolhimento no Plano Simplificado de Previdência Social (LC 123/2006)']
  };

  // Salário mínimo nacional por competência: [ano, mês de início da vigência, valor]. Conferir antes de usar em peça.
  var MINIMOS = [
    [1994, 7, 64.79], [1994, 9, 70], [1995, 5, 100], [1996, 5, 112], [1997, 5, 120], [1998, 5, 130], [1999, 5, 136],
    [2000, 4, 151], [2001, 4, 180], [2002, 4, 200], [2003, 4, 240], [2004, 5, 260], [2005, 5, 300], [2006, 4, 350],
    [2007, 4, 380], [2008, 3, 415], [2009, 2, 465], [2010, 1, 510], [2011, 1, 540], [2011, 3, 545], [2012, 1, 622],
    [2013, 1, 678], [2014, 1, 724], [2015, 1, 788], [2016, 1, 880], [2017, 1, 937], [2018, 1, 954], [2019, 1, 998],
    [2020, 1, 1039], [2020, 2, 1045], [2021, 1, 1100], [2022, 1, 1212], [2023, 1, 1302], [2023, 5, 1320],
    [2024, 1, 1412], [2025, 1, 1518], [2026, 1, 1621]
  ];
  var EC103 = 2019 * 12 + 10; // competência 11/2019: a EC 103/2019 passou a valer em 13/11/2019

  // Carência (Lei 8.213/91, art. 25), em número de contribuições mensais.
  var LACUNA_MINIMA = 7; // dias; intervalos menores são troca normal de emprego
  var CARENCIAS = [
    ['Auxílio por incapacidade temporária e aposentadoria por incapacidade permanente', 12],
    ['Salário-maternidade (contribuinte individual, facultativa e segurada especial)', 10],
    ['Aposentadoria por idade, por tempo de contribuição e especial', 180]
  ];

  var RE_IND = /\b(?:PREC|PREM|PVIN|PADM|PRES|PEMP|PSE|PSC|PDT|IREC|IREM|IVIN|ISE|AEXTV|AEXT|AVRC|ACNIS|IGFIP)(?:-[A-Z0-9]+)+\b|\b(?:IEAN|PEXT|PRPPS|ACNISVR)\b/g;
  var RE_SO_IND = /^(?:(?:PREC|PREM|PVIN|PADM|PRES|PEMP|PSE|PSC|PDT|IREC|IREM|IVIN|ISE|AEXTV|AEXT|AVRC|ACNIS|IGFIP)(?:-[A-Z0-9]+)+|IEAN|PEXT|PRPPS|ACNISVR)(?:[\s,]+(?:(?:PREC|PREM|PVIN|PADM|PRES|PEMP|PSE|PSC|PDT|IREC|IREM|IVIN|ISE|AEXTV|AEXT|AVRC|ACNIS|IGFIP)(?:-[A-Z0-9]+)+|IEAN|PEXT|PRPPS|ACNISVR))*$/;
  var RE_DATA = /\b\d{2}\/\d{2}\/\d{4}\b/g;
  var RE_VALOR = /(?:^|[^\d.,])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/;
  var NIT = '(?:\\d{1,3}(?:\\.\\d{3}){2,3}-\\d|\\d{3}\\.\\d{5}\\.\\d{2}-\\d)';
  var RE_CAB = new RegExp('^(\\d{1,3})\\s+' + NIT + '(?:\\s+(.*))?$');
  var RE_FIM = /Sal[áa]rios\s+de\s+Contribui[çc][ãa]o\s+Consolidados|Legenda\s+de\s+Indicadores/i;
  var RE_COLUNAS = /^(Seq\.|Matr[íi]cula|Trabalhador\b|Compet[êe]ncia\s+Remunera|Dt\.|Data\s+In[íi]cio|Compet\.|NIT\b)/i;
  var RE_TIPO = /\b(Empregado\s+Dom[ée]stico|Empregado|Contribuinte\s+Individual|Trabalhador\s+Avulso|Facultativo|Segurado\s+Especial|Servidor\s+P[úu]blico|Agente\s+P[úu]blico|Contribuinte\s+em\s+Dobro|Dom[ée]stico|Benefici[áa]rio)\b/i;
  var RE_CODIGO = /^[\d.\/-]{6,}$/;
  var RE_CONTINUACAO = /^[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9 .,&'\/()\-]*$/;
  var PALAVRAS = [
    [/sem\s+informa[çc][aã]o/i, 'Registro marcado como "sem informação"'],
    [/n[ãa]o\s+confirmad/i, 'Registro marcado como não confirmado']
  ];

  // Extrato fictício, no formato do Portal CNIS. Vínculos fora de ordem de propósito.
  var EXEMPLO = [
    'CNIS - Cadastro Nacional de Informações Sociais',
    'Extrato Previdenciário - Portal CNIS (EXEMPLO FICTÍCIO)',
    'Identificação do Filiado',
    'Nit: 1.234.567.890-1 CPF: 000.000.000-00 Nome: PESSOA DE EXEMPLO',
    'Data de Nascimento: 10/05/1970 Nome da Mãe: MÃE DE EXEMPLO',
    'Relações Previdenciárias',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '1 1.234.567.890-1 12.345.678/0001-90 MERCADO EXEMPLO LTDA Empregado 01/04/1994 31/12/1994',
    'Indicadores:',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '07/1994 120,00 08/1994 120,00 09/1994 120,00',
    '10/1994 120,00 11/1994 120,00 12/1994 120,00',
    'O INSS poderá rever a qualquer tempo as informações constantes deste extrato.',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '2 1.234.567.890-1 11.222.333/0001-44 SERVIÇOS ALFA LTDA AB1234567 Empregado 01/03/2010 31/08/2010',
    'FILIAL SUL',
    'Indicadores:',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '03/2010 1.000,00 04/2010 1.000,00 06/2010 1.000,00 PREC-MENOR-MIN',
    '07/2010 1.000,00 08/2010 1.000,00',
    'Remunerações Décimo Terceiro',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '08/2010 500,00',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '3 1.234.567.890-1 98.765.432/0001-10 OFICINA MODELO ME Empregado 02/01/2000 30/06/2001',
    'Indicadores:',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '01/2000 400,00 02/2000 400,00 03/2000 0,00',
    '04/2000 400,00 05/2000 400,00 06/2000 400,00 PREM-EXT',
    '06/2000 50,00 07/2000 400,00 09/2000 400,00',
    '10/2000 400,00 11/2000 400,00 12/2000 400,00',
    '01/2001 410,00 02/2001 410,00 03/2001 410,00',
    '04/2001 410,00 05/2001 410,00 06/2001 410,00',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '4 1.234.567.890-1 55.666.777/0001-88 COMERCIAL BETA S.A. Empregado 01/08/2010 31/10/2010',
    'Indicadores:',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '08/2010 600,00 09/2010 600,00 10/2010 600,00',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '5 1.234.567.890-1 33.444.555/0001-66 LOJA GAMA LTDA Empregado 01/02/2020 15/05/2020',
    'Indicadores: PEXT',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '02/2020 1.045,00 03/2020 1.045,00',
    'Seq. NIT NB Origem do Vínculo Espécie Data Início Data Fim',
    '6 1.234.567.890-1 1234567890 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO 15/04/2020 20/05/2020',
    'Seq. NIT NB Origem do Vínculo Espécie Data Início Data Fim',
    '7 1.234.567.890-1 0987654321 Benefício 31 - AUXILIO DOENCA PREVIDENCIARIO',
    'Seq. NIT Origem do Vínculo Tipo Filiado Vínculo Data Início Data Fim',
    '8 1.234.567.890-1 SEGURO DESEMPREGO/SINE Possuidor de evento previdenciário 01/11/2012 31/03/2013',
    'Indicadores: AVRC-DEF',
    'Matrícula do',
    'Seq. NIT Código Emp. Origem do Vínculo Trabalhador Tipo Filiado Dt. Início Dt. Fim',
    '9 1.234.567.890-1 24.162.618 EXEMPLO TECNOLOGIA LTDA Empregado 01/06/2023',
    'Indicadores:',
    'Remunerações',
    'Competência Remuneração Indicadores Competência Remuneração Indicadores Competência Remuneração',
    '06/2023 2.000,00 07/2023 2.000,00 08/2023 2.000,00',
    'Salários de Contribuição Consolidados por Ano Civil',
    'Ano Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez',
    '2023 2.000,00 2.000,00 2.000,00',
    'Legenda de Indicadores',
    'Indicador Descrição',
    'AVRC-DEF Acerto confirmado pelo INSS'
  ].join('\n');

  // ---------- Utilidades de data e mês ----------

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ordemDe(y, m, d) { return Date.UTC(y, m - 1, d) / 86400000; }
  function mesDe(y, m) { return y * 12 + m - 1; }
  function rotuloMes(k) { return pad((k % 12) + 1) + '/' + Math.floor(k / 12); }
  function rotuloData(d) { return pad(d.d) + '/' + pad(d.m) + '/' + d.y; }
  function ultimoDiaDoMes(k) { return ordemDe(Math.floor(k / 12), (k % 12) + 2, 0); }
  function dataDeOrd(ord) {
    var t = new Date(ord * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), ord: ord };
  }

  // "dd/mm/aaaa" -> { y, m, d, ord } ou null se a data não existe.
  function dataDe(s) {
    var p = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!p) return null;
    var d = +p[1], m = +p[2], y = +p[3];
    var t = new Date(ordemDe(y, m, d) * 86400000);
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d, ord: ordemDe(y, m, d) };
  }

  // "1.234,56" -> 1234.56
  function valorDe(s) { return parseFloat(s.replace(/\./g, '').replace(',', '.')); }

  // Lista de meses -> faixas contínuas: [{ de: '01/2010', ate: '03/2010', qtd: 3 }]
  function agrupar(meses) {
    var faixas = [];
    meses.slice().sort(function (a, b) { return a - b; }).forEach(function (k) {
      var u = faixas[faixas.length - 1];
      if (u && k === u.fim + 1) { u.fim = k; u.qtd++; } else if (!u || k !== u.fim) { faixas.push({ ini: k, fim: k, qtd: 1 }); }
    });
    return faixas.map(function (f) { return { de: rotuloMes(f.ini), ate: rotuloMes(f.fim), qtd: f.qtd }; });
  }

  function textoFaixa(x) { return x.de === x.ate ? x.de : x.de + ' a ' + x.ate; }

  function textoFaixas(meses, limite) {
    var f = agrupar(meses);
    var partes = f.slice(0, limite || 6).map(textoFaixa);
    if (f.length > partes.length) partes.push('e mais ' + (f.length - partes.length) + ' faixa(s)');
    return partes.join(', ');
  }

  // Salário mínimo vigente na competência (índice de mês); null antes de 07/1994.
  function minimoDe(k) {
    var v = null;
    MINIMOS.forEach(function (m) { if (mesDe(m[0], m[1]) <= k) v = m[2]; });
    return v;
  }

  // 1234.5 -> "1.234,50"
  function formatarValor(n) {
    var p = (Math.round(n * 100) / 100).toFixed(2).split('.');
    return p[0].replace(/\B(?=(\d{3})+$)/g, '.') + ',' + p[1];
  }

  // Dias -> "1 ano, 2 meses e 3 dias" sem as partes zeradas (365 dias por ano, 30 por mês).
  function duracaoCurta(dias) {
    var a = Math.floor(dias / 365), r = dias % 365, m = Math.min(11, Math.floor(r / 30)), d = r - m * 30, p = [];
    if (a) p.push(a + (a === 1 ? ' ano' : ' anos'));
    if (m) p.push(m + (m === 1 ? ' mês' : ' meses'));
    if (d || !p.length) p.push(d + (d === 1 ? ' dia' : ' dias'));
    return p.length > 1 ? p.slice(0, -1).join(', ') + ' e ' + p[p.length - 1] : p[0];
  }

  // Dias -> "1 ano, 1 mês e 3 dias" (365 dias por ano, 30 por mês).
  function formatarDuracao(dias) {
    var a = Math.floor(dias / 365), r = dias % 365, m = Math.min(11, Math.floor(r / 30)), d = r - m * 30;
    return a + (a === 1 ? ' ano, ' : ' anos, ') + m + (m === 1 ? ' mês e ' : ' meses e ') + d + (d === 1 ? ' dia' : ' dias');
  }

  // ---------- Leitura do texto ----------

  function indicadoresDe(trecho) { return trecho.match(RE_IND) || []; }

  // Pares "competência valor [indicadores]" de uma linha, até 3 por linha no CNIS.
  var RE_VALORES = /(?:^|[^\d.,])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g;
  function lerGrade(linha, contrib) {
    var re = /(^|[^\d\/])(0[1-9]|1[0-2])\/(\d{4})(?![\d\/])/g;
    var achados = [], m;
    while ((m = re.exec(linha))) {
      var ini = m.index + m[1].length;
      achados.push({ ini: ini, fim: ini + 7, mes: mesDe(+m[3], +m[2]) });
      re.lastIndex = ini + 7;
    }
    var saida = [];
    achados.forEach(function (a, i) {
      var seg = linha.slice(a.fim, i + 1 < achados.length ? achados[i + 1].ini : linha.length);
      var v = RE_VALOR.exec(seg);
      if (contrib) {
        // Contribuições: competência, data de pagamento, contribuição e salário de contribuição (o último valor).
        var todos = [], mv;
        RE_VALORES.lastIndex = 0;
        while ((mv = RE_VALORES.exec(seg))) todos.push(mv[1]);
        v = todos.length ? [null, todos[todos.length - 1]] : null;
      }
      if (!v && a.ini !== 0) return;
      saida.push({ mes: a.mes, valor: v ? valorDe(v[1]) : null, indicadores: indicadoresDe(seg) });
    });
    return saida;
  }

  function limparNome(antes) {
    var t = antes.split(/\s+/).filter(Boolean);
    if (t.length && RE_CODIGO.test(t[0])) t.shift();
    // Matrícula do trabalhador: última palavra com dígitos, colada ao tipo de filiado.
    if (t.length > 1 && (/^\d+$/.test(t[t.length - 1]) || (/\d/.test(t[t.length - 1]) && t[t.length - 1].length >= 6))) t.pop();
    return t.join(' ');
  }

  function novoRegistro(tipoRegistro, seq, resto) {
    var datas = resto.match(RE_DATA) || [];
    var r = {
      tipoRegistro: tipoRegistro, seq: seq, nome: '', tipo: '', nb: '',
      datasBrutas: datas,
      inicio: datas[0] ? dataDe(datas[0]) : null,
      fim: datas[1] ? dataDe(datas[1]) : null,
      indicadores: [], remuneracoes: [], decimos: [], continuacoes: 0
    };
    var idx = resto.search(RE_DATA);
    var antes = (idx >= 0 ? resto.slice(0, idx) : resto).trim();

    var depois = '';
    if (datas.length) {
      var ultimaData = resto.lastIndexOf(datas[datas.length - 1]);
      depois = resto.slice(ultimaData + 10);
    }
    var mu = /(?:^|\s)(0[1-9]|1[0-2])\/(\d{4})(?=\s|$)/.exec(depois);
    if (mu) r.ultRemun = mesDe(+mu[2], +mu[1]);
    if (tipoRegistro === 'beneficio') {
      var nb = /\b(\d{10}|\d{3}\.\d{3}\.\d{3}-\d)\s+(?:Benef[ií]cio\b)?\s*(.*)$/i.exec(antes);
      if (nb) { r.nb = nb[1]; r.nome = nb[2].replace(/\bN[ãa]o\s+Informado\b/i, '').trim(); } else { r.nome = antes.replace(/\bNB\b/i, '').trim(); }
      r.situacao = depois.replace(RE_IND, '').replace(/\s+/g, ' ').trim();
    } else if (tipoRegistro === 'evento') {
      r.nome = antes.split(/Possuidor/i)[0].trim() || 'Evento previdenciário';
      r.tipo = 'evento previdenciário';
    } else {
      var t = RE_TIPO.exec(antes);
      if (t) { r.tipo = t[1]; antes = antes.slice(0, t.index); }
      r.nome = limparNome(antes) || 'Vínculo ' + seq;
    }
    r.indicadores = indicadoresDe(resto);
    return r;
  }

  function interpretar(texto) {
    var linhas = String(texto || '').split(/\r?\n/);
    var vinculos = [], beneficios = [], eventos = [], orfas = [], orfas13 = [], notas = [];
    var atual = null, modo = null, aceitaNome = false;

    linhas.forEach(function (bruta) {
      var linha = bruta.replace(/\s+/g, ' ').trim();
      if (!linha) return;

      if (RE_FIM.test(linha)) { modo = 'fim'; atual = null; aceitaNome = false; return; }

      var h = RE_CAB.exec(linha);
      if (h) {
        var resto = h[2] || '';
        var tipoReg = /\b(?:\d{10}|\d{3}\.\d{3}\.\d{3}-\d)\s+Benef[ií]cio\b|\bNB\b|^(?:\d{10}|\d{3}\.\d{3}\.\d{3}-\d)\s+\d{2}\s*-\s/i.test(resto) ? 'beneficio'
          : /evento\s+previdenci/i.test(resto) ? 'evento' : 'vinculo';
        atual = novoRegistro(tipoReg, +h[1], resto);
        (tipoReg === 'beneficio' ? beneficios : tipoReg === 'evento' ? eventos : vinculos).push(atual);
        modo = 'rem';
        aceitaNome = tipoReg === 'vinculo';
        return;
      }
      if (modo === 'fim') return;

      if (/^Indicadores\b/i.test(linha)) {
        if (atual) atual.indicadores = atual.indicadores.concat(indicadoresDe(linha));
        aceitaNome = false;
        return;
      }
      if (/^Remunera[çc][õo]es\s+D[ée]cimo\s+Terceiro/i.test(linha)) { modo = '13'; aceitaNome = false; return; }
      if (/^Remunera[çc][õo]es\s*$/i.test(linha)) { modo = 'rem'; aceitaNome = false; return; }
      if (/^Contribui[çc][õo]es\s*$/i.test(linha)) { modo = 'contrib'; aceitaNome = false; return; }
      if (RE_COLUNAS.test(linha)) return;
      if (RE_SO_IND.test(linha)) {
        if (atual) atual.indicadores = atual.indicadores.concat(indicadoresDe(linha));
        return;
      }

      var grade = lerGrade(linha, modo === 'contrib');
      if (grade.length) {
        aceitaNome = false;
        grade.forEach(function (g) {
          if (atual) (modo === '13' ? atual.decimos : atual.remuneracoes).push(g);
          else (modo === '13' ? orfas13 : orfas).push(g);
        });
        return;
      }

      PALAVRAS.forEach(function (p) {
        if (p[0].test(linha)) notas.push({ sev: 'atencao', ref: atual ? rotuloDe(atual) : '', msg: p[1] });
      });

      // Nome do empregador que passou para a linha de baixo.
      if (aceitaNome && atual && atual.continuacoes < 2 && linha.length <= 60 && linha !== 'INSS' && RE_CONTINUACAO.test(linha) && /[A-ZÀ-Ý]{2}/.test(linha)) {
        atual.nome += ' ' + linha;
        atual.continuacoes++;
      }
    });

    return { vinculos: vinculos, beneficios: beneficios, eventos: eventos, orfas: orfas, orfas13: orfas13, notas: notas };
  }

  function rangeMeses(a, b) { var l = []; for (var k = a; k <= b; k++) l.push(k); return l; }

  function rotuloDe(r) { return 'Seq. ' + r.seq + ' - ' + (r.nome || 'sem nome').slice(0, 60); }

  // ---------- Análise ----------

  // hoje: { y, m, d }. Devolve resumo, vínculos (em ordem de início), faltantes, pendências,
  // benefícios, eventos e mapa de competências.
  function analisar(texto, hoje) {
    var lido = interpretar(texto);
    var pend = lido.notas.slice();
    var hojeOrd = ordemDe(hoje.y, hoje.m, hoje.d);
    var hojeMes = mesDe(hoje.y, hoje.m);
    var itens = [], validos = [], faltantes = [];
    var ok = {}, falta = {}, pre94 = {}, valores = {};
    var totalRem = lido.orfas.length;
    lido.vinculos.forEach(function (v) { totalRem += v.remuneracoes.length; });
    var semLeitura = lido.vinculos.length > 0 && totalRem === 0;

    function nova(sev, ref, msg) { pend.push({ sev: sev, ref: ref, msg: msg, n: pend.length }); }
    pend.forEach(function (p, i) { p.n = i; });

    if (semLeitura) {
      nova('atencao', '', 'O documento não traz remunerações nem recolhimentos (é o resumo "Relações Previdenciárias", ou o PDF tem outro layout). O tempo e as pendências foram analisados pelas datas e indicadores; os salários faltantes não foram avaliados. Para avaliá-los, use o Extrato Previdenciário completo.');
    }
    if (lido.orfas.length) {
      nova('atencao', '', lido.orfas.length + ' remuneração(ões) sem vínculo identificado acima delas (a partir de ' + rotuloMes(lido.orfas[0].mes) + ').');
      lido.orfas.forEach(function (r) { if (r.valor > 0) ok[r.mes] = true; });
    }

    // Benefícios e eventos, em ordem de início.
    function porInicio(a, b) {
      var x = a.inicio ? a.inicio.ord : Infinity, y = b.inicio ? b.inicio.ord : Infinity;
      return x - y || a.seq - b.seq;
    }
    var periodosBen = [];
    var bens = lido.beneficios.slice().sort(porInicio).map(function (b) {
      var semDatas = b.datasBrutas.length === 0;
      var indef = /indeferid/i.test(b.nome) || semDatas;
      if (b.inicio) {
        var fimBen = b.fim || dataDeOrd(hojeOrd);
        periodosBen.push({ nb: b.nb, de: mesDe(b.inicio.y, b.inicio.m), ate: mesDe(fimBen.y, fimBen.m) });
      }
      b.indicadores.forEach(function (c) { avisoIndicador(rotuloBen(b), c, []); });
      return {
        tipoRegistro: 'beneficio', seq: b.seq, nb: b.nb, texto: b.nome, inicio: b.inicio, fim: b.fim,
        nota: indef ? 'Benefício indeferido.' : semDatas ? 'Sem datas de início e fim: sem período informado.' : 'Fora da contagem desta análise.' + (b.situacao ? ' Situação: ' + b.situacao + '.' : ''),
        indeferido: indef
      };
    });
    var evs = lido.eventos.slice().sort(porInicio).map(function (e) {
      e.indicadores.forEach(function (c) { avisoIndicador('Seq. ' + e.seq + ' - ' + e.nome, c, []); });
      return {
        tipoRegistro: 'evento', seq: e.seq, nb: '', texto: e.nome, inicio: e.inicio, fim: e.fim,
        nota: 'Evento previdenciário: fora da contagem desta análise.', indeferido: false
      };
    });
    function rotuloBen(b) { return 'Seq. ' + b.seq + ' - benefício' + (b.nb ? ' ' + b.nb : ''); }

    function avisoIndicador(ref, c, meses) {
      var d = INDICADORES[c];
      var sev = d ? d[0] : 'info';
      var desc = d ? d[1] : 'indicador do INSS, confira o significado na legenda do próprio extrato';
      var onde = meses.length ? ' em ' + meses.length + ' competência(s): ' + textoFaixas(meses, 4) : '';
      nova(sev, ref, c + ': ' + desc + onde + '.');
    }

    // Vínculos em ordem cronológica de início (empate: ordem do extrato; datas inválidas no fim).
    var ordenados = lido.vinculos.slice().sort(porInicio);

    ordenados.forEach(function (v) {
      var rotulo = rotuloDe(v);
      var item = {
        seq: v.seq, nome: v.nome, tipo: v.tipo, rotulo: rotulo, inicio: v.inicio, fim: v.fim, emAberto: false, valido: false,
        dias: 0, remuneracoes: v.remuneracoes.length, decimos: v.decimos.length, comRemuneracao: 0, faltantes: 0, anteriores94: 0
      };
      itens.push(item);

      if (!v.inicio) { nova('erro', rotulo, 'Data de início inválida ou não reconhecida.'); return; }
      if (v.datasBrutas.length > 1 && !v.fim) { nova('erro', rotulo, 'Data de fim inválida.'); return; }
      if (v.inicio.ord > hojeOrd || v.inicio.y < 1900) { nova('erro', rotulo, 'Data de início fora do intervalo esperado (' + rotuloData(v.inicio) + ').'); return; }
      if (v.fim && v.fim.ord < v.inicio.ord) { nova('erro', rotulo, 'Data de fim anterior à data de início.'); return; }

      var mIni = mesDe(v.inicio.y, v.inicio.m);
      var somas = {}, vistos = {}, repetidas = [], zeradas = [], semValor = [], indic = {};
      v.indicadores.forEach(function (c) { indic[c] = indic[c] || []; });
      v.remuneracoes.forEach(function (r) {
        if (vistos[r.mes]) repetidas.push(r.mes);
        vistos[r.mes] = true;
        if (r.valor === null) { semValor.push(r.mes); } else { somas[r.mes] = (somas[r.mes] || 0) + r.valor; }
        r.indicadores.forEach(function (c) { (indic[c] = indic[c] || []).push(r.mes); });
      });
      var presentes = {};
      Object.keys(somas).forEach(function (k) {
        if (somas[k] > 0) presentes[k] = true; else zeradas.push(+k);
      });
      Object.keys(presentes).forEach(function (k) {
        ok[k] = true;
        (valores[k] = valores[k] || []).push({ seq: v.seq, nome: v.nome, tipo: v.tipo, valor: Math.round(somas[k] * 100) / 100 });
      });
      item.comRemuneracao = Object.keys(presentes).length;

      // Fim contado. Sem data de fim, vale até o fim do mês da última remuneração (nunca depois de hoje).
      var fim = v.fim;
      if (!fim) {
        item.emAberto = true;
        var ultima = -1;
        Object.keys(presentes).forEach(function (k) { if (+k > ultima && +k <= hojeMes) ultima = +k; });
        if (ultima < 0 && semLeitura && v.ultRemun !== undefined && v.ultRemun <= hojeMes) ultima = v.ultRemun;
        if (ultima < 0) {
          nova('atencao', rotulo, 'Vínculo sem data de fim e sem remuneração: não foi contado.');
          return;
        }
        fim = dataDeOrd(Math.max(v.inicio.ord, Math.min(hojeOrd, ultimoDiaDoMes(ultima))));
        nova('info', rotulo, 'Vínculo sem data de fim: contado até ' + rotuloData(fim) + ' (fim do mês da última remuneração, ' + rotuloMes(ultima) + '). Confira se ele continua ativo.');
      }
      var mFim = mesDe(fim.y, fim.m);

      // No resumo (sem remunerações), a coluna "Últ. Remun." mostra até onde o vínculo tem remuneração.
      if (semLeitura && v.fim && v.ultRemun !== undefined) {
        var mFimInf = mesDe(v.fim.y, v.fim.m);
        if (mFimInf - v.ultRemun >= 1) {
          nova('atencao', rotulo, 'Última remuneração informada em ' + rotuloMes(v.ultRemun) + ', mas o vínculo vai até ' + rotuloData(v.fim) + ': ' + textoFaixas(rangeMeses(v.ultRemun + 1, mFimInf), 4) + ' pode(m) estar sem remuneração. Confira no Extrato completo.');
        }
      }

      item.valido = true;
      item.fimContado = fim;
      item.inicioOrd = v.inicio.ord;
      item.fimOrd = fim.ord;
      item.dias = fim.ord - v.inicio.ord + 1;
      validos.push(item);

      var fora = [];
      Object.keys(vistos).forEach(function (k) { if (+k < mIni || +k > mFim) fora.push(+k); });

      if (repetidas.length) nova('info', rotulo, 'Competência com mais de uma remuneração (valores somados): ' + textoFaixas(repetidas, 6) + '.');
      if (fora.length) nova('atencao', rotulo, 'Remuneração fora do período do vínculo: ' + textoFaixas(fora, 6) + '.');
      if (semValor.length) nova('atencao', rotulo, 'Competência sem valor lido: ' + textoFaixas(semValor, 6) + '.');
      Object.keys(indic).forEach(function (c) { avisoIndicador(rotulo, c, indic[c]); });

      // Valor muito diferente dos vizinhos. Os meses de início e fim do vínculo ficam de fora (podem ser proporcionais).
      var mesesVal = Object.keys(somas).map(Number).filter(function (k) { return somas[k] > 0 && k > mIni && k < mFim; }).sort(function (a, b) { return a - b; });
      var dif = [];
      mesesVal.forEach(function (k, i) {
        var viz = mesesVal.slice(Math.max(0, i - 3), i).concat(mesesVal.slice(i + 1, i + 4)).map(function (x) { return somas[x]; }).sort(function (a, b) { return a - b; });
        if (viz.length < 4) return;
        var med = (viz[(viz.length - 1) >> 1] + viz[viz.length >> 1]) / 2;
        if (somas[k] >= 2 * med || somas[k] <= 0.5 * med) dif.push({ k: k, v: somas[k], med: med });
      });
      if (dif.length) {
        nova('info', rotulo, 'Valor muito diferente dos meses vizinhos (pode ser erro de lançamento ou verba eventual): ' +
          dif.slice(0, 5).map(function (x) { return rotuloMes(x.k) + ' (' + formatarValor(x.v) + ' contra cerca de ' + formatarValor(x.med) + ')'; }).join('; ') +
          (dif.length > 5 ? ' e mais ' + (dif.length - 5) : '') + '.');
      }

      if (semLeitura) return;

      // Salários faltantes: meses do vínculo sem remuneração (ou com valor zero).
      var sem = [], ant = [];
      for (var k = mIni; k <= mFim; k++) {
        if (presentes[k]) continue;
        if (k < INICIO_PBC) { ant.push(k); pre94[k] = true; } else { sem.push(k); falta[k] = true; }
      }
      item.faltantes = sem.length;
      item.anteriores94 = ant.length;
      item.mesesFaltantes = sem;
      item.faixasFaltantes = agrupar(sem);
      item.zeradas = zeradas.filter(function (z) { return z >= INICIO_PBC && z >= mIni && z <= mFim; }).length;

      if (v.remuneracoes.length === 0 && sem.length) nova('atencao', rotulo, 'Vínculo sem nenhuma remuneração listada.');
    });

    // Faltantes: coincidência com benefício e com remuneração de outro vínculo.
    itens.forEach(function (item) {
      if (!item.mesesFaltantes || !item.mesesFaltantes.length) return;
      var emBen = item.mesesFaltantes.filter(function (k) {
        return periodosBen.some(function (p) { return k >= p.de && k <= p.ate; });
      });
      var outro = item.mesesFaltantes.filter(function (k) { return ok[k]; });
      item.emBeneficio = emBen.length;
      item.comOutroVinculo = outro.length;
      faltantes.push({
        seq: item.seq, rotulo: item.rotulo, meses: item.faltantes, faixas: item.faixasFaltantes,
        zeradas: item.zeradas, listadas: item.remuneracoes, emBeneficio: emBen.length, comOutroVinculo: outro.length
      });
    });

    // Concomitância: uma nota por vínculo, listando os que começam depois e se sobrepõem.
    validos.forEach(function (a, i) {
      var lista = [], dup = [];
      for (var j = i + 1; j < validos.length; j++) {
        var b = validos[j];
        var s = Math.max(a.inicioOrd, b.inicioOrd), e = Math.min(a.fimOrd, b.fimOrd);
        if (s <= e) {
          lista.push('Seq. ' + b.seq + ' (' + (e - s + 1) + ' dias)');
          if (a.nome && a.nome === b.nome) dup.push('Seq. ' + b.seq);
        }
      }
      if (dup.length) nova('atencao', a.rotulo, 'Mesmo empregador em vínculos concomitantes (' + dup.join(', ') + '): possível duplicidade de registro.');
      if (lista.length) nova('info', a.rotulo, 'Período concomitante com ' + lista.join(', ') + '. O tempo é contado uma vez.');
    });

    // Tempo contado: união dos períodos, sem somar duas vezes o que se sobrepõe.
    var segs = validos.map(function (v) { return [v.inicioOrd, v.fimOrd]; }).sort(function (x, y) { return x[0] - y[0]; });
    var diasUnicos = 0, cI = null, cF = null;
    segs.forEach(function (sg) {
      if (cI === null) { cI = sg[0]; cF = sg[1]; }
      else if (sg[0] <= cF + 1) { cF = Math.max(cF, sg[1]); }
      else { diasUnicos += cF - cI + 1; cI = sg[0]; cF = sg[1]; }
    });
    if (cI !== null) diasUnicos += cF - cI + 1;
    var diasBrutos = validos.reduce(function (t, v) { return t + v.dias; }, 0);

    // ---- Salário mínimo, carência e lacunas ----
    var tipoPorSeq = {};
    itens.forEach(function (it) { tipoPorSeq[it.seq] = it.tipo || ''; });
    var totais = {}, extremos = {};
    Object.keys(valores).forEach(function (k) {
      totais[k] = Math.round(valores[k].reduce(function (t, x) { return t + x.valor; }, 0) * 100) / 100;
    });
    validos.forEach(function (v) {
      extremos[mesDe(v.inicio.y, v.inicio.m)] = true;
      extremos[mesDe(v.fimContado.y, v.fimContado.m)] = true;
    });
    var abaixo = [], validas = 0;
    Object.keys(totais).forEach(function (ks) {
      var k = +ks, min = minimoDe(k);
      if (min === null) return;
      if (totais[k] + 0.004 >= min) { validas++; return; }
      var ci = valores[k].every(function (x) { return /individual|facultativ/i.test(tipoPorSeq[x.seq] || ''); });
      abaixo.push({
        mes: k, total: totais[k], minimo: min, seqs: valores[k].map(function (x) { return x.seq; }),
        ci: ci, proporcional: !ci && !!extremos[k], posEC103: k >= EC103
      });
    });
    abaixo.sort(function (x, y) { return x.mes - y.mes; });
    function mesesDe(f) { return abaixo.filter(f).map(function (a) { return a.mes; }); }
    var gCI = mesesDe(function (a) { return a.ci; });
    var gPos = mesesDe(function (a) { return !a.ci && !a.proporcional && a.posEC103; });
    var gAnt = mesesDe(function (a) { return !a.ci && !a.proporcional && !a.posEC103; });
    var gProp = mesesDe(function (a) { return a.proporcional; });
    if (gCI.length) nova('atencao', '', 'Contribuinte individual ou facultativo com salário de contribuição abaixo do salário mínimo em ' + gCI.length + ' competência(s): ' + textoFaixas(gCI, 4) + '. Em regra a competência não conta sem complementação até o mínimo.');
    if (gPos.length) nova('atencao', '', 'Valor total da competência abaixo do salário mínimo em ' + gPos.length + ' competência(s) a partir da EC 103/2019: ' + textoFaixas(gPos, 4) + '. Pode ser complementada, utilizada ou agrupada com outras competências.');
    if (gAnt.length) nova('info', '', 'Valor total da competência abaixo do salário mínimo da época em ' + gAnt.length + ' competência(s) antes da EC 103/2019: ' + textoFaixas(gAnt, 4) + '. O efeito depende da categoria do segurado; confira.');
    if (gProp.length) nova('info', '', 'Valor abaixo do mínimo em mês de início ou fim de vínculo (' + gProp.length + '): ' + textoFaixas(gProp, 4) + '. Pode ser proporcional aos dias trabalhados.');

    var carencia = null;
    if (!semLeitura) {
      var antes94 = {};
      validos.forEach(function (v) {
        var a = mesDe(v.inicio.y, v.inicio.m), b = Math.min(mesDe(v.fimContado.y, v.fimContado.m), INICIO_PBC - 1);
        for (var k = a; k <= b; k++) antes94[k] = true;
      });
      var todas = Object.keys(ok).length;
      carencia = {
        validas: validas, todas: todas, mesesAntes94: Object.keys(antes94).length,
        linhas: CARENCIAS.map(function (c) {
          return { nome: c[0], exigido: c[1], faltamValidas: Math.max(0, c[1] - validas), faltamTodas: Math.max(0, c[1] - todas) };
        })
      };
    }

    // Lacunas: períodos sem vínculo, benefício nem evento, entre o primeiro registro e hoje.
    var cob = validos.map(function (v) { return { ini: v.inicioOrd, fim: v.fimOrd, seq: v.seq }; });
    lido.beneficios.concat(lido.eventos).forEach(function (b) {
      if (!b.inicio) return;
      var f = b.fim ? Math.max(b.fim.ord, b.inicio.ord) : (b.tipoRegistro === 'beneficio' ? Math.max(hojeOrd, b.inicio.ord) : b.inicio.ord);
      cob.push({ ini: b.inicio.ord, fim: f, seq: b.seq });
    });
    cob.sort(function (x, y) { return x.ini - y.ini; });
    var lacunas = [];
    if (cob.length) {
      var cur = cob[0].fim, curSeq = cob[0].seq;
      cob.slice(1).forEach(function (c) {
        if (c.ini - 1 - cur >= LACUNA_MINIMA) lacunas.push({ ini: dataDeOrd(cur + 1), fim: dataDeOrd(c.ini - 1), dias: c.ini - 1 - cur, antes: curSeq, depois: c.seq, atual: false });
        if (c.fim > cur) { cur = c.fim; curSeq = c.seq; }
      });
      if (hojeOrd - cur >= LACUNA_MINIMA) lacunas.push({ ini: dataDeOrd(cur + 1), fim: dataDeOrd(hojeOrd), dias: hojeOrd - cur, antes: curSeq, depois: null, atual: true });
    }
    var longas = lacunas.filter(function (g) { return g.dias > 365; }).length;
    if (longas) nova('info', '', longas + ' período(s) com mais de 12 meses sem vínculo nem benefício (veja "Lacunas entre vínculos"). Pode haver perda da qualidade de segurado, salvo prorrogação do período de graça (art. 15 da Lei 8.213/91).');

    // Mapa de competências
    var mapa = {};
    var todos = {};
    [ok, falta, pre94].forEach(function (o) { Object.keys(o).forEach(function (k) { todos[k] = true; }); });
    Object.keys(todos).forEach(function (k) {
      if (ok[k]) mapa[k] = falta[k] ? 'parcial' : 'ok';
      else if (falta[k]) mapa[k] = 'falta';
      else mapa[k] = 'pre94';
    });

    var mesesSem = faltantes.reduce(function (t, f) { return t + f.meses; }, 0);
    var mesesAnt = itens.reduce(function (t, v) { return t + v.anteriores94; }, 0);
    var rank = { erro: 0, atencao: 1, info: 2 };
    pend.sort(function (x, y) { return rank[x.sev] - rank[y.sev] || x.n - y.n; });
    var cont = { erro: 0, atencao: 0, info: 0 };
    pend.forEach(function (p) { cont[p.sev]++; });

    return {
      vinculos: itens,
      faltantes: faltantes,
      pendencias: pend,
      beneficios: bens,
      eventos: evs,
      mapa: mapa,
      valores: valores,
      abaixoMinimo: abaixo,
      carencia: carencia,
      lacunas: lacunas,
      resumo: {
        totalVinculos: itens.length,
        validos: validos.length,
        competencias: Object.keys(ok).length,
        diasUnicos: diasUnicos,
        diasBrutos: diasBrutos,
        duracao: formatarDuracao(diasUnicos),
        mesesSemRemuneracao: mesesSem,
        mesesAnteriores94: mesesAnt,
        erros: cont.erro,
        atencoes: cont.atencao,
        infos: cont.info,
        beneficios: bens.length,
        eventos: evs.length,
        abaixoMinimo: abaixo.length,
        lacunasLongas: longas,
        semRemuneracoes: semLeitura
      }
    };
  }

  function fimDoItem(v) {
    if (v.emAberto) return v.valido ? 'sem data de fim (contado até ' + rotuloData(v.fimContado) + ')' : 'sem data de fim';
    return v.fim ? rotuloData(v.fim) : '-';
  }

  function resumoEmTexto(r) {
    var s = r.resumo, l = [];
    l.push('Análise do CNIS (pontos de atenção para conferência, não é parecer)');
    l.push('Vínculos: ' + s.totalVinculos + ' | Tempo contado: ' + s.duracao + ' (' + s.diasUnicos + ' dias)');
    l.push('Competências com remuneração: ' + s.competencias + ' | Meses sem remuneração: ' + s.mesesSemRemuneracao);
    if (r.vinculos.length) {
      l.push('', 'Vínculos em ordem de início:');
      r.vinculos.forEach(function (v) {
        l.push('- ' + v.rotulo + ': ' + (v.inicio ? rotuloData(v.inicio) : '?') + ' a ' + fimDoItem(v) +
          (v.valido ? ' | ' + v.dias + ' dias' : ' | não contado') + ' | ' + v.comRemuneracao + ' com remuneração | ' + v.faltantes + ' faltante(s)');
      });
    }
    if (r.faltantes.length) {
      l.push('', 'Salários faltantes:');
      r.faltantes.forEach(function (f) {
        var extra = [];
        if (f.emBeneficio) extra.push(f.emBeneficio + ' em período de benefício');
        if (f.comOutroVinculo) extra.push(f.comOutroVinculo + ' com remuneração em outro vínculo');
        l.push('- ' + f.rotulo + ': ' + f.meses + ' mês(es) - ' + f.faixas.map(textoFaixa).join(', ') + (extra.length ? ' (' + extra.join('; ') + ')' : ''));
      });
    }
    if (r.carencia) {
      l.push('', 'Carência: ' + r.carencia.validas + ' competência(s) com valor igual ou acima do mínimo; ' + r.carencia.todas + ' com qualquer remuneração.');
      r.carencia.linhas.forEach(function (c) { l.push('- ' + c.nome + ' (' + c.exigido + '): faltam ' + c.faltamValidas + ' (' + c.faltamTodas + ' contando todas)'); });
    }
    if (r.lacunas.length) {
      l.push('', 'Lacunas sem vínculo nem benefício:');
      r.lacunas.forEach(function (g) { l.push('- ' + rotuloData(g.ini) + ' a ' + rotuloData(g.fim) + ': ' + duracaoCurta(g.dias) + (g.atual ? ' (até hoje)' : '')); });
    }
    if (r.abaixoMinimo.length) l.push('', 'Competências abaixo do salário mínimo: ' + r.abaixoMinimo.length);
    if (r.pendencias.length) {
      l.push('', 'Pendências:');
      r.pendencias.forEach(function (p) { l.push('- [' + p.sev + '] ' + (p.ref ? p.ref + ': ' : '') + p.msg); });
    }
    return l.join('\n');
  }

  // ---------- Interface ----------

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function sec(titulo, dica) {
    var s = el('section', 'bloco');
    s.appendChild(el('h2', null, titulo));
    if (dica) s.appendChild(el('p', 'dica', dica));
    return s;
  }

  var ROTULO_MAPA = { ok: 'com remuneração', parcial: 'remuneração em um vínculo e faltando em outro', falta: 'sem remuneração', pre94: 'sem remuneração, anterior a 07/1994' };

  function desenharMapa(mapa, valores) {
    valores = valores || {};
    var ks = Object.keys(mapa).map(Number);
    if (!ks.length) return null;
    var ini = Math.floor(Math.min.apply(null, ks) / 12), fim = Math.floor(Math.max.apply(null, ks) / 12);
    var t = el('table', 'mapa mapa-valores');
    t.appendChild(el('caption', 'so-leitor', 'Mapa de competências por ano e mês'));
    var th = el('thead'), trh = el('tr');
    trh.appendChild(el('th', 'ano', ''));
    MESES.forEach(function (m) { trh.appendChild(el('th', null, m)); });
    th.appendChild(trh); t.appendChild(th);
    var tb = el('tbody');
    for (var y = ini; y <= fim; y++) {
      var tr = el('tr');
      tr.appendChild(el('th', 'ano', String(y)));
      for (var m = 0; m < 12; m++) {
        var k = y * 12 + m, est = mapa[k];
        var td = el('td', 'c-' + (est || 'vazio'));
        var vs = valores[k];
        td.title = pad(m + 1) + '/' + y + (est ? ': ' + ROTULO_MAPA[est] : '');
        if (vs && vs.length) {
          // Um valor por vínculo; o mesmo vínculo com várias remunerações na competência já vem somado.
          vs.forEach(function (x) { td.appendChild(el('span', 'valor', formatarValor(x.valor))); });
          td.title += ' - ' + vs.map(function (x) { return 'Seq. ' + x.seq + ' ' + x.nome + ': ' + formatarValor(x.valor); }).join('; ');
        } else if (est) {
          td.appendChild(el('span', 'so-leitor', ROTULO_MAPA[est]));
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    var box = el('div', 'mapa-box');
    box.appendChild(t);
    var leg = el('ul', 'legenda');
    [['ok', 'Com remuneração'], ['parcial', 'Falta em um dos vínculos'], ['falta', 'Sem remuneração'], ['pre94', 'Sem remuneração antes de 07/1994']].forEach(function (x) {
      var li = el('li'); li.appendChild(el('i', 'c-' + x[0])); li.appendChild(document.createTextNode(x[1])); leg.appendChild(li);
    });
    box.appendChild(leg);
    return box;
  }

  function tabela(cab, linhas) {
    var t = el('table', 'tabela'), th = el('thead'), tr = el('tr');
    cab.forEach(function (c) { tr.appendChild(el('th', null, c)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    linhas.forEach(function (cols) {
      var r = el('tr');
      cols.forEach(function (c) { r.appendChild(el('td', null, c)); });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    var w = el('div', 'tabela-box'); w.appendChild(t);
    return w;
  }

  var ROTULO_SEV = { erro: 'Erro', atencao: 'Atenção', info: 'Nota' };

  function renderizar(saida, r) {
    saida.textContent = '';
    var s = r.resumo;

    var figs = el('dl', 'figuras');
    [
      [s.duracao, 'Tempo contado (' + s.diasUnicos + ' dias)'],
      [s.semRemuneracoes ? '-' : String(s.competencias), 'Competências com remuneração'],
      [s.semRemuneracoes ? '-' : String(s.mesesSemRemuneracao), 'Meses sem remuneração nos vínculos'],
      [String(s.erros + s.atencoes), 'Pontos de atenção']
    ].forEach(function (f) {
      var d = el('div', 'figura');
      d.appendChild(el('dt', 'fig-rotulo', f[1]));
      d.appendChild(el('dd', 'fig-valor', f[0]));
      figs.appendChild(d);
    });
    saida.appendChild(figs);

    var acoes = el('div', 'acoes sem-impressao');
    var bCopiar = el('button', 'btn btn-leve', 'Copiar resumo');
    bCopiar.type = 'button';
    bCopiar.addEventListener('click', function () {
      var t = resumoEmTexto(r);
      var fim = function () { bCopiar.textContent = 'Resumo copiado'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fim, function () { bCopiar.textContent = 'Não foi possível copiar'; });
      else bCopiar.textContent = 'Não foi possível copiar';
    });
    var bImp = el('button', 'btn btn-leve', 'Imprimir');
    bImp.type = 'button';
    bImp.addEventListener('click', function () { window.print(); });
    acoes.appendChild(bCopiar); acoes.appendChild(bImp);
    saida.appendChild(acoes);

    var mapa = desenharMapa(r.mapa, r.valores);
    if (mapa) {
      var sm = sec('Mapa de competências', 'Cada quadrado é um mês e mostra o valor lançado. Com mais de um vínculo na competência, aparece um valor por vínculo (passe o mouse para ver quais); no mesmo vínculo, os lançamentos são somados. Em recolhimentos, é o salário de contribuição.');
      sm.appendChild(mapa);
      saida.appendChild(sm);
    }

    var sv = sec('Vínculos', 'Em ordem pela data de início do vínculo. "Seq." é o número do vínculo no extrato.');
    if (r.vinculos.length) {
      sv.appendChild(tabela(['Seq.', 'Empregador / origem', 'Início', 'Fim', 'Dias contados', 'Com remuneração', 'Faltantes'],
        r.vinculos.map(function (v) {
          return [
            String(v.seq),
            v.nome,
            v.inicio ? rotuloData(v.inicio) : '-',
            fimDoItem(v),
            v.valido ? String(v.dias) : 'não contado',
            s.semRemuneracoes ? '-' : String(v.comRemuneracao),
            s.semRemuneracoes ? '-' : String(v.faltantes)
          ];
        })));
    } else {
      sv.appendChild(el('p', 'vazio-msg', 'Nenhum vínculo reconhecido. Confira se o PDF tem texto selecionável ou cole o texto do extrato.'));
    }
    saida.appendChild(sv);

    var sf = sec('Salários faltantes', 'Meses dentro do vínculo sem remuneração lançada ou com valor zerado, a partir de 07/1994. O décimo terceiro não entra nesta conta.');
    if (s.semRemuneracoes) {
      sf.appendChild(el('p', 'vazio-msg', 'Não avaliado: o documento não traz remunerações nem recolhimentos. Use o Extrato Previdenciário completo.'));
    } else if (r.faltantes.length) {
      var ul = el('ul', 'lista-linhas');
      r.faltantes.forEach(function (f) {
        var li = el('li');
        li.appendChild(el('strong', null, f.rotulo + ': ' + f.meses + (f.meses === 1 ? ' mês' : ' meses')));
        li.appendChild(el('span', 'faixas', f.faixas.map(textoFaixa).join(', ')));
        if (f.zeradas) li.appendChild(el('span', 'faixas', 'Inclui ' + f.zeradas + ' competência(s) com valor zerado.'));
        if (f.emBeneficio) li.appendChild(el('span', 'faixas', f.emBeneficio + ' mês(es) dentro de período de benefício por incapacidade (veja a tabela de benefícios).'));
        if (f.comOutroVinculo) li.appendChild(el('span', 'faixas', f.comOutroVinculo + ' mês(es) com remuneração em outro vínculo.'));
        ul.appendChild(li);
      });
      sf.appendChild(ul);
    } else {
      sf.appendChild(el('p', 'vazio-msg', 'Nenhum mês sem remuneração encontrado.'));
    }
    if (s.mesesAnteriores94) {
      sf.appendChild(el('p', 'dica', s.mesesAnteriores94 + ' mês(es) anteriores a 07/1994 sem remuneração não entram na conta, porque o CNIS costuma não trazer salários desse período.'));
    }
    saida.appendChild(sf);

    var sa = sec('Abaixo do salário mínimo', 'Competências cujo valor total (somando os vínculos do mês) ficou abaixo do mínimo vigente. Tabela de mínimos embutida; confira antes de usar em peça.');
    if (s.semRemuneracoes) {
      sa.appendChild(el('p', 'vazio-msg', 'Não avaliado: o documento não traz remunerações nem recolhimentos.'));
    } else if (r.abaixoMinimo.length) {
      sa.appendChild(tabela(['Competência', 'Valor total', 'Mínimo da época', 'Origem', 'Observação'], r.abaixoMinimo.slice(0, 80).map(function (a) {
        return [rotuloMes(a.mes), formatarValor(a.total), formatarValor(a.minimo), 'Seq. ' + a.seqs.join(', '),
          a.ci ? 'Contribuinte individual ou facultativo' : a.proporcional ? 'Início ou fim de vínculo: pode ser proporcional' : a.posEC103 ? 'Pode ser complementada ou agrupada (EC 103/2019)' : 'Antes da EC 103/2019'];
      })));
      if (r.abaixoMinimo.length > 80) sa.appendChild(el('p', 'dica', 'Mostrando 80 de ' + r.abaixoMinimo.length + ' competências.'));
    } else {
      sa.appendChild(el('p', 'vazio-msg', 'Nenhuma competência abaixo do salário mínimo.'));
    }
    saida.appendChild(sa);

    var sl = sec('Lacunas entre vínculos', 'Períodos de 7 dias ou mais sem vínculo, benefício nem evento, do primeiro registro até hoje. Benefícios sem data de início ficam fora.');
    if (r.lacunas.length) {
      sl.appendChild(tabela(['Período', 'Duração', 'Entre', 'Observação'], r.lacunas.map(function (g) {
        return [rotuloData(g.ini) + ' a ' + rotuloData(g.fim), duracaoCurta(g.dias),
          g.atual ? 'Seq. ' + g.antes + ' e hoje' : 'Seq. ' + g.antes + ' e Seq. ' + g.depois,
          (g.dias > 365 ? 'Mais de 12 meses: verifique a qualidade de segurado. ' : '') + (g.atual ? 'Até hoje.' : '')];
      })));
    } else {
      sl.appendChild(el('p', 'vazio-msg', 'Nenhuma lacuna encontrada.'));
    }
    saida.appendChild(sl);

    var sc = sec('Carência', 'Contagem de competências, não de tempo. Confira cada caso: não considera períodos anteriores a 07/1994, benefícios intercalados nem a regra de 1/3 após perda da qualidade de segurado (art. 27-A da Lei 8.213/91).');
    if (r.carencia) {
      sc.appendChild(tabela(['Benefício', 'Exigido', 'Faltam (valor ≥ mínimo)', 'Faltam (qualquer remuneração)'], r.carencia.linhas.map(function (c) {
        return [c.nome, String(c.exigido), String(c.faltamValidas), String(c.faltamTodas)];
      })));
      sc.appendChild(el('p', 'dica', r.carencia.validas + ' competência(s) com valor igual ou acima do mínimo e ' + r.carencia.todas + ' com qualquer remuneração.' +
        (r.carencia.mesesAntes94 ? ' Há ' + r.carencia.mesesAntes94 + ' mês(es) de vínculo antes de 07/1994 sem remuneração no CNIS, que podem contar se comprovados.' : '')));
    } else {
      sc.appendChild(el('p', 'vazio-msg', 'Não avaliada: o documento não traz remunerações nem recolhimentos.'));
    }
    saida.appendChild(sc);

    var sp = sec('Pendências');
    if (r.pendencias.length) {
      var lp = el('ul', 'lista-pend');
      r.pendencias.forEach(function (p) {
        var li = el('li', 'pend pend-' + p.sev);
        li.appendChild(el('span', 'selo', ROTULO_SEV[p.sev]));
        var corpo = el('span', 'pend-texto');
        if (p.ref) corpo.appendChild(el('strong', null, p.ref + ': '));
        corpo.appendChild(document.createTextNode(p.msg));
        li.appendChild(corpo);
        lp.appendChild(li);
      });
      sp.appendChild(lp);
    } else {
      sp.appendChild(el('p', 'vazio-msg', 'Nenhuma pendência encontrada.'));
    }
    saida.appendChild(sp);

    var outros = r.beneficios.concat(r.eventos).sort(function (a, b) {
      var x = a.inicio ? a.inicio.ord : Infinity, y = b.inicio ? b.inicio.ord : Infinity;
      return x - y || a.seq - b.seq;
    });
    if (outros.length) {
      var sb = sec('Benefícios e eventos', 'Listados em ordem de início. Ficam fora da contagem de tempo desta análise.');
      sb.appendChild(tabela(['Seq.', 'Tipo', 'Descrição', 'Início', 'Fim', 'Observação'], outros.map(function (b) {
        return [
          String(b.seq),
          b.tipoRegistro === 'beneficio' ? 'Benefício' : 'Evento',
          (b.nb ? 'NB ' + b.nb + (b.texto ? ' - ' : '') : '') + b.texto,
          b.inicio ? rotuloData(b.inicio) : '-',
          b.fim ? rotuloData(b.fim) : '-',
          b.nota
        ];
      })));
      saida.appendChild(sb);
    }

    saida.appendChild(el('p', 'aviso', 'Estes resultados apontam pontos para conferência com o documento original. Não são parecer jurídico nem previdenciário. Tempo calculado com 365 dias por ano e 30 por mês.'));
  }

  // Junta os itens de cada página por linha (tolerando pequenas diferenças de altura) e
  // ordena cada linha da esquerda para a direita. O CNIS tem 3 colunas de remuneração por linha.
  var TOLERANCIA_Y = 3;
  function textoDaPagina(conteudo) {
    var itens = conteudo.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
      return { x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str };
    });
    itens.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var linhas = [], cur = null;
    itens.forEach(function (it) {
      if (!cur || Math.abs(cur.y - it.y) > TOLERANCIA_Y) { cur = { y: it.y, itens: [] }; linhas.push(cur); }
      cur.itens.push(it);
    });
    var cabecalho = new RegExp('^\\d{1,3}\\s+' + NIT);
    linhas.forEach(function (l) {
      l.itens.sort(function (a, b) { return a.x - b.x; });
      l.texto = juntar(l.itens);
    });
    // Indicador sozinho, centralizado na célula entre duas linhas (resumo "Relações Previdenciárias"): vai para a linha do vínculo mais próxima.
    linhas.forEach(function (l) {
      if (!RE_SO_IND.test(l.texto)) return;
      var melhor = null;
      linhas.forEach(function (o) {
        if (o !== l && !o.removida && cabecalho.test(o.texto) && Math.abs(o.y - l.y) <= 6 && (!melhor || Math.abs(o.y - l.y) < Math.abs(melhor.y - l.y))) melhor = o;
      });
      if (melhor) { melhor.texto += ' ' + l.texto; l.removida = true; }
    });
    return linhas.filter(function (l) { return !l.removida; }).map(function (l) { return l.texto; }).join('\n');
  }

  function juntar(itens) {
    var out = '', prev = null;
    itens.forEach(function (it) {
      if (prev) out += (prev.w > 0 && it.x - (prev.x + prev.w) <= 1) ? '' : ' ';
      out += it.s.trim();
      prev = it;
    });
    return out;
  }
  function lerPdf(arquivo) {
    if (!root.pdfjsLib) return Promise.reject(new Error('O leitor de PDF não carregou. Recarregue a página ou cole o texto do extrato.'));
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdf.worker.min.js';
    return arquivo.arrayBuffer()
      .then(function (buf) { return root.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise; })
      .then(function (pdf) {
        var jobs = [];
        for (var i = 1; i <= pdf.numPages; i++) {
          jobs.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }).then(textoDaPagina));
        }
        return Promise.all(jobs);
      })
      .then(function (paginas) { return paginas.join('\n'); });
  }

  function iniciar() {
    var form = document.getElementById('cnis-form');
    if (!form) return;
    var arquivo = document.getElementById('cnis-arquivo');
    var texto = document.getElementById('cnis-texto');
    var saida = document.getElementById('cnis-resultado');
    var msg = document.getElementById('cnis-msg');
    var bExemplo = document.getElementById('cnis-exemplo');
    var bLimpar = document.getElementById('cnis-limpar');

    function hoje() { var a = new Date(); return { y: a.getFullYear(), m: a.getMonth() + 1, d: a.getDate() }; }

    function limpar() {
      texto.value = ''; arquivo.value = ''; saida.textContent = ''; msg.textContent = '';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      saida.textContent = '';
      msg.textContent = 'Lendo o extrato...';
      var pdf = arquivo.files && arquivo.files[0];
      var origem = pdf ? lerPdf(pdf) : Promise.resolve(texto.value);
      origem.then(function (conteudo) {
        if (!conteudo || !conteudo.trim()) throw new Error('Não encontrei texto. Se o PDF for uma imagem escaneada, copie o texto do extrato e cole no campo.');
        renderizar(saida, analisar(conteudo, hoje()));
        msg.textContent = '';
        texto.value = ''; arquivo.value = '';
        var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        saida.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
      }).catch(function (err) {
        msg.textContent = (err && err.message) || 'Não foi possível ler o arquivo.';
      });
    });

    bExemplo.addEventListener('click', function () {
      arquivo.value = ''; texto.value = EXEMPLO; msg.textContent = 'Exemplo fictício carregado. Clique em Analisar.';
    });
    bLimpar.addEventListener('click', limpar);
  }

  var api = {
    analisar: analisar, interpretar: interpretar, dataDe: dataDe, valorDe: valorDe,
    formatarDuracao: formatarDuracao, formatarValor: formatarValor, minimoDe: minimoDe, duracaoCurta: duracaoCurta, agrupar: agrupar, rotuloMes: rotuloMes, mesDe: mesDe,
    resumoEmTexto: resumoEmTexto, textoDaPagina: textoDaPagina, EXEMPLO: EXEMPLO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CNIS = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
