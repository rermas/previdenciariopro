<?php
/*
 * Análise CNIS: PHP puro, sem banco de dados, com um único roteador.
 * Rotas: /  /blog/  /blog/{slug}/  /perguntas/  /perguntas/{slug}/  /glossario/  /glossario/{termo}/  /indicadores/  /indicadores/{codigo}/  /legislacao/  /legislacao/{tema}/  /privacidade/  /analise-cnis/  /sitemap.xml
 */

// ---------- Configuração ----------
const SITE_NOME = 'Análise CNIS';
const SITE_URL = 'https://previdenciariopro.com.br'; // domínio final, sem barra no fim
const GA_ID = 'G-8YQ7F9NREV';     // Google Analytics 4. Vazio: o Analytics não é carregado.
const ADSENSE = '';               // 'ca-pub-XXXXXXXXXXXXXXXX'. Vazio: sem anúncios.
const ADS_ATIVOS = false;         // true só depois da aprovação do AdSense.
const FERRAMENTA_PUBLICA = false; // true: links para a ferramenta, indexação liberada e sitemap.

date_default_timezone_set('America/Sao_Paulo');

// Artigos: o texto de cada um fica em posts/{slug}.html.
// 'data' no futuro mantém o artigo oculto até o dia.
$POSTS = [
    ['slug' => 'o-que-e-o-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-18',
     'titulo' => 'O que é o CNIS e o que conferir no extrato',
     'resumo' => 'Entenda o que aparece no extrato do CNIS e quais pontos merecem conferência.'],
    ['slug' => 'salarios-faltantes-no-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-07',
     'titulo' => 'Salários faltantes no CNIS: como identificar',
     'resumo' => 'O que significa uma competência sem remuneração, quando isso é esperado e como conferir.'],
    ['slug' => 'qualidade-de-segurado-e-periodo-de-graca', 'data' => '2026-10-13', 'revisado' => '2026-10-13',
     'titulo' => 'Qualidade de segurado e período de graça: prazos e como conferir',
     'resumo' => 'Quanto tempo a proteção da Previdência dura depois de parar de contribuir e o que olhar no CNIS.'],
    ['slug' => 'como-emitir-o-extrato-do-cnis', 'data' => '2026-10-13', 'revisado' => '2026-10-18',
     'titulo' => 'Como emitir o extrato do CNIS no Meu INSS e o que conferir',
     'resumo' => 'Passo a passo gratuito para tirar o extrato, qual tipo escolher e quando pedir a atualização do CNIS.'],
    ['slug' => 'como-baixar-o-cnis-em-pdf-com-remuneracoes', 'data' => '2026-10-18', 'revisado' => '2026-10-18',
     'titulo' => 'Como baixar o CNIS em PDF com remunerações pelo Meu INSS',
     'resumo' => 'Passo a passo com as telas do aplicativo Meu INSS para baixar o extrato do CNIS em PDF com vínculos, contribuições e remunerações.',
     'imagem' => '/assets/img/meu-inss-5-vinculos-contribuicoes-remuneracoes.webp'],
    ['slug' => 'aposentadoria-por-idade-regras-e-carencia', 'data' => '2026-10-13', 'revisado' => '2026-10-17',
     'titulo' => 'Aposentadoria por idade: regras, carência e o que o CNIS mostra',
     'resumo' => 'Idade, tempo de contribuição e carência na aposentadoria por idade urbana e rural, e como conferir no CNIS.'],
    ['slug' => 'documentos-para-comprovar-vinculo-de-emprego', 'data' => '2026-10-14', 'revisado' => '2026-10-14',
     'titulo' => 'Documentos para comprovar vínculo de emprego que não está no CNIS',
     'resumo' => 'Quais documentos o INSS aceita para provar um período de emprego ausente ou duvidoso no CNIS, e como organizá-los.'],
    ['slug' => 'como-comprovar-remuneracoes-no-cnis', 'data' => '2026-10-15', 'revisado' => '2026-10-15',
     'titulo' => 'Como comprovar remunerações que faltam ou estão erradas no CNIS',
     'resumo' => 'Documentos que provam salários de contribuição e o que mudou para vínculo sem remuneração, com a IN 212/2026.'],
    ['slug' => 'vinculo-extemporaneo-no-cnis', 'data' => '2026-10-16', 'revisado' => '2026-10-16',
     'titulo' => 'Vínculo ou remuneração extemporânea no CNIS: o que significa',
     'resumo' => 'Quando o INSS considera uma informação extemporânea, o que isso muda e como superar a exigência de prova.'],
    ['slug' => 'contribuicoes-em-atraso-contribuinte-individual-e-facultativo', 'data' => '2026-10-19', 'revisado' => '2026-10-19',
     'titulo' => 'Contribuições em atraso de contribuinte individual e facultativo',
     'resumo' => 'O que muda quando a contribuição é paga fora do prazo: carência, qualidade de segurado, juros e multa.'],
    ['slug' => 'complementacao-de-contribuicao-abaixo-do-minimo', 'data' => '2026-10-20', 'revisado' => '2026-10-20',
     'titulo' => 'Contribuição abaixo do salário mínimo: como complementar',
     'resumo' => 'Quando uma competência abaixo do mínimo não conta, o que é complementação e a regra das alíquotas reduzidas.'],
    ['slug' => 'indenizacao-de-periodos-sem-contribuicao', 'data' => '2026-10-21', 'revisado' => '2026-10-21',
     'titulo' => 'Indenização de período sem contribuição: quando é necessária',
     'resumo' => 'Quando o tempo só conta se for indenizado, a diferença para contribuição em atraso e como pedir o cálculo.'],
    ['slug' => 'atrasados-do-beneficio-data-de-entrada-do-requerimento', 'data' => '2026-10-22', 'revisado' => '2026-10-22',
     'titulo' => 'Atrasados do benefício: DER, exigências e prazo de cinco anos',
     'resumo' => 'Como a data do requerimento define o início do pagamento, quando há atrasados e o que a prescrição limita.'],
    ['slug' => 'empregado-domestico-como-comprovar-vinculo-e-contribuicao', 'data' => '2026-10-23', 'revisado' => '2026-10-23',
     'titulo' => 'Empregado doméstico: como comprovar vínculo e contribuições',
     'resumo' => 'Provas do vínculo doméstico e a presunção de recolhimento desde 06/2015, com a Lei Complementar 150.'],
    ['slug' => 'segurado-especial-cadastro-autodeclaracao-e-prova-rural', 'data' => '2026-10-26', 'revisado' => '2026-10-26',
     'titulo' => 'Segurado especial: cadastro, autodeclaração e prova da atividade rural',
     'resumo' => 'Como o CNIS registra o trabalhador rural, os prazos de atualização do cadastro e os documentos de prova.'],
    ['slug' => 'exigencia-do-inss-prazo-e-como-responder', 'data' => '2026-10-27', 'revisado' => '2026-10-27',
     'titulo' => 'Exigência do INSS: prazo de 30 dias e como responder pelo Meu INSS',
     'resumo' => 'O que fazer ao receber uma exigência, o que muda com a IN 212/2026 e como acompanhar o pedido.'],
];

// Textos oficiais listados em /legislacao/ (chaves de dados/fontes.json) com uma linha sobre cada norma.
$NORMAS = [
    'cf' => 'Base do sistema: arts. 194 a 204 tratam da seguridade social, e o art. 201 da Previdência.',
    'ec103' => 'Reforma da Previdência: regras de transição, cálculo pela média de 100%, pensão e acumulação.',
    'lei8213' => 'Planos de benefícios: segurados, carência, tempo de contribuição, CNIS e cada benefício.',
    'lei8212' => 'Custeio: alíquotas, salário de contribuição, prazos de pagamento e indenização.',
    'dec3048' => 'Regulamento da Previdência Social, que detalha a aplicação das duas leis.',
    'lc150' => 'Trabalho doméstico, Simples Doméstico e presunção de recolhimento.',
    'lc123' => 'MEI e a contribuição de 5% embutida no DAS.',
    'lc142' => 'Aposentadoria da pessoa com deficiência, mantida pela EC 103/2019.',
    'lei8742' => 'Lei Orgânica da Assistência Social, com o BPC.',
    'lei10666' => 'Perda da qualidade de segurado nas aposentadorias e retenção de 11% pela empresa.',
    'lei9876' => 'Fator previdenciário e início do período básico de cálculo em 07/1994.',
    'in128' => 'Instrução Normativa PRES/INSS 128/2022, alterada depois (inclusive pela IN 212/2026): como o INSS aplica as normas.',
    'portaria990' => 'Normas procedimentais do INSS sobre o CNIS.',
    'anexov' => 'Relação oficial dos indicadores do extrato do CNIS.',
];
const NORMAS_CONFERIDAS_EM = '20/10/2026';

// Legislação comentada: uma página por tema em dados/legislacao/{slug}.json, com a marcação do glossário e [[leg:slug|texto]].
// Teste: node tests/legislacao.test.js
const LEGISLACAO_REVISADA = '2026-10-20';
const GRUPOS_LEGISLACAO = [
    'lei8213' => 'Lei 8.213/1991: planos de benefícios', 'ec103' => 'Emenda Constitucional 103/2019: Reforma da Previdência',
    'lei8212' => 'Lei 8.212/1991: custeio', 'outras' => 'Outras normas',
];

