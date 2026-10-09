# Análise CNIS

Site em PHP puro, sem banco de dados, com um único roteador (`index.php`). O foco é a ferramenta que analisa o extrato do CNIS: tempo contado, competências com remuneração, salários faltantes e pendências. Inclui blog, página de legislação e política de privacidade.

## Estrutura

```
index.php            roteador, configuração e todas as páginas
assets/style.css     visual
assets/cnis.js       leitura e análise do CNIS, mais a interface da ferramenta
assets/direito.js    "Verificar direito" (hoje só salário-maternidade)
assets/vendor/       pdf.js (hospedado aqui, nada vem de domínio externo)
assets/fonts/        Atkinson Hyperlegible
posts/*.html         texto de cada artigo do blog
tests/cnis.test.js   testes da análise (node tests/cnis.test.js)
.htaccess            HTTPS, URLs limpas, bloqueio de posts/ e tests/
```

## Indicadores do CNIS

Cada indicador tem uma página em `/indicadores/{codigo}/` (lista em `/indicadores/`), geradas do array `$INDICADORES` em `index.php`. Textos marcados com "Legenda do extrato" foram conferidos em extratos reais; os demais seguem a prática previdenciária e devem ser revisados por um advogado antes de divulgar. Para acrescentar um indicador, basta incluir uma entrada no array; ele entra no sitemap sozinho.

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
- Lê o layout do Portal CNIS: remunerações em grade de 3 colunas, 13º em seção separada (não entra na contagem), benefícios e eventos em tabela própria. Vínculos aparecem em ordem de data de início.
- Aceita também o resumo "Relações Previdenciárias" (sem remunerações): conta o tempo, lista benefícios e indicadores, usa "Últ. Remun." para apontar possíveis meses finais sem salário e avisa que os faltantes só podem ser avaliados no Extrato completo. Recolhimentos de contribuinte individual ("Contribuições") usam o salário de contribuição.
- Seções novas: competências abaixo do salário mínimo (tabela de mínimos em `MINIMOS`, a conferir), lacunas de 7 dias ou mais sem vínculo nem benefício, carência por competências (12, 10 e 180) e alertas de valor muito diferente dos vizinhos e de empregador duplicado.
- Vínculo sem data de fim é contado até o fim do mês da última remuneração (nunca depois de hoje) e recebe uma nota.
- Mês faltante dentro de período de benefício por incapacidade, ou com remuneração em outro vínculo, é sinalizado como tal.
- Meses anteriores a 07/1994 sem remuneração não entram na contagem de faltantes, porque o CNIS costuma não trazer salários desse período.
- Os significados dos indicadores vêm de artigos de escritórios de advocacia previdenciária e estão em `INDICADORES` (`assets/cnis.js`). O código original sempre aparece junto.

### Verificar direito (salário-maternidade)
Bloco logo abaixo do Mapa de competências, com botão "Verificar direito" (usa o extrato já lido). Etapas: fato gerador, categoria, qualidade de segurado (período de graça), carência, validade do CNIS, situações especiais e valor estimado. Normas em `NORMAS` (`assets/direito.js`), com vigência.
- Período de graça: vale até o vencimento da contribuição do mês seguinte ao fim do prazo (dia 15; fim de semana passa para a segunda). Prazo 12 meses (6 na facultativa), 24 com mais de 120 contribuições sem perda, +12 com desemprego involuntário informado. Meses de vínculo anteriores a 07/1994 entram na contagem como presumidos.
- Carência dispensada (ADIs 2.110/2.111 e regulamento do INSS). Confirmar a norma e a vigência antes de usar em peça.
- Nunca presume facultativa ou desempregada pela falta de vínculo, nem fecha vínculo pela última remuneração.
- Testes: `node tests/direito.test.js`.

### O que ainda falta validar

Os testes usam um extrato fictício no layout do Portal CNIS; a leitura também foi conferida contra um extrato real de 14 páginas. Antes de confiar nos resultados, teste com uns vinte extratos reais, de origens diferentes. O ponto mais sensível é a leitura de vínculos e remunerações em PDFs com layouts distintos.

## Deploy

Git Version Control do cPanel, com o site em `/home1/simul637/public_html/previdenciariopro/`.

- O `.cpanel.yml` copia para a pasta do site apenas `index.php`, `.htaccess`, `robots.txt`, `ads.txt`, `assets/` e `posts/`. Use **Deploy HEAD Commit** depois de **Update from Remote**.
- Se o repositório foi clonado dentro da própria pasta do site, o `.cpanel.yml` não faz nada e basta **Update from Remote**.
- Envie sempre pelo Git, com as pastas. O upload pelo navegador do GitHub não leva pastas e deixa o site sem `assets/` (sem CSS) e sem `posts/`.
- O domínio precisa de certificado SSL válido, porque o `.htaccess` redireciona tudo para HTTPS. No cPanel: SSL/TLS Status, **Run AutoSSL**.
