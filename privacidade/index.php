<?php
require __DIR__ . '/../includes/layout.php';

page_head('Política de privacidade | ' . SITE_NAME, 'Como o site trata dados de visitantes e como funciona a ferramenta de análise do CNIS.', ['path' => '/privacidade/']);
?>
<!-- TODO: revisar este texto com profissional jurídico antes de publicar. Preencher o responsável e o contato. -->
<article class="texto-legal">
  <h1>Política de privacidade</h1>
  <p class="data">Última atualização: 07/10/2026</p>

  <h2>Quem é o responsável</h2>
  <p>Este site é mantido por <strong>[nome do responsável]</strong>. Para dúvidas sobre privacidade, escreva para <strong>[e-mail de contato]</strong>.</p>

  <h2>Análise de CNIS</h2>
  <p>A ferramenta de análise do CNIS funciona inteiramente no seu navegador. O arquivo ou o texto que você inserir não é enviado a nossos servidores, não é armazenado e não é registrado em nenhum log. Ao fechar ou atualizar a página, os dados são descartados.</p>
  <p>A página da ferramenta não carrega serviços de rastreamento ou publicidade. Ela carrega apenas a biblioteca de leitura de PDF, hospedada no Cloudflare, que não recebe o conteúdo do seu extrato.</p>

  <h2>Dados de navegação</h2>
  <p>O site pode usar o Google Analytics para medir visitas de forma agregada, como páginas acessadas, tempo de leitura e tipo de dispositivo. Esses dados não identificam diretamente você.</p>

  <h2>Publicidade</h2>
  <p>O site pode exibir anúncios do Google AdSense. O Google pode usar cookies para mostrar anúncios com base em visitas anteriores a este e a outros sites. Você pode gerenciar essas preferências em <a href="https://adssettings.google.com" rel="noopener">adssettings.google.com</a>.</p>

  <h2>Cookies</h2>
  <p>Os cookies usados são os do Google Analytics e do Google AdSense, quando ativados. O próprio site não grava cookies. Você pode bloqueá-los nas configurações do seu navegador.</p>

  <h2>Seus direitos</h2>
  <p>Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir confirmação de tratamento, acesso, correção e eliminação de dados pessoais que estejam sob responsabilidade deste site, pelo contato indicado acima.</p>

  <h2>Alterações</h2>
  <p>Esta política pode ser atualizada. A data da última atualização fica sempre indicada no topo desta página.</p>
</article>
<?php page_foot();
