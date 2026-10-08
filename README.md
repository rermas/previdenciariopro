# Análise CNIS: site

Site leve em PHP puro, sem banco de dados. Tem a ferramenta de análise do extrato CNIS (contagem de tempo, meses sem remuneração e pendências), um blog de guias e política de privacidade.

## Estrutura

```
index.php                 página inicial (sem link para a ferramenta)
analise-cnis/index.php    ferramenta de análise (oculta: noindex, sem rastreadores)
assets/js/cnis.js         lógica de análise e interface (sem dependências, exceto pdf.js)
assets/css/style.css      estilo claro
blog/index.php            listagem e leitura de artigos (?p=slug)
blog/posts.php            lista de artigos com data de publicação
blog/conteudo/*.html      texto de cada artigo
privacidade/index.php     política de privacidade
includes/layout.php       cabeçalho, rodapé, Analytics e AdSense
config.php                domínio, IDs de Analytics e AdSense
tests/cnis.test.js        testes da lógica de análise
```

## Configuração antes de publicar

1. Em `config.php`, ajuste `SITE_URL` para o domínio final.
2. Em `privacidade/index.php`, preencha o responsável e o contato (há um `TODO` no código). Revise o texto com um profissional jurídico.
3. Em `sitemap.php` e `robots.txt`, troque `www.seudominio.com.br` pelo domínio.

## Analytics e AdSense

- Analytics: preencha `GA_ID` em `config.php`. Sem ID, nada é carregado.
- AdSense: preencha `ADSENSE_CLIENT`, mantenha `ADS_ENABLED = false` até a aprovação, depois mude para `true`.
- Após aprovação, troque a linha de `ads.txt` pelo seu ID de editor.
- Os anúncios aparecem só nos artigos. A página da ferramenta nunca carrega rastreadores nem anúncios.

## Agendar um artigo

Adicione uma entrada em `blog/posts.php` com `date` futura. O artigo fica oculto até a data e aparece sozinho no dia, sem nenhuma alteração no servidor. O texto vai em `blog/conteudo/<slug>.html`.

## Ferramenta de análise

- Processamento 100% no navegador. Nenhum arquivo ou texto é enviado ao servidor.
- Lê PDF com texto selecionável pelo pdf.js (carregado do cdnjs). PDFs escaneados precisam que o texto seja colado manualmente.
- Os cálculos estão em `assets/js/cnis.js`. Rode os testes com `node tests/cnis.test.js`.
- Os testes usam um extrato sintético. Antes de considerar a leitura confiável, valide com extratos reais, de layouts diferentes.
- Não há verificação de carência nesta versão. Ela entra em uma etapa posterior.

## Antes de liberar a ferramenta

Quando for hora de abrir `/analise-cnis/` ao público:

1. Remova `'noindex' => true` de `analise-cnis/index.php`.
2. Adicione o link da ferramenta na página inicial e no menu.
3. Inclua a página no `sitemap.php`.

## Deploy

Mesmo fluxo do projeto de placas: repositório no GitHub com deploy via Git Version Control do cPanel. O `.htaccess` cuida das URLs limpas (`/blog/slug/`, `/sitemap.xml`) e força HTTPS.
