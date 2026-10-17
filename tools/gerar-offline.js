// Gera analise-cnis.html: a ferramenta de análise do CNIS em um único arquivo, que funciona offline (duplo clique).
// Uso: node tools/gerar-offline.js [saida.html]   (a saída padrão é dist/analise-cnis.html)
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = (p, enc) => fs.readFileSync(path.join(raiz, p), enc || 'utf8');
const esc = (t) => t.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const b64 = (p) => fs.readFileSync(path.join(raiz, p)).toString('base64');

let css = ler('assets/style.css');
css = css.replace('url(fonts/atkinson-400.woff2)', 'url(data:font/woff2;base64,' + b64('assets/fonts/atkinson-400.woff2') + ')')
         .replace('url(fonts/atkinson-700.woff2)', 'url(data:font/woff2;base64,' + b64('assets/fonts/atkinson-700.woff2') + ')');

const mods = ['cnis', 'direito', 'pensao', 'beneficios', 'idade', 'tempo'];
const hoje = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; font-src data:; img-src data:; worker-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>Análise de CNIS (arquivo único)</title>
<style>${css}</style>
</head>
<body>
<main class="wrap pagina">
  <h1>Análise de CNIS</h1>
  <p class="lead texto">Envie o PDF do extrato ou cole o texto para ver o tempo contado, os salários faltantes e as pendências.</p>
  <p class="aviso-privacidade">Tudo acontece neste computador, sem internet. O extrato não é enviado, salvo ou registrado. Versão gerada em ${hoje}: confira os limites e tabelas de valores antes de usar em peça.</p>

  <form id="cnis-form" class="painel">
    <label class="campo">PDF do extrato
      <input type="file" id="cnis-arquivo" accept="application/pdf,.pdf">
    </label>
    <label class="campo">Ou cole o texto do extrato
      <textarea id="cnis-texto" rows="7" spellcheck="false"></textarea>
    </label>
    <div class="acoes">
      <button class="btn" type="submit">Analisar</button>
      <button class="btn btn-leve" type="button" id="cnis-manual" aria-expanded="false" aria-controls="man-painel">Lançar tempo manualmente</button>
      <button class="btn btn-leve" type="button" id="cnis-exemplo">Carregar exemplo fictício</button>
      <button class="btn btn-leve" type="button" id="cnis-limpar">Limpar</button>
    </div>
    <p class="msg" id="cnis-msg" role="status"></p>
  </form>

  <section id="man-painel" class="painel" hidden aria-labelledby="man-titulo">
    <h2 id="man-titulo" class="man-titulo">Lançar tempo manualmente</h2>
    <p class="texto">Sem o PDF, informe o tipo de vínculo e o período. Cada mês será considerado com o salário mínimo da época, então serve para simular e não substitui o CNIS. Deixe o fim em branco se o vínculo continua.</p>
    <div id="man-lista" class="man-lista"></div>
    <div class="acoes">
      <button class="btn btn-leve" type="button" id="man-add">Adicionar período</button>
      <button class="btn" type="button" id="man-analisar">Analisar lançamentos</button>
    </div>
    <p class="msg" id="man-msg" role="status"></p>
  </section>

  <div id="cnis-resultado" aria-live="polite"></div>
</main>
<script id="pdf-worker-src" type="text/plain">${esc(ler('assets/vendor/pdf.worker.min.js'))}</script>
<script>
try { window.PDF_WORKER_URL = URL.createObjectURL(new Blob([document.getElementById('pdf-worker-src').textContent], { type: 'text/javascript' })); } catch (e) {}
</script>
<script>${esc(ler('assets/vendor/pdf.min.js'))}</script>
${mods.map((m) => '<script>' + esc(ler('assets/' + m + '.js')) + '</script>').join('\n')}
</body>
</html>
`;
const saida = path.resolve(process.argv[2] || path.join(raiz, 'dist', 'analise-cnis.html'));
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, html);
console.log(saida, (html.length / 1048576).toFixed(2) + ' MB');
