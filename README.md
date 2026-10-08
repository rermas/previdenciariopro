# Análise CNIS

Site em PHP puro, sem banco de dados, com um único roteador (`index.php`). O foco é a ferramenta que analisa o extrato do CNIS: tempo contado, competências com remuneração, salários faltantes e pendências. Inclui blog, página de legislação e política de privacidade.

## Estrutura

```
index.php            roteador, configuração e todas as páginas
assets/style.css     visual
assets/cnis.js       leitura e análise do CNIS, mais a interface da ferramenta
assets/vendor/       pdf.js (hospedado aqui, nada vem de domínio externo)
assets/fonts/        Atkinson Hyperlegible
posts/*.html         texto de cada artigo do blog
tests/cnis.test.js   testes da análise (node tests/cnis.test.js)
.htaccess            HTTPS, URLs limpas, bloqueio de posts/ e tests/
```

## Antes de publicar

1. Em `index.php`, ajuste `SITE_URL` para o domínio final. Faça o mesmo em `robots.txt`.
2. Em "Política de privacidade" (`index.php`), preencha o responsável e o contato e revise o texto com um profissional jurídico.
3. Troque o domínio de exemplo e confira os links da página de legislação.

## Analytics e AdSense

- Analytics: preencha `GA_ID`. Vazio, nada é carregado.
- AdSense: preencha `ADSENSE`, mantenha `ADS_ATIVOS = false` até a aprovação e depois mude para `true`. Coloque a linha do seu painel em `ads.txt`.
- Anúncios aparecem só nos artigos. A página da ferramenta nunca carrega Analytics nem anúncios.

## Blog

Cada artigo é uma entrada em `$POSTS` (`index.php`) e um arquivo `posts/{slug}.html`. A `data` no futuro mantém o artigo oculto até o dia, sem tocar no servidor.

## Ferramenta

- Fica em `/analise-cnis/`, sem links no site. Mantém `noindex` e fora do sitemap enquanto `FERRAMENTA_PUBLICA = false`. Para lançar, mude para `true`: o menu, a home e o sitemap passam a incluí-la.
- O processamento é todo no navegador. A página envia uma Content-Security-Policy com `connect-src 'none'`, então ela não consegue abrir conexões de saída.
- PDFs escaneados (imagem) não têm texto: a pessoa precisa colar o texto do extrato.
- Meses anteriores a 07/1994 sem remuneração não entram na contagem de faltantes, porque o CNIS costuma não trazer salários desse período.
- Os significados dos indicadores vêm de artigos de escritórios de advocacia previdenciária e estão em `INDICADORES` (`assets/cnis.js`). O código original sempre aparece junto.

### O que ainda falta validar

Os testes usam um extrato fictício, escrito a partir do que se conhece do layout do CNIS. Antes de confiar nos resultados, teste com uns vinte extratos reais, de origens diferentes. O ponto mais sensível é a leitura de vínculos e remunerações em PDFs com layouts distintos.

## Deploy

Git Version Control do cPanel, com o site em `/home1/simul637/public_html/previdenciariopro/`.

- O `.cpanel.yml` copia para a pasta do site apenas `index.php`, `.htaccess`, `robots.txt`, `ads.txt`, `assets/` e `posts/`. Use **Deploy HEAD Commit** depois de **Update from Remote**.
- Se o repositório foi clonado dentro da própria pasta do site, o `.cpanel.yml` não faz nada e basta **Update from Remote**.
- Envie sempre pelo Git, com as pastas. O upload pelo navegador do GitHub não leva pastas e deixa o site sem `assets/` (sem CSS) e sem `posts/`.
- O domínio precisa de certificado SSL válido, porque o `.htaccess` redireciona tudo para HTTPS. No cPanel: SSL/TLS Status, **Run AutoSSL**.
