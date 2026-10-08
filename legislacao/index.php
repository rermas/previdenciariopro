<?php
require __DIR__ . '/../includes/layout.php';

// Fontes oficiais. Os textos mudam com frequência: confira sempre a versão vigente.
$normas = [
    [
        'titulo' => 'Lei nº 8.213/1991',
        'ementa' => 'Planos de Benefícios da Previdência Social. Trata de segurados, carências e benefícios, como o auxílio-doença.',
        'url' => 'https://www.planalto.gov.br/ccivil_03/leis/L8213compilado.htm',
        'fonte' => 'Planalto (texto compilado)',
    ],
    [
        'titulo' => 'Decreto nº 3.048/1999',
        'ementa' => 'Aprova o Regulamento da Previdência Social. Detalha as regras da Lei 8.213/91, como contagem de tempo e cálculo de benefícios.',
        'url' => 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm',
        'fonte' => 'Planalto (texto compilado)',
    ],
    [
        'titulo' => 'Instrução Normativa PRES/INSS nº 128/2022',
        'ementa' => 'Normas do INSS sobre procedimentos administrativos de benefícios. Está marcada como alterada: consulte a versão vigente.',
        'url' => 'https://www.gov.br/inss/pt-br/centrais-de-conteudo/legislacao/instrucao-normativa/2022/instrucao-normativa-pres-inss-no-128-de-28-de-marco-de-2022',
        'fonte' => 'gov.br/inss',
    ],
];

page_head('Legislação previdenciária | ' . SITE_NAME, 'Links para a Lei 8.213/91, o Decreto 3.048/99 e a IN PRES/INSS 128/2022, com fonte oficial.', ['path' => '/legislacao/']);
?>
<section>
  <h1>Legislação previdenciária</h1>
  <p class="lead">Normas usadas como referência nos guias e na análise do CNIS. Os links apontam para as fontes oficiais.</p>

  <ul class="lista-normas">
    <?php foreach ($normas as $n): ?>
      <li>
        <a href="<?= e($n['url']) ?>" target="_blank" rel="noopener noreferrer"><strong><?= e($n['titulo']) ?></strong></a>
        <p><?= e($n['ementa']) ?></p>
        <span class="fonte">Fonte: <?= e($n['fonte']) ?></span>
      </li>
    <?php endforeach; ?>
  </ul>

  <p class="nota">Os textos podem ter sido alterados após a data de publicação desta página. Esta lista não substitui a leitura da norma vigente nem a orientação de um advogado.</p>
</section>
<?php page_foot();
