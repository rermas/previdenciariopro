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

  // ---------- Contagem por dia, com o enquadramento ----------
  function contar(analise, entrada, der) {
    var mm = I.montarMeses(analise, entrada, der, { modalidade: 'urbana', modo: 'tc', indenizaEspecial: entrada.indenizaEspecial === true });
    var sexo = entrada.sexo === 'M' ? 'M' : 'F';
    var enq = (entrada.enquadramento || []).filter(function (e) { return e && e.inicio && e.fim && NAT[e.natureza]; });
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
      mm: mm, tot: tot, ate: ate, fatores: fatores,
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
      var elegivel = ctx.tcEC < req && ctx.tcEC >= req - 2 * 365;
      r('Faltavam até 2 anos para o tempo mínimo em 13/11/2019', elegivel, dur(ctx.tcEC) + ' em 13/11/2019', (sexo === 'F' ? 28 : 33) + ' anos a menos de ' + (sexo === 'F' ? 30 : 35));
      var exigido = req + falta * 0.5;
      r('Tempo de contribuição com pedágio de 50%', tcDias >= exigido, dur(tcDias), dur(exigido) + ' (pedágio de ' + dur(falta * 0.5) + ')');
    } else if (regra === 'pedagio100') {
      var ex100 = req + falta;
      var idMin = (sexo === 'F' ? 57 : 60) * 12;
      r('Tempo de contribuição com pedágio de 100%', tcDias >= ex100, dur(tcDias), dur(ex100) + ' (pedágio de ' + dur(falta) + ')');
      r('Idade mínima', idadeM >= idMin, textoMeses(Math.max(0, idadeM)), (sexo === 'F' ? 57 : 60) + ' anos');
    }
    r('Carência', carenciaMeses >= ctx.carenciaExigida, carenciaMeses + ' meses', ctx.carenciaExigida + ' meses');
    return out;
  }
  var REGRAS = [
    { id: 'pontos', nome: 'Regra dos pontos', norma: 'art. 15 da EC 103/2019', desc: 'Tempo mínimo de 30 anos (mulher) ou 35 (homem) e soma de idade e tempo de contribuição, que sobe 1 ponto por ano.' },
    { id: 'idade', nome: 'Idade mínima progressiva', norma: 'art. 16 da EC 103/2019', desc: 'Tempo mínimo de 30/35 anos e idade mínima que sobe 6 meses por ano (mulher até 62, homem até 65).' },
    { id: 'pedagio50', nome: 'Pedágio de 50%', norma: 'art. 17 da EC 103/2019', desc: 'Para quem em 13/11/2019 estava a até 2 anos do tempo mínimo: cumprir o tempo mínimo mais 50% do que faltava, sem idade mínima.' },
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

  // ---------- Tela ----------
  function lista(itens) { return D.util.lista(itens); }
  function renderizar(r) {
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
    box.appendChild(C.el('p', 'dica', 'O CNIS não diz se o trabalho foi especial. Marque aqui os períodos especiais, indenizados ou fora do CNIS. Isso fica só neste navegador; você pode salvar em arquivo para retomar depois.'));
    var grade = C.el('div', 'grade-campos');
    function campo(rotulo, el) { var l = C.el('label', 'campo'); l.appendChild(C.el('span', null, rotulo)); l.appendChild(el); return l; }
    var selV = document.createElement('select'); selV.id = 'enq-vinculo';
    var o0 = document.createElement('option'); o0.value = '0'; o0.textContent = 'Período fora do CNIS'; selV.appendChild(o0);
    analise.vinculos.forEach(function (v) {
      if (!v.valido) return;
      var o = document.createElement('option'); o.value = String(v.seq);
      o.textContent = 'Seq. ' + v.seq + ' – ' + (v.nome || v.tipo || 'vínculo') + ' (' + rot(v.inicio) + ' a ' + rot(v.fimContado) + ')';
      o.dataset.ini = rot(v.inicio); o.dataset.fim = rot(v.fimContado);
      selV.appendChild(o);
    });
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
      enq.push({ seq: +selV.value || 0, inicio: i, fim: f, natureza: selN.value, nota: '' });
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

  var api = { aposentadoriaTempo: aposentadoriaTempo, renderizar: renderizar, editor: editor, lerCampos: lerCampos, serializar: serializar, carregar: carregar, pontosExigidos: pontosExigidos, idadeProgressivaMeses: idadeProgressivaMeses, FATOR: FATOR, NATUREZAS: NATUREZAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TEMPO = api;
})(typeof window !== 'undefined' ? window : globalThis);
