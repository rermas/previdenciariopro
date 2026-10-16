// Verificação de direito: aposentadoria por tempo de contribuição (regras de transição da EC 103/2019).
// Roda no navegador, sem enviar dados. Depende de cnis.js, direito.js e idade.js.
(function (root) {
  'use strict';
  var C = root.CNIS || (typeof require !== 'undefined' ? require('./cnis.js') : null);
  var D = root.DIREITO || (typeof require !== 'undefined' ? require('./direito.js') : null);
  var I = root.IDADE || (typeof require !== 'undefined' ? require('./idade.js') : null);

  var EC = C.ordemDe(2019, 11, 13);
  var NATUREZAS = [
    { id: 'comum', nome: 'Comum', peso: 0 },
    { id: 'esp25', nome: 'Especial de 25 anos', peso: 1 },
    { id: 'esp20', nome: 'Especial de 20 anos', peso: 2 },
    { id: 'esp15', nome: 'Especial de 15 anos', peso: 3 },
    { id: 'indenizado', nome: 'Período indenizado ou com CTC (conta como comum)', peso: 0, comum: true },
    { id: 'desconsiderar', nome: 'Desconsiderar o período', peso: -1 }
  ];
  var NAT = {}; NATUREZAS.forEach(function (n) { NAT[n.id] = n; });
  // Conversão de tempo especial em comum (Decreto 3.048, art. 70), só para o tempo até 13/11/2019 (EC 103, art. 25, § 2º).
  var FATOR = { F: { esp15: 2.0, esp20: 1.5, esp25: 1.2 }, M: { esp15: 2.33, esp20: 1.75, esp25: 1.4 } };

  var NORMAS = [
    { nome: 'EC 103/2019, arts. 15, 16, 17, 20 e 25', vigencia: 'Regras de transição por pontos, idade mínima progressiva, pedágio de 50% e pedágio de 100%. O art. 25, § 2º, limita a conversão do tempo especial ao período até 13/11/2019.' },
    { nome: 'Decreto 3.048/1999, art. 70 (conversão de tempo especial)', vigencia: 'Fatores de conversão usados: mulher 2,00 / 1,50 / 1,20 e homem 2,33 / 1,75 / 1,40, para atividades de 15, 20 e 25 anos. Confira a versão vigente.' },
    { nome: 'Lei 8.213/91, arts. 25, II, 55 e 142', vigencia: 'Carência de 180 contribuições; tempo intercalado de benefício por incapacidade conta como tempo de contribuição; tempo rural de segurado especial até 31/10/1991 conta sem recolhimento, mas não como carência; de 11/1991 em diante só com indenização.' },
    { nome: 'Lei 10.666/2003, art. 3º, caput', vigencia: 'A perda da qualidade de segurado não impede a aposentadoria por tempo de contribuição.' },
    { nome: 'IN PRES/INSS 128/2022 (com a IN 212/2026)', vigencia: 'Competências com alíquota reduzida de 5%, 11% ou 12% só contam como tempo de contribuição com complementação para 20%. O CNIS não informa a alíquota: confira esses períodos.' }
  ];

  function lerData(x) {
    if (!x) return null;
    if (typeof x === 'string') { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x); return m ? C.dataDe(m[3] + '/' + m[2] + '/' + m[1]) : null; }
    return x.ord !== undefined ? x : null;
  }
  function rot(d) { return C.rotuloData(d); }
  function ageMeses(nasc, d) { return (d.y - nasc.y) * 12 + (d.m - nasc.m) - (d.d < nasc.d ? 1 : 0); }
  function textoMeses(m) { var a = Math.floor(m / 12), r = m % 12; return a + ' anos' + (r ? ' e ' + r + ' meses' : ''); }
  function dur(dias) { return C.formatarDuracao(Math.max(0, Math.round(dias))); }

  // ---------- Regras do enquadramento por tipo de vínculo ----------
  // Facultativo e segurado especial não admitem enquadramento; contribuinte individual só até 28/04/1995;
  // empregado rural só a partir de 01/11/1991. Devolve null (não enquadrável) ou os limites {min, max} em ordinal de dia (null = sem limite).
  var LIM_CI = C.ordemDe(1995, 4, 28), LIM_RURAL = C.ordemDe(1991, 11, 1);
  function regraEnq(v) {
    var t = v.tipo || '', ini = v.inicioOrd !== undefined ? v.inicioOrd : (v.inicio && v.inicio.ord), fim = v.fimOrd !== undefined ? v.fimOrd : (v.fimContado && v.fimContado.ord);
    if (/facultativ/i.test(t) || /especial/i.test(t)) return null;
    var min = null, max = null, motivo = '';
    if (/individual|aut[ôo]nomo/i.test(t)) { max = LIM_CI; motivo = 'contribuinte individual só até 28/04/1995'; }
    else if (C.ehRural(v)) { min = LIM_RURAL; motivo = 'empregado rural só a partir de 01/11/1991'; }
    if (max !== null && ini > max) return null;
    if (min !== null && fim < min) return null;
    return { min: min, max: max, motivo: motivo };
  }

  // ---------- Contagem por dia, com o enquadramento ----------
  function contar(analise, entrada, der) {
    var mm = I.montarMeses(analise, entrada, der, { modalidade: 'urbana', modo: 'tc', indenizaEspecial: entrada.indenizaEspecial === true });
    var sexo = entrada.sexo === 'M' ? 'M' : 'F';
    var enq = (entrada.enquadramento || []).filter(function (e) { return e && e.inicio && e.fim && NAT[e.natureza]; });
    var ajustes = [];
    enq = enq.map(function (e) {
      if (!e.seq || e.livre) return e;
      var v = analise.vinculos.filter(function (x) { return x.seq === e.seq; })[0];
      if (!v || !v.valido) return e;
      var rg = regraEnq(v);
      if (!rg) { ajustes.push('Seq. ' + e.seq + ': este tipo de vínculo não admite enquadramento; o período foi tratado como comum.'); return null; }
      var i = e.inicio, f = e.fim, mudou = false;
      if (rg.min !== null && i.ord < rg.min) { i = C.dataDeOrd(rg.min); mudou = true; }
      if (rg.max !== null && f.ord > rg.max) { f = C.dataDeOrd(rg.max); mudou = true; }
      if (f.ord < i.ord) { ajustes.push('Seq. ' + e.seq + ': enquadramento fora do limite permitido (' + rg.motivo + '); tratado como comum.'); return null; }
      if (mudou) ajustes.push('Seq. ' + e.seq + ': enquadramento ajustado a ' + rot(i) + ' a ' + rot(f) + ' (' + rg.motivo + ').');
      return { seq: e.seq, inicio: i, fim: f, natureza: e.natureza, nota: e.nota };
    }).filter(Boolean);
    var porSeq = {};
    enq.forEach(function (e) { if (e.seq) (porSeq[e.seq] = porSeq[e.seq] || []).push(e); });
    var dias = {};  // ordinal do dia -> peso da natureza (maior prevalece), -1 = desconsiderar
    function poe(d, peso) {
      var a = dias[d];
      if (a === -1) return;
      if (peso === -1) { dias[d] = -1; return; }
      if (a === undefined || peso > a) dias[d] = peso;
    }
    Object.keys(mm.contados).forEach(function (k) {
      mm.contados[k].ints.forEach(function (it) {
        var lista = it[2] ? (porSeq[it[2]] || []) : [];
        for (var d = it[0]; d <= it[1] && d <= der.ord; d++) {
          var peso = 0, desc = false;
          for (var j = 0; j < lista.length; j++) {
            if (d < lista[j].inicio.ord || d > lista[j].fim.ord) continue;
            var pj = NAT[lista[j].natureza].peso;
            if (pj === -1) desc = true; else peso = Math.max(peso, pj);
          }
          poe(d, desc ? -1 : peso);
        }
      });
    });
    // Períodos fora do CNIS (sem vínculo associado)
    enq.filter(function (e) { return !e.seq; }).forEach(function (e) {
      for (var d = e.inicio.ord; d <= e.fim.ord && d <= der.ord; d++) poe(d, NAT[e.natureza].peso);
    });
    var tot = { comum: 0, esp25: 0, esp20: 0, esp15: 0 }, ate = { comum: 0, esp25: 0, esp20: 0, esp15: 0 };
    var porPeso = ['comum', 'esp25', 'esp20', 'esp15'];
    Object.keys(dias).forEach(function (ks) {
      var d = +ks, p = dias[d];
      if (p < 0) return;
      var cat = porPeso[p];
      tot[cat]++; if (d <= EC) ate[cat]++;
    });
    function bruto(o) { return o.comum + o.esp25 + o.esp20 + o.esp15; }
    function conv(o) { var f = FATOR[sexo]; return o.comum + o.esp25 * f.esp25 + o.esp20 * f.esp20 + o.esp15 * f.esp15; }
    function convParcial(o, oEC) {
      var f = FATOR[sexo];
      // até a EC converte; depois da EC o especial conta como tempo simples
      return conv(oEC) + (bruto(o) - bruto(oEC));
    }
    var fatores = FATOR[sexo];
    return {
      mm: mm, tot: tot, ate: ate, fatores: fatores, ajustes: ajustes,
      brutoDer: bruto(tot), brutoEC: bruto(ate),
      convDer: convParcial(tot, ate), convEC: conv(ate),
      temEspecial: tot.esp25 + tot.esp20 + tot.esp15 > 0
    };
  }

  // ---------- Regras de transição ----------
  function pontosExigidos(sexo, ano) { return sexo === 'F' ? Math.min(100, 86 + Math.max(0, ano - 2019)) : Math.min(105, 96 + Math.max(0, ano - 2019)); }
  function idadeProgressivaMeses(sexo, ano) { var base = sexo === 'F' ? 56 * 12 : 61 * 12, teto = sexo === 'F' ? 62 * 12 : 65 * 12; return Math.min(teto, base + 6 * Math.max(0, ano - 2019)); }

  function requisitosDe(regra, ctx, d, tcDias, carenciaMeses) {
    var sexo = ctx.sexo, req = (sexo === 'F' ? 30 : 35) * 365, idadeM = ageMeses(ctx.nasc, d), ano = d.y;
    var out = [];
    function r(nome, ok, atual, exigido) { out.push({ nome: nome, ok: ok, atual: atual, exigido: exigido }); }
    var falta = Math.max(0, req - ctx.tcEC);
    if (regra === 'pontos') {
      var pe = pontosExigidos(sexo, ano);
      var pts = (d.ord - ctx.nasc.ord) / 365.25 + tcDias / 365;
      r('Tempo de contribuição', tcDias >= req, dur(tcDias), (sexo === 'F' ? 30 : 35) + ' anos');
      r('Pontos (idade + tempo de contribuição)', pts >= pe, pts.toFixed(2).replace('.', ','), String(pe) + ' pontos em ' + ano);
    } else if (regra === 'idade') {
      var im = idadeProgressivaMeses(sexo, ano);
      r('Tempo de contribuição', tcDias >= req, dur(tcDias), (sexo === 'F' ? 30 : 35) + ' anos');
      r('Idade mínima progressiva', idadeM >= im, textoMeses(Math.max(0, idadeM)), textoMeses(im) + ' em ' + ano);
    } else if (regra === 'pedagio50') {
      var elegivel = ctx.tcEC > req - 2 * 365;
      r('Mais de ' + (sexo === 'F' ? 28 : 33) + ' anos de contribuição em 13/11/2019 (faltavam menos de 2 anos)', elegivel, dur(ctx.tcEC) + ' em 13/11/2019', ctx.tcEC >= req ? 'Nada faltava: o tempo mínimo (' + (sexo === 'F' ? 30 : 35) + ' anos) já estava cumprido em 13/11/2019 (pedágio zero); veja também o direito adquirido' : 'mais de ' + (sexo === 'F' ? 28 : 33) + ' anos');
      var exigido = req + falta * 0.5;
      r('Tempo de contribuição com pedágio de 50%', tcDias >= exigido, dur(tcDias), dur(exigido) + (ctx.tcEC >= req ? ' (pedágio zero: já tinha o tempo mínimo em 13/11/2019)' : ' (pedágio de ' + dur(falta * 0.5) + ')'));
    } else if (regra === 'pedagio100') {
      var ex100 = req + falta;
      var idMin = (sexo === 'F' ? 57 : 60) * 12;
      r('Tempo de contribuição com pedágio de 100%', tcDias >= ex100, dur(tcDias), dur(ex100) + (ctx.tcEC >= req ? ' (pedágio zero: já tinha o tempo mínimo em 13/11/2019)' : ' (pedágio de ' + dur(falta) + ')'));
      r('Idade mínima', idadeM >= idMin, textoMeses(Math.max(0, idadeM)), (sexo === 'F' ? 57 : 60) + ' anos');
    }
    r('Carência', carenciaMeses >= ctx.carenciaExigida, carenciaMeses + ' meses', ctx.carenciaExigida + ' meses');
    return out;
  }
  var REGRAS = [
    { id: 'pontos', nome: 'Regra dos pontos', norma: 'art. 15 da EC 103/2019', desc: 'Tempo mínimo de 30 anos (mulher) ou 35 (homem) e soma de idade e tempo de contribuição, que sobe 1 ponto por ano.' },
    { id: 'idade', nome: 'Idade mínima progressiva', norma: 'art. 16 da EC 103/2019', desc: 'Tempo mínimo de 30/35 anos e idade mínima que sobe 6 meses por ano (mulher até 62, homem até 65).' },
    { id: 'pedagio50', nome: 'Pedágio de 50%', norma: 'art. 17 da EC 103/2019', desc: 'Para quem em 13/11/2019 tinha mais de 28 anos (mulher) ou 33 (homem) de contribuição: cumprir o tempo mínimo mais 50% do que faltava, sem idade mínima.' },
    { id: 'pedagio100', nome: 'Pedágio de 100%', norma: 'art. 20 da EC 103/2019', desc: 'Idade mínima de 57 (mulher) ou 60 (homem) e o tempo mínimo mais 100% do que faltava em 13/11/2019.' }
  ];

  function aposentadoriaTempo(analise, entrada, hoje) {
    var res = { beneficio: 'aposentadoria-tempo', titulo: 'aposentadoria por tempo de contribuição', normas: NORMAS, entrada: entrada, fato: { data: null } };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der), sexo = entrada.sexo === 'M' ? 'M' : 'F';
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER).', pendencias: [] };
      return res;
    }
    res.fato.data = der;
    var ct = contar(analise, entrada, der);
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.valido && v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var manualPrimeira = (entrada.enquadramento || []).filter(function (e) { return e && e.inicio && !e.seq; }).reduce(function (m, e) { return !m || e.inicio.ord < m.ord ? e.inicio : m; }, null);
    if (manualPrimeira && (!primeira || manualPrimeira.ord < primeira.ord)) primeira = manualPrimeira;
    var filiadoAteEC = primeira ? primeira.ord <= EC : null;
    var usaTabela = !!(primeira && primeira.ord <= C.ordemDe(1991, 7, 24));
    var carenciaMm = I.montarMeses(analise, entrada, der, { modalidade: 'urbana' });
    var carenciaMeses = Object.keys(carenciaMm.contados).length;
    var ctx = { sexo: sexo, nasc: nasc, tcEC: ct.convEC, carenciaExigida: I.carenciaExigida(der.y, usaTabela) };
    var req = (sexo === 'F' ? 30 : 35) * 365;

    var avaliacoes = REGRAS.map(function (rg) {
      var reqs = requisitosDe(rg.id, ctx, der, ct.convDer, carenciaMeses);
      var ok = reqs.every(function (x) { return x.ok; });
      var quando = null;
      if (!ok) {
        // Projeção: mantidas as contribuições a partir da DER, dia a dia, por até 20 anos.
        for (var dd = 1; dd <= 365 * 20; dd++) {
          var dt = C.dataDeOrd(der.ord + dd);
          var rr = requisitosDe(rg.id, ctx, dt, ct.convDer + dd, carenciaMeses + Math.floor(dd / 30));
          if (rr.every(function (x) { return x.ok; })) { quando = dt; break; }
        }
      }
      return { regra: rg, reqs: reqs, ok: ok, quando: quando, aplicavel: filiadoAteEC !== false };
    });

    var linhasTempo = [];
    linhasTempo.push('Tempo contado pelo CNIS e pelo enquadramento informado, sem contar duas vezes o que é concomitante: **' + dur(ct.brutoDer) + '** até a DER (' + rot(der) + ') e **' + dur(ct.brutoEC) + '** até 13/11/2019.');
    if (ct.temEspecial) {
      linhasTempo.push('Há tempo especial enquadrado. Convertido pelo fator da EC 103 (só o tempo até 13/11/2019 se converte): **' + dur(ct.convEC) + '** em 13/11/2019 e **' + dur(ct.convDer) + '** na DER.');
      linhasTempo.push('Fatores usados (' + (sexo === 'F' ? 'mulher' : 'homem') + '): especial de 15 anos ' + String(ct.fatores.esp15).replace('.', ',') + ', de 20 anos ' + String(ct.fatores.esp20).replace('.', ',') + ', de 25 anos ' + String(ct.fatores.esp25).replace('.', ',') + '. O tempo especial depois de 13/11/2019 conta como tempo simples.');
    } else {
      linhasTempo.push('Nenhum período foi enquadrado como especial. Se houve atividade com exposição a agentes nocivos, marque o período no enquadramento: o CNIS não informa isso.');
    }
    var ex = ct.mm.ex;
    if (ex.abaixoEmp.length) linhasTempo.push(ex.abaixoEmp.length + ' mês(es) de empregado abaixo do salário mínimo não foram contados (' + I.faixas(ex.abaixoEmp) + ').');
    if (ex.abaixoCI.length) linhasTempo.push(ex.abaixoCI.length + ' mês(es) de contribuinte individual ou facultativo abaixo do mínimo não foram contados (' + I.faixas(ex.abaixoCI) + ').');
    if (ex.aposFG.length) linhasTempo.push(ex.aposFG.length + ' competência(s) paga(s) depois da DER não contam (' + I.faixas(ex.aposFG) + ').');
    if (ex.domesticoAntes.length) linhasTempo.push(ex.domesticoAntes.length + ' mês(es) de doméstico antes de 06/2015 sem recolhimento não foram contados (' + I.faixas(ex.domesticoAntes) + ').');
    if (ex.rpps) linhasTempo.push('Há vínculo de regime próprio (servidor): o tempo só entra com certidão de tempo de contribuição (CTC). Use "Período indenizado ou com CTC" no enquadramento.');
    if (ct.mm.incap && ct.mm.incap.contados) linhasTempo.push(ct.mm.incap.contados + ' benefício(s) por incapacidade intercalado(s) com contribuição foram contados como tempo (Lei 8.213, art. 55, II).');
    linhasTempo.push('Competências com alíquota de 5%, 11% ou 12% não aparecem como tal no CNIS e só contam como tempo de contribuição com complementação para 20%.');
    res.tempo = { brutoDer: ct.brutoDer, brutoEC: ct.brutoEC, convDer: ct.convDer, convEC: ct.convEC, linhas: linhasTempo, tabela: ct };

    var linhasCar = ['Carência no CNIS até a DER: **' + carenciaMeses + ' meses**. Exigidos: **' + ctx.carenciaExigida + '**.'];
    res.carencia = { total: carenciaMeses, exigida: ctx.carenciaExigida, ok: carenciaMeses >= ctx.carenciaExigida, linhas: linhasCar };

    var adquirido = ct.convEC >= req;
    var avisos = [];
    if (filiadoAteEC === false) avisos.push('O primeiro vínculo é posterior a 13/11/2019: as regras de transição não se aplicam. Para esses segurados só há a aposentadoria programada por idade.');
    (ct.ajustes || []).forEach(function (x) { avisos.push('Enquadramento: ' + x); });
    if (adquirido) avisos.push('Em 13/11/2019 já havia **' + dur(ct.convEC) + '** de tempo, mais que o mínimo de ' + (sexo === 'F' ? 30 : 35) + ' anos: pode haver direito adquirido à regra anterior à EC 103, sem idade mínima e com fator previdenciário. Verifique também a data em que o mínimo foi atingido.');
    res.avisos = avisos;
    res.avaliacoes = avaliacoes;

    var oks = avaliacoes.filter(function (a) { return a.ok && a.aplicavel; });
    var previstas = avaliacoes.filter(function (a) { return !a.ok && a.quando && a.aplicavel; }).sort(function (x, y) { return x.quando.ord - y.quando.ord; });
    var perguntas = D.perguntasCarencia(carenciaMm.compl, carenciaMm.resp, !oks.length, carenciaMeses, ctx.carenciaExigida);
    var espInd = (ex.espIndenizar || []).filter(function (k, i, arr) { return arr.indexOf(k) === i; });
    if (espInd.length) {
      var respInd = entrada.indenizaEspecial;
      perguntas.unshift({ id: 'indenizaEspecial', texto: 'Há **' + espInd.length + '** mês(es) de segurado especial a partir de 11/1991 (' + I.faixas(espInd) + '). Na aposentadoria por tempo de contribuição esse tempo só conta com **indenização** (pagamento das contribuições do período). **O segurado vai indenizar?** Se sim, o período entra na contagem do tempo; o valor deve ser calculado pelo INSS.', resposta: respInd === undefined ? null : !!respInd });
      linhasTempo.push(respInd === true ? '**' + espInd.length + '** mês(es) de segurado especial a partir de 11/1991 foram incluídos **condicionados à indenização** (' + I.faixas(espInd) + '). Eles não contam como carência.' : '**' + espInd.length + '** mês(es) de segurado especial a partir de 11/1991 **não foram contados**, porque dependem de indenização (' + I.faixas(espInd) + ').');
    }
    res.perguntas = perguntas;
    var conc;
    if (filiadoAteEC === false) conc = { status: 'nao_demonstrado', rotulo: 'Regras de transição não se aplicam', texto: 'O primeiro vínculo é posterior a 13/11/2019.' };
    else if (oks.length) conc = { status: 'provavel', rotulo: 'Requisitos cumpridos em ' + oks.length + ' regra(s) pelos dados do CNIS', texto: 'Cumpridas: ' + oks.map(function (a) { return a.regra.nome; }).join('; ') + '. Confira os documentos, em especial os do tempo especial, antes de requerer.' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Requisitos ainda não demonstrados pelos dados do CNIS', texto: previstas.length ? 'Mantidas as contribuições, a primeira regra a ser cumprida seria ' + previstas[0].regra.nome + ', em ' + rot(previstas[0].quando) + '.' : 'Nenhuma regra é cumprida pelos dados atuais, nem nos próximos 20 anos com contribuição contínua.' };
    if (!oks.length && perguntas.length && perguntas.some(function (q) { return q.resposta === null; })) { conc.status = 'depende'; conc.rotulo = 'Depende da complementação das competências abaixo do mínimo'; }
    conc.pendencias = [];
    if (entrada.indenizaEspecial === true && espInd.length) conc.pendencias.push('Pagamento da indenização do período de segurado especial a partir de 11/1991.');
    if (ct.temEspecial) conc.pendencias.push('PPP, LTCAT e demais provas da exposição aos agentes nocivos nos períodos enquadrados como especiais.');
    if ((entrada.enquadramento || []).some(function (e) { return !e.seq; })) conc.pendencias.push('Provas dos períodos informados fora do CNIS.');
    res.conclusao = conc;
    res.documentos = ['Documento de identificação com a data de nascimento', 'CTPS e documentos dos vínculos sem remuneração ou sem data de fim', 'PPP e LTCAT dos períodos de atividade especial', 'Certidão de tempo de contribuição (CTC) de regime próprio, se houver', 'Guias e comprovantes de contribuição de contribuinte individual e facultativo'];
    return res;
  }

  // ---------- Aposentadoria especial (IN PRES/INSS 128, arts. 260 a 262) ----------
  var NORMAS_ESP = [
    { nome: 'EC 103/2019, arts. 19, § 1º, I, 21 e 25, § 2º', vigencia: 'Regra permanente (idade mínima de 55, 58 ou 60 anos, para 15, 20 ou 25 anos de exposição), regra de transição por pontos (66, 76 ou 86) e fim da conversão de tempo especial em comum depois de 13/11/2019.' },
    { nome: 'IN PRES/INSS 128/2022, arts. 260 a 262 (com alterações posteriores)', vigencia: 'Art. 260: filiados a partir de 14/11/2019. Art. 261: direito adquirido até 13/11/2019, sem idade mínima. Art. 262: filiados até 13/11/2019, por pontos. Confira o texto vigente.' },
    { nome: 'Lei 8.213/91, arts. 25, II, 57 e 58 e Decreto 3.048/99, arts. 64 a 70', vigencia: 'Carência de 180 contribuições; exposição habitual e permanente, não ocasional nem intermitente, a agentes nocivos; comprovação por PPP e LTCAT. Até 28/04/1995 o enquadramento pode ser por categoria profissional; depois, só por agente nocivo.' },
    { nome: 'IN PRES/INSS 128/2022, art. 233, V (cálculo)', vigencia: 'O valor segue o inciso V do art. 233 (art. 260) e a alínea "b" desse inciso (art. 262). O valor não é calculado nesta versão.' }
  ];
  var ESPECIAIS = [
    { n: 25, id: 'esp25', idade: 60, pontos: 86 },
    { n: 20, id: 'esp20', idade: 58, pontos: 76 },
    { n: 15, id: 'esp15', idade: 55, pontos: 66 }
  ];
  function aposentadoriaEspecial(analise, entrada, hoje) {
    var res = { beneficio: 'aposentadoria-especial', titulo: 'aposentadoria especial', normas: NORMAS_ESP, entrada: entrada, fato: { data: null } };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der);
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER).', pendencias: [] };
      return res;
    }
    res.fato.data = der;
    var dEC = C.dataDeOrd(EC);
    var ct = contar(analise, entrada, der);
    var ctEC = contar(analise, entrada, dEC);
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.valido && v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var manualPrimeira = (entrada.enquadramento || []).filter(function (e) { return e && e.inicio && !e.seq; }).reduce(function (m, e) { return !m || e.inicio.ord < m.ord ? e.inicio : m; }, null);
    if (manualPrimeira && (!primeira || manualPrimeira.ord < primeira.ord)) primeira = manualPrimeira;
    var filiadoAteEC = primeira ? primeira.ord <= EC : null;
    var usaTabela = !!(primeira && primeira.ord <= C.ordemDe(1991, 7, 24));
    var carDer = Object.keys(I.montarMeses(analise, entrada, der, { modalidade: 'urbana' }).contados).length;
    var carEC = Object.keys(I.montarMeses(analise, entrada, dEC, { modalidade: 'urbana' }).contados).length;
    var exDer = I.carenciaExigida(der.y, usaTabela), exEC = I.carenciaExigida(2019, usaTabela);

    function reqsDe(regra, esp, d, tempo, car) {
      var out = [];
      function r(nome, ok, atual, exigido) { out.push({ nome: nome, ok: ok, atual: atual, exigido: exigido }); }
      var im = ageMeses(nasc, d);
      if (regra === 'adquirido') {
        r('Tempo de atividade especial de ' + esp.n + ' anos até 13/11/2019', tempo >= esp.n * 365, dur(tempo), esp.n + ' anos');
        r('Carência em 13/11/2019', car >= exEC, car + ' meses', exEC + ' meses');
        return out;
      }
      r('Tempo de exposição efetiva (atividade especial de ' + esp.n + ' anos)', tempo >= esp.n * 365, dur(tempo), esp.n + ' anos');
      if (regra === 'idade') r('Idade mínima', im >= esp.idade * 12, textoMeses(Math.max(0, im)), esp.idade + ' anos');
      else { var pts = (d.ord - nasc.ord) / 365.25 + tempo / 365; r('Pontos (idade + tempo de exposição, em dias)', pts >= esp.pontos, pts.toFixed(2).replace('.', ','), esp.pontos + ' pontos'); }
      r('Carência', car >= exDer, car + ' meses', exDer + ' meses');
      return out;
    }
    var REG = [
      { id: 'idade', nome: 'Regra permanente: idade mínima', norma: 'IN 128, art. 260, e EC 103, art. 19, § 1º, I', desc: 'Para filiados a partir de 14/11/2019: idade mínima de 55, 58 ou 60 anos e 15, 20 ou 25 anos de exposição, conforme o agente.', aplicavel: filiadoAteEC !== true },
      { id: 'adquirido', nome: 'Direito adquirido até 13/11/2019', norma: 'IN 128, art. 261', desc: 'Carência e 15, 20 ou 25 anos de atividade especial já cumpridos em 13/11/2019, sem idade mínima. O benefício pode ser requerido depois.', aplicavel: filiadoAteEC !== false },
      { id: 'pontos', nome: 'Regra de transição por pontos', norma: 'IN 128, art. 262, e EC 103, art. 21', desc: 'Para filiados até 13/11/2019: soma de idade e tempo de exposição de 66, 76 ou 86 pontos, com 15, 20 ou 25 anos de exposição efetiva. Idade e tempo são apurados em dias.', aplicavel: filiadoAteEC !== false }
    ];
    var blocos = [];
    ESPECIAIS.forEach(function (esp) {
      var tempo = ct.tot[esp.id], tempoEC = ctEC.tot[esp.id];
      if (!tempo && !tempoEC) return;
      var regras = REG.map(function (rg) {
        var reqs = rg.id === 'adquirido' ? reqsDe(rg.id, esp, dEC, tempoEC, carEC) : reqsDe(rg.id, esp, der, tempo, carDer);
        var ok = reqs.every(function (x) { return x.ok; });
        var quando = null;
        if (!ok && rg.aplicavel && rg.id !== 'adquirido') {
          for (var dd = 1; dd <= 365 * 25; dd++) {
            var dt = C.dataDeOrd(der.ord + dd);
            var rr = reqsDe(rg.id, esp, dt, tempo + dd, carDer + Math.floor(dd / 30));
            if (rr.every(function (x) { return x.ok; })) { quando = dt; break; }
          }
        }
        return { regra: rg, reqs: reqs, ok: ok, aplicavel: rg.aplicavel, quando: quando };
      });
      blocos.push({ esp: esp, tempo: tempo, tempoEC: tempoEC, regras: regras });
    });
    res.blocos = blocos;
    res.tabela = ct;
    var linhasTempo = [];
    linhasTempo.push('Tempo total contado pelo CNIS e pelo enquadramento: **' + dur(ct.brutoDer) + '** até a DER (' + rot(der) + '); destes, em atividade especial: **' + dur(ct.tot.esp25 + ct.tot.esp20 + ct.tot.esp15) + '**.');
    linhasTempo.push('Na aposentadoria especial conta só o tempo de **exposição efetiva** a agentes nocivos, **sem conversão** em tempo comum. Cada natureza (15, 20 ou 25 anos) é avaliada separadamente: o tempo de uma natureza não completa o de outra.');
    linhasTempo.push('Pelos dados do CNIS não dá para saber a atividade especial: só entra o que você enquadrar acima. Até 28/04/1995 o enquadramento pode ser pela categoria profissional; depois só pela exposição comprovada a agente nocivo.');
    var ex = ct.mm.ex;
    if (ex.abaixoEmp.length) linhasTempo.push(ex.abaixoEmp.length + ' mês(es) de empregado abaixo do salário mínimo não foram contados (' + I.faixas(ex.abaixoEmp) + ').');
    if (ex.aposFG.length) linhasTempo.push(ex.aposFG.length + ' competência(s) paga(s) depois da DER não contam (' + I.faixas(ex.aposFG) + ').');
    res.tempo = { linhas: linhasTempo };
    res.carencia = { total: carDer, exigida: exDer, ok: carDer >= exDer, linhas: ['Carência no CNIS até a DER: **' + carDer + ' meses**. Exigidos: **' + exDer + '**. Em 13/11/2019: **' + carEC + ' meses**.'] };
    var avisos = [];
    (ct.ajustes || []).forEach(function (x) { avisos.push('Enquadramento: ' + x); });
    if (filiadoAteEC === true) avisos.push('O primeiro vínculo é anterior a 14/11/2019: a regra permanente de idade mínima (art. 260) não se aplica. Valem o direito adquirido (art. 261) e a regra de pontos (art. 262).');
    if (filiadoAteEC === false) avisos.push('O primeiro vínculo é posterior a 13/11/2019: só vale a regra permanente de idade mínima (art. 260).');
    if (!blocos.length) avisos.push('Nenhum período foi enquadrado como especial. Marque no enquadramento os períodos de exposição a agentes nocivos e a natureza (15, 20 ou 25 anos).');
    res.avisos = avisos;
    var oks = [];
    blocos.forEach(function (b) { b.regras.forEach(function (a) { if (a.ok && a.aplicavel) oks.push(a.regra.nome + ' (' + b.esp.n + ' anos)'); }); });
    var prev = [];
    blocos.forEach(function (b) { b.regras.forEach(function (a) { if (!a.ok && a.aplicavel && a.quando) prev.push({ nome: a.regra.nome + ' (' + b.esp.n + ' anos)', quando: a.quando }); }); });
    prev.sort(function (x, y) { return x.quando.ord - y.quando.ord; });
    var conc;
    if (!blocos.length) conc = { status: 'nao_demonstrado', rotulo: 'Sem período especial enquadrado', texto: 'Nenhum período foi enquadrado como atividade especial. Sem isso não há como avaliar a aposentadoria especial.' };
    else if (oks.length) conc = { status: 'provavel', rotulo: 'Requisitos cumpridos em ' + oks.length + ' hipótese(s) pelos dados informados', texto: 'Cumpridas: ' + oks.join('; ') + '. A exposição aos agentes nocivos precisa ser comprovada (PPP e LTCAT) e reconhecida pelo INSS.' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Requisitos ainda não demonstrados', texto: prev.length ? 'Mantida a mesma atividade especial a partir da DER, a primeira hipótese a ser cumprida seria ' + prev[0].nome + ', em ' + rot(prev[0].quando) + '.' : 'Nenhuma hipótese é cumprida pelos dados atuais, nem nos próximos 25 anos mantida a atividade.' };
    conc.pendencias = ['PPP, LTCAT e demais provas da exposição habitual e permanente aos agentes nocivos em cada período enquadrado.'];
    if ((entrada.enquadramento || []).some(function (e) { return !e.seq; })) conc.pendencias.push('Provas dos períodos informados fora do CNIS.');
    res.conclusao = conc;
    res.valor = { linhas: [
      'Não calculado nesta versão: exige a correção monetária das remunerações desde 07/1994, que o CNIS não traz.',
      'Direito adquirido até 13/11/2019 (art. 261): em regra **100% do salário de benefício** (Lei 8.213/91, art. 57, § 1º), sem fator previdenciário. Art. 260: cálculo do inciso V do art. 233 da IN 128. Art. 262: alínea "b" do mesmo inciso. Confira o texto vigente.'
    ] };
    res.documentos = ['Documento de identificação com a data de nascimento', 'PPP (perfil profissiográfico previdenciário) de cada período especial', 'LTCAT ou laudo técnico, quando exigido', 'CTPS e documentos dos vínculos sem remuneração ou sem data de fim', 'Prova da categoria profissional, para períodos até 28/04/1995 enquadrados por categoria'];
    return res;
  }
  function renderizarEspecial(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. O CNIS não informa atividade especial: o tempo especial só entra se você o enquadrar acima.'));
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias)); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    if (r.avisos && r.avisos.length) topo.appendChild(lista(r.avisos));
    var s1 = C.sec('1. Tempo de atividade especial');
    s1.appendChild(lista(r.tempo.linhas));
    var t = r.tabela;
    s1.appendChild(C.tabela(['Natureza', 'Até 13/11/2019', 'Total até a DER'], [
      ['Comum', dur(t.ate.comum), dur(t.tot.comum)],
      ['Especial de 25 anos', dur(t.ate.esp25), dur(t.tot.esp25)],
      ['Especial de 20 anos', dur(t.ate.esp20), dur(t.tot.esp20)],
      ['Especial de 15 anos', dur(t.ate.esp15), dur(t.tot.esp15)]
    ]));
    topo.appendChild(s1);
    var s2 = C.sec('2. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.ok ? 'confirmada' : 'nao_demonstrada'), r.carencia.ok ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS'));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas));
    topo.appendChild(s2);
    var s3 = C.sec('3. Hipóteses de aposentadoria especial');
    if (!r.blocos.length) s3.appendChild(C.el('p', null, 'Nenhuma natureza especial enquadrada.'));
    r.blocos.forEach(function (b) {
      s3.appendChild(C.el('h4', null, 'Atividade especial de ' + b.esp.n + ' anos'));
      b.regras.forEach(function (a) {
        var bloco = C.el('div', 'regra-tc');
        bloco.appendChild(C.el('h4', null, a.regra.nome + ' (' + a.regra.norma + ')'));
        var sel = C.el('p', 'selo-linha');
        sel.appendChild(C.el('span', 'selo selo-' + (a.ok && a.aplicavel ? 'confirmada' : 'nao_demonstrada'), a.ok && a.aplicavel ? 'Cumprida' : (a.aplicavel ? 'Não cumprida' : 'Não se aplica')));
        bloco.appendChild(sel);
        bloco.appendChild(C.el('p', 'dica', a.regra.desc));
        bloco.appendChild(C.tabela(['Requisito', 'Situação', 'Atual', 'Exigido'], a.reqs.map(function (x) { return [x.nome, x.ok ? 'Cumprido' : 'Não cumprido', x.atual, x.exigido]; })));
        if (!a.ok && a.quando && a.aplicavel) bloco.appendChild(C.el('p', null, 'Mantida a mesma atividade especial a partir da DER, esta hipótese seria cumprida em ' + rot(a.quando) + '.'));
        s3.appendChild(bloco);
      });
    });
    topo.appendChild(s3);
    var s4 = C.sec('4. Valor'); s4.appendChild(lista(r.valor.linhas)); topo.appendChild(s4);
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }

  // ---------- Aposentadoria do professor (IN PRES/INSS 128, arts. 250 a 254) ----------
  var NORMAS_PROF = [
    { nome: 'EC 103/2019, arts. 19, § 1º, II, 15, § 3º, 16, parágrafo único e 20, § 1º; Constituição, art. 201, § 8º', vigencia: 'Professor da educação infantil, do ensino fundamental e do ensino médio, com tempo exclusivamente de efetivo exercício de magistério. Confira o texto compilado.' },
    { nome: 'IN PRES/INSS 128/2022, arts. 250 a 254 (com alterações posteriores)', vigencia: 'Art. 250: filiados a partir de 14/11/2019. Art. 251: direito adquirido até 13/11/2019. Arts. 252 a 254: regras de transição (pontos, idade progressiva e pedágio de 100%). Confira o texto vigente.' },
    { nome: 'Lei 8.213/91, art. 25, II', vigencia: 'Carência de 180 contribuições (tabela do art. 142 para quem se filiou até 24/07/1991).' },
    { nome: 'IN PRES/INSS 128/2022, art. 233, IV e VI (cálculo)', vigencia: 'O valor segue o inciso VI (art. 250), a alínea "a" do inciso IV (art. 251), a alínea "c" (arts. 252 e 253) e a alínea "e" (art. 254). O valor não é calculado nesta versão.' }
  ];
  // Sugestão automática de vínculos de magistério pelo nome do empregador (educação básica).
  var RX_PROF = /col[eé]gio|escola|munic[ií]pio|prefeitura|\bestado\b|secretaria|educa[cç]|ensino|creche|\bcei\b|\bemei\b|\bemef\b|\bseduc\b|instituto de educa|funda[cç][aã]o educ|cooperativa educ/i;
  function sugereProfessor(v) { return !!(v && v.valido && RX_PROF.test(v.nome || '')) && !/facultativ|individual|especial/i.test(v.tipo || ''); }

  function ptsProf(sexo, ano) { return sexo === 'F' ? Math.min(92, 81 + Math.max(0, ano - 2019)) : Math.min(100, 91 + Math.max(0, ano - 2019)); }
  function idadeProf(sexo, ano) { var base = sexo === 'F' ? 51 * 12 : 56 * 12, teto = sexo === 'F' ? 57 * 12 : 60 * 12; return Math.min(teto, base + 6 * Math.max(0, ano - 2019)); }

  function aposentadoriaProfessor(analise, entrada, hoje) {
    var res = { beneficio: 'aposentadoria-professor', titulo: 'aposentadoria do professor', normas: NORMAS_PROF, entrada: entrada, fato: { data: null } };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der), sexo = entrada.sexo === 'M' ? 'M' : 'F';
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER).', pendencias: [] };
      return res;
    }
    res.fato.data = der;
    var sel = (entrada.professor || []).map(Number);
    var dEC = C.dataDeOrd(EC);
    var apenas = Object.assign({}, analise, { vinculos: analise.vinculos.filter(function (v) { return sel.indexOf(+v.seq) >= 0; }) });
    var ent0 = { sexo: sexo, enquadramento: [], indenizaEspecial: false };
    var ct = contar(apenas, ent0, der), ctEC = contar(apenas, ent0, dEC);
    var tDer = ct.brutoDer, tEC = ctEC.brutoDer;
    var tAte98 = (function () { var c98 = contar(apenas, ent0, C.dataDe('16/12/1998')); return c98.brutoDer; })();
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.valido && v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var filiadoAteEC = primeira ? primeira.ord <= EC : null;
    var usaTabela = !!(primeira && primeira.ord <= C.ordemDe(1991, 7, 24));
    var carDer = Object.keys(I.montarMeses(analise, { sexo: sexo, enquadramento: [] }, der, { modalidade: 'urbana' }).contados).length;
    var carEC = Object.keys(I.montarMeses(analise, { sexo: sexo, enquadramento: [] }, dEC, { modalidade: 'urbana' }).contados).length;
    var exDer = I.carenciaExigida(der.y, usaTabela), exEC = I.carenciaExigida(2019, usaTabela);
    var req = (sexo === 'F' ? 25 : 30) * 365;
    var ap = sexo === 'F' ? 'mulher' : 'homem';

    function reqs(id, d, tempo, car, tEc) {
      var out = [], im = ageMeses(nasc, d);
      function r(nome, ok, atual, exigido) { out.push({ nome: nome, ok: ok, atual: atual, exigido: exigido }); }
      if (id === 'adquirido') {
        r('Tempo de magistério até 13/11/2019', tEc >= req, dur(tEc), (sexo === 'F' ? 25 : 30) + ' anos');
        r('Carência em 13/11/2019', carEC >= exEC, carEC + ' meses', exEC + ' meses');
        return out;
      }
      if (id === 'adquirido98') {
        var comAcr = tAte98 * (sexo === 'F' ? 1.2 : 1.17) + Math.max(0, tEc - tAte98), ex35 = (sexo === 'F' ? 30 : 35) * 365;
        r('Tempo de magistério até 13/11/2019, com acréscimo sobre o período até 16/12/1998 (' + (sexo === 'F' ? '20%' : '17%') + ')', comAcr >= ex35, dur(comAcr), (sexo === 'F' ? 30 : 35) + ' anos');
        r('Carência em 13/11/2019', carEC >= exEC, carEC + ' meses', exEC + ' meses');
        return out;
      }
      r('Tempo de magistério (exclusivamente)', tempo >= req, dur(tempo), (sexo === 'F' ? 25 : 30) + ' anos');
      if (id === 'permanente') r('Idade mínima', im >= (sexo === 'F' ? 57 : 60) * 12, textoMeses(Math.max(0, im)), (sexo === 'F' ? 57 : 60) + ' anos');
      else if (id === 'pontos') { var pts = (d.ord - nasc.ord) / 365.25 + tempo / 365; r('Pontos (idade + tempo de magistério, em dias)', pts >= ptsProf(sexo, d.y), pts.toFixed(2).replace('.', ','), ptsProf(sexo, d.y) + ' pontos em ' + d.y); }
      else if (id === 'idade') { var mi = idadeProf(sexo, d.y); r('Idade mínima progressiva', im >= mi, textoMeses(Math.max(0, im)), textoMeses(mi) + ' em ' + d.y); }
      else if (id === 'pedagio') {
        var falta = Math.max(0, req - tEc), exig = req + falta;
        out[0] = { nome: 'Tempo de magistério com pedágio de 100%', ok: tempo >= exig, atual: dur(tempo), exigido: dur(exig) + (falta ? ' (pedágio de ' + dur(falta) + ')' : ' (pedágio zero: já tinha o tempo mínimo em 13/11/2019)') };
        r('Idade mínima', im >= (sexo === 'F' ? 52 : 55) * 12, textoMeses(Math.max(0, im)), (sexo === 'F' ? 52 : 55) + ' anos');
      }
      r('Carência', car >= exDer, car + ' meses', exDer + ' meses');
      return out;
    }
    var REG = [
      { id: 'permanente', nome: 'Regra permanente (aposentadoria programada do professor)', norma: 'IN 128, art. 250', desc: 'Para filiados a partir de 14/11/2019: 57 anos (mulher) ou 60 (homem) e 25 anos de contribuição exclusivamente em magistério.', aplicavel: filiadoAteEC !== true },
      { id: 'adquirido', nome: 'Direito adquirido até 13/11/2019', norma: 'IN 128, art. 251', desc: '25 anos (mulher) ou 30 (homem) de magistério e carência cumpridos em 13/11/2019, sem idade mínima. Pode ser requerido depois.', aplicavel: filiadoAteEC !== false },
      { id: 'adquirido98', nome: 'Direito adquirido, com acréscimo do tempo até 16/12/1998', norma: 'IN 128, art. 251, § 1º', desc: 'Para quem não tinha as condições em 16/12/1998: o magistério até essa data ganha 17% (homem) ou 20% (mulher), e exige 35 anos (homem) ou 30 (mulher) exclusivamente de magistério até 13/11/2019.', aplicavel: filiadoAteEC !== false },
      { id: 'pontos', nome: 'Transição por pontos', norma: 'IN 128, art. 252', desc: '25/30 anos de magistério e 81 pontos (mulher) ou 91 (homem), com 1 ponto a mais a cada ano desde 2020, até 92 e 100. Idade e tempo em dias.', aplicavel: filiadoAteEC !== false },
      { id: 'idade', nome: 'Transição por idade progressiva', norma: 'IN 128, art. 253', desc: '25/30 anos de magistério e idade de 51 (mulher) ou 56 (homem), com 6 meses a mais por ano desde 2020, até 57 e 60.', aplicavel: filiadoAteEC !== false },
      { id: 'pedagio', nome: 'Transição com pedágio de 100%', norma: 'IN 128, art. 254', desc: 'Idade de 52 (mulher) ou 55 (homem), 25/30 anos de magistério e período adicional de 100% do que faltava em 13/11/2019.', aplicavel: filiadoAteEC !== false }
    ];
    res.avaliacoes = REG.map(function (rg) {
      var rs = (rg.id === 'adquirido' || rg.id === 'adquirido98') ? reqs(rg.id, dEC, 0, 0, tEC) : reqs(rg.id, der, tDer, carDer, tEC);
      var ok = rs.every(function (x) { return x.ok; });
      var quando = null;
      if (!ok && rg.aplicavel && rg.id !== 'adquirido' && rg.id !== 'adquirido98' && tDer > 0) {
        for (var dd = 1; dd <= 365 * 25; dd++) {
          var dt = C.dataDeOrd(der.ord + dd);
          if (reqs(rg.id, dt, tDer + dd, carDer + Math.floor(dd / 30), tEC).every(function (x) { return x.ok; })) { quando = dt; break; }
        }
      }
      return { regra: rg, reqs: rs, ok: ok, aplicavel: rg.aplicavel, quando: quando };
    });
    var linhas = [];
    var nomes = apenas.vinculos.map(function (v) { return v.nome; });
    linhas.push('Vínculos marcados como magistério: **' + apenas.vinculos.length + '**' + (nomes.length ? ' (' + nomes.slice(0, 6).join('; ') + (nomes.length > 6 ? '; ...' : '') + ')' : '') + '.');
    linhas.push('Tempo de magistério contado, sem contar duas vezes o que é concomitante: **' + dur(tDer) + '** até a DER (' + rot(der) + ') e **' + dur(tEC) + '** até 13/11/2019. Tempo total de contribuição em todos os vínculos: ' + dur(contar(analise, ent0, der).brutoDer) + '.');
    linhas.push('Só conta o tempo de **efetivo exercício de magistério na educação infantil, no ensino fundamental e no ensino médio** (inclui direção, coordenação e assessoramento pedagógico na escola básica). Não há conversão de tempo especial, e universidade, ensino superior e outras funções ficam de fora.');
    if (!apenas.vinculos.length) linhas.push('Nenhum vínculo foi marcado como magistério. Marque acima os vínculos de professor.');
    var ex = ct.mm.ex;
    if (ex.abaixoEmp.length) linhas.push(ex.abaixoEmp.length + ' mês(es) de empregado abaixo do salário mínimo não foram contados (' + I.faixas(ex.abaixoEmp) + ').');
    if (ex.aposFG.length) linhas.push(ex.aposFG.length + ' competência(s) paga(s) depois da DER não contam (' + I.faixas(ex.aposFG) + ').');
    res.tempo = { linhas: linhas, tDer: tDer, tEC: tEC };
    res.carencia = { total: carDer, exigida: exDer, ok: carDer >= exDer, linhas: ['Carência no CNIS até a DER (todos os vínculos): **' + carDer + ' meses**. Exigidos: **' + exDer + '**. Em 13/11/2019: **' + carEC + ' meses**.'] };
    var avisos = [];
    if (filiadoAteEC === true) avisos.push('O primeiro vínculo é anterior a 14/11/2019: a regra permanente do art. 250 não se aplica. Valem o direito adquirido e as regras de transição.');
    if (filiadoAteEC === false) avisos.push('O primeiro vínculo é posterior a 13/11/2019: só vale a regra permanente do art. 250.');
    res.avisos = avisos;
    var oks = res.avaliacoes.filter(function (a) { return a.ok && a.aplicavel; });
    var prev = res.avaliacoes.filter(function (a) { return !a.ok && a.aplicavel && a.quando; }).sort(function (x, y) { return x.quando.ord - y.quando.ord; });
    var conc;
    if (!apenas.vinculos.length) conc = { status: 'incompleta', rotulo: 'Marque os vínculos de magistério', texto: 'Indique quais vínculos são de professor para avaliar a aposentadoria.' };
    else if (oks.length) conc = { status: 'provavel', rotulo: 'Requisitos cumpridos em ' + oks.length + ' regra(s) pelos dados informados', texto: 'Cumpridas: ' + oks.map(function (a) { return a.regra.nome; }).join('; ') + '. Confirme o efetivo exercício de magistério na educação básica.' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Requisitos ainda não demonstrados', texto: prev.length ? 'Mantido o magistério a partir da DER, a primeira regra a ser cumprida seria ' + prev[0].regra.nome + ', em ' + rot(prev[0].quando) + '.' : 'Nenhuma regra é cumprida pelos dados atuais, nem nos próximos 25 anos mantido o magistério.' };
    conc.pendencias = ['Declaração da escola e da rede de ensino com a função de magistério, o nível de ensino (educação básica) e o período de cada vínculo.'];
    res.conclusao = conc;
    res.valor = { linhas: ['Não calculado nesta versão: exige a correção monetária das remunerações desde 07/1994, que o CNIS não traz.', 'Art. 250: inciso VI do art. 233. Art. 251: alínea "a" do inciso IV. Arts. 252 e 253: alínea "c". Art. 254: alínea "e". Confira o texto vigente.'] };
    res.documentos = ['Documento de identificação com a data de nascimento', 'CTPS e contratos dos vínculos de magistério', 'Declaração da escola ou da rede (função de professor, nível de ensino e períodos)', 'Atos de nomeação, para servidores com CTC, quando houver', 'Certidão de tempo de contribuição (CTC) de regime próprio, se houver'];
    return res;
  }
  function renderizarProfessor(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. O CNIS não informa a função: só entram os vínculos que você marcou como de professor.'));
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias)); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    if (r.avisos && r.avisos.length) topo.appendChild(lista(r.avisos));
    var s1 = C.sec('1. Tempo de magistério'); s1.appendChild(lista(r.tempo.linhas)); topo.appendChild(s1);
    var s2 = C.sec('2. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.ok ? 'confirmada' : 'nao_demonstrada'), r.carencia.ok ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS'));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas)); topo.appendChild(s2);
    var s3 = C.sec('3. Regras');
    r.avaliacoes.forEach(function (a) {
      var bloco = C.el('div', 'regra-tc');
      bloco.appendChild(C.el('h4', null, a.regra.nome + ' (' + a.regra.norma + ')'));
      var sel = C.el('p', 'selo-linha');
      sel.appendChild(C.el('span', 'selo selo-' + (a.ok && a.aplicavel ? 'confirmada' : 'nao_demonstrada'), a.ok && a.aplicavel ? 'Cumprida' : (a.aplicavel ? 'Não cumprida' : 'Não se aplica')));
      bloco.appendChild(sel);
      bloco.appendChild(C.el('p', 'dica', a.regra.desc));
      bloco.appendChild(C.tabela(['Requisito', 'Situação', 'Atual', 'Exigido'], a.reqs.map(function (x) { return [x.nome, x.ok ? 'Cumprido' : 'Não cumprido', x.atual, x.exigido]; })));
      if (!a.ok && a.quando && a.aplicavel) bloco.appendChild(C.el('p', null, 'Mantido o magistério a partir da DER, esta regra seria cumprida em ' + rot(a.quando) + '.'));
      s3.appendChild(bloco);
    });
    topo.appendChild(s3);
    var s4 = C.sec('4. Valor'); s4.appendChild(lista(r.valor.linhas)); topo.appendChild(s4);
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }
  // Seletor dos vínculos de magistério. `sel` é a lista de seq marcados; novos vínculos que casam com o filtro entram marcados.
  function editorProfessor(analise, sel, aoMudar) {
    var box = C.el('div', 'enquadramento');
    var vistos = {};
    box.appendChild(C.el('h4', null, 'Vínculos de professor (educação básica)'));
    box.appendChild(C.el('p', 'dica', 'Marque os vínculos em que o segurado foi professor da educação infantil, do ensino fundamental ou do ensino médio. Os que têm no nome colégio, escola, município, prefeitura, estado, secretaria ou educação já vêm marcados: confira e desmarque o que não for magistério.'));
    var barra = C.el('div', 'acoes');
    var bSug = C.el('button', 'btn btn-leve', 'Marcar sugeridos'); bSug.type = 'button';
    var bTodos = C.el('button', 'btn btn-leve', 'Marcar todos'); bTodos.type = 'button';
    var bNenhum = C.el('button', 'btn btn-leve', 'Limpar'); bNenhum.type = 'button';
    barra.appendChild(bSug); barra.appendChild(bTodos); barra.appendChild(bNenhum); box.appendChild(barra);
    var lst = C.el('div', 'lista-prof'); box.appendChild(lst);
    var atual = analise;
    function desenhar() {
      lst.textContent = '';
      var vs = atual.vinculos.filter(function (v) { return v.valido && !/facultativ|individual|especial/i.test(v.tipo || ''); });
      if (!vs.length) lst.appendChild(C.el('p', 'dica', 'Nenhum vínculo de empregado encontrado.'));
      vs.forEach(function (v) {
        var l = C.el('label'); l.style.display = 'block';
        var i = document.createElement('input'); i.type = 'checkbox'; i.checked = sel.indexOf(+v.seq) >= 0; i.setAttribute('data-seq', v.seq);
        i.addEventListener('change', function () {
          var k = sel.indexOf(+v.seq);
          if (i.checked && k < 0) sel.push(+v.seq); if (!i.checked && k >= 0) sel.splice(k, 1);
          if (aoMudar) aoMudar();
        });
        l.appendChild(i);
        l.appendChild(document.createTextNode(' ' + (v.rotulo || ('Seq. ' + v.seq + ' - ' + v.nome)) + (v.inicio ? ' (' + rot(v.inicio) + ' a ' + (v.fim ? rot(v.fim) : 'em aberto') + ')' : '')));
        lst.appendChild(l);
      });
    }
    function sugere(novos) {
      atual.vinculos.forEach(function (v) {
        if (novos && vistos[v.seq]) return;
        vistos[v.seq] = true;
        if (sugereProfessor(v) && sel.indexOf(+v.seq) < 0) sel.push(+v.seq);
      });
    }
    box.atualizar = function (a) { atual = a; sugere(true); desenhar(); };
    bSug.addEventListener('click', function () { sugere(false); desenhar(); if (aoMudar) aoMudar(); });
    bTodos.addEventListener('click', function () { atual.vinculos.forEach(function (v) { if (v.valido && sel.indexOf(+v.seq) < 0) sel.push(+v.seq); }); desenhar(); if (aoMudar) aoMudar(); });
    bNenhum.addEventListener('click', function () { sel.length = 0; desenhar(); if (aoMudar) aoMudar(); });
    sugere(true); desenhar();
    return box;
  }

  // ---------- Aposentadoria da pessoa com deficiência (LC 142/2013; IN PRES/INSS 128, arts. 303 a 315) ----------
  var NORMAS_PCD = [
    { nome: 'Lei Complementar 142/2013, arts. 3º a 9º, e Decreto 3.048/99, arts. 70-A a 70-I', vigencia: 'Aposentadoria por tempo de contribuição (20/24/28 anos mulher, 25/29/33 homem, conforme o grau grave, moderado ou leve) e por idade (55/60 anos e 15 anos de contribuição como pessoa com deficiência). Confira o texto compilado.' },
    { nome: 'IN PRES/INSS 128/2022, arts. 303 a 315 (com alterações posteriores)', vigencia: 'Avaliação médica e do serviço social, graus de deficiência, conversão entre graus e entre tempo com e sem deficiência (art. 309, Anexo XVIII), carência de 180 contribuições sem exigir concomitância com a deficiência.' },
    { nome: 'IN PRES/INSS 128/2022, art. 233, VIII e IX (cálculo)', vigencia: 'O valor segue o inciso VIII (tempo de contribuição) e o inciso IX (idade). O valor não é calculado nesta versão.' },
    { nome: 'Tabela de conversão (Anexo XVIII da IN 128, Decreto 3.048/99, art. 70-E)', vigencia: 'Fatores usados citados de memória do texto do decreto: confira o anexo vigente.' }
  ];
  // Fatores de conversão entre graus (e tempo sem deficiência): [de][para]
  var CONV_PCD = {
    F: { grave: { moderada: 1.20, leve: 1.40, sem: 1.50 }, moderada: { grave: 0.83, leve: 1.17, sem: 1.25 }, leve: { grave: 0.71, moderada: 0.86, sem: 1.07 }, sem: { grave: 0.67, moderada: 0.80, leve: 0.93 } },
    M: { grave: { moderada: 1.16, leve: 1.32, sem: 1.40 }, moderada: { grave: 0.86, leve: 1.14, sem: 1.21 }, leve: { grave: 0.76, moderada: 0.88, sem: 1.06 }, sem: { grave: 0.71, moderada: 0.83, leve: 0.94 } }
  };
  var ESCALA_PCD = { F: { grave: 20, moderada: 24, leve: 28 }, M: { grave: 25, moderada: 29, leve: 33 } };
  var GRAUS_PCD = [['grave', 'Grave'], ['moderada', 'Moderada'], ['leve', 'Leve']];

  // Tempo contribuído por grau, por dia e sem repetir o concomitante: usa a contagem por dia, marcando o período da deficiência como "especial 25" interno.
  function tempoPcd(analise, entrada, der, sexo) {
    var base = contar(analise, { sexo: sexo, enquadramento: [] }, der);
    var seqs = analise.vinculos.filter(function (v) { return v.valido; }).map(function (v) { return v.seq; })
      .concat((analise.beneficios || []).map(function (b) { return b.seq; })).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var out = { sem: 0, leve: 0, moderada: 0, grave: 0 }, total = base.brutoDer;
    GRAUS_PCD.forEach(function (g) {
      var enq = [];
      (entrada.pcd || []).forEach(function (pp) {
        if (pp.grau !== g[0] || !pp.inicio) return;
        var fim = pp.fim && pp.fim.ord < der.ord ? pp.fim : der;
        if (fim.ord < pp.inicio.ord) return;
        seqs.forEach(function (sq) { enq.push({ seq: sq, inicio: pp.inicio, fim: fim, natureza: 'esp25', livre: true }); });
      });
      out[g[0]] = enq.length ? contar(analise, { sexo: sexo, enquadramento: enq }, der).tot.esp25 : 0;
    });
    out.sem = Math.max(0, total - out.leve - out.moderada - out.grave);
    out.total = total; out.mm = base.mm;
    return out;
  }
  // Avalia o tempo de contribuição: grau preponderante e conversão (art. 309).
  function avaliaPcdTempo(t, sexo) {
    var graus = GRAUS_PCD.map(function (g) { return g[0]; }).filter(function (g) { return t[g] > 0; });
    if (!graus.length) return null;
    var P = graus.reduce(function (m, g) { return t[g] > t[m] ? g : m; }, graus[0]);
    var temSem = t.sem > 0, alterna = graus.length > 1 || temSem;
    var f = CONV_PCD[sexo], soma = 0, linhas = [];
    ['sem', 'leve', 'moderada', 'grave'].forEach(function (g) {
      if (!t[g]) return;
      var fator = g === P ? 1 : (alterna ? f[g][P] : 1);
      soma += t[g] * fator;
      linhas.push([g, t[g], fator]);
    });
    return { preponderante: P, alterna: alterna, convertido: soma, exigido: ESCALA_PCD[sexo][P] * 365, linhas: linhas };
  }
  function nomeGrau(g) { return g === 'sem' ? 'Sem deficiência' : g === 'grave' ? 'Deficiência grave' : g === 'moderada' ? 'Deficiência moderada' : 'Deficiência leve'; }

  function aposentadoriaPcd(analise, entrada, hoje, modo) {
    var ehIdade = modo === 'idade';
    var res = { beneficio: ehIdade ? 'aposentadoria-pcd-idade' : 'aposentadoria-pcd-tempo', titulo: 'aposentadoria da pessoa com deficiência por ' + (ehIdade ? 'idade' : 'tempo de contribuição'), normas: NORMAS_PCD, entrada: entrada, fato: { data: null } };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der), sexo = entrada.sexo === 'M' ? 'M' : 'F';
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER).', pendencias: [] };
      return res;
    }
    res.fato.data = der;
    var pcd = (entrada.pcd || []).filter(function (x) { return x && x.inicio && x.grau; });
    var t = tempoPcd(analise, { pcd: pcd }, der, sexo);
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.valido && v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var usaTabela = !!(primeira && primeira.ord <= C.ordemDe(1991, 7, 24));
    var carDer = Object.keys(I.montarMeses(analise, { sexo: sexo, enquadramento: [] }, der, { modalidade: 'urbana' }).contados).length;
    var exDer = I.carenciaExigida(der.y, usaTabela);
    var tPcdTotal = t.leve + t.moderada + t.grave;
    var condDer = pcd.some(function (x) { return x.inicio.ord <= der.ord && (!x.fim || x.fim.ord >= der.ord); });
    var ultimo = pcd.filter(function (x) { return x.inicio.ord <= der.ord && (!x.fim || x.fim.ord >= der.ord); })[0];
    var linhas = [];
    linhas.push('Tempo de contribuição total contado pelo CNIS, sem repetir o concomitante: **' + dur(t.total) + '** até a DER (' + rot(der) + ').');
    ['grave', 'moderada', 'leve', 'sem'].forEach(function (g) { if (t[g]) linhas.push(nomeGrau(g) + ': **' + dur(t[g]) + '**.'); });
    linhas.push('Conta como tempo de pessoa com deficiência só o contribuído **depois do início do impedimento** fixado pela perícia, no grau informado. A carência de 180 contribuições não exige que tenha sido cumprida com a deficiência.');
    var ex = t.mm.ex;
    if (ex.abaixoEmp.length) linhas.push(ex.abaixoEmp.length + ' mês(es) de empregado abaixo do salário mínimo não foram contados (' + I.faixas(ex.abaixoEmp) + ').');
    if (ex.aposFG.length) linhas.push(ex.aposFG.length + ' competência(s) paga(s) depois da DER não contam (' + I.faixas(ex.aposFG) + ').');
    linhas.push('A conversão do tempo especial (Anexo XIX) em tempo de pessoa com deficiência, quando mais favorável, **não foi aplicada** nesta versão. Ela não acumula com a redução da deficiência no mesmo período (art. 310).');
    res.tempo = { linhas: linhas, t: t };
    res.carencia = { total: carDer, exigida: exDer, ok: carDer >= exDer, linhas: ['Carência no CNIS até a DER: **' + carDer + ' meses**. Exigidos: **' + exDer + '**.'] };
    var avisos = [];
    if (!pcd.length) avisos.push('Nenhum período de deficiência foi informado. Informe o grau e a data de início do impedimento, conforme a avaliação do INSS.');
    else if (!condDer) avisos.push('A deficiência não cobre a DER: a aposentadoria exige a condição de pessoa com deficiência na DER ou na data em que os requisitos foram implementados (IN 128, arts. 311, III e 314, § 2º). Sem isso, pode ser pedida a aposentadoria comum por idade ou tempo, com a conversão (art. 309, § 4º).');
    avisos.push('O grau, a data de início do impedimento e as variações são fixados pela perícia médica e pelo serviço social do INSS (art. 305). Prova exclusivamente testemunhal não basta.');
    res.avisos = avisos;

    function reqIdade(d, tp, car) {
      var im = ageMeses(nasc, d), out = [];
      out.push({ nome: 'Idade', ok: im >= (sexo === 'F' ? 55 : 60) * 12, atual: textoMeses(Math.max(0, im)), exigido: (sexo === 'F' ? 55 : 60) + ' anos' });
      out.push({ nome: 'Tempo de contribuição como pessoa com deficiência (sem conversão)', ok: tp >= 15 * 365, atual: dur(tp), exigido: '15 anos' });
      out.push({ nome: 'Carência', ok: car >= exDer, atual: car + ' meses', exigido: exDer + ' meses' });
      out.push({ nome: 'Condição de pessoa com deficiência na DER', ok: condDer, atual: condDer ? 'Sim' : 'Não', exigido: 'Sim' });
      return out;
    }
    var rs, ok, quando = null, info = null;
    if (ehIdade) {
      rs = reqIdade(der, tPcdTotal, carDer);
      ok = rs.every(function (x) { return x.ok; });
      if (!ok && condDer) for (var dd = 1; dd <= 365 * 25; dd++) { var dt = C.dataDeOrd(der.ord + dd); if (reqIdade(dt, tPcdTotal + dd, carDer + Math.floor(dd / 30)).slice(0, 3).every(function (x) { return x.ok; })) { quando = dt; break; } }
    } else {
      info = avaliaPcdTempo(t, sexo);
      rs = [];
      if (info) {
        var mk = function (conv, car) { return [
          { nome: 'Tempo de contribuição (grau preponderante: ' + nomeGrau(info.preponderante).toLowerCase() + (info.alterna ? ', com conversão' : ', sem conversão') + ')', ok: conv >= info.exigido, atual: dur(conv), exigido: dur(info.exigido) },
          { nome: 'Carência', ok: car >= exDer, atual: car + ' meses', exigido: exDer + ' meses' },
          { nome: 'Condição de pessoa com deficiência na DER', ok: condDer, atual: condDer ? 'Sim' : 'Não', exigido: 'Sim' }]; };
        rs = mk(info.convertido, carDer);
        ok = rs.every(function (x) { return x.ok; });
        if (!ok && condDer && ultimo) for (var d2 = 1; d2 <= 365 * 25; d2++) {
          var t2 = Object.assign({}, t); t2[ultimo.grau] = t[ultimo.grau] + d2;
          var i2 = avaliaPcdTempo(t2, sexo);
          if (mk(i2.convertido, carDer + Math.floor(d2 / 30))[0].ok && carDer + Math.floor(d2 / 30) >= exDer) { quando = C.dataDeOrd(der.ord + d2); break; }
        }
      } else ok = false;
    }
    res.info = info;
    res.avaliacao = { reqs: rs, ok: !!ok, quando: quando };
    var conc;
    if (!pcd.length) conc = { status: 'incompleta', rotulo: 'Informe a deficiência', texto: 'Informe o grau da deficiência e a data de início do impedimento.' };
    else if (!ehIdade && !info) conc = { status: 'nao_demonstrado', rotulo: 'Sem contribuição como pessoa com deficiência', texto: 'Nenhuma contribuição ocorreu depois do início do impedimento informado.' };
    else if (ok) conc = { status: 'provavel', rotulo: 'Requisitos cumpridos pelos dados informados', texto: 'Os requisitos de idade/tempo e carência estão cumpridos pelo CNIS e pelos períodos de deficiência informados. A deficiência e o grau dependem da avaliação do INSS.' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Requisitos ainda não demonstrados', texto: quando ? 'Mantida a deficiência e as contribuições a partir da DER, os requisitos seriam cumpridos em ' + rot(quando) + '.' : 'Os requisitos não são cumpridos pelos dados atuais.' };
    conc.pendencias = ['Avaliação médica e funcional (perícia e serviço social do INSS), com o grau e a data de início do impedimento.', 'Laudos, exames e documentos que comprovem a deficiência desde a data informada.'];
    res.conclusao = conc;
    res.valor = { linhas: ['Não calculado nesta versão: exige a correção monetária das remunerações desde 07/1994, que o CNIS não traz.', ehIdade ? 'Cálculo pelo inciso IX do art. 233 da IN 128 (art. 313).' : 'Cálculo pelo inciso VIII do art. 233 da IN 128 (art. 315).'] };
    res.documentos = ['Documento de identificação com a data de nascimento', 'Laudos, exames e prontuários que indiquem o início do impedimento e suas alterações', 'Documentos de cada vínculo e das contribuições', 'Certidão de tempo de contribuição (CTC) de regime próprio, se houver'];
    return res;
  }
  function renderizarPcd(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. O CNIS não informa a deficiência: só entra o que você informou acima.'));
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias)); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    if (r.avisos && r.avisos.length) topo.appendChild(lista(r.avisos));
    var s1 = C.sec('1. Tempo de contribuição'); s1.appendChild(lista(r.tempo.linhas));
    if (r.info && r.info.linhas.length) {
      s1.appendChild(C.tabela(['Período', 'Tempo', 'Fator para o grau ' + nomeGrau(r.info.preponderante).toLowerCase().replace('deficiência ', ''), 'Tempo convertido'], r.info.linhas.map(function (l) { return [nomeGrau(l[0]), dur(l[1]), String(l[2]).replace('.', ','), dur(l[1] * l[2])]; }).concat([['Total', '', '', dur(r.info.convertido)]])));
      s1.appendChild(C.el('p', 'dica', r.info.alterna ? 'Houve alternância entre graus ou entre tempo com e sem deficiência: os períodos são convertidos para o grau preponderante (aquele com mais tempo contribuído antes da conversão), art. 309, §§ 1º e 2º.' : 'Não houve alternância: não há conversão (art. 309, § 3º).'));
    }
    topo.appendChild(s1);
    var s2 = C.sec('2. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.ok ? 'confirmada' : 'nao_demonstrada'), r.carencia.ok ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS'));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas)); topo.appendChild(s2);
    var s3 = C.sec('3. Requisitos');
    var a = r.avaliacao;
    var sel = C.el('p', 'selo-linha'); sel.appendChild(C.el('span', 'selo selo-' + (a.ok ? 'confirmada' : 'nao_demonstrada'), a.ok ? 'Cumpridos na DER' : 'Não cumpridos na DER')); s3.appendChild(sel);
    if (a.reqs.length) s3.appendChild(C.tabela(['Requisito', 'Situação', 'Atual', 'Exigido'], a.reqs.map(function (x) { return [x.nome, x.ok ? 'Cumprido' : 'Não cumprido', x.atual, x.exigido]; })));
    if (!a.ok && a.quando) s3.appendChild(C.el('p', null, 'Mantidas a deficiência e as contribuições a partir da DER, os requisitos seriam cumpridos em ' + rot(a.quando) + '.'));
    topo.appendChild(s3);
    var s4 = C.sec('4. Valor'); s4.appendChild(lista(r.valor.linhas)); topo.appendChild(s4);
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }
  // Editor dos períodos de deficiência: grau, início do impedimento e fim (opcional).
  function editorPcd(lst, aoMudar) {
    var box = C.el('div', 'enquadramento');
    box.appendChild(C.el('h4', null, 'Períodos de deficiência'));
    box.appendChild(C.el('p', 'dica', 'Informe o grau e a data de início do impedimento fixados pela avaliação do INSS. Se o grau mudou, inclua um período para cada grau. Deixe o fim em branco se a deficiência continua.'));
    var linha = C.el('div', 'grade-campos');
    function campo(rot2, el) { var l = C.el('label'); l.appendChild(C.el('span', null, rot2)); l.appendChild(el); return l; }
    var sg = document.createElement('select'); sg.id = 'pcd-grau';
    GRAUS_PCD.forEach(function (g) { var o = document.createElement('option'); o.value = g[0]; o.textContent = g[1]; sg.appendChild(o); });
    var di = document.createElement('input'); di.type = 'date'; di.id = 'pcd-inicio';
    var df = document.createElement('input'); df.type = 'date'; df.id = 'pcd-fim';
    linha.appendChild(campo('Grau', sg)); linha.appendChild(campo('Início do impedimento', di)); linha.appendChild(campo('Fim (opcional)', df));
    box.appendChild(linha);
    var add = C.el('button', 'btn btn-leve', 'Adicionar período'); add.type = 'button';
    var ul = C.el('ul', 'lista-simples');
    function desenhar() {
      ul.textContent = '';
      lst.forEach(function (x, i) {
        var li = C.el('li', null, nomeGrau(x.grau) + ': ' + rot(x.inicio) + ' a ' + (x.fim ? rot(x.fim) : 'em aberto') + ' ');
        var rm = C.el('button', 'btn btn-leve', 'Remover'); rm.type = 'button';
        rm.addEventListener('click', function () { lst.splice(i, 1); desenhar(); if (aoMudar) aoMudar(); });
        li.appendChild(rm); ul.appendChild(li);
      });
    }
    add.addEventListener('click', function () {
      var i = lerData(di.value), f = lerData(df.value);
      if (!i) { window.alert('Informe a data de início do impedimento.'); return; }
      if (f && f.ord < i.ord) { window.alert('O fim é anterior ao início.'); return; }
      lst.push({ grau: sg.value, inicio: i, fim: f }); di.value = ''; df.value = ''; desenhar(); if (aoMudar) aoMudar();
    });
    box.appendChild(add); box.appendChild(ul); desenhar();
    return box;
  }

  // ---------- Comparador de regras ----------
  // Roda todas as aposentadorias avaliáveis com os dados informados e devolve uma linha por regra.
  function comparar(analise, entrada, hoje) {
    var der = lerData(entrada.der), nasc = lerData(entrada.nascimento);
    var out = { fato: { data: der }, linhas: [], semDados: !der || !nasc };
    if (out.semDados) return out;
    function status(ok, aplica, quando, extra) {
      if (!aplica) return { sit: 'Não se aplica', ok: false, quando: null };
      if (ok) return { sit: 'Cumprida na DER', ok: true, quando: der };
      return { sit: 'Não cumprida na DER', ok: false, quando: quando || null };
    }
    function add(grupo, regra, st, obs) { out.linhas.push({ grupo: grupo, regra: regra, sit: st.sit, ok: st.ok, quando: st.quando, obs: obs || '' }); }
    // Idade urbana
    if (I && I.aposentadoriaIdade) {
      var ri = I.aposentadoriaIdade(analise, { modalidade: 'urbana', sexo: entrada.sexo, nascimento: entrada.nascimento, der: entrada.der, compEmp: entrada.compEmp, compCI: entrada.compCI }, hoje);
      if (ri.conclusao && ri.conclusao.status !== 'incompleta') {
        var okI = ri.conclusao.status === 'provavel';
        var dtI = ri.idade && ri.idade.dataCumprimento && ri.idade.dataCumprimento.ord > der.ord ? ri.idade.dataCumprimento : null;
        add('Idade', 'Aposentadoria por idade urbana (programada)', status(okI, true, dtI), okI ? '' : (dtI ? 'Idade mínima só em ' + rot(dtI) + '; confira também carência e tempo.' : ri.conclusao.rotulo));
      }
    }
    // Tempo de contribuição (transição)
    var rt = aposentadoriaTempo(analise, entrada, hoje);
    if (rt.avaliacoes) rt.avaliacoes.forEach(function (a) { add('Tempo de contribuição', a.regra.nome + ' (' + a.regra.norma + ')', status(a.ok, a.aplicavel, a.quando), a.aplicavel ? '' : 'Primeiro vínculo posterior a 13/11/2019'); });
    // Direito adquirido antes da EC 103
    var rq = aposentadoriaAdquirida(analise, entrada, hoje);
    (rq.regras || []).forEach(function (a) { add('Direito adquirido (antes da EC 103)', a.nome, a.aplicavel ? (a.ok ? { sit: a.podePedir ? 'Cumprida na DER' : 'Direito adquirido', ok: true, quando: a.implementada || der } : { sit: 'Não implementado até ' + rot(a.lim), ok: false, quando: null }) : { sit: 'Não se aplica', ok: false, quando: null }, a.ok && a.implementada ? 'Implementada em ' + rot(a.implementada) : ''); });
    // Especial
    var ent2 = Object.assign({}, entrada);
    var re = aposentadoriaEspecial(analise, ent2, hoje);
    (re.blocos || []).forEach(function (b) { b.regras.forEach(function (a) { add('Especial', a.regra.nome + ' - ' + b.esp.n + ' anos (' + a.regra.norma + ')', status(a.ok, a.aplicavel, a.quando)); }); });
    if (!(re.blocos || []).length) out.avisoEspecial = 'Nenhum período especial enquadrado: a aposentadoria especial não foi comparada.';
    // Professor
    if ((entrada.professor || []).length) {
      var rp = aposentadoriaProfessor(analise, entrada, hoje);
      (rp.avaliacoes || []).forEach(function (a) { add('Professor', a.regra.nome + ' (' + a.regra.norma + ')', status(a.ok, a.aplicavel, a.quando)); });
    } else out.avisoProfessor = 'Nenhum vínculo de professor marcado: a aposentadoria do professor não foi comparada.';
    // PcD
    if ((entrada.pcd || []).length) {
      ['tempo', 'idade'].forEach(function (m) {
        var rc = aposentadoriaPcd(analise, entrada, hoje, m);
        if (rc.avaliacao) add('Pessoa com deficiência', 'Por ' + (m === 'tempo' ? 'tempo de contribuição' : 'idade') + ' (IN 128, ' + (m === 'tempo' ? 'art. 314' : 'art. 311') + ')', status(rc.avaliacao.ok, true, rc.avaliacao.quando));
      });
    } else out.avisoPcd = 'Nenhum período de deficiência informado: as aposentadorias da pessoa com deficiência não foram comparadas.';
    var datas = out.linhas.filter(function (l) { return l.quando; }).sort(function (x, y) { return x.quando.ord - y.quando.ord; });
    out.primeira = datas.length ? datas[0] : null;
    return out;
  }
  function renderizarComparador(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Comparação das aposentadorias'));
    topo.appendChild(C.el('p', 'dica', 'Compara os requisitos de cada regra com os dados informados (CNIS, enquadramento, vínculos de professor e períodos de deficiência). Não calcula o valor do benefício: o valor depende das remunerações corrigidas desde 07/1994 e deve ser conferido regra a regra.'));
    if (r.semDados) { topo.appendChild(C.el('p', 'msg', 'Informe sexo, data de nascimento e a data do requerimento (DER).')); return topo; }
    var cum = r.linhas.filter(function (l) { return l.ok; });
    var caixa = C.el('div', 'conclusao conclusao-' + (cum.length ? 'provavel' : 'nao_demonstrado'));
    caixa.appendChild(C.el('strong', null, cum.length ? cum.length + ' regra(s) cumprida(s) na DER (' + rot(r.fato.data) + ')' : 'Nenhuma regra cumprida na DER (' + rot(r.fato.data) + ')'));
    if (!cum.length && r.primeira) caixa.appendChild(C.el('p', null, 'Mantidas as condições, a primeira regra a ser cumprida seria "' + r.primeira.regra + '", em ' + rot(r.primeira.quando) + '.'));
    topo.appendChild(caixa);
    var avs = [r.avisoEspecial, r.avisoProfessor, r.avisoPcd].filter(Boolean);
    if (avs.length) topo.appendChild(lista(avs));
    topo.appendChild(C.tabela(['Aposentadoria', 'Regra', 'Situação na DER', 'Cumprida em', 'Observação'], r.linhas.map(function (l) { return [l.grupo, l.regra, l.sit, l.quando ? (l.ok ? 'Já na DER' : rot(l.quando)) : '-', l.obs || '']; })));
    topo.appendChild(C.el('p', 'dica', 'A data prevista supõe que o segurado continue contribuindo (e, nas regras especial, de professor e da pessoa com deficiência, mantenha a mesma atividade ou condição). Direito adquirido anterior à EC 103/2019 (tempo até 16/12/1998 e até 13/11/2019) ainda não está neste comparativo.'));
    return topo;
  }

  // ---------- Direito adquirido antes da EC 103/2019 ----------
  var NORMAS_ADQ = [
    { nome: 'EC 103/2019, art. 3º (direito adquirido) e art. 25', vigencia: 'Quem implementou os requisitos de uma aposentadoria antes de 13/11/2019 pode requerê-la depois, pelas regras da época. A conversão de tempo especial vale para o período até 13/11/2019.' },
    { nome: 'EC 20/1998, arts. 3º e 9º, e Lei 8.213/91, arts. 52 a 56 e 142 (redação anterior)', vigencia: 'Aposentadoria por tempo de serviço (integral e proporcional) até 16/12/1998 e regra de transição da EC 20 (idade de 53/48 anos e pedágio de 40%). Carência pela tabela do art. 142, conforme o ano em que os requisitos foram cumpridos.' },
    { nome: 'Lei 9.876/1999, art. 6º, e art. 29, I e § 7º da Lei 8.213/91', vigencia: 'Fator previdenciário em vigor desde 29/11/1999; quem cumpriu os requisitos até 28/11/1999 tem o cálculo anterior, sem o fator.' },
    { nome: 'Lei 13.183/2015 (art. 29-C da Lei 8.213/91): fórmula 85/95 progressiva', vigencia: 'Soma de idade e tempo de contribuição de 85 (mulher) e 95 (homem) até 30/12/2018, e de 86 e 96 de 31/12/2018 a 30/12/2020, com 30/35 anos de contribuição, sem fator previdenciário. Confira o texto vigente.' },
    { nome: 'IN PRES/INSS 128/2022, arts. 233 e seguintes (cálculo)', vigencia: 'O valor depende do cálculo da época do direito adquirido e não é calculado nesta versão.' }
  ];
  function aposentadoriaAdquirida(analise, entrada, hoje) {
    var res = { beneficio: 'aposentadoria-adquirido', titulo: 'aposentadoria por tempo com direito adquirido antes da EC 103/2019', normas: NORMAS_ADQ, entrada: entrada, fato: { data: null } };
    var nasc = lerData(entrada.nascimento), der = lerData(entrada.der), sexo = entrada.sexo === 'M' ? 'M' : 'F';
    if (!nasc || !der) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de nascimento e a data do requerimento (DER).', pendencias: [] };
      return res;
    }
    res.fato.data = der;
    var D98 = C.dataDe('16/12/1998'), D99 = C.dataDe('28/11/1999'), DEC = C.dataDeOrd(EC);
    var primeira = null;
    analise.vinculos.forEach(function (v) { if (v.valido && v.inicio && (!primeira || v.inicio.ord < primeira.ord)) primeira = v.inicio; });
    var manual = (entrada.enquadramento || []).filter(function (e) { return e && e.inicio && !e.seq; }).reduce(function (m, e) { return !m || e.inicio.ord < m.ord ? e.inicio : m; }, null);
    if (manual && (!primeira || manual.ord < primeira.ord)) primeira = manual;
    var usaTabela = !!(primeira && primeira.ord <= C.ordemDe(1991, 7, 24));
    var tc = sexo === 'F' ? 30 : 35, tp = sexo === 'F' ? 25 : 30;
    var cache = {};
    function em(d) {
      if (!cache[d.ord]) {
        var c = contar(analise, entrada, d);
        cache[d.ord] = { t: c.convDer, car: Object.keys(I.montarMeses(analise, entrada, d, { modalidade: 'urbana' }).contados).length };
      }
      return cache[d.ord];
    }
    var t98 = em(D98).t;
    function pts(d, t) { return (d.ord - nasc.ord) / 365.25 + t / 365; }
    function mk(nome, lim, aplicavel, avalia, obs, calculo) { return { nome: nome, lim: lim, aplicavel: aplicavel, avalia: avalia, obs: obs, calculo: calculo }; }
    var REGS = [
      mk('Aposentadoria por tempo de serviço integral até 16/12/1998', D98, true, function (d, e) {
        return [{ nome: 'Tempo de serviço', ok: e.t >= tc * 365, atual: dur(e.t), exigido: tc + ' anos' }, { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Sem idade mínima. Renda de 100% do salário de benefício (média dos 36 últimos salários, sem fator previdenciário).', 'Cálculo anterior à EC 20 e à Lei 9.876.'),
      mk('Aposentadoria proporcional por tempo de serviço até 16/12/1998', D98, true, function (d, e) {
        return [{ nome: 'Tempo de serviço', ok: e.t >= tp * 365, atual: dur(e.t), exigido: tp + ' anos' }, { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Sem idade mínima. 70% do salário de benefício com 25 (mulher) ou 30 anos (homem), mais 6% por ano que exceder, até 100%.', 'Cálculo anterior à EC 20 e à Lei 9.876.'),
      mk('Integral por tempo de contribuição até 28/11/1999 (antes do fator previdenciário)', D99, true, function (d, e) {
        return [{ nome: 'Tempo de contribuição', ok: e.t >= tc * 365, atual: dur(e.t), exigido: tc + ' anos' }, { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Sem idade mínima e sem fator previdenciário (Lei 9.876, art. 6º): média dos 36 últimos salários de contribuição.', ''),
      mk('Proporcional da EC 20/1998 (art. 9º, § 1º): idade e pedágio de 40%', DEC, !primeira || primeira.ord <= D98.ord, function (d, e) {
        var falta = Math.max(0, tp * 365 - t98), exig = tp * 365 + 0.4 * falta, im = ageMeses(nasc, d);
        return [{ nome: 'Tempo de contribuição com pedágio de 40% do que faltava em 16/12/1998', ok: e.t >= exig, atual: dur(e.t), exigido: dur(exig) + ' (pedágio de ' + dur(0.4 * falta) + ')' },
          { nome: 'Idade', ok: im >= (sexo === 'F' ? 48 : 53) * 12, atual: textoMeses(Math.max(0, im)), exigido: (sexo === 'F' ? 48 : 53) + ' anos' },
          { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Só para quem era filiado até 16/12/1998. 70% do salário de benefício mais 5% por ano que exceder o tempo mínimo, até 100%, com fator previdenciário.', ''),
      mk('Integral por tempo de contribuição até 13/11/2019 (30/35 anos), com fator previdenciário', DEC, true, function (d, e) {
        return [{ nome: 'Tempo de contribuição (com conversão do tempo especial)', ok: e.t >= tc * 365, atual: dur(e.t), exigido: tc + ' anos' }, { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Sem idade mínima. Aplica-se o fator previdenciário, a menos que a pessoa também alcance os pontos da fórmula 85/95.', ''),
      mk('Fórmula 85/95 progressiva (Lei 13.183/2015), sem fator previdenciário', DEC, true, function (d, e) {
        var exig = d.ord <= C.ordemDe(2018, 12, 30) ? (sexo === 'F' ? 85 : 95) : (sexo === 'F' ? 86 : 96), p = pts(d, e.t);
        return [{ nome: 'Tempo de contribuição', ok: e.t >= tc * 365, atual: dur(e.t), exigido: tc + ' anos' },
          { nome: 'Pontos (idade + tempo, em ' + d.y + ')', ok: p >= exig && d.ord >= C.ordemDe(2015, 6, 18), atual: p.toFixed(2).replace('.', ','), exigido: exig + ' pontos' },
          { nome: 'Carência', ok: e.car >= I.carenciaExigida(d.y, usaTabela), atual: e.car + ' meses', exigido: I.carenciaExigida(d.y, usaTabela) + ' meses' }];
      }, 'Vale a partir de 18/06/2015. Renda de 100% do salário de benefício (média dos 80% maiores salários), sem fator previdenciário.', '')
    ];
    var inicio = primeira ? primeira.ord : EC;
    function implementada(r) {
      function ok(d) { return r.avalia(d, em(d)).every(function (x) { return x.ok; }); }
      if (!ok(r.lim)) return null;
      var lo = inicio, hi = r.lim.ord;
      if (lo > hi) return null;
      while (lo < hi) { var mid = Math.floor((lo + hi) / 2); if (ok(C.dataDeOrd(mid))) hi = mid; else lo = mid + 1; }
      return C.dataDeOrd(lo);
    }
    res.regras = REGS.map(function (r) {
      var reqs = r.avalia(r.lim, em(r.lim));
      var ok = r.aplicavel && reqs.every(function (x) { return x.ok; });
      var quando = ok ? implementada(r) : null;
      return { nome: r.nome, lim: r.lim, aplicavel: r.aplicavel, reqs: reqs, ok: ok, implementada: quando, obs: r.obs, calculo: r.calculo, podePedir: ok && quando && quando.ord <= der.ord };
    });
    var linhas = [];
    var ctEC = em(DEC);
    linhas.push('Tempo de contribuição até 13/11/2019 (com conversão do tempo especial): **' + dur(ctEC.t) + '**; até 16/12/1998: **' + dur(t98) + '**; carência em 13/11/2019: **' + ctEC.car + ' meses**.');
    linhas.push('O direito adquirido vale mesmo que o requerimento seja feito hoje: o cálculo usa as regras da data em que os requisitos foram cumpridos. A conversão do tempo especial em comum é feita pelo enquadramento informado acima.');
    linhas.push('A carência segue a tabela do art. 142 da Lei 8.213 (para quem se filiou até 24/07/1991) conforme o ano em que os requisitos foram cumpridos.');
    res.tempo = { linhas: linhas };
    var oks = res.regras.filter(function (r) { return r.ok; });
    var conc;
    if (oks.length) conc = { status: 'provavel', rotulo: 'Direito adquirido em ' + oks.length + ' regra(s) pelos dados informados', texto: 'Implementado(s): ' + oks.map(function (r) { return r.nome + ' (em ' + rot(r.implementada || r.lim) + ')'; }).join('; ') + '. Compare com as regras de transição da EC 103: o direito adquirido pode render mais ou menos conforme o cálculo.' };
    else conc = { status: 'nao_demonstrado', rotulo: 'Nenhum direito adquirido demonstrado', texto: 'Pelos dados do CNIS e do enquadramento informado, nenhuma das regras anteriores à EC 103 foi cumprida até a respectiva data limite.' };
    conc.pendencias = ['Provas do tempo e, para períodos especiais, PPP e LTCAT. O direito adquirido depende de o tempo estar comprovado até a data limite.'];
    res.conclusao = conc;
    res.documentos = ['Documento de identificação com a data de nascimento', 'CTPS e documentos dos vínculos sem remuneração ou sem data de fim', 'PPP e LTCAT dos períodos de atividade especial', 'Certidão de tempo de contribuição (CTC) de regime próprio, se houver'];
    return res;
  }
  function renderizarAdquirido(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. O valor não é calculado: cada regra tem o cálculo da sua época.'));
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias)); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    var s1 = C.sec('1. Tempo e carência'); s1.appendChild(lista(r.tempo.linhas)); topo.appendChild(s1);
    var s2 = C.sec('2. Regras anteriores à EC 103/2019');
    r.regras.forEach(function (a) {
      var bloco = C.el('div', 'regra-tc');
      bloco.appendChild(C.el('h4', null, a.nome));
      var sel = C.el('p', 'selo-linha');
      sel.appendChild(C.el('span', 'selo selo-' + (a.ok ? 'confirmada' : 'nao_demonstrada'), a.ok ? 'Direito adquirido' : (a.aplicavel ? 'Não implementado até ' + rot(a.lim) : 'Não se aplica')));
      bloco.appendChild(sel);
      if (a.ok && a.implementada) bloco.appendChild(C.el('p', null, 'Requisitos cumpridos em ' + rot(a.implementada) + '.'));
      bloco.appendChild(C.el('p', 'dica', a.obs));
      bloco.appendChild(C.tabela(['Requisito (em ' + rot(a.lim) + ')', 'Situação', 'Atual', 'Exigido'], a.reqs.map(function (x) { return [x.nome, x.ok ? 'Cumprido' : 'Não cumprido', x.atual, x.exigido]; })));
      s2.appendChild(bloco);
    });
    topo.appendChild(s2);
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }

  // ---------- Tela ----------
  function lista(itens) { return D.util.lista(itens); }
  function renderizar(r) {
    if (r.beneficio === 'aposentadoria-especial') return renderizarEspecial(r);
    if (r.beneficio === 'aposentadoria-professor') return renderizarProfessor(r);
    if (/^aposentadoria-pcd/.test(r.beneficio)) return renderizarPcd(r);
    if (r.beneficio === 'aposentadoria-adquirido') return renderizarAdquirido(r);
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: ' + r.titulo));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. O CNIS não informa atividade especial: o tempo especial só entra se você o enquadrar acima.'));
    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) { caixa.appendChild(C.el('p', 'dica', 'Para concluir:')); caixa.appendChild(lista(c.pendencias)); }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;
    if (r.avisos && r.avisos.length) topo.appendChild(lista(r.avisos));
    var s1 = C.sec('1. Tempo de contribuição');
    s1.appendChild(lista(r.tempo.linhas));
    var pInd = (r.perguntas || []).filter(function (q) { return q.id === 'indenizaEspecial'; });
    if (pInd.length) s1.appendChild(D.perguntasUI(pInd));
    var t = r.tempo.tabela;
    s1.appendChild(C.tabela(['Natureza', 'Até 13/11/2019', 'Total até a DER'], [
      ['Comum', dur(t.ate.comum), dur(t.tot.comum)],
      ['Especial de 25 anos', dur(t.ate.esp25), dur(t.tot.esp25)],
      ['Especial de 20 anos', dur(t.ate.esp20), dur(t.tot.esp20)],
      ['Especial de 15 anos', dur(t.ate.esp15), dur(t.tot.esp15)]
    ]));
    topo.appendChild(s1);
    var s2 = C.sec('2. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.ok ? 'confirmada' : 'nao_demonstrada'), r.carencia.ok ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS'));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas));
    var pCar = (r.perguntas || []).filter(function (q) { return q.id !== 'indenizaEspecial'; });
    if (pCar.length) s2.appendChild(D.perguntasUI(pCar));
    topo.appendChild(s2);
    var s3 = C.sec('3. Regras de transição');
    r.avaliacoes.forEach(function (a) {
      var bloco = C.el('div', 'regra-tc');
      bloco.appendChild(C.el('h4', null, a.regra.nome + ' (' + a.regra.norma + ')'));
      var sel = C.el('p', 'selo-linha');
      sel.appendChild(C.el('span', 'selo selo-' + (a.ok && a.aplicavel ? 'confirmada' : 'nao_demonstrada'), a.ok && a.aplicavel ? 'Cumprida na DER' : (a.aplicavel ? 'Não cumprida na DER' : 'Não se aplica')));
      bloco.appendChild(sel);
      bloco.appendChild(C.el('p', 'dica', a.regra.desc));
      bloco.appendChild(C.tabela(['Requisito', 'Situação', 'Atual', 'Exigido'], a.reqs.map(function (x) { return [x.nome, x.ok ? 'Cumprido' : 'Não cumprido', x.atual, x.exigido]; })));
      if (!a.ok && a.quando && a.aplicavel) bloco.appendChild(C.el('p', null, 'Mantidas as contribuições a partir da DER, esta regra seria cumprida em ' + rot(a.quando) + '.'));
      s3.appendChild(bloco);
    });
    topo.appendChild(s3);
    var s8 = C.sec('Documentos a reunir'); s8.appendChild(lista(r.documentos)); topo.appendChild(s8);
    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }

  // ---------- Editor de enquadramento ----------
  function ordDe(s) { var d = lerData(s); return d; }
  function serializar(enq) { return JSON.stringify({ versao: 1, enquadramento: enq.map(function (e) { return { seq: e.seq || 0, inicio: rot(e.inicio), fim: rot(e.fim), natureza: e.natureza, nota: e.nota || '' }; }) }, null, 2); }
  function carregar(txt) {
    var j = JSON.parse(txt), out = [];
    (j.enquadramento || []).forEach(function (e) {
      var i = C.dataDe(e.inicio), f = C.dataDe(e.fim);
      if (i && f && NAT[e.natureza]) out.push({ seq: +e.seq || 0, inicio: i, fim: f, natureza: e.natureza, nota: e.nota || '' });
    });
    return out;
  }
  function editor(analise, enq, aoMudar) {
    var box = C.el('div', 'enquadramento');
    box.appendChild(C.el('h4', null, 'Enquadramento do tempo (opcional)'));
    box.appendChild(C.el('p', 'dica', 'O CNIS não diz se o trabalho foi especial. Marque aqui os períodos especiais, indenizados ou fora do CNIS. Não entram na lista: segurado especial e facultativo. Contribuinte individual só até 28/04/1995 e empregado rural só a partir de 01/11/1991. Isso fica só neste navegador; você pode salvar em arquivo para retomar depois.'));
    var grade = C.el('div', 'grade-campos');
    function campo(rotulo, el) { var l = C.el('label', 'campo'); l.appendChild(C.el('span', null, rotulo)); l.appendChild(el); return l; }
    var selV = document.createElement('select'); selV.id = 'enq-vinculo';
    var o0 = document.createElement('option'); o0.value = '0'; o0.textContent = 'Período fora do CNIS'; selV.appendChild(o0);
    var ref = { a: analise };
    function preencher() {
      while (selV.options.length > 1) selV.remove(1);
      ref.a.vinculos.forEach(function (v) {
        if (!v.valido) return;
        var rg = regraEnq(v);
        if (!rg) return;
        var di = rg.min !== null ? Math.max(v.inicio.ord, rg.min) : v.inicio.ord, df = rg.max !== null ? Math.min(v.fimContado.ord, rg.max) : v.fimContado.ord;
        var o = document.createElement('option'); o.value = String(v.seq);
        o.textContent = 'Seq. ' + v.seq + ' – ' + (v.nome || v.tipo || 'vínculo') + ' (' + rot(C.dataDeOrd(di)) + ' a ' + rot(C.dataDeOrd(df)) + ')' + (rg.motivo ? ' – ' + rg.motivo : '');
        o.dataset.ini = rot(C.dataDeOrd(di)); o.dataset.fim = rot(C.dataDeOrd(df));
        selV.appendChild(o);
      });
    }
    preencher();
    box.atualizar = function (nova) { ref.a = nova; preencher(); };
    var selN = document.createElement('select'); selN.id = 'enq-natureza';
    NATUREZAS.forEach(function (n) { if (n.id === 'comum') return; var o = document.createElement('option'); o.value = n.id; o.textContent = n.nome; selN.appendChild(o); });
    var ini = document.createElement('input'); ini.type = 'date'; ini.id = 'enq-inicio';
    var fim = document.createElement('input'); fim.type = 'date'; fim.id = 'enq-fim';
    function isoDe(txt) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(txt || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
    selV.addEventListener('change', function () { var o = selV.selectedOptions[0]; ini.value = isoDe(o.dataset.ini); fim.value = isoDe(o.dataset.fim); });
    grade.appendChild(campo('Vínculo', selV)); grade.appendChild(campo('Natureza', selN)); grade.appendChild(campo('Início', ini)); grade.appendChild(campo('Fim', fim));
    box.appendChild(grade);
    var acoes = C.el('div', 'acoes');
    var add = C.el('button', 'btn', 'Adicionar enquadramento'); add.type = 'button';
    var salvar = C.el('button', 'btn btn-sec', 'Salvar em arquivo'); salvar.type = 'button';
    var carregarBt = C.el('button', 'btn btn-sec', 'Carregar de arquivo'); carregarBt.type = 'button';
    var arq = document.createElement('input'); arq.type = 'file'; arq.accept = 'application/json,.json'; arq.hidden = true;
    acoes.appendChild(add); acoes.appendChild(salvar); acoes.appendChild(carregarBt); acoes.appendChild(arq);
    box.appendChild(acoes);
    var msg = C.el('p', 'msg'); box.appendChild(msg);
    var ul = C.el('div', 'enq-lista'); box.appendChild(ul);
    function desenhar() {
      ul.textContent = '';
      if (!enq.length) { ul.appendChild(C.el('p', 'dica', 'Nenhum enquadramento informado: todo o tempo é tratado como comum.')); return; }
      var itens = C.el('ul', 'lista-simples');
      enq.forEach(function (e, i) {
        var li = C.el('li');
        li.appendChild(document.createTextNode((e.seq ? 'Seq. ' + e.seq : 'Fora do CNIS') + ', ' + rot(e.inicio) + ' a ' + rot(e.fim) + ': ' + NAT[e.natureza].nome + ' '));
        var rm = C.el('button', 'btn btn-sec', 'Remover'); rm.type = 'button';
        rm.addEventListener('click', function () { enq.splice(i, 1); desenhar(); aoMudar(); });
        li.appendChild(rm); itens.appendChild(li);
      });
      ul.appendChild(itens);
    }
    add.addEventListener('click', function () {
      var i = ordDe(ini.value), f = ordDe(fim.value);
      if (!i || !f || f.ord < i.ord) { msg.textContent = 'Informe um período válido (início até o fim).'; return; }
      msg.textContent = '';
      var sq = +selV.value || 0, vv = ref.a.vinculos.filter(function (x) { return x.seq === sq; })[0], rg = vv ? regraEnq(vv) : null;
      if (sq && rg) {
        if (rg.min !== null && i.ord < rg.min) { i = C.dataDeOrd(rg.min); msg.textContent = 'Início ajustado para ' + rot(i) + ' (' + rg.motivo + ').'; }
        if (rg.max !== null && f.ord > rg.max) { f = C.dataDeOrd(rg.max); msg.textContent = 'Fim ajustado para ' + rot(f) + ' (' + rg.motivo + ').'; }
        if (f.ord < i.ord) { msg.textContent = 'Período fora do limite permitido (' + rg.motivo + ').'; return; }
      }
      enq.push({ seq: sq, inicio: i, fim: f, natureza: selN.value, nota: '' });
      desenhar(); aoMudar();
    });
    salvar.addEventListener('click', function () {
      var blob = new Blob([serializar(enq)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'enquadramento-tempo.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
    carregarBt.addEventListener('click', function () { arq.click(); });
    arq.addEventListener('change', function () {
      var f = arq.files && arq.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { var novos = carregar(String(fr.result)); enq.length = 0; novos.forEach(function (x) { enq.push(x); }); msg.textContent = novos.length + ' enquadramento(s) carregado(s).'; desenhar(); aoMudar(); }
        catch (e) { msg.textContent = 'Arquivo inválido.'; }
      };
      fr.readAsText(f);
    });
    desenhar();
    return box;
  }

  function lerCampos() {
    var g = function (id) { return document.getElementById(id); };
    return { sexo: g('tc-sexo').value, nascimento: g('tc-nasc').value, der: g('tc-der').value };
  }

  var api = { aposentadoriaAdquirida: aposentadoriaAdquirida, comparar: comparar, renderizarComparador: renderizarComparador, aposentadoriaPcd: aposentadoriaPcd, editorPcd: editorPcd, avaliaPcdTempo: avaliaPcdTempo, tempoPcd: tempoPcd, aposentadoriaProfessor: aposentadoriaProfessor, editorProfessor: editorProfessor, sugereProfessor: sugereProfessor, aposentadoriaEspecial: aposentadoriaEspecial, contar: contar, regraEnq: regraEnq, aposentadoriaTempo: aposentadoriaTempo, renderizar: renderizar, editor: editor, lerCampos: lerCampos, serializar: serializar, carregar: carregar, pontosExigidos: pontosExigidos, idadeProgressivaMeses: idadeProgressivaMeses, FATOR: FATOR, NATUREZAS: NATUREZAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TEMPO = api;
})(typeof window !== 'undefined' ? window : globalThis);
