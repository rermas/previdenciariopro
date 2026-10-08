/*
 * Análise de CNIS: tempo contado, competências, salários faltantes e pendências.
 * Todo o processamento acontece no navegador. Nada é enviado, gravado ou lembrado.
 */
(function (root) {
  'use strict';

  var BASE = '';
  try { BASE = document.currentScript.src.replace(/[^\/]*$/, ''); } catch (e) { /* node */ }

  // Competências são contadas como índice de mês: ano * 12 + (mês - 1).
  var INICIO_PBC = 1994 * 12 + 6; // 07/1994: antes disso o CNIS costuma não trazer remunerações

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Indicadores do CNIS. Resumos conferidos em artigos de escritórios de advocacia
  // previdenciária; o código original sempre aparece junto. Conferir no INSS em caso de dúvida.
  var INDICADORES = {
    'PREC-MENOR-MIN': ['atencao', 'contribuição abaixo do salário mínimo'],
    'PREM-EXT': ['atencao', 'remuneração informada fora do prazo'],
    'PEXT': ['atencao', 'vínculo extemporâneo (registrado fora do prazo)'],
    'IREC-INDPEND': ['atencao', 'contribuições com pendência a regularizar'],
    'IREM-INDPEND': ['atencao', 'remuneração com pendência a regularizar'],
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
    'IREC-LC123': ['info', 'contribuição no plano simplificado (LC 123/2006)']
  };

  var RE_IND = /\b(?:PREC|PREM|PVIN|PADM|PRES|PEMP|PSE|PSC|PDT|IREC|IREM|IVIN|ISE|AEXTV|AEXT|AVRC|ACNIS|IGFIP)(?:-[A-Z0-9]+)+\b|\b(?:IEAN|PEXT|PRPPS|ACNISVR)\b/g;
  var RE_DATA = /\b\d{2}\/\d{2}\/\d{4}\b/g;
  var RE_COMP = /^(0[1-9]|1[0-2])\/(\d{4})\b/;
  var RE_VALOR = /(?:^|[^\d.,])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/;
  var RE_BENEFICIO = /\bNB\b/;
  var RE_IGNORAR = /nascimento|emitid|emiss[ãa]o|impress|consulta|gerad|p[áa]gina|data\/hora/i;
  var RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
  var RE_NB = /\b\d{3}\.?\d{3}\.?\d{3}-?\d\b/;
  var PALAVRAS = [
    [/sem\s+informa[çc][aã]o/i, 'Registro marcado como "sem informação"'],
    [/n[ãa]o\s+confirmad/i, 'Registro marcado como não confirmado'],
    [/\bpendente\b/i, 'Registro marcado como pendente']
  ];

  var EXEMPLO = [
    'EXTRATO PREVIDENCIÁRIO (EXEMPLO FICTÍCIO)',
    'Nome: PESSOA DE EXEMPLO    Data de nascimento: 10/05/1970',
    'Relações Previdenciárias',
    'Seq. NIT Código Emp. Origem do Vínculo Tipo Filiado no Vínculo Data Início Data Fim Últ. Remun.',
    '1 123.45678.90-1 12.345.678/0001-90 MERCADO EXEMPLO LTDA Empregado 01/04/1994 31/12/1994 12/1994',
    'Remunerações',
    'Competência Remuneração Indicadores',
    '07/1994 120,00',
    '08/1994 120,00',
    '09/1994 120,00',
    '10/1994 120,00',
    '11/1994 120,00',
    '12/1994 120,00',
    '2 123.45678.90-1 98.765.432/0001-10 OFICINA MODELO ME Empregado 02/01/2000 30/06/2001 06/2001',
    '01/2000 400,00',
    '02/2000 400,00',
    '03/2000 0,00',
    '04/2000 400,00',
    '05/2000 400,00',
    '06/2000 400,00 PREM-EXT',
    '07/2000 400,00',
    '08/2000 400,00',
    '09/2000 400,00',
    '10/2000 400,00',
    '11/2000 400,00',
    '12/2000 400,00',
    '01/2001 410,00',
    '02/2001 410,00',
    '03/2001 410,00',
    '04/2001 410,00',
    '05/2001 410,00',
    '06/2001 410,00',
    '3 123.45678.90-1 11.222.333/0001-44 SERVIÇOS ALFA LTDA Empregado 01/03/2010 31/12/2010 12/2010',
    '03/2010 1.000,00',
    '04/2010 1.000,00',
    '06/2010 1.000,00 PREC-MENOR-MIN',
    '07/2010 1.000,00',
    '08/2010 1.000,00',
    '09/2010 1.000,00',
    '10/2010 1.000,00',
    '11/2010 1.000,00',
    '12/2010 1.000,00',
    '4 123.45678.90-1 55.666.777/0001-88 COMERCIAL BETA S.A. Empregado 01/10/2010 31/12/2010 12/2010',
    '10/2010 500,00',
    '11/2010 500,00',
    '12/2010 500,00',
    '5 123.45678.90-1 33.444.555/0001-66 LOJA GAMA LTDA Empregado 01/02/2020 15/05/2020 04/2020 PEXT',
    '02/2020 1.045,00',
    '03/2020 1.045,00',
    '04/2020 1.045,00',
    'Benefícios',
    '1 NB 123.456.789-0 Auxílio por Incapacidade Temporária 15/08/2015 20/11/2015',
    '2 NB 987.654.321-0 Auxílio por Incapacidade Temporária'
  ].join('\n');

  // ---------- Utilidades de data e mês ----------

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ordemDe(y, m, d) { return Date.UTC(y, m - 1, d) / 86400000; }
  function mesDe(y, m) { return y * 12 + m - 1; }
  function rotuloMes(k) { return pad((k % 12) + 1) + '/' + Math.floor(k / 12); }
  function rotuloData(d) { return pad(d.d) + '/' + pad(d.m) + '/' + d.y; }

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
      if (u && k === u.fim + 1) { u.fim = k; u.qtd++; } else { faixas.push({ ini: k, fim: k, qtd: 1 }); }
    });
    return faixas.map(function (f) { return { de: rotuloMes(f.ini), ate: rotuloMes(f.fim), qtd: f.qtd }; });
  }

  function textoFaixas(meses, limite) {
    var f = agrupar(meses);
    var partes = f.slice(0, limite || 6).map(function (x) { return x.de === x.ate ? x.de : x.de + ' a ' + x.ate; });
    if (f.length > partes.length) partes.push('e mais ' + (f.length - partes.length) + ' faixa(s)');
    return partes.join(', ');
  }

  // Dias -> "1 ano, 1 mês e 3 dias" (365 dias por ano, 30 por mês).
  function formatarDuracao(dias) {
    var a = Math.floor(dias / 365), r = dias % 365, m = Math.floor(r / 30), d = r % 30;
    return a + (a === 1 ? ' ano, ' : ' anos, ') + m + (m === 1 ? ' mês e ' : ' meses e ') + d + (d === 1 ? ' dia' : ' dias');
  }

  // ---------- Leitura do texto ----------

  function indicadoresDe(linha) { return linha.match(RE_IND) || []; }

  function rotuloVinculo(linha, n) {
    var antes = linha.split(RE_DATA)[0]
      .replace(RE_CNPJ, ' ')
      .replace(/\b\d{1,3}\.\d{4,5}\.\d{2}-\d\b/g, ' ')
      .replace(/^\s*\d{1,3}\s+/, '')
      .replace(/\s+/g, ' ').trim();
    return antes.length > 2 ? antes.slice(0, 70) : 'Vínculo ' + n;
  }

  function interpretar(texto) {
    var linhas = String(texto || '').split(/\r?\n/);
    var vinculos = [], beneficios = [], orfas = [], notas = [];
    var atual = null;

    linhas.forEach(function (bruta) {
      var linha = bruta.replace(/\s+/g, ' ').trim();
      if (!linha || RE_IGNORAR.test(linha)) return;

      var comp = RE_COMP.exec(linha);
      if (comp) {
        var v = RE_VALOR.exec(linha.slice(7));
        var rem = {
          mes: mesDe(+comp[2], +comp[1]),
          valor: v ? valorDe(v[1]) : null,
          indicadores: indicadoresDe(linha)
        };
        (atual ? atual.remuneracoes : orfas).push(rem);
        return;
      }

      PALAVRAS.forEach(function (p) { if (p[0].test(linha)) notas.push({ sev: 'atencao', ref: atual ? atual.rotulo : '', msg: p[1] }); });

      var datas = linha.match(RE_DATA) || [];

      if (RE_BENEFICIO.test(linha)) {
        var nb = RE_NB.exec(linha);
        beneficios.push({
          nb: nb ? nb[0] : '',
          texto: linha.split(RE_DATA)[0].replace(/^\s*\d{1,3}\s+/, '').trim(),
          inicio: datas[0] ? dataDe(datas[0]) : null,
          fim: datas[1] ? dataDe(datas[1]) : null,
          semDatas: datas.length === 0
        });
        atual = null;
        return;
      }

      if (datas.length) {
        atual = {
          rotulo: rotuloVinculo(linha, vinculos.length + 1),
          datasBrutas: datas,
          inicio: dataDe(datas[0]),
          fim: datas[1] ? dataDe(datas[1]) : null,
          indicadores: indicadoresDe(linha),
          remuneracoes: []
        };
        vinculos.push(atual);
        return;
      }

      // Linha só com indicadores logo abaixo de um vínculo.
      if (atual && indicadoresDe(linha).length && linha.replace(RE_IND, '').replace(/[\s,;]|Indicadores/gi, '') === '') {
        atual.indicadores = atual.indicadores.concat(indicadoresDe(linha));
      }
    });

    return { vinculos: vinculos, beneficios: beneficios, orfas: orfas, notas: notas };
  }

  // ---------- Análise ----------

  // hoje: { y, m, d }. Devolve resumo, vínculos, faltantes, pendências, benefícios e mapa.
  function analisar(texto, hoje) {
    var lido = interpretar(texto);
    var pend = lido.notas.slice();
    var hojeOrd = ordemDe(hoje.y, hoje.m, hoje.d);
    var hojeMes = mesDe(hoje.y, hoje.m);
    var itens = [], validos = [], faltantes = [];
    var ok = {}, falta = {}, pre94 = {};
    var totalRem = lido.orfas.length;
    lido.vinculos.forEach(function (v) { totalRem += v.remuneracoes.length; });
    var semLeitura = lido.vinculos.length > 0 && totalRem === 0;

    if (semLeitura) {
      pend.push({ sev: 'atencao', ref: '', msg: 'Nenhuma remuneração foi reconhecida. O PDF pode ter outro layout ou a seção de remunerações não foi incluída. Os salários faltantes não foram avaliados.' });
    }
    if (lido.orfas.length) {
      pend.push({ sev: 'atencao', ref: '', msg: lido.orfas.length + ' remuneração(ões) sem vínculo identificado acima delas (a partir de ' + rotuloMes(lido.orfas[0].mes) + ').' });
      lido.orfas.forEach(function (r) { if (r.valor > 0) ok[r.mes] = true; });
    }

    lido.vinculos.forEach(function (v) {
      var item = {
        rotulo: v.rotulo, inicio: v.inicio, fim: v.fim, emAberto: false, valido: false, dias: 0,
        remuneracoes: v.remuneracoes.length, comRemuneracao: 0, faltantes: 0, anteriores94: 0
      };
      itens.push(item);

      if (!v.inicio) { pend.push({ sev: 'erro', ref: v.rotulo, msg: 'Data de início inválida ou não reconhecida.' }); return; }
      if (v.datasBrutas.length > 1 && !v.fim) { pend.push({ sev: 'erro', ref: v.rotulo, msg: 'Data de fim inválida.' }); return; }
      if (v.inicio.ord > hojeOrd || v.inicio.y < 1900) { pend.push({ sev: 'erro', ref: v.rotulo, msg: 'Data de início fora do intervalo esperado (' + rotuloData(v.inicio) + ').' }); return; }

      var fim = v.fim;
      if (!fim) {
        fim = { y: hoje.y, m: hoje.m, d: hoje.d, ord: hojeOrd };
        item.emAberto = true;
        pend.push({ sev: 'info', ref: v.rotulo, msg: 'Vínculo sem data de fim: período contado até hoje.' });
      }
      if (fim.ord < v.inicio.ord) { pend.push({ sev: 'erro', ref: v.rotulo, msg: 'Data de fim anterior à data de início.' }); return; }

      item.valido = true;
      item.fim = fim;
      item.inicioOrd = v.inicio.ord;
      item.fimOrd = fim.ord;
      item.dias = fim.ord - v.inicio.ord + 1;
      validos.push(item);

      var mIni = mesDe(v.inicio.y, v.inicio.m);
      var mFim = mesDe(fim.y, fim.m);
      var presentes = {}, vistos = {}, repetidas = [], fora = [], zeradas = [], semValor = [];
      var indic = {};

      v.indicadores.forEach(function (c) { (indic[c] = indic[c] || { meses: [] }); });

      v.remuneracoes.forEach(function (r) {
        if (vistos[r.mes]) repetidas.push(r.mes);
        vistos[r.mes] = true;
        if (r.mes < mIni || r.mes > mFim) fora.push(r.mes);
        if (r.valor === null) semValor.push(r.mes);
        else if (r.valor === 0) zeradas.push(r.mes);
        else presentes[r.mes] = true;
        r.indicadores.forEach(function (c) { (indic[c] = indic[c] || { meses: [] }).meses.push(r.mes); });
      });

      Object.keys(presentes).forEach(function (k) { ok[k] = true; });
      item.comRemuneracao = Object.keys(presentes).length;

      if (repetidas.length) pend.push({ sev: 'atencao', ref: v.rotulo, msg: 'Competência repetida: ' + textoFaixas(repetidas, 6) + '.' });
      if (fora.length) pend.push({ sev: 'atencao', ref: v.rotulo, msg: 'Remuneração fora do período do vínculo: ' + textoFaixas(fora, 6) + '.' });
      if (semValor.length) pend.push({ sev: 'atencao', ref: v.rotulo, msg: 'Competência sem valor lido: ' + textoFaixas(semValor, 6) + '.' });

      Object.keys(indic).forEach(function (c) {
        var d = INDICADORES[c];
        var sev = d ? d[0] : 'info';
        var desc = d ? d[1] : 'indicador do INSS, confira o significado na fonte oficial';
        var onde = indic[c].meses.length ? ' em ' + indic[c].meses.length + ' competência(s): ' + textoFaixas(indic[c].meses, 4) : '';
        pend.push({ sev: sev, ref: v.rotulo, msg: c + ': ' + desc + onde + '.' });
      });

      if (semLeitura) return;

      // Salários faltantes: meses do vínculo sem remuneração (ou com valor zero).
      var ultima = -1;
      Object.keys(presentes).forEach(function (k) { if (+k > ultima && +k <= hojeMes) ultima = +k; });
      var mFimEsp = mFim;
      if (item.emAberto) {
        mFimEsp = ultima >= mIni ? ultima : mFim;
        if (ultima >= mIni && hojeMes - ultima >= 2) {
          pend.push({ sev: 'info', ref: v.rotulo, msg: 'Vínculo em aberto: última remuneração em ' + rotuloMes(ultima) + '. Os meses seguintes não foram tratados como faltantes.' });
        }
      }

      var sem = [], ant = [];
      for (var k = mIni; k <= mFimEsp; k++) {
        if (presentes[k]) continue;
        if (k < INICIO_PBC) { ant.push(k); pre94[k] = true; } else { sem.push(k); falta[k] = true; }
      }
      item.faltantes = sem.length;
      item.anteriores94 = ant.length;
      item.faixasFaltantes = agrupar(sem);
      item.zeradas = zeradas.filter(function (k) { return k >= INICIO_PBC; }).length;

      if (v.remuneracoes.length === 0 && sem.length) {
        pend.push({ sev: 'atencao', ref: v.rotulo, msg: 'Vínculo sem nenhuma remuneração listada.' });
      }
      if (sem.length) {
        faltantes.push({ rotulo: v.rotulo, meses: sem.length, faixas: item.faixasFaltantes, zeradas: item.zeradas, listadas: v.remuneracoes.length });
      }
    });

    // Concomitância
    for (var i = 0; i < validos.length; i++) {
      for (var j = i + 1; j < validos.length; j++) {
        var a = validos[i], b = validos[j];
        var s = Math.max(a.inicioOrd, b.inicioOrd), e = Math.min(a.fimOrd, b.fimOrd);
        if (s <= e) pend.push({ sev: 'info', ref: a.rotulo, msg: 'Período concomitante com "' + b.rotulo + '" (' + (e - s + 1) + ' dias em comum). O tempo é contado uma vez.' });
      }
    }

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

    // Benefícios: listados, fora da contagem.
    var bens = lido.beneficios.map(function (b) {
      var nota = b.semDatas ? 'Sem datas de início e fim: indica benefício indeferido.' :
        'Fora da contagem desta análise.';
      return { nb: b.nb, texto: b.texto, inicio: b.inicio, fim: b.fim, nota: nota, indeferido: b.semDatas };
    });

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
    pend.sort(function (x, y) { return rank[x.sev] - rank[y.sev]; });
    var cont = { erro: 0, atencao: 0, info: 0 };
    pend.forEach(function (p) { cont[p.sev]++; });

    return {
      vinculos: itens,
      faltantes: faltantes,
      pendencias: pend,
      beneficios: bens,
      mapa: mapa,
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
        beneficios: bens.length
      }
    };
  }

  function resumoEmTexto(r) {
    var s = r.resumo, l = [];
    l.push('Análise do CNIS (pontos de atenção para conferência, não é parecer)');
    l.push('Vínculos: ' + s.totalVinculos + ' | Tempo contado: ' + s.duracao + ' (' + s.diasUnicos + ' dias)');
    l.push('Competências com remuneração: ' + s.competencias + ' | Meses sem remuneração: ' + s.mesesSemRemuneracao);
    if (r.faltantes.length) {
      l.push('', 'Salários faltantes:');
      r.faltantes.forEach(function (f) {
        l.push('- ' + f.rotulo + ': ' + f.meses + ' mês(es) - ' + f.faixas.map(function (x) { return x.de === x.ate ? x.de : x.de + ' a ' + x.ate; }).join(', '));
      });
    }
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

  function desenharMapa(mapa) {
    var ks = Object.keys(mapa).map(Number);
    if (!ks.length) return null;
    var ini = Math.floor(Math.min.apply(null, ks) / 12), fim = Math.floor(Math.max.apply(null, ks) / 12);
    var t = el('table', 'mapa');
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
        td.title = pad(m + 1) + '/' + y + (est ? ': ' + ROTULO_MAPA[est] : '');
        if (est) td.appendChild(el('span', 'so-leitor', ROTULO_MAPA[est]));
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
      [String(s.competencias), 'Competências com remuneração'],
      [String(s.mesesSemRemuneracao), 'Meses sem remuneração nos vínculos'],
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

    var mapa = desenharMapa(r.mapa);
    if (mapa) {
      var sm = sec('Mapa de competências', 'Cada quadrado é um mês. Passe o mouse para ver a competência.');
      sm.appendChild(mapa);
      saida.appendChild(sm);
    }

    var sv = sec('Vínculos');
    if (r.vinculos.length) {
      sv.appendChild(tabela(['Vínculo', 'Início', 'Fim', 'Dias', 'Com remuneração', 'Faltantes'],
        r.vinculos.map(function (v) {
          return [
            v.rotulo,
            v.inicio ? rotuloData(v.inicio) : '-',
            v.emAberto ? 'em aberto' : (v.fim ? rotuloData(v.fim) : '-'),
            v.valido ? String(v.dias) : 'não contado',
            String(v.comRemuneracao),
            String(v.faltantes)
          ];
        })));
    } else {
      sv.appendChild(el('p', 'vazio-msg', 'Nenhum vínculo reconhecido. Confira se o PDF tem texto selecionável ou cole o texto do extrato.'));
    }
    saida.appendChild(sv);

    var sf = sec('Salários faltantes', 'Meses dentro do vínculo sem remuneração lançada ou com valor zerado, a partir de 07/1994.');
    if (r.faltantes.length) {
      var ul = el('ul', 'lista-linhas');
      r.faltantes.forEach(function (f) {
        var li = el('li');
        li.appendChild(el('strong', null, f.rotulo + ': ' + f.meses + (f.meses === 1 ? ' mês' : ' meses')));
        li.appendChild(el('span', 'faixas', f.faixas.map(function (x) { return x.de === x.ate ? x.de : x.de + ' a ' + x.ate; }).join(', ')));
        if (f.zeradas) li.appendChild(el('span', 'faixas', 'Inclui ' + f.zeradas + ' competência(s) com valor zerado.'));
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

    if (r.beneficios.length) {
      var sb = sec('Benefícios no extrato');
      sb.appendChild(tabela(['Benefício', 'Início', 'Fim', 'Observação'], r.beneficios.map(function (b) {
        return [(b.nb ? 'NB ' + b.nb : 'NB') + (b.texto ? ' - ' + b.texto.replace(/^.*?NB\s*[\d.\-]*\s*/, '') : ''), b.inicio ? rotuloData(b.inicio) : '-', b.fim ? rotuloData(b.fim) : '-', b.nota];
      })));
      saida.appendChild(sb);
    }

    saida.appendChild(el('p', 'aviso', 'Estes resultados apontam pontos para conferência com o documento original. Não são parecer jurídico nem previdenciário. Tempo calculado com 365 dias por ano e 30 por mês.'));
  }

  // Junta os itens de cada página pela posição vertical e ordena da esquerda para a direita.
  function textoDaPagina(conteudo) {
    var porY = {};
    conteudo.items.forEach(function (it) {
      if (!it.str) return;
      var y = Math.round(it.transform[5]);
      (porY[y] = porY[y] || []).push({ x: it.transform[4], s: it.str });
    });
    return Object.keys(porY).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
      return porY[y].sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join(' ');
    }).join('\n');
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
    formatarDuracao: formatarDuracao, agrupar: agrupar, rotuloMes: rotuloMes, mesDe: mesDe,
    resumoEmTexto: resumoEmTexto, EXEMPLO: EXEMPLO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CNIS = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
