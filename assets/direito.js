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
    mei: 'Microempreendedora individual (MEI)', facultativa: 'Segurada facultativa', especial: 'Segurada especial', rpps: 'Regime próprio', outra: 'Outra categoria'
  };
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
    if (/individual/i.test(t)) return (item.codigosIndicadores || []).indexOf('IREC-MEI') >= 0 ? 'mei' : 'ci';
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
  function sequencia(analise, itensClasse, ate) {
    var contrib = {}, cobertos = {}, presum = {};
    analise.vinculos.forEach(function (v) {
      if (!v.valido) return;
      var a = C.mesDe(v.inicio.y, v.inicio.m), b = C.mesDe(v.fimContado.y, v.fimContado.m);
      for (var k = a; k <= b; k++) {
        cobertos[k] = true;
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
          var g = streak > 120 ? 24 : 12;
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
    var ativos = [];
    itens.forEach(function (v) {
      var cl = classes[v.seq];
      if (v.inicio.ord > fgOrd) return;
      if (DE_EMPREGO[cl] || cl === 'rpps') {
        var encerrado = v.fim && v.fim.ord < fgOrd;
        if (encerrado) return;
        var ult = ultimaCompetencia(v);
        var aviso = null;
        if (!v.fim) aviso = 'vínculo sem data de fim' + (ult >= 0 ? ' (última remuneração em ' + rotuloMes(ult) + ')' : ' e sem remuneração');
        if (!v.fim && ult >= 0 && fgMes - ult >= 3) aviso += ': pode ter terminado antes do fato gerador';
        ativos.push({ seq: v.seq, nome: v.nome, classe: cl, item: v, aviso: aviso, porDatas: true });
      } else if (DE_RECOLHIMENTO[cl] || cl === 'especial') {
        if (v.contribuicoes && v.contribuicoes[fgMes] !== undefined) {
          ativos.push({ seq: v.seq, nome: v.nome, classe: cl, item: v, aviso: null, porDatas: false });
        }
      }
    });
    var usada, motivo;
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
        } else if (DE_RECOLHIMENTO[cl] || cl === 'especial') {
          var u = ultimaCompetencia(v, fgMes);
          if (u >= 0) cands.push({ fim: C.ultimoDiaDoMes(u), mc: u, classe: cl, seq: v.seq, nome: v.nome, origem: 'última contribuição da competência ' + rotuloMes(u) });
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
          var sqU = sequencia(analise, seqCls, u.mc);
          var fac = u.classe === 'facultativa';
          var b = fac ? 6 : 12;
          var e120 = !fac && sqU.total > 120;
          var a1 = ultimoDiaDaQualidade(u.mc, b);
          var a24 = !fac ? ultimoDiaDaQualidade(u.mc, b + 12) : null;
          var aDes = !fac ? ultimoDiaDaQualidade(u.mc, (e120 ? 24 : 12) + 12) : null;
          return { u: u, sq: sqU, facult: fac, base: b, ate120: e120, ate: a1, ate24: a24, ateDes: aDes, prazoFinal: e120 ? a24 : a1 };
        };
        var g1 = calcGraca(ultimo), notaFac = null;
        if (g1.facult && fgOrd > g1.prazoFinal) {
          // Facultativa perde a qualidade em 6 meses: confere se a atividade obrigatória anterior ainda a mantém (12/24 meses, +12 com desemprego).
          var alt = cands.filter(function (c) { return c.classe !== 'facultativa'; })[0];
          if (alt) {
            var g2 = calcGraca(alt);
            var fim2 = g2.ateDes || g2.prazoFinal;
            if (fim2 > g1.prazoFinal) {
              notaFac = 'Como facultativa, o prazo de 6 meses terminou em ' + rotulo(dObj(g1.prazoFinal)) + ', antes do fato gerador. Mas houve atividade anterior como ' + (alt.classe === 'beneficio' ? 'benefício' : CLASSES[alt.classe].toLowerCase()) + ' (Seq. ' + alt.seq + ', ' + alt.origem + '), que mantém a qualidade pelo prazo da categoria obrigatória (12 meses, 24 com mais de 120 contribuições, e mais 12 com desemprego involuntário comprovado). A conferência passa a usar essa atividade.';
              g1 = g2; ultimo = alt;
            }
          }
        }
        var sq = g1.sq, facult = g1.facult, base = g1.base, ate120 = g1.ate120, ate = g1.ate, ate24 = g1.ate24, ateDes = g1.ateDes, prazoFinal = g1.prazoFinal;
        q.graca = {
          dataInicial: ultimo.origem, competenciaCessacao: rotuloMes(ultimo.mc), categoria: ultimo.classe === 'beneficio' ? 'Benefício' : CLASSES[ultimo.classe],
          prazoBase: base, contribuicoes: sq.total, extensao120: ate120, presumidos: sq.presumidos,
          ateBase: dObj(ate), ateComExtensao: ate120 ? dObj(ate24) : null, ateComDesemprego: ateDes ? dObj(ateDes) : null
        };
        q.linhas.push('Sem vínculo ou recolhimento ativo na data. Última cobertura: Seq. ' + ultimo.seq + ' (' + ultimo.nome + '), ' + ultimo.origem + '.');
        if (notaFac) q.linhas.push(notaFac);
        q.linhas.push('Categoria considerada: ' + q.graca.categoria.toLowerCase() + '. Prazo-base: ' + base + ' meses' + (facult ? ' (facultativa)' : ' (art. 15, II, da Lei 8.213/91)') + '.');
        q.linhas.push('Contagem: a qualidade se mantém até o vencimento da contribuição do mês seguinte ao fim do prazo (dia ' + DIA_VENCIMENTO + ', passando para o dia útil seguinte se cair em fim de semana): até ' + rotulo(dObj(ate)) + ' no prazo-base. Não é somar 12 meses à data da última contribuição.');
        if (!facult) {
          q.linhas.push('Contribuições seguidas sem perda da qualidade até a cessação: ' + sq.total + (sq.presumidos ? ' (inclui ' + sq.presumidos + ' mês(es) de vínculo anteriores a 07/1994, presumidos)' : '') + '. ' +
            (ate120 ? 'Mais de 120: o prazo passa a 24 meses (art. 15, § 1º), até ' + rotulo(dObj(ate24)) + '.' : 'Não passa de 120, então não há prorrogação para 24 meses.'));
          q.linhas.push('Desemprego involuntário comprovado soma mais 12 meses (art. 15, § 2º): a qualidade iria até ' + rotulo(dObj(ateDes)) + '.');
        }
        var indicioSeguro = analise.eventos.filter(function (e) { return /SEGURO[- ]DESEMPREGO/i.test(e.texto || ''); })[0];
        if (indicioSeguro) q.linhas.push('O CNIS registra evento de seguro-desemprego (' + (indicioSeguro.inicio ? rotulo(indicioSeguro.inicio) : 's/d') + (indicioSeguro.fim ? ' a ' + rotulo(indicioSeguro.fim) : '') + '): é um indício de desemprego, mas não substitui o registro no órgão próprio.');
        var des = !!entrada.desemprego;
        if (fgOrd <= prazoFinal) {
          definir('confirmada', 'Confirmada pelos dados disponíveis');
          q.linhas.push('Fato gerador em ' + rotulo(fgD) + ': dentro do período de graça (' + rotulo(dObj(prazoFinal)) + ').');
          if (ultimo.classe === 'beneficio') q.linhas.push('Depois da cessação do benefício, o prazo seguinte conta como período de graça.');
        } else if (ateDes && fgOrd <= ateDes) {
          if (des) { definir('provavel', 'Provável, dependendo de validação documental'); q.linhas.push('Fato gerador depois do prazo normal, mas dentro da prorrogação por desemprego, que você informou estar comprovado.'); }
          else { definir('indeterminada', 'Indeterminada por falta de informações'); q.linhas.push('Fato gerador depois do prazo normal (' + rotulo(dObj(prazoFinal)) + '). Só haveria qualidade com desemprego involuntário comprovado, e isso não foi informado.'); }
          doc('Comprovação do desemprego: registro no órgão próprio (SINE/MTE), seguro-desemprego ou CTPS com rescisão sem justa causa');
        } else {
          definir('possivelmente_perdida', 'Possivelmente perdida');
          q.linhas.push('Fato gerador em ' + rotulo(fgD) + ', depois do fim do período de graça' + (ateDes ? ' mesmo com a prorrogação por desemprego (' + rotulo(dObj(ateDes)) + ')' : '') + '. A perda não é automática: outras atividades, benefícios ou provas fora do CNIS podem mudar o resultado.');
          doc('Documentos de atividade ou contribuição que não aparecem no CNIS');
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
      if (+k > fgMes) return;
      var tot = analise.valores[k].reduce(function (t, x) { return t + x.valor; }, 0);
      var m = C.minimoDe(+k);
      if (m !== null && tot + 0.004 >= m) validasAte++;
    });
    res.carencia = {
      status: 'dispensada', rotulo: 'Dispensada',
      linhas: [
        'Carência tratada como dispensada para todas as categorias, conforme a orientação das ADIs 2.110 e 2.111 e a regulamentação do INSS informada ao sistema. Não se exige automaticamente 10 contribuições de MEI, contribuinte individual ou facultativa.',
        'Dispensar a carência não dispensa a filiação ao RGPS nem a qualidade de segurado na data do fato gerador, nem a validade das contribuições.',
        'Uma única contribuição, mesmo paga depois do fato gerador, não garante o benefício por si só.',
        'Informativo: o CNIS tem ' + validasAte + ' competência(s) de 07/1994 até ' + rotuloMes(fgMes) + ' com valor igual ou acima do salário mínimo.'
      ],
      competenciasValidas: validasAte
    };
    if (atrasosAtivos.length) res.carencia.linhas.push('Há recolhimentos em atraso (' + atrasosAtivos.length + '): verifique se são válidos para demonstrar filiação e cobertura na situação analisada.');

    // ----- Etapa 5: validade do CNIS -----
    var relevantes = ativos.map(function (a) { return a.item; });
    var ultimoSeq = q.graca ? null : null;
    function add(achado, impacto, documento, impede, providencia) { res.cnis.push({ achado: achado, impacto: impacto, documento: documento, impede: impede, providencia: providencia }); }
    ativos.forEach(function (a) {
      if (!a.item.fim) {
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
    esp('Segurada desempregada', semAtivo ? 'aplica' : 'nao', semAtivo ? 'Sem vínculo ativo: a qualidade depende do período de graça e do desemprego involuntário comprovado.' : 'Há vínculo, recolhimento ou benefício na data.');
    var meiAtivo = ativos.filter(function (a) { return a.classe === 'mei'; })[0];
    var contMEI = meiAtivo ? Object.keys(meiAtivo.item.contribuicoes).length : 0;
    esp('MEI com poucas contribuições', meiAtivo && contMEI < 10 ? 'verificar' : 'nao', meiAtivo ? 'MEI com ' + contMEI + ' contribuição(ões) no CNIS. A carência está dispensada, mas confira a regularidade e o início da atividade.' : 'Não há MEI ativo na data.');
    var ciAtrasos = atrasosAtivos.filter(function (x) { return ativos.some(function (a) { return a.classe === 'ci' || a.classe === 'mei'; }); });
    esp('Contribuinte individual com recolhimentos em atraso', ciAtrasos.length ? 'verificar' : 'nao', ciAtrasos.length ? ciAtrasos.length + ' recolhimento(s) em atraso: confirme a validade e a prova da atividade.' : 'Sem atraso identificado (as datas de pagamento nem sempre constam do extrato).');
    var facAtiva = ativos.filter(function (a) { return a.classe === 'facultativa'; })[0];
    esp('Facultativa com início recente de contribuições', facAtiva && Object.keys(facAtiva.item.contribuicoes).length < 12 ? 'verificar' : 'nao', facAtiva ? 'Facultativa com ' + Object.keys(facAtiva.item.contribuicoes).length + ' contribuição(ões): a filiação conta da primeira contribuição paga.' : 'Não há facultativa ativa na data.');
    esp('Segurada especial rural', (usada === 'especial' || entrada.categoria === 'especial') ? 'verificar' : 'nao', 'Exige prova da atividade rural (autodeclaração, documentos de terra, notas de produtor e outros), que o CNIS pode não trazer. Esta verificação não conclui sozinha.');
    var omissao = ativos.some(function (a) { return !a.item.fim || (a.item.mesesFaltantes || []).some(function (k) { return k >= fgMes - 15 && k <= fgMes; }); });
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
    var viavel = q.status === 'confirmada' || q.status === 'provavel' || q.status === 'indeterminada';
    var vl = { calculado: false, linhas: [] };
    res.valor = vl;
    var classeValor = usada || (q.graca ? Object.keys(CLASSES).filter(function (k) { return CLASSES[k] === q.graca.categoria; })[0] : null);
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
        var k6 = Object.keys(todos).map(Number).filter(function (k) { return k < mesRef && k >= mesRef - 12 && todos[k] > 0; }).sort(function (a, b) { return b - a; }).slice(0, 6);
        if (!k6.length) vl.linhas.push('Valor não calculado: não há remuneração nos 12 meses anteriores.');
        else {
          var ult = todos[k6[0]];
          var vals = k6.map(function (k) { return todos[k]; });
          var media6 = vals.reduce(function (t, x) { return t + x; }, 0) / vals.length;
          var variavel = Math.max.apply(null, vals) / Math.min.apply(null, vals) > 1.1;
          var ref = (classeValor === 'domestica') ? ult : (variavel ? media6 : ult);
          vl.calculado = true; vl.mensal = Math.round(ref * 100) / 100;
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

    // ----- Conclusão -----
    var pend = [];
    res.cnis.filter(function (x) { return x.impede; }).forEach(function (x) { pend.push(x.achado + ' ' + x.documento + '.'); });
    res.especiais.filter(function (x) { return x.situacao === 'verificar'; }).forEach(function (x) { pend.push(x.nome + ': verificar.'); });
    var conc;
    if (q.status === 'confirmada' && !pend.length) conc = { status: 'provavel', rotulo: 'Direito provável', texto: 'Com os dados do CNIS, a qualidade de segurado está demonstrada na data do fato gerador e a carência está dispensada. Falta apenas o fato gerador ser comprovado por documento.' };
    else if (q.status === 'confirmada' || q.status === 'provavel') conc = { status: 'depende', rotulo: 'Direito depende de validação documental', texto: 'A qualidade de segurado é compatível com o CNIS, mas há pontos a validar antes de concluir.' };
    else if (q.status === 'indeterminada') conc = { status: 'depende', rotulo: 'Indeterminado por falta de informações', texto: 'O resultado depende de informação ou prova que não consta nos dados (como o desemprego involuntário).' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado pelos dados', texto: 'Os dados do CNIS não demonstram a qualidade de segurado na data do fato gerador. Isso não é uma conclusão definitiva: outras provas podem alterar o resultado.' };
    if (fg.prazoExcedido) {
      conc = { status: 'prescrito', rotulo: 'Sem direito: prescrição', texto: 'O fato gerador (' + rotulo(fgD) + ') tem mais de 5 anos: o prazo para requerer terminou em ' + rotulo(fg.prazoRequerer) + ' (art. 357, § 5º, da IN 128/2022). Pelos dados informados, o benefício está prescrito. A análise abaixo é apenas informativa.' };
      pend = [];
    }
    conc.pendencias = pend;
    res.conclusao = conc;
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
    itens.forEach(function (t) { ul.appendChild(C.el('li', null, t)); });
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
    if (!r.fatoGerador.valido) { saida.insertBefore(topo, saida.firstChild); return topo; }

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
        ['Com desemprego involuntário comprovado', g.ateComDesemprego ? C.rotuloData(g.ateComDesemprego) : 'não se aplica']
      ]));
    }
    topo.appendChild(s3);

    var ca = r.carencia;
    var s4 = C.sec('4. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-confirmada', ca.rotulo));
    s4.appendChild(sc);
    s4.appendChild(lista(ca.linhas));
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

  // Bloco "Verificar direito", logo abaixo do mapa de competências. Usa a análise já feita, sem reenviar o extrato.
  function montar(saida, analise) {
    var bloco = C.sec('Verificar direito a um benefício', 'Escolha o benefício e a data do fato gerador e clique em Verificar direito. A conferência usa o extrato já lido.');
    bloco.id = 'cnis-direito';
    var grade = C.el('div', 'grade-campos');
    grade.appendChild(campo('Benefício', selecao('dir-beneficio', [['salario-maternidade', 'Salário-maternidade']])));
    grade.appendChild(campo('Fato gerador', selecao('dir-tipo', [['parto', 'Parto'], ['natimorto', 'Natimorto'], ['aborto', 'Aborto não criminoso'], ['adocao', 'Adoção'], ['guarda', 'Guarda judicial para adoção'], ['outro', 'Outra hipótese']])));
    grade.appendChild(campo('Data do fato gerador', entrada('dir-data', 'date')));
    grade.appendChild(campo('Início do afastamento (se houver)', entrada('dir-afast', 'date')));
    grade.appendChild(campo('Categoria na data', selecao('dir-categoria', [['auto', 'Identificar pelo CNIS'], ['empregada', 'Empregada'], ['domestica', 'Empregada doméstica'], ['avulsa', 'Trabalhadora avulsa'], ['ci', 'Contribuinte individual'], ['mei', 'MEI'], ['facultativa', 'Facultativa'], ['especial', 'Segurada especial']])));
    bloco.appendChild(grade);
    var marcas = C.el('div', 'marcas');
    marcas.appendChild(marca('dir-desemprego', 'Desemprego involuntário comprovado'));
    marcas.appendChild(marca('dir-internacao', 'Internação prolongada (mãe ou bebê)'));
    marcas.appendChild(marca('dir-falecimento', 'Falecimento de quem teria direito'));
    marcas.appendChild(marca('dir-anterior', 'Há requerimento anterior pelo mesmo fato'));
    bloco.appendChild(marcas);
    var acoes = C.el('div', 'acoes');
    var botao = C.el('button', 'btn', 'Verificar direito'); botao.type = 'button'; botao.id = 'dir-verificar';
    acoes.appendChild(botao);
    bloco.appendChild(acoes);
    var resultado = C.el('div'); resultado.id = 'dir-resultado'; resultado.setAttribute('aria-live', 'polite');
    bloco.appendChild(resultado);
    botao.addEventListener('click', function () {
      var campos = lerCampos();
      if (!campos.data) { resultado.textContent = ''; resultado.appendChild(C.el('p', 'msg', 'Informe a data do fato gerador.')); return; }
      resultado.textContent = '';
      resultado.appendChild(renderizar(salarioMaternidade(analise, campos, hojeAgora())));
    });
    saida.appendChild(bloco);
    return bloco;
  }

  var api = { salarioMaternidade: salarioMaternidade, montar: montar, vencimento: vencimento, ultimoDiaDaQualidade: ultimoDiaDaQualidade, sequencia: sequencia, classeDe: classeDe, NORMAS: NORMAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DIREITO = api;
})(typeof window !== 'undefined' ? window : globalThis);
