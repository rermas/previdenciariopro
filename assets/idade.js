// Verificação de direito: aposentadoria por idade urbana e rural (Lei 8.213/91, arts. 48, 142 e 143; EC 103/2019, arts. 18 e 19).
// Roda no navegador, sem enviar dados. Depende de assets/cnis.js e assets/direito.js.
(function (root) {
  'use strict';
  var C = root.CNIS || (typeof require !== 'undefined' ? require('./cnis.js') : null);
  var D = root.DIREITO || (typeof require !== 'undefined' ? require('./direito.js') : null);

  var N_IDADE = [
    { nome: 'Lei 8.213/91, art. 48 (aposentadoria por idade), art. 25, II (carência de 180 contribuições), arts. 142 e 143 (tabela de transição da carência)', vigencia: 'Texto compilado; confira a versão vigente. A tabela do art. 142 vale para inscritos até 24/07/1991 e, no art. 143, para o trabalhador rural.' },
    { nome: 'EC 103/2019, arts. 18 e 19 e art. 201, § 7º, da Constituição', vigencia: 'Em vigor desde 13/11/2019. Filiados até 13/11/2019: mulher 60 anos (mais 6 meses por ano desde 2020, até 62) e homem 65, com 15 anos de contribuição. Filiados depois: mulher 62 e homem 65, com 15 e 20 anos de contribuição.' },
    { nome: 'Lei 10.666/2003, art. 3º, § 1º', vigencia: 'A perda da qualidade de segurado não impede a aposentadoria por idade, desde que a carência esteja cumprida.' },
    { nome: 'IN PRES/INSS 128/2022 (carência da aposentadoria por idade)', vigencia: 'Presunção de recolhimento do empregado e do doméstico (desde 06/2015), contribuições até a data do fato gerador, contribuições anteriores a 03/1994 sem data de pagamento tratadas como em dia. Confira a versão vigente.' },
    { nome: 'ACP 0216249-77.2017.4.02.5101 (RJ) e ACP 2009.71.00.004103-4 (RS)', vigencia: 'Cômputo de períodos de benefício por incapacidade como carência: previdenciário, se intercalado, e acidentário, intercalado ou não, para requerimentos desde 20/12/2019; benefícios por incapacidade intercalados, para requerimentos de 19/09/2011 a 03/11/2014.' }
  ];

  var TAB142 = { 1991: 60, 1992: 60, 1993: 66, 1994: 72, 1995: 78, 1996: 90, 1997: 96, 1998: 102, 1999: 108, 2000: 114, 2001: 120, 2002: 126, 2003: 132, 2004: 138, 2005: 144, 2006: 150, 2007: 156, 2008: 162, 2009: 168, 2010: 174 };

  function lerData(x) {
    if (!x) return null;
    if (typeof x === 'string') {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
      return m ? C.dataDe(m[3] + '/' + m[2] + '/' + m[1]) : null;
    }
    return x.ord !== undefined ? x : C.dataDe(x.d + '/' + x.m + '/' + x.y);
  }
  function mk(y, m, d) { return { y: y, m: m, d: d, ord: C.ordemDe(y, m, d) }; }
  function diasNoMes(y, m) { return new Date(y, m, 0).getDate(); }
  function somar(d, anos, meses) {
    var t = d.y * 12 + (d.m - 1) + anos * 12 + meses, y = Math.floor(t / 12), m = (t % 12) + 1;
    return mk(y, m, Math.min(d.d, diasNoMes(y, m)));
  }
  function mesOrd(d) { return d.y * 12 + (d.m - 1); }
  function rot(d) { return C.rotuloData(d); }
  function rotMes(k) { return String(k % 12 + 1).padStart(2, '0') + '/' + Math.floor(k / 12); }
  function primeiroDia(k) { return C.ordemDe(Math.floor(k / 12), (k % 12) + 1, 1); }
  function ultimoDia(k) { return C.ultimoDiaDoMes(k); }
  function idadeTexto(nasc, ref) {
    var meses = (ref.y - nasc.y) * 12 + (ref.m - nasc.m) - (ref.d < nasc.d ? 1 : 0);
    if (meses < 0) return 'ainda não nascido na data';
    var a = Math.floor(meses / 12), m = meses % 12;
    return a + (a === 1 ? ' ano' : ' anos') + (m ? ' e ' + m + (m === 1 ? ' mês' : ' meses') : '');
  }
  function textoIdade(R) { var a = Math.floor(R), m = R % 1 ? 6 : 0; return a + ' anos' + (m ? ' e 6 meses' : ''); }

  // Mulher filiada até 13/11/2019: 60 anos, mais 6 meses a cada ano desde 2020, até 62 (EC 103/2019, art. 18).
  function idadeMulherTransicao(ano) { return ano <= 2019 ? 60 : ano === 2020 ? 60.5 : ano === 2021 ? 61 : ano === 2022 ? 61.5 : 62; }
  // Primeira data em que a mulher completa a idade exigida no ano em que a completa.
  function dataIdadeMulherTransicao(nasc) {
    var melhor = null;
    [60, 60.5, 61, 61.5, 62].forEach(function (R) {
      var d = somar(nasc, Math.floor(R), R % 1 ? 6 : 0);
      if (idadeMulherTransicao(d.y) <= R && (!melhor || d.ord < melhor.d.ord)) melhor = { d: d, R: R };
    });
    return melhor;
  }

  function carenciaExigida(anoIdade, usaTabela) {
    if (usaTabela && anoIdade <= 2010) return TAB142[Math.max(1991, anoIdade)];
    return 180;
  }

  function lista(itens) { return D.util.lista(itens); }

  // ---------- Meses de carência ----------
  function montarMeses(analise, entrada, der, regras) {
    var derMes = mesOrd(der), derOrd = der.ord;
    var rural = regras.modalidade === 'rural', hib = regras.modalidade === 'hibrida';
    var resp = { compEmp: entrada.compEmp, compCI: entrada.compCI };
    var compl = D.complementosEm(analise, derMes);
    compl.empSem = [];
    var baixoEmp = {}, baixoCI = {};
    compl.empBaixo.forEach(function (k) { baixoEmp[k] = true; });
    compl.ciBaixo.forEach(function (k) { baixoCI[k] = true; });
    var contados = {};      // mês -> lista de intervalos [ini, fim] em dias
    var notas = [];
    var ex = { abaixoEmp: [], abaixoCI: [], atraso: [], aposFG: [], domesticoAntes: [], ruralAntes91: [], rpps: 0, especial: 0 };
    function marca(k, ini, fim, origem) {
      if (!contados[k]) contados[k] = { ints: [], origem: {} };
      contados[k].ints.push([ini, fim]); contados[k].origem[origem] = true;
    }
    var classes = {};
    analise.vinculos.forEach(function (v) { if (v.inicio) classes[v.seq] = D.classeDe(v); });
    var EMPREGO = { empregada: 1, domestica: 1, avulsa: 1 };
    var CIFAC = { ci: 1, mei: 1, facultativa: 1 };
    var PISO94 = C.INICIO_PBC, EC103 = 2019 * 12 + 10, DOM_PRESUMIDO = 2015 * 12 + 5, RURAL_EMP91 = 1991 * 12 + 10;

    if (rural) {
      // Atividade rural: segurado especial e empregado rural, em qualquer data.
      analise.vinculos.forEach(function (v) {
        if (!v.valido || !C.ehRural(v)) return;
        var a = mesOrd(v.inicio), z = Math.min(mesOrd(v.fimContado), derMes);
        for (var k = a; k <= z; k++) marca(k, Math.max(v.inicioOrd, primeiroDia(k)), Math.min(v.fimOrd, ultimoDia(k)), 'rural');
      });
      return { contados: contados, compl: compl, notas: notas, ex: ex, resp: resp };
    }

    // Urbana: empregados (presumidos), contribuintes individuais e facultativos, salário-maternidade e benefícios por incapacidade.
    var presenca = {};  // mês com atividade em dia ou empregado
    var candCI = [];    // contribuições de contribuinte individual/facultativo a avaliar
    analise.vinculos.forEach(function (v) {
      if (!v.valido) return;
      var cl = classes[v.seq];
      if (cl === 'rpps') { ex.rpps++; return; }
      var a = mesOrd(v.inicio), z = Math.min(mesOrd(v.fimContado), derMes);
      if (cl === 'especial') {
        if (!hib) { ex.especial++; return; }
        // Híbrida: segurado especial conta como carência independentemente de recolhimento.
        for (var ke = a; ke <= z; ke++) { marca(ke, Math.max(v.inicioOrd, primeiroDia(ke)), Math.min(v.fimOrd, ultimoDia(ke)), 'rural'); ex.ruralMeses = (ex.ruralMeses || 0) + 1; }
        return;
      }
      if (EMPREGO[cl]) {
        var rur = C.ehRural(v);
        for (var k = a; k <= z; k++) {
          if (rur && hib) { marca(k, Math.max(v.inicioOrd, primeiroDia(k)), Math.min(v.fimOrd, ultimoDia(k)), 'rural'); ex.ruralMeses = (ex.ruralMeses || 0) + 1; presenca[k] = true; continue; }
          if (rur && k < RURAL_EMP91) { ex.ruralAntes91.push(k); continue; }
          if (cl === 'domestica' && k < DOM_PRESUMIDO && !(v.contribuicoes && v.contribuicoes[k] !== undefined)) { ex.domesticoAntes.push(k); continue; }
          if (baixoEmp[k] && !resp.compEmp) { ex.abaixoEmp.push(k); continue; }
          marca(k, Math.max(v.inicioOrd, primeiroDia(k)), Math.min(v.fimOrd, ultimoDia(k)), 'emprego');
          presenca[k] = true;
        }
      } else if (CIFAC[cl]) {
        // Antes de 07/1994 vale o período do vínculo (contribuições anteriores a 03/1994 sem data de pagamento contam como em dia).
        for (var k2 = a; k2 < Math.min(PISO94, z + 1); k2++) { marca(k2, Math.max(v.inicioOrd, primeiroDia(k2)), Math.min(v.fimOrd, ultimoDia(k2)), 'ci'); presenca[k2] = true; }
        Object.keys(v.contribuicoes || {}).forEach(function (ks) {
          var k = +ks;
          if (k < PISO94 || k > derMes) return;
          candCI.push({ k: k, v: v });
        });
      }
    });

    // Contribuições de CI/facultativo a partir de 07/1994
    var porMes = {};
    candCI.forEach(function (c) {
      var k = c.k, pag = (c.v.pagamentos && c.v.pagamentos[k]) || [];
      var primeiro = pag.length ? Math.min.apply(null, pag) : null;
      var venc = D.vencimento(k);
      var atraso = primeiro !== null && primeiro > venc;
      var depois = primeiro !== null && primeiro > derOrd && !(k === derMes && primeiro <= venc);
      porMes[k] = porMes[k] || [];
      porMes[k].push({ atraso: atraso, depois: depois, v: c.v });
    });
    var mesesCI = Object.keys(porMes).map(Number).sort(function (x, y) { return x - y; });
    // Em dia (ou sem data de pagamento) conta como presença para fins de reaver a qualidade.
    mesesCI.forEach(function (k) { if (porMes[k].some(function (x) { return !x.atraso && !x.depois; })) presenca[k] = true; });
    // Períodos sem qualidade: contribuição em atraso de competência dentro deles não conta, até a primeira em dia.
    var primeiroMes = Infinity;
    Object.keys(presenca).forEach(function (k) { if (+k < primeiroMes) primeiroMes = +k; });
    mesesCI.forEach(function (k) { if (k < primeiroMes) primeiroMes = k; });
    var janelas = [];
    if (isFinite(primeiroMes)) janelas.push(primeiroMes);
    var sq = D.sequencia(analise, classes, derMes, false);
    sq.perdas.forEach(function (p) { janelas.push(p.apos + 14); });
    function atrasoSemValidade(k) {
      var inicio = null;
      janelas.forEach(function (s) { if (s <= k && (inicio === null || s > inicio)) inicio = s; });
      if (inicio === null) return false;
      // primeira presença em dia a partir do início da janela
      var emDia = Infinity;
      Object.keys(presenca).forEach(function (m) { if (+m >= inicio && +m < emDia) emDia = +m; });
      return k < emDia;
    }
    mesesCI.forEach(function (k) {
      var itens = porMes[k];
      var ok = itens.filter(function (x) { return !x.depois; });
      if (!ok.length) { ex.aposFG.push(k); return; }
      var emDia = ok.filter(function (x) { return !x.atraso; });
      if (!emDia.length && atrasoSemValidade(k)) { ex.atraso.push(k); return; }
      if (baixoCI[k] && !resp.compCI) { ex.abaixoCI.push(k); return; }
      if (baixoEmp[k] && !resp.compEmp && !contados[k]) { ex.abaixoEmp.push(k); return; }
      marca(k, primeiroDia(k), Math.min(ultimoDia(k), derOrd >= primeiroDia(k) ? ultimoDia(k) : ultimoDia(k)), 'ci');
    });

    // Salário-maternidade: todos os meses do período contam.
    analise.beneficios.forEach(function (b) {
      if (b.indeferido || !b.inicio || !/MATERNIDADE/i.test(b.texto || '')) return;
      var z = Math.min(mesOrd(b.fim || der), derMes);
      for (var k = mesOrd(b.inicio); k <= z; k++) marca(k, Math.max(b.inicio.ord, primeiroDia(k)), Math.min(b.fim ? b.fim.ord : derOrd, ultimoDia(k)), 'sm');
    });

    // Benefício por incapacidade (ACPs): só em requerimentos a partir de 20/12/2019 ou de 19/09/2011 a 03/11/2014.
    var base = {};
    Object.keys(contados).forEach(function (k) { base[k] = true; });
    var apos2019 = derOrd >= C.ordemDe(2019, 12, 20);
    var janela2011 = derOrd >= C.ordemDe(2011, 9, 19) && derOrd <= C.ordemDe(2014, 11, 3);
    var incapAchados = { contados: 0, naoContados: 0, semRegra: false };
    analise.beneficios.forEach(function (b) {
      if (b.indeferido || !b.inicio) return;
      var t = b.texto || '';
      if (!/AUX[IÍ]LIO[ -]DOEN|INCAPACIDADE\s+TEMPOR/i.test(t) || /AUX[IÍ]LIO[ -]ACIDENTE/i.test(t)) return;
      var acid = /ACIDENT/i.test(t);
      var a = mesOrd(b.inicio), z = Math.min(mesOrd(b.fim || der), derMes);
      var antes = Object.keys(base).some(function (k) { return +k < a; });
      var depois = !!b.fim && Object.keys(base).some(function (k) { return +k > mesOrd(b.fim) && +k <= derMes; });
      var interc = antes && depois;
      var conta = (apos2019 && (acid || interc)) || (janela2011 && interc);
      if (conta) {
        incapAchados.contados++;
        for (var k = a; k <= z; k++) if (!contados[k]) marca(k, Math.max(b.inicio.ord, primeiroDia(k)), Math.min(b.fim ? b.fim.ord : derOrd, ultimoDia(k)), 'incap');
      } else {
        incapAchados.naoContados++;
        if (!apos2019 && !janela2011) incapAchados.semRegra = true;
      }
    });
    notas.push(incapAchados);
    return { contados: contados, compl: compl, notas: notas, ex: ex, resp: resp, incap: incapAchados };
  }

  function uniaoDias(contados) {
    var ints = [];
    Object.keys(contados).forEach(function (k) { contados[k].ints.forEach(function (i) { if (i[0] <= i[1]) ints.push([i[0], i[1]]); }); });
    ints.sort(function (x, y) { return x[0] - y[0]; });
    var tot = 0, ci = null, cf = null;
    ints.forEach(function (i) {
      if (ci === null) { ci = i[0]; cf = i[1]; } else if (i[0] <= cf + 1) { cf = Math.max(cf, i[1]); } else { tot += cf - ci + 1; ci = i[0]; cf = i[1]; }
    });
    if (ci !== null) tot += cf - ci + 1;
    return tot;
  }

  function faixas(ks) {
    if (!ks.length) return '';
    var o = ks.slice().sort(function (x, y) { return x - y; }), out = [], ini = o[0], ant = o[0];
    for (var i = 1; i <= o.length; i++) {
      if (o[i] === ant + 1) { ant = o[i]; continue; }
      out.push(ini === ant ? rotMes(ini) : rotMes(ini) + ' a ' + rotMes(ant));
      ini = o[i]; ant = o[i];
    }
    return out.slice(0, 5).join(', ') + (out.length > 5 ? ' e outras faixas' : '');
  }

  function aposentadoriaIdade(analise, entrada, hoje) {
    var rural = entrada.modalidade === 'rural', hib = entrada.modalidade === 'hibrida';
    var res = {
      beneficio: rural ? 'aposentadoria-idade-rural' : hib ? 'aposentadoria-idade-hibrida' : 'aposentadoria-idade-urbana',
      titulo: rural ? 'aposentadoria por idade rural' : hib ? 'aposentadoria por idade híbrida' : 'aposentadoria por idade urbana',
      normas: hib ? N_IDADE.concat([{ nome: 'Lei 8.213/91, art. 48, §§ 3º e 4º (aposentadoria por idade híbrida) e Tema 1007 do STJ', vigencia: 'Soma de tempo rural, sem exigir recolhimento, com tempo urbano, pela regra de idade urbana. O STJ fixou que o tempo rural vale mesmo que a última atividade seja urbana. Confira a versão vigente.' }]) : N_IDADE, entrada: entrada, regras: [], idade: null, filiacao: null, carencia: null, tempo: null,
      atividade: null, cnis: [], documentos: [], conclusao: null, fato: { rotulo: 'Data do requerimento (DER)', data: null, notas: [] }
    };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der), sexo = entrada.sexo === 'M' ? 'M' : 'F';
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER) para conferir idade, carência e tempo de contribuição.', pendencias: [!nasc ? 'Informar a data de nascimento.' : '', !der ? 'Informar a data do requerimento.' : ''].filter(Boolean) };
      res.documentos = ['Documento de identificação com a data de nascimento'];
      return res;
    }
    res.fato.data = der;
    var derMes = mesOrd(der);

    // ----- Filiação e regra de idade -----
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var corte = C.ordemDe(2019, 11, 13), tab142 = C.ordemDe(1991, 7, 24);
    var filiadoAntes = primeira ? primeira.ord <= corte : null;
    var regraIdade, dataIdade, idadeExigidaTxt, linhasIdade = [];
    if (rural) {
      var Rr = sexo === 'F' ? 55 : 60;
      dataIdade = somar(nasc, Rr, 0);
      idadeExigidaTxt = Rr + ' anos';
      linhasIdade.push('Aposentadoria por idade rural: **' + Rr + ' anos** (' + (sexo === 'F' ? 'mulher' : 'homem') + ') e **180 meses** de atividade rural (art. 48, §§ 1º e 2º, da Lei 8.213/91).');
    } else if (filiadoAntes === false) {
      var Rp = sexo === 'F' ? 62 : 65;
      dataIdade = somar(nasc, Rp, 0);
      idadeExigidaTxt = Rp + ' anos';
      linhasIdade.push('Filiação ao RGPS depois de 13/11/2019 (primeiro registro em ' + rot(primeira) + '): idade mínima **' + Rp + ' anos** para ' + (sexo === 'F' ? 'mulher' : 'homem') + ' e **' + (sexo === 'F' ? 15 : 20) + ' anos** de tempo de contribuição (art. 19 da EC 103/2019).');
    } else {
      if (sexo === 'F') {
        var m = dataIdadeMulherTransicao(nasc);
        dataIdade = m.d; idadeExigidaTxt = textoIdade(m.R);
        linhasIdade.push('Filiação ao RGPS até 13/11/2019' + (primeira ? ' (primeiro registro em ' + rot(primeira) + ')' : '') + ': mulher com **60 anos**, mais 6 meses a cada ano desde 01/01/2020 até 62 anos (60,5 em 2020, 61 em 2021, 61,5 em 2022, 62 de 2023 em diante). Pela data de nascimento, a idade exigida é **' + idadeExigidaTxt + '**.');
      } else {
        dataIdade = somar(nasc, 65, 0); idadeExigidaTxt = '65 anos';
        linhasIdade.push('Filiação ao RGPS até 13/11/2019' + (primeira ? ' (primeiro registro em ' + rot(primeira) + ')' : '') + ': homem com **65 anos** e **15 anos** de tempo de contribuição (art. 18 da EC 103/2019).');
      }
    }
    var idadeOk = der.ord >= dataIdade.ord;
    linhasIdade.push('Idade na DER (' + rot(der) + '): **' + idadeTexto(nasc, der) + '**. Idade exigida: ' + idadeExigidaTxt + (idadeOk ? ' (cumprida em ' + rot(dataIdade) + ').' : ' (será cumprida em ' + rot(dataIdade) + ').'));
    if (!rural && !primeira) linhasIdade.push('Nenhum vínculo com data de início válida no CNIS: não foi possível saber a data da primeira filiação. Foi aplicada a regra de quem se filiou até 13/11/2019.');
    res.idade = { exigida: idadeExigidaTxt, dataCumprimento: dataIdade, cumprida: idadeOk, linhas: linhasIdade };

    // ----- Carência (e atividade rural) -----
    var usaTabela = rural || (primeira && primeira.ord <= tab142);
    var exigida = carenciaExigida(dataIdade.y, usaTabela);
    var regrasFixas = hib
      ? ['**Idade:** a da aposentadoria urbana (art. 48, § 3º, da Lei 8.213/91): filiados até 13/11/2019, mulher 60 anos (60,5 em 2020, 61 em 2021, 61,5 em 2022 e 62 de 2023 em diante) e homem 65; filiados depois, mulher 62 e homem 65.', '**Carência:** 180 meses somando atividade rural e urbana. A rural conta sem recolhimento; a urbana segue as regras da aposentadoria urbana.', '**Conta:** segurado especial e empregado rural em qualquer data, empregado urbano presumido, CI e facultativo em dia e no mínimo, salário-maternidade e, conforme a data, benefício por incapacidade.', '**Qualidade de segurado:** não é exigida se a carência estiver cumprida (Lei 10.666/2003, art. 3º, § 1º).']
      : rural
      ? ['**Idade:** 55 anos (mulher) ou 60 anos (homem).', '**Carência:** 180 meses de atividade rural, ainda que descontínuos, no período imediatamente anterior ao requerimento (ou à data em que completou a idade).', '**Contam como atividade rural:** segurado especial e empregado rural, em qualquer data.']
      : ['**Idade e tempo de contribuição:** filiados até 13/11/2019: mulher 60 anos (60,5 em 2020, 61 em 2021, 61,5 em 2022 e 62 de 2023 em diante) e homem 65, com 15 anos de contribuição; filiados depois: mulher 62 anos e 15 de contribuição, homem 65 anos e 20 de contribuição.', '**Carência:** 180 contribuições mensais (art. 25, II). Quem se inscreveu até 24/07/1991 segue a tabela do art. 142, conforme o ano em que completa a idade.', '**Conta como carência:** todo mês de vínculo de empregado (recolhimento presumido), doméstico presumido desde 06/2015, contribuição de contribuinte individual e facultativo em dia e no mínimo, salário-maternidade e, conforme a data do requerimento, benefício por incapacidade.', '**Não conta:** período de segurado especial (só na aposentadoria rural ou híbrida), contribuição em atraso fora da manutenção da qualidade e contribuição paga depois da data do fato gerador.', '**Qualidade de segurado:** perder a qualidade não impede a aposentadoria por idade se a carência estiver cumprida (Lei 10.666/2003, art. 3º, § 1º).'];
    res.regras = regrasFixas;

    var mm = montarMeses(analise, entrada, der, { modalidade: rural ? 'rural' : hib ? 'hibrida' : 'urbana' });
    var total = Object.keys(mm.contados).length;
    var falta = total < exigida;
    var perguntas = D.perguntasCarencia(mm.compl, mm.resp, falta, total, exigida);
    var linhasCar = [];
    if (rural) {
      linhasCar.push('Meses de atividade rural no CNIS (segurado especial e empregado rural) até ' + rotMes(derMes) + ': **' + total + '**. Exigidos: **' + exigida + '**' + (exigida < 180 ? ' (tabela do art. 142 da Lei 8.213/91, aplicável ao trabalhador rural, conforme o ano em que completou a idade)' : '') + '.');
    } else {
      linhasCar.push('Meses que contam como carência até ' + rotMes(derMes) + ': **' + total + '**. Exigidos: **' + exigida + '**' + (exigida < 180 ? ' (tabela do art. 142, inscrito até 24/07/1991, idade completada em ' + dataIdade.y + ')' : '') + '.');
      var orig = { emprego: 0, ci: 0, sm: 0, incap: 0, rural: 0 };
      Object.keys(mm.contados).forEach(function (k) { var o = mm.contados[k].origem; if (o.rural) orig.rural++; else if (o.emprego) orig.emprego++; else if (o.ci) orig.ci++; else if (o.sm) orig.sm++; else if (o.incap) orig.incap++; });
      linhasCar.push('Composição: ' + orig.emprego + ' mês(es) de vínculo de empregado (incluindo os presumidos), ' + orig.ci + ' de contribuinte individual ou facultativo, ' + orig.sm + ' de salário-maternidade e ' + orig.incap + ' de benefício por incapacidade' + (hib ? ' e ' + orig.rural + ' de atividade rural (segurado especial ou empregado rural), contados sem exigir recolhimento' : '') + '. Meses concomitantes contam uma vez.');
    }
    var ex = mm.ex;
    if (ex.abaixoEmp.length) linhasCar.push(ex.abaixoEmp.length + ' mês(es) de empregado abaixo do salário mínimo desde 11/2019 não foram contados (' + faixas(ex.abaixoEmp) + ').');
    if (ex.abaixoCI.length) linhasCar.push(ex.abaixoCI.length + ' mês(es) de contribuinte individual ou facultativo abaixo do mínimo não foram contados (' + faixas(ex.abaixoCI) + ').');
    if (ex.atraso.length) linhasCar.push('**' + ex.atraso.length + '** contribuição(ões) de contribuinte individual ou facultativo em atraso, feita(s) fora do período de manutenção da qualidade, não contam (' + faixas(ex.atraso) + '). Só contam a partir da primeira contribuição em dia.');
    if (ex.aposFG.length) linhasCar.push(ex.aposFG.length + ' competência(s) paga(s) depois da data do fato gerador não contam (' + faixas(ex.aposFG) + '), salvo a da própria competência do requerimento paga no vencimento.');
    if (ex.domesticoAntes.length) linhasCar.push(ex.domesticoAntes.length + ' mês(es) de vínculo de empregado doméstico antes de 06/2015 sem recolhimento no CNIS não foram presumidos (' + faixas(ex.domesticoAntes) + '): para esses meses a carência exige a prova do recolhimento.');
    if (ex.ruralAntes91.length) linhasCar.push(ex.ruralAntes91.length + ' mês(es) de empregado rural antes de 11/1991 não contam como carência na aposentadoria urbana (' + faixas(ex.ruralAntes91) + ').');
    if (hib && ex.ruralMeses) linhasCar.push('Híbrida: o tempo rural (segurado especial e empregado rural, em qualquer data) soma com o urbano **independentemente de recolhimento**, pela regra de idade da aposentadoria urbana.');
    if (ex.especial) linhasCar.push('Há período de segurado especial no CNIS: ele não conta na aposentadoria por idade urbana. Só conta na rural e na híbrida.');
    if (ex.rpps) linhasCar.push('Há vínculo de regime próprio (servidor): esse tempo não entra aqui. Seria preciso certidão de tempo de contribuição (CTC).');
    if (mm.incap) {
      if (mm.incap.contados) linhasCar.push(mm.incap.contados + ' benefício(s) por incapacidade foram contados como carência (decisões nas ACPs 0216249-77.2017.4.02.5101 e 2009.71.00.004103-4).');
      if (mm.incap.naoContados) linhasCar.push(mm.incap.naoContados + ' benefício(s) por incapacidade não foram contados' + (mm.incap.semRegra ? ': para requerimento nesta data não há decisão judicial nacional que os conte como carência' : ' (previdenciário que não está intercalado com contribuição ou atividade)') + '.');
    }
    var carOk = total >= exigida;
    var extraN = D.contarComplementos(mm.compl, mm.resp);
    if (extraN) linhasCar.push('Estão incluídos **' + extraN + '** mês(es) complementados até o salário mínimo, conforme as respostas: confira se a complementação foi (ou será) recolhida.');
    if (!carOk && !perguntas.length && (mm.compl.empBaixo.length + mm.compl.ciBaixo.length)) linhasCar.push('Mesmo complementando as competências abaixo do mínimo, a carência não é alcançada com os dados do CNIS.');
    res.carencia = {
      exigida: exigida, total: total, status: carOk ? 'cumprida' : 'nao_cumprida', ok: carOk, extra: extraN, perguntas: perguntas, linhas: linhasCar,
      rotulo: carOk ? (extraN ? 'Cumprida, com as premissas informadas' : 'Cumprida pelos dados do CNIS') : 'Não cumprida pelos dados do CNIS: faltam ' + (exigida - total)
    };

    // ----- Tempo de contribuição (urbana) ou atividade rural -----
    var pendencias = [];
    var tcOk = true;
    if (!rural) {
      var anosExig = (filiadoAntes === false && sexo === 'M') ? 20 : 15;
      var dias = uniaoDias(mm.contados);
      var dispensa = null;
      if (usaTabela && exigida < 180) dispensa = 'inscrito até 24/07/1991, segue a tabela do art. 142: basta a carência';
      else {
        var idadeAntiga = somar(nasc, sexo === 'F' ? 60 : 65, 0), ecDia = mk(2019, 11, 12);
        if (idadeAntiga.ord <= ecDia.ord) {
          var mmEc = montarMeses(analise, entrada, ecDia, { modalidade: hib ? 'hibrida' : 'urbana' });
          var totEc = Object.keys(mmEc.contados).length;
          if (totEc >= carenciaExigida(idadeAntiga.y, usaTabela)) dispensa = 'idade (' + rot(idadeAntiga) + ') e carência (' + totEc + ' meses) cumpridas antes da EC 103/2019, em 13/11/2019: direito adquirido, basta a carência';
        }
      }
      if (dispensa) anosExig = 0;
      tcOk = dias >= anosExig * 365;
      var linhasTc = ['Tempo de contribuição contado pelo CNIS (sem segurado especial, sem os meses descartados acima e sem contar duas vezes o que é concomitante): **' + C.formatarDuracao(dias) + '** (' + dias + ' dias). Exigido: **' + anosExig + ' anos**.'];
      if (!tcOk) linhasTc.push('Faltam cerca de ' + C.formatarDuracao(anosExig * 365 - dias) + ' de tempo de contribuição.');
      if (hib) { res.atividade = { ultimoMes: null, ok: true, linhas: ['O tempo rural do CNIS (segurado especial e empregado rural) foi somado ao urbano. Na híbrida ele vale mesmo que a última atividade seja urbana (Tema 1007 do STJ), mas precisa ser comprovado por autodeclaração e início de prova material (art. 106 da Lei 8.213/91).'] }; }
      res.tempo = { exigidoAnos: anosExig, dias: dias, ok: tcOk, rotulo: tcOk ? 'Cumprido pelos dados do CNIS' : 'Não cumprido pelos dados do CNIS', linhas: linhasTc };
    } else {
      var ms = Object.keys(mm.contados).map(Number).sort(function (x, y) { return x - y; });
      var ultimo = ms.length ? ms[ms.length - 1] : null;
      var lin = [];
      if (ultimo === null) lin.push('Nenhum período rural no CNIS (segurado especial ou empregado rural). A atividade rural precisaria ser comprovada por documentos.');
      else {
        var atraso = derMes - ultimo;
        lin.push('Último mês de atividade rural no CNIS: **' + rotMes(ultimo) + '**' + (atraso > 0 ? ' (' + atraso + ' mês(es) antes da DER)' : '') + '.');
        lin.push('A lei exige a atividade rural no período imediatamente anterior ao requerimento (ou à data em que completou a idade), ainda que descontínua. ' + (atraso > 12 ? '**Há mais de 12 meses sem atividade rural no CNIS: confira a prova da atividade mais recente.**' : 'O CNIS é compatível com essa exigência, mas a atividade precisa ser comprovada.'));
      }
      lin.push('Os períodos de segurado especial do CNIS não trazem contribuições: a comprovação é feita por autodeclaração e início de prova material (art. 106 da Lei 8.213/91).');
      res.atividade = { ultimoMes: ultimo, linhas: lin, ok: ultimo !== null };
    }

    // ----- Conclusão -----
    var faltas = [];
    if (!idadeOk) faltas.push('idade mínima (' + idadeExigidaTxt + ', cumprida em ' + rot(dataIdade) + ')');
    if (!carOk) faltas.push('carência (' + total + ' de ' + exigida + ' meses)');
    if (!rural && !tcOk) faltas.push('tempo de contribuição (' + C.formatarDuracao(res.tempo.dias) + ' de ' + res.tempo.exigidoAnos + ' anos)');
    var conc;
    if (!faltas.length) {
      conc = { status: 'provavel', rotulo: 'Requisitos cumpridos pelos dados do CNIS', texto: 'Com os dados do CNIS e a DER informada, idade, carência' + (rural ? '' : ' e tempo de contribuição') + ' estão cumpridos' + (extraN ? ', considerando as premissas informadas' : '') + '. Confira os documentos antes de requerer.' };
      if (rural) conc.texto = 'Idade e meses de atividade rural estão cumpridos pelos dados do CNIS. A atividade rural precisa ser comprovada por documentos (autodeclaração e início de prova material).';
    } else if (perguntas.length && perguntas.some(function (q) { return q.resposta === null; }) && idadeOk) {
      conc = { status: 'depende', rotulo: 'Depende da complementação das competências abaixo do mínimo', texto: 'Faltam requisitos pelos dados atuais (' + faltas.join('; ') + '), mas é possível alcançar a carência complementando competências abaixo do mínimo. Responda às perguntas da carência.' };
    } else {
      conc = { status: 'nao_demonstrado', rotulo: 'Requisitos ainda não demonstrados pelos dados do CNIS', texto: 'Falta: ' + faltas.join('; ') + '. Contribuições posteriores e documentos fora do CNIS podem mudar o resultado.' };
    }
    if (!idadeOk && !faltas.slice(1).length) conc.rotulo = 'Idade mínima ainda não atingida na DER';
    // pendências do CNIS que afetam a conclusão
    var abertosEmp = analise.vinculos.filter(function (v) { return v.valido && v.emAberto; });
    if (abertosEmp.length) pendencias.push('Vínculo(s) sem data de fim: ' + abertosEmp.map(function (v) { return 'Seq. ' + v.seq; }).join(', ') + ' foram contados até a última remuneração; confirme as datas com CTPS.');
    if (extraN) pendencias.push('Guias de complementação até o salário mínimo, se for o caso.');
    conc.pendencias = pendencias;
    res.conclusao = conc;
    if (rural) res.documentos = ['Documento de identificação e certidões de casamento ou nascimento dos filhos com a profissão rural', 'Autodeclaração do segurado especial e documentos de terra (contrato de arrendamento, parceria, comodato, ITR, bloco de notas do produtor, comprovante de venda)', 'CTPS dos vínculos rurais, se empregado rural', 'Documentos que cubram o período imediatamente anterior ao requerimento'];
    else if (hib) res.documentos = ['Documento de identificação com a data de nascimento', 'Para o período rural: autodeclaração do segurado especial e início de prova material (certidões, documentos de terra, notas do produtor, ITR)', 'CTPS e documentos dos vínculos sem remuneração ou sem data de fim no CNIS', 'Guias e comprovantes das contribuições de contribuinte individual e facultativo, em especial as em atraso'];
    else res.documentos = ['Documento de identificação com a data de nascimento', 'CTPS e documentos dos vínculos sem remuneração ou sem data de fim no CNIS', 'Guias e comprovantes de pagamento das contribuições de contribuinte individual e facultativo, em especial as em atraso', 'Carta de concessão dos benefícios por incapacidade e salário-maternidade, se houver'];
    return res;
  }

  function renderizar(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. Mostra os dados usados, as regras aplicadas e o que ainda falta comprovar.'));
    var box = C.el('div', 'regras'); box.appendChild(lista(r.regras)); topo.appendChild(box);
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias.slice(0, 8))); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    var n = 1;
    var s1 = C.sec(n++ + '. Idade');
    var sel = C.el('p', 'selo-linha'); sel.appendChild(C.el('span', 'selo selo-' + (r.idade.cumprida ? 'confirmada' : 'nao_demonstrada'), r.idade.cumprida ? 'Idade cumprida' : 'Idade ainda não cumprida'));
    s1.appendChild(sel); s1.appendChild(lista(r.idade.linhas)); topo.appendChild(s1);
    var s2 = C.sec(n++ + '. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.ok ? 'confirmada' : 'nao_demonstrada'), r.carencia.rotulo));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas));
    if (r.carencia.perguntas && r.carencia.perguntas.length) s2.appendChild(D.perguntasUI(r.carencia.perguntas));
    topo.appendChild(s2);
    if (r.tempo) {
      var s3 = C.sec(n++ + '. Tempo de contribuição');
      var st = C.el('p', 'selo-linha'); st.appendChild(C.el('span', 'selo selo-' + (r.tempo.ok ? 'confirmada' : 'nao_demonstrada'), r.tempo.rotulo));
      s3.appendChild(st); s3.appendChild(lista(r.tempo.linhas)); topo.appendChild(s3);
    }
    if (r.atividade) {
      var s4 = C.sec(n++ + '. Atividade rural');
      s4.appendChild(lista(r.atividade.linhas)); topo.appendChild(s4);
    }
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }

  function lerCampos(modalidade) {
    var g = function (id) { return document.getElementById(id); };
    return { modalidade: modalidade, sexo: g('ap-sexo').value, nascimento: g('ap-nasc').value, der: g('ap-der').value };
  }

  var api = { aposentadoriaIdade: aposentadoriaIdade, renderizar: renderizar, lerCampos: lerCampos, carenciaExigida: carenciaExigida, dataIdadeMulherTransicao: dataIdadeMulherTransicao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IDADE = api;
})(typeof window !== 'undefined' ? window : globalThis);
