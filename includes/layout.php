<?php
require_once __DIR__ . '/../config.php';

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function data_br(string $iso): string
{
    [$y, $m, $d] = explode('-', $iso);
    return "$d/$m/$y";
}

// Analytics e AdSense só são carregados quando configurados e fora da página da ferramenta.
function head_rastreio(): void
{
    if (GA_ID !== '') { ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= e(GA_ID) ?>"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','<?= e(GA_ID) ?>');</script>
<?php }
    if (ADS_ENABLED && ADSENSE_CLIENT !== '') { ?>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= e(ADSENSE_CLIENT) ?>" crossorigin="anonymous"></script>
<?php }
}

function page_head(string $titulo, string $descricao, array $o = []): void
{
    $caminho = $o['path'] ?? '/';
    $noindex = !empty($o['noindex']) ? '<meta name="robots" content="noindex, nofollow">' : '';
    $rastreio = empty($o['sem_rastreio']);
    ?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titulo) ?></title>
<meta name="description" content="<?= e($descricao) ?>">
<link rel="canonical" href="<?= e(SITE_URL . $caminho) ?>">
<?= $noindex ?>
<link rel="stylesheet" href="/assets/css/style.css">
<?php if ($rastreio) { head_rastreio(); } ?>
</head>
<body>
<header class="topo">
  <div class="wrap">
    <a class="marca" href="/"><?= e(SITE_NAME) ?></a>
    <nav>
      <a href="/blog/">Blog</a>
      <a href="/legislacao/">Legislação</a>
      <a href="/privacidade/">Privacidade</a>
    </nav>
  </div>
</header>
<main class="wrap">
<?php
}

function ad_slot(): void
{
    if (!ADS_ENABLED || ADSENSE_CLIENT === '') {
        return;
    }
    echo '<div class="anuncio"><ins class="adsbygoogle" style="display:block"'
        . ' data-ad-client="' . e(ADSENSE_CLIENT) . '" data-ad-format="auto"'
        . ' data-full-width-responsive="true"></ins>'
        . '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>';
}

function page_foot(): void
{
    ?>
</main>
<footer class="rodape">
  <div class="wrap">
    <p>Conteúdo informativo. Não substitui orientação jurídica nem as informações oficiais do INSS.</p>
    <p><a href="/privacidade/">Política de privacidade</a> · &copy; <?= date('Y') ?> <?= e(SITE_NAME) ?></p>
  </div>
</footer>
</body>
</html>
<?php
}
