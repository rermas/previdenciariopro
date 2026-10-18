# Análise CNIS

Site em PHP puro, sem banco de dados, com um único roteador (`index.php`). O foco é a ferramenta que analisa o extrato do CNIS: tempo contado, competências com remuneração, salários faltantes e pendências. Inclui blog, página de legislação e política de privacidade.

## Estrutura

```
index.php            roteador, configuração e todas as páginas
assets/style.css     visual
assets/cnis.js       leitura e análise do CNIS, mais a interface da ferramenta
assets/direito.js    "Verificar direito": salário-maternidade e qualidade de segurado
assets/pensao.js     "Verificar direito": pensão por morte
assets/beneficios.js "Verificar direito": auxílio-reclusão e auxílio por incapacidade temporária
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

- Abaixo do mínimo: empregado só deixa de contar (e gera pendência) a partir de 11/2019; antes conta normalmente. Contribuinte individual e facultativo: qualquer época.

### Verificar direito (salário-maternidade)
Bloco logo abaixo do Mapa de competências, com botão "Verificar direito" (usa o extrato já lido). Etapas: fato gerador, categoria, qualidade de segurado (período de graça), carência, validade do CNIS, situações especiais e valor estimado. Normas em `NORMAS` (`assets/direito.js`), com vigência.
- Período de graça: vale até o vencimento da contribuição do mês seguinte ao fim do prazo (dia 15; fim de semana passa para a segunda). Prazo 12 meses (6 na facultativa), 24 com mais de 120 contribuições sem perda, +12 com desemprego involuntário informado. Meses de vínculo anteriores a 07/1994 entram na contagem como presumidos.
- Parto sem qualidade na data: confere a qualidade na DAT (afastamento informado ou 28 dias antes do parto); se existia, o resultado é "provável" e o início passa para a DAT. A IN 128/2022 exceta quem está em período de graça dessa antecipação: confirmar.
- Facultativa com 6 meses vencidos: usa a graça da atividade obrigatória anterior (12/24/+12), se ela ainda cobrir a data.
- Seguro-desemprego/SINE (campo marcado): soma 12 meses ao período de graça do último vínculo de empregado, mesmo que depois haja contribuições como CI/facultativa; ele só evita a perda da qualidade entre o vínculo e o retorno; a categoria, a carência e o valor seguem a filiação do último recolhimento antes do fato gerador.
- Sem carência como CI/MEI/facultativa (fato gerador antes de 05/04/2024): confere o último vínculo de empregado; se ele ainda mantém a qualidade (graça normal, ou com seguro-desemprego/SINE marcado), o benefício é concedido como desempregada, sem carência, com observação no resultado.
- Categoria na data: desempregada em período de graça quando o último vínculo teve fim (ou foi tratado como encerrado, com mais de 2 meses até o fato gerador); se a última contribuição foi de contribuinte individual, MEI ou facultativa e a qualidade se mantém, vale essa categoria. A categoria informada manualmente prevalece.
- Carência: empregada, doméstica e avulsa não têm. Contribuinte individual, MEI, facultativa e segurada especial: 10 contribuições para fato gerador antes de 05/04/2024 (com a regra da metade após perda da qualidade, art. 27-A), dispensada a partir dessa data (ADIs 2.110/2.111 e regulamento do INSS). Confirmar a norma e a vigência antes de usar em peça.
- Vínculo sem data de fim e sem movimento há 3 meses ou mais antes do fato gerador é tratado como encerrado na última remuneração (presunção, avisada no resultado), e não como ativo.
- Nunca presume facultativa ou desempregada pela falta de vínculo, nem fecha vínculo pela última remuneração.
- Testes: `node tests/direito.test.js`.

### Pensão por morte
Escolha "Pensão por morte" na seção Verificar direito. Dados: data do óbito, dependente (cônjuge, companheiro(a), ex-cônjuge com alimentos, filho, filho maior inválido, pai/mãe, irmão), nascimento, início da união, requerimento e marcações (inválido, acidente, dependência econômica).
- Sem carência: basta qualidade de segurado na data do óbito (mesmo módulo de período de graça do salário-maternidade, incluindo benefício em gozo e seguro-desemprego/SINE).
- As 18 contribuições e os 2 anos de união valem só para cônjuge/companheiro(a) e definem a duração (4 meses ou tabela por idade). Acidente ou doença profissional/do trabalho dispensa as duas exigências (art. 77, § 2º-A).
- Tabela por idade: óbito desde 01/01/2021, Portaria ME 424/2020 (22, 28, 31, 42 e 45 anos); de 01/03/2015 a 31/12/2020, Lei 13.135/2015 (21, 27, 30, 41 e 44 anos; art. 375 da IN 128/2022). Antes de 01/03/2015, fora desta verificação. Conferir portaria posterior (art. 77, § 2º-B).
- Filho maior inválido (opção própria): sem limite de idade, mas a invalidez/deficiência precisa ser comprovada em perícia médica (vale para qualquer dependente marcado como inválido).
- Filho: até 21 anos; irmão: até 21 anos (dependência econômica comprovada); inválido ou com deficiência grave: sem limite; pais: vitalícia (dependência econômica comprovada).
- Início: do óbito se o pedido for feito em até 90 dias (180 se menor de 16; inválido ou com deficiência vale como maior de 16, art. 369, § 1º); depois, do requerimento. Filho nascido após o óbito: do nascimento (art. 369-A, IN 212/2026).
- IN 128/2022: instituidor aposentado (exceto por incapacidade) dispensa as 18 contribuições (art. 375, § 3º); cônjuge/companheiro que requer depois do fim da cota tem pedido indeferido (art. 375, § 7º); ex-cônjuge exige prova de alimentos ou ajuda financeira (arts. 372, 373, 375, § 1º); qualidade perdida só se salva por direito adquirido ou incapacidade no período de graça (art. 368).
- Contagem das 18 contribuições: competências válidas do CNIS desde 07/1994 mais meses de vínculo anteriores (presumidos). Valor da pensão não calculado nesta versão.
- Testes: `node tests/pensao.test.js`.

### Auxílio-reclusão
- Carência de 24 contribuições (art. 25, IV), sem dispensa; após perda da qualidade, metade (12) contada da nova filiação (art. 27-A).
- Baixa renda: média dos salários de contribuição dos 12 meses anteriores à prisão contra o limite do ano (tabela `LIMITE_RENDA` em `beneficios.js`, 2019 a 2026; atualizar todo janeiro pela Portaria Interministerial). Sem salário no período: renda zero, com prova.
- Só regime fechado ou prisão provisória (prisões desde 18/01/2019). Impedem: benefício em gozo (aposentadoria, auxílio por incapacidade, pensão, salário-maternidade) e remuneração da empresa.
- Duração e dependentes seguem a pensão por morte (tabelas de idade), contadas da prisão; termina com a soltura. Início: da prisão se pedido em até 90 dias (180 se menor de 16); valor de um salário mínimo, dividido entre os dependentes.
- Testes: `node tests/beneficios.test.js`.

### Auxílio por incapacidade temporária
- Carência de 12 contribuições, dispensada para acidente de qualquer natureza, doença profissional/do trabalho e doenças da lista oficial; segurado especial precisa de 12 meses de atividade rural.
- Qualidade conferida na DII (data de início da incapacidade), não no requerimento. Incapacidade anterior à filiação nega o benefício, salvo agravamento.
- Início: empregado (exceto doméstico) a partir do 16º dia do afastamento; demais, da DII; pedido com mais de 30 dias do afastamento conta da DER. Conclusão sempre "depende da perícia médica". Valor não calculado (exige correção monetária).

### O que ainda falta validar

Os testes usam um extrato fictício no layout do Portal CNIS; a leitura também foi conferida contra um extrato real de 14 páginas. Antes de confiar nos resultados, teste com uns vinte extratos reais, de origens diferentes. O ponto mais sensível é a leitura de vínculos e remunerações em PDFs com layouts distintos.

## Deploy

Git Version Control do cPanel, com o site em `/home1/simul637/public_html/previdenciariopro/`.

- O `.cpanel.yml` copia para a pasta do site apenas `index.php`, `.htaccess`, `robots.txt`, `ads.txt`, `assets/` e `posts/`. Use **Deploy HEAD Commit** depois de **Update from Remote**.
- Se o repositório foi clonado dentro da própria pasta do site, o `.cpanel.yml` não faz nada e basta **Update from Remote**.
- Envie sempre pelo Git, com as pastas. O upload pelo navegador do GitHub não leva pastas e deixa o site sem `assets/` (sem CSS) e sem `posts/`.
- O domínio precisa de certificado SSL válido, porque o `.htaccess` redireciona tudo para HTTPS. No cPanel: SSL/TLS Status, **Run AutoSSL**.

### Complementação e vínculo comprovado (carência)
Quando faltam contribuições para a carência (salário-maternidade, auxílio-reclusão e auxílio por incapacidade temporária) e as competências abaixo ainda a completariam, a ferramenta pergunta (Sim/Não) e refaz o cálculo:
- Empregado abaixo do salário mínimo desde 11/2019: "o segurado pretende complementar?" Se sim, conta como carência no valor do mínimo, sem cortar o vínculo.
- Vínculo de empregado com competências sem remuneração: "o vínculo está comprovado?" Se sim, todas contam como carência, no valor do mínimo.
- Contribuinte individual/facultativo abaixo do mínimo (desde 07/1994): "pretende complementar?" Se sim, conta como mínimo.
- Após perda da qualidade (art. 27-A), as competências complementadas só valem se posteriores ao retorno.
- Último vínculo de empregado em aberto no fato gerador é considerado ativo, mesmo sem recolhimento nos meses anteriores (não se presume demissão no dia 30 do último recolhimento). Vale apenas para "Verificar direito"; a contagem de tempo do mapa não muda.
- Pensão por morte não tem essas perguntas (sem carência).

### Benefício por incapacidade e carência
Meses dentro de auxílio por incapacidade (ou aposentadoria por incapacidade) pago por inteiro não contam como carência. Contam apenas o mês de início, se o benefício começou depois do dia 1, e o mês de saída, se terminou antes do último dia, e só havendo remuneração de empregado ou recolhimento no mês. Auxílio-acidente não entra nessa regra. Vale para o resumo do CNIS e para todas as verificações de direito.

### Facultativo concomitante
A contribuição de facultativo só vale em meses sem vínculo de empregado ou contribuinte individual e sem salário-maternidade, auxílio por incapacidade ou aposentadoria, mesmo que por um único dia do mês. Nesses meses o recolhimento é desconsiderado de todas as contagens (carência, mapa, tempo contado, qualidade de segurado) e uma pendência lista as competências afetadas.

### Cor do segurado especial e do empregado rural
Meses de vínculo de segurado especial, de tipo rural ou de empregado cujo empregador tem nome de atividade rural (fazenda, sítio, chácara, agrícola, granja etc.) aparecem em marrom claro no mapa. Se outra atividade tiver remuneração no mesmo mês, prevalece a cor dela.

## Aposentadoria por idade (urbana e rural)

Módulo `assets/idade.js` (testes em `tests/idade.test.js`), no bloco "Verificar direito". Informa sexo, nascimento e DER.

- **Urbana:** filiação até 13/11/2019: mulher 60 anos (+6 meses por ano desde 2020, até 62) e homem 65, com 15 anos de contribuição; filiação depois: mulher 62/15 anos e homem 65/20 anos. Carência de 180 meses (tabela do art. 142 para inscritos até 24/07/1991).
- **Conta como carência:** vínculo de empregado (presumido), doméstico presumido desde 06/2015, CI/facultativo/MEI em dia e no mínimo (até 02/1994 e sem data de pagamento = em dia), salário-maternidade, benefício por incapacidade conforme as ACPs. Não conta: segurado especial, atraso fora da manutenção da qualidade, pagamento após a DER, RPPS.
- **Rural:** 55/60 anos e 180 meses de atividade rural (segurado especial e empregado rural), com aviso se a última atividade no CNIS for anterior em mais de 12 meses.
- **Premissas a conferir:** tabela do art. 142 (confirmada pelo texto da lei: vale para inscritos urbanos até 24/07/1991 e para o trabalhador rural) pelo ano em que a idade é completada, até 2010 (2011 em diante: 180); "filiação" = primeiro vínculo válido do CNIS; janela de atraso começa 14 meses após a perda; empregado rural identificado por tipo ou nome do empregador; a híbrida será feita depois.

### Aposentadoria por idade híbrida

Opção "híbrida" no mesmo módulo: usa a idade e o tempo mínimo da aposentadoria urbana e soma o tempo rural (segurado especial e empregado rural, em qualquer data) sem exigir recolhimento, na carência e no tempo de contribuição. Premissas: idade e tempo de contribuição iguais aos da urbana (inclusive 20 anos para o homem filiado depois de 13/11/2019); o tempo rural vale mesmo que a última atividade seja urbana (Tema 1007 do STJ); a tabela do art. 142 usa a data do primeiro vínculo, rural ou urbano.

## Aposentadoria por tempo de contribuição (regras de transição)

Módulo `assets/tempo.js` (testes em `tests/tempo.test.js`). Avalia, de uma vez, as quatro regras da EC 103/2019 para quem era filiado até 13/11/2019: pontos (art. 15), idade mínima progressiva (art. 16), pedágio de 50% (art. 17) e pedágio de 100% (art. 20). Para cada uma mostra os requisitos, a situação na DER e, se não cumprida, a data em que seria, mantidas as contribuições.

- **Enquadramento:** o CNIS não informa atividade especial. Um editor permite marcar trechos por vínculo (ou fora do CNIS) como especial de 15/20/25 anos, período indenizado/CTC (conta como comum) ou desconsiderar. Fica só no navegador; dá para salvar e carregar em arquivo JSON.
- **Conversão:** o especial é convertido pelos fatores do Decreto 3.048, art. 70 (mulher 2,00/1,50/1,20; homem 2,33/1,75/1,40) só até 13/11/2019; depois conta como tempo simples.
- **Tempo contado:** emprego (presumido), CI/facultativo no mínimo, só nas competências com contribuição lançada (inclusive pagas em atraso; mês sem recolhimento não conta, inclusive antes de 07/1994), salário-maternidade, benefício por incapacidade intercalado e segurado especial até 31/10/1991 sem recolhimento (de 11/1991 em diante só se o usuário responder que vai indenizar). A carência (180 meses) usa as regras da aposentadoria por idade.
- **Premissas:** pontos somam idade fracionada (dias/365,25) e tempo (dias/365); a qualidade de segurado não é exigida (Lei 10.666, art. 3º); alíquotas reduzidas de 5/11/12% não são detectáveis no CNIS; só as quatro regras de transição (não a regra permanente nem professor/especial/PcD).

## Relatórios em PDF

- **Gerar relatório (PDF)** (ao lado de "Copiar resumo" e "Imprimir"): análise do CNIS e pendências, sem o "Mapa de competências" e sem o bloco "Verificar direito".
- **Gerar relatório da simulação (PDF)** (dentro de "Verificar direito"): só o resultado da verificação feita.
- Funcionam pela impressão do navegador ("Salvar como PDF"), com classes `rel-analise`/`rel-direito` no `body` e regras em `@media print` (`assets/style.css`). Nada é enviado a servidor, compatível com a CSP `connect-src 'none'`.

## Versão em arquivo único (offline)

`node tools/gerar-offline.js` gera `dist/analise-cnis.html`: a ferramenta inteira (CSS, fontes, leitor de PDF e todos os módulos) em um HTML só, que abre com duplo clique, sem internet e sem servidor. Gere de novo a cada alteração nos arquivos de `assets/`.

## Tempo rural na análise geral

- O "Tempo contado" inclui segurado especial e empregado rural. Segurado especial sem data de fim conta até hoje, ou até o dia anterior ao início de aposentadoria concedida depois do início do período (com aviso).
- Cada benefício decide em "Verificar direito" se esse período entra (tempo e carência); a análise geral traz só a observação.
- O tipo vem de "Tipo Filiado no Vínculo"; se for "Empregado", o nome do empregador (fazenda, sítio, haras etc.) indica emprego rural. No mapa: marrom claro = segurado especial, marrom mais escuro = empregado rural.
- Células do PDF quebradas em duas linhas (primeira linha acima do registro) são reagrupadas ao registro correto.

## Vínculos incluídos manualmente

Em "Verificar direito" há o bloco "Vínculos que faltam no CNIS (opcional)": nome, tipo (empregado, empregado rural, segurado especial, contribuinte individual, CTC), início e fim. Os vínculos entram na análise usada pela simulação (`DIREITO.comExtras`), com Seq. a partir de 9001, e valem para todos os benefícios. CTC conta como empregado urbano; contribuinte individual é tratado como recolhido no mínimo em todas as competências. A contagem é por dia (tempo) e por competência (carência), então sobreposições não somam em dobro. O resultado traz a observação de que o tempo incluído deve ser comprovado no INSS e aceito conforme a legislação em vigor.

## Aposentadoria especial e por incapacidade permanente

Em "Verificar direito":

- **Aposentadoria especial** (IN PRES/INSS 128, arts. 260 a 262): usa o mesmo enquadramento do tempo (natureza de 15, 20 ou 25 anos), sem conversão em tempo comum. Para cada natureza avalia a regra permanente de idade (55/58/60, só para filiados a partir de 14/11/2019), o direito adquirido até 13/11/2019 (art. 261, sem idade mínima) e os pontos (66/76/86, filiados até 13/11/2019, idade e tempo em dias). A natureza de um tempo não completa a de outro. Valor não calculado.
- **Aposentadoria por incapacidade permanente**: reaproveita a verificação do auxílio temporário (qualidade na DII, carência de 12 com dispensas, preexistência), com início (conversão do auxílio, art. 43), reavaliação, grande invalidez (+25%) e estimativa do percentual da EC 103 (60% + 2% por ano acima de 20 anos, homem, ou 15, mulher; 100% se acidente de trabalho).

## Aposentadoria do professor

Em "Verificar direito" > "Aposentadoria do professor (educação básica)" (IN PRES/INSS 128, arts. 250 a 254). O CNIS não informa a função, então a pessoa marca os vínculos de magistério numa lista; os que têm no nome colégio, escola, município, prefeitura, estado, secretaria, educação, ensino ou creche já vêm marcados (filtro `RX_PROF` em `assets/tempo.js`). Só o tempo desses vínculos (sem contar o concomitante duas vezes) entra no tempo de magistério; a carência usa todos os vínculos. Regras avaliadas: permanente (57/60 anos, filiados desde 14/11/2019), direito adquirido até 13/11/2019 (com a variante do acréscimo de 17%/20% sobre o tempo até 16/12/1998), pontos (81/91, +1 por ano até 92/100), idade progressiva (51/56, +6 meses por ano até 57/60) e pedágio de 100% (52/55 anos). Valor não calculado.

## Aposentadoria da pessoa com deficiência

Duas opções em "Verificar direito" (LC 142/2013; IN PRES/INSS 128, arts. 303 a 315): **por tempo de contribuição** (20/24/28 anos mulher e 25/29/33 homem, para deficiência grave/moderada/leve) e **por idade** (55/60 anos e 15 anos de contribuição como pessoa com deficiência). O CNIS não informa a deficiência: a pessoa informa os períodos (grau, início do impedimento, fim opcional). O tempo como pessoa com deficiência é o contribuído por dia dentro desses períodos (sem contar o concomitante duas vezes); havendo alternância de graus ou de tempo com e sem deficiência, converte-se para o grau preponderante pela tabela do Anexo XVIII (fatores citados de memória em `CONV_PCD`, em `assets/tempo.js`: confira). Não aplica a conversão do tempo especial (Anexo XIX). Exige deficiência na DER.

## Comparador de regras e conferência das tabelas

- **"Comparar todas as aposentadorias"** (botão no bloco de dados da aposentadoria): roda de uma vez idade urbana, as 4 regras de transição por tempo, a especial (se houver período enquadrado), a do professor (se houver vínculos marcados) e as da pessoa com deficiência (se houver períodos), e mostra uma tabela com a situação na DER e a data em que cada regra seria cumprida. Não calcula valor.
- **Tempo contado no resumo** agora inclui o benefício por incapacidade intercalado com atividade (Lei 8.213, art. 55, II); o resumo mostra também o tempo só dos vínculos (`resumo.duracaoVinculos`).
- **Conferidos com o texto oficial** (outubro/2026): fatores de conversão do tempo especial (Decreto 3.048, art. 70), tabela de conversão da pessoa com deficiência (Decreto 3.048, art. 70-E), tabela do art. 142 da Lei 8.213, pontos e idades dos arts. 15, 16, 17, 19, 20 e 21 da EC 103 e percentuais do art. 26. Ajuste: o pedágio de 50% exige **mais de** 28 (mulher) ou 33 (homem) anos em 13/11/2019.

## Direito adquirido antes da EC 103/2019

Opção "Aposentadoria por tempo: direito adquirido antes da EC 103/2019" (e linhas no comparador). Avalia, com o tempo convertido pelo enquadramento: tempo de serviço integral e proporcional até 16/12/1998; integral até 28/11/1999 (sem fator previdenciário); proporcional da EC 20 (53/48 anos e pedágio de 40%); integral até 13/11/2019 (30/35 anos, com fator); e a fórmula 85/95 progressiva (Lei 13.183/2015). Para cada regra mostra os requisitos na data limite, a data em que foram implementados (busca binária dia a dia) e a carência pela tabela do art. 142 do ano da implementação. Não calcula valor.

## Lançamento manual de tempo

Sem o PDF, o botão "Lançar tempo manualmente" (em `/analise-cnis/`) abre uma lista de períodos: tipo de vínculo (empregado, doméstico, contribuinte individual, facultativo ou segurado especial), início e fim (em branco = em aberto). `CNIS.gerarTextoManual` monta um extrato sintético com o salário mínimo de cada competência (a partir de 07/1994) e ele passa pela mesma análise do PDF, então todas as simulações de benefício funcionam. O resultado traz um aviso fixo de que é estimativa. Nada é salvo ou enviado.

## Indicadores do CNIS (Anexo V da Portaria DIRBEN/INSS 990/2022)

`dados/indicadores.json` traz os 205 códigos do Anexo V (alterado pela Portaria DIRBEN/INSS 1.316/2025): descrição e esclarecimento oficiais e o efeito no reconhecimento de direitos (`impacto`). Ele é gerado por `python3 tools/indicadores_anexo_v.py AnexoV.pdf` (a classificação fica no script) e copiado para `assets/cnis.js` por `node tools/gerar-indicadores.js`. O site monta `/indicadores/` e uma página por código a partir dele.

Na análise, por padrão:
- `vinculo` no cabeçalho do vínculo (PEXT, PDIV-DADOS-GFIP, PEMP-CAD, PVIN-IRREG, PVIN-REC-PROC-TRAB, PRPSE, AEXT-IND...): o vínculo fica fora do tempo e da carência. PEXT com AEXT-VT/VTJ/VTR e PDIV com ADIV não excluem;
- `competencia` (PREM-EXT, PREM-FVIN, PREM-EMPR, PREC-FACULTCONC, PREC-FBR, PREC-PMIG-DOM...) e `vinculo` dentro de uma competência: só a competência sai;
- `mandato` (PVIN-MAND-ELETIVO-TOTAL, PVIN-ME): sai o trecho até 18/09/2004;
- `datas-*` (processo trabalhista que muda admissão ou desligamento): sai o trecho antes da primeira e depois da última remuneração;
- `idade-minima` (PDT-NASC-FIL-INV): sai o trecho antes da idade mínima da época, se o extrato tiver a data de nascimento;
- `tc` (IREC-LC123, IREC-MEI, IREC-FBR): só fica fora da aposentadoria por tempo de contribuição, com pergunta sobre a complementação para 20%.

A análise guarda em `semExclusao` a conta com tudo regularizado, e "Verificar direito" tem a opção de simular assim.
