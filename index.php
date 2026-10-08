<?php
/*
 * Análise CNIS: PHP puro, sem banco de dados, com um único roteador.
 * Rotas: /  /blog/  /blog/{slug}/  /legislacao/  /privacidade/  /analise-cnis/  /sitemap.xml
 */

// ---------- Configuração ----------
const SITE_NOME = 'Análise CNIS';
const SITE_URL = 'https://www.seudominio.com.br'; // domínio final, sem barra no fim
const GA_ID = '';                 // 'G-XXXXXXXXXX'. Vazio: o Analytics não é carregado.
const ADSENSE = '';               // 'ca-pub-XXXXXXXXXXXXXXXX'. Vazio: sem anúncios.
const ADS_ATIVOS = false;         // true só depois da aprovação do AdSense.
const FERRAMENTA_PUBLICA = false; // true: links para a ferramenta, indexação liberada e sitemap.

date_default_timezone_set('America/Sao_Paulo');

// Artigos: o texto de cada um fica em posts/{slug}.html.
// 'data' no futuro mantém o artigo oculto até o dia.
$POSTS = [
    ['slug' => 'o-que-e-o-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-07',
     'titulo' => 'O que é o CNIS e o que conferir no extrato',
     'resumo' => 'Entenda o que aparece no extrato do CNIS e quais pontos merecem conferência.'],
    ['slug' => 'salarios-faltantes-no-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-07',
     'titulo' => 'Salários faltantes no CNIS: como identificar',
     'resumo' => 'O que significa uma competência sem remuneração, quando isso é esperado e como conferir.'],
];

