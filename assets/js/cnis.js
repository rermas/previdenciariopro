/*
 * Análise de CNIS: contagem de tempo, meses sem remuneração e pendências.
 * Todo o processamento é local. Nenhum dado é enviado ou armazenado.
 */
(function (root) {
  'use strict';

  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var ORDEM_SEV = { erro: 0, atencao: 1, info: 2 };
  var ROTULO_SEV = { erro: 'Erro de dado', atencao: 'Atenção', info: 'Informação' };

  // Palavras que o próprio extrato usa para indicar registros problemáticos.
  var PALAVRAS = [
    [/sem\s+informa[çc][aã]o/i, 'Registro marcado como "sem informação"'],
    [/extempor[âa]ne/i, 'Registro extemporâneo (lançado fora do prazo)'],
    [/pendente/i, 'Registro marcado como pendente'],
    [/indeferid/i, 'Registro marcado como indeferido'],
    [/n[ãa]o\s+confirmad/i, 'Registro marcado como não confirmado']
  ];

  // Competência (mm/aaaa) seguida de valor em reais (1.234,56).
  var RE_REMUNERACAO = /(?:^|[^\d\/])(0[1-9]|1[0-2])\/(\d{4})(?![\d\/])\D*?(\d{1,3}(?:\.\d{3})*,\d{2})/;
  var RE_DATA_TOKEN = /\b\d{2}\/\d{2}\/\d{4}\b/g;

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function ordemDe(y, m, d) {
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  // "dd/mm/aaaa" -> { y, m, d, ord } ou null se for inválida.
  function dataDe(s) {
    var p = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!p) return null;
    var d = +p[1], m = +p[2], y = +p[3];
    var ord = ordemDe(y, m, d);
    var teste = new Date(ord * 86400000);
    if (teste.getUTCDate() !== d || teste.getUTCMonth() !== m - 1) return null;
    return { y: y, m: m, d: d, ord: ord };
  }

  // "1.234,56" -> 1234.56
  function valorDe(s) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }

  function rotuloMes(chave) {
    return pad((chave % 12) + 1) + '/' + Math.floor(chave / 12);
  }

  // Lista de meses -> faixas contínuas, por exemplo [{de:'01/2010', ate:'03/2010', qtd:3}].
  function agrupar(chaves) {
    var faixas = [];
    chaves.slice().sort(function (a, b) { return a - b; }).forEach(function (k) {
      var ult = faixas[faixas.length - 1];
      if (ult && k === ult.fim + 1) {
        ult.fim = k;
        ult.qtd++;
      } else {
        faixas.push({ ini: k, fim: k, qtd: 1 });
      }
    });
    return faixas.map(function (f) {
      return { de: rotuloMes(f.ini), ate: rotuloMes(f.fim), qtd: f.qtd };
    });
  }

  // Dias -> "1 ano, 1 mês, 3 dias" (convenção comum: 365 dias por ano, 30 por mês).
  function formatarDuracao(dias) {
    var anos = Math.floor(dias / 365);
    var resto = dias % 365;
    var meses = Math.floor(resto / 30);
    var d = resto % 30;
    return anos + (anos === 1 ? ' ano' : ' anos') + ', ' +
      meses + (meses === 1 ? ' mês' : ' meses') + ', ' +
      d + (d === 1 ? ' dia' : ' dias');
  }

  // Lê o texto linha a linha e separa vínculos, remunerações e palavras de atenção.
  function interpretar(texto) {
    var linhas = String(texto || '').split(/\r?\n/);
    var vinculos = [];
    var remSemVinculo = [];
    var notas = [];
    var atual = null;

    linhas.forEach(function (bruta, i) {
      var linha = bruta.replace(/\s+/g, ' ').trim();
      if (!linha) return;
      var num = i + 1;

      PALAVRAS.forEach(function (p) {
        if (p[0].test(linha)) {
          notas.push({ sev: 'atencao', linha: num, msg: p[1], texto: linha });
        }
      });

      var datas = linha.match(RE_DATA_TOKEN);
      if (datas) {
        var id = linha.match(/\b\d{11,14}\b/);
        atual = {
          linha: num,
          texto: linha,
          id: id ? id[0] : null,
          datasBrutas: datas,
          inicio: dataDe(datas[0]),
          fim: datas.length > 1 ? dataDe(datas[1]) : null,
          remuneracoes: []
        };
        vinculos.push(atual);
        return;
      }

      var r = RE_REMUNERACAO.exec(linha);
      if (r) {
        var rem = {
          linha: num,
          comp: { m: +r[1], y: +r[2] },
          valor: valorDe(r[3]),
          texto: linha
        };
        (atual ? atual.remuneracoes : remSemVinculo).push(rem);
      }
    });

    return { vinculos: vinculos, remSemVinculo: remSemVinculo, notas: notas };
  }

  /*
   * Analisa o texto do CNIS.
   * hoje: { y, m, d } usado como fim de vínculos sem data final.
   */
  function analisar(texto, hoje) {
    var lido = interpretar(texto);
    var pend = lido.notas.slice();
    var hojeOrd = ordemDe(hoje.y, hoje.m, hoje.d);
    var lista = [];
    var validos = [];
    var faltantes = [];
    var totalRem = 0;

    lido.remSemVinculo.forEach(function (r) {
      totalRem++;
      pend.push({ sev: 'atencao', linha: r.linha, msg: 'Remuneração de ' + rotuloMes(r.comp.y * 12 + r.comp.m - 1) + ' sem vínculo identificado acima' });
    });

    lido.vinculos.forEach(function (v) {
      totalRem += v.remuneracoes.length;
      var item = {
        linha: v.linha,
        id: v.id,
        inicio: v.inicio,
        fim: v.fim,
        emAberto: false,
        valido: false,
        dias: 0,
        remuneracoes: v.remuneracoes.length
      };
      lista.push(item);

      if (!v.inicio) {
        pend.push({ sev: 'erro', linha: v.linha, msg: 'Data de início inválida ou não reconhecida' });
        return;
      }

      var fim = v.fim;
      if (!fim) {
        if (v.datasBrutas.length > 1) {
          pend.push({ sev: 'erro', linha: v.linha, msg: 'Data de fim inválida' });
          return;
        }
        fim = { y: hoje.y, m: hoje.m, d: hoje.d, ord: hojeOrd };
        item.emAberto = true;
        pend.push({ sev: 'info', linha: v.linha, msg: 'Vínculo sem data de fim: período contado até hoje' });
      }

      if (fim.ord < v.inicio.ord) {
        pend.push({ sev: 'erro', linha: v.linha, msg: 'Data de fim anterior à data de início' });
        return;
      }

      item.valido = true;
      item.inicioOrd = v.inicio.ord;
      item.fimOrd = fim.ord;
      item.fim = fim;
      item.dias = fim.ord - v.inicio.ord + 1;
      validos.push(item);

      // Salários faltantes: meses do período sem nenhuma remuneração lançada.
      var mIni = v.inicio.y * 12 + v.inicio.m - 1;
      var mFim = fim.y * 12 + fim.m - 1;
      var presentes = {};

      v.remuneracoes.forEach(function (r) {
        var k = r.comp.y * 12 + r.comp.m - 1;
        if (presentes[k]) {
          pend.push({ sev: 'atencao', linha: r.linha, msg: 'Competência ' + rotuloMes(k) + ' aparece mais de uma vez' });
        }
        presentes[k] = true;
        if (k < mIni || k > mFim) {
          pend.push({ sev: 'atencao', linha: r.linha, msg: 'Competência ' + rotuloMes(k) + ' fora do período do vínculo' });
        }
        if (r.valor === 0) {
          pend.push({ sev: 'atencao', linha: r.linha, msg: 'Remuneração zerada em ' + rotuloMes(k) });
        }
      });

      if (v.remuneracoes.length === 0) {
        pend.push({ sev: 'atencao', linha: v.linha, msg: 'Vínculo sem nenhuma remuneração lançada' });
        return;
      }

      var sem = [];
      for (var k = mIni; k <= mFim; k++) {
        if (!presentes[k]) sem.push(k);
      }
      item.mesesSemRemuneracao = sem.length;
      if (sem.length) {
        item.faixasSemRemuneracao = agrupar(sem);
        faltantes.push({ linha: v.linha, id: v.id, inicio: v.inicio, fim: fim, meses: sem.length, faixas: item.faixasSemRemuneracao });
      }
    });

    // Concomitância: períodos que se sobrepõem.
    for (var i = 0; i < validos.length; i++) {
      for (var j = i + 1; j < validos.length; j++) {
        var a = validos[i], b = validos[j];
        var s = Math.max(a.inicioOrd, b.inicioOrd);
        var e = Math.min(a.fimOrd, b.fimOrd);
        if (s <= e) {
          pend.push({ sev: 'info', linha: a.linha, msg: 'Período concomitante com a linha ' + b.linha + ' (' + (e - s + 1) + ' dias em comum)' });
        }
      }
    }

    // Tempo contado sem contar duas vezes os períodos concomitantes.
    var segs = validos.map(function (v) { return [v.inicioOrd, v.fimOrd]; })
      .sort(function (x, y) { return x[0] - y[0]; });
    var diasUnicos = 0;
    var cIni = null, cFim = null;
    segs.forEach(function (sg) {
      if (cIni === null) {
        cIni = sg[0]; cFim = sg[1];
      } else if (sg[0] <= cFim + 1) {
        cFim = Math.max(cFim, sg[1]);
      } else {
        diasUnicos += cFim - cIni + 1;
        cIni = sg[0]; cFim = sg[1];
      }
    });
    if (cIni !== null) diasUnicos += cFim - cIni + 1;

    var diasBrutos = validos.reduce(function (acc, v) { return acc + v.dias; }, 0);
    var mesesFaltantes = faltantes.reduce(function (acc, f) { return acc + f.meses; }, 0);

    pend.sort(function (x, y) {
      return (ORDEM_SEV[x.sev] - ORDEM_SEV[y.sev]) || ((x.linha || 0) - (y.linha || 0));
    });

    var cont = { erro: 0, atencao: 0, info: 0 };
    pend.forEach(function (p) { cont[p.sev]++; });

    return {
      vinculos: lista,
      faltantes: faltantes,
      pendencias: pend,
      resumo: {
        totalVinculos: lista.length,
        validos: validos.length,
        remuneracoes: totalRem,
        diasUnicos: diasUnicos,
        diasBrutos: diasBrutos,
        duracao: formatarDuracao(diasUnicos),
        mesesSemRemuneracao: mesesFaltantes,
        erros: cont.erro,
        atencoes: cont.atencao,
        infos: cont.info
      }
    };
  }

  // ---------- Interface ----------

  function el(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function tabela(cabecalho, linhas) {
    var t = el('table', 'tabela');
    var thead = el('thead');
    var trh = el('tr');
    cabecalho.forEach(function (c) { trh.appendChild(el('th', null, c)); });
    thead.appendChild(trh);
    t.appendChild(thead);
    var tbody = el('tbody');
    linhas.forEach(function (cols) {
      var tr = el('tr');
      cols.forEach(function (c) { tr.appendChild(el('td', null, c)); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }

  function secao(titulo) {
    var s = el('section', 'resultado-secao');
    s.appendChild(el('h2', null, titulo));
    return s;
  }

  function renderizar(saida, r) {
    saida.textContent = '';
    var s = r.resumo;

    var cards = el('div', 'cards');
    [
      ['Vínculos identificados', s.totalVinculos],
      ['Tempo contado', s.duracao + ' (' + s.diasUnicos + ' dias)'],
      ['Meses sem remuneração', s.mesesSemRemuneracao],
      ['Pontos de atenção', s.erros + s.atencoes]
    ].forEach(function (c) {
      var card = el('div', 'card');
      card.appendChild(el('span', 'card-valor', String(c[1])));
      card.appendChild(el('span', 'card-rotulo', c[0]));
      cards.appendChild(card);
    });
    saida.appendChild(cards);

    var sv = secao('Vínculos');
    if (r.vinculos.length) {
      sv.appendChild(tabela(
        ['Linha', 'Identificação', 'Início', 'Fim', 'Dias', 'Remunerações', 'Situação'],
        r.vinculos.map(function (v) {
          var situacao = !v.valido ? 'Não contado' : (v.emAberto ? 'Em aberto' : 'Encerrado');
          return [
            String(v.linha),
            v.id || '—',
            v.inicio ? v.inicio.d + '/' + pad(v.inicio.m) + '/' + v.inicio.y : '—',
            v.fim && !v.emAberto ? v.fim.d + '/' + pad(v.fim.m) + '/' + v.fim.y : (v.emAberto ? 'hoje' : '—'),
            v.valido ? String(v.dias) : '—',
            String(v.remuneracoes),
            situacao
          ];
        })
      ));
    } else {
      sv.appendChild(el('p', null, 'Nenhum vínculo reconhecido no texto. Verifique se o PDF tem texto selecionável ou cole o conteúdo.'));
    }
    saida.appendChild(sv);

    var sf = secao('Salários faltantes');
    if (r.faltantes.length) {
      var ul = el('ul', 'lista');
      r.faltantes.forEach(function (f) {
        var li = el('li');
        li.appendChild(el('strong', null, 'Linha ' + f.linha + (f.id ? ' (' + f.id + ')' : '') + ': ' + f.meses + (f.meses === 1 ? ' mês' : ' meses') + ' sem remuneração'));
        li.appendChild(el('div', 'faixas', f.faixas.map(function (x) {
          return x.de === x.ate ? x.de : x.de + ' a ' + x.ate;
        }).join(' · ')));
        ul.appendChild(li);
      });
      sf.appendChild(ul);
    } else {
      sf.appendChild(el('p', null, 'Nenhum mês sem remuneração foi encontrado nos vínculos com remunerações lançadas.'));
    }
    saida.appendChild(sf);

    var sp = secao('Pendências');
    if (r.pendencias.length) {
      var lp = el('ul', 'lista');
      r.pendencias.forEach(function (p) {
        var li = el('li', 'pend pend-' + p.sev);
        li.appendChild(el('span', 'selo', ROTULO_SEV[p.sev]));
        li.appendChild(el('span', null, (p.linha ? 'Linha ' + p.linha + ': ' : '') + p.msg));
        lp.appendChild(li);
      });
      sp.appendChild(lp);
    } else {
      sp.appendChild(el('p', null, 'Nenhuma pendência encontrada.'));
    }
    saida.appendChild(sp);

    saida.appendChild(el('p', 'nota', 'Pontos de atenção para conferência com o documento original. Não é parecer. Convenção de tempo: 365 dias por ano e 30 dias por mês.'));
  }

  // Extrai o texto de cada página do PDF, agrupando os itens pela posição vertical.
  function linhasDaPagina(conteudo) {
    var linhasY = {};
    conteudo.items.forEach(function (it) {
      if (!it.str) return;
      var y = Math.round(it.transform[5]);
      (linhasY[y] = linhasY[y] || []).push({ x: it.transform[4], s: it.str });
    });
    return Object.keys(linhasY).map(Number).sort(function (a, b) { return b - a; })
      .map(function (y) {
        return linhasY[y].sort(function (a, b) { return a.x - b.x; })
          .map(function (o) { return o.s; }).join(' ');
      }).join('\n');
  }

  function extrairTextoPdf(arquivo) {
    if (!root.pdfjsLib) {
      return Promise.reject(new Error('O leitor de PDF não carregou. Verifique a conexão ou cole o texto do extrato.'));
    }
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return arquivo.arrayBuffer()
      .then(function (buf) { return root.pdfjsLib.getDocument({ data: buf }).promise; })
      .then(function (pdf) {
        var jobs = [];
        for (var i = 1; i <= pdf.numPages; i++) {
          jobs.push(pdf.getPage(i).then(function (pg) { return pg.getTextContent(); }).then(linhasDaPagina));
        }
        return Promise.all(jobs);
      })
      .then(function (paginas) { return paginas.join('\n'); });
  }

  function hojeComoPartes() {
    var agora = new Date();
    return { y: agora.getFullYear(), m: agora.getMonth() + 1, d: agora.getDate() };
  }

  function iniciarInterface() {
    var form = document.getElementById('cnis-form');
    if (!form) return;
    var arquivo = document.getElementById('cnis-arquivo');
    var texto = document.getElementById('cnis-texto');
    var saida = document.getElementById('cnis-resultado');
    var msg = document.getElementById('cnis-msg');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      saida.textContent = '';
      msg.textContent = 'Processando...';
      var pdf = arquivo.files && arquivo.files[0];
      var origem = pdf ? extrairTextoPdf(pdf) : Promise.resolve(texto.value);

      origem.then(function (conteudo) {
        if (!conteudo || !conteudo.trim()) {
          throw new Error('Nenhum texto encontrado. O PDF pode ser escaneado: cole o texto do extrato no campo abaixo.');
        }
        renderizar(saida, analisar(conteudo, hojeComoPartes()));
        msg.textContent = '';
        // Limpa o campo de texto depois da análise: os dados não ficam na página.
        texto.value = '';
        arquivo.value = '';
      }).catch(function (err) {
        msg.textContent = err && err.message ? err.message : String(err);
      });
    });
  }

  var api = {
    analisar: analisar,
    interpretar: interpretar,
    dataDe: dataDe,
    valorDe: valorDe,
    formatarDuracao: formatarDuracao,
    agrupar: agrupar,
    rotuloMes: rotuloMes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.CNIS = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciarInterface);
    } else {
      iniciarInterface();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
