<?php
require __DIR__ . '/../includes/layout.php';

// Página em desenvolvimento: fora da navegação do site, sem indexação e sem rastreadores.
page_head('Análise de CNIS | ' . SITE_NAME, 'Conte vínculos, encontre meses sem remuneração e pendências no extrato do CNIS.', [
    'path' => '/analise-cnis/',
    'noindex' => true,
    'sem_rastreio' => true,
]);
?>
<section>
  <h1>Análise de CNIS</h1>
  <p class="aviso-privacidade">Tudo acontece no seu navegador. O arquivo não é enviado a nenhum servidor nem armazenado.</p>
  <p class="status">Ferramenta em desenvolvimento.</p>
</section>

<form id="cnis-form" class="painel">
  <label>
    Arquivo PDF do CNIS
    <input type="file" id="cnis-arquivo" accept="application/pdf,.pdf">
  </label>
  <label>
    Ou cole o texto do extrato
    <textarea id="cnis-texto" rows="8" placeholder="Copie o texto do PDF e cole aqui, se preferir."></textarea>
  </label>
  <div class="acoes">
    <button type="submit">Analisar</button>
  </div>
  <p id="cnis-msg" role="status"></p>
</form>

<div id="cnis-resultado"></div>

<p class="nota">Os resultados são pontos de atenção para conferência com o documento original. Não constituem parecer jurídico nem previdenciário.</p>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="/assets/js/cnis.js"></script>
<?php page_foot();