// Fontes oficiais. Os textos mudam: a versão vigente é a do site de origem.
$NORMAS = [
    ['titulo' => 'Lei nº 8.213, de 24 de julho de 1991',
     'texto' => 'Dispõe sobre os Planos de Benefícios da Previdência Social. É a base das regras de segurado, carência e benefícios.',
     'url' => 'https://www.planalto.gov.br/ccivil_03/leis/L8213compilado.htm', 'fonte' => 'Planalto, texto compilado'],
    ['titulo' => 'Decreto nº 3.048, de 6 de maio de 1999',
     'texto' => 'Aprova o Regulamento da Previdência Social. Detalha, entre outros temas, a contagem de tempo e o cálculo dos benefícios.',
     'url' => 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm', 'fonte' => 'Planalto, texto compilado'],
    ['titulo' => 'Instrução Normativa PRES/INSS nº 128, de 28 de março de 2022',
     'texto' => 'Disciplina a aplicação das normas de direito previdenciário pelo INSS. Foi alterada depois de publicada, então confira a versão vigente.',
     'url' => 'https://www.gov.br/inss/pt-br/centrais-de-conteudo/legislacao/instrucao-normativa/2022/instrucao-normativa-pres-inss-no-128-de-28-de-marco-de-2022', 'fonte' => 'gov.br/inss'],
];
const NORMAS_CONFERIDAS_EM = '07/10/2026';

// ---------- Funções ----------
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function data_br(string $iso): string { return implode('/', array_reverse(explode('-', $iso))); }
function u(string $caminho): string { global $BASE; return $BASE . $caminho; }

function publicados(): array {
    global $POSTS;
    $hoje = date('Y-m-d');
    $l = array_values(array_filter($POSTS, fn($p) => $p['data'] <= $hoje));
    usort($l, fn($a, $b) => strcmp($b['data'], $a['data']));
    return $l;
}

function marca_svg(): string {
    $c = ['#5cc79a', '#5cc79a', '#5cc79a', '#5cc79a', '#e4655f', '#5cc79a', '#5cc79a', '#5cc79a', '#c4ccdd'];
    $s = '<svg viewBox="0 0 24 24" aria-hidden="true">';
    foreach ($c as $i => $cor) {
        $s .= '<rect x="' . (1 + ($i % 3) * 8) . '" y="' . (1 + intdiv($i, 3) * 8) . '" width="6" height="6" rx="1.5" fill="' . $cor . '"/>';
    }
    return $s . '</svg>';
}

function topo(string $titulo, string $desc, string $caminho, array $o = []): void {
    $rastreio = $o['rastreio'] ?? true;
    $url = SITE_URL . $caminho;
    $favicon = 'data:image/svg+xml,' . rawurlencode(str_replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', marca_svg()));
    ?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titulo) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($url) ?>">
<?php if (!empty($o['noindex'])): ?><meta name="robots" content="noindex, nofollow">
<?php endif; ?>
<meta property="og:type" content="<?= !empty($o['artigo']) ? 'article' : 'website' ?>">
<meta property="og:title" content="<?= e($titulo) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($url) ?>">
<meta property="og:locale" content="pt_BR">
<meta name="theme-color" content="#f5f7fb">
<link rel="icon" href="<?= e($favicon) ?>">
<link rel="preload" href="<?= e(u('/assets/fonts/atkinson-400.woff2')) ?>" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= e(u('/assets/style.css')) ?>?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
<?php if ($rastreio && GA_ID !== ''): ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= e(GA_ID) ?>"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','<?= e(GA_ID) ?>');</script>
<?php endif; ?>
<?php if ($rastreio && ADS_ATIVOS && ADSENSE !== ''): ?>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= e(ADSENSE) ?>" crossorigin="anonymous"></script>
<?php endif; ?>
<?php if (!empty($o['jsonld'])): ?>
<script type="application/ld+json"><?= json_encode($o['jsonld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?></script>
<?php endif; ?>
</head>
<body>
<header class="topo">
  <div class="wrap topo-in">
    <a class="marca" href="<?= e(u('/')) ?>"><?= marca_svg() ?><?= e(SITE_NOME) ?></a>
    <nav class="menu" aria-label="Principal">
      <?php if (FERRAMENTA_PUBLICA): ?><a href="<?= e(u('/analise-cnis/')) ?>">Analisar CNIS</a><?php endif; ?>
      <a href="<?= e(u('/blog/')) ?>">Blog</a>
      <a href="<?= e(u('/legislacao/')) ?>">Legislação</a>
      <a href="<?= e(u('/privacidade/')) ?>">Privacidade</a>
    </nav>
  </div>
</header>
<?php
}

function rodape(): void {
    ?>
<footer class="rodape">
  <div class="wrap">
    <p>Conteúdo informativo. Não substitui a orientação de um advogado previdenciário nem as informações oficiais do INSS.</p>
    <p><a href="<?= e(u('/privacidade/')) ?>">Política de privacidade</a> &copy; <?= date('Y') ?> <?= e(SITE_NOME) ?></p>
  </div>
</footer>
</body>
</html>
<?php
}

function anuncio(): void {
    if (!ADS_ATIVOS || ADSENSE === '') return;
    echo '<div class="anuncio"><ins class="adsbygoogle" style="display:block" data-ad-client="' . e(ADSENSE)
        . '" data-ad-format="auto" data-full-width-responsive="true"></ins>'
        . '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>';
}

// Ilustração do mapa de competências. o=com remuneração, f=falta, p=parcial, v=sem vínculo.
function mapa_exemplo(): void {
    $anos = ['2018' => 'oooooooooooo', '2019' => 'oooofoooopoo', '2020' => 'oooooovvvvvv'];
    $est = ['o' => ['ok', 'com remuneração'], 'f' => ['falta', 'sem remuneração'], 'p' => ['parcial', 'falta em um dos vínculos'], 'v' => ['vazio', 'sem vínculo']];
    $meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    echo '<table class="mapa" aria-hidden="true"><thead><tr><th class="ano"></th>';
    foreach ($meses as $m) echo '<th>' . $m . '</th>';
    echo '</tr></thead><tbody>';
    foreach ($anos as $ano => $linha) {
        echo '<tr><th class="ano">' . $ano . '</th>';
        for ($i = 0; $i < 12; $i++) {
            [$cls, $rot] = $est[$linha[$i]];
            echo '<td class="c-' . $cls . '" title="' . sprintf('%02d', $i + 1) . '/' . $ano . ': ' . $rot . '"></td>';
        }
        echo '</tr>';
    }
    echo '</tbody></table>';
}

function pagina_404(): void {
    http_response_code(404);
    topo('Página não encontrada | ' . SITE_NOME, 'Página não encontrada.', '/', ['noindex' => true]);
    echo '<main class="wrap pagina"><h1>Página não encontrada</h1><p>O endereço não existe ou o artigo ainda não foi publicado.</p>'
        . '<p><a href="' . e(u('/')) . '">Ir para o início</a> ou <a href="' . e(u('/blog/')) . '">ver o blog</a>.</p></main>';
    rodape();
}

// ---------- Rota ----------
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (PHP_SAPI === 'cli-server' && $uri !== '/' && substr($uri, -4) !== '.php' && is_file(__DIR__ . $uri)) {
    return false; // servidor embutido do PHP entrega os arquivos estáticos
}
$BASE = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$rota = (string) substr($uri, strlen($BASE));
if ($rota !== '' && $rota !== '/' && substr($rota, -1) !== '/' && strpos(basename($rota), '.') === false) {
    header('Location: ' . $BASE . $rota . '/', true, 301); // endereços sempre terminam em barra
    exit;
}
$rota = '/' . trim($rota, '/');

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($rota === '/') {
    $recentes = array_slice(publicados(), 0, 3);
    topo(SITE_NOME . ' | Confira o seu CNIS mês a mês', 'Guias e uma ferramenta gratuita para encontrar salários faltantes, pendências e o tempo contado no extrato do CNIS.', '/');
    ?>
<main class="wrap">
  <section class="hero">
    <div class="hero-texto">
      <h1>Confira o seu CNIS mês a mês</h1>
      <p class="lead">Veja de uma vez onde falta remuneração, quanto tempo foi contado e o que o INSS deixou pendente no extrato.</p>
      <?php if (FERRAMENTA_PUBLICA): ?>
        <p><a class="btn" href="<?= e(u('/analise-cnis/')) ?>">Analisar um extrato</a></p>
      <?php else: ?>
        <p class="status">A ferramenta de análise está em preparação. Enquanto isso, os guias explicam como ler o extrato.</p>
      <?php endif; ?>
    </div>
    <figure class="hero-mapa">
      <?php mapa_exemplo(); ?>
      <figcaption>Exemplo ilustrativo do mapa de competências. Cada quadrado é um mês, e o coral marca uma competência sem remuneração.</figcaption>
    </figure>
  </section>

  <section class="faixa">
    <h2>O que a análise mostra</h2>
    <div class="tres">
      <div><h3>Tempo e competências</h3><p>Soma o tempo dos vínculos sem contar duas vezes os períodos concomitantes e conta as competências com remuneração.</p></div>
      <div><h3>Salários faltantes</h3><p>Aponta, vínculo por vínculo, os meses sem remuneração lançada a partir de 07/1994.</p></div>
      <div><h3>Pendências</h3><p>Reúne indicadores do INSS, datas inconsistentes, competências repetidas e os benefícios que aparecem no extrato.</p></div>
    </div>
  </section>

  <section class="faixa">
    <h2>O extrato fica no seu navegador</h2>
    <div class="texto">
      <p>A leitura do PDF acontece no seu computador. O arquivo não é enviado, salvo ou registrado, e a página da ferramenta não carrega Analytics nem anúncios. <a href="<?= e(u('/privacidade/')) ?>">Veja como isso funciona</a>.</p>
    </div>
  </section>

  <section class="faixa">
    <h2>Últimos artigos</h2>
    <ul class="lista-posts">
      <?php foreach ($recentes as $p): ?>
        <li>
          <a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a>
          <time datetime="<?= e($p['data']) ?>"><?= e(data_br($p['data'])) ?></time>
          <p><?= e($p['resumo']) ?></p>
        </li>
      <?php endforeach; ?>
    </ul>
    <a class="mais" href="<?= e(u('/blog/')) ?>">Ver todos os artigos</a>
  </section>

  <section class="faixa">
    <h2>Legislação de referência</h2>
    <div class="texto">
      <p>Lei 8.213/91, Decreto 3.048/99 e IN PRES/INSS 128/2022, com links para as fontes oficiais.</p>
      <a class="mais" href="<?= e(u('/legislacao/')) ?>">Ver a legislação</a>
    </div>
  </section>
</main>
<?php
    rodape();

} elseif ($rota === '/blog') {
    topo('Blog | ' . SITE_NOME, 'Guias sobre o extrato do CNIS, vínculos, remunerações e pendências.', '/blog/');
    ?>
<main class="wrap pagina">
  <h1>Blog</h1>
  <p class="lead">Guias curtos sobre o extrato do CNIS e a conferência de vínculos.</p>
  <ul class="lista-posts">
    <?php foreach (publicados() as $p): ?>
      <li>
        <a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a>
        <time datetime="<?= e($p['data']) ?>"><?= e(data_br($p['data'])) ?></time>
        <p><?= e($p['resumo']) ?></p>
      </li>
    <?php endforeach; ?>
  </ul>
</main>
<?php
    rodape();

} elseif (preg_match('#^/blog/([a-z0-9-]+)$#', $rota, $m)) {
    $post = null;
    foreach (publicados() as $p) if ($p['slug'] === $m[1]) $post = $p;
    $arquivo = $post ? __DIR__ . '/posts/' . $post['slug'] . '.html' : '';
    if (!$post || !is_file($arquivo)) { pagina_404(); exit; }

    $caminho = '/blog/' . $post['slug'] . '/';
    topo($post['titulo'] . ' | ' . SITE_NOME, $post['resumo'], $caminho, [
        'artigo' => true,
        'jsonld' => [
            '@context' => 'https://schema.org', '@type' => 'Article',
            'headline' => $post['titulo'], 'description' => $post['resumo'],
            'datePublished' => $post['data'], 'dateModified' => $post['revisado'] ?? $post['data'],
            'author' => ['@type' => 'Organization', 'name' => SITE_NOME],
            'mainEntityOfPage' => SITE_URL . $caminho,
        ],
    ]);
    ?>
<main class="wrap pagina">
  <article class="artigo">
    <h1><?= e($post['titulo']) ?></h1>
    <p class="meta">Publicado em <?= e(data_br($post['data'])) ?><?php if (!empty($post['revisado'])): ?>. Revisado em <?= e(data_br($post['revisado'])) ?>.<?php endif; ?></p>
    <?php readfile($arquivo); ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/blog/')) ?>">Todos os artigos</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/legislacao') {
    topo('Legislação previdenciária | ' . SITE_NOME, 'Links oficiais para a Lei 8.213/91, o Decreto 3.048/99 e a IN PRES/INSS 128/2022.', '/legislacao/');
    ?>
<main class="wrap pagina">
  <h1>Legislação previdenciária</h1>
  <p class="lead texto">As normas usadas como referência nos guias. Os links levam às fontes oficiais.</p>
  <ul class="normas">
    <?php foreach ($NORMAS as $n): ?>
      <li>
        <a href="<?= e($n['url']) ?>" target="_blank" rel="noopener noreferrer"><?= e($n['titulo']) ?></a>
        <p><?= e($n['texto']) ?></p>
        <p class="fonte">Fonte: <?= e($n['fonte']) ?>.</p>
      </li>
    <?php endforeach; ?>
  </ul>
  <p class="meta texto">Links conferidos em <?= NORMAS_CONFERIDAS_EM ?>. As normas podem ter sido alteradas desde então, e esta lista não substitui a leitura do texto vigente.</p>
</main>
<?php
    rodape();

} elseif ($rota === '/privacidade') {
    topo('Política de privacidade | ' . SITE_NOME, 'Como o site trata dados de visitantes e por que o extrato do CNIS não sai do seu navegador.', '/privacidade/');
    ?>
<main class="wrap pagina">
  <article class="artigo">
    <h1>Política de privacidade</h1>
    <p class="meta">Atualizada em 07/10/2026.</p>
    <?php /* TODO: preencher responsável e contato, e revisar o texto com profissional jurídico antes de publicar. */ ?>

    <h2>Quem é o responsável</h2>
    <p>Este site é mantido por [nome do responsável]. Para dúvidas sobre privacidade, escreva para [e-mail de contato].</p>

    <h2>Extrato do CNIS</h2>
    <p>A análise acontece inteiramente no seu navegador. O PDF ou o texto que você informa não é enviado para nossos servidores, não é salvo e não aparece em registros. Ao recarregar a página, os dados somem.</p>
    <p>A página da ferramenta usa apenas arquivos deste mesmo site, inclusive a biblioteca que lê o PDF, e tem uma regra de segurança que bloqueia qualquer conexão de saída. Ela não carrega Analytics, anúncios nem fontes de terceiros.</p>

    <h2>Visitas ao site</h2>
    <p>As demais páginas podem usar o Google Analytics para medir visitas de forma agregada, como páginas acessadas e tipo de dispositivo. Esses dados não identificam você diretamente.</p>

    <h2>Publicidade</h2>
    <p>Os artigos podem exibir anúncios do Google AdSense. O Google pode usar cookies para mostrar anúncios com base em visitas anteriores a este e a outros sites. Você pode ajustar essas preferências em <a href="https://adssettings.google.com" rel="noopener">adssettings.google.com</a>.</p>

    <h2>Cookies</h2>
    <p>O site não grava cookies próprios. Os cookies existentes vêm do Google Analytics e do Google AdSense, quando ativados, e você pode bloqueá-los nas configurações do navegador.</p>

    <h2>Seus direitos</h2>
    <p>Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir confirmação de tratamento, acesso, correção e eliminação dos dados pessoais sob responsabilidade deste site, pelo contato acima.</p>

    <h2>Alterações</h2>
    <p>Esta política pode mudar. A data da última atualização fica sempre no topo da página.</p>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/analise-cnis') {
    // Sem Analytics e sem anúncios aqui. A regra abaixo impede qualquer conexão de saída.
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; worker-src 'self' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!FERRAMENTA_PUBLICA) header('X-Robots-Tag: noindex, nofollow');
    topo('Análise de CNIS | ' . SITE_NOME, 'Tempo contado, salários faltantes e pendências no extrato do CNIS, direto no navegador.', '/analise-cnis/', [
        'rastreio' => false, 'noindex' => !FERRAMENTA_PUBLICA,
    ]);
    ?>
<main class="wrap pagina">
  <h1>Análise de CNIS</h1>
  <p class="lead texto">Envie o PDF do extrato ou cole o texto para ver o tempo contado, os salários faltantes e as pendências.</p>
  <p class="aviso-privacidade">Tudo acontece no seu navegador. O extrato não é enviado, salvo ou registrado.</p>

  <form id="cnis-form" class="painel">
    <label class="campo">PDF do extrato
      <input type="file" id="cnis-arquivo" accept="application/pdf,.pdf">
    </label>
    <label class="campo">Ou cole o texto do extrato
      <textarea id="cnis-texto" rows="7" spellcheck="false"></textarea>
    </label>
    <div class="acoes">
      <button class="btn" type="submit">Analisar</button>
      <button class="btn btn-leve" type="button" id="cnis-exemplo">Carregar exemplo fictício</button>
      <button class="btn btn-leve" type="button" id="cnis-limpar">Limpar</button>
    </div>
    <p class="msg" id="cnis-msg" role="status"></p>
  </form>

  <div id="cnis-resultado" aria-live="polite"></div>
</main>
<script src="<?= e(u('/assets/vendor/pdf.min.js')) ?>"></script>
<script src="<?= e(u('/assets/cnis.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/cnis.js') ?>"></script>
<?php
    rodape();

} elseif ($rota === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $urls = [['/', null], ['/blog/', null], ['/legislacao/', null], ['/privacidade/', null]];
    if (FERRAMENTA_PUBLICA) $urls[] = ['/analise-cnis/', null];
    foreach (publicados() as $p) $urls[] = ['/blog/' . $p['slug'] . '/', $p['revisado'] ?? $p['data']];
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as [$c, $d]) {
        echo '  <url><loc>' . e(SITE_URL . $c) . '</loc>' . ($d ? '<lastmod>' . e($d) . '</lastmod>' : '') . "</url>\n";
    }
    echo '</urlset>' . "\n";

} else {
    pagina_404();
}
