// Verificação de direito: auxílio-reclusão (Lei 8.213/91, art. 80) e auxílio por incapacidade temporária (arts. 59 a 63).
// Roda no navegador, sem enviar dados. Depende de assets/cnis.js e assets/direito.js (qualidade de segurado) e usa as tabelas de assets/pensao.js.
(function (root) {
  'use strict';
  var C = root.CNIS || (typeof require !== 'undefined' ? require('./cnis.js') : null);
  var D = root.DIREITO || (typeof require !== 'undefined' ? require('./direito.js') : null);
  var P = root.PENSAO || (typeof require !== 'undefined' ? require('./pensao.js') : null);

  var N_QUALIDADE = { nome: 'Lei 8.213/91, art. 15 (qualidade de segurado) e art. 27-A (carência pela metade após perda da qualidade)', vigencia: 'Texto compilado; confira a versão vigente. O art. 27-A exige, a partir da nova filiação, metade da carência dos arts. 25, I, III e IV.' };
  var N_RECLUSAO = [
    { nome: 'Lei 8.213/91, art. 80 (auxílio-reclusão), art. 25, IV (carência de 24 contribuições) e art. 74 (início do benefício, por remissão do art. 80)', vigencia: 'Redação da Lei 13.846/2019. Confira o texto compilado no Planalto.' },
    { nome: 'EC 103/2019, art. 13 (baixa renda) e art. 27 (valor)', vigencia: 'Limite de R$ 1.364,43 em 2019, corrigido a cada ano pelos mesmos índices dos benefícios do RGPS (Portarias Interministeriais). Benefício de um salário mínimo, dividido entre os dependentes.' },
    { nome: 'Lei 8.213/91, art. 77, § 2º (duração da cota do cônjuge/companheiro), aplicado ao auxílio-reclusão', vigencia: 'Portaria ME 424/2020 desde 01/01/2021; Lei 13.135/2015 antes disso. O INSS aplica as regras da pensão por morte ao auxílio-reclusão: confira a norma interna vigente.' },
    N_QUALIDADE
  ];
  var N_INCAP = [
    { nome: 'Lei 8.213/91, arts. 59 a 63 (auxílio por incapacidade temporária, antigo auxílio-doença), art. 25, I (carência de 12 contribuições) e art. 26, II (dispensa)', vigencia: 'Redação atual; confira o texto compilado. A lista de doenças que dispensam carência é atualizada pelas Portarias Interministeriais (art. 151).' },
    { nome: 'Lei 8.213/91, art. 59, parágrafo único (incapacidade anterior à filiação) e art. 60 (início do benefício)', vigencia: 'Redação das Leis 9.032/95, 9.876/99 e 13.846/2019. Confira o texto compilado.' },
    { nome: 'Lei 8.213/91, art. 61 e art. 29 (valor) e EC 103/2019, art. 26 (média de todos os salários de contribuição)', vigencia: 'Para benefícios com início desde 13/11/2019. O valor não é calculado nesta versão.' },
    N_QUALIDADE
  ];

  // Limite de renda do auxílio-reclusão por ano (média dos salários de contribuição dos 12 meses anteriores à prisão).
  var LIMITE_RENDA = { 2019: 1364.43, 2020: 1425.56, 2021: 1503.25, 2022: 1655.98, 2023: 1754.18, 2024: 1819.26, 2025: 1906.04, 2026: 1980.38 };
  var ANO_LIMITE_MAX = 2026;

  function lerData(x) {
    if (!x) return null;
    if (typeof x === 'string') {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
      return m ? C.dataDe(m[3] + '/' + m[2] + '/' + m[1]) : null;
    }
    return x.ord !== undefined ? x : C.dataDe(x.d + '/' + x.m + '/' + x.y);
  }
  function dObj(o) { return C.dataDeOrd(o); }
  function mk(y, m, d) { return { y: y, m: m, d: d, ord: C.ordemDe(y, m, d) }; }
  function diasNoMes(y, m) { return new Date(y, m, 0).getDate(); }
  function somar(d, anos, meses) {
    var t = d.y * 12 + (d.m - 1) + anos * 12 + meses, y = Math.floor(t / 12), m = (t % 12) + 1;
    return mk(y, m, Math.min(d.d, diasNoMes(y, m)));
  }
  function idadeEm(nasc, ref) {
    var a = ref.y - nasc.y;
    if (ref.m < nasc.m || (ref.m === nasc.m && ref.d < nasc.d)) a--;
    return a;
  }
  function rot(d) { return C.rotuloData(d); }
  function mesOrd(d) { return d.y * 12 + (d.m - 1); }
  function rotMes(k) { return String(k % 12 + 1).padStart(2, '0') + '/' + Math.floor(k / 12); }
  function dinheiro(n) { return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function qualOk(q) { return ['confirmada', 'provavel', 'indeterminada'].indexOf(q.status) >= 0; }

  // Qualidade de segurado numa data (mesmo módulo do salário-maternidade e da pensão por morte).
  function qualidadeEm(analise, entrada, data, hoje) {
    return D.salarioMaternidade(analise, { tipo: 'outro', data: data, categoria: 'auto', desemprego: !!entrada.desemprego, _sub: true, _semCarencia: true }, hoje);
  }

  // Carência: contribuições válidas do CNIS (mais meses anteriores a 07/1994) e a regra da metade após perda da qualidade (art. 27-A).
  function carenciaEm(analise, entrada, base, data, exigida) {
    var validas = base.carencia ? base.carencia.competenciasValidas : 0;
    var antes94 = analise.carencia ? analise.carencia.mesesAntes94 : 0;
    var total = validas + antes94;
    var classes = {};
    analise.vinculos.filter(function (v) { return v.inicio; }).forEach(function (v) { classes[v.seq] = D.classeDe(v); });
    var sq = D.sequencia(analise, classes, mesOrd(data), !!entrada.desemprego);
    var perda = sq.perdas.length > 0;
    var metade = Math.ceil(exigida / 2);
    var ok = total >= exigida && (!perda || sq.total >= metade);
    var linhas = ['Contribuições válidas do CNIS até ' + rotMes(mesOrd(data)) + ' (competências desde 07/1994 com valor igual ou acima do salário mínimo, mais meses de vínculo anteriores a 07/1994): **' + total + '**. Exigidas: **' + exigida + '**.'];
    if (perda) linhas.push('Houve perda da qualidade no histórico (depois de ' + rotMes(sq.perdas[sq.perdas.length - 1].apos) + '): contando da nova filiação, são exigidas ao menos **' + metade + '** contribuições, metade da carência (art. 27-A). Depois do retorno: **' + sq.total + '**.');
    return { exigida: exigida, total: total, perda: perda, depoisDoRetorno: sq.total, ok: ok, linhas: linhas };
  }

  function beneficioEmGozo(analise, ord, regex) {
    return analise.beneficios.filter(function (b) {
      return b.inicio && b.inicio.ord <= ord && (!b.fim || b.fim.ord >= ord) && regex.test(b.texto || '');
    });
  }

  // ===================== AUXÍLIO-RECLUSÃO =====================

  var DEP_R = {
    conjuge: { rotulo: 'Cônjuge', classe: 1, par: true },
    companheiro: { rotulo: 'Companheiro(a)', classe: 1, par: true },
    filho: { rotulo: 'Filho ou equiparado', classe: 1 },
    filho_maior_invalido: { rotulo: 'Filho maior inválido ou com deficiência', classe: 1 },
    pai_mae: { rotulo: 'Pai ou mãe', classe: 2 },
    irmao: { rotulo: 'Irmão(ã)', classe: 3 }
  };

  function auxilioReclusao(analise, entrada, hoje) {
    var res = {
      beneficio: 'auxilio-reclusao', titulo: 'auxílio-reclusão', normas: N_RECLUSAO, entrada: entrada,
      regras: [
        '**Carência de 24 contribuições** (art. 25, IV), sem dispensa para acidente. Após perda da qualidade, metade (12) contadas da nova filiação.',
        '**Baixa renda:** média dos salários de contribuição dos 12 meses anteriores à prisão, até o limite do ano.',
        '**Só regime fechado** (e prisão provisória), desde 18/01/2019. Semiaberto e aberto não dão direito.',
        '**O segurado não pode receber** remuneração da empresa, auxílio por incapacidade temporária, pensão por morte, salário-maternidade, aposentadoria nem abono de permanência.'
      ],
      fato: { rotulo: 'Data da prisão', data: null, notas: [] }, qualidade: null, categoria: null, carencia: null, requisitos: [], dependente: null, duracao: null,
      inicio: null, cnis: [], valor: null, documentos: [], conclusao: null
    };
    var docs = [];
    function doc(t) { if (docs.indexOf(t) < 0) docs.push(t); }
    var prisao = lerData(entrada.prisao);
    if (!prisao) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data do recolhimento à prisão.', pendencias: ['Informar a data do recolhimento à prisão.'] };
      res.documentos = ['Certidão de efetivo recolhimento à prisão'];
      return res;
    }
    var hojeD = lerData(hoje) || hoje;
    if (hojeD.ord === undefined) hojeD = mk(hojeD.y, hojeD.m, hojeD.d);
    res.fato.data = prisao;
    if (prisao.ord > hojeD.ord) res.fato.notas.push('A prisão está no futuro: o resultado é uma simulação.');
    doc('Certidão de efetivo recolhimento à prisão, emitida pela autoridade (art. 80, § 1º)');
    doc('Documentos de identificação e CPF do segurado preso e do dependente');

    var foraEscopo = prisao.ord < C.ordemDe(2019, 1, 18);
    if (foraEscopo) res.fato.notas.push('Prisão antes de 18/01/2019: valem regras anteriores (regime semiaberto, renda do último salário de contribuição). Esta verificação cobre prisões desde 18/01/2019 e **não conclui** este caso.');

    // ----- Regime -----
    var regime = entrada.regime || 'fechado';
    var regimeOk = regime === 'fechado' || regime === 'provisorio';
    if (regime === 'provisorio') res.fato.notas.push('Prisão provisória (preventiva ou temporária) dá direito, desde que comprovada por certidão. Se houver absolvição, soltura ou conversão em prisão domiciliar, o benefício cessa.');
    if (regime === 'semiaberto') res.fato.notas.push('Regime semiaberto não dá direito ao auxílio-reclusão para prisões desde 18/01/2019 (Lei 13.846/2019).');
    if (regime === 'aberto') res.fato.notas.push('Regime aberto, prisão domiciliar e livramento condicional não dão direito ao auxílio-reclusão.');
    var soltura = lerData(entrada.soltura);
    if (soltura && soltura.ord < prisao.ord) { res.fato.notas.push('A data de soltura é anterior à prisão e foi ignorada.'); soltura = null; }
    if (soltura) res.fato.notas.push('Soltura em ' + rot(soltura) + ': o benefício só é devido enquanto o segurado estiver preso. Fuga, liberdade condicional, regime aberto ou prisão domiciliar encerram o benefício.');
    res.fato.notas.push('O benefício só se mantém com a apresentação, a cada 3 meses, de declaração de permanência na condição de preso (art. 80, § 1º).');

    // ----- Qualidade -----
    var base = qualidadeEm(analise, entrada, prisao, hojeD);
    res.qualidade = base.qualidade; res.categoria = base.categoria; res.cnis = base.cnis;
    var q = base.qualidade, qOk = qualOk(q);

    // ----- Carência -----
    var car = carenciaEm(analise, entrada, base, prisao, 24);
    res.carencia = { rotulo: car.ok ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS', status: car.ok ? 'cumprida' : 'nao_cumprida', linhas: car.linhas.concat(['A carência de 24 contribuições vale também para segurado empregado e não é dispensada em caso de acidente (art. 26 da Lei 8.213/91 não lista o auxílio-reclusão).']) };
    if (!car.ok) doc('Guias de recolhimento e provas de atividade que completem a carência, se não constarem do CNIS');

    // ----- Renda (baixa renda) -----
    var mp = mesOrd(prisao), soma = 0, n = 0, meses = [];
    for (var k = mp - 12; k <= mp - 1; k++) {
      var l = analise.valores[k];
      if (!l) continue;
      var tot = l.reduce(function (t, x) { return t + x.valor; }, 0);
      if (tot > 0) { soma += tot; n++; meses.push(k); }
    }
    var anoLim = Math.min(prisao.y, ANO_LIMITE_MAX);
    var limite = LIMITE_RENDA[anoLim] || null;
    var media = n ? soma / n : 0;
    var rendaOk = !limite ? null : media <= limite + 0.004;
    var rd = ['Limite de renda em ' + anoLim + ': **' + (limite ? dinheiro(limite) : 'não cadastrado') + '**' + (prisao.y > ANO_LIMITE_MAX ? ' (último ano cadastrado; para ' + prisao.y + ' confira a Portaria Interministerial do ano)' : '') + '.'];
    if (n) {
      rd.push('Média dos salários de contribuição dos 12 meses anteriores ao mês da prisão (' + rotMes(mp - 12) + ' a ' + rotMes(mp - 1) + '): **' + dinheiro(media) + '** (' + n + ' competência(s) com salário no CNIS).');
      rd.push(rendaOk ? 'Renda **dentro** do limite.' : 'Renda **acima** do limite: pelo critério de renda, não há direito. Em casos em que a renda supera o limite por pouco, há decisões judiciais que flexibilizam o critério (TNU, Tema 169): confira.');
    } else {
      rd.push('Não há salário de contribuição nos 12 meses anteriores à prisão. Sem renda, o segurado é tratado como de baixa renda, mas é preciso comprovar a ausência de renda e a situação de desemprego.');
      doc('Comprovação da ausência de renda no período (CTPS, declaração, seguro-desemprego), se não houver salário de contribuição');
    }
    res.requisitos.push({ titulo: 'Baixa renda do segurado', linhas: rd });
    var rendaExcede = rendaOk === false;

    // ----- Impedimentos: remuneração e benefícios acumulados -----
    var imp = [];
    var incompat = beneficioEmGozo(analise, prisao.ord, /APOSENT|AUX[IÍ]LIO[ -]DOEN|INCAPACIDADE|PENS[AÃ]O|MATERNIDADE|ABONO/i)
      .filter(function (b) { return !/AUX[IÍ]LIO[ -]ACIDENTE/i.test(b.texto || ''); });
    var incompatTxt = incompat.map(function (b) { return 'NB ' + (b.nb || 's/n') + ' (' + (b.texto || '').replace(/\s+/g, ' ').trim().slice(0, 60) + ')'; });
    if (incompat.length) imp.push('O CNIS mostra benefício em gozo na data da prisão: ' + incompatTxt.join('; ') + '. O segurado em gozo de auxílio por incapacidade temporária, aposentadoria, pensão, salário-maternidade ou abono de permanência **não gera** auxílio-reclusão. Se o benefício já cessou, o CNIS pode estar desatualizado.');
    var ativosEmpr = (base.categoria && base.categoria.ativos || []).filter(function (a) { return 
      if (['empregada', 'domestica', 'avulsa', 'outra'].indexOf(a.classe) < 0) return false;
      var v = analise.vinculos.filter(function (x) { return x.seq === a.seq; })[0];
      return !v || !v.fim || v.fim.ord > prisao.ord; // vínculo encerrado na data da prisão não gera remuneração depois
    });
    if (ativosEmpr.length) imp.push('Há vínculo de empregado ainda ativo depois da prisão (Seq. ' + ativosEmpr.map(function (a) { return a.seq; }).join(', ') + '). Se a empresa continuar pagando remuneração durante a prisão, **não há direito**. Comprovar que não houve pagamento.');
    if (imp.length) res.requisitos.push({ titulo: 'Impedimentos (remuneração e benefícios)', linhas: imp });
    if (ativosEmpr.length) doc('Declaração da empresa de que não paga remuneração ao segurado preso, ou termo de rescisão');

    // ----- Dependente e duração -----
    var depKey = DEP_R[entrada.dependente] ? entrada.dependente : 'conjuge';
    var dep = DEP_R[depKey];
    var maiorInvalido = depKey === 'filho_maior_invalido';
    var tipoDep = maiorInvalido ? 'filho' : depKey;
    var inval = !!entrada.invalido || maiorInvalido;
    var nasc = lerData(entrada.nascimento), uniao = lerData(entrada.uniao);
    var idade = nasc ? idadeEm(nasc, prisao) : null;
    var d = { tipo: tipoDep, rotulo: dep.rotulo, classe: dep.classe, apto: true, linhas: [], pericia: false };
    res.dependente = d;
    if (dep.classe > 1) d.linhas.push('Dependente de classe ' + dep.classe + ': só recebe se não houver dependente da classe anterior (cônjuge, companheiro e filhos), e **precisa comprovar dependência econômica** do segurado preso (art. 16, § 4º). Esta verificação analisa um dependente por vez e não avalia a ordem das classes.');
    if (tipoDep === 'conjuge') d.linhas.push('Cônjuge: certidão de casamento e, em caso de separação de fato, prova da dependência econômica.');
    if (tipoDep === 'companheiro') d.linhas.push('Companheiro(a): prova da união estável (documentos contemporâneos, art. 16, § 5º; só testemunha não basta).');
    if (tipoDep === 'filho') {
      if (!nasc) d.linhas.push('Informe a data de nascimento do filho: o benefício vai até os 21 anos, salvo invalidez ou deficiência.');
      else if (idade >= 21 && !inval) { d.apto = false; d.linhas.push('Filho com ' + idade + ' anos na data da prisão: maior de 21 anos, não é dependente, salvo se inválido ou com deficiência (marque a opção própria).'); }
      else d.linhas.push('Filho com ' + idade + ' anos na data da prisão.');
    }
    if (tipoDep === 'irmao') {
      if (!nasc) d.linhas.push('Informe a data de nascimento do irmão(ã): só é dependente até os 21 anos, salvo invalidez ou deficiência.');
      else if (idade >= 21 && !inval) { d.apto = false; d.linhas.push('Irmão(ã) com ' + idade + ' anos na data da prisão: maior de 21 anos, não é dependente, salvo se inválido ou com deficiência.'); }
    }
    if (inval) { d.pericia = true; d.linhas.push('Invalidez ou deficiência: deve ser comprovada em **perícia médica** do INSS, e a condição precisa ser anterior à prisão (ou à maioridade, no caso de filho).'); doc('Laudos e exames que comprovem a invalidez ou deficiência, para a perícia médica'); }
    if (dep.classe > 1) doc('Provas da dependência econômica (documentos, comprovantes de despesas, conta conjunta etc.)');
    if (tipoDep === 'companheiro') doc('Documentos da união estável (certidão de filhos, conta conjunta, seguro, plano de saúde, comprovante de residência etc.)');
    if (tipoDep === 'conjuge') doc('Certidão de casamento atualizada');
    if (tipoDep === 'filho') doc('Certidão de nascimento do dependente');
    if (tipoDep === 'irmao') doc('Certidão de nascimento do dependente');
    var precisaEcon = dep.classe > 1;

    var du = { linhas: [], rotulo: null, texto: null, fim: null, vitalicia: false, indeterminada: false, regra: null };
    res.duracao = du;
    var tabela = null;
    if (dep.par) {
      if (!uniao) { du.indeterminada = true; du.rotulo = 'Informe o início do casamento ou da união'; du.texto = 'Sem a data de início, não dá para decidir entre 4 meses e a tabela por idade.'; du.linhas.push('Informe o início do casamento ou da união estável.'); d.linhas.push('Informe o início do casamento ou da união estável.'); }
      else {
        var doisAnos = somar(uniao, 2, 0).ord <= prisao.ord;
        du.linhas.push('Casamento ou união estável iniciado em ' + rot(uniao) + (doisAnos ? ': **2 anos ou mais** antes da prisão.' : ': **menos de 2 anos** antes da prisão.'));
        if (!doisAnos) { du.fim = somar(prisao, 0, 4); du.regra = 'quatro'; du.rotulo = '4 meses'; du.texto = 'Cota de 4 meses, contada da prisão, até ' + rot(du.fim) + '.'; }
        else if (idade === null && !nasc) { du.indeterminada = true; du.rotulo = 'Informe a data de nascimento'; du.texto = 'A duração depende da idade do dependente na data da prisão.'; d.linhas.push('Informe a data de nascimento do dependente.'); }
        else {
          var idd = idadeEm(nasc, prisao);
          var tb = prisao.ord >= C.ordemDe(2021, 1, 1) ? P.TABELA_2021 : P.TABELA_2015;
          tabela = { nome: tb === P.TABELA_2021 ? '2021' : '2015', linhas: tb, destaque: null };
          var faixa = tb[0];
          tb.forEach(function (f) { if (idd >= f[0]) faixa = f; });
          tabela.destaque = faixa[1];
          du.regra = 'idade';
          if (faixa[2] === null) { du.vitalicia = true; du.rotulo = 'Vitalícia (enquanto preso)'; du.texto = 'Faixa de ' + faixa[1].toLowerCase() + ': cota sem prazo final, mas o auxílio-reclusão só dura enquanto o segurado estiver preso.'; }
          else { du.fim = somar(prisao, faixa[2], 0); du.rotulo = faixa[2] + ' anos'; du.texto = 'Cota de ' + faixa[2] + ' anos (faixa de ' + faixa[1].toLowerCase() + '), contada da prisão, até ' + rot(du.fim) + '.'; }
        }
      }
    } else if (tipoDep === 'filho' || tipoDep === 'irmao') {
      if (inval) { du.vitalicia = true; du.rotulo = 'Enquanto durar a invalidez e a prisão'; du.texto = 'Sem limite de idade para o inválido ou com deficiência, enquanto durar a condição e a prisão.'; }
      else if (!nasc) { du.indeterminada = true; du.rotulo = 'Informe a data de nascimento'; du.texto = 'O benefício dura até os 21 anos.'; }
      else { du.fim = somar(nasc, 21, 0); du.rotulo = 'Até os 21 anos'; du.texto = 'Dura até completar 21 anos, em ' + rot(du.fim) + ', ou até a soltura do segurado.'; }
    } else { du.vitalicia = true; du.rotulo = 'Enquanto durar a prisão'; du.texto = 'Pais: sem prazo final, enquanto o segurado estiver preso e a dependência econômica persistir.'; }
    du.linhas.push('Em qualquer caso, o auxílio-reclusão **termina com a soltura**, a fuga, a progressão para regime aberto, o livramento condicional ou a prisão domiciliar.');
    du.linhas.push('A duração da cota do cônjuge/companheiro segue as regras da pensão por morte (art. 77, § 2º), contadas da prisão: confira a norma interna do INSS.');
    res.tabela = tabela;

    // ----- Início do benefício -----
    var req = lerData(entrada.requerimento);
    var menor16 = nasc && idade !== null && idade < 16 && !inval;
    var prazoDias = menor16 ? 180 : 90;
    var ini = { dib: prisao, prazoDias: prazoDias, linhas: [] };
    res.inicio = ini;
    ini.linhas.push('Se o pedido for feito em até ' + prazoDias + ' dias da prisão' + (menor16 ? ' (180 dias para menor de 16 anos)' : '') + ' (até ' + rot(dObj(prisao.ord + prazoDias)) + '), o benefício conta da **prisão**. Depois disso, conta do **requerimento** (art. 80 c/c art. 74).');
    if (req) {
      if (req.ord <= prisao.ord + prazoDias) ini.linhas.push('Requerimento em ' + rot(req) + ': dentro do prazo, início na data da prisão.');
      else { ini.dib = req; ini.linhas.push('Requerimento em ' + rot(req) + ': fora do prazo, início na data do requerimento, sem retroativo à prisão.'); }
      if (soltura && req.ord > soltura.ord) ini.linhas.push('O requerimento é posterior à soltura (' + rot(soltura) + '): se o benefício começar no requerimento, **não há período a receber**. Se começar na prisão, só é devido o período em que esteve preso.');
    } else ini.linhas.push('Requerimento não informado: foi considerado dentro do prazo.');
    ini.linhas.push('Prescrição quinquenal das parcelas. Não corre prescrição contra menor de 16 anos.');

    // ----- Valor -----
    var mesVal = mp;
    var mn = C.minimoDe(mesVal);
    res.valor = { calculado: !!mn, mensal: mn || null, linhas: [mn ? 'Benefício de **um salário mínimo** (' + dinheiro(mn) + ' em ' + rotMes(mesVal) + '), valor fixado pela EC 103/2019. O valor é **dividido igualmente entre os dependentes** habilitados (não é pago por dependente) e acompanha o salário mínimo vigente.' : 'Salário mínimo da época não cadastrado: confira o valor.'] };

    // ----- Conclusão -----
    var pend = [];
    base.cnis.filter(function (x) { return x.impede; }).forEach(function (x) { pend.push(x.achado + ' ' + x.documento + '.'); });
    d.linhas.forEach(function (x) { if (/^Informe /.test(x)) pend.push(x); });
    if (du.indeterminada && pend.indexOf(du.linhas[0]) < 0 && /^Informe/.test(du.linhas[0] || '')) pend.push(du.linhas[0]);
    if (d.pericia && d.apto) pend.push('Invalidez ou deficiência: comprovar em perícia médica do INSS.');
    if (rendaOk === null || (!n && !rendaExcede)) pend.push('Renda: ' + (n ? 'conferir o limite do ano.' : 'comprovar a ausência de renda.'));
    var conc, resumoDur = du.rotulo ? ' Duração: ' + du.rotulo.toLowerCase() + '.' : '';
    if (foraEscopo) conc = { status: 'incompleta', rotulo: 'Fora do alcance desta verificação', texto: 'Prisões anteriores a 18/01/2019 seguem regras anteriores. Confira a norma da época.' };
    else if (!regimeOk) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: regime de cumprimento da pena', texto: 'Desde 18/01/2019 o auxílio-reclusão só é devido ao dependente de segurado preso em regime fechado (ou preso provisório).' };
    else if (!qOk) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: qualidade de segurado', texto: 'Os dados do CNIS não demonstram a qualidade de segurado na data da prisão. Não é conclusão definitiva: outras provas podem mudar o resultado.' };
    else if (!car.ok) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: carência', texto: 'O CNIS mostra ' + car.total + ' contribuição(ões) válida(s)' + (car.perda && car.total >= 24 ? ', mas houve perda da qualidade e depois do retorno há ' + car.depoisDoRetorno + ' (mínimo de 12)' : '') + '; a carência do auxílio-reclusão é de 24. Documentos que completem a carência podem mudar o resultado.' };
    else if (rendaExcede) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: renda acima do limite', texto: 'A média dos salários de contribuição (' + dinheiro(media) + ') passa do limite de ' + dinheiro(limite) + '. Pelo critério administrativo, não há direito.' };
    else if (incompat.length) conc = { status: 'nao_demonstrado', rotulo: 'Segurado em gozo de benefício incompatível', texto: 'O CNIS mostra benefício em gozo na data da prisão, o que impede o auxílio-reclusão. Confira se o benefício já havia cessado.' };
    else if (!d.apto) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: dependente', texto: 'O dependente informado não se enquadra no art. 16 da Lei 8.213/91 pelos dados informados.' };
    else if (precisaEcon && !entrada.economica) conc = { status: 'depende', rotulo: 'Depende da prova de dependência econômica', texto: 'Pais e irmãos precisam comprovar a dependência econômica do segurado, e só recebem se não houver dependente de classe anterior.' + resumoDur };
    else if (d.pericia) conc = { status: 'depende', rotulo: 'Depende da perícia médica', texto: 'Os requisitos do segurado estão compatíveis com o CNIS, mas a invalidez ou deficiência do dependente precisa ser comprovada em perícia médica.' + resumoDur };
    else if (q.status === 'confirmada' && !pend.length && n && !ativosEmpr.length) conc = { status: 'provavel', rotulo: 'Direito provável', texto: 'Qualidade de segurado, carência de 24 contribuições e baixa renda estão compatíveis com o CNIS. Falta comprovar a prisão em regime fechado, a relação com o dependente e a ausência de remuneração.' + resumoDur };
    else conc = { status: 'depende', rotulo: 'Direito depende de validação documental', texto: 'Os requisitos são compatíveis com o CNIS, mas há pontos a validar antes de concluir.' + resumoDur };
    conc.pendencias = pend;
    res.conclusao = conc;
    docs.forEach(function (t) { res.documentos.push(t); });
    return res;
  }

  // ===================== AUXÍLIO POR INCAPACIDADE TEMPORÁRIA =====================

  function auxilioIncapacidade(analise, entrada, hoje) {
    var res = {
      beneficio: 'auxilio-incapacidade-temporaria', titulo: 'auxílio por incapacidade temporária', normas: N_INCAP, entrada: entrada,
      regras: [
        '**Carência de 12 contribuições** (art. 25, I), exceto acidente de qualquer natureza, doença profissional ou do trabalho e doenças graves da lista oficial (art. 26, II).',
        '**Qualidade de segurado na data de início da incapacidade (DII)**, e não na data do requerimento.',
        '**Incapacidade anterior à filiação não dá direito**, salvo progressão ou agravamento posterior (art. 59, parágrafo único).',
        '**A incapacidade para o trabalho por mais de 15 dias é confirmada em perícia médica**: o CNIS só mostra os requisitos de qualidade e carência.'
      ],
      fato: { rotulo: 'Data de início da incapacidade (DII)', data: null, notas: [] }, qualidade: null, categoria: null, carencia: null, requisitos: [], dependente: null, duracao: null,
      inicio: null, cnis: [], valor: null, documentos: [], conclusao: null
    };
    var docs = [];
    function doc(t) { if (docs.indexOf(t) < 0) docs.push(t); }
    var dii = lerData(entrada.dii);
    if (!dii) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data de início da incapacidade (DII).', pendencias: ['Informar a data de início da incapacidade.'] };
      res.documentos = ['Atestados, laudos e exames que indiquem a data de início da incapacidade'];
      return res;
    }
    var hojeD = lerData(hoje) || hoje;
    if (hojeD.ord === undefined) hojeD = mk(hojeD.y, hojeD.m, hojeD.d);
    res.fato.data = dii;
    if (dii.ord > hojeD.ord) res.fato.notas.push('A DII está no futuro: o resultado é uma simulação.');
    doc('Atestados, laudos e exames médicos com CID e a indicação do tempo de afastamento');
    doc('Documentos de identificação e CPF');

    var base = qualidadeEm(analise, entrada, dii, hojeD);
    res.qualidade = base.qualidade; res.categoria = base.categoria; res.cnis = base.cnis;
    var q = base.qualidade, qOk = qualOk(q);
    var usada = base.categoria && base.categoria.usada;
    var classeCar = usada === 'desempregada' || !usada ? (q.graca ? q.graca.classe : null) : usada;
    res.fato.notas.push('A qualidade de segurado é conferida na **DII**, não na data do requerimento. Se a incapacidade começou dentro do período de graça, há direito mesmo que o pedido seja posterior ao fim dele.');

    // ----- Carência e dispensas -----
    var origem = entrada.origem || 'comum';
    var especial = classeCar === 'especial';
    var dispensada = origem === 'acidente' || origem === 'doenca_lista';
    var car = carenciaEm(analise, entrada, base, dii, 12);
    var carLinhas = [];
    var carOk;
    if (origem === 'acidente') carLinhas.push('Incapacidade decorrente de **acidente de qualquer natureza ou causa, ou doença profissional/do trabalho**: carência **dispensada** (art. 26, II). Exige filiação ao RGPS e qualidade de segurado na DII. Para acidente de trabalho, comunicar com a CAT.');
    else if (origem === 'doenca_lista') carLinhas.push('Doença grave da lista oficial (art. 26, II e art. 151, atualizada por Portaria Interministerial): carência **dispensada**. Confira se o CID consta da lista vigente na DII e se há conclusão da medicina especializada.');
    if (especial) { carLinhas.push('Segurado especial: sem contribuições, mas precisa comprovar **12 meses de atividade rural** no período imediatamente anterior ao requerimento, ainda que de forma descontínua (art. 39, I). O CNIS pode não trazer isso.'); doc('Autodeclaração e documentos da atividade rural nos 12 meses anteriores ao requerimento'); }
    if (dispensada || especial) { carOk = true; carLinhas.push('Contribuições válidas do CNIS até ' + rotMes(mesOrd(dii)) + ': **' + car.total + '** (informativo).'); }
    else { carOk = car.ok; car.linhas.forEach(function (l) { carLinhas.push(l); }); if (!carOk) doc('Guias de recolhimento e provas de atividade que completem a carência, se não constarem do CNIS'); }
    carLinhas.push('Dispensar a carência não dispensa a filiação ao RGPS nem a qualidade de segurado na DII.');
    res.carencia = { status: dispensada || especial ? 'dispensada' : (carOk ? 'cumprida' : 'nao_cumprida'), rotulo: dispensada ? 'Dispensada' : (especial ? 'Dispensada, com prova de atividade rural' : (carOk ? 'Cumprida pelos dados do CNIS' : 'Não cumprida pelos dados do CNIS')), linhas: carLinhas };

    // ----- Incapacidade anterior à filiação -----
    var pre = entrada.preexistente || 'nao';
    var preBloqueia = pre === 'sim';
    var rp = [];
    if (pre === 'nao') rp.push('A incapacidade começou **depois** da filiação ou refiliação: sem impedimento por doença preexistente. A data de início (DII) é fixada pela perícia médica: se for anterior à filiação, o benefício é negado.');
    if (pre === 'sim') rp.push('A doença ou lesão já existia quando o segurado se filiou (ou se refiliou), sem agravamento posterior: **não há direito** (art. 59, parágrafo único, e art. 42, § 2º).');
    if (pre === 'agravamento') { rp.push('A doença já existia na filiação, mas **progrediu ou se agravou** depois: há direito, com DII na data do agravamento. A perícia médica precisa fixar essa data.'); doc('Laudos que mostrem o agravamento ou a progressão da doença depois da filiação'); }
    res.requisitos.push({ titulo: 'Incapacidade anterior à filiação', linhas: rp });

    // ----- Benefícios em gozo e outros impedimentos -----
    var imp = [];
    var apos = beneficioEmGozo(analise, dii.ord, /APOSENT/i);
    if (apos.length) imp.push('O CNIS mostra aposentadoria em gozo na DII (NB ' + apos.map(function (b) { return b.nb || 's/n'; }).join(', ') + '). O aposentado não recebe auxílio por incapacidade temporária; em geral só há direito a uma nova atividade, e não ao benefício acumulado com a aposentadoria.');
    var mesmo = beneficioEmGozo(analise, dii.ord, /AUX[IÍ]LIO[ -]DOEN|INCAPACIDADE TEMPOR/i);
    if (mesmo.length) imp.push('Já havia auxílio por incapacidade temporária em gozo na DII (NB ' + mesmo.map(function (b) { return b.nb || 's/n'; }).join(', ') + '): o caso é de prorrogação ou pedido de reconsideração, não de novo benefício.');
    if (imp.length) res.requisitos.push({ titulo: 'Benefícios em gozo na DII', linhas: imp });

    // ----- Início do benefício -----
    var afD = lerData(entrada.afastamento);
    if (afD && afD.ord < dii.ord) { res.fato.notas.push('O afastamento é anterior à DII; foi mantido, mas a perícia pode fixar outra data.'); }
    var afast = afD || dii;
    var req = lerData(entrada.requerimento);
    var ehEmpregado = usada === 'empregada';
    var ini = { dib: null, linhas: [] };
    res.inicio = ini;
    var dibBase = ehEmpregado ? dObj(afast.ord + 15) : dii;
    ini.linhas.push(ehEmpregado
      ? 'Empregado (exceto doméstico): a empresa paga os **15 primeiros dias**; o benefício conta do **16º dia** do afastamento (' + rot(dibBase) + ').'
      : 'Demais segurados (inclusive doméstico, contribuinte individual, facultativo e desempregado em período de graça): o benefício conta do **início da incapacidade** (' + rot(dibBase) + ').');
    if (req) {
      if (req.ord - afast.ord > 30) { ini.dib = req; ini.linhas.push('Requerimento em ' + rot(req) + ', mais de **30 dias** depois do afastamento: o benefício conta da **data do requerimento**, sem retroativo (art. 60, § 1º).'); }
      else { ini.dib = dibBase; ini.linhas.push('Requerimento em ' + rot(req) + ', em até 30 dias do afastamento: início na data acima.'); }
    } else { ini.dib = dibBase; ini.linhas.push('Requerimento não informado: foi considerado dentro de 30 dias do afastamento.'); }
    ini.linhas.push('O benefício dura **enquanto o segurado permanecer incapaz**. A perícia fixa a data de cessação (DCB) ou o pedido de prorrogação. Quando a incapacidade é permanente, passa a ser aposentadoria por incapacidade permanente.');
    ini.linhas.push('Prescrição quinquenal das parcelas.');

    // ----- Valor -----
    var dibOrd = ini.dib ? ini.dib.ord : dii.ord;
    res.valor = { calculado: false, linhas: [
      'Não calculado nesta versão: exige correção monetária das remunerações desde 07/1994, que o CNIS não traz.',
      dibOrd >= C.ordemDe(2019, 11, 13)
        ? 'Para benefício com início desde 13/11/2019: **91% da média de todos os salários de contribuição desde 07/1994** (EC 103/2019, art. 26, e Lei 8.213/91, art. 61), com piso de um salário mínimo e limitado à média dos últimos 12 salários de contribuição (art. 29, § 10).'
        : 'Para benefício com início antes de 13/11/2019: **91% da média dos 80% maiores salários de contribuição desde 07/1994** (Leis 9.876/99 e 8.213/91, art. 61), com piso de um salário mínimo e limitado à média dos últimos 12 salários de contribuição.',
      'Salário mínimo na DII: ' + (C.minimoDe(mesOrd(dii)) ? dinheiro(C.minimoDe(mesOrd(dii))) : 'não cadastrado') + '. Segurado especial recebe um salário mínimo.'
    ] };

    // ----- Conclusão -----
    var pend = [];
    base.cnis.filter(function (x) { return x.impede; }).forEach(function (x) { pend.push(x.achado + ' ' + x.documento + '.'); });
    var conc;
    if (!qOk) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: qualidade de segurado na DII', texto: 'Os dados do CNIS não demonstram a qualidade de segurado na data de início da incapacidade. Não é conclusão definitiva: outras provas e a DII fixada pela perícia podem mudar o resultado.' };
    else if (preBloqueia) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: incapacidade anterior à filiação', texto: 'A incapacidade já existia ao se filiar, sem agravamento posterior: o benefício é negado (art. 59, parágrafo único).' };
    else if (!carOk) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: carência', texto: 'O CNIS mostra ' + car.total + ' contribuição(ões) válida(s)' + (car.perda && car.total >= 12 ? ', mas houve perda da qualidade e depois do retorno há ' + car.depoisDoRetorno + ' (mínimo de 6)' : '') + '; a carência é de 12, salvo acidente ou doença da lista. Documentos que completem a carência podem mudar o resultado.' };
    else if (apos.length) conc = { status: 'nao_demonstrado', rotulo: 'Segurado em gozo de aposentadoria', texto: 'O CNIS mostra aposentadoria em gozo na DII, o que em regra impede o auxílio por incapacidade temporária. Confira se a aposentadoria já havia cessado.' };
    else conc = { status: 'depende', rotulo: 'Depende da perícia médica', texto: 'Qualidade de segurado' + (dispensada ? '' : ' e carência') + ' estão compatíveis com o CNIS' + (q.status === 'confirmada' ? '' : ', com pontos a validar') + '. A incapacidade para o trabalho por mais de 15 dias e a DII precisam ser confirmadas pela perícia médica do INSS.' };
    pend.push('Incapacidade e DII: comprovar em perícia médica do INSS.');
    conc.pendencias = pend;
    res.conclusao = conc;
    docs.forEach(function (t) { res.documentos.push(t); });
    if (origem === 'acidente') res.documentos.push('CAT (comunicação de acidente de trabalho), se for o caso, e boletim de ocorrência ou documento que comprove o acidente');
    if (ehEmpregado) res.documentos.push('Atestado médico e comprovante do afastamento, para a empresa pagar os 15 primeiros dias');
    return res;
  }

  // ---------- Interface ----------

  function negrito(el, texto) {
    texto.split('**').forEach(function (parte, i) {
      if (!parte) return;
      if (i % 2) el.appendChild(C.el('strong', null, parte)); else el.appendChild(document.createTextNode(parte));
    });
    return el;
  }
  function lista(itens) {
    var ul = C.el('ul', 'lista-simples');
    itens.forEach(function (t) { ul.appendChild(negrito(C.el('li'), t)); });
    return ul;
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
    if (c.pendencias && c.pendencias.length) {
      caixa.appendChild(C.el('p', 'dica', 'Para concluir:'));
      caixa.appendChild(lista(c.pendencias.slice(0, 8)));
    }
    topo.appendChild(caixa);
    if (!r.fato.data) return topo;

    var n = 1;
    var q = r.qualidade;
    var s1 = C.sec(n++ + '. Qualidade de segurado' + (r.beneficio === 'auxilio-reclusao' ? ' na data da prisão' : ' na DII') + ' (' + rot(r.fato.data) + ')');
    var sel = C.el('p', 'selo-linha'); sel.appendChild(C.el('span', 'selo selo-' + q.status, q.rotulo));
    s1.appendChild(sel);
    s1.appendChild(lista(r.fato.notas.concat(r.categoria && r.categoria.motivo ? [r.categoria.motivo] : [], q.linhas)));
    if (q.graca) {
      var g = q.graca;
      s1.appendChild(C.tabela(['Item', 'Valor'], [
        ['Data inicial usada', g.dataInicial], ['Categoria considerada', g.categoria], ['Prazo-base', g.prazoBase + ' meses'],
        ['Qualidade mantida até (prazo-base)', rot(g.ateBase)],
        ['Com prorrogação de 24 meses', g.ateComExtensao ? rot(g.ateComExtensao) : 'não se aplica'],
        ['Com seguro-desemprego/SINE', g.ateComDesemprego ? rot(g.ateComDesemprego) : 'não se aplica']
      ]));
    }
    topo.appendChild(s1);

    var s2 = C.sec(n++ + '. Carência');
    var sc = C.el('p', 'selo-linha'); sc.appendChild(C.el('span', 'selo selo-' + (r.carencia.status === 'nao_cumprida' ? 'nao_demonstrada' : 'confirmada'), r.carencia.rotulo));
    s2.appendChild(sc); s2.appendChild(lista(r.carencia.linhas));
    topo.appendChild(s2);

    r.requisitos.forEach(function (rq) {
      var s = C.sec(n++ + '. ' + rq.titulo);
      s.appendChild(lista(rq.linhas));
      topo.appendChild(s);
    });

    if (r.dependente) {
      var s3 = C.sec(n++ + '. Dependente: ' + r.dependente.rotulo);
      s3.appendChild(lista(r.dependente.linhas.length ? r.dependente.linhas : ['Sem observações.']));
      topo.appendChild(s3);
      var du = r.duracao;
      var s4 = C.sec(n++ + '. Duração do benefício');
      var sd = C.el('p', 'selo-linha'); sd.appendChild(C.el('span', 'selo selo-' + (du.indeterminada ? 'indeterminada' : 'confirmada'), du.rotulo || '—'));
      s4.appendChild(sd);
      if (du.texto) s4.appendChild(C.el('p', null, du.texto));
      s4.appendChild(lista(du.linhas));
      if (r.tabela && du.regra === 'idade') {
        s4.appendChild(C.el('p', 'dica', 'Tabela por idade na data da prisão (' + (r.tabela.nome === '2021' ? 'Portaria ME 424/2020' : 'Lei 13.135/2015') + '). A faixa do dependente está em destaque.'));
        s4.appendChild(C.tabela(['Idade na data da prisão', 'Duração'], r.tabela.linhas.map(function (f) {
          return [f[1] + (r.tabela.destaque === f[1] ? ' ◀ este caso' : ''), f[2] === null ? 'Vitalícia (enquanto preso)' : f[2] + ' anos'];
        })));
      }
      topo.appendChild(s4);
    }

    var s5 = C.sec(n++ + '. Início do benefício');
    s5.appendChild(C.el('p', null, 'Início considerado: ' + rot(r.inicio.dib) + '.'));
    s5.appendChild(lista(r.inicio.linhas));
    topo.appendChild(s5);

    var s6 = C.sec(n++ + '. Validade do CNIS');
    if (r.cnis.length) s6.appendChild(C.tabela(['O que foi encontrado', 'Impacto', 'Documento', 'Impede conclusão segura?', 'Providência'], r.cnis.map(function (x) { return [x.achado, x.impacto, x.documento, x.impede ? 'Sim, até validar' : 'Não', x.providencia]; })));
    else s6.appendChild(C.el('p', 'vazio-msg', 'Nenhuma inconsistência relevante para esta conclusão.'));
    topo.appendChild(s6);

    var s7 = C.sec(n++ + '. Valor');
    s7.appendChild(lista(r.valor.linhas));
    topo.appendChild(s7);

    var s8 = C.sec('Documentos a reunir');
    s8.appendChild(lista(r.documentos));
    topo.appendChild(s8);

    var s9 = C.sec('Normas usadas');
    s9.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (x) { return [x.nome, x.vigencia]; })));
    topo.appendChild(s9);
    return topo;
  }

  function lerCamposReclusao() {
    var g = function (id) { return document.getElementById(id); };
    var dep = g('ar-dependente').value, par = dep === 'conjuge' || dep === 'companheiro';
    return {
      prisao: g('ar-prisao').value, regime: g('ar-regime').value, soltura: g('ar-soltura').value, dependente: dep,
      nascimento: g('ar-nasc').value, uniao: par ? g('ar-uniao').value : '', requerimento: g('ar-req').value,
      invalido: g('ar-invalido').checked, economica: g('ar-economica').checked, desemprego: g('dir-desemprego').checked
    };
  }
  function lerCamposIncapacidade() {
    var g = function (id) { return document.getElementById(id); };
    return {
      dii: g('ai-dii').value, afastamento: g('ai-afast').value, requerimento: g('ai-req').value, origem: g('ai-origem').value,
      preexistente: g('ai-pre').value, desemprego: g('dir-desemprego').checked
    };
  }

  var api = {
    auxilioReclusao: auxilioReclusao, auxilioIncapacidade: auxilioIncapacidade, renderizar: renderizar,
    lerCamposReclusao: lerCamposReclusao, lerCamposIncapacidade: lerCamposIncapacidade, LIMITE_RENDA: LIMITE_RENDA
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BENEFICIOS = api;
})(typeof window !== 'undefined' ? window : globalThis);
