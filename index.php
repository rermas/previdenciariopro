<?php
require __DIR__ . '/includes/layout.php';

$posts = require __DIR__ . '/blog/posts.php';
$hoje = date('Y-m-d');
$recentes = array_values(array_filter($posts, fn($p) => $p['date'] <= $hoje));
usort($recentes, fn($a, $b) => strcmp($b['date'], $a['date']));
$recentes = array_slice($recentes, 0, 3);

page_head(SITE_NAME . ' | Entenda o extrato do CNIS', 'Guias sobre o extrato previdenciário do CNIS: vínculos, remunerações e pendências.', ['path' => '/']);
?>
<section class="hero">
  <h1>Entenda o seu extrato do CNIS</h1>
  <p class="lead">Guias claros sobre vínculos, remunerações e pendências do extrato previdenciário do INSS.</p>
  <p class="em-breve"><span class="tag">Em breve</span> Ferramenta de conferência do CNIS: contagem de tempo, meses sem remuneração e pontos de atenção.</p>
</section>

<section>
  <h2>Últimos artigos</h2>
  <?php if (!$recentes): ?>
    <p>Os primeiros artigos serão publicados em breve.</p>
  <?php else: ?>
    <ul class="lista-posts">
      <?php foreach ($recentes as $p): ?>
        <li>
          <a href="/blog/<?= e($p['slug']) ?>/"><strong><?= e($p['title']) ?></strong></a>
          <span><?= e(data_br($p['date'])) ?></span>
          <p><?= e($p['desc']) ?></p>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
  <p><a class="botao-leve" href="/blog/">Ver todos os artigos</a></p>
</section>
<?php page_foot();
