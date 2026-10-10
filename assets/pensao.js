// Verificação de direito à pensão por morte (Lei 8.213/91, arts. 16, 74 e 77). Roda no navegador, sem enviar dados.
// Depende de assets/cnis.js e assets/direito.js (qualidade de segurado na data do óbito).
(function (root) {
  'use strict';
  var C = root.CNIS || (typeof require !== 'undefined' ? require('./cnis.js') : null);
  var D = root.DIREITO || (typeof require !== 'undefined' ? require('./direito.js') : null);

  var NORMAS = [
    { nome: 'Lei 8.213/91, art. 16 (dependentes), art. 74 (início do benefício) e art. 77 (cotas e duração)', vigencia: 'Redação da Lei 13.135/2015 (vigência: 18/06/2015) e Lei 13.846/2019; confira o texto compilado no Planalto.' },
    { nome: 'Portaria ME 424, de 29/12/2020 (idades da duração da pensão do cônjuge/companheiro)', vigencia: 'Vigência a partir de 01/01/2021, para óbitos desde essa data (art. 77, § 2º-B). Confira se há portaria posterior.' },
    { nome: 'Faixas anteriores (Lei 13.135/2015): 21, 27, 30, 41 e 44 anos', vigencia: 'Para óbitos de 01/03/2015 a 31/12/2020 (marco do art. 375 da IN 128/2022). A faixa das idades pode ser atualizada a cada 3 anos (art. 375, § 8º).' },
    { nome: 'IN PRES/INSS 128/2022, arts. 178 e 180 (dependentes e provas), 368 (óbito após perda da qualidade), 369 a 370 (efeitos financeiros, com o art. 369-A da IN 212/2026), 372 a 374 (cônjuge e companheiro) e 375 (duração)', vigencia: 'Texto conferido em 10/10/2026 no material fornecido. Prazos do art. 369 valem para óbitos desde 18/01/2019 (Lei 13.846/2019); o art. 375 vale para óbitos desde 01/03/2015.' },
    { nome: 'Lei 8.213/91, art. 15 (qualidade de segurado) e art. 102, § 2º (direito adquirido)', vigencia: 'Texto compilado; confira a versão vigente. Na IN 128/2022, art. 368.' }
  ];

  // Tabelas de duração por idade na data do óbito: [idade mínima, rótulo da faixa, duração em anos (null = vitalícia)]
  var TABELA_2021 = [[0, 'Menos de 22 anos', 3], [22, '22 a 27 anos', 6], [28, '28 a 30 anos', 10], [31, '31 a 41 anos', 15], [42, '42 a 44 anos', 20], [45, '45 anos ou mais', null]];
  var TABELA_2015 = [[0, 'Menos de 21 anos', 3], [21, '21 a 26 anos', 6], [27, '27 a 29 anos', 10], [30, '30 a 40 anos', 15], [41, '41 a 43 anos', 20], [44, '44 anos ou mais', null]];

  var DEPENDENTES = {
    conjuge: { rotulo: 'Cônjuge', classe: 1, par: true },
    companheiro: { rotulo: 'Companheiro(a)', classe: 1, par: true },
    ex_conjuge: { rotulo: 'Ex-cônjuge ou ex-companheiro(a) com pensão alimentícia', classe: 1, par: true, alimentos: true },
    filho: { rotulo: 'Filho ou equiparado', classe: 1 },
    filho_maior_invalido: { rotulo: 'Filho maior inválido ou com deficiência', classe: 1 },
    pai_mae: { rotulo: 'Pai ou mãe', classe: 2 },
    irmao: { rotulo: 'Irmão(ã)', classe: 3 }
  };

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

  function pensaoPorMorte(analise, entrada, hoje) {
    var res = {
      beneficio: 'pensao-por-morte', normas: NORMAS, entrada: entrada, obito: null, qualidade: null, categoria: null, contribuicoes: null,
      dependente: null, duracao: null, inicio: null, cnis: [], documentos: [], valor: null, conclusao: null, tabela: null
    };
    var obito = lerData(entrada.obito);
    var dep = DEPENDENTES[entrada.dependente] || DEPENDENTES.conjuge;
    var maiorInvalido = entrada.dependente === 'filho_maior_invalido';
    var tipoDep = maiorInvalido ? 'filho' : (DEPENDENTES[entrada.dependente] ? entrada.dependente : 'conjuge');
    res.dependente = { tipo: tipoDep, rotulo: dep.rotulo, classe: dep.classe, linhas: [], apto: true };
    var docs = [];
    function doc(t) { if (docs.indexOf(t) < 0) docs.push(t); }
    if (!obito) {
      res.conclusao = { status: 'incompleta', rotulo: 'Análise incompleta', texto: 'Informe a data do óbito.', pendencias: ['Informar a data do óbito.'] };
      res.documentos = ['Certidão de óbito'];
      return res;
    }
    doc('Certidão de óbito');
    var hojeD = lerData(hoje) || hoje;
    if (hojeD.ord === undefined) hojeD = mk(hojeD.y, hojeD.m, hojeD.d);
    res.obito = { data: obito, notas: [] };
    if (obito.ord > hojeD.ord) res.obito.notas.push('O óbito está no futuro: o resultado é uma simulação.');

    // ----- Qualidade do segurado na data do óbito (mesmo módulo de período de graça do salário-maternidade) -----
    var base = D.salarioMaternidade(analise, { tipo: 'outro', data: obito, categoria: 'auto', desemprego: !!entrada.desemprego, _sub: true, _semCarencia: true }, hojeD);
    res.qualidade = base.qualidade;
    res.categoria = base.categoria;
    res.cnis = base.cnis;
    var q = base.qualidade;
    var qualOk = ['confirmada', 'provavel', 'indeterminada'].indexOf(q.status) >= 0;
    if (!qualOk) {
      q.linhas.push('Sem qualidade demonstrada na data do óbito, a pensão ainda é devida se (art. 368 da IN 128/2022): I) o segurado já tinha cumprido todos os requisitos de uma aposentadoria até a data do óbito; ou II) ficar reconhecido, dentro do período de graça, o direito à aposentadoria por incapacidade permanente, com incapacidade existente até o óbito confirmada pela Perícia Médica Federal. Isso exige documentos e perícia fora do CNIS.');
      doc('Documentos que provem os requisitos de aposentadoria até o óbito, ou incapacidade permanente dentro do período de graça (para a Perícia Médica Federal)');
    }
    doc('Documentos de identificação e CPF do segurado falecido e do dependente');

    // ----- Contribuições (só servem para a duração da pensão do cônjuge/companheiro) -----
    var validas = base.carencia ? base.carencia.competenciasValidas : 0;
    var antes94 = analise.carencia ? analise.carencia.mesesAntes94 : 0;
    var total = validas + antes94;
    var aposentado = analise.beneficios.filter(function (b) {
      return b.inicio && b.inicio.ord <= obito.ord && (!b.fim || b.fim.ord >= obito.ord) && /APOSENT/i.test(b.texto || '') && !/INCAPACIDADE|INVALIDEZ/i.test(b.texto || '');
    })[0];
    res.contribuicoes = { total: total, doCnis: validas, antes94: antes94, tem18: total >= 18 || !!aposentado, aposentado: !!aposentado };

    // ----- Dependente -----
    var nasc = lerData(entrada.nascimento);
    var idadeObito = nasc ? idadeEm(nasc, obito) : null;
    var inval = !!entrada.invalido || maiorInvalido;
    var d = res.dependente;
    d.idadeNoObito = idadeObito;
    if (dep.classe === 1) d.linhas.push('Classe I: a dependência econômica é presumida (art. 16, § 4º).');
    else d.linhas.push('Classe ' + (dep.classe === 2 ? 'II' : 'III') + ': a dependência econômica precisa ser comprovada (art. 16, § 4º).' + (dep.classe === 2 ? ' Só recebem pais se não houver dependente de classe I.' : ' Só recebem irmãos se não houver dependente das classes I e II.') + ' A dependência pode ser parcial ou total, mas precisa ser permanente (art. 178, § 2º).');
    var precisaEcon = dep.classe !== 1 || !!dep.alimentos;
    if (dep.alimentos) d.linhas.push('Ex-cônjuge ou ex-companheiro(a) só tem direito se recebia pensão alimentícia, ou ajuda econômica ou financeira sob qualquer forma (art. 373 e § 1º). A comprovação do casamento ou união deve ser imediatamente anterior à separação (art. 375, § 1º). Se o falecido pagava alimentos temporários por decisão judicial ou acordo, a pensão dura o prazo restante fixado, para óbitos desde 18/01/2019 (art. 373, § 2º). A pensão pode ser paga em conjunto com a do cônjuge ou companheiro(a) atual (art. 372).');
    if (precisaEcon) {
      if (!entrada.economica) d.linhas.push('Dependência econômica não marcada como comprovada: sem ela não há direito' + (dep.alimentos ? ' (recebimento de alimentos ou ajuda financeira).' : '.'));
      doc('Provas da dependência econômica do dependente em relação ao segurado');
    }
    var parceiro = !!dep.par;
    var uniao = lerData(entrada.uniao);
    if (parceiro) {
      doc(tipoDep === 'conjuge' ? 'Certidão de casamento' : 'Prova da união estável (art. 180 da IN 128/2022): duas provas materiais contemporâneas, ao menos uma produzida em até 24 meses antes do óbito; só testemunha não basta. Com um único documento nesse período, é possível justificação administrativa');
      if (tipoDep === 'conjuge') d.linhas.push('Se o casal estava separado de fato, só há direito com a prova do restabelecimento do vínculo, sem usar a certidão de casamento (art. 374).');
      if (!uniao) d.linhas.push('Informe a data de início do casamento ou da união estável: ela define se a pensão dura 4 meses.');
      else if (uniao.ord > obito.ord) { d.linhas.push('A data de início da união é posterior ao óbito: confira.'); }
    }
    if (dep.classe === 1 && !parceiro || tipoDep === 'irmao') {
      if (!nasc) { if (!inval) d.linhas.push('Informe a data de nascimento para calcular até quando dura a pensão.'); }
      else if (idadeObito >= 21 && !inval) { d.apto = false; d.linhas.push('Tinha ' + idadeObito + ' anos no óbito: com 21 anos ou mais e sem invalidez ou deficiência grave, não é dependente (art. 16, I e III).'); }
      else if (inval) d.linhas.push('Inválido ou com deficiência grave: sem limite de idade enquanto durar a condição (reavaliação periódica).');
      if (inval) doc('Laudo médico de invalidez ou deficiência grave, anterior ao óbito');
      if (tipoDep === 'filho') doc('Certidão de nascimento do filho' + ' (e documentos de equiparação, se enteado ou menor sob tutela)');
      else doc('Certidão de nascimento do irmão e de vínculo com o segurado');
    }
    if (tipoDep === 'pai_mae') doc('Certidão de nascimento do segurado (prova do parentesco)');
    if (parceiro && inval) { d.linhas.push('Cônjuge ou companheiro inválido ou com deficiência: a pensão dura enquanto durar a condição, respeitados os períodos mínimos abaixo (art. 77, § 2º, V, a).'); doc('Laudo médico de invalidez ou deficiência'); }

    if (inval) {
      d.pericia = true;
      d.linhas.push('**A invalidez ou a deficiência precisa ser comprovada em perícia médica** (INSS), com laudos e exames. A condição deve existir na data do óbito (confira na norma se vale também a anterioridade aos 21 anos). Sem a perícia, a pensão de filho ou irmão maior de 21 anos não é concedida.');
      doc('Laudos e exames médicos que comprovem a invalidez ou deficiência, para a perícia médica do INSS');
    }
    if (maiorInvalido && nasc && idadeObito < 21) d.linhas.push('Tinha ' + idadeObito + ' anos no óbito: a condição de inválido não era necessária para ser dependente nessa idade, mas garante a pensão após os 21 anos.');

    // ----- Duração -----
    var du = { rotulo: null, texto: '', anos: undefined, meses: null, vitalicia: false, fim: null, indeterminada: false, linhas: [], regra: null };
    res.duracao = du;
    var tab = null;
    if (obito.ord >= C.ordemDe(2021, 1, 1)) { tab = TABELA_2021; du.tabela = '2021'; }
    else if (obito.ord >= C.ordemDe(2015, 3, 1)) { tab = TABELA_2015; du.tabela = '2015'; }
    res.tabela = tab ? { nome: du.tabela, linhas: tab } : null;

    if (parceiro) {
      var anosUniao = uniao && uniao.ord <= obito.ord ? idadeEm(uniao, obito) : null;
      var excecao = !!entrada.acidente;
      du.linhas.push('Contribuições mensais do segurado até o óbito: **' + total + '** (' + validas + ' competências do CNIS de 07/1994 em diante + ' + antes94 + ' mês(es) de vínculo anteriores, presumidos). Tempo de RPPS também conta (art. 77, § 5º). Mínimo para a duração maior: 18.');
      if (aposentado) du.linhas.push('O segurado estava em gozo de aposentadoria (exceto por incapacidade permanente): **não é preciso apurar as 18 contribuições**, pois a aposentadoria já exigiu pelo menos 60 (art. 375, § 3º).');
      if (anosUniao !== null) du.linhas.push('Tempo de casamento ou união estável até o óbito: ' + anosUniao + ' ano(s) completo(s). Mínimo para a duração maior: 2 anos.');
      if (!tab) {
        du.indeterminada = true; du.rotulo = 'Fora desta verificação';
        du.texto = 'Óbito antes de 01/03/2015: aplicam-se regras anteriores à MP 664/2014 e à Lei 13.135/2015 (em regra, pensão vitalícia para o cônjuge). Confira a norma da época.';
      } else if (excecao) {
        du.regra = 'idade';
        du.linhas.push('Óbito por acidente de qualquer natureza ou doença profissional/do trabalho: **não se exige** 18 contribuições nem 2 anos de união; vale a tabela por idade (art. 77, § 2º-A).');
      } else if (!res.contribuicoes.tem18) { du.regra = 'quatro'; du.linhas.push('Menos de 18 contribuições: pensão de **4 meses**, mesmo que o direito exista (a regra de 18 só define a duração).'); }
      else if (anosUniao === null) { du.indeterminada = true; }
      else if (anosUniao < 2) { du.regra = 'quatro'; du.linhas.push('Menos de 2 anos de casamento ou união estável: pensão de **4 meses**.'); }
      else du.regra = 'idade';

      if (du.regra === 'quatro') {
        du.meses = 4; du.rotulo = '4 meses';
        du.fim = somar(obito, 0, 4);
        du.texto = 'Dura exatamente 4 meses, contados da data do óbito.';
      } else if (du.regra === 'idade') {
        if (!nasc) { du.indeterminada = true; du.rotulo = 'Informe a data de nascimento'; du.texto = 'A duração depende da idade do dependente na data do óbito.'; }
        else {
          var faixa = null;
          tab.forEach(function (f) { if (idadeObito >= f[0]) faixa = f; });
          res.tabela.destaque = faixa[1];
          du.faixa = faixa[1];
          if (faixa[2] === null) { du.vitalicia = true; du.rotulo = 'Vitalícia'; du.texto = 'Idade de ' + idadeObito + ' anos no óbito (' + faixa[1].toLowerCase() + '): pensão vitalícia.'; }
          else { du.anos = faixa[2]; du.rotulo = faixa[2] + ' anos'; du.fim = somar(obito, faixa[2], 0); du.texto = 'Idade de ' + idadeObito + ' anos no óbito (' + faixa[1].toLowerCase() + '): ' + faixa[2] + ' anos, contados da data do óbito.'; }
        }
      } else if (du.indeterminada && !du.rotulo) {
        du.rotulo = 'Informe o início da união';
        du.texto = 'Sem a data de início do casamento ou da união estável não dá para saber se a pensão dura 4 meses ou a tabela por idade.';
      }
      if (inval && du.rotulo && !du.indeterminada) du.texto += ' Como o dependente é inválido ou com deficiência, depois desse período a pensão continua enquanto durar a condição.';
    } else if (tipoDep === 'filho' || tipoDep === 'irmao') {
      du.linhas.push('A regra de 18 contribuições e 2 anos **não se aplica** a ' + (tipoDep === 'filho' ? 'filhos' : 'irmãos') + '.');
      if (!d.apto) { du.rotulo = 'Sem direito'; du.texto = 'Não é dependente (idade de 21 anos ou mais no óbito, sem invalidez).'; }
      else if (inval) { du.rotulo = 'Sem limite de idade'; du.texto = 'Enquanto durar a invalidez ou a deficiência grave (reavaliação periódica).'; du.vitalicia = true; }
      else if (!nasc) { du.indeterminada = true; du.rotulo = 'Informe a data de nascimento'; du.texto = 'A pensão dura até o dependente completar 21 anos.'; }
      else { du.fim = somar(nasc, 21, 0); du.rotulo = 'Até os 21 anos'; du.texto = 'Dura até completar 21 anos, em ' + rot(du.fim) + '.'; }
    } else {
      du.linhas.push('A regra de 18 contribuições e 2 anos **não se aplica** a pais.');
      du.vitalicia = true; du.rotulo = 'Vitalícia'; du.texto = 'Pensão vitalícia, desde que comprovada a dependência econômica.';
    }

    // ----- Início do benefício (art. 74) -----
    var req = lerData(entrada.requerimento);
    var nascidoDepois = tipoDep === 'filho' && nasc && nasc.ord > obito.ord;
    var menor16 = nasc && idadeObito !== null && idadeObito < 16 && !inval; // inválidos e deficientes valem como maiores de 16 (art. 369, § 1º)
    var prazoDias = menor16 ? 180 : 90;
    var ini = { dib: obito, prazoDias: prazoDias, linhas: [] };
    res.inicio = ini;
    ini.linhas.push('Se o pedido for feito em até ' + prazoDias + ' dias do óbito' + (menor16 ? ' (180 dias para menor de 16 anos)' : '') + ' (até ' + rot(dObj(obito.ord + prazoDias)) + '), o benefício conta do **óbito**. Depois disso, conta do **requerimento**.');
    if (inval) ini.linhas.push('Dependente inválido ou com deficiência é equiparado a maior de 16 anos: prazo de 90 dias (art. 369, § 1º).');
    if (nascidoDepois) { ini.dib = nasc; ini.linhas.push('Filho nascido após o óbito: o benefício conta do **nascimento** (' + rot(nasc) + '), observados os prazos do art. 369 (art. 369-A, incluído pela IN 212/2026).'); }
    if (obito.ord < C.ordemDe(2019, 1, 18)) ini.linhas.push('Óbito antes de 18/01/2019: os prazos de 90 e 180 dias vêm da MP 871/2019 (Lei 13.846/2019). Para óbitos anteriores, confira o prazo da época.');
    ini.linhas.push('Se outro dependente se habilitar depois da concessão, a DIP é a DER enquanto a pensão anterior não tiver cessado; se já cessou, é o dia seguinte à cessação (pedido em até 90 dias do óbito, ou 180 para menor de 16) ou a DER (art. 370). Prescrição quinquenal das parcelas.');
    if (req) {
      if (req.ord <= obito.ord + prazoDias) ini.linhas.push('Requerimento em ' + rot(req) + ': dentro do prazo, início na data do óbito.');
      else { ini.dib = req; ini.linhas.push('Requerimento em ' + rot(req) + ': fora do prazo, início na data do requerimento, sem retroativo ao óbito.'); }
      if (du.fim && req.ord > du.fim.ord) ini.linhas.push('A duração da cota do cônjuge ou companheiro(a), contada do óbito, terminou em ' + rot(du.fim) + ', antes do requerimento: **o pedido é indeferido** (art. 375, § 7º).');
    } else ini.linhas.push('Requerimento não informado: foi considerado dentro do prazo.');

    // ----- Valor -----
    res.valor = { calculado: false, linhas: ['Não calculado nesta versão. Regra geral após a EC 103/2019: cota familiar de 50% mais 10% por dependente, até 100%, sobre a aposentadoria por incapacidade permanente a que o segurado teria direito. Confira antes de usar.'] };

    // ----- Conclusão -----
    var pend = [];
    base.cnis.filter(function (x) { return x.impede; }).forEach(function (x) { pend.push(x.achado + ' ' + x.documento + '.'); });
    d.linhas.forEach(function (l) { if (/^Informe /.test(l)) pend.push(l); });
    if (d.pericia && d.apto) pend.push('Invalidez ou deficiência: comprovar em perícia médica do INSS.');
    var vencido = parceiro && !inval && du.fim && req && req.ord > du.fim.ord;
    var depOk = d.apto && (!precisaEcon || !!entrada.economica);
    var conc;
    var resumoDur = du.rotulo ? ' Duração: ' + du.rotulo.toLowerCase() + '.' : '';
    if (!qualOk) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: qualidade de segurado', texto: 'Os dados do CNIS não demonstram a qualidade de segurado do falecido na data do óbito. Não é conclusão definitiva: direito adquirido à aposentadoria ou incapacidade anterior podem mudar o resultado.' };
    else if (!d.apto) conc = { status: 'nao_demonstrado', rotulo: 'Direito não demonstrado: dependente', texto: 'O dependente informado não se enquadra no art. 16 da Lei 8.213/91 pelos dados informados.' };
    else if (vencido) conc = { status: 'nao_demonstrado', rotulo: 'Pedido fora do prazo de duração da cota', texto: 'O requerimento foi feito depois do fim da duração da cota (' + rot(du.fim) + '), contada do óbito: pedido indeferido pelo art. 375, § 7º, da IN 128/2022.' };
    else if (precisaEcon && !entrada.economica) conc = { status: 'depende', rotulo: 'Depende da prova de dependência econômica', texto: (dep.alimentos ? 'O ex-cônjuge ou ex-companheiro(a) precisa comprovar que recebia pensão alimentícia ou ajuda financeira.' : 'Pais e irmãos precisam comprovar a dependência econômica do segurado, e só recebem se não houver dependente de classe anterior.') + resumoDur };
    else if (d.pericia) conc = { status: 'depende', rotulo: 'Depende da perícia médica', texto: 'A qualidade de segurado do falecido ' + (q.status === 'confirmada' ? 'está demonstrada' : 'é compatível com o CNIS') + ', mas a invalidez ou deficiência do dependente precisa ser comprovada em perícia médica.' + resumoDur };
    else if (q.status === 'confirmada' && !pend.length) conc = { status: 'provavel', rotulo: 'Direito provável', texto: 'O falecido tinha qualidade de segurado na data do óbito e a pensão não exige carência. Falta comprovar o óbito, o vínculo com o dependente e, se for o caso, a dependência.' + resumoDur };
    else conc = { status: 'depende', rotulo: 'Direito depende de validação documental', texto: 'A qualidade de segurado é compatível com o CNIS, mas há pontos a validar antes de concluir.' + resumoDur };
    conc.pendencias = pend;
    res.conclusao = conc;
    docs.forEach(function (t) { res.documentos.push(t); });
    return res;
  }

  // ---------- Interface ----------

  function negrito(el, texto) {
    // Converte **trecho** em <strong>, sem usar innerHTML.
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

  function regrasBasicas() {
    var box = C.el('div', 'regras');
    var p1 = C.el('p'); negrito(p1, '**A pensão por morte NÃO exige carência.** Uma única contribuição válida garante o direito, desde que o falecido tivesse qualidade de segurado na data do óbito.');
    box.appendChild(p1);
    var p2 = C.el('p'); negrito(p2, '**Regra das 18 contribuições: só para cônjuge ou companheiro(a).** Ter 18 contribuições mensais e 2 anos de casamento ou união estável **não impede** a pensão: define apenas a **duração**.');
    box.appendChild(p2);
    box.appendChild(C.el('p', null, 'Duração por tipo de dependente:'));
    box.appendChild(lista([
      '**Cônjuge/companheiro(a)** com menos de 18 contribuições **ou** menos de 2 anos de união: **4 meses**.',
      '**Cônjuge/companheiro(a)** com 18 ou mais contribuições **e** mais de 2 anos de união: duração **variável pela idade no óbito**, vitalícia a partir dos 45 anos.',
      '**Filhos (ou equiparados):** até **21 anos**, sem limite se inválidos ou com deficiência grave. A regra de 18 não se aplica.',
      '**Pais** (dependência econômica comprovada): **vitalícia**. A regra de 18 não se aplica.',
      '**Irmãos** (dependência econômica comprovada): até **21 anos**, sem limite se inválidos ou com deficiência. A regra de 18 não se aplica.'
    ]));
    return box;
  }

  function renderizar(r) {
    var topo = C.el('div', 'direito');
    topo.appendChild(C.el('h3', null, 'Verificação de direito: pensão por morte'));
    topo.appendChild(C.el('p', 'dica', 'Roteiro de conferência, não é decisão do INSS nem parecer. Mostra os dados usados, as regras aplicadas e o que ainda falta comprovar.'));
    topo.appendChild(regrasBasicas());

    var c = r.conclusao;
    var caixa = C.el('div', 'conclusao conclusao-' + c.status);
    caixa.appendChild(C.el('strong', null, c.rotulo));
    caixa.appendChild(C.el('p', null, c.texto));
    if (c.pendencias && c.pendencias.length) {
      caixa.appendChild(C.el('p', 'dica', 'Para concluir:'));
      caixa.appendChild(lista(c.pendencias.slice(0, 8)));
    }
    topo.appendChild(caixa);
    if (!r.obito) return topo;

    var q = r.qualidade;
    var s1 = C.sec('1. Qualidade de segurado na data do óbito (' + rot(r.obito.data) + ')');
    var sel = C.el('p', 'selo-linha'); sel.appendChild(C.el('span', 'selo selo-' + q.status, q.rotulo));
    s1.appendChild(sel);
    s1.appendChild(lista(r.obito.notas.concat(r.categoria && r.categoria.motivo ? [r.categoria.motivo] : [], q.linhas)));
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

    var s2 = C.sec('2. Dependente: ' + r.dependente.rotulo);
    s2.appendChild(lista(r.dependente.linhas.length ? r.dependente.linhas : ['Sem observações.']));
    topo.appendChild(s2);

    var du = r.duracao;
    var s3 = C.sec('3. Duração da pensão');
    var sd = C.el('p', 'selo-linha'); sd.appendChild(C.el('span', 'selo selo-' + (du.indeterminada ? 'indeterminada' : 'confirmada'), du.rotulo || '—'));
    s3.appendChild(sd);
    if (du.texto) s3.appendChild(C.el('p', null, du.texto));
    s3.appendChild(lista(du.linhas));
    if (r.tabela && du.regra === 'idade') {
      s3.appendChild(C.el('p', 'dica', 'Tabela usada (óbito ' + (r.tabela.nome === '2021' ? 'a partir de 01/01/2021, Portaria ME 424/2020' : 'de 18/06/2015 a 31/12/2020, Lei 13.135/2015') + '). A faixa do dependente está em destaque.'));
      s3.appendChild(C.tabela(['Idade na data do óbito', 'Duração'], r.tabela.linhas.map(function (f) {
        var marca = r.tabela.destaque === f[1] ? ' ◀ este caso' : '';
        return [f[1] + marca, f[2] === null ? 'Vitalícia' : f[2] + ' anos'];
      })));
    }
    topo.appendChild(s3);

    var s4 = C.sec('4. Início do benefício');
    s4.appendChild(C.el('p', null, 'Início considerado: ' + rot(r.inicio.dib) + '.'));
    s4.appendChild(lista(r.inicio.linhas));
    topo.appendChild(s4);

    var s5 = C.sec('5. Validade do CNIS');
    if (r.cnis.length) s5.appendChild(C.tabela(['O que foi encontrado', 'Impacto', 'Documento', 'Impede conclusão segura?', 'Providência'], r.cnis.map(function (x) { return [x.achado, x.impacto, x.documento, x.impede ? 'Sim, até validar' : 'Não', x.providencia]; })));
    else s5.appendChild(C.el('p', 'vazio-msg', 'Nenhuma inconsistência relevante para esta conclusão.'));
    topo.appendChild(s5);

    var s6 = C.sec('6. Valor');
    s6.appendChild(lista(r.valor.linhas));
    topo.appendChild(s6);

    var s7 = C.sec('Documentos a reunir');
    s7.appendChild(lista(r.documentos));
    topo.appendChild(s7);

    var s8 = C.sec('Normas usadas');
    s8.appendChild(C.tabela(['Norma', 'Vigência / conferência'], r.normas.map(function (n) { return [n.nome, n.vigencia]; })));
    topo.appendChild(s8);
    return topo;
  }

  function lerCampos() {
    var g = function (id) { return document.getElementById(id); };
    return {
      obito: g('pm-obito').value, dependente: g('pm-dependente').value, nascimento: g('pm-nasc').value, uniao: g('pm-uniao').value,
      requerimento: g('pm-req').value, invalido: g('pm-invalido').checked, acidente: g('pm-acidente').checked,
      economica: g('pm-economica').checked, desemprego: g('dir-desemprego').checked
    };
  }

  var api = { pensaoPorMorte: pensaoPorMorte, renderizar: renderizar, lerCampos: lerCampos, TABELA_2021: TABELA_2021, TABELA_2015: TABELA_2015, NORMAS: NORMAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PENSAO = api;
})(typeof window !== 'undefined' ? window : globalThis);
