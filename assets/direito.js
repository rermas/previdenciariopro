/*
 * Verificação preliminar de direito a benefício a partir do CNIS analisado por cnis.js.
 * Começa pelo salário-maternidade. Tudo acontece no navegador; nada é enviado ou gravado.
 * O resultado é um roteiro de conferência, não uma decisão: mostra os dados usados, as regras
 * aplicadas, os cálculos e os documentos que ainda faltam.
 */
(function (root) {
  'use strict';

  var C = root.CNIS;
  if (!C && typeof require !== 'undefined') C = require('./cnis.js');

  // Dia de vencimento da contribuição considerado para a perda da qualidade de segurado
  // (art. 30, II, da Lei 8.212/91). Sábado e domingo passam para o dia útil seguinte; feriados não são considerados.
  var DIA_VENCIMENTO = 15;
  var PRAZO_REQUERER_ANOS = 5;

  var NORMAS = [
    { nome: 'IN PRES/INSS 128/2022, arts. 357 a 361 (salário-maternidade)', vigencia: 'Texto conferido em 09/10/2026 no material fornecido; confira alterações posteriores.' },
    { nome: 'Lei 8.213/91, arts. 15 (período de graça) e 71 a 73 (salário-maternidade)', vigencia: 'Texto compilado; confira a versão vigente no Planalto.' },
    { nome: 'Lei 8.212/91, art. 30 (prazo de recolhimento)', vigencia: 'Texto compilado; confira a versão vigente no Planalto.' },
    { nome: 'STF, ADI 2.110 e ADI 2.111 (dispensa de carência) e orientação do INSS', vigencia: 'Conforme a instrução do sistema; confirme a data de vigência e a regulamentação administrativa atual.' }
  ];

  var FATOS = {
    parto: { rotulo: 'Parto com nascimento com vida', dias: 120, doc: 'Certidão de nascimento' },
    natimorto: { rotulo: 'Natimorto', dias: 120, doc: 'Certidão de natimorto ou atestado médico' },
    aborto: { rotulo: 'Aborto não criminoso', dias: 14, doc: 'Atestado médico que comprove o aborto' },
    adocao: { rotulo: 'Adoção', dias: 120, doc: 'Certidão de nascimento após a adoção e decisão judicial com trânsito em julgado' },
    guarda: { rotulo: 'Guarda judicial para fins de adoção', dias: 120, doc: 'Termo de guarda ou decisão liminar nos autos da adoção' },
    outro: { rotulo: 'Outra hipótese legal', dias: null, doc: 'Documento que comprove o evento' }
  };

  var CLASSES = {
    empregada: 'Empregada', domestica: 'Empregada doméstica', avulsa: 'Trabalhadora avulsa', ci: 'Contribuinte individual',
    mei: 'Microempreendedora individual (MEI)', desempregada: 'Desempregada em período de graça', facultativa: 'Segurada facultativa', especial: 'Segurada especial', rpps: 'Regime próprio', outra: 'Outra categoria'
  };
  var EC103 = 2019 * 12 + 10; // 11/2019: abaixo do mínimo só deixa de contar, para empregado, a partir daqui
  var DE_EMPREGO = { empregada: true, domestica: true, avulsa: true, outra: true };
  var DE_RECOLHIMENTO = { ci: true, mei: true, facultativa: true };

  // ---------- Datas ----------

  var ord = function (d) { return C.ordemDe(d.y, d.m, d.d); };
  var dObj = function (o) { return C.dataDeOrd(o); };
  var mesDe = function (d) { return C.mesDe(d.y, d.m); };
  var rotulo = C.rotuloData;
  var rotuloMes = C.rotuloMes;
  var dinheiro = C.formatarValor;

  function addAnos(d, n) {
    var t = new Date(Date.UTC(d.y + n, d.m - 1, d.d));
    if (t.getUTCMonth() !== d.m - 1) t = new Date(Date.UTC(d.y + n, d.m, 0));
    return C.dataDeOrd(t.getTime() / 86400000);
  }

  // Vencimento da contribuição da competência k (índice de mês): dia 15 do mês seguinte,
  // passando para segunda-feira quando cair em sábado ou domingo.
  function vencimento(k) {
    var kk = k + 1;
    var o = C.ordemDe(Math.floor(kk / 12), (kk % 12) + 1, DIA_VENCIMENTO);
    var dow = (o + 4) % 7; // 0 = domingo
    if (dow === 6) o += 2; else if (dow === 0) o += 1;
    return o;
  }

  // Qualidade mantida até o vencimento da contribuição do mês seguinte ao fim do prazo de graça.
  // mc: competência da cessação; meses: prazo de graça. Devolve o último dia com qualidade.
  function ultimoDiaDaQualidade(mc, meses) { return vencimento(mc + meses + 1); }

  // ---------- Classificação dos registros do CNIS ----------

  function classeDe(item) {
    var t = (item.tipo || '') + ' ';
    if (/dom[ée]stic/i.test(t)) return 'domestica';
    if (/avulso/i.test(t)) return 'avulsa';
    if (/facultativ/i.test(t)) return 'facultativa';
    if (/especial/i.test(t)) return 'especial';
    if (/individual|aut[ôo]nomo/i.test(t)) return (item.codigosIndicadores || []).indexOf('IREC-MEI') >= 0 ? 'mei' : 'ci';
    if (/empregad/i.test(t)) return 'empregada';
    if (/servidor|agente/i.test(t)) return 'rpps';
    return 'outra';
  }

  function ultimaCompetencia(item, ate) {
    var u = -1;
    Object.keys(item.contribuicoes || {}).forEach(function (k) { if (+k > u && (ate === undefined || +k <= ate)) u = +k; });
    return u;
  }

  function atrasos(item) {
    var l = [];
    Object.keys(item.pagamentos || {}).forEach(function (k) {
      var venc = vencimento(+k);
      var tarde = item.pagamentos[k].filter(function (p) { return p > venc; });
      if (tarde.length) l.push({ mes: +k, pagamento: Math.max.apply(null, tarde) });
    });
    return l.sort(function (a, b) { return a.mes - b.mes; });
  }

  // Quantidade de contribuições seguidas sem perda da qualidade de segurado, até a competência `ate`.
  // Lacunas cobertas por vínculo ou benefício não interrompem. Meses de vínculo antes de 07/1994 são presumidos como contribuição.
  function sequencia(analise, itensClasse, ate, desemp) {
    var contrib = {}, cobertos = {}, presum = {}, empMes = {};
    analise.vinculos.forEach(function (v) {
      if (!v.valido) return;
      var a = C.mesDe(v.inicio.y, v.inicio.m), b = C.mesDe(v.fimContado.y, v.fimContado.m);
      for (var k = a; k <= b; k++) {
        cobertos[k] = true;
        if (DE_EMPREGO[itensClasse[v.seq]] || itensClasse[v.seq] === 'rpps') empMes[k] = true;
        if (k < C.INICIO_PBC && DE_EMPREGO[itensClasse[v.seq]]) { presum[k] = true; contrib[k] = true; }
      }
      Object.keys(v.contribuicoes || {}).forEach(function (k) { contrib[k] = true; });
    });
    analise.beneficios.forEach(function (b) {
      if (!b.inicio) return;
      var f = b.fim || dObj(ord({ y: 9999, m: 12, d: 31 }));
      var a = mesDe(b.inicio), z = Math.min(mesDe(f), ate);
      for (var k = a; k <= z; k++) cobertos[k] = true;
    });
    var ms = Object.keys(contrib).map(Number).filter(function (k) { return k <= ate; }).sort(function (x, y) { return x - y; });
    var streak = 0, prev = null, perdas = [], mesesSeq = [];
    ms.forEach(function (m) {
      if (prev !== null && m > prev + 1) {
        var coberto = true;
        for (var k = prev + 1; k < m; k++) if (!cobertos[k]) { coberto = false; break; }
        if (!coberto) {
          var g = (streak > 120 ? 24 : 12) + (desemp && empMes[prev] ? 12 : 0); // seguro-desemprego soma 12 meses ao vínculo de empregado
          if (m > prev + g + 2) { perdas.push({ apos: prev, retorno: m }); streak = 0; mesesSeq = []; }
        }
      }
      streak++; mesesSeq.push(m);
      prev = m;
    });
    return { total: streak, ultima: prev, perdas: perdas, presumidos: mesesSeq.filter(function (k) { return presum[k]; }).length };
  }

  // ---------- Verificação do salário-maternidade ----------

  var DOCS_INCONSISTENCIA = {
    'PEXT': 'CTPS, ficha de registro, holerites e termo de rescisão',
    'PREM-EXT': 'Holerites, recibos e CTPS do período',
    'PREM-FVIN': 'Termo de rescisão e CTPS (data de saída)',
    'PREM-IVIN': 'CTPS e ficha de registro (data de admissão)',
    'PADM-EMPR': 'Documentos do empregador e prova da admissão',
    'PREM-EMPR': 'Documentos do empregador e holerites',
    'PRES-EMPR': 'Termo de rescisão e documentos do empregador',
    'PEMP-CAD': 'Cartão CNPJ ou documento do empregador',
    'IVIN-PROC-TRAB': 'Sentença ou acordo trabalhista e guias de recolhimento',
    'IREM-INDPEND': 'Holerites e GFIP/eSocial das competências com indicador',
    'IREC-INDPEND': 'Guias pagas e comprovantes de pagamento',
    'PSC-MEN-SM-EC103': 'Guias de complementação, se houver',
    'PREC-MENOR-MIN': 'Guias de complementação, se houver',
    'PREC-FACULTCONC': 'Comprovante da categoria correta de contribuição'
  };

  function lerData(x) {
    if (!x) return null;
    if (typeof x === 'string') {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
      if (!m) return null;
      return C.dataDe(m[3] + '/' + m[2] + '/' + m[1]);
    }
    return x.ord !== undefined ? x : C.dataDe(rotulo(x));
  }

  // Competências que não contam como carência pelos dados do CNIS, mas podem contar se o segurado complementar ou comprovar o vínculo.
  function complementosEm(analise, ateMes) {
    var empBaixo = [], ciBaixo = [], empSem = [], visto = {};
    (analise.abaixoMinimo || []).forEach(function (a) {
      if (a.mes > ateMes) return;
      (a.ci ? ciBaixo : empBaixo).push(a.mes);
    });
    var piso = C.mesDe(1994, 7);
    analise.vinculos.forEach(function (v) {
      if (!v.inicio) return;
      var cl = classeDe(v);
      if (cl !== 'empregada' && cl !== 'domestica' && cl !== 'avulsa') return;
      (v.mesesFaltantes || []).forEach(function (k) {
        if (k > ateMes || k < piso || visto[k] || analise.valores[k] || (analise.mesesBenIncapacidade && analise.mesesBenIncapacidade[k])) return;
        visto[k] = true; empSem.push(k);
      });
    });
    var ord = function (a, b) { return a - b; };
    return { empBaixo: empBaixo.sort(ord), ciBaixo: ciBaixo.sort(ord), empSem: empSem.sort(ord) };
  }
  // Contribuições exigidas depois do retorno, após perda da qualidade, conforme a lei vigente no fato gerador (tempus regit actum).
  function exigidaNoRetorno(exigida, ord) {
    var o = function (y, m, d) { return Date.UTC(y, m - 1, d) / 86400000; };
    if (ord <= o(2016, 7, 7)) return { n: Math.round(exigida / 3), rotulo: 'um terço (art. 24, parágrafo único, texto original da Lei 8.213/91)' };
    if (ord <= o(2016, 11, 5)) return { n: exigida, rotulo: 'carência integral (MP 739/2016, vigente de 08/07 a 05/11/2016)' };
    if (ord <= o(2019, 1, 17)) return { n: Math.ceil(exigida / 2), rotulo: 'metade (art. 27-A, Lei 13.457/2017)' };
    if (ord <= o(2019, 6, 17)) return { n: exigida, rotulo: 'carência integral (MP 871/2019, vigente de 18/01 a 17/06/2019)' };
    return { n: Math.ceil(exigida / 2), rotulo: 'metade (art. 27-A, restabelecido pela Lei 13.846/2019, desde 18/06/2019)' };
  }
  // Quantas contribuições o segurado precisa ter depois do retorno, se perder e recuperar a qualidade, conforme a data do fato gerador.
  function linhaRetorno(exigida, ord) {
    var data = C.rotuloData(C.dataDeOrd(ord));
    if (!exigida) return 'Não há carência exigida para este benefício na data do fato gerador (' + data + '): se a qualidade fosse perdida e recuperada, não haveria contribuições a refazer depois do retorno.';
    var r = exigidaNoRetorno(exigida, ord);
    return 'Se a qualidade for perdida e depois recuperada, para o fato gerador em ' + data + ' são necessárias **' + r.n + '** contribuições depois do retorno (regra: ' + r.rotulo + ') para aproveitar as contribuições anteriores; com menos que isso, a carência de ' + exigida + ' tem de ser cumprida só com as contribuições posteriores à nova filiação.';
  }
  // Qualidade "indeterminada" (só existiria com desemprego involuntário comprovado): a carência não pode aparecer como cumprida sem condição.
  function condicionarCarencia(car, q, exigida, ord) {
    if (!car || car.semQualidade || !q || q.status !== 'indeterminada' || car.status === 'nao_cumprida') return;
    car.condicional = true;
    car.rotulo = 'Depende da qualidade de segurado (desemprego involuntário)';
    var ln = (car.linhas || []).slice();
    if (car.status !== 'dispensada') {
      var l0 = 'Sem informação de seguro-desemprego/SINE, a carência considerada para o benefício é **0**' + (exigida ? ' (exigidas: ' + exigida + ')' : '') + ': a qualidade foi perdida e nenhuma contribuição anterior é aproveitada até o segurado voltar a contribuir.';
      var i = -1; ln.forEach(function (x, j) { if (i < 0 && /^Dispensar a carência/.test(x)) i = j; });
      var extra = ord !== undefined ? [l0, linhaRetorno(exigida, ord)] : [l0];
      if (i < 0) ln = ln.concat(extra); else ln.splice.apply(ln, [i, 0].concat(extra));
    }
    car.linhas = ln.concat(['Esta carência só vale se a qualidade de segurado for mantida pelo desemprego involuntário (seguro-desemprego/SINE ou comprovação equivalente). Sem isso, a qualidade foi perdida antes da data do fato gerador, e as contribuições anteriores só contam depois que o segurado voltar a contribuir e cumprir a regra de retorno do art. 27-A (veja a regra vigente na data). Marque seguro-desemprego/SINE se houve.']);
  }
  // Meses de benefício por incapacidade pago por inteiro que tinham remuneração/recolhimento mas não contam como carência.
  function linhaBenIncapacidade(analise, ateMes) {
    var ex = analise.mesesBenIncapacidade || {};
    var ks = Object.keys(analise.valores || {}).map(Number).filter(function (k) { return ex[k] && k <= ateMes; }).sort(function (x, y) { return x - y; });
    if (!ks.length) return null;
    return ks.length + ' competência(s) com remuneração ou recolhimento não foram contadas por estarem dentro de benefício por incapacidade pago por inteiro (' + ks.slice(0, 6).map(rotuloMes).join(', ') + (ks.length > 6 ? ' e outras' : '') + '). Só contam o mês de início (se começou depois do dia 1) e o mês de saída (se terminou antes do último dia), havendo recolhimento ou vínculo de empregado no mês.';
  }
  // Meses de atividade rural (segurado especial) no CNIS até certo mês, sem repetir meses sobrepostos.
  function mesesRurais(analise, ateMes) {
    var set = {};
    analise.vinculos.forEach(function (v) {
      if (!v.inicio || classeDe(v) !== 'especial') return;
      var i = C.mesDe(v.inicio.y, v.inicio.m), f = v.fim ? C.mesDe(v.fim.y, v.fim.m) : ateMes;
      for (var k = i; k <= Math.min(f, ateMes); k++) set[k] = 1;
    });
    return Object.keys(set).length;
  }
  // Tempo de segurado especial só conta como carência se for o último vínculo antes do fato gerador; senão, só na aposentadoria híbrida.
  function linhaRural(analise, classeCar, ateMes, exigidos) {
    var n = mesesRurais(analise, ateMes);
    if (!n) return null;
    if (classeCar === 'especial') return 'Atividade rural de segurado especial no CNIS até ' + rotuloMes(ateMes) + ': **' + n + '** mês(es)' + (exigidos ? (n >= exigidos ? ', suficientes para os ' + exigidos + ' meses de atividade rural exigidos' : ', menos que os ' + exigidos + ' meses exigidos: serão necessárias outras provas da atividade rural') : '') + '. O tempo rural conta como carência porque o segurado especial é o último vínculo antes do fato gerador.';
    return 'O CNIS tem **' + n + '** mês(es) como segurado especial, mas o último vínculo antes do fato gerador não é de segurado especial: esse tempo **não conta como carência** neste benefício (só soma, com o tempo urbano, na aposentadoria por idade híbrida, art. 48, § 3º, da Lei 8.213/91).';
  }
  // Quantas competências complementadas ou comprovadas (respostas "sim") contam, e quantas delas depois de certo mês.
  function contarComplementos(compl, resp, aPartirDe) {
    var f = function (l) { return aPartirDe === undefined ? l.length : l.filter(function (k) { return k >= aPartirDe; }).length; };
    return (resp.compEmp ? f(compl.empBaixo) : 0) + (resp.vincComprovado ? f(compl.empSem) : 0) + (resp.compCI ? f(compl.ciBaixo) : 0);
  }
  // Perguntas ao usuário quando essas competências fazem falta na carência. Já respondidas continuam visíveis para desfazer.
  function perguntasCarencia(compl, resp, falta, atual, exigida) {
    var defs = [
      { id: 'compEmp', lista: compl.empBaixo, texto: 'Há **%n** competência(s) de empregado com valor abaixo do salário mínimo desde 11/2019 (%l), que não contam como carência. **O segurado pretende complementar?** Se sim, contam como contribuição de um salário mínimo.' },
      { id: 'vincComprovado', lista: compl.empSem, texto: 'O vínculo de empregado tem **%n** competência(s) sem remuneração no CNIS (%l). **O vínculo está comprovado** (CTPS, contracheques, termo de rescisão)? Se sim, todas contam como carência, no valor do salário mínimo.' },
      { id: 'compCI', lista: compl.ciBaixo, texto: 'Há **%n** competência(s) de contribuinte individual ou facultativo abaixo do salário mínimo (%l), que não contam como carência. **O segurado pretende complementar?** Se sim, contam como contribuição de um salário mínimo.' }
    ];
    var pendentes = defs.filter(function (d) { return d.lista.length && resp[d.id] === undefined; }).reduce(function (t, d) { return t + d.lista.length; }, 0);
    var alcanca = atual + pendentes >= exigida;
    var out = [];
    defs.forEach(function (d) {
      if (!d.lista.length) return;
      var respondida = resp[d.id] !== undefined;
      if (!respondida && !(falta && alcanca)) return;
      var ks = d.lista;
      var l = ks.length <= 6 ? ks.map(rotuloMes).join(', ') : rotuloMes(ks[0]) + ' a ' + rotuloMes(ks[ks.length - 1]);
      out.push({ id: d.id, texto: d.texto.replace('%n', String(ks.length)).replace('%l', l), resposta: respondida ? !!resp[d.id] : null });
    });
    return out;
  }
  function perguntasUI(perguntas) {
    var box = C.el('div', 'perguntas');
    perguntas.forEach(function (p) {
      var q = C.el('div', 'pergunta');
      var t = C.el('p');
      String(p.texto).split('**').forEach(function (parte, i) {
        if (!parte) return;
        if (i % 2) t.appendChild(C.el('strong', null, parte)); else t.appendChild(document.createTextNode(parte));
      });
      q.appendChild(t);
      var bt = C.el('div', 'pergunta-botoes');
      [['Sim', true], ['Não', false]].forEach(function (o) {
        var b = C.el('button', 'btn btn-leve' + (p.resposta === o[1] ? ' marcado' : ''), o[0]); b.type = 'button';
        b.setAttribute('aria-pressed', p.resposta === o[1] ? 'true' : 'false');
        b.addEventListener('click', function () { if (api.responder) api.responder(p.id, o[1]); });
        bt.appendChild(b);
      });
      q.appendChild(bt);
      box.appendChild(q);
    });
    return box;
  }

  var REGRAS_CARENCIA_SM = [
    'Como a qualidade de segurado não foi demonstrada na data do fato gerador, a carência da pessoa **não é avaliada**. Abaixo estão as regras possíveis, só para consulta.',
    '**Empregada, empregada doméstica e trabalhadora avulsa:** sem carência, em qualquer data (art. 26, VI, da Lei 8.213/91).',
    '**Contribuinte individual, MEI e facultativa:** 10 contribuições mensais para fato gerador **antes de 05/04/2024** (art. 25, III). A partir de 05/04/2024 a carência foi dispensada (ADIs 2.110 e 2.111 do STF e regulamentação do INSS).',
    '**Segurada especial:** comprovar 10 meses de atividade rural, ainda que descontínuos, no período anterior ao requerimento (art. 39, parágrafo único), para fato gerador antes de 05/04/2024.',
    '**Desempregada em período de graça:** quando a última filiação foi de empregada, não há carência. Se a última filiação foi de contribuinte individual ou facultativa, vale a carência dessa categoria, mas o benefício pode ser concedido pela qualidade de desempregada se um vínculo de empregado anterior ainda mantiver a qualidade.',
    '**Parto antecipado:** a carência é reduzida em número de contribuições igual aos meses da antecipação (art. 25, parágrafo único).',
    '**Perda da qualidade de segurado:** ao recuperá-la, só contam as contribuições anteriores se houver, a partir da nova filiação, ao menos **metade** da carência, 5 contribuições (art. 27-A; para fatos geradores até 07/2016 vale um terço, de 08 a 11/2016 e de 18/01 a 17/06/2019 a carência integral).',
    'Dispensar a carência não dispensa a filiação ao RGPS nem a qualidade de segurado na data do fato gerador.'
  ];

  function salarioMaternidade(analise, entrada, hoje) {
    var hojeD = lerData(hoje) || hoje;
    if (hojeD.ord === undefined) hojeD = { y: hojeD.y, m: hojeD.m, d: hojeD.d, ord: C.ordemDe(hojeD.y, hojeD.m, hojeD.d) };
    var fgD = lerData(entrada.data);
    var afD = lerData(entrada.afastamento);
    var tipo = FATOS[entrada.tipo] ? entrada.tipo : 'parto';
    var fato = FATOS[tipo];
    var res = {
      beneficio: 'salario-maternidade', normas: NORMAS, entrada: entrada,
      fatoGerador: null, categoria: null, qualidade: null, carencia: null, cnis: [], especiais: [], valor: null,
      conclusao: null, documentos: []
    };
    var docs = [];
    function doc(t) { if (docs.indexOf(t) < 0) docs.push(t); }

    // ----- Etapa 1: fato gerador -----
    var fg = { tipo: tipo, rotulo: fato.rotulo, data: fgD, notas: [], valido: !!fgD };
    res.fatoGerador = fg;
    if (!fgD) {
      fg.notas.push('Informe a data do fato gerador (parto, aborto, adoção ou guarda). Não confunda com a data do requerimento.');
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'A data do fato gerador não foi informada ou é inválida.', pendencias: ['Informar a data do fato gerador.'] };
      res.documentos = [fato.doc];
      return res;
    }
    doc(fato.doc);
    var fgOrd = fgD.ord, fgMes = mesDe(fgD);
    fg.duracaoDias = fato.dias;
    if (fato.dias === null) fg.notas.push('Hipótese não prevista nesta verificação: confira a norma aplicável.');
    fg.prazoRequerer = addAnos(fgD, PRAZO_REQUERER_ANOS);
    fg.prazoExcedido = hojeD.ord > fg.prazoRequerer.ord;
    if (fg.prazoExcedido) fg.notas.push('Passaram mais de 5 anos do fato gerador (limite até ' + rotulo(fg.prazoRequerer) + '). Parcelas mais antigas podem estar prescritas; confirme a regra aplicável (art. 357, § 5º, da IN 128/2022).');
    if (fgOrd > hojeD.ord) fg.notas.push('O fato gerador está no futuro: o resultado é uma simulação.');
    if (afD && afD.ord > fgOrd) { fg.notas.push('A data de início do afastamento é posterior ao fato gerador e foi ignorada.'); afD = null; }
    fg.afastamento = afD;
    if (tipo === 'adocao' || tipo === 'guarda') fg.notas.push('Na adoção ou guarda, o benefício conta do trânsito em julgado, do termo de guarda ou da liminar. Confirme se a criança tinha até 12 anos e se não há outro beneficiário pelo mesmo processo (arts. 358, II, e 359).');
    if (entrada.internacao && tipo !== 'aborto') fg.notas.push('Casos excepcionais podem ter início e fim estendidos em até 2 semanas, com atestado médico específico e avaliação pericial (art. 358, § 2º).');
    if (entrada.falecimento) fg.notas.push('Falecimento da pessoa que teria direito: o cônjuge ou companheiro sobrevivente pode receber pelo tempo restante, se tinha qualidade de segurado e carência na data do fato gerador, e deve requerer até o último dia do prazo do benefício original (art. 360).');

    // ----- Registros do CNIS -----
    var itens = analise.vinculos.filter(function (v) { return v.inicio; });
    var classes = {};
    itens.forEach(function (v) { classes[v.seq] = classeDe(v); });

    // ----- Etapa 2: categoria e vínculos ativos -----
    var ativos = [], presumidos = [];
    // O último vínculo (o de início mais recente até o fato gerador), se for de empregado e estiver em aberto, é tratado como ativo
    // mesmo sem recolhimento nos meses anteriores: não se presume demissão no último mês com remuneração.
    var ultimoVinc = itens.filter(function (v) { return v.inicio.ord <= fgOrd; }).sort(function (a, b) { return b.inicio.ord - a.inicio.ord; })[0];
    var ultimoEmpregoAberto = ultimoVinc && !ultimoVinc.fim && (DE_EMPREGO[classes[ultimoVinc.seq]] || classes[ultimoVinc.seq] === 'rpps') ? ultimoVinc : null;
    itens.forEach(function (v) {
      var cl = classes[v.seq];
      if (v.inicio.ord > fgOrd) return;
      if (DE_EMPREGO[cl] || cl === 'rpps') {
        var encerrado = v.fim && v.fim.ord < fgOrd;
        if (encerrado) return;
        var ult = ultimaCompetencia(v);
        if (!v.fim && v !== ultimoEmpregoAberto) {
          // Sem data de fim e sem movimento há 3 meses ou mais antes do fato gerador: presume-se encerrado na última remuneração.
          var refMes = ult >= 0 ? ult : mesDe(v.inicio);
          if (fgMes - refMes >= 3) { presumidos.push({ v: v, mc: refMes, cl: cl, ult: ult }); return; }
        }
        var aviso = null;
        if (!v.fim) aviso = 'vínculo sem data de fim' + (ult >= 0 ? ' (última remuneração em ' + rotuloMes(ult) + ')' : ' e sem remuneração');
        if (!v.fim && v === ultimoEmpregoAberto) aviso += ', considerado ativo por ser o último vínculo de empregado e estar em aberto' + (ult >= 0 && fgMes - ult >= 3 ? ' (sem remuneração há ' + (fgMes - ult) + ' meses)' : '');
        else if (!v.fim && ult >= 0 && fgMes - ult >= 3) aviso += ': pode ter terminado antes do fato gerador';
        // Vínculo em aberto: último de empregado, ou com remuneração até o mês anterior ao fato gerador, não gera registro de "sem data de fim".
        if (!v.fim && (v === ultimoEmpregoAberto || (ult >= 0 && ult >= fgMes - 1))) aviso = null;
        ativos.push({ seq: v.seq, nome: v.nome, classe: cl, item: v, aviso: aviso, porDatas: true });
      } else if (cl === 'especial' && (!v.fim || v.fim.ord >= fgOrd)) {
        // Segurado especial: o CNIS traz o período de atividade rural, sem remunerações. Vale pelas datas, sujeito à prova da atividade.
        ativos.push({ seq: v.seq, nome: v.nome, classe: cl, item: v, aviso: 'período de atividade rural de segurado especial' + (v.fim ? '' : ', sem data de fim') + ': a qualidade depende da prova da atividade rural na data (o CNIS não traz remunerações)', porDatas: true, rural: true });
      } else if (DE_RECOLHIMENTO[cl] || cl === 'especial') {
        if (v.contribuicoes && v.contribuicoes[fgMes] !== undefined) {
          ativos.push({ seq: v.seq, nome: v.nome, classe: cl, item: v, aviso: null, porDatas: false });
        }
      }
    });
    var usada, motivo;
    var presumidosLista = presumidos;
    var desc = (res.categoria = { ativos: ativos.map(function (a) { return { seq: a.seq, nome: a.nome, classe: a.classe, aviso: a.aviso }; }) });
    var detectada = ativos.length ? ativos[0].classe : null;
    desc.detectada = detectada;
    if (entrada.categoria && entrada.categoria !== 'auto') {
      usada = entrada.categoria;
      motivo = 'Categoria informada por você.' + (detectada && detectada !== usada ? ' O CNIS indica ' + CLASSES[detectada].toLowerCase() + ': confira.' : '');
    } else if (detectada) {
      usada = detectada;
      motivo = ativos.length > 1 ? 'Há ' + ativos.length + ' atividades na data: ' + ativos.map(function (a) { return 'Seq. ' + a.seq + ' (' + CLASSES[a.classe].toLowerCase() + ')'; }).join(', ') + '.' : 'Vínculo ou recolhimento ativo na data do fato gerador.';
    } else {
      usada = null;
      motivo = 'Nenhum vínculo ou recolhimento ativo na data. Não se presume categoria facultativa nem desemprego só pela ausência de vínculo: veja o período de graça.';
    }
    desc.usada = usada;
    desc.motivo = motivo;
    // Fato gerador durante vínculo de empregada: em regra a empresa paga o benefício; só empregada de empresa MEI pede ao INSS.
    var empregadaAtiva = ativos.filter(function (a) { return a.classe === 'empregada'; });
    if (!entrada._sub && empregadaAtiva.length && (usada === 'empregada')) {
      fg.notas.push('Fato gerador durante vínculo de empregada (Seq. ' + empregadaAtiva.map(function (a) { return a.seq; }).join(', ') + '): **só a empregada de empresa MEI solicita o salário-maternidade no INSS**. Nas demais empresas, o benefício é **pago diretamente pela empresa**, que compensa o valor nas contribuições previdenciárias. O CNIS não informa se o empregador é MEI: confira o CNPJ do empregador.');
      doc('Se o empregador não for MEI: atestado ou certidão e comunicação à empresa, que paga o benefício. Se for MEI: requerimento ao INSS');
    }

    // ----- Etapa 3: qualidade de segurado -----
    var q = { status: null, rotulo: null, linhas: [], graca: null };
    res.qualidade = q;
    var emBeneficio = analise.beneficios.filter(function (b) {
      return b.inicio && b.inicio.ord <= fgOrd && (!b.fim || b.fim.ord >= fgOrd) && !/AUX[IÍ]LIO[ -]ACIDENTE/i.test(b.texto || '');
    })[0];
    var comPendencia = [];
    ativos.forEach(function (a) {
      (a.item.codigosIndicadores || []).forEach(function (c) {
        var d = C.INDICADORES[c];
        if (d && d[0] === 'atencao') comPendencia.push('Seq. ' + a.seq + ': ' + c);
      });
    });
    var atrasosAtivos = [];
    ativos.forEach(function (a) { if (DE_RECOLHIMENTO[a.classe]) atrasosAtivos = atrasosAtivos.concat(atrasos(a.item)); });
    var pagamentoDepoisDoFato = atrasosAtivos.some(function (x) { return x.pagamento > fgOrd; });

    function definir(status, rot) { q.status = status; q.rotulo = rot; }

    if (emBeneficio) {
      definir('confirmada', 'Confirmada pelos dados disponíveis');
      q.linhas.push('Em gozo de benefício na data do fato gerador (NB ' + (emBeneficio.nb || 's/n') + '): a qualidade se mantém sem limite de prazo, exceto no auxílio-acidente (art. 15, I, da Lei 8.213/91).');
      doc('Carta de concessão do benefício');
    } else if (ativos.length) {
      var jaDeterminado = false;
      var temAviso = ativos.some(function (a) { return a.aviso; });
      definir(temAviso || comPendencia.length || pagamentoDepoisDoFato ? 'provavel' : 'confirmada', temAviso || comPendencia.length || pagamentoDepoisDoFato ? 'Provável, dependendo de validação documental' : 'Confirmada pelos dados disponíveis');
      ativos.forEach(function (a) {
        if (a.porDatas) q.linhas.push('Seq. ' + a.seq + ' (' + a.nome + '): vínculo com início em ' + rotulo(a.item.inicio) + (a.item.fim ? ' e fim em ' + rotulo(a.item.fim) : ' e sem data de fim') + ', ativo na data do fato gerador.');
        else q.linhas.push('Seq. ' + a.seq + ' (' + a.nome + '): há contribuição da competência ' + rotuloMes(fgMes) + ' como ' + CLASSES[a.classe].toLowerCase() + '.');
        if (a.aviso) q.linhas.push('Atenção na Seq. ' + a.seq + ': ' + a.aviso + '. Não use só a última remuneração para fechar o vínculo; confirme com CTPS e termo de rescisão.');
      });
      if (comPendencia.length) q.linhas.push('Indicadores de pendência nos registros ativos: ' + comPendencia.join(', ') + '.');
      if (pagamentoDepoisDoFato) q.linhas.push('Há recolhimento pago depois do fato gerador (' + atrasosAtivos.filter(function (x) { return x.pagamento > fgOrd; }).map(function (x) { return rotuloMes(x.mes); }).join(', ') + '). Uma contribuição tardia não garante o benefício: é preciso demonstrar a atividade e a filiação na data.');
      if (ativos.some(function (a) { return a.classe === 'facultativa'; })) {
        var primeiros = [];
        ativos.forEach(function (a) { if (a.classe === 'facultativa') Object.keys(a.item.pagamentos || {}).forEach(function (k) { primeiros = primeiros.concat(a.item.pagamentos[k]); }); });
        if (primeiros.length && Math.min.apply(null, primeiros) > fgOrd) {
          definir('nao_demonstrada', 'Não demonstrada na data relevante');
          q.linhas.push('Facultativa: o primeiro recolhimento é posterior ao fato gerador (' + rotulo(dObj(Math.min.apply(null, primeiros))) + '). A filiação do facultativo só ocorre com a primeira contribuição.');
        }
      }
      doc('CTPS e termo de rescisão ou ficha de registro, para confirmar as datas do vínculo');
      if (ativos.some(function (a) { return DE_RECOLHIMENTO[a.classe]; })) doc('Comprovantes de pagamento das guias e prova da atividade, no caso de contribuinte individual');
    } else {
      // Período de graça: última cobertura anterior ao fato gerador.
      var cands = [];
      itens.forEach(function (v) {
        var cl = classes[v.seq];
        if (v.inicio.ord > fgOrd) return;
        if (DE_EMPREGO[cl] || cl === 'rpps') {
          if (v.fim && v.fim.ord < fgOrd) cands.push({ fim: v.fim.ord, mc: mesDe(v.fim), classe: cl, seq: v.seq, nome: v.nome, origem: 'vínculo encerrado em ' + rotulo(v.fim) });
          else if (!v.fim) {
            var pz = presumidos.filter(function (x) { return x.v === v; })[0];
            if (pz) cands.push({ fim: C.ultimoDiaDoMes(pz.mc), mc: pz.mc, classe: cl, seq: v.seq, nome: v.nome, presumido: true, origem: 'vínculo sem data de fim, tratado como encerrado na ' + (pz.ult >= 0 ? 'última remuneração (' + rotuloMes(pz.mc) + ')' : 'competência de início (' + rotuloMes(pz.mc) + '), sem remuneração') });
          }
        } else if (DE_RECOLHIMENTO[cl] || cl === 'especial') {
          var u = ultimaCompetencia(v, fgMes);
          if (cl === 'especial' && v.fim && v.fim.ord < fgOrd) cands.push({ fim: v.fim.ord, mc: mesDe(v.fim), classe: cl, seq: v.seq, nome: v.nome, origem: 'período de atividade rural (segurado especial) encerrado em ' + rotulo(v.fim) });
          else if (u >= 0) cands.push({ fim: C.ultimoDiaDoMes(u), mc: u, classe: cl, seq: v.seq, nome: v.nome, origem: 'última contribuição da competência ' + rotuloMes(u) });
        }
      });
      analise.beneficios.forEach(function (b) {
        if (b.inicio && b.fim && b.fim.ord < fgOrd && !/AUX[IÍ]LIO[ -]ACIDENTE/i.test(b.texto || '')) cands.push({ fim: b.fim.ord, mc: mesDe(b.fim), classe: 'beneficio', seq: b.seq, nome: 'benefício ' + (b.nb || ''), origem: 'benefício encerrado em ' + rotulo(b.fim) });
      });
      cands.sort(function (x, y) { return y.fim - x.fim; });
      var ultimo = cands[0];
      if (!ultimo) {
        definir('nao_demonstrada', 'Não demonstrada na data relevante');
        q.linhas.push('Não há vínculo, recolhimento nem benefício do CNIS até a data do fato gerador. Se houver atividade rural ou registros fora do CNIS, é preciso comprová-los por documentos.');
        doc('Documentos que comprovem atividade ou contribuição anterior ao fato gerador');
      } else {
        var seqCls = {}; Object.keys(classes).forEach(function (k) { seqCls[k] = classes[k]; });
        var calcGraca = function (u) {
          var sqU = sequencia(analise, seqCls, u.mc, !!entrada.desemprego);
          var fac = u.classe === 'facultativa';
          var b = fac ? 6 : 12;
          var e120 = !fac && sqU.total > 120;
          var a1 = ultimoDiaDaQualidade(u.mc, b);
          var a24 = !fac ? ultimoDiaDaQualidade(u.mc, b + 12) : null;
          var aDes = !fac ? ultimoDiaDaQualidade(u.mc, (e120 ? 24 : 12) + 12) : null;
          return { u: u, sq: sqU, facult: fac, base: b, ate120: e120, ate: a1, ate24: a24, ateDes: aDes, prazoFinal: e120 ? a24 : a1 };
        };
        var ultimoOrig = ultimo;
        var g1 = calcGraca(ultimo), notaFac = null;
        if (g1.facult && fgOrd > g1.prazoFinal) {
          // Facultativa perde a qualidade em 6 meses: confere se a atividade obrigatória anterior ainda a mantém (12/24 meses, +12 com desemprego).
          var alt = cands.filter(function (c) { return c.classe !== 'facultativa'; })[0];
          if (alt) {
            var g2 = calcGraca(alt);
            var fim2 = g2.ateDes || g2.prazoFinal;
            if (fim2 > g1.prazoFinal) {
              notaFac = 'Como facultativa, o prazo de 6 meses terminou em ' + rotulo(dObj(g1.prazoFinal)) + ', antes do fato gerador. Mas houve atividade anterior como ' + (alt.classe === 'beneficio' ? 'benefício' : CLASSES[alt.classe].toLowerCase()) + ' (Seq. ' + alt.seq + ', ' + alt.origem + '), que mantém a qualidade pelo prazo da categoria obrigatória (12 meses, 24 com mais de 120 contribuições, e mais 12 com seguro-desemprego/SINE). A conferência passa a usar essa atividade.';
              g1 = g2; ultimo = alt;
            }
          }
        }
        // Seguro-desemprego/SINE soma 12 meses ao último vínculo de empregado, mesmo que depois dele haja contribuições como CI/facultativa.
        var viaDes = null;
        if (['ci', 'mei', 'facultativa'].indexOf(ultimoOrig.classe) >= 0) {
          var empUlt = cands.filter(function (c) { return DE_EMPREGO[c.classe] || c.classe === 'rpps'; })[0];
          if (empUlt) {
            var perdasSem = sequencia(analise, seqCls, ultimoOrig.mc, false).perdas.length;
            var perdasCom = sequencia(analise, seqCls, ultimoOrig.mc, true).perdas.length;
            if (perdasSem > perdasCom) {
              var gE = calcGraca(empUlt);
              viaDes = { emp: empUlt, ate: gE.ateDes, aplicado: !!entrada.desemprego };
            }
          }
        }
        var sq = g1.sq, facult = g1.facult, base = g1.base, ate120 = g1.ate120, ate = g1.ate, ate24 = g1.ate24, ateDes = g1.ateDes, prazoFinal = g1.prazoFinal;
        q.graca = {
          classe: ultimo.classe, dataInicial: ultimo.origem, competenciaCessacao: rotuloMes(ultimo.mc), categoria: ultimo.classe === 'beneficio' ? 'Benefício' : CLASSES[ultimo.classe],
          prazoBase: base, contribuicoes: sq.total, extensao120: ate120, presumidos: sq.presumidos,
          ateBase: dObj(ate), ateComExtensao: ate120 ? dObj(ate24) : null, ateComDesemprego: ateDes ? dObj(ateDes) : null
        };
        if (presumidos.length) {
          q.linhas.push(presumidos.length + ' vínculo(s) sem data de fim foram tratados como encerrados na última remuneração, por não terem movimento nos 3 meses anteriores ao fato gerador: ' + presumidos.slice(0, 8).map(function (x) { return 'Seq. ' + x.v.seq + ' (' + rotuloMes(x.mc) + ')'; }).join(', ') + (presumidos.length > 8 ? ' e mais ' + (presumidos.length - 8) : '') + '. É uma presunção: se algum deles estava ativo na data, a qualidade existe e a conclusão muda.');
          doc('CTPS e termos de rescisão dos vínculos sem data de fim, para confirmar se estavam ativos na data do fato gerador');
        }
        q.linhas.push('Sem vínculo ou recolhimento ativo na data. Última cobertura: Seq. ' + ultimo.seq + ' (' + ultimo.nome + '), ' + ultimo.origem + '.');
        if (notaFac) q.linhas.push(notaFac);
        q.linhas.push('Categoria considerada: ' + q.graca.categoria.toLowerCase() + '. Prazo-base: ' + base + ' meses' + (facult ? ' (facultativa)' : ' (art. 15, II, da Lei 8.213/91)') + '.');
        q.linhas.push('Contagem: a qualidade se mantém até o vencimento da contribuição do mês seguinte ao fim do prazo (dia ' + DIA_VENCIMENTO + ', passando para o dia útil seguinte se cair em fim de semana): até ' + rotulo(dObj(ate)) + ' no prazo-base. Não é somar 12 meses à data da última contribuição.');
        if (!facult) {
          q.linhas.push('Contribuições seguidas sem perda da qualidade até a cessação: ' + sq.total + (sq.presumidos ? ' (inclui ' + sq.presumidos + ' mês(es) de vínculo anteriores a 07/1994, presumidos)' : '') + '. ' +
            (ate120 ? 'Mais de 120: o prazo passa a 24 meses (art. 15, § 1º), até ' + rotulo(dObj(ate24)) + '.' : 'Não passa de 120, então não há prorrogação para 24 meses.'));
          q.linhas.push('Seguro-desemprego/SINE (desemprego involuntário) soma mais 12 meses (art. 15, § 2º): a qualidade iria até ' + rotulo(dObj(ateDes)) + '.');
        }
        var indicioSeguro = analise.eventos.filter(function (e) { return /SEGURO[- ]DESEMPREGO/i.test(e.texto || ''); })[0];
        if (indicioSeguro) q.linhas.push('O CNIS registra evento de seguro-desemprego (' + (indicioSeguro.inicio ? rotulo(indicioSeguro.inicio) : 's/d') + (indicioSeguro.fim ? ' a ' + rotulo(indicioSeguro.fim) : '') + '): é um indício de desemprego, mas não substitui o registro no órgão próprio.');
        var des = !!entrada.desemprego;
        if (viaDes) {
          if (viaDes.aplicado) q.linhas.push('Com seguro-desemprego/SINE, o último vínculo de empregado (Seq. ' + viaDes.emp.seq + ', ' + viaDes.emp.origem + ') mantém a qualidade, pelo prazo normal mais 12 meses, até ' + rotulo(dObj(viaDes.ate)) + '. Por isso não houve perda da qualidade antes do retorno como ' + CLASSES[ultimoOrig.classe].toLowerCase() + '. A categoria, a carência e o valor seguem a filiação do último recolhimento (' + CLASSES[ultimoOrig.classe].toLowerCase() + ').');
          else { q.linhas.push('Sem seguro-desemprego/SINE, houve perda da qualidade entre o vínculo de empregado (Seq. ' + viaDes.emp.seq + ') e o retorno como ' + CLASSES[ultimoOrig.classe].toLowerCase() + '. Com seguro-desemprego/SINE, a qualidade desse vínculo iria até ' + rotulo(dObj(viaDes.ate)) + ' e não haveria perda.'); doc('Comprovante do seguro-desemprego ou registro no SINE, se houver'); }
        }
        if (fgOrd <= prazoFinal) {
          definir('confirmada', 'Confirmada pelos dados disponíveis');
          q.linhas.push('Fato gerador em ' + rotulo(fgD) + ': dentro do período de graça (' + rotulo(dObj(prazoFinal)) + ').');
          if (ultimo.classe === 'beneficio') q.linhas.push('Depois da cessação do benefício, o prazo seguinte conta como período de graça.');
        } else if (ateDes && fgOrd <= ateDes) {
          if (des) { definir('provavel', 'Provável, dependendo de validação documental'); q.linhas.push('Fato gerador depois do prazo normal, mas dentro da prorrogação por seguro-desemprego/SINE, que você informou.'); }
          else { definir('indeterminada', 'Indeterminada por falta de informações'); q.linhas.push('Fato gerador depois do prazo normal (' + rotulo(dObj(prazoFinal)) + '). Só haveria qualidade com desemprego involuntário comprovado, e isso não foi informado.'); }
          doc('Comprovação do desemprego: registro no órgão próprio (SINE/MTE), seguro-desemprego ou CTPS com rescisão sem justa causa');
        } else {
          definir('possivelmente_perdida', 'Possivelmente perdida');
          q.linhas.push('Fato gerador em ' + rotulo(fgD) + ', depois do fim do período de graça' + (ateDes ? ' mesmo com a prorrogação por desemprego (' + rotulo(dObj(ateDes)) + ')' : '') + '. A perda não é automática: outras atividades, benefícios ou provas fora do CNIS podem mudar o resultado.');
          doc('Documentos de atividade ou contribuição que não aparecem no CNIS');
        }
        if (!entrada.categoria || entrada.categoria === 'auto') {
          var oc = ultimoOrig.classe;
          if ((oc === 'ci' || oc === 'mei' || oc === 'facultativa') && (q.status === 'confirmada' || q.status === 'provavel')) {
            usada = oc; desc.usada = oc;
            desc.motivo = 'Sem atividade na data, mas a qualidade se mantém e a última contribuição (Seq. ' + ultimoOrig.seq + ') foi como ' + CLASSES[oc].toLowerCase() + ': a filiação do último recolhimento é a categoria considerada na análise, inclusive na carência e no valor.' + (viaDes && viaDes.aplicado ? ' O seguro-desemprego/SINE só evita a perda da qualidade entre o vínculo de empregado e esse retorno.' : '');
          } else if ((DE_EMPREGO[oc] || oc === 'rpps') && (!ultimoOrig.presumido || fgMes - ultimoOrig.mc > 2)) {
            usada = 'desempregada'; desc.usada = usada;
            desc.motivo = ultimoOrig.presumido
              ? 'O último vínculo (Seq. ' + ultimoOrig.seq + ') não tem data de fim e foi tratado como encerrado na última remuneração (' + rotuloMes(ultimoOrig.mc) + '), mais de 2 meses antes do fato gerador: desempregada, em período de graça.'
              : 'O último vínculo (Seq. ' + ultimoOrig.seq + ') terminou em ' + rotulo(dObj(ultimoOrig.fim)) + ', antes do fato gerador: desempregada, em período de graça.';
          }
        }
        if (sq.perdas.length) q.linhas.push('Interrupções que acarretaram perda da qualidade no histórico: ' + sq.perdas.map(function (p) { return 'depois de ' + rotuloMes(p.apos) + ' até ' + rotuloMes(p.retorno); }).join('; ') + '.');
      }
    }
    // Parto sem qualidade na data: o benefício pode começar na DAT, até 28 dias antes do parto. Confere a qualidade nessa data.
    if (!entrada._sub && (tipo === 'parto' || tipo === 'natimorto') && ['possivelmente_perdida', 'nao_demonstrada', 'indeterminada'].indexOf(q.status) >= 0) {
      var dtAfast = (afD && afD.ord >= fgOrd - 28) ? afD : dObj(fgOrd - 28);
      var antes = salarioMaternidade(analise, Object.assign({}, entrada, { data: dtAfast, afastamento: null, _sub: true }), hoje);
      var qa = antes.qualidade && antes.qualidade.status;
      if (qa === 'confirmada' || qa === 'provavel') {
        q.status = 'provavel'; q.rotulo = 'Provável, dependendo da comprovação do afastamento';
        q.antecipada = dtAfast;
        q.linhas.push('Na data do parto (' + rotulo(fgD) + ') a qualidade não está demonstrada, mas em ' + rotulo(dtAfast) + ' (' + (fgOrd - dtAfast.ord) + ' dia(s) antes, dentro do limite de 28 dias da DAT) ela existia. Se o afastamento ocorreu nessa data ou antes, dentro dos 28 dias, o benefício pode ser fixado na DAT (art. 358, I). A IN 128/2022 exceta quem está em período de graça nessa antecipação: confirme o enquadramento.');
        doc('Atestado médico ou documento que comprove a data do afastamento (até 28 dias antes do parto)');
      } else {
        q.linhas.push('Também foi conferida a data 28 dias antes do parto (' + rotulo(dtAfast) + '), em que o benefício poderia começar na DAT: a qualidade também não está demonstrada nela.');
      }
    }
    q.linhas.push('Contribuições posteriores ao fato gerador não criam qualidade retroativa.');

    // ----- Etapa 4: carência -----
    var validasAte = 0;
    Object.keys(analise.valores).forEach(function (k) {
      if (+k > fgMes || (analise.mesesBenIncapacidade && analise.mesesBenIncapacidade[k])) return;
      var tot = analise.valores[k].reduce(function (t, x) { return t + x.valor; }, 0);
      var m = C.minimoDe(+k);
      var soCI = analise.valores[k].every(function (x) { return /individual|aut[ôo]nomo|facultativ/i.test(x.tipo || ''); });
      if (m !== null && (tot + 0.004 >= m || (!soCI && +k < EC103))) validasAte++;
    });
    // Complementação e comprovação informadas pelo usuário: as competências contam como salário mínimo.
    var respCar = { compEmp: entrada.compEmp, vincComprovado: entrada.vincComprovado, compCI: entrada.compCI };
    var compl = complementosEm(analise, fgMes);
    var extraCar = contarComplementos(compl, respCar);
    validasAte += extraCar;
    var classeCar = (usada && usada !== 'desempregada') ? usada : (q.graca ? q.graca.classe : null);
    var DATA_DISPENSA = C.ordemDe(2024, 4, 5);
    var exigeCar = !entrada._semCarencia && fgOrd < DATA_DISPENSA && ['ci', 'mei', 'facultativa', 'especial'].indexOf(classeCar) >= 0;
    var CARENCIA = 10;
    res.carencia = { status: 'dispensada', rotulo: 'Dispensada', linhas: [], competenciasValidas: validasAte, exigida: exigeCar ? CARENCIA : 0, complementos: compl, respostas: respCar, extra: extraCar, perguntas: [] };
    var cl = res.carencia.linhas;
    if (exigeCar) {
      var sqFg = sequencia(analise, classes, fgMes, !!entrada.desemprego);
      var depoisPerda = sqFg.perdas.length > 0;
      var ok10 = validasAte >= CARENCIA;
      var retornoMes = depoisPerda ? sqFg.perdas[sqFg.perdas.length - 1].retorno : undefined;
      var okTerco = !depoisPerda || sqFg.total + contarComplementos(compl, respCar, retornoMes) >= exigidaNoRetorno(CARENCIA, fgOrd).n;
      cl.push('Fato gerador em ' + rotulo(fgD) + ', antes de 05/04/2024: para ' + CLASSES[classeCar].toLowerCase() + ' a carência é de ' + CARENCIA + ' contribuições mensais (art. 25, III, da Lei 8.213/91). A dispensa para essas categorias vale só a partir de 05/04/2024. Empregada, doméstica e avulsa não têm carência em nenhuma data.');
      cl.push('Competências do CNIS de 07/1994 até ' + rotuloMes(fgMes) + ' com valor igual ou acima do salário mínimo' + (extraCar ? ', mais ' + extraCar + ' complementada(s) ou comprovada(s) a pedido' : '') + ': ' + validasAte + '.');
      if (extraCar) cl.push('Foram contadas ' + extraCar + ' competência(s) como contribuição de um salário mínimo, conforme as respostas: confira se a complementação foi (ou será) recolhida e se o vínculo está documentado.');
      if (depoisPerda) cl.push('Houve perda da qualidade no histórico (depois de ' + rotuloMes(sqFg.perdas[sqFg.perdas.length - 1].apos) + '): ao recuperá-la, só contam as contribuições anteriores se houver, depois do retorno, ao menos ' + exigidaNoRetorno(CARENCIA, fgOrd).n + ' contribuições, regra vigente no fato gerador: ' + exigidaNoRetorno(CARENCIA, fgOrd).rotulo + '. Depois do retorno: ' + sqFg.total + '.');
      cl.push('Parto antecipado reduz a carência em igual número de meses da antecipação (art. 25, parágrafo único): não aplicado aqui.');
      if (ok10 && okTerco) { res.carencia.status = 'cumprida'; res.carencia.rotulo = extraCar ? 'Cumprida, com as premissas informadas' : 'Cumprida pelos dados do CNIS'; }
      else { res.carencia.status = 'nao_cumprida'; res.carencia.rotulo = 'Não cumprida pelos dados do CNIS'; doc('Guias de recolhimento e provas de atividade que completem a carência, se não constarem do CNIS'); }
      res.carencia.perguntas = perguntasCarencia(compl, respCar, !(ok10 && okTerco), validasAte, CARENCIA);
      if (!(ok10 && okTerco) && !res.carencia.perguntas.length && compl.empBaixo.length + compl.empSem.length + compl.ciBaixo.length) cl.push('Mesmo contando as competências que dependem de complementação ou de comprovação do vínculo, a carência não seria atingida.');
      if (extraCar) doc('Guias de complementação até o salário mínimo, se for o caso');
    } else {
      cl.push(fgOrd >= DATA_DISPENSA ? 'Fato gerador em ' + rotulo(fgD) + ', a partir de 05/04/2024: carência dispensada para todas as categorias (ADIs 2.110 e 2.111 do STF e regulamentação do INSS).' : 'Empregada, doméstica e avulsa não têm carência para o salário-maternidade (art. 26, VI, da Lei 8.213/91).' + (classeCar ? '' : ' Categoria não identificada: se for contribuinte individual, MEI, facultativa ou segurada especial, a carência de 10 contribuições vale para fatos geradores antes de 05/04/2024.'));
    }
    var lb = linhaBenIncapacidade(analise, fgMes);
    if (lb) cl.push(lb);
    var lr = classeCar ? linhaRural(analise, classeCar, fgMes, 10) : null;
    if (lr) cl.push(lr);
    cl.push('Dispensar a carência não dispensa a filiação ao RGPS nem a qualidade de segurado na data do fato gerador, nem a validade das contribuições.');
    cl.push('Uma única contribuição, mesmo paga depois do fato gerador, não garante o benefício por si só.');
    if (atrasosAtivos.length) res.carencia.linhas.push('Há recolhimentos em atraso (' + atrasosAtivos.length + '): verifique se são válidos para demonstrar filiação e cobertura na situação analisada.');

    // Sem carência como CI/MEI/facultativa: confere se algum vínculo de empregado anterior ainda mantém a qualidade (desempregada, sem carência).
    var classeEfet = null;
    if (res.carencia.status === 'nao_cumprida' && ['ci', 'mei', 'facultativa'].indexOf(classeCar) >= 0) {
      var empC = null;
      itens.forEach(function (v) {
        var cl2 = classes[v.seq];
        if (!(DE_EMPREGO[cl2] || cl2 === 'rpps') || v.inicio.ord > fgOrd) return;
        var fimC = null, mcC = null, orig = null;
        if (v.fim && v.fim.ord < fgOrd) { fimC = v.fim.ord; mcC = mesDe(v.fim); orig = 'vínculo encerrado em ' + rotulo(v.fim); }
        else if (!v.fim && v !== ultimoEmpregoAberto) {
          var u2 = ultimaCompetencia(v), ref2 = u2 >= 0 ? u2 : mesDe(v.inicio);
          if (fgMes - ref2 >= 3) { fimC = C.ultimoDiaDoMes(ref2); mcC = ref2; orig = 'vínculo sem data de fim, tratado como encerrado em ' + rotuloMes(ref2); }
        }
        if (fimC !== null && (!empC || fimC > empC.fim)) empC = { fim: fimC, mc: mcC, seq: v.seq, nome: v.nome, classe: cl2, origem: orig };
      });
      if (empC) {
        var sqE = sequencia(analise, classes, empC.mc, !!entrada.desemprego);
        var e120 = sqE.total > 120;
        var ateE = ultimoDiaDaQualidade(empC.mc, e120 ? 24 : 12);
        var ateEDes = ultimoDiaDaQualidade(empC.mc, (e120 ? 24 : 12) + 12);
        var porNormal = fgOrd <= ateE, porSeguro = !porNormal && fgOrd <= ateEDes;
        if (porNormal || (porSeguro && entrada.desemprego)) {
          classeEfet = empC.classe;
          usada = 'desempregada'; res.categoria.usada = usada;
          res.categoria.motivo = 'Pelos recolhimentos como ' + CLASSES[classeCar].toLowerCase() + ' não havia carência. O benefício é analisado pela qualidade de desempregada, com base no vínculo de empregado (Seq. ' + empC.seq + ', ' + empC.origem + '), que ainda mantém a qualidade e não exige carência.';
          q.status = porNormal ? 'confirmada' : 'provavel';
          q.rotulo = porNormal ? 'Confirmada pelos dados disponíveis' : 'Provável, dependendo de validação documental';
          q.linhas.push('Concedido pelo desemprego: como ' + CLASSES[classeCar].toLowerCase() + ' não havia carência, mas o vínculo de empregado da Seq. ' + empC.seq + ' (' + empC.origem + ') mantém a qualidade até ' + rotulo(dObj(porNormal ? ateE : ateEDes)) + (porNormal ? ' (período de graça' + (e120 ? ' de 24 meses, com mais de 120 contribuições' : ' de 12 meses') + ')' : ' (prazo normal mais 12 meses de seguro-desemprego/SINE)') + '. A carência não é exigida de quem tem essa filiação.');
          if (porSeguro) doc('Comprovante do seguro-desemprego ou registro no SINE');
          doc('CTPS e termo de rescisão do vínculo de empregado da Seq. ' + empC.seq);
          res.concessaoDesemprego = { vinculo: empC.seq, categoriaAnterior: classeCar, ate: dObj(porNormal ? ateE : ateEDes), porSeguro: porSeguro };
          res.carencia.status = 'dispensada'; res.carencia.rotulo = 'Dispensada (concedido pela qualidade de desempregada)';
          res.carencia.linhas.unshift('Como ' + CLASSES[classeCar].toLowerCase() + ', as ' + validasAte + ' contribuição(ões) válida(s) não completam a carência de ' + CARENCIA + '. O benefício passa a ser analisado como desempregada, sem carência.');
        } else if (porSeguro) {
          res.carencia.linhas.push('Com seguro-desemprego/SINE, o vínculo de empregado da Seq. ' + empC.seq + ' (' + empC.origem + ') manteria a qualidade até ' + rotulo(dObj(ateEDes)) + ', e o benefício poderia ser concedido como desempregada, sem carência. Marque seguro-desemprego/SINE se houve.');
          doc('Comprovante do seguro-desemprego ou registro no SINE, se houver');
        }
      }
    }

    // ----- Etapa 5: validade do CNIS -----
    var relevantes = ativos.map(function (a) { return a.item; });
    var ultimoSeq = q.graca ? null : null;
    function add(achado, impacto, documento, impede, providencia) { res.cnis.push({ achado: achado, impacto: impacto, documento: documento, impede: impede, providencia: providencia }); }
    ativos.forEach(function (a) {
      if (!a.item.fim && a.aviso && !a.rural) {
        add('Seq. ' + a.seq + ': vínculo sem data de fim.', 'Não dá para afirmar que estava ativo na data do fato gerador sem a data de saída.', 'CTPS, termo de rescisão ou declaração do empregador', true, 'Pedir a atualização do vínculo no CNIS com os documentos (arts. 19 a 19-F do RPS).');
      }
      (a.item.codigosIndicadores || []).forEach(function (c) {
        var d = C.INDICADORES[c];
        if (!d || d[0] !== 'atencao') return;
        add('Seq. ' + a.seq + ': ' + c + ' (' + d[1] + ').', 'Pode levar o INSS a não validar o vínculo ou a remuneração sem comprovação.', DOCS_INCONSISTENCIA[c] || 'Documentos do período', true, 'Reunir os documentos e pedir a regularização ou a validação do dado.');
      });
      if (a.item.faltantes && a.item.mesesFaltantes) {
        var perto = a.item.mesesFaltantes.filter(function (k) { return k >= fgMes - 15 && k <= fgMes; });
        if (perto.length) add('Seq. ' + a.seq + ': ' + perto.length + ' competência(s) sem remuneração nos 15 meses anteriores (' + perto.map(rotuloMes).join(', ') + ').', 'Pode alterar o valor do benefício e indica omissão no CNIS.', 'Holerites e GFIP/eSocial dessas competências', false, 'Pedir a inclusão das remunerações faltantes.');
      }
    });
    if (ativos.length > 1) add('Atividades simultâneas na data (' + ativos.map(function (a) { return 'Seq. ' + a.seq; }).join(', ') + ').', 'Cada atividade pode gerar benefício próprio, e atividades em período de graça não contam (art. 361).', 'Documentos de cada atividade', false, 'Conferir qual atividade continua e calcular cada benefício.');
    if (atrasosAtivos.length) add('Recolhimento(s) em atraso: ' + atrasosAtivos.slice(0, 6).map(function (x) { return rotuloMes(x.mes); }).join(', ') + (atrasosAtivos.length > 6 ? ' e mais ' + (atrasosAtivos.length - 6) : '') + '.', 'A validade para filiação e qualidade depende da categoria e das datas de pagamento.', 'Comprovantes de pagamento e prova da atividade', pagamentoDepoisDoFato, 'Comprovar a atividade no período e a regularidade do recolhimento.');
    var depois = {};
    analise.vinculos.forEach(function (v) { Object.keys(v.contribuicoes || {}).forEach(function (k) { if (+k > fgMes) depois[k] = true; }); });
    var dep = Object.keys(depois).map(Number).sort(function (a, b) { return a - b; });
    if (dep.length) add('Há ' + dep.length + ' competência(s) com contribuição depois do mês do fato gerador (a partir de ' + rotuloMes(dep[0]) + ').', 'Não afastam nem criam a qualidade na data do fato gerador, mas podem indicar retorno ao trabalho: o benefício exige afastamento (art. 357, § 2º).', 'Comprovante do afastamento no período do benefício', false, 'Conferir se o afastamento foi respeitado.');
    analise.pendencias.forEach(function (p) {
      if (/vínculo sem nenhuma remuneração/i.test(p.msg) || /fora do período do vínculo/i.test(p.msg)) {
        add((p.ref ? p.ref + ': ' : '') + p.msg, 'Pode indicar erro de data ou de lançamento no vínculo.', 'CTPS e holerites', false, 'Pedir a correção das datas ou remunerações.');
      }
    });
    if (analise.resumo.semRemuneracoes) add('O documento não traz remunerações nem recolhimentos.', 'Não é possível avaliar contribuições, atrasos nem o valor do benefício.', 'Extrato Previdenciário completo do CNIS', false, 'Gerar o extrato completo e repetir a verificação.');

    // ----- Etapa 6: situações especiais -----
    function esp(nome, situacao, texto) { res.especiais.push({ nome: nome, situacao: situacao, texto: texto }); }
    var semAtivo = !ativos.length && !emBeneficio;
    esp('Segurada desempregada', semAtivo ? 'aplica' : 'nao', semAtivo ? 'Sem vínculo ativo: a qualidade depende do período de graça e do seguro-desemprego/SINE.' : 'Há vínculo, recolhimento ou benefício na data.');
    var meiAtivo = ativos.filter(function (a) { return a.classe === 'mei'; })[0];
    var contMEI = meiAtivo ? Object.keys(meiAtivo.item.contribuicoes).length : 0;
    esp('MEI com poucas contribuições', meiAtivo && contMEI < 10 ? 'verificar' : 'nao', meiAtivo ? 'MEI com ' + contMEI + ' contribuição(ões) no CNIS. A carência está dispensada, mas confira a regularidade e o início da atividade.' : 'Não há MEI ativo na data.');
    var ciAtrasos = atrasosAtivos.filter(function (x) { return ativos.some(function (a) { return a.classe === 'ci' || a.classe === 'mei'; }); });
    esp('Contribuinte individual com recolhimentos em atraso', ciAtrasos.length ? 'verificar' : 'nao', ciAtrasos.length ? ciAtrasos.length + ' recolhimento(s) em atraso: confirme a validade e a prova da atividade.' : 'Sem atraso identificado (as datas de pagamento nem sempre constam do extrato).');
    var facAtiva = ativos.filter(function (a) { return a.classe === 'facultativa'; })[0];
    esp('Facultativa com início recente de contribuições', facAtiva && Object.keys(facAtiva.item.contribuicoes).length < 12 ? 'verificar' : 'nao', facAtiva ? 'Facultativa com ' + Object.keys(facAtiva.item.contribuicoes).length + ' contribuição(ões): a filiação conta da primeira contribuição paga.' : 'Não há facultativa ativa na data.');
    esp('Segurada especial rural', (usada === 'especial' || entrada.categoria === 'especial') ? 'verificar' : 'nao', 'Exige prova da atividade rural (autodeclaração, documentos de terra, notas de produtor e outros), que o CNIS pode não trazer. Esta verificação não conclui sozinha.');
    var omissao = ativos.some(function (a) { return !!a.aviso || (a.item.mesesFaltantes || []).some(function (k) { return k >= fgMes - 15 && k <= fgMes; }); });
    esp('Empregada com vínculo ativo e omissões no CNIS', omissao ? 'verificar' : 'nao', omissao ? 'O vínculo ativo tem omissões (sem data de fim ou competências sem remuneração): documente com CTPS e holerites.' : 'Sem omissões relevantes nos vínculos ativos.');
    esp('Atividades concomitantes', ativos.length > 1 ? 'aplica' : 'nao', ativos.length > 1 ? 'Há mais de uma atividade na data. Se uma delas estiver em período de graça por causa da outra, não gera benefício separado (art. 361). Quando o desligamento é só de uma atividade, o benefício é devido pela que continua (§ 2º).' : 'Há no máximo uma atividade na data.');
    esp('Afastamento médico anterior ao parto', afD ? 'verificar' : 'nao', afD ? 'Afastamento em ' + rotulo(afD) + ' (' + (fgOrd - afD.ord) + ' dia(s) antes do fato gerador). O início pode ser antecipado até 28 dias antes do parto, exceto para quem está em período de graça, caso em que conta do nascimento.' : 'Sem afastamento anterior informado.');
    esp('Internação prolongada da mãe ou do recém-nascido', entrada.internacao ? 'verificar' : 'nao', entrada.internacao ? 'Possível extensão de até 2 semanas com atestado médico e avaliação pericial; para quem está em período de graça, só para repouso depois do fim do benefício.' : 'Não informada.');
    esp('Adoção e guarda judicial para fins de adoção', (tipo === 'adocao' || tipo === 'guarda') ? 'aplica' : 'nao', 'Confirme a data inicial correta, a idade da criança (até 12 anos) e se não há outro segurado recebendo pelo mesmo processo.');
    esp('Falecimento da pessoa que teria direito', entrada.falecimento ? 'aplica' : 'nao', 'O cônjuge ou companheiro sobrevivente precisa de qualidade e carência na data do fato gerador e deve requerer dentro do prazo do benefício original (art. 360).');
    var incompat = analise.beneficios.filter(function (b) {
      return b.inicio && b.inicio.ord <= fgOrd + (fato.dias || 120) && (!b.fim || b.fim.ord >= fgOrd);
    });
    esp('Benefício incompatível ou acumulável', incompat.length ? 'verificar' : 'nao', incompat.length ? 'O CNIS tem benefício(s) coincidindo com o período (' + incompat.map(function (b) { return 'NB ' + (b.nb || 's/n'); }).join(', ') + '): verifique se há acumulação permitida.' : 'Nenhum benefício do CNIS coincide com o período.');
    esp('Requerimento anterior indeferido ou benefício anterior do mesmo evento', entrada.requerimentoAnterior ? 'verificar' : 'nao', entrada.requerimentoAnterior ? 'Veja o motivo do indeferimento e se há outro segurado recebendo pelo mesmo fato gerador (art. 357, § 4º).' : 'Não informado.');

    // ----- Etapa 7: valor estimado -----
    var viavel = (q.status === 'confirmada' || q.status === 'provavel' || q.status === 'indeterminada') && res.carencia.status !== 'nao_cumprida';
    var vl = { calculado: false, linhas: [] };
    res.valor = vl;
    var classeValor = usada === 'desempregada' ? (classeEfet || (q.graca ? q.graca.classe : null)) : (usada || (q.graca ? q.graca.classe : null));
    if (!viavel) {
      vl.linhas.push('Valor não calculado: a qualidade de segurado não foi demonstrada pelos dados.');
    } else if (analise.resumo.semRemuneracoes) {
      vl.linhas.push('Valor não calculado: o documento não traz remunerações.');
    } else if (!classeValor) {
      vl.linhas.push('Valor não calculado: a categoria não foi identificada.');
    } else {
      var mesRef = (afD && tipo === 'parto' && q.status !== 'indeterminada') ? mesDe(afD) : fgMes;
      var todos = {};
      var fonte = ativos.length ? ativos.map(function (a) { return a.item; }) : analise.vinculos;
      fonte.forEach(function (v) { Object.keys(v.contribuicoes || {}).forEach(function (k) { todos[k] = (todos[k] || 0) + v.contribuicoes[k]; }); });
      if (classeValor === 'especial') {
        var mn = C.minimoDe(mesRef);
        vl.calculado = true; vl.mensal = mn;
        vl.linhas.push('Segurada especial: um salário mínimo mensal (' + dinheiro(mn) + '), quando cabível o enquadramento.');
      } else if (classeValor === 'ci' || classeValor === 'mei' || classeValor === 'facultativa') {
        var ks = Object.keys(todos).map(Number).filter(function (k) { return k < mesRef && k >= mesRef - 15 && todos[k] > 0; }).sort(function (a, b) { return b - a; }).slice(0, 12);
        if (!ks.length) vl.linhas.push('Valor não calculado: não há salário de contribuição nos 15 meses anteriores.');
        else {
          var soma = ks.reduce(function (t, k) { return t + todos[k]; }, 0);
          var med = soma / (ks.length);
          var mn2 = C.minimoDe(mesRef);
          var final = Math.max(med, mn2 || 0);
          vl.calculado = true; vl.mensal = Math.round(final * 100) / 100;
          vl.linhas.push('Contribuinte individual, MEI ou facultativa: 1/12 da soma dos 12 últimos salários de contribuição em até 15 meses (competências ' + rotuloMes(ks[ks.length - 1]) + ' a ' + rotuloMes(ks[0]) + ', ' + ks.length + ' salário(s) encontrado(s)).');
          if (ks.length < 12) vl.linhas.push('Foram achados menos de 12 salários: a média foi feita pelos ' + ks.length + ' existentes. Confira como o INSS trata esse caso.');
          vl.linhas.push('Soma ' + dinheiro(soma) + ', média ' + dinheiro(med) + (final > med ? '; elevada ao piso (salário mínimo de ' + dinheiro(mn2) + ')' : '') + '.');
        }
      } else {
        // Empregada, doméstica e avulsa: remuneração do mês anterior; com variação, média dos 6 últimos.
        var k6 = Object.keys(todos).map(Number).filter(function (k) { return k < mesRef && (usada === 'desempregada' || k >= mesRef - 12) && todos[k] > 0; }).sort(function (a, b) { return b - a; }).slice(0, 6);
        if (!k6.length) vl.linhas.push('Valor não calculado: não há remuneração nos 12 meses anteriores.');
        else {
          if (usada === 'desempregada') vl.linhas.push('Desempregada em período de graça: foram usadas as últimas remunerações anteriores ao fato gerador, mesmo fora dos 12 meses. Confira a regra aplicável.');
          var ult = todos[k6[0]];
          var vals = k6.map(function (k) { return todos[k]; });
          var media6 = vals.reduce(function (t, x) { return t + x; }, 0) / vals.length;
          var variavel = Math.max.apply(null, vals) / Math.min.apply(null, vals) > 1.1;
          var ref = (classeValor === 'domestica') ? ult : (variavel ? media6 : ult);
          var mnE = C.minimoDe(mesRef), elevado = false;
          if (mnE && ref < mnE) { ref = mnE; elevado = true; }
          vl.calculado = true; vl.mensal = Math.round(ref * 100) / 100;
          if (elevado) vl.linhas.push('A referência ficou abaixo do salário mínimo e foi elevada ao piso (' + dinheiro(mnE) + ').');
          vl.linhas.push(CLASSES[classeValor] + ': ' + (classeValor === 'domestica' ? 'último salário de contribuição' : 'remuneração integral') + '. Última competência considerada: ' + rotuloMes(k6[0]) + ' (' + dinheiro(ult) + ').');
          if (classeValor !== 'domestica') vl.linhas.push('Média das últimas ' + k6.length + ' remunerações: ' + dinheiro(media6) + '. ' + (variavel ? 'Há variação acima de 10%, então a média foi usada como referência (remuneração variável).' : 'Remuneração estável: usada a última.'));
        }
      }
      if (vl.calculado) {
        vl.total = Math.round(vl.mensal * (fg.duracaoDias || 120) / 30 * 100) / 100;
        vl.linhas.push('Estimativa para ' + (fg.duracaoDias || 120) + ' dias: ' + dinheiro(vl.total) + '. O teto do benefício, o décimo terceiro e a competência exata do INSS não foram aplicados.');
        vl.linhas.push('Mínimo da época: ' + dinheiro(C.minimoDe(mesRef)) + '. Confira o cálculo (art. 240 da IN 128/2022) antes de usar.');
      }
    }

    // ----- Início, fim e documentos -----
    var inicio = fgOrd;
    if (q.antecipada && !afD) { inicio = q.antecipada.ord; fg.notas.push('Início do benefício na DAT estimada em ' + rotulo(q.antecipada) + ' (28 dias antes do parto), por ter qualidade de segurado nessa data e não na do parto. Confirme a data real do afastamento.'); }
    else if (tipo === 'parto' && afD) {
      if (q.antecipada) { inicio = q.antecipada.ord; fg.notas.push('Início do benefício na DAT (' + rotulo(q.antecipada) + '), por ter qualidade de segurado nessa data e não na do parto.'); }
      else if (q.graca && q.status === 'confirmada') { fg.notas.push('Em período de graça, o benefício conta do nascimento, mesmo com afastamento anterior.'); }
      else if (fgOrd - afD.ord <= 28) inicio = afD.ord;
      else { inicio = fgOrd - 28; fg.notas.push('Afastamento com mais de 28 dias de antecedência: o início antecipado foi limitado a 28 dias antes do parto (confira).'); }
    }
    if (fato.dias) {
      fg.inicioBeneficio = dObj(inicio);
      fg.fimBeneficio = dObj(inicio + fato.dias - 1);
    }
    docs.forEach(function (t) { res.documentos.push(t); });
    res.documentos.push('Documento de identificação e CPF da requerente');
    if (afD) res.documentos.push('Atestado médico ou comprovante do afastamento das atividades');
    if (entrada.internacao) res.documentos.push('Atestado médico específico e relatório da internação');
    if (entrada.falecimento) res.documentos.push('Certidão de óbito e prova da relação com a pessoa falecida');
    if (usada === 'especial') res.documentos.push('Autodeclaração e documentos da atividade rural');

    condicionarCarencia(res.carencia, q, exigeCar ? CARENCIA : null, fgOrd);
    // ----- Conclusão -----
    var pend = [];
    res.cnis.filter(function (x) { return x.impede; }).forEach(function (x) { pend.push(x.achado + ' ' + x.documento + '.'); });
    res.especiais.filter(function (x) { return x.situacao === 'verificar'; }).forEach(function (x) { pend.push(x.nome + ': verificar.'); });
    var conc;
    if (res.carencia.status === 'nao_cumprida' && ['confirmada', 'provavel', 'indeterminada'].indexOf(q.status) >= 0) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: carência', texto: 'A qualidade de segurado pode existir, mas o CNIS mostra ' + validasAte + ' contribuição(ões) válida(s) e a carência exigida antes de 05/04/2024 para ' + CLASSES[classeCar].toLowerCase() + ' é de ' + CARENCIA + '. Documentos que completem a carência podem mudar o resultado.' };
    else if (q.status === 'confirmada' && !pend.length) conc = { status: 'provavel', rotulo: 'Direito provável', texto: 'Com os dados do CNIS, a qualidade de segurado está demonstrada na data do fato gerador e a carência está dispensada. Falta apenas o fato gerador ser comprovado por documento.' };
    else if (q.status === 'confirmada' || q.status === 'provavel') conc = { status: 'depende', rotulo: 'Direito depende de validação documental', texto: 'A qualidade de segurado é compatível com o CNIS, mas há pontos a validar antes de concluir.' };
    else if (q.status === 'indeterminada') conc = { status: 'depende', rotulo: 'Indeterminado por falta de informações', texto: 'O resultado depende de informação ou prova que não consta nos dados (como o seguro-desemprego/SINE).' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado pelos dados', texto: 'Os dados do CNIS não demonstram a qualidade de segurado na data do fato gerador. Isso não é uma conclusão definitiva: outras provas podem alterar o resultado.' };
    if (fg.prazoExcedido) {
      conc = { status: 'prescrito', rotulo: 'Sem direito: prescrição', texto: 'O fato gerador (' + rotulo(fgD) + ') tem mais de 5 anos: o prazo para requerer terminou em ' + rotulo(fg.prazoRequerer) + ' (art. 357, § 5º, da IN 128/2022). Pelos dados informados, o benefício está prescrito. A análise abaixo é apenas informativa.' };
      pend = [];
    }
    if (res.concessaoDesemprego && conc.status !== 'prescrito') conc.texto += ' Observação: concedido pela qualidade de desempregada, pois pelos recolhimentos como ' + CLASSES[res.concessaoDesemprego.categoriaAnterior].toLowerCase() + ' não havia carência.';
    conc.pendencias = pend;
    res.conclusao = conc;
    // Sem qualidade de segurado na data, não se avalia a carência da pessoa: mostra todas as regras possíveis do benefício.
    if (['confirmada', 'provavel', 'indeterminada'].indexOf(q.status) < 0) {
      res.carencia.semQualidade = true;
      res.carencia.rotulo = 'Regras de carência do salário-maternidade';
      res.carencia.linhas = REGRAS_CARENCIA_SM.slice();
      res.carencia.linhas.push(linhaRetorno(fgOrd < DATA_DISPENSA ? CARENCIA : null, fgOrd));
    }
    return res;
  }

  // ---------- Interface ----------

  function campo(rotulo, controle) {
    var l = C.el('label', 'campo', rotulo);
    l.appendChild(controle);
    return l;
  }
  function selecao(id, opcoes) {
    var s = C.el('select'); s.id = id;
    opcoes.forEach(function (o) { var op = C.el('option', null, o[1]); op.value = o[0]; s.appendChild(op); });
    return s;
  }
  function entrada(id, tipo) { var i = C.el('input'); i.type = tipo; i.id = id; return i; }
  function marca(id, texto) {
    var l = C.el('label'); var i = entrada(id, 'checkbox'); l.appendChild(i); l.appendChild(document.createTextNode(' ' + texto)); return l;
  }
  function lerCampos() {
    var g = function (id) { return document.getElementById(id); };
    return {
      beneficio: g('dir-beneficio').value, tipo: g('dir-tipo').value, data: g('dir-data').value, afastamento: g('dir-afast').value,
      categoria: g('dir-categoria').value, desemprego: g('dir-desemprego').checked, internacao: g('dir-internacao').checked,
      falecimento: g('dir-falecimento').checked, requerimentoAnterior: g('dir-anterior').checked
    };
  }

  var ROTULO_STATUS = { confirmada: 'Confirmada', provavel: 'Provável', indeterminada: 'Indeterminada', possivelmente_perdida: 'Possivelmente perdida', nao_demonstrada: 'Não demonstrada' };

  function lista(itens, classe) {
    var ul = C.el('ul', classe || 'lista-simples');
    itens.forEach(function (t) {
      var li = C.el('li');
      String(t).split('**').forEach(function (parte, i) {
        if (!parte) return;
        if (i % 2) li.appendChild(C.el('strong', null, parte)); else li.appendChild(document.createTextNode(parte));
      });
      ul.appendChild(li);
    });
    return ul;
  }

  function renderizar(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: salário-maternidade'));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. Mostra os dados usados, as regras aplicadas e o que ainda falta comprovar.'));

    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) {
      caixa.appendChild(C.el('p', 'dica', 'Para concluir:'));
      caixa.appendChild(lista(c.pendencias.slice(0, 8)));
    }
    topo.appendChild(caixa);
    if (!r.fatoGerador.valido) return topo;

    var fg = r.fatoGerador;
    var s1 = C.sec('1. Fato gerador');
    var l1 = [fg.rotulo + ' em ' + C.rotuloData(fg.data) + '.'];
    if (fg.duracaoDias) l1.push('Duração: ' + fg.duracaoDias + ' dias, de ' + C.rotuloData(fg.inicioBeneficio) + ' a ' + C.rotuloData(fg.fimBeneficio) + '.');
    l1.push('Prazo para requerer (5 anos): até ' + C.rotuloData(fg.prazoRequerer) + '.');
    s1.appendChild(lista(l1.concat(fg.notas)));
    topo.appendChild(s1);

    var cat = r.categoria;
    var s2 = C.sec('2. Categoria na data');
    s2.appendChild(C.el('p', null, (cat.usada ? 'Categoria considerada: ' + CLASSES[cat.usada] + '. ' : 'Categoria não definida. ') + cat.motivo));
    if (cat.ativos.length) s2.appendChild(lista(cat.ativos.map(function (a) { return 'Seq. ' + a.seq + ' - ' + a.nome + ' (' + CLASSES[a.classe].toLowerCase() + ')' + (a.aviso ? ': ' + a.aviso : ''); })));
    topo.appendChild(s2);

    var q = r.qualidade;
    var s3 = C.sec('3. Qualidade de segurado');
    var sel = C.el('p', 'selo-linha'); sel.appendChild(C.el('span', 'selo selo-' + q.status, q.rotulo));
    s3.appendChild(sel);
    s3.appendChild(lista(q.linhas));
    if (q.graca) {
      var g = q.graca;
      s3.appendChild(C.tabela(['Item', 'Valor'], [
        ['Data inicial usada', g.dataInicial], ['Categoria considerada', g.categoria], ['Prazo-base', g.prazoBase + ' meses'],
        ['Contribuições seguidas', String(g.contribuicoes) + (g.extensao120 ? ' (mais de 120: 24 meses)' : '')],
        ['Qualidade mantida até (prazo-base)', C.rotuloData(g.ateBase)],
        ['Com prorrogação de 24 meses', g.ateComExtensao ? C.rotuloData(g.ateComExtensao) : 'não se aplica'],
        ['Com seguro-desemprego/SINE', g.ateComDesemprego ? C.rotuloData(g.ateComDesemprego) : 'não se aplica']
      ]));
    }
    topo.appendChild(s3);

    var ca = r.carencia;
    var s4 = C.sec('4. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', (ca.semQualidade || ca.condicional) ? 'selo' : 'selo selo-' + (ca.status === 'nao_cumprida' ? 'nao_demonstrada' : 'confirmada'), ca.rotulo));
    s4.appendChild(sc);
    s4.appendChild(lista(ca.linhas));
    if (ca.perguntas && ca.perguntas.length && !ca.semQualidade) s4.appendChild(perguntasUI(ca.perguntas));
    topo.appendChild(s4);

    var s5 = C.sec('5. Validade do CNIS');
    if (r.cnis.length) {
      s5.appendChild(C.tabela(['O que foi encontrado', 'Impacto', 'Documento', 'Impede conclusão segura?', 'Providência'], r.cnis.map(function (x) {
        return [x.achado, x.impacto, x.documento, x.impede ? 'Sim, até validar' : 'Não', x.providencia];
      })));
    } else s5.appendChild(C.el('p', 'vazio-msg', 'Nenhuma inconsistência relevante para esta conclusão.'));
    topo.appendChild(s5);

    var s6 = C.sec('6. Situações especiais');
    var aplic = r.especiais.filter(function (x) { return x.situacao !== 'nao'; });
    if (aplic.length) s6.appendChild(C.tabela(['Situação', 'Status', 'O que conferir'], aplic.map(function (x) { return [x.nome, x.situacao === 'aplica' ? 'Aplica-se' : 'Verificar', x.texto]; })));
    var nao = r.especiais.filter(function (x) { return x.situacao === 'nao'; }).map(function (x) { return x.nome; });
    if (nao.length) s6.appendChild(C.el('p', 'dica', 'Não identificadas: ' + nao.join('; ') + '.'));
    topo.appendChild(s6);

    var v = r.valor;
    var s7 = C.sec('7. Valor estimado');
    if (v.calculado) {
      var fig = C.el('dl', 'figuras');
      [[dinheiro(v.mensal), 'Renda mensal estimada'], [dinheiro(v.total), 'Total estimado do benefício']].forEach(function (f) {
        var d = C.el('div', 'figura'); d.appendChild(C.el('dt', 'fig-rotulo', f[1])); d.appendChild(C.el('dd', 'fig-valor', f[0])); fig.appendChild(d);
      });
      s7.appendChild(fig);
    }
    s7.appendChild(lista(v.linhas));
    topo.appendChild(s7);

    var s8 = C.sec('Documentos a reunir');
    s8.appendChild(lista(r.documentos));
    topo.appendChild(s8);

    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (n) { return [n.nome, n.vigencia]; })));
    topo.appendChild(s9);

    return topo;
  }

  function hojeAgora() { var a = new Date(); return { y: a.getFullYear(), m: a.getMonth() + 1, d: a.getDate() }; }

  // ---------- Vínculos incluídos manualmente (que faltam no CNIS) ----------
  var TIPOS_EXTRA = [['emp', 'Empregado'], ['rural', 'Empregado rural'], ['esp', 'Segurado especial'], ['ci', 'Contribuinte individual'], ['ctc', 'CTC (certidão de tempo de contribuição)']];
  var OBS_EXTRA = 'O tempo incluído aqui não consta no CNIS: deve ser comprovado perante o INSS e aceito conforme a legislação em vigor.';
  function rotuloTipoExtra(id) { var r = TIPOS_EXTRA.filter(function (t) { return t[0] === id; })[0]; return r ? r[1] : id; }

  // Monta um item igual aos da análise, para as simulações tratarem como um vínculo do extrato.
  // CTC conta como empregado urbano; o contribuinte individual é considerado recolhido no mínimo em todas as competências.
  function itemExtra(e, seq) {
    var ini = e.inicio, fim = e.fim, ordI = ini.ord, ordF = fim.ord;
    var tipo = e.tipo === 'esp' ? 'Segurado Especial' : e.tipo === 'ci' ? 'Contribuinte Individual' : 'Empregado';
    var nome = e.nome || rotuloTipoExtra(e.tipo);
    var it = {
      seq: seq, nome: nome, tipo: tipo, rotulo: 'Seq. ' + seq + ' - ' + nome + ' (incluído manualmente)', inicio: ini, fim: fim, emAberto: false, valido: true,
      dias: ordF - ordI + 1, remuneracoes: 0, decimos: 0, comRemuneracao: 0, faltantes: 0, anteriores94: 0,
      fimContado: fim, inicioOrd: ordI, fimOrd: ordF, segmentos: [[ordI, ordF]], cobertura: [[ordI, ordF]],
      contribuicoes: {}, pagamentos: {}, codigosIndicadores: [], incluidoManual: true,
      rural: e.tipo === 'rural' || e.tipo === 'esp'
    };
    if (e.tipo === 'ci') {
      for (var k = C.mesDe(ini.y, ini.m); k <= C.mesDe(fim.y, fim.m); k++) it.contribuicoes[k] = C.minimoDe(k) || 1;
    }
    return it;
  }
  // Devolve uma cópia da análise com os vínculos incluídos. Sobreposições não somam em dobro: a contagem é por dia e por competência.
  function comExtras(base, extras) {
    if (!extras.length) return base;
    var copia = Object.assign({}, base);
    copia.vinculos = base.vinculos.concat(extras.map(function (e, i) { return itemExtra(e, 9001 + i); }));
    return copia;
  }
  function blocoExtras(extras) {
    var b = C.el('div', 'regras');
    b.appendChild(C.el('p', null, 'Vínculos incluídos manualmente nesta simulação:'));
    var ul = C.el('ul', 'lista-simples');
    extras.forEach(function (e) { ul.appendChild(C.el('li', null, e.nome + ' (' + rotuloTipoExtra(e.tipo) + '): ' + C.rotuloData(e.inicio) + ' a ' + C.rotuloData(e.fim))); });
    b.appendChild(ul);
    b.appendChild(C.el('p', null, OBS_EXTRA + ' Períodos que se sobrepõem a outros vínculos são contados uma vez.'));
    return b;
  }
  function editorVinculos(extras, aoMudar) {
    var box = C.el('div', 'enquadramento vinculos-extra');
    box.appendChild(C.el('h4', null, 'Vínculos que faltam no CNIS (opcional)'));
    box.appendChild(C.el('p', 'dica', 'Inclua períodos que não aparecem no extrato. ' + OBS_EXTRA + ' CTC é contada como empregado urbano. Contribuinte individual é considerado recolhido no salário mínimo em todo o período.'));
    var grade = C.el('div', 'grade-campos');
    function campo2(rotulo, el) { var l = C.el('label', 'campo'); l.appendChild(C.el('span', null, rotulo)); l.appendChild(el); return l; }
    var nome = document.createElement('input'); nome.type = 'text'; nome.id = 'vx-nome'; nome.maxLength = 80; nome.autocomplete = 'off';
    var tipo = document.createElement('select'); tipo.id = 'vx-tipo';
    TIPOS_EXTRA.forEach(function (t) { var o = document.createElement('option'); o.value = t[0]; o.textContent = t[1]; tipo.appendChild(o); });
    var ini = document.createElement('input'); ini.type = 'date'; ini.id = 'vx-inicio';
    var fim = document.createElement('input'); fim.type = 'date'; fim.id = 'vx-fim';
    grade.appendChild(campo2('Nome', nome)); grade.appendChild(campo2('Tipo', tipo)); grade.appendChild(campo2('Início', ini)); grade.appendChild(campo2('Fim', fim));
    box.appendChild(grade);
    var acoes2 = C.el('div', 'acoes');
    var add = C.el('button', 'btn', 'Adicionar vínculo'); add.type = 'button';
    acoes2.appendChild(add); box.appendChild(acoes2);
    var msg = C.el('p', 'msg'); box.appendChild(msg);
    var lista2 = C.el('div', 'enq-lista'); box.appendChild(lista2);
    function iso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? C.dataDe(m[3] + '/' + m[2] + '/' + m[1]) : null; }
    function desenhar() {
      lista2.textContent = '';
      if (!extras.length) return;
      var ul = C.el('ul', 'lista-simples');
      extras.forEach(function (e, i) {
        var li = C.el('li');
        li.appendChild(document.createTextNode(e.nome + ' (' + rotuloTipoExtra(e.tipo) + '): ' + C.rotuloData(e.inicio) + ' a ' + C.rotuloData(e.fim) + ' '));
        var rm = C.el('button', 'btn btn-sec', 'Remover'); rm.type = 'button';
        rm.addEventListener('click', function () { extras.splice(i, 1); desenhar(); aoMudar(); });
        li.appendChild(rm); ul.appendChild(li);
      });
      lista2.appendChild(ul);
    }
    add.addEventListener('click', function () {
      var i = iso(ini.value), f = iso(fim.value);
      if (!i || !f || f.ord < i.ord) { msg.textContent = 'Informe a data de início e a data de fim (o fim não pode ser anterior ao início).'; return; }
      if (i.y < 1900 || f.y > 2100) { msg.textContent = 'Data fora do intervalo esperado.'; return; }
      msg.textContent = '';
      extras.push({ nome: (nome.value || '').trim().slice(0, 80) || rotuloTipoExtra(tipo.value), tipo: tipo.value, inicio: i, fim: f });
      nome.value = ''; ini.value = ''; fim.value = '';
      desenhar(); aoMudar();
    });
    return box;
  }

  // Bloco "Verificar direito", logo abaixo do mapa de competências. Usa a análise já feita, sem reenviar o extrato.
  function montar(saida, analiseBase) {
    var analise = analiseBase;
    var extras = [];
    var bloco = C.el('div', 'convite-corpo');
    bloco.appendChild(C.el('p', 'dica', 'Escolha o benefício, informe os dados e clique em Verificar direito. A conferência usa o extrato já lido.'));
    var topo = C.el('div', 'grade-campos');
    var selBen = selecao('dir-beneficio', [['salario-maternidade', 'Salário-maternidade']].concat(root.PENSAO ? [['pensao-por-morte', 'Pensão por morte']] : [], root.BENEFICIOS ? [['auxilio-reclusao', 'Auxílio-reclusão'], ['auxilio-incapacidade-temporaria', 'Auxílio por incapacidade temporária (auxílio-doença)'], ['aposentadoria-incapacidade-permanente', 'Aposentadoria por incapacidade permanente (invalidez)']] : [], root.IDADE ? [['aposentadoria-idade-urbana', 'Aposentadoria por idade urbana'], ['aposentadoria-idade-rural', 'Aposentadoria por idade rural'], ['aposentadoria-idade-hibrida', 'Aposentadoria por idade híbrida (rural + urbana)']] : [], root.TEMPO ? [['aposentadoria-tempo', 'Aposentadoria por tempo de contribuição (regras de transição)'], ['aposentadoria-adquirido', 'Aposentadoria por tempo: direito adquirido antes da EC 103/2019'], ['aposentadoria-especial', 'Aposentadoria especial (15, 20 ou 25 anos de exposição)'], ['aposentadoria-professor', 'Aposentadoria do professor (educação básica)'], ['aposentadoria-pcd-tempo', 'Aposentadoria da pessoa com deficiência por tempo de contribuição'], ['aposentadoria-pcd-idade', 'Aposentadoria da pessoa com deficiência por idade']] : []));
    topo.appendChild(campo('Benefício', selBen));
    bloco.appendChild(topo);

    // Salário-maternidade
    var gSM = C.el('div'); gSM.id = 'dir-grupo-sm';
    var grade = C.el('div', 'grade-campos');
    grade.appendChild(campo('Fato gerador', selecao('dir-tipo', [['parto', 'Parto'], ['natimorto', 'Natimorto'], ['aborto', 'Aborto não criminoso'], ['adocao', 'Adoção'], ['guarda', 'Guarda judicial para adoção'], ['outro', 'Outra hipótese']])));
    grade.appendChild(campo('Data do fato gerador', entrada('dir-data', 'date')));
    grade.appendChild(campo('Início do afastamento (se houver)', entrada('dir-afast', 'date')));
    grade.appendChild(campo('Categoria na data', selecao('dir-categoria', [['auto', 'Identificar pelo CNIS'], ['empregada', 'Empregada'], ['domestica', 'Empregada doméstica'], ['avulsa', 'Trabalhadora avulsa'], ['ci', 'Contribuinte individual'], ['mei', 'MEI'], ['facultativa', 'Facultativa'], ['desempregada', 'Desempregada (período de graça)'], ['especial', 'Segurada especial']])));
    gSM.appendChild(grade);
    var marcas = C.el('div', 'marcas');
    marcas.appendChild(marca('dir-internacao', 'Internação prolongada (mãe ou bebê)'));
    marcas.appendChild(marca('dir-falecimento', 'Falecimento de quem teria direito'));
    marcas.appendChild(marca('dir-anterior', 'Há requerimento anterior pelo mesmo fato'));
    gSM.appendChild(marcas);
    bloco.appendChild(gSM);

    // Pensão por morte
    var gPM = C.el('div'); gPM.id = 'dir-grupo-pm'; gPM.hidden = true;
    if (root.PENSAO) {
      var gp = C.el('div', 'grade-campos');
      gp.appendChild(campo('Data do óbito do segurado', entrada('pm-obito', 'date')));
      gp.appendChild(campo('Dependente', selecao('pm-dependente', [['conjuge', 'Cônjuge'], ['companheiro', 'Companheiro(a)'], ['ex_conjuge', 'Ex-cônjuge/ex-companheiro(a) com pensão alimentícia'], ['filho', 'Filho ou equiparado'], ['filho_maior_invalido', 'Filho maior inválido ou com deficiência'], ['pai_mae', 'Pai ou mãe'], ['irmao', 'Irmão(ã)']])));
      gp.appendChild(campo('Nascimento do dependente', entrada('pm-nasc', 'date')));
      var cUniao = campo('Início do casamento ou união estável', entrada('pm-uniao', 'date'));
      cUniao.id = 'pm-uniao-campo';
      gp.appendChild(cUniao);
      var selDep = gp.querySelector('#pm-dependente');
      var ajustaUniao = function () { cUniao.hidden = ['conjuge', 'companheiro', 'ex_conjuge'].indexOf(selDep.value) < 0; };
      selDep.addEventListener('change', ajustaUniao);
      ajustaUniao();
      gp.appendChild(campo('Data do requerimento (se houver)', entrada('pm-req', 'date')));
      gPM.appendChild(gp);
      var mp = C.el('div', 'marcas');
      mp.appendChild(marca('pm-invalido', 'Dependente inválido ou com deficiência'));
      mp.appendChild(marca('pm-acidente', 'Óbito por acidente ou doença profissional/do trabalho'));
      mp.appendChild(marca('pm-economica', 'Dependência econômica comprovada (pais, irmãos, ex-cônjuge com alimentos)'));
      gPM.appendChild(mp);
    }
    bloco.appendChild(gPM);

    // Auxílio-reclusão
    var gAR = C.el('div'); gAR.id = 'dir-grupo-ar'; gAR.hidden = true;
    if (root.BENEFICIOS) {
      var ga = C.el('div', 'grade-campos');
      ga.appendChild(campo('Data do recolhimento à prisão', entrada('ar-prisao', 'date')));
      ga.appendChild(campo('Regime de cumprimento', selecao('ar-regime', [['fechado', 'Regime fechado'], ['provisorio', 'Prisão provisória (preventiva ou temporária)'], ['semiaberto', 'Regime semiaberto'], ['aberto', 'Regime aberto ou prisão domiciliar']])));
      ga.appendChild(campo('Data da soltura (se já ocorreu)', entrada('ar-soltura', 'date')));
      ga.appendChild(campo('Dependente', selecao('ar-dependente', [['conjuge', 'Cônjuge'], ['companheiro', 'Companheiro(a)'], ['filho', 'Filho ou equiparado'], ['filho_maior_invalido', 'Filho maior inválido ou com deficiência'], ['pai_mae', 'Pai ou mãe'], ['irmao', 'Irmão(ã)']])));
      ga.appendChild(campo('Nascimento do dependente', entrada('ar-nasc', 'date')));
      var cUniaoAr = campo('Início do casamento ou união estável', entrada('ar-uniao', 'date'));
      ga.appendChild(cUniaoAr);
      ga.appendChild(campo('Data do requerimento (se houver)', entrada('ar-req', 'date')));
      var selDepAr = ga.querySelector('#ar-dependente');
      var ajustaAr = function () { cUniaoAr.hidden = ['conjuge', 'companheiro'].indexOf(selDepAr.value) < 0; };
      selDepAr.addEventListener('change', ajustaAr);
      ajustaAr();
      gAR.appendChild(ga);
      var ma = C.el('div', 'marcas');
      ma.appendChild(marca('ar-invalido', 'Dependente inválido ou com deficiência'));
      ma.appendChild(marca('ar-economica', 'Dependência econômica comprovada (pais e irmãos)'));
      gAR.appendChild(ma);
    }
    bloco.appendChild(gAR);

    // Auxílio por incapacidade temporária
    var gAI = C.el('div'); gAI.id = 'dir-grupo-ai'; gAI.hidden = true;
    if (root.BENEFICIOS) {
      var gi = C.el('div', 'grade-campos');
      gi.appendChild(campo('Data de início da incapacidade (DII)', entrada('ai-dii', 'date')));
      gi.appendChild(campo('Início do afastamento (se diferente)', entrada('ai-afast', 'date')));
      gi.appendChild(campo('Data do requerimento (se houver)', entrada('ai-req', 'date')));
      gi.appendChild(campo('Origem da incapacidade', selecao('ai-origem', [['comum', 'Doença ou lesão comum'], ['acidente', 'Acidente de qualquer natureza ou doença profissional/do trabalho'], ['doenca_lista', 'Doença grave da lista oficial (isenta carência)']])));
      gi.appendChild(campo('Doença ou lesão anterior à filiação?', selecao('ai-pre', [['nao', 'Não, começou depois de se filiar'], ['sim', 'Sim, já existia ao se filiar, sem agravamento'], ['agravamento', 'Já existia, mas se agravou depois']])));
      gAI.appendChild(gi);
      var gp = C.el('div', 'grade-campos'); gp.id = 'ai-perm'; gp.hidden = true;
      gp.appendChild(campo('Data da perícia que definiu a incapacidade permanente (se precedida de auxílio temporário)', entrada('ai-pericia', 'date')));
      gp.appendChild(campo('Sexo (para estimar o percentual do valor)', selecao('ai-sexo', [['', 'Não informar'], ['F', 'Mulher'], ['M', 'Homem']])));
      gp.appendChild(marca('ai-grande', 'Grande invalidez (precisa de assistência permanente de outra pessoa)'));
      gAI.appendChild(gp);
    }
    bloco.appendChild(gAI);

    // Aposentadoria por idade (urbana e rural)
    var gAP = C.el('div'); gAP.id = 'dir-grupo-ap'; gAP.hidden = true;
    if (root.IDADE) {
      var gq = C.el('div', 'grade-campos');
      gq.appendChild(campo('Sexo', selecao('ap-sexo', [['F', 'Mulher'], ['M', 'Homem']])));
      gq.appendChild(campo('Data de nascimento', entrada('ap-nasc', 'date')));
      gq.appendChild(campo('Data do requerimento (DER)', entrada('ap-der', 'date')));
      gAP.appendChild(gq);
    }
    bloco.appendChild(gAP);

    // Aposentadoria por tempo de contribuição (regras de transição da EC 103)
    var gTC = C.el('div'); gTC.id = 'dir-grupo-tc'; gTC.hidden = true;
    var enq = [];
    var prof = [];
    var pcd = [];
    if (root.TEMPO) {
      var gt = C.el('div', 'grade-campos');
      gt.appendChild(campo('Sexo', selecao('tc-sexo', [['F', 'Mulher'], ['M', 'Homem']])));
      gt.appendChild(campo('Data de nascimento', entrada('tc-nasc', 'date')));
      gt.appendChild(campo('Data do requerimento (DER)', entrada('tc-der', 'date')));
      gTC.appendChild(gt);
      gTC.editorEnq = root.TEMPO.editor(analise, enq, function () { if (resultado.firstChild) executar(); });
      gTC.appendChild(gTC.editorEnq);
      gTC.editorProf = root.TEMPO.editorProfessor(analise, prof, function () { if (resultado.firstChild) executar(); });
      gTC.editorProf.hidden = true;
      gTC.editorPcd = root.TEMPO.editorPcd(pcd, function () { if (resultado.firstChild) executar(); });
      gTC.editorPcd.hidden = true;
      gTC.appendChild(gTC.editorPcd);
      gTC.appendChild(gTC.editorProf);
    }
    bloco.appendChild(gTC);
    var botaoCmp = C.el('button', 'btn btn-leve', 'Comparar todas as aposentadorias'); botaoCmp.type = 'button'; botaoCmp.id = 'dir-comparar';
    botaoCmp.title = 'Roda todas as regras com o sexo, o nascimento, a DER, o enquadramento, os vínculos de professor e os períodos de deficiência informados.';
    gTC.appendChild(botaoCmp);

    var edVinc = editorVinculos(extras, function () {
      analise = comExtras(analiseBase, extras);
      if (gTC.editorEnq && gTC.editorEnq.atualizar) gTC.editorEnq.atualizar(analise);
      if (gTC.editorProf && gTC.editorProf.atualizar) gTC.editorProf.atualizar(analise);
      if (resultado.firstChild) executar();
    });
    bloco.appendChild(edVinc);
    var comuns = C.el('div', 'marcas comuns');
    comuns.appendChild(marca('dir-desemprego', 'Seguro-desemprego/SINE'));
    bloco.appendChild(comuns);

    selBen.addEventListener('change', function () {
      var v = selBen.value;
      gSM.hidden = v !== 'salario-maternidade'; gPM.hidden = v !== 'pensao-por-morte'; gAR.hidden = v !== 'auxilio-reclusao'; gAI.hidden = v !== 'auxilio-incapacidade-temporaria' && v !== 'aposentadoria-incapacidade-permanente'; var gpp = document.getElementById('ai-perm'); if (gpp) gpp.hidden = v !== 'aposentadoria-incapacidade-permanente';
      gAP.hidden = v.indexOf('aposentadoria-idade') !== 0; var ehPcd = v.indexOf('aposentadoria-pcd') === 0; gTC.hidden = v !== 'aposentadoria-tempo' && v !== 'aposentadoria-adquirido' && v !== 'aposentadoria-especial' && v !== 'aposentadoria-professor' && !ehPcd; if (gTC.editorEnq) gTC.editorEnq.hidden = v === 'aposentadoria-professor' || ehPcd; if (gTC.editorPcd) gTC.editorPcd.hidden = !ehPcd; if (gTC.editorProf) gTC.editorProf.hidden = v !== 'aposentadoria-professor'; comuns.hidden = gAP.hidden === false || !gTC.hidden;
      resultado.textContent = '';
    });

    var acoes = C.el('div', 'acoes');
    var botao = C.el('button', 'btn', 'Verificar direito'); botao.type = 'button'; botao.id = 'dir-verificar';
    acoes.appendChild(botao);
    var botaoRel = C.el('button', 'btn btn-leve', 'Gerar relatório da simulação (PDF)'); botaoRel.type = 'button'; botaoRel.id = 'dir-relatorio';
    botaoRel.title = 'Somente o resultado desta verificação. Na janela de impressão, escolha "Salvar como PDF".';
    botaoRel.addEventListener('click', function () {
      if (!document.getElementById('dir-resultado').firstChild) { window.alert('Clique em Verificar direito antes de gerar o relatório.'); return; }
      C.gerarRelatorio('direito');
    });
    acoes.appendChild(botaoRel);
    bloco.appendChild(acoes);
    var resultado = C.el('div'); resultado.id = 'dir-resultado'; resultado.setAttribute('aria-live', 'polite');
    bloco.appendChild(resultado);
    var respostas = {}; // respostas às perguntas de carência (complementar, vínculo comprovado)
    api.responder = function (id, v) { respostas[id] = v; executar(); };
    function executar() {
      analise = comExtras(analiseBase, extras);
      executarBase();
      if (extras.length && resultado.firstChild) resultado.insertBefore(blocoExtras(extras), resultado.firstChild);
    }
    function executarBase() {
      resultado.textContent = '';
      if (selBen.value === 'pensao-por-morte' && root.PENSAO) {
        var cp = root.PENSAO.lerCampos();
        if (!cp.obito) { resultado.appendChild(C.el('p', 'msg', 'Informe a data do óbito.')); return; }
        resultado.appendChild(root.PENSAO.renderizar(root.PENSAO.pensaoPorMorte(analise, cp, hojeAgora())));
        return;
      }
      if (selBen.value === 'auxilio-reclusao' && root.BENEFICIOS) {
        var cr = Object.assign(root.BENEFICIOS.lerCamposReclusao(), respostas);
        if (!cr.prisao) { resultado.appendChild(C.el('p', 'msg', 'Informe a data do recolhimento à prisão.')); return; }
        resultado.appendChild(root.BENEFICIOS.renderizar(root.BENEFICIOS.auxilioReclusao(analise, cr, hojeAgora())));
        return;
      }
      if ((selBen.value === 'auxilio-incapacidade-temporaria' || selBen.value === 'aposentadoria-incapacidade-permanente') && root.BENEFICIOS) {
        var ci = Object.assign(root.BENEFICIOS.lerCamposIncapacidade(), respostas);
        if (!ci.dii) { resultado.appendChild(C.el('p', 'msg', 'Informe a data de início da incapacidade.')); return; }
        resultado.appendChild(root.BENEFICIOS.renderizar(selBen.value === 'aposentadoria-incapacidade-permanente' ? root.BENEFICIOS.aposentadoriaIncapacidade(analise, ci, hojeAgora()) : root.BENEFICIOS.auxilioIncapacidade(analise, ci, hojeAgora())));
        return;
      }
      if ((selBen.value === 'aposentadoria-tempo' || selBen.value === 'aposentadoria-adquirido' || selBen.value === 'aposentadoria-especial' || selBen.value === 'aposentadoria-professor' || selBen.value.indexOf('aposentadoria-pcd') === 0) && root.TEMPO) {
        var ctc = Object.assign(root.TEMPO.lerCampos(), respostas, { enquadramento: enq, professor: prof.slice(), pcd: pcd.slice() });
        if (!ctc.nascimento || !ctc.der) { resultado.appendChild(C.el('p', 'msg', 'Informe a data de nascimento e a data do requerimento.')); return; }
        resultado.appendChild(root.TEMPO.renderizar(selBen.value === 'aposentadoria-especial' ? root.TEMPO.aposentadoriaEspecial(analise, ctc, hojeAgora()) : selBen.value === 'aposentadoria-adquirido' ? root.TEMPO.aposentadoriaAdquirida(analise, ctc, hojeAgora()) : selBen.value === 'aposentadoria-professor' ? root.TEMPO.aposentadoriaProfessor(analise, ctc, hojeAgora()) : selBen.value.indexOf('aposentadoria-pcd') === 0 ? root.TEMPO.aposentadoriaPcd(analise, ctc, hojeAgora(), selBen.value === 'aposentadoria-pcd-idade' ? 'idade' : 'tempo') : root.TEMPO.aposentadoriaTempo(analise, ctc, hojeAgora())));
        return;
      }
      if (selBen.value.indexOf('aposentadoria-idade') === 0 && root.IDADE) {
        var cap = Object.assign(root.IDADE.lerCampos(selBen.value === 'aposentadoria-idade-rural' ? 'rural' : selBen.value === 'aposentadoria-idade-hibrida' ? 'hibrida' : 'urbana'), respostas);
        if (!cap.nascimento || !cap.der) { resultado.appendChild(C.el('p', 'msg', 'Informe a data de nascimento e a data do requerimento.')); return; }
        resultado.appendChild(root.IDADE.renderizar(root.IDADE.aposentadoriaIdade(analise, cap, hojeAgora())));
        return;
      }
      var campos = Object.assign(lerCampos(), respostas);
      if (!campos.data) { resultado.appendChild(C.el('p', 'msg', 'Informe a data do fato gerador.')); return; }
      resultado.appendChild(renderizar(salarioMaternidade(analise, campos, hojeAgora())));
    }
    botao.addEventListener('click', executar);
    botaoCmp.addEventListener('click', function () {
      analise = comExtras(analiseBase, extras);
      resultado.textContent = '';
      var cc = Object.assign(root.TEMPO.lerCampos(), respostas, { enquadramento: enq, professor: prof.slice(), pcd: pcd.slice() });
      resultado.appendChild(root.TEMPO.renderizarComparador(root.TEMPO.comparar(analise, cc, hojeAgora())));
      if (extras.length) resultado.insertBefore(blocoExtras(extras), resultado.firstChild);
    });
    // Cartão recolhido: quem só quer analisar o CNIS não é obrigado a ver o formulário
    var sec = C.el('section', 'bloco convite');
    sec.id = 'cnis-direito';
    var det = C.el('details', 'convite-card');
    var sum = C.el('summary');
    var alvo = C.el('span', 'alvo'); alvo.setAttribute('aria-hidden', 'true');
    alvo.appendChild(C.el('i')); alvo.appendChild(C.el('i')); alvo.appendChild(C.el('i'));
    var txt = C.el('span', 'convite-txt');
    var tit = C.el('strong', null, 'Verificar direito a um benefício');
    tit.appendChild(C.el('em', 'convite-opcional', 'opcional'));
    txt.appendChild(tit);
    txt.appendChild(C.el('span', null, 'Salário-maternidade, pensão por morte, auxílio-reclusão, incapacidade temporária e permanente, aposentadoria por idade, por tempo de contribuição, especial, de professor e da pessoa com deficiência'));
    sum.appendChild(alvo); sum.appendChild(txt);
    sum.appendChild(C.el('span', 'convite-seta'));
    det.appendChild(sum);
    det.appendChild(bloco);
    sec.appendChild(det);
    saida.appendChild(sec);
    return sec;
  }

  var api = { comExtras: comExtras, itemExtra: itemExtra, linhaBenIncapacidade: linhaBenIncapacidade, linhaRetorno: linhaRetorno, condicionarCarencia: condicionarCarencia, exigidaNoRetorno: exigidaNoRetorno, mesesRurais: mesesRurais, linhaRural: linhaRural, complementosEm: complementosEm, contarComplementos: contarComplementos, perguntasCarencia: perguntasCarencia, perguntasUI: perguntasUI, util: { lista: lista, dinheiro: function (n) { return dinheiro(n); } }, salarioMaternidade: salarioMaternidade, montar: montar, vencimento: vencimento, ultimoDiaDaQualidade: ultimoDiaDaQualidade, sequencia: sequencia, classeDe: classeDe, NORMAS: NORMAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DIREITO = api;
})(typeof window !== 'undefined' ? window : globalThis);
