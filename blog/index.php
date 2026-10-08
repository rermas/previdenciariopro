<?php
require __DIR__ . '/../includes/layout.php';

$posts = require __DIR__ . '/posts.php';
$hoje = date('Y-m-d');

// Só aparecem posts cuja data já chegou (agendamento por data).
$publicados = array_values(array_filter($posts, fn($p) => $p['date'] <= $hoje));
usort($publicados, fn($a, $b) => strcmp($b['date'], $a['date']));

$slug = $_GET['p'] ?? '';

if ($slug !== '') {
    $post = null;
    if (preg_match('/^[a-z0-9-]+$/', $slug)) {
        foreach ($publicados as $p) {
            if ($p['slug'] === $slug) {
                $post = $p;
            }
        }
    }

    if ($post === null) {
        http_response_code(404);
        page_head('Página não encontrada | ' . SITE_NAME, 'Conteúdo indisponível.', ['noindex' => true]);
        echo '<section><h1>Página não encontrada</h1><p><a href="/blog/">Voltar ao blog</a></p></section>';
        page_foot();
        exit;
    }

    page_head($post['title'] . ' | ' . SITE_NAME, $post['desc'], ['path' => '/blog/' . $post['slug'] . '/']);
    ?>
<article class="post">
  <p class="data">
    Publicado em <?= e(data_br($post['date'])) ?>
    <?php if (!empty($post['revisado'])): ?> · Revisado em <?= e(data_br($post['revisado'])) ?><?php endif; ?>
  </p>
  <h1><?= e($post['title']) ?></h1>
  <?php readfile(__DIR__ . '/conteudo/' . basename($post['file'])); ?>
</article>
<?php ad_slot(); ?>
<p><a class="botao-leve" href="/blog/">← Todos os artigos</a></p>
<?php
    page_foot();
    exit;
}

page_head('Blog | ' . SITE_NAME, 'Guias sobre o extrato do CNIS, vínculos, remunerações e pendências.', ['path' => '/blog/']);
?>
<section>
  <h1>Blog</h1>
  <p class="lead">Guias curtos sobre o extrato do CNIS e a conferência de vínculos.</p>
  <?php if (!$publicados): ?>
    <p>Nenhum artigo publicado ainda.</p>
  <?php else: ?>
    <ul class="lista-posts">
      <?php foreach ($publicados as $p): ?>
        <li>
          <a href="/blog/<?= e($p['slug']) ?>/"><strong><?= e($p['title']) ?></strong></a>
          <span><?= e(data_br($p['date'])) ?></span>
          <p><?= e($p['desc']) ?></p>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</section>
<?php page_foot();