// Indicadores do CNIS: uma página por código em /indicadores/{codigo}/.
// A lista, a descrição oficial, o esclarecimento e o efeito vêm de dados/indicadores.json (Anexo V da Portaria DIRBEN/INSS 990/2022,
// alterada pela Portaria DIRBEN/INSS 1.316/2025). Os textos abaixo complementam os códigos mais comuns com explicação e o que conferir.
const INDICADORES_REVISADOS = '2026-10-18';
$INDICADORES_TEXTO = [
    'PSC-MEN-SM-EC103' => [
        'curto' => 'Competência com valor abaixo do salário mínimo, desde 11/2019.',
        'sig' => 'A soma dos salários de contribuição da competência ficou abaixo do salário mínimo mensal. Desde a Emenda Constitucional 103/2019, uma competência nessa situação só conta se for ajustada.',
        'imp' => 'Sem ajuste, o mês não conta para tempo nem carência. A regra permite complementar a diferença, utilizar o excedente de outro mês do mesmo ano ou agrupar competências, pelo Meu INSS. Se o mês também tiver PREM-BLOQ-EC103, o ajuste fica bloqueado até a pendência de origem ser resolvida.',
        'conf' => ['Some todos os vínculos da mesma competência: o total é que deve ser comparado ao mínimo.', 'Veja se é mês de início ou fim de vínculo, quando o valor proporcional é esperado.', 'Depois do ajuste e do Darf pago, o indicador deixa de aparecer nas competências ajustadas.'],
        'base' => 'EC 103/2019, art. 29; Constituição, art. 195, § 14.'],
    'PREC-MENOR-MIN' => [
        'curto' => 'Contribuição abaixo do salário mínimo.',
        'sig' => 'Pendência nas contribuições de contribuinte individual, facultativo e segurado especial recolhidas abaixo do mínimo. Para o contribuinte individual, a partir de 11/2019 ela dá lugar ao PSC-MEN-SM-EC103.',
        'imp' => 'A competência não conta enquanto a diferença até o mínimo não for recolhida.',
        'conf' => ['Compare o salário de contribuição com o mínimo da competência.', 'Recolha a diferença, se ainda for o caso, e guarde a guia.'],
        'base' => 'Lei 8.212/91, arts. 21 e 28; Decreto 3.048/99, art. 214, § 3º.'],
    'IREM-INDPEND' => [
        'curto' => 'O vínculo tem remunerações com indicadores ou pendências.',
        'sig' => 'É um aviso no cabeçalho do vínculo: ao menos uma remuneração dele traz outro indicador ou pendência. O código não diz qual competência, então é preciso olhar a lista de remunerações.',
        'imp' => 'Remuneração com indicador só de alerta é liberada normalmente. A que tem indicador de pendência depende de tratamento, conforme o código específico.',
        'conf' => ['Localize as competências com indicador na lista de remunerações.', 'Veja nesta lista o efeito de cada código encontrado.', 'Reúna holerites, GFIP ou eSocial das competências com pendência.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'IREC-INDPEND' => [
        'curto' => 'O vínculo de recolhimentos tem indicadores ou pendências.',
        'sig' => 'Aparece em períodos de contribuinte individual, facultativo ou outros recolhimentos quando alguma competência traz indicador ou pendência. Funciona como o IREM-INDPEND, só que para guias pagas pelo segurado.',
        'imp' => 'O efeito depende do indicador de cada competência: alguns só informam, outros impedem o cômputo até o tratamento.',
        'conf' => ['Identifique as competências com indicador na lista de contribuições.', 'Confira se a guia foi paga no valor, no código e na categoria corretos.', 'Guarde os comprovantes de pagamento.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F; Lei 8.212/91, art. 21.'],
    'IREM-ACD' => [
        'curto' => 'Parte da remuneração vem de acordo, convenção ou dissídio coletivo.',
        'sig' => 'A competência tem um valor extra, lançado em separado, decorrente de acordo, convenção ou dissídio coletivo. Por isso o mesmo mês pode aparecer duas vezes na lista, com valores diferentes.',
        'imp' => 'As parcelas somam o salário de contribuição do mês. Não exige tratamento.',
        'conf' => ['Some as parcelas da competência e compare com o consolidado do extrato.', 'Confira se o valor extra tem relação com reajuste retroativo da categoria.'],
        'base' => 'Lei 8.212/91, art. 28.'],
    'AVRC-DEF' => [
        'curto' => 'O INSS confirmou o acerto pedido no vínculo.',
        'sig' => 'O pedido de acerto do vínculo foi deferido pelo INSS no Portal CNIS. É um indicador favorável.',
        'imp' => 'Mostra que a informação passou por validação, o que tende a evitar dúvida no cálculo do benefício.',
        'conf' => ['Veja se o acerto cobre todo o período que você pediu.', 'Guarde o protocolo do pedido e os documentos enviados.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'IVIN-PROC-TRAB' => [
        'curto' => 'O vínculo tem processo trabalhista, sem mudança nas datas.',
        'sig' => 'O vínculo tem informação de processo trabalhista (GFIP 650 com característica 3 ou evento S-2500 do eSocial) que não alterou as datas de admissão e desligamento. É indicador, não pendência.',
        'imp' => 'Não tira o vínculo da contagem. Quando o processo muda datas ou reconhece o vínculo, aparecem pendências próprias, como PVIN-REC-PROC-TRAB, PVIN-ADMISSAO-PROC-TRAB e PVIN-DESLIG-PROC-TRAB.',
        'conf' => ['Guarde sentença, acordo e guias das contribuições.', 'Confira se competências e valores lançados batem com a decisão.', 'Veja se há pendências de processo trabalhista no mesmo vínculo.'],
        'base' => 'IN PRES/INSS 128/2022, arts. 172 e seguintes; Lei 8.213/91, art. 55, § 3º.'],
    'IREC-MEI' => [
        'curto' => 'Contribuição recolhida como Microempreendedor Individual.',
        'sig' => 'A competência foi paga pela guia do MEI, com alíquota reduzida sobre o salário mínimo.',
        'imp' => 'Conta para carência e para a aposentadoria por idade, mas não para a aposentadoria por tempo de contribuição nem para a CTC sem complementação para 20%.',
        'conf' => ['Confira se todas as competências do período aparecem pagas.', 'Se pretende aposentadoria por tempo de contribuição, veja o valor da complementação.'],
        'base' => 'LC 123/2006, art. 18-A; Lei 8.212/91, art. 21, §§ 2º e 3º.'],
    'IREC-LC123' => [
        'curto' => 'Recolhimento no plano simplificado de previdência (11% ou 5%).',
        'sig' => 'A contribuição foi paga em alíquota reduzida, no plano simplificado da LC 123/2006. Costuma aparecer junto com IREC-MEI nos recolhimentos do microempreendedor.',
        'imp' => 'Os sistemas do INSS não contam a competência na aposentadoria por tempo de contribuição nem na CTC sem a complementação para 20%. Para carência e aposentadoria por idade ela conta.',
        'conf' => ['Veja qual benefício você pretende e se ele exige complementar a contribuição.', 'Confira as competências e as datas de pagamento.'],
        'base' => 'LC 123/2006; Lei 8.212/91, art. 21, §§ 2º e 3º.'],
    'PREM-EXT' => [
        'curto' => 'Remuneração de contribuinte individual prestador de serviço informada fora do prazo.',
        'sig' => 'Aparece em competências de contribuinte individual que presta serviço a empresa, a partir de 04/2003, quando a empresa contratante informou a remuneração depois do prazo.',
        'imp' => 'Enquanto não for tratada, a competência não é computada no reconhecimento de direitos. O tratamento é por requerimento no CNIS, com documentos (art. 29-A da Lei 8.213/91).',
        'conf' => ['Reúna recibos, contratos e comprovantes do serviço prestado.', 'Peça à empresa a comprovação ou a retificação da GFIP ou do eSocial.'],
        'base' => 'Lei 10.666/2003; Lei 8.213/91, art. 29-A.'],
    'PEXT' => [
        'curto' => 'Vínculo informado fora do prazo legal (extemporâneo).',
        'sig' => 'O vínculo, ou parte dele, foi inserido no CNIS depois do prazo legal, em vez de ter sido informado na época pelo empregador.',
        'imp' => 'Há impacto no reconhecimento do direito: sem comprovação, o período informado fora do prazo não conta como tempo de contribuição nem no cálculo da renda. Depois do acerto aparece AEXT-VT (confirmado) ou AEXT-VP (confirmado em parte).',
        'conf' => ['Junte CTPS, contrato, ficha de registro e comprovantes de pagamento.', 'Peça o acerto do vínculo extemporâneo no CNIS.', 'Verifique se as datas do vínculo estão corretas.'],
        'base' => 'Decreto 3.048/99, art. 19, § 3º; Lei 8.213/91, art. 55.'],
    'PREM-FVIN' => [
        'curto' => 'Remuneração depois do fim do vínculo.',
        'sig' => 'Há remuneração em competência posterior à data de término do vínculo.',
        'imp' => 'A remuneração não é computada, por estar fora do período do vínculo. Se a data de saída estiver errada, a retificação dela libera a competência.',
        'conf' => ['Confira a data de rescisão na CTPS e no termo de rescisão.', 'Veja se o valor posterior é de verbas finais.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREM-IVIN' => [
        'curto' => 'Remuneração antes do início do vínculo.',
        'sig' => 'Há remuneração em competência anterior à data de admissão registrada.',
        'imp' => 'A remuneração não é computada. Costuma indicar data de admissão lançada errada, que pode ser retificada.',
        'conf' => ['Confira a data de admissão na CTPS e na ficha de registro.', 'Peça a retificação ao empregador, se a data estiver errada.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PADM-EMPR' => [
        'curto' => 'Admissão fora do período de atividade do empregador.',
        'sig' => 'A data de admissão é anterior ao início ou posterior ao encerramento da empresa no cadastro da Receita Federal. Pode acontecer quando a empresa funcionou antes de ser formalizada.',
        'imp' => 'Segundo o INSS, não impede o cômputo do vínculo, desde que ele seja comprovado e validado no CNIS.',
        'conf' => ['Compare a admissão com as datas de abertura e encerramento da empresa.', 'Guarde provas de que o trabalho ocorreu na data informada.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREM-EMPR' => [
        'curto' => 'Remuneração fora do período de atividade do empregador.',
        'sig' => 'Há remuneração em competência anterior ao início ou posterior ao encerramento da empresa no cadastro da Receita Federal.',
        'imp' => 'Impede o cômputo da competência. Não há tratamento no CNIS: se a data da empresa estiver errada, ela precisa ser retificada na Receita Federal.',
        'conf' => ['Verifique as datas de abertura e encerramento do empregador.', 'Reúna holerites e documentos do período.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PRES-EMPR' => [
        'curto' => 'Rescisão fora do período de atividade do empregador.',
        'sig' => 'A data de saída é anterior ao início ou posterior ao encerramento da empresa no cadastro da Receita Federal.',
        'imp' => 'Segundo o INSS, não impede o cômputo do vínculo, desde que ele seja comprovado e validado no CNIS.',
        'conf' => ['Compare as datas do vínculo com as do cadastro da empresa.', 'Guarde o termo de rescisão e a CTPS.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PEMP-CAD' => [
        'curto' => 'Faltam dados cadastrais do empregador (CNPJ ou CEI).',
        'sig' => 'O identificador do empregador é válido, mas faltam dados dele na base de pessoas jurídicas do CNIS.',
        'imp' => 'Para usar o vínculo no reconhecimento de direitos, é preciso comprovar a relação de trabalho com documentos e atualizar o CNIS.',
        'conf' => ['Confira o CNPJ ou CEI do empregador no vínculo.', 'Reúna CTPS, contrato e holerites e peça a atualização.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREC-FACULTCONC' => [
        'curto' => 'Contribuição de facultativo junto com atividade obrigatória.',
        'sig' => 'Há recolhimento como facultativo em competência em que também existe vínculo ou outra filiação obrigatória.',
        'imp' => 'O recolhimento fica pendente e não é considerado. Se a concomitância vier de vínculo sem data de saída ou de código de pagamento errado, corrigir o CNIS libera a competência.',
        'conf' => ['Compare as competências do recolhimento com os vínculos ativos.', 'Veja se o vínculo concomitante tem a data de saída correta.', 'Veja se o recolhimento deveria ter sido como contribuinte individual.'],
        'base' => 'Lei 8.213/91, arts. 11 e 13.'],
    'IEAN' => [
        'curto' => 'Exposição a agente nocivo informada pelo empregador.',
        'sig' => 'O empregador recolheu a contribuição adicional de quem trabalha exposto a agente nocivo (art. 22, II, da Lei 8.212/91).',
        'imp' => 'Indica um possível enquadramento para aposentadoria especial, mas não gera conversão automática nem dispensa a análise técnica.',
        'conf' => ['Peça o PPP e o laudo (LTCAT) que embasam a informação.', 'Compare o período com o cargo e o local de trabalho.'],
        'base' => 'Lei 8.213/91, arts. 57 e 58.'],
    'PRPPS' => [
        'curto' => 'Vínculo com período de regime próprio (servidor público).',
        'sig' => 'Parte ou todo o vínculo é de regime próprio de previdência, como o de servidores públicos. Também aparece para trabalhador não vinculado ao INSS com direito ao FGTS.',
        'imp' => 'Pode afetar o direito quando for preciso ajustar os períodos de cada regime. O tempo de regime próprio só entra no INSS com certidão de tempo de contribuição (CTC).',
        'conf' => ['Solicite a CTC ao órgão do regime próprio.', 'Confira no órgão quais períodos foram de cada regime.', 'Evite contar o mesmo período nos dois regimes.'],
        'base' => 'Lei 8.213/91, art. 94; IN PRES/INSS 128/2022, arts. 68 e 69.'],
    'AEXT-VT' => [
        'curto' => 'Vínculo extemporâneo confirmado pelo INSS.',
        'sig' => 'O pedido de acerto do vínculo extemporâneo foi totalmente deferido pelo INSS no Portal CNIS.',
        'imp' => 'Sinal favorável: o INSS aceitou os documentos, e a pendência PEXT deixa de impedir o cômputo.',
        'conf' => ['Guarde o protocolo e os documentos do pedido.', 'Confira se datas e remunerações ficaram corretas.'],
        'base' => 'Decreto 3.048/99, art. 19, § 3º.'],
];
// Efeito de cada código no reconhecimento de direitos, na ordem em que aparece na página de índice.
const IMPACTOS = [
    'vinculo' => ['Impede o cômputo do vínculo', 'Pendências que tiram o vínculo inteiro da contagem'],
    'competencia' => ['Impede o cômputo da competência', 'Pendências que tiram a competência da contagem'],
    'mandato' => ['Tira parte do período', 'Pendências que tiram parte do período'],
    'datas-inicio' => ['Tira parte do período', null], 'datas-fim' => ['Tira parte do período', null], 'datas' => ['Tira parte do período', null], 'idade-minima' => ['Tira parte do período', null],
    'minimo' => ['Abaixo do salário mínimo', 'Competência abaixo do salário mínimo'],
    'tc' => ['Não conta no tempo de contribuição sem complementar', 'Plano simplificado: fora da aposentadoria por tempo de contribuição'],
    'atencao' => ['Conferir: não tira da contagem por si só', 'Pendências e alertas sem exclusão automática'],
    'info' => ['Informativo', 'Indicadores e acertos informativos'],
];
const CONF_PADRAO = [
    'vinculo' => ['Localize o vínculo marcado no extrato e veja se há acerto posterior (indicadores AEXT, ADIV ou AVRC).', 'Reúna os documentos que comprovam o vínculo: CTPS, contrato, ficha de registro, holerites, extrato do FGTS.', 'Peça o tratamento da pendência no CNIS antes ou junto com o pedido do benefício.'],
    'competencia' => ['Localize as competências marcadas na lista de remunerações ou contribuições.', 'Reúna holerites, guias e comprovantes das competências.', 'Peça o tratamento no CNIS; se não houver tratamento, veja se o dado de origem (empresa, data, código de pagamento) pode ser retificado.'],
    'mandato' => ['Confira se o período foi de mandato eletivo e até quando.', 'Para 02/1998 a 09/2004, veja se houve opção pela filiação como facultativo e o recolhimento correspondente.'],
    'datas-inicio' => ['Compare as datas do vínculo com a sentença ou o acordo trabalhista.', 'Reúna início de prova material do período acrescentado.'],
    'datas-fim' => ['Compare a data de desligamento com a última remuneração do vínculo.', 'Reúna início de prova material do período entre a última remuneração e o desligamento.'],
    'datas' => ['Compare as datas do vínculo com a sentença ou o acordo trabalhista.', 'Reúna início de prova material dos períodos alterados.'],
    'idade-minima' => ['Confira se a data de nascimento está correta no CNIS.', 'Se o trabalho antes da idade mínima for comprovado, peça a análise do caso.'],
    'minimo' => ['Some todos os vínculos da competência e compare com o salário mínimo.', 'Veja se cabe complementar, utilizar ou agrupar.'],
    'tc' => ['Veja se o benefício pretendido exige contribuição de 20%.', 'Peça o cálculo da complementação, se for o caso.'],
    'atencao' => ['Confira o dado marcado com a CTPS, holerites ou guias.', 'Se houver erro, peça a correção no CNIS com documentos.'],
    'info' => ['Não exige providência. Guarde o extrato para conferência futura.'],
];
function indicadores(): array {
    static $lista = null;
    global $INDICADORES_TEXTO;
    if ($lista !== null) return $lista;
    $dados = json_decode((string) file_get_contents(__DIR__ . '/dados/indicadores.json'), true);
    $lista = [];
    foreach ($dados['indicadores'] ?? [] as $r) $lista[$r['cod']] = $r + ($INDICADORES_TEXTO[$r['cod']] ?? []);
    return $lista;
}
function slug_ind(string $c): string { return strtolower(str_replace('_', '-', $c)); }
function cod_por_slug(string $s): ?string { foreach (array_keys(indicadores()) as $c) if (slug_ind($c) === $s) return $c; return null; }
function grupo_ind(string $g): string {
    $g = mb_strtolower($g, 'UTF-8');
    $g = mb_strtoupper(mb_substr($g, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($g, 1, null, 'UTF-8');
    return str_replace(['ec103', 'darf', ' nit '], ['EC 103', 'Darf', ' NIT '], $g);
}
function curto_ind(array $i): string { return $i['curto'] ?? explode(' / ', $i['descricao'])[0] . '.'; }

// Glossário: um arquivo por termo em dados/glossario/{slug}.json e as fontes oficiais em dados/fontes.json.
// Nos textos: **negrito**, [[slug]] ou [[slug|texto]] (outro termo), [[post:slug|texto]] (artigo, vira texto se ainda não publicado),
// [[ind:CÓDIGO]] (indicador) e [[fonte:chave|texto]] (link oficial). Teste: node tests/glossario.test.js
const GLOSSARIO_REVISADO = '2026-10-19';
const CAT_GLOSSARIO = [
    'segurados' => 'Segurados e filiação', 'protecao' => 'Qualidade de segurado e carência', 'contribuicao' => 'Contribuições',
    'tempo' => 'Tempo de contribuição', 'calculo' => 'Cálculo do benefício', 'beneficios' => 'Aposentadorias e benefícios',
    'processo' => 'Datas e processo no INSS', 'cnis' => 'CNIS e extrato',
];
function ler_pasta(string $pasta): array {
    $l = [];
    foreach (glob(__DIR__ . '/dados/' . $pasta . '/*.json') ?: [] as $f) {
        $slug = basename($f, '.json');
        if ($slug[0] === '_' || !preg_match('/^[a-z0-9-]+$/', $slug)) continue;
        $t = json_decode((string) file_get_contents($f), true);
        if (is_array($t)) $l[$slug] = $t + ['slug' => $slug];
    }
    return $l;
}
function glossario(): array {
    static $l = null;
    if ($l !== null) return $l;
    $l = ler_pasta('glossario');
    uasort($l, fn($a, $b) => strcmp(sem_acento($a['termo']), sem_acento($b['termo'])));
    return $l;
}

// Perguntas frequentes por situação: um arquivo por pergunta em dados/perguntas/{slug}.json, com a mesma marcação do glossário
// e mais [[q:slug|texto]] para outra pergunta. Teste: node tests/perguntas.test.js
const PERGUNTAS_REVISADAS = '2026-10-20';
const CAT_PERGUNTAS = [
    'cnis' => 'CNIS, vínculos e pendências', 'contribuicoes' => 'Contribuições', 'protecao' => 'Qualidade de segurado e carência',
    'aposentadoria' => 'Aposentadoria e tempo de contribuição', 'beneficios' => 'Pensão e acumulação de benefícios', 'processo' => 'Pedido, recurso e revisão',
];
function legislacao(): array {
    static $l = null;
    if ($l !== null) return $l;
    $l = ler_pasta('legislacao');
    uasort($l, fn($a, $b) => ($a['ordem'] ?? 999) <=> ($b['ordem'] ?? 999));
    return $l;
}
function lista_legislacao(array $ls): void {
    echo '<ul class="lista-gl">';
    foreach ($ls as $slug => $l) {
        echo '<li><a href="' . e(u('/legislacao/' . $slug . '/')) . '">' . e($l['titulo']) . '</a> <span>' . e($l['norma']) . '</span></li>';
    }
    echo '</ul>';
}
function legislacao_que_cita(string $campo, string $valor): array {
    return array_filter(legislacao(), fn($l) => in_array($valor, $l[$campo] ?? [], true));
}
function perguntas(): array {
    static $l = null;
    if ($l !== null) return $l;
    $l = ler_pasta('perguntas');
    uasort($l, fn($a, $b) => strcmp(sem_acento($a['pergunta']), sem_acento($b['pergunta'])));
    return $l;
}
function lista_perguntas(array $qs, bool $comResumo = true): void {
    echo '<ul class="lista-gl">';
    foreach ($qs as $slug => $q) {
        echo '<li><a href="' . e(u('/perguntas/' . $slug . '/')) . '">' . e($q['pergunta']) . '</a>' . ($comResumo ? ' <span>' . e($q['resumo']) . '</span>' : '') . '</li>';
    }
    echo '</ul>';
}
function perguntas_que_citam(string $campo, string $valor): array {
    return array_filter(perguntas(), fn($q) => in_array($valor, $q[$campo] ?? [], true));
}
function texto_puro(string $s): string { return trim(html_entity_decode(strip_tags(gl_html($s)), ENT_QUOTES, 'UTF-8')); }
function fontes_glossario(): array {
    static $f = null;
    return $f ??= json_decode((string) @file_get_contents(__DIR__ . '/dados/fontes.json'), true) ?: [];
}
function sem_acento(string $s): string {
    return strtolower(strtr($s, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u']));
}
function post_publicado(string $slug): ?array { foreach (publicados() as $p) if ($p['slug'] === $slug) return $p; return null; }
function link_externo(string $url, string $html): string { return '<a href="' . e($url) . '" target="_blank" rel="noopener noreferrer">' . $html . '</a>'; }
function nome_termo(array $t): string {
    $n = preg_replace('/ \(.*\)$/', '', $t['termo']);
    return preg_match('/^\p{Lu}\p{Ll}/u', $n) ? mb_strtolower(mb_substr($n, 0, 1)) . mb_substr($n, 1) : $n;
}
// Converte a marcação dos textos do glossário em HTML. O texto é escapado antes; só a marcação vira tag.
function gl_html(string $s): string {
    $h = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', e($s));
    return preg_replace_callback('/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/u', function ($m) {
        [$tipo, $alvo] = strpos($m[1], ':') !== false ? explode(':', $m[1], 2) : ['termo', $m[1]];
        $txt = $m[2] ?? null;
        if ($tipo === 'termo') {
            $G = glossario();
            if (!isset($G[$alvo])) return $txt ?? $alvo;
            return '<a href="' . e(u('/glossario/' . $alvo . '/')) . '">' . ($txt ?? e(nome_termo($G[$alvo]))) . '</a>';
        }
        if ($tipo === 'leg') { $L = legislacao(); return isset($L[$alvo]) ? '<a href="' . e(u('/legislacao/' . $alvo . '/')) . '">' . ($txt ?? e($L[$alvo]['titulo'])) . '</a>' : ($txt ?? ''); }
        if ($tipo === 'q') { $Q = perguntas(); return isset($Q[$alvo]) ? '<a href="' . e(u('/perguntas/' . $alvo . '/')) . '">' . ($txt ?? e($Q[$alvo]['pergunta'])) . '</a>' : ($txt ?? ''); }
        if ($tipo === 'post') return post_publicado($alvo) ? '<a href="' . e(u('/blog/' . $alvo . '/')) . '">' . ($txt ?? $alvo) . '</a>' : ($txt ?? '');
        if ($tipo === 'ind') return '<a href="' . e(u('/indicadores/' . slug_ind(html_entity_decode($alvo)) . '/')) . '"><code class="cod">' . $alvo . '</code></a>';
        if ($tipo === 'fonte') { $F = fontes_glossario()[$alvo] ?? null; return $F ? link_externo($F[1], $txt ?? e($F[0])) : ($txt ?? ''); }
        return $txt ?? '';
    }, $h);
}
function gl_blocos(array $blocos): string {
    $o = '';
    foreach ($blocos as $b) {
        $o .= is_array($b) ? '<ul>' . implode('', array_map(fn($i) => '<li>' . gl_html($i) . '</li>', $b)) . '</ul>' : '<p>' . gl_html($b) . '</p>';
    }
    return $o;
}
// Termos do glossário que citam um artigo ou um indicador, para o link de volta.
function termos_que_citam(string $campo, string $valor): array {
    return array_filter(glossario(), fn($t) => in_array($valor, $t[$campo] ?? [], true));
}
function lista_termos(array $termos): void {
    echo '<ul class="lista-gl">';
    foreach ($termos as $slug => $t) {
        echo '<li><a href="' . e(u('/glossario/' . $slug . '/')) . '">' . e($t['termo']) . '</a> <span>' . e($t['resumo']) . '</span></li>';
    }
    echo '</ul>';
}

// ---------- Funções ----------
function e(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function data_br(string $iso): string { return implode('/', array_reverse(explode('-', $iso))); }
function u(string $caminho): string { global $BASE; return $BASE . $caminho; }

function publicados(): array {
    global $POSTS;
    $hoje = date('Y-m-d');
    $l = array_values(array_filter($POSTS, fn($p) => $p['data'] <= $hoje));
    usort($l, fn($a, $b) => strcmp($b['data'], $a['data']));
    return $l;
}

function marca_svg(): string {
    $c = ['#5cc79a', '#5cc79a', '#5cc79a', '#5cc79a', '#e4655f', '#5cc79a', '#5cc79a', '#5cc79a', '#c4ccdd'];
    $s = '<svg viewBox="0 0 24 24" aria-hidden="true">';
    foreach ($c as $i => $cor) {
        $s .= '<rect x="' . (1 + ($i % 3) * 8) . '" y="' . (1 + intdiv($i, 3) * 8) . '" width="6" height="6" rx="1.5" fill="' . $cor . '"/>';
    }
    return $s . '</svg>';
}

function topo(string $titulo, string $desc, string $caminho, array $o = []): void {
    $rastreio = $o['rastreio'] ?? true;
    $url = SITE_URL . $caminho;
    $favicon = 'data:image/svg+xml,' . rawurlencode(str_replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', marca_svg()));
    ?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titulo) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($url) ?>">
<?php if (!empty($o['noindex'])): ?><meta name="robots" content="noindex, nofollow">
<?php endif; ?>
<meta property="og:type" content="<?= !empty($o['artigo']) ? 'article' : 'website' ?>">
<meta property="og:title" content="<?= e($titulo) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($url) ?>">
<meta property="og:locale" content="pt_BR">
<?php if (!empty($o['imagem'])): ?><meta property="og:image" content="<?= e(SITE_URL . $o['imagem']) ?>">
<meta name="twitter:card" content="summary_large_image">
<?php endif; ?>
<meta name="theme-color" content="#f5f7fb">
<link rel="icon" href="<?= e($favicon) ?>">
<link rel="preload" href="<?= e(u('/assets/fonts/atkinson-400.woff2')) ?>" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= e(u('/assets/style.css')) ?>?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
<?php if ($rastreio && GA_ID !== ''): ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= e(GA_ID) ?>"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','<?= e(GA_ID) ?>');</script>
<?php endif; ?>
<?php if ($rastreio && ADS_ATIVOS && ADSENSE !== ''): ?>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= e(ADSENSE) ?>" crossorigin="anonymous"></script>
<?php endif; ?>
<?php if (!empty($o['jsonld'])): ?>
<script type="application/ld+json"><?= json_encode($o['jsonld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?></script>
<?php endif; ?>
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="wrap topo-in">
    <a class="marca" href="<?= e(u('/')) ?>"><?= marca_svg() ?><?= e(SITE_NOME) ?></a>
    <nav class="menu" aria-label="Principal">
      <?php if (FERRAMENTA_PUBLICA): ?><a href="<?= e(u('/analise-cnis/')) ?>">Analisar CNIS</a><?php endif; ?>
      <a href="<?= e(u('/blog/')) ?>">Blog</a>
      <a href="<?= e(u('/perguntas/')) ?>">Perguntas</a>
      <a href="<?= e(u('/glossario/')) ?>">Glossário</a>
      <a href="<?= e(u('/indicadores/')) ?>">Indicadores</a>
      <a class="menu-extra" href="<?= e(u('/legislacao/')) ?>">Legislação</a>
      <a class="menu-extra" href="<?= e(u('/privacidade/')) ?>">Privacidade</a>
    </nav>
  </div>
</header>
<?php
}

function rodape(): void {
    ?>
<footer class="rodape">
  <div class="wrap">
    <p>Conteúdo informativo. Não substitui a orientação de um advogado previdenciário nem as informações oficiais do INSS.</p>
    <p class="rodape-links"><a href="<?= e(u('/perguntas/')) ?>">Perguntas frequentes</a> <a href="<?= e(u('/glossario/')) ?>">Glossário</a> <a href="<?= e(u('/indicadores/')) ?>">Indicadores</a> <a href="<?= e(u('/legislacao/')) ?>">Legislação</a></p>
    <p><a href="<?= e(u('/privacidade/')) ?>">Política de privacidade</a> &copy; <?= date('Y') ?> <?= e(SITE_NOME) ?></p>
  </div>
</footer>
</body>
</html>
<?php
}

function anuncio(): void {
    if (!ADS_ATIVOS || ADSENSE === '') return;
    echo '<div class="anuncio"><ins class="adsbygoogle" style="display:block" data-ad-client="' . e(ADSENSE)
        . '" data-ad-format="auto" data-full-width-responsive="true"></ins>'
        . '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>';
}

// Ilustração do mapa de competências. o=com remuneração, f=falta, p=parcial, v=sem vínculo.
function mapa_exemplo(): void {
    $anos = ['2018' => 'oooooooooooo', '2019' => 'oooofoooopoo', '2020' => 'oooooovvvvvv'];
    $est = ['o' => ['ok', 'com remuneração'], 'f' => ['falta', 'sem remuneração'], 'p' => ['parcial', 'falta em um dos vínculos'], 'v' => ['vazio', 'sem vínculo']];
    $meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    echo '<table class="mapa" aria-hidden="true"><thead><tr><th class="ano"></th>';
    foreach ($meses as $m) echo '<th>' . $m . '</th>';
    echo '</tr></thead><tbody>';
    foreach ($anos as $ano => $linha) {
        echo '<tr><th class="ano">' . $ano . '</th>';
        for ($i = 0; $i < 12; $i++) {
            [$cls, $rot] = $est[$linha[$i]];
            echo '<td class="c-' . $cls . '" title="' . sprintf('%02d', $i + 1) . '/' . $ano . ': ' . $rot . '"></td>';
        }
        echo '</tr>';
    }
    echo '</tbody></table>';
}

function pagina_404(): void {
    http_response_code(404);
    topo('Página não encontrada | ' . SITE_NOME, 'Página não encontrada.', '/', ['noindex' => true]);
    echo '<main id="conteudo" class="wrap pagina"><h1>Página não encontrada</h1><p>O endereço não existe ou o artigo ainda não foi publicado.</p>'
        . '<p><a href="' . e(u('/')) . '">Ir para o início</a> ou <a href="' . e(u('/blog/')) . '">ver o blog</a>.</p></main>';
    rodape();
}

// ---------- Rota ----------
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (PHP_SAPI === 'cli-server' && $uri !== '/' && substr($uri, -4) !== '.php' && is_file(__DIR__ . $uri)) {
    return false; // servidor embutido do PHP entrega os arquivos estáticos
}
$BASE = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$rota = (string) substr($uri, strlen($BASE));
if ($rota !== '' && $rota !== '/' && substr($rota, -1) !== '/' && strpos(basename($rota), '.') === false) {
    header('Location: ' . $BASE . $rota . '/', true, 301); // endereços sempre terminam em barra
    exit;
}
$rota = '/' . trim($rota, '/');

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: SAMEORIGIN');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
if (PHP_SAPI !== 'cli-server') header('Strict-Transport-Security: max-age=31536000');

if ($rota === '/') {
    $recentes = array_slice(publicados(), 0, 3);
    topo(SITE_NOME . ' | Confira o seu CNIS mês a mês', 'Guias e uma ferramenta gratuita para encontrar salários faltantes, pendências e o tempo contado no extrato do CNIS.', '/');
    ?>
<main id="conteudo" class="wrap">
  <section class="hero">
    <div class="hero-texto">
      <h1>Confira o seu CNIS mês a mês</h1>
      <p class="lead">Veja de uma vez onde falta remuneração, quanto tempo foi contado e o que o INSS deixou pendente no extrato.</p>
      <?php if (FERRAMENTA_PUBLICA): ?>
        <p><a class="btn" href="<?= e(u('/analise-cnis/')) ?>">Analisar um extrato</a></p>
      <?php else: ?>
        <p class="status">A ferramenta de análise está em preparação. Enquanto isso, os guias explicam como ler o extrato.</p>
      <?php endif; ?>
    </div>
    <figure class="hero-mapa">
      <?php mapa_exemplo(); ?>
      <figcaption>Exemplo ilustrativo do mapa de competências. Cada quadrado é um mês, e o coral marca uma competência sem remuneração.</figcaption>
    </figure>
  </section>

  <section class="faixa">
    <h2>O que a análise mostra</h2>
    <div class="tres">
      <div><h3>Tempo e competências</h3><p>Soma o tempo dos vínculos sem contar duas vezes os períodos concomitantes e conta as competências com remuneração.</p></div>
      <div><h3>Salários faltantes</h3><p>Aponta, vínculo por vínculo, os meses sem remuneração lançada a partir de 07/1994.</p></div>
      <div><h3>Pendências</h3><p>Reúne indicadores do INSS, datas inconsistentes, competências repetidas e os benefícios que aparecem no extrato.</p></div>
    </div>
  </section>

  <section class="faixa">
    <h2>O extrato fica no seu navegador</h2>
    <div class="texto">
      <p>A leitura do PDF acontece no seu computador. O arquivo não é enviado, salvo ou registrado, e a página da ferramenta não carrega Analytics nem anúncios. <a href="<?= e(u('/privacidade/')) ?>">Veja como isso funciona</a>.</p>
    </div>
  </section>

  <section class="faixa">
    <h2>Últimos artigos</h2>
    <ul class="lista-posts">
      <?php foreach ($recentes as $p): ?>
        <li>
          <a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a>
          <time datetime="<?= e($p['data']) ?>"><?= e(data_br($p['data'])) ?></time>
          <p><?= e($p['resumo']) ?></p>
        </li>
      <?php endforeach; ?>
    </ul>
    <a class="mais" href="<?= e(u('/blog/')) ?>">Ver todos os artigos</a>
  </section>

  <section class="faixa">
    <h2>Perguntas frequentes</h2>
    <?php $Q = perguntas(); lista_perguntas(array_intersect_key($Q, array_flip(['pext-no-cnis-perco-o-tempo', 'parei-de-contribuir-ainda-tenho-direito', 'quanto-tempo-falta-para-me-aposentar', 'inss-negou-o-pedido-o-que-fazer'])), false); ?>
    <a class="mais" href="<?= e(u('/perguntas/')) ?>">Ver todas as <?= count($Q) ?> perguntas</a>
  </section>

  <section class="faixa">
    <h2>Glossário previdenciário</h2>
    <div class="texto">
      <p>Carência, qualidade de segurado, período de graça, DER, RMI, fator previdenciário, regras de transição e outros <?= count(glossario()) ?> termos explicados com a base legal e exemplos.</p>
      <a class="mais" href="<?= e(u('/glossario/')) ?>">Ver o glossário</a>
    </div>
  </section>

  <section class="faixa">
    <h2>Indicadores do CNIS</h2>
    <div class="texto">
      <p>PSC-MEN-SM-EC103, IREM-INDPEND, PEXT e outros códigos que aparecem no extrato, com o que cada um significa e o que conferir.</p>
      <a class="mais" href="<?= e(u('/indicadores/')) ?>">Ver os indicadores</a>
    </div>
  </section>

  <section class="faixa">
    <h2>Legislação comentada</h2>
    <div class="texto">
      <p>Lei 8.213/91, Lei 8.212/91, EC 103/2019, LC 150, LOAS e Portaria 990 comentadas artigo por artigo, com exemplos e links para os textos oficiais.</p>
      <a class="mais" href="<?= e(u('/legislacao/')) ?>">Ver a legislação comentada</a>
    </div>
  </section>
</main>
<?php
    rodape();

} elseif ($rota === '/blog') {
    topo('Blog | ' . SITE_NOME, 'Guias sobre o extrato do CNIS, vínculos, remunerações e pendências.', '/blog/');
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Blog</h1>
  <p class="lead">Guias curtos sobre o extrato do CNIS e a conferência de vínculos.</p>
  <ul class="lista-posts">
    <?php foreach (publicados() as $p): ?>
      <li>
        <a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a>
        <time datetime="<?= e($p['data']) ?>"><?= e(data_br($p['data'])) ?></time>
        <p><?= e($p['resumo']) ?></p>
      </li>
    <?php endforeach; ?>
  </ul>
</main>
<?php
    rodape();

} elseif (preg_match('#^/blog/([a-z0-9-]+)$#', $rota, $m)) {
    $post = null;
    foreach (publicados() as $p) if ($p['slug'] === $m[1]) $post = $p;
    $arquivo = $post ? __DIR__ . '/posts/' . $post['slug'] . '.html' : '';
    if (!$post || !is_file($arquivo)) { pagina_404(); exit; }

    $caminho = '/blog/' . $post['slug'] . '/';
    topo($post['titulo'] . ' | ' . SITE_NOME, $post['resumo'], $caminho, [
        'artigo' => true,
        'jsonld' => [
            '@context' => 'https://schema.org', '@type' => 'Article',
            'headline' => $post['titulo'], 'description' => $post['resumo'],
            'datePublished' => $post['data'], 'dateModified' => $post['revisado'] ?? $post['data'],
            'author' => ['@type' => 'Organization', 'name' => SITE_NOME],
            'mainEntityOfPage' => SITE_URL . $caminho,
        ] + (!empty($post['imagem']) ? ['image' => SITE_URL . $post['imagem']] : []),
        'imagem' => $post['imagem'] ?? null,
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <h1><?= e($post['titulo']) ?></h1>
    <p class="meta">Publicado em <?= e(data_br($post['data'])) ?><?php if (!empty($post['revisado']) && $post['revisado'] !== $post['data']): ?>. Revisado em <?= e(data_br($post['revisado'])) ?>.<?php endif; ?></p>
    <?php readfile($arquivo); ?>
    <?php $ls = legislacao_que_cita('artigos', $post['slug']); if ($ls): ?>
      <h2>Legislação comentada sobre o tema</h2>
      <?php lista_legislacao($ls); ?>
    <?php endif; ?>
    <?php $qs = perguntas_que_citam('artigos', $post['slug']); if ($qs): ?>
      <h2>Perguntas frequentes sobre o tema</h2>
      <?php lista_perguntas($qs, false); ?>
    <?php endif; ?>
    <?php $citam = termos_que_citam('artigos', $post['slug']); if ($citam): ?>
      <h2>Termos do glossário neste assunto</h2>
      <p class="termos-gl"><?php foreach ($citam as $s => $t): ?><a href="<?= e(u('/glossario/' . $s . '/')) ?>"><?= e($t['termo']) ?></a><?php endforeach; ?></p>
    <?php endif; ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/blog/')) ?>">Todos os artigos</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/indicadores') {
    $IND = indicadores();
    topo('Indicadores do CNIS: significado e efeito de cada código | ' . SITE_NOME, 'Todos os indicadores, pendências e acertos do extrato do CNIS (Anexo V da Portaria DIRBEN/INSS 990/2022), com o que impede o cômputo do vínculo ou da competência.', '/indicadores/');
    $grupos = [];
    foreach ($IND as $cod => $i) {
        $g = in_array($i['impacto'], ['mandato', 'datas-inicio', 'datas-fim', 'datas', 'idade-minima'], true) ? 'mandato' : $i['impacto'];
        if ($g === 'info' && preg_match('/^[PI]DARF/', $cod)) $g = 'darf';
        $grupos[$g][$cod] = $i;
    }
    $titulos = ['vinculo' => IMPACTOS['vinculo'][1], 'competencia' => IMPACTOS['competencia'][1], 'mandato' => IMPACTOS['mandato'][1], 'minimo' => IMPACTOS['minimo'][1], 'tc' => IMPACTOS['tc'][1], 'atencao' => IMPACTOS['atencao'][1], 'info' => IMPACTOS['info'][1], 'darf' => 'Darf: aparecem só no Portal CNIS'];
    $notas = [
        'vinculo' => 'Enquanto a pendência não for tratada, o INSS não usa o vínculo para conceder benefício. Se a marca estiver só numa competência, só ela fica de fora.',
        'competencia' => 'A competência marcada não entra no tempo nem na carência até o tratamento.',
        'mandato' => 'Só um trecho do vínculo fica de fora: o mandato eletivo até 18/09/2004, o período alterado por processo trabalhista ou o anterior à idade mínima.',
        'minimo' => 'Contam depois de complementar, utilizar ou agrupar (EC 103/2019, art. 29).',
        'tc' => 'Contam para carência e aposentadoria por idade, mas não para a aposentadoria por tempo de contribuição nem para a CTC sem complementação para 20%.',
        'atencao' => 'Não tiram o período da contagem sozinhas, mas podem exigir documentos ou ajuste no CNIS.',
        'info' => 'Só informam a origem ou um ajuste do dado. Não exigem tratamento.',
        'darf' => 'Indicadores da consulta de Darf do Portal CNIS, usada pelo INSS. Não aparecem no extrato do segurado.',
    ];
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Indicadores do CNIS</h1>
  <p class="lead texto">Os códigos que aparecem ao lado de vínculos, remunerações e contribuições no extrato, separados pelo efeito no reconhecimento de direitos. A lista segue o <a href="https://portalin.inss.gov.br/assets/anexos/pt990/AnexoV.pdf" target="_blank" rel="noopener noreferrer">Anexo V da Portaria DIRBEN/INSS 990/2022</a>, alterada pela Portaria DIRBEN/INSS 1.316/2025.</p>
  <p class="texto">Os códigos que começam com <strong>P</strong> são pendências, os com <strong>I</strong> são indicadores (alertas) e os com <strong>A</strong> são acertos já feitos pelo INSS. Toque no código para ver a descrição oficial, o esclarecimento do INSS e o que conferir.</p>
  <nav class="sumario-indic" aria-label="Grupos de indicadores">
    <?php foreach ($titulos as $g => $t): if (empty($grupos[$g])) continue; ?>
      <a href="#g-<?= e($g) ?>"><?= e($t) ?> (<?= count($grupos[$g]) ?>)</a>
    <?php endforeach; ?>
  </nav>
  <?php foreach ($titulos as $g => $t): if (empty($grupos[$g])) continue; ?>
    <h2 class="grupo-indic" id="g-<?= e($g) ?>"><?= e($t) ?></h2>
    <p class="texto dica"><?= e($notas[$g]) ?></p>
    <ul class="lista-indic">
      <?php foreach ($grupos[$g] as $cod => $i): ?>
        <li><a href="<?= e(u('/indicadores/' . slug_ind($cod) . '/')) ?>"><code class="cod"><?= e($cod) ?></code></a> <span><?= e(curto_ind($i)) ?></span></li>
      <?php endforeach; ?>
    </ul>
  <?php endforeach; ?>
  <p class="meta texto">Descrições e esclarecimentos: Anexo V da Portaria DIRBEN/INSS 990/2022 (relação dos indicadores disponibilizados no CNIS), alterada pela Portaria DIRBEN/INSS 1.316/2025. A separação por efeito resume o que o próprio anexo diz sobre cada código. Revisado em <?= e(data_br(INDICADORES_REVISADOS)) ?>.</p>
</main>
<?php
    rodape();

} elseif (preg_match('#^/indicadores/([a-z0-9-]+)$#', $rota, $m) && ($codInd = cod_por_slug($m[1])) !== null) {
    $IND = indicadores();
    $cod = $codInd;
    $i = $IND[$cod];
    $caminho = '/indicadores/' . slug_ind($cod) . '/';
    $titulo = $cod . ' no CNIS: o que significa';
    $desc = $cod . ': ' . curto_ind($i) . ' Efeito no reconhecimento de direitos e o que conferir no extrato do CNIS.';
    topo($titulo . ' | ' . SITE_NOME, $desc, $caminho, [
        'artigo' => true,
        'jsonld' => [
            '@context' => 'https://schema.org', '@type' => 'Article',
            'headline' => $titulo, 'description' => $desc,
            'datePublished' => INDICADORES_REVISADOS, 'dateModified' => INDICADORES_REVISADOS,
            'author' => ['@type' => 'Organization', 'name' => SITE_NOME],
            'mainEntityOfPage' => SITE_URL . $caminho,
        ],
    ]);
    $mesmoEfeito = array_filter($IND, fn($x, $k) => $k !== $cod && $x['impacto'] === $i['impacto'], ARRAY_FILTER_USE_BOTH);
    $prefixo = explode('-', $cod)[0];
    uksort($mesmoEfeito, fn($a, $b) => (int) (explode('-', $b)[0] === $prefixo) <=> (int) (explode('-', $a)[0] === $prefixo));
    $parecidos = array_slice(array_keys($mesmoEfeito), 0, 5);
    $conf = $i['conf'] ?? CONF_PADRAO[$i['impacto']] ?? [];
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <p class="migalha"><a href="<?= e(u('/indicadores/')) ?>">Indicadores do CNIS</a></p>
    <h1><code class="cod"><?= e($cod) ?></code> no CNIS: o que significa</h1>
    <p class="meta"><?= e($i['tipo']) ?> do grupo "<?= e(grupo_ind($i['grupoAnexo'])) ?>". Revisado em <?= e(data_br(INDICADORES_REVISADOS)) ?>.</p>
    <p class="lead"><?= e(curto_ind($i)) ?></p>
    <p class="oficial"><strong>Descrição no Anexo V:</strong> <?= e($i['descricao']) ?></p>
    <h2>Efeito no reconhecimento de direitos</h2>
    <p><span class="efeito efeito-<?= e($i['impacto']) ?>"><?= e(IMPACTOS[$i['impacto']][0]) ?></span></p>
    <p><?= e($i['efeito']) ?></p>
    <?php if (!empty($i['sig'])): ?><h2>O que significa</h2><p><?= e($i['sig']) ?></p><?php endif; ?>
    <?php if (!empty($i['imp'])): ?><h2>Por que importa</h2><p><?= e($i['imp']) ?></p><?php endif; ?>
    <h2>Esclarecimento do INSS</h2>
    <div class="esclarecimento"><p><?= e($i['esclarecimento']) ?></p><p class="dica">Texto do Anexo V da Portaria DIRBEN/INSS 990/2022, alterada pela Portaria DIRBEN/INSS 1.316/2025.</p></div>
    <?php if ($conf): ?>
      <h2>O que conferir</h2>
      <ul><?php foreach ($conf as $c): ?><li><?= e($c) ?></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <h2>Base normativa</h2>
    <p><?= !empty($i['base']) ? e($i['base']) . ' ' : '' ?>Portaria DIRBEN/INSS 990/2022, <a href="https://portalin.inss.gov.br/assets/anexos/pt990/AnexoV.pdf" target="_blank" rel="noopener noreferrer">Anexo V</a> (relação dos indicadores do CNIS). Veja o <a href="<?= e(u('/legislacao/portaria-990-anexo-v-indicadores-do-cnis/')) ?>">comentário à Portaria 990 e ao Anexo V</a> e os demais textos em <a href="<?= e(u('/legislacao/')) ?>">Legislação</a>; os textos mudam, então confira a versão vigente.</p>
    <?php $qs = perguntas_que_citam('indicadores', $cod); if ($qs): ?>
      <h2>Perguntas frequentes</h2>
      <?php lista_perguntas($qs, false); ?>
    <?php endif; ?>
    <?php $citam = termos_que_citam('indicadores', $cod); if ($citam): ?>
      <h2>No glossário</h2>
      <p class="termos-gl"><?php foreach ($citam as $s => $t): ?><a href="<?= e(u('/glossario/' . $s . '/')) ?>"><?= e($t['termo']) ?></a><?php endforeach; ?></p>
    <?php endif; ?>
    <?php if ($parecidos): ?>
      <h2>Com o mesmo efeito</h2>
      <ul class="lista-indic">
        <?php foreach ($parecidos as $k): ?>
          <li><a href="<?= e(u('/indicadores/' . slug_ind($k) . '/')) ?>"><code class="cod"><?= e($k) ?></code></a> <span><?= e(curto_ind($IND[$k])) ?></span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/indicadores/')) ?>">Todos os indicadores</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/glossario') {
    $G = glossario();
    $porCat = [];
    foreach ($G as $slug => $t) $porCat[$t['categoria']][$slug] = $t;
    $desc = 'Glossário previdenciário com ' . count($G) . ' termos do INSS explicados: carência, qualidade de segurado, período de graça, DER, RMI, fator previdenciário, regras de transição e mais.';
    topo('Glossário previdenciário: termos do INSS explicados | ' . SITE_NOME, $desc, '/glossario/', [
        'jsonld' => [
            '@context' => 'https://schema.org', '@type' => 'DefinedTermSet', '@id' => SITE_URL . '/glossario/',
            'name' => 'Glossário previdenciário', 'description' => $desc, 'url' => SITE_URL . '/glossario/',
            'hasDefinedTerm' => array_values(array_map(fn($s, $t) => ['@type' => 'DefinedTerm', 'name' => $t['termo'], 'url' => SITE_URL . '/glossario/' . $s . '/'], array_keys($G), $G)),
        ],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Glossário previdenciário</h1>
  <p class="lead texto">Os termos que aparecem no extrato do CNIS, nas cartas do INSS e nas regras de aposentadoria, explicados com a base legal, um exemplo e o que conferir.</p>
  <p class="texto">Cada termo traz a definição em poucas linhas, os detalhes que mudam o direito, um exemplo numérico e os links para a lei no Planalto e para as páginas do INSS no gov.br. Os termos se ligam entre si, aos <a href="<?= e(u('/indicadores/')) ?>">indicadores do CNIS</a> e aos <a href="<?= e(u('/blog/')) ?>">guias do blog</a>.</p>
  <nav class="sumario-indic" aria-label="Temas do glossário">
    <?php foreach (CAT_GLOSSARIO as $c => $rot): if (empty($porCat[$c])) continue; ?>
      <a href="#t-<?= e($c) ?>"><?= e($rot) ?> (<?= count($porCat[$c]) ?>)</a>
    <?php endforeach; ?>
  </nav>
  <?php foreach (CAT_GLOSSARIO as $c => $rot): if (empty($porCat[$c])) continue; ?>
    <h2 class="grupo-indic" id="t-<?= e($c) ?>"><?= e($rot) ?></h2>
    <?php lista_termos($porCat[$c]); ?>
  <?php endforeach; ?>
  <p class="meta texto">Textos revisados em <?= e(data_br(GLOSSARIO_REVISADO)) ?> com base na Constituição, na EC 103/2019, nas Leis 8.212/91 e 8.213/91, no Decreto 3.048/99 e nas normas do INSS. Valores de 2026: salário mínimo de R$ 1.621,00 e teto de R$ 8.475,55.</p>
</main>
<?php
    rodape();

} elseif (preg_match('#^/glossario/([a-z0-9-]+)$#', $rota, $m) && isset(glossario()[$m[1]])) {
    $G = glossario();
    $slug = $m[1];
    $t = $G[$slug];
    $caminho = '/glossario/' . $slug . '/';
    $rev = $t['revisado'] ?? GLOSSARIO_REVISADO;
    $artigos = array_filter(array_map('post_publicado', $t['artigos'] ?? []));
    $faq = $t['perguntas'] ?? [];
    topo($t['titulo'] . ' | ' . SITE_NOME, $t['resumo'], $caminho, [
        'artigo' => true,
        'jsonld' => ['@context' => 'https://schema.org', '@graph' => [
            ['@type' => 'Article', 'headline' => $t['titulo'], 'description' => $t['resumo'],
             'datePublished' => $t['publicado'] ?? GLOSSARIO_REVISADO, 'dateModified' => $rev,
             'author' => ['@type' => 'Organization', 'name' => SITE_NOME], 'mainEntityOfPage' => SITE_URL . $caminho,
             'about' => ['@id' => SITE_URL . $caminho . '#termo']],
            ['@type' => 'DefinedTerm', '@id' => SITE_URL . $caminho . '#termo', 'name' => $t['termo'],
             'description' => strip_tags(gl_html($t['definicao'])), 'url' => SITE_URL . $caminho,
             'inDefinedTermSet' => SITE_URL . '/glossario/'],
            ['@type' => 'BreadcrumbList', 'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Glossário', 'item' => SITE_URL . '/glossario/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => $t['termo'], 'item' => SITE_URL . $caminho]]],
        ]],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <p class="migalha"><a href="<?= e(u('/glossario/')) ?>">Glossário</a> › <a href="<?= e(u('/glossario/#t-' . $t['categoria'])) ?>"><?= e(CAT_GLOSSARIO[$t['categoria']] ?? '') ?></a></p>
    <h1><?= e($t['titulo']) ?></h1>
    <p class="meta">Revisado em <?= e(data_br($rev)) ?>.</p>
    <p class="oficial definicao"><?= gl_html($t['definicao']) ?></p>
    <?php foreach ($t['secoes'] as $s): ?>
      <h2><?= e($s['titulo']) ?></h2>
      <?= gl_blocos($s['texto']) ?>
    <?php endforeach; ?>
    <?php if (!empty($t['exemplo'])): ?>
      <div class="exemplo"><h2>Exemplo</h2><?= gl_blocos($t['exemplo']) ?><p class="dica">Exemplo fictício, só para ilustrar a regra.</p></div>
    <?php endif; ?>
    <?php if ($faq): ?>
      <h2>Perguntas frequentes</h2>
      <?php foreach ($faq as $q): ?><h3 class="pergunta"><?= e($q['pergunta']) ?></h3><p><?= gl_html($q['resposta']) ?></p><?php endforeach; ?>
    <?php endif; ?>
    <h2>Fundamento legal e fontes oficiais</h2>
    <ul class="fontes-gl">
      <?php foreach ($t['fontes'] as $f): $F = fontes_glossario()[$f['fonte']] ?? null; if (!$F) continue; ?>
        <li><?= link_externo($F[1], e($F[0])) ?><?= !empty($f['dispositivo']) ? ', ' . e($f['dispositivo']) : '' ?></li>
      <?php endforeach; ?>
    </ul>
    <p class="dica">Os links levam aos textos oficiais no Planalto e no gov.br. As normas mudam: confira sempre a versão vigente.</p>
    <?php if ($artigos): ?>
      <h2>Leia também no blog</h2>
      <ul><?php foreach ($artigos as $p): ?><li><a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <?php if (!empty($t['indicadores'])): $IND = indicadores(); ?>
      <h2>Indicadores do CNIS relacionados</h2>
      <ul class="lista-indic">
        <?php foreach ($t['indicadores'] as $k): if (!isset($IND[$k])) continue; ?>
          <li><a href="<?= e(u('/indicadores/' . slug_ind($k) . '/')) ?>"><code class="cod"><?= e($k) ?></code></a> <span><?= e(curto_ind($IND[$k])) ?></span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
    <?php $ls = legislacao_que_cita('termos', $slug); if ($ls): ?>
      <h2>Na legislação comentada</h2>
      <?php lista_legislacao($ls); ?>
    <?php endif; ?>
    <?php $qs = perguntas_que_citam('termos', $slug); if ($qs): ?>
      <h2>Perguntas frequentes sobre <?= e(nome_termo($t)) ?></h2>
      <?php lista_perguntas($qs, false); ?>
    <?php endif; ?>
    <?php $rel = array_intersect_key($G, array_flip($t['relacionados'] ?? [])); if ($rel): ?>
      <h2>Termos relacionados</h2>
      <?php lista_termos($rel); ?>
    <?php endif; ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/glossario/')) ?>">Todos os termos do glossário</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/perguntas') {
    $Q = perguntas();
    $porCat = [];
    foreach ($Q as $slug => $q) $porCat[$q['categoria']][$slug] = $q;
    $desc = count($Q) . ' perguntas frequentes sobre INSS e CNIS respondidas com base na lei: PEXT, vínculo faltando, contribuição em atraso, período de graça, regras de transição, pensão e recurso.';
    topo('Perguntas frequentes sobre INSS e CNIS por situação | ' . SITE_NOME, $desc, '/perguntas/', [
        'jsonld' => ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'url' => SITE_URL . '/perguntas/',
            'mainEntity' => array_values(array_map(fn($q) => ['@type' => 'Question', 'name' => $q['pergunta'],
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => texto_puro($q['resposta'])]], $Q))],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Perguntas frequentes sobre INSS e CNIS</h1>
  <p class="lead texto">Respostas diretas para as situações mais comuns de quem confere o extrato do CNIS ou vai pedir um benefício. Cada pergunta traz a resposta curta, a explicação, um exemplo e a base legal.</p>
  <p class="texto">As respostas se ligam ao <a href="<?= e(u('/glossario/')) ?>">glossário</a>, aos <a href="<?= e(u('/indicadores/')) ?>">indicadores do CNIS</a> e aos <a href="<?= e(u('/blog/')) ?>">guias do blog</a>, e citam a lei no Planalto e as páginas do INSS no gov.br.</p>
  <nav class="sumario-indic" aria-label="Temas das perguntas">
    <?php foreach (CAT_PERGUNTAS as $c => $rot): if (empty($porCat[$c])) continue; ?>
      <a href="#t-<?= e($c) ?>"><?= e($rot) ?> (<?= count($porCat[$c]) ?>)</a>
    <?php endforeach; ?>
  </nav>
  <?php foreach (CAT_PERGUNTAS as $c => $rot): if (empty($porCat[$c])) continue; ?>
    <h2 class="grupo-indic" id="t-<?= e($c) ?>"><?= e($rot) ?></h2>
    <?php lista_perguntas($porCat[$c]); ?>
  <?php endforeach; ?>
  <p class="meta texto">Respostas revisadas em <?= e(data_br(PERGUNTAS_REVISADAS)) ?>. Valores de 2026: salário mínimo de R$ 1.621,00 e teto de R$ 8.475,55. Conteúdo informativo, que não substitui a análise de um advogado previdenciário.</p>
</main>
<?php
    rodape();

} elseif (preg_match('#^/perguntas/([a-z0-9-]+)$#', $rota, $m) && isset(perguntas()[$m[1]])) {
    $Q = perguntas();
    $slug = $m[1];
    $q = $Q[$slug];
    $caminho = '/perguntas/' . $slug . '/';
    $rev = $q['revisado'] ?? PERGUNTAS_REVISADAS;
    $artigos = array_filter(array_map('post_publicado', $q['artigos'] ?? []));
    topo($q['titulo'] . ' | ' . SITE_NOME, $q['resumo'], $caminho, [
        'artigo' => true,
        'jsonld' => ['@context' => 'https://schema.org', '@graph' => [
            ['@type' => 'Article', 'headline' => $q['titulo'], 'description' => $q['resumo'],
             'datePublished' => $q['publicado'] ?? PERGUNTAS_REVISADAS, 'dateModified' => $rev,
             'author' => ['@type' => 'Organization', 'name' => SITE_NOME], 'mainEntityOfPage' => SITE_URL . $caminho],
            ['@type' => 'FAQPage', 'url' => SITE_URL . $caminho, 'mainEntity' => [['@type' => 'Question', 'name' => $q['pergunta'],
             'acceptedAnswer' => ['@type' => 'Answer', 'text' => texto_puro($q['resposta'])]]]],
            ['@type' => 'BreadcrumbList', 'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Perguntas frequentes', 'item' => SITE_URL . '/perguntas/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => $q['pergunta'], 'item' => SITE_URL . $caminho]]],
        ]],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <p class="migalha"><a href="<?= e(u('/perguntas/')) ?>">Perguntas frequentes</a> › <a href="<?= e(u('/perguntas/#t-' . $q['categoria'])) ?>"><?= e(CAT_PERGUNTAS[$q['categoria']] ?? '') ?></a></p>
    <h1><?= e($q['pergunta']) ?></h1>
    <p class="meta">Revisado em <?= e(data_br($rev)) ?>.</p>
    <div class="oficial resposta"><p class="resposta-rot">Resposta curta</p><p><?= gl_html($q['resposta']) ?></p></div>
    <?php foreach ($q['secoes'] as $s): ?>
      <h2><?= e($s['titulo']) ?></h2>
      <?= gl_blocos($s['texto']) ?>
    <?php endforeach; ?>
    <?php if (!empty($q['exemplo'])): ?>
      <div class="exemplo"><h2>Exemplo</h2><?= gl_blocos($q['exemplo']) ?><p class="dica">Exemplo fictício, só para ilustrar a regra.</p></div>
    <?php endif; ?>
    <h2>Fundamento legal e fontes oficiais</h2>
    <ul class="fontes-gl">
      <?php foreach ($q['fontes'] as $f): $F = fontes_glossario()[$f['fonte']] ?? null; if (!$F) continue; ?>
        <li><?= link_externo($F[1], e($F[0])) ?><?= !empty($f['dispositivo']) ? ', ' . e($f['dispositivo']) : '' ?></li>
      <?php endforeach; ?>
    </ul>
    <p class="dica">Os links levam aos textos oficiais no Planalto e no gov.br. As normas mudam: confira sempre a versão vigente.</p>
    <?php $G = glossario(); $ts = array_intersect_key($G, array_flip($q['termos'] ?? [])); if ($ts): ?>
      <h2>Termos do glossário</h2>
      <p class="termos-gl"><?php foreach ($ts as $s => $t): ?><a href="<?= e(u('/glossario/' . $s . '/')) ?>"><?= e($t['termo']) ?></a><?php endforeach; ?></p>
    <?php endif; ?>
    <?php if ($artigos): ?>
      <h2>Leia também no blog</h2>
      <ul><?php foreach ($artigos as $p): ?><li><a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <?php if (!empty($q['indicadores'])): $IND = indicadores(); ?>
      <h2>Indicadores do CNIS relacionados</h2>
      <ul class="lista-indic">
        <?php foreach ($q['indicadores'] as $k): if (!isset($IND[$k])) continue; ?>
          <li><a href="<?= e(u('/indicadores/' . slug_ind($k) . '/')) ?>"><code class="cod"><?= e($k) ?></code></a> <span><?= e(curto_ind($IND[$k])) ?></span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
    <?php $ls = legislacao_que_cita('perguntas', $slug); if ($ls): ?>
      <h2>Na legislação comentada</h2>
      <?php lista_legislacao($ls); ?>
    <?php endif; ?>
    <?php $rel = array_intersect_key($Q, array_flip($q['relacionadas'] ?? [])); if ($rel): ?>
      <h2>Outras perguntas</h2>
      <?php lista_perguntas($rel); ?>
    <?php endif; ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/perguntas/')) ?>">Todas as perguntas frequentes</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/legislacao') {
    $L = legislacao();
    $porGrupo = [];
    foreach ($L as $slug => $l) $porGrupo[$l['grupo']][$slug] = $l;
    $F = fontes_glossario();
    $desc = 'Legislação previdenciária comentada: Lei 8.213/91, Lei 8.212/91, EC 103/2019, LC 150, LOAS e Portaria 990, artigo por artigo, com exemplos e links oficiais.';
    topo('Legislação previdenciária comentada artigo por artigo | ' . SITE_NOME, $desc, '/legislacao/', [
        'jsonld' => ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => 'Legislação previdenciária comentada', 'description' => $desc, 'url' => SITE_URL . '/legislacao/',
            'hasPart' => array_values(array_map(fn($s, $l) => ['@type' => 'Article', 'headline' => $l['titulo'], 'url' => SITE_URL . '/legislacao/' . $s . '/'], array_keys($L), $L))],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Legislação previdenciária comentada</h1>
  <p class="lead texto">Os artigos que mais pesam na análise do CNIS e no pedido de benefícios, explicados em linguagem simples: o que a norma diz, o comentário, o efeito prático e um exemplo.</p>
  <p class="texto">Cada página traz o link para o texto oficial no Planalto ou no gov.br e se liga ao <a href="<?= e(u('/glossario/')) ?>">glossário</a>, às <a href="<?= e(u('/perguntas/')) ?>">perguntas frequentes</a> e aos <a href="<?= e(u('/indicadores/')) ?>">indicadores do CNIS</a>. O resumo do que cada artigo diz não substitui a leitura do texto vigente.</p>
  <nav class="sumario-indic" aria-label="Normas comentadas">
    <?php foreach (GRUPOS_LEGISLACAO as $g => $rot): if (empty($porGrupo[$g])) continue; ?>
      <a href="#g-<?= e($g) ?>"><?= e($rot) ?> (<?= count($porGrupo[$g]) ?>)</a>
    <?php endforeach; ?>
    <a href="#textos-oficiais">Textos oficiais</a>
  </nav>
  <?php foreach (GRUPOS_LEGISLACAO as $g => $rot): if (empty($porGrupo[$g])) continue; ?>
    <h2 class="grupo-indic" id="g-<?= e($g) ?>"><?= e($rot) ?></h2>
    <?php lista_legislacao($porGrupo[$g]); ?>
  <?php endforeach; ?>
  <h2 class="grupo-indic" id="textos-oficiais">Textos oficiais</h2>
  <ul class="normas">
    <?php foreach ($NORMAS as $k => $txt): if (!isset($F[$k])) continue; ?>
      <li>
        <?= link_externo($F[$k][1], e($F[$k][0])) ?>
        <p><?= e($txt) ?></p>
        <p class="fonte">Fonte: <?= e(parse_url($F[$k][1], PHP_URL_HOST)) ?>.</p>
      </li>
    <?php endforeach; ?>
  </ul>
  <p class="meta texto">Comentários revisados em <?= e(data_br(LEGISLACAO_REVISADA)) ?>; links conferidos em <?= NORMAS_CONFERIDAS_EM ?>. As normas podem ter sido alteradas desde então.</p>
</main>
<?php
    rodape();

} elseif (preg_match('#^/legislacao/([a-z0-9-]+)$#', $rota, $m) && isset(legislacao()[$m[1]])) {
    $L = legislacao();
    $slug = $m[1];
    $l = $L[$slug];
    $caminho = '/legislacao/' . $slug . '/';
    $rev = $l['revisado'] ?? LEGISLACAO_REVISADA;
    $artigos = array_filter(array_map('post_publicado', $l['artigos'] ?? []));
    $F0 = fontes_glossario()[$l['fontes'][0]['fonte']] ?? null;
    topo($l['titulo'] . ' | ' . SITE_NOME, $l['resumo'], $caminho, [
        'artigo' => true,
        'jsonld' => ['@context' => 'https://schema.org', '@graph' => [
            ['@type' => 'Article', 'headline' => $l['titulo'], 'description' => $l['resumo'],
             'datePublished' => $l['publicado'] ?? LEGISLACAO_REVISADA, 'dateModified' => $rev,
             'author' => ['@type' => 'Organization', 'name' => SITE_NOME], 'mainEntityOfPage' => SITE_URL . $caminho]
             + ($F0 ? ['about' => ['@type' => 'Legislation', 'name' => $F0[0], 'url' => $F0[1]]] : []),
            ['@type' => 'BreadcrumbList', 'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Legislação comentada', 'item' => SITE_URL . '/legislacao/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => $l['titulo'], 'item' => SITE_URL . $caminho]]],
        ]],
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <p class="migalha"><a href="<?= e(u('/legislacao/')) ?>">Legislação comentada</a> › <a href="<?= e(u('/legislacao/#g-' . $l['grupo'])) ?>"><?= e(GRUPOS_LEGISLACAO[$l['grupo']] ?? '') ?></a></p>
    <h1><?= e($l['titulo']) ?></h1>
    <p class="meta"><?= e($l['norma']) ?>. Revisado em <?= e(data_br($rev)) ?>.</p>
    <p class="lead-artigo"><?= gl_html($l['introducao']) ?></p>
    <?php if (count($l['dispositivos']) > 3): ?>
      <nav class="indice-leg" aria-label="Dispositivos comentados"><p>Nesta página:</p><ul>
        <?php foreach ($l['dispositivos'] as $n => $d): ?><li><a href="#d<?= $n + 1 ?>"><?= e($d['referencia']) ?></a></li><?php endforeach; ?>
      </ul></nav>
    <?php endif; ?>
    <?php foreach ($l['dispositivos'] as $n => $d): ?>
      <section class="dispositivo" id="d<?= $n + 1 ?>">
        <h2><?= e($d['referencia']) ?></h2>
        <div class="oficial"><p class="resposta-rot">O que diz</p><p><?= gl_html($d['o_que_diz']) ?></p></div>
        <p class="resposta-rot comentario-rot">Comentário</p>
        <?= gl_blocos($d['comentario']) ?>
      </section>
    <?php endforeach; ?>
    <h2>Na prática</h2>
    <?= gl_blocos([$l['na_pratica']]) ?>
    <div class="exemplo"><h2>Exemplo</h2><?= gl_blocos($l['exemplo']) ?><p class="dica">Exemplo fictício, só para ilustrar a regra.</p></div>
    <h2>Texto oficial e fontes</h2>
    <ul class="fontes-gl">
      <?php foreach ($l['fontes'] as $f): $F = fontes_glossario()[$f['fonte']] ?? null; if (!$F) continue; ?>
        <li><?= link_externo($F[1], e($F[0])) ?><?= !empty($f['dispositivo']) ? ', ' . e($f['dispositivo']) : '' ?></li>
      <?php endforeach; ?>
    </ul>
    <p class="dica">"O que diz" resume o dispositivo em linguagem simples; para citar ou decidir, leia o texto oficial vigente.</p>
    <?php $G = glossario(); $ts = array_intersect_key($G, array_flip($l['termos'] ?? [])); if ($ts): ?>
      <h2>Termos do glossário</h2>
      <p class="termos-gl"><?php foreach ($ts as $s => $t): ?><a href="<?= e(u('/glossario/' . $s . '/')) ?>"><?= e($t['termo']) ?></a><?php endforeach; ?></p>
    <?php endif; ?>
    <?php $Q = perguntas(); $qs = array_intersect_key($Q, array_flip($l['perguntas'] ?? [])); if ($qs): ?>
      <h2>Perguntas frequentes</h2>
      <?php lista_perguntas($qs, false); ?>
    <?php endif; ?>
    <?php if ($artigos): ?>
      <h2>Leia também no blog</h2>
      <ul><?php foreach ($artigos as $p): ?><li><a href="<?= e(u('/blog/' . $p['slug'] . '/')) ?>"><?= e($p['titulo']) ?></a></li><?php endforeach; ?></ul>
    <?php endif; ?>
    <?php if (!empty($l['indicadores'])): $IND = indicadores(); ?>
      <h2>Indicadores do CNIS relacionados</h2>
      <ul class="lista-indic">
        <?php foreach ($l['indicadores'] as $k): if (!isset($IND[$k])) continue; ?>
          <li><a href="<?= e(u('/indicadores/' . slug_ind($k) . '/')) ?>"><code class="cod"><?= e($k) ?></code></a> <span><?= e(curto_ind($IND[$k])) ?></span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
    <?php $rel = array_intersect_key($L, array_flip($l['relacionadas'] ?? [])); if ($rel): ?>
      <h2>Outras normas comentadas</h2>
      <?php lista_legislacao($rel); ?>
    <?php endif; ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/legislacao/')) ?>">Toda a legislação comentada</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/privacidade') {
    topo('Política de privacidade | ' . SITE_NOME, 'Como o site trata dados de visitantes e por que o extrato do CNIS não sai do seu navegador.', '/privacidade/');
    ?>
<main id="conteudo" class="wrap pagina">
  <article class="artigo">
    <h1>Política de privacidade</h1>
    <p class="meta">Atualizada em 07/10/2026.</p>
    <?php /* TODO: preencher responsável e contato, e revisar o texto com profissional jurídico antes de publicar. */ ?>

    <h2>Quem é o responsável</h2>
    <p>Este site é mantido por [nome do responsável]. Para dúvidas sobre privacidade, escreva para [e-mail de contato].</p>

    <h2>Extrato do CNIS</h2>
    <p>A análise acontece inteiramente no seu navegador. O PDF ou o texto que você informa não é enviado para nossos servidores, não é salvo e não aparece em registros. Ao recarregar a página, os dados somem.</p>
    <p>A página da ferramenta usa apenas arquivos deste mesmo site, inclusive a biblioteca que lê o PDF, e tem uma regra de segurança que bloqueia qualquer conexão de saída. Ela não carrega Analytics, anúncios nem fontes de terceiros.</p>

    <h2>Visitas ao site</h2>
    <p>As demais páginas podem usar o Google Analytics para medir visitas de forma agregada, como páginas acessadas e tipo de dispositivo. Esses dados não identificam você diretamente.</p>

    <h2>Publicidade</h2>
    <p>Os artigos podem exibir anúncios do Google AdSense. O Google pode usar cookies para mostrar anúncios com base em visitas anteriores a este e a outros sites. Você pode ajustar essas preferências em <a href="https://adssettings.google.com" rel="noopener">adssettings.google.com</a>.</p>

    <h2>Cookies</h2>
    <p>O site não grava cookies próprios. Os cookies existentes vêm do Google Analytics e do Google AdSense, quando ativados, e você pode bloqueá-los nas configurações do navegador.</p>

    <h2>Seus direitos</h2>
    <p>Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir confirmação de tratamento, acesso, correção e eliminação dos dados pessoais sob responsabilidade deste site, pelo contato acima.</p>

    <h2>Alterações</h2>
    <p>Esta política pode mudar. A data da última atualização fica sempre no topo da página.</p>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/analise-cnis') {
    // Sem Analytics e sem anúncios aqui. A regra abaixo impede qualquer conexão de saída.
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; worker-src 'self' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!FERRAMENTA_PUBLICA) header('X-Robots-Tag: noindex, nofollow');
    topo('Análise de CNIS | ' . SITE_NOME, 'Tempo contado, salários faltantes e pendências no extrato do CNIS, direto no navegador.', '/analise-cnis/', [
        'rastreio' => false, 'noindex' => !FERRAMENTA_PUBLICA,
    ]);
    ?>
<main id="conteudo" class="wrap pagina">
  <h1>Análise de CNIS</h1>
  <p class="lead texto">Envie o PDF do extrato ou cole o texto para ver o tempo contado, os salários faltantes e as pendências.</p>
  <p class="aviso-privacidade">Tudo acontece no seu navegador. O extrato não é enviado, salvo ou registrado.</p>
  <p class="passo-link">Ainda não tem o PDF? <a href="<?= e(u('/blog/como-baixar-o-cnis-em-pdf-com-remuneracoes/')) ?>">Veja o passo a passo com imagens para baixar o extrato no Meu INSS</a>. Escolha a opção <strong>Vínculos, contribuições e remunerações</strong>. Se preferir, use também o botão <em>Lançar tempo manualmente</em>.</p>

  <form id="cnis-form" class="painel">
    <label class="campo">PDF do extrato
      <input type="file" id="cnis-arquivo" accept="application/pdf,.pdf">
    </label>
    <label class="campo">Ou cole o texto do extrato
      <textarea id="cnis-texto" rows="7" spellcheck="false"></textarea>
    </label>
    <div class="acoes">
      <button class="btn" type="submit">Analisar</button>
      <button class="btn btn-leve" type="button" id="cnis-manual" aria-expanded="false" aria-controls="man-painel">Lançar tempo manualmente</button>
      <button class="btn btn-leve" type="button" id="cnis-exemplo">Carregar exemplo fictício</button>
      <button class="btn btn-leve" type="button" id="cnis-limpar">Limpar</button>
    </div>
    <p class="msg" id="cnis-msg" role="status"></p>
  </form>

  <section id="man-painel" class="painel" hidden aria-labelledby="man-titulo">
    <h2 id="man-titulo" class="man-titulo">Lançar tempo manualmente</h2>
    <p class="texto">Sem o PDF, informe o tipo de vínculo e o período. Cada mês será considerado com o salário mínimo da época, então serve para simular e não substitui o CNIS. Deixe o fim em branco se o vínculo continua.</p>
    <div id="man-lista" class="man-lista"></div>
    <div class="acoes">
      <button class="btn btn-leve" type="button" id="man-add">Adicionar período</button>
      <button class="btn" type="button" id="man-analisar">Analisar lançamentos</button>
    </div>
    <p class="msg" id="man-msg" role="status"></p>
  </section>

  <div id="cnis-resultado" aria-live="polite"></div>
</main>
<script src="<?= e(u('/assets/vendor/pdf.min.js')) ?>"></script>
<script src="<?= e(u('/assets/cnis.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/cnis.js') ?>"></script>
<script src="<?= e(u('/assets/direito.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/direito.js') ?>"></script>
<script src="<?= e(u('/assets/pensao.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/pensao.js') ?>"></script>
<script src="<?= e(u('/assets/beneficios.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/beneficios.js') ?>"></script>
<script src="<?= e(u('/assets/idade.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/idade.js') ?>"></script>
<script src="<?= e(u('/assets/tempo.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/tempo.js') ?>"></script>
<?php
    rodape();

} elseif ($rota === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $urls = [['/', null], ['/blog/', null], ['/glossario/', GLOSSARIO_REVISADO], ['/indicadores/', INDICADORES_REVISADOS], ['/legislacao/', LEGISLACAO_REVISADA], ['/privacidade/', null]];
    foreach (glossario() as $s => $t) $urls[] = ['/glossario/' . $s . '/', $t['revisado'] ?? GLOSSARIO_REVISADO];
    foreach (legislacao() as $s => $l) $urls[] = ['/legislacao/' . $s . '/', $l['revisado'] ?? LEGISLACAO_REVISADA];
    $urls[] = ['/perguntas/', PERGUNTAS_REVISADAS];
    foreach (perguntas() as $s => $q) $urls[] = ['/perguntas/' . $s . '/', $q['revisado'] ?? PERGUNTAS_REVISADAS];
    foreach (array_keys(indicadores()) as $k) $urls[] = ['/indicadores/' . slug_ind($k) . '/', INDICADORES_REVISADOS];
    if (FERRAMENTA_PUBLICA) $urls[] = ['/analise-cnis/', null];
    foreach (publicados() as $p) $urls[] = ['/blog/' . $p['slug'] . '/', $p['revisado'] ?? $p['data']];
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($urls as [$c, $d]) {
        echo '  <url><loc>' . e(SITE_URL . $c) . '</loc>' . ($d ? '<lastmod>' . e($d) . '</lastmod>' : '') . "</url>\n";
    }
    echo '</urlset>' . "\n";

} else {
    pagina_404();
}
