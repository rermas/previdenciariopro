<?php
/*
 * Análise CNIS: PHP puro, sem banco de dados, com um único roteador.
 * Rotas: /  /blog/  /blog/{slug}/  /indicadores/  /indicadores/{codigo}/  /legislacao/  /privacidade/  /analise-cnis/  /sitemap.xml
 */

// ---------- Configuração ----------
const SITE_NOME = 'Análise CNIS';
const SITE_URL = 'https://www.seudominio.com.br'; // domínio final, sem barra no fim
const GA_ID = '';                 // 'G-XXXXXXXXXX'. Vazio: o Analytics não é carregado.
const ADSENSE = '';               // 'ca-pub-XXXXXXXXXXXXXXXX'. Vazio: sem anúncios.
const ADS_ATIVOS = false;         // true só depois da aprovação do AdSense.
const FERRAMENTA_PUBLICA = false; // true: links para a ferramenta, indexação liberada e sitemap.

date_default_timezone_set('America/Sao_Paulo');

// Artigos: o texto de cada um fica em posts/{slug}.html.
// 'data' no futuro mantém o artigo oculto até o dia.
$POSTS = [
    ['slug' => 'o-que-e-o-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-07',
     'titulo' => 'O que é o CNIS e o que conferir no extrato',
     'resumo' => 'Entenda o que aparece no extrato do CNIS e quais pontos merecem conferência.'],
    ['slug' => 'salarios-faltantes-no-cnis', 'data' => '2026-10-07', 'revisado' => '2026-10-07',
     'titulo' => 'Salários faltantes no CNIS: como identificar',
     'resumo' => 'O que significa uma competência sem remuneração, quando isso é esperado e como conferir.'],
];

// Fontes oficiais. Os textos mudam: a versão vigente é a do site de origem.
$NORMAS = [
    ['titulo' => 'Lei nº 8.213, de 24 de julho de 1991',
     'texto' => 'Dispõe sobre os Planos de Benefícios da Previdência Social. É a base das regras de segurado, carência e benefícios.',
     'url' => 'https://www.planalto.gov.br/ccivil_03/leis/L8213compilado.htm', 'fonte' => 'Planalto, texto compilado'],
    ['titulo' => 'Decreto nº 3.048, de 6 de maio de 1999',
     'texto' => 'Aprova o Regulamento da Previdência Social. Detalha, entre outros temas, a contagem de tempo e o cálculo dos benefícios.',
     'url' => 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm', 'fonte' => 'Planalto, texto compilado'],
    ['titulo' => 'Instrução Normativa PRES/INSS nº 128, de 28 de março de 2022',
     'texto' => 'Disciplina a aplicação das normas de direito previdenciário pelo INSS. Foi alterada depois de publicada, então confira a versão vigente.',
     'url' => 'https://www.gov.br/inss/pt-br/centrais-de-conteudo/legislacao/instrucao-normativa/2022/instrucao-normativa-pres-inss-no-128-de-28-de-marco-de-2022', 'fonte' => 'gov.br/inss'],
];
const NORMAS_CONFERIDAS_EM = '07/10/2026';

// Indicadores do CNIS: uma página por código em /indicadores/{codigo}/.
// 'oficial' é o texto da legenda do extrato (quando conferido em extratos reais). Os demais vêm da prática previdenciária: confirme na legenda do seu extrato.
const INDICADORES_REVISADOS = '2026-10-09';
$INDICADORES = [
    'PSC-MEN-SM-EC103' => ['grupo' => 'Pendência', 'oficial' => 'Pendência na competência em que o salário de contribuição é menor que o salário mínimo mensal. A competência pode ser passível de complementação, utilização ou agrupamento, de acordo com a EC 103/2019.',
        'curto' => 'Competência com valor abaixo do salário mínimo.',
        'sig' => 'A soma dos salários de contribuição da competência ficou abaixo do salário mínimo mensal. O INSS marca o mês como pendente porque, desde a Emenda Constitucional 103/2019, uma competência nessa situação só é aproveitada em condições específicas.',
        'imp' => 'Sem tratamento, o mês pode não contar como contribuição para carência e tempo. A regra permite complementar a diferença, utilizar o valor para completar outro mês ou agrupar competências, e cada caminho tem requisitos próprios.',
        'conf' => ['Some todos os vínculos da mesma competência: o total é que deve ser comparado ao mínimo.', 'Veja se é mês de início ou fim de vínculo, quando o valor proporcional é esperado.', 'Verifique se houve complementação ou agrupamento e se aparece no extrato.'],
        'base' => 'EC 103/2019, art. 29; Constituição, art. 195, § 14; Decreto 3.048/99 (confira a versão vigente sobre complementação, utilização e agrupamento).'],
    'IREM-INDPEND' => ['grupo' => 'Pendência', 'oficial' => 'Remunerações com indicadores/pendências.',
        'curto' => 'O vínculo tem remunerações com indicadores ou pendências.',
        'sig' => 'É um aviso no cabeçalho do vínculo: ao menos uma das remunerações dele traz outro indicador ou pendência. O código não diz qual competência, então é preciso olhar a lista de remunerações.',
        'imp' => 'Remunerações com pendência podem ser desconsideradas ou exigir comprovação antes de entrar no cálculo do benefício.',
        'conf' => ['Localize as competências que têm indicador na lista de remunerações.', 'Veja o significado de cada indicador na legenda do extrato.', 'Reúna holerites, GFIP ou eSocial das competências marcadas.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F (dados do CNIS).'],
    'IREC-INDPEND' => ['grupo' => 'Pendência', 'oficial' => 'Recolhimentos com indicadores/pendências.',
        'curto' => 'O vínculo de recolhimentos tem indicadores ou pendências.',
        'sig' => 'Aparece em vínculos de contribuinte individual ou facultativo, quando algum recolhimento traz indicador ou pendência. Funciona como o IREM-INDPEND, só que para guias pagas pelo próprio segurado.',
        'imp' => 'Recolhimentos pendentes podem não ser reconhecidos até serem regularizados ou comprovados.',
        'conf' => ['Identifique as competências com indicador na lista de contribuições.', 'Confira se a guia foi paga, no valor e na categoria corretos.', 'Guarde os comprovantes de pagamento.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F; Lei 8.212/91 (contribuição do segurado).'],
    'IREM-ACD' => ['grupo' => 'Informativo', 'oficial' => 'Remuneração possui parcela de Acordo, Convenção ou Dissídio Coletivo.',
        'curto' => 'Parte da remuneração vem de acordo, convenção ou dissídio coletivo.',
        'sig' => 'A competência tem um valor extra, lançado em separado, decorrente de acordo, convenção ou dissídio coletivo. Por isso o mesmo mês pode aparecer duas vezes na lista, com valores diferentes.',
        'imp' => 'As duas parcelas somam o salário de contribuição do mês. Se uma delas estiver errada ou ausente, o total muda.',
        'conf' => ['Some as parcelas da competência e compare com o consolidado do extrato.', 'Confira se o valor extra tem relação com reajuste retroativo da categoria.'],
        'base' => 'Lei 8.212/91, art. 28 (salário de contribuição).'],
    'AVRC-DEF' => ['grupo' => 'Informativo', 'oficial' => 'Acerto confirmado pelo INSS.',
        'curto' => 'O INSS confirmou o acerto feito no registro.',
        'sig' => 'O dado foi corrigido a pedido e o INSS confirmou o acerto. É um indicador favorável: mostra que a informação passou por validação.',
        'imp' => 'Dados com acerto confirmado tendem a gerar menos dúvida no cálculo do benefício.',
        'conf' => ['Veja se o acerto cobre todo o período que você pediu.', 'Guarde o protocolo do pedido e os documentos enviados.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'IVIN-PROC-TRAB' => ['grupo' => 'Pendência', 'oficial' => 'Vínculo possui Processo Trabalhista.',
        'curto' => 'O vínculo foi incluído ou alterado por processo trabalhista.',
        'sig' => 'O registro do vínculo, ou parte dele, tem origem em uma ação trabalhista. O INSS costuma tratar esses dados com cautela até confirmar a base documental.',
        'imp' => 'Vínculos reconhecidos em juízo podem exigir prova material do período e das verbas, e as contribuições devem ter sido recolhidas.',
        'conf' => ['Guarde sentença, acordo, cálculos de liquidação e guias das contribuições.', 'Confira se as competências e valores lançados batem com a decisão.', 'Veja se há outros indicadores no mesmo vínculo.'],
        'base' => 'Lei 8.213/91, art. 55, § 3º (início de prova material); Decreto 3.048/99, arts. 19 a 19-F.'],
    'IREC-MEI' => ['grupo' => 'Informativo', 'oficial' => 'Indica que a contribuição da competência foi recolhida com código MEI.',
        'curto' => 'Contribuição recolhida como Microempreendedor Individual.',
        'sig' => 'A competência foi paga pela guia do MEI, com alíquota reduzida sobre o salário mínimo.',
        'imp' => 'A contribuição reduzida dá acesso a parte dos benefícios, e para alguns deles, como a aposentadoria por tempo de contribuição, a lei exige complementação.',
        'conf' => ['Confira se todas as competências do período aparecem pagas.', 'Verifique se houve complementação quando o benefício pretendido exige.'],
        'base' => 'LC 123/2006, art. 18-A (confira os parágrafos sobre complementação).'],
    'IREC-LC123' => ['grupo' => 'Informativo', 'oficial' => 'Recolhimento no Plano Simplificado de Previdência Social (LC 123/2006).',
        'curto' => 'Recolhimento no plano simplificado de previdência.',
        'sig' => 'A contribuição foi paga em alíquota reduzida, no plano simplificado previsto na LC 123/2006. Costuma aparecer junto com IREC-MEI nos recolhimentos do microempreendedor.',
        'imp' => 'Esse plano não dá acesso a todos os benefícios sem complementação. O que conta depende do benefício pedido.',
        'conf' => ['Veja qual benefício você pretende e se ele exige complementar a contribuição.', 'Confira as competências e as datas de pagamento.'],
        'base' => 'LC 123/2006; Lei 8.212/91, art. 21.'],
    'PREM-EXT' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Remuneração informada fora do prazo.',
        'sig' => 'A remuneração da competência chegou ao CNIS depois do prazo normal de informação, por exemplo por declaração tardia do empregador.',
        'imp' => 'Informações extemporâneas podem exigir documentos que as sustentem antes de serem aceitas em cálculos.',
        'conf' => ['Reúna holerites, recibos e a CTPS do período.', 'Peça ao empregador a retificação ou a comprovação, se for o caso.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PEXT' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Vínculo registrado fora do prazo.',
        'sig' => 'O vínculo foi inserido no CNIS depois do prazo, em vez de ter sido informado na época pelo empregador.',
        'imp' => 'O INSS pode pedir prova do vínculo, como CTPS, ficha de registro e recibos, para considerar o período.',
        'conf' => ['Junte CTPS, contrato, ficha de registro e comprovantes de pagamento.', 'Verifique se as datas do vínculo estão corretas.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F; Lei 8.213/91, art. 55.'],
    'PREC-MENOR-MIN' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Contribuição abaixo do salário mínimo.',
        'sig' => 'O recolhimento da competência ficou abaixo do mínimo exigido para a categoria do segurado.',
        'imp' => 'A competência pode não ser reconhecida como contribuição enquanto não houver complementação.',
        'conf' => ['Compare o valor pago com o salário mínimo da competência.', 'Veja se ainda é possível complementar e dentro de que regras.'],
        'base' => 'Lei 8.212/91, art. 28 e art. 21; EC 103/2019, art. 29.'],
    'PREM-FVIN' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Remuneração depois do fim do vínculo.',
        'sig' => 'Há remuneração em competência posterior à data de término do vínculo.',
        'imp' => 'Pode ser verba rescisória lançada em mês seguinte, ou erro na data de saída. A diferença muda o tempo contado.',
        'conf' => ['Confira a data de rescisão na CTPS e no termo de rescisão.', 'Veja se o valor posterior é de verbas finais.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREM-IVIN' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Remuneração antes do início do vínculo.',
        'sig' => 'Há remuneração em competência anterior à data de admissão registrada.',
        'imp' => 'Costuma indicar data de admissão lançada errada, o que pode reduzir o tempo do vínculo.',
        'conf' => ['Confira a data de admissão na CTPS e na ficha de registro.', 'Peça a retificação ao empregador, se a data estiver errada.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PADM-EMPR' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Admissão anterior ao início de atividade do empregador.',
        'sig' => 'A data de admissão é anterior à data de início de atividade do empregador no cadastro.',
        'imp' => 'A divergência pode vir do cadastro do empregador ou da data de admissão, e o INSS pode exigir comprovação.',
        'conf' => ['Compare a admissão com a data de abertura da empresa.', 'Guarde provas de que o trabalho ocorreu na data informada.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREM-EMPR' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Remuneração anterior ao início de atividade do empregador.',
        'sig' => 'Há remuneração em competência anterior ao início de atividade do empregador no cadastro.',
        'imp' => 'Pode ser erro no cadastro da empresa ou nas competências lançadas, e pede comprovação.',
        'conf' => ['Verifique a data de abertura do empregador.', 'Reúna holerites e documentos do período.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PRES-EMPR' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Rescisão anterior ao início de atividade do empregador.',
        'sig' => 'A data de saída é anterior ao início de atividade do empregador no cadastro.',
        'imp' => 'Aponta inconsistência entre o vínculo e o cadastro da empresa, e pode exigir comprovação.',
        'conf' => ['Compare as datas do vínculo com as do cadastro da empresa.', 'Guarde o termo de rescisão e a CTPS.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PEMP-CAD' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Dados cadastrais do empregador ausentes ou inconsistentes.',
        'sig' => 'O cadastro do empregador tem informações faltando ou que não batem com as bases oficiais.',
        'imp' => 'O vínculo pode ficar sem validação até o cadastro ser regularizado.',
        'conf' => ['Confira o CNPJ ou CPF do empregador no vínculo.', 'Solicite a correção ao empregador ou ao INSS, com documentos.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
    'PREC-FACULTCONC' => ['grupo' => 'Pendência', 'oficial' => null,
        'curto' => 'Contribuição facultativa junto com atividade obrigatória.',
        'sig' => 'Há recolhimento como facultativo em competência em que também existe vínculo obrigatório com a Previdência.',
        'imp' => 'O facultativo é para quem não exerce atividade obrigatória, então o recolhimento pode não ser reconhecido naquele mês.',
        'conf' => ['Compare as competências do recolhimento com os vínculos ativos.', 'Veja se o recolhimento deveria ter sido na categoria de contribuinte individual.'],
        'base' => 'Lei 8.213/91, arts. 11 e 13.'],
    'IEAN' => ['grupo' => 'Informativo', 'oficial' => null,
        'curto' => 'Exposição a agente nocivo informada pelo empregador.',
        'sig' => 'O empregador informou que o trabalhador esteve exposto a agente nocivo à saúde na competência.',
        'imp' => 'A informação pode ser relevante para o reconhecimento de tempo especial, que depende de comprovação adequada.',
        'conf' => ['Peça o PPP e o laudo que embasam a informação.', 'Compare o período com o cargo e o local de trabalho.'],
        'base' => 'Lei 8.213/91, arts. 57 e 58.'],
    'PRPPS' => ['grupo' => 'Informativo', 'oficial' => null,
        'curto' => 'Período em regime próprio de previdência.',
        'sig' => 'O período está ligado a um regime próprio de previdência, como o de servidores públicos.',
        'imp' => 'Para somar esse tempo ao do INSS, normalmente é preciso a certidão de tempo de contribuição.',
        'conf' => ['Solicite a CTC ao órgão do regime próprio.', 'Evite contar o mesmo período nos dois regimes.'],
        'base' => 'Lei 8.213/91, art. 94 (contagem recíproca).'],
    'AEXT-VT' => ['grupo' => 'Informativo', 'oficial' => null,
        'curto' => 'Correção de vínculo extemporâneo validada.',
        'sig' => 'Indica que um vínculo extemporâneo passou por correção e foi validado pelo INSS.',
        'imp' => 'Geralmente é um sinal favorável: o INSS aceitou os documentos que sustentam o vínculo.',
        'conf' => ['Guarde o protocolo e os documentos do pedido.', 'Confira se datas e remunerações ficaram corretas.'],
        'base' => 'Decreto 3.048/99, arts. 19 a 19-F.'],
];

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
<header class="topo">
  <div class="wrap topo-in">
    <a class="marca" href="<?= e(u('/')) ?>"><?= marca_svg() ?><?= e(SITE_NOME) ?></a>
    <nav class="menu" aria-label="Principal">
      <?php if (FERRAMENTA_PUBLICA): ?><a href="<?= e(u('/analise-cnis/')) ?>">Analisar CNIS</a><?php endif; ?>
      <a href="<?= e(u('/blog/')) ?>">Blog</a>
      <a href="<?= e(u('/indicadores/')) ?>">Indicadores</a>
      <a href="<?= e(u('/legislacao/')) ?>">Legislação</a>
      <a href="<?= e(u('/privacidade/')) ?>">Privacidade</a>
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
    echo '<main class="wrap pagina"><h1>Página não encontrada</h1><p>O endereço não existe ou o artigo ainda não foi publicado.</p>'
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

if ($rota === '/') {
    $recentes = array_slice(publicados(), 0, 3);
    topo(SITE_NOME . ' | Confira o seu CNIS mês a mês', 'Guias e uma ferramenta gratuita para encontrar salários faltantes, pendências e o tempo contado no extrato do CNIS.', '/');
    ?>
<main class="wrap">
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
    <h2>Indicadores do CNIS</h2>
    <div class="texto">
      <p>PSC-MEN-SM-EC103, IREM-INDPEND, PEXT e outros códigos que aparecem no extrato, com o que cada um significa e o que conferir.</p>
      <a class="mais" href="<?= e(u('/indicadores/')) ?>">Ver os indicadores</a>
    </div>
  </section>

  <section class="faixa">
    <h2>Legislação de referência</h2>
    <div class="texto">
      <p>Lei 8.213/91, Decreto 3.048/99 e IN PRES/INSS 128/2022, com links para as fontes oficiais.</p>
      <a class="mais" href="<?= e(u('/legislacao/')) ?>">Ver a legislação</a>
    </div>
  </section>
</main>
<?php
    rodape();

} elseif ($rota === '/blog') {
    topo('Blog | ' . SITE_NOME, 'Guias sobre o extrato do CNIS, vínculos, remunerações e pendências.', '/blog/');
    ?>
<main class="wrap pagina">
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
        ],
    ]);
    ?>
<main class="wrap pagina">
  <article class="artigo">
    <h1><?= e($post['titulo']) ?></h1>
    <p class="meta">Publicado em <?= e(data_br($post['data'])) ?><?php if (!empty($post['revisado'])): ?>. Revisado em <?= e(data_br($post['revisado'])) ?>.<?php endif; ?></p>
    <?php readfile($arquivo); ?>
    <p class="aviso-fim">Conteúdo informativo. Cada caso depende dos documentos e da legislação aplicável, e a orientação de um advogado previdenciário não é substituída por este texto.</p>
    <?php anuncio(); ?>
    <a class="voltar" href="<?= e(u('/blog/')) ?>">Todos os artigos</a>
  </article>
</main>
<?php
    rodape();

} elseif ($rota === '/indicadores') {
    topo('Indicadores do CNIS: significado e o que conferir | ' . SITE_NOME, 'Lista dos indicadores do extrato do CNIS, como PSC-MEN-SM-EC103, IREM-INDPEND e PEXT, com o significado e o que conferir em cada um.', '/indicadores/');
    ?>
<main class="wrap pagina">
  <h1>Indicadores do CNIS</h1>
  <p class="lead texto">Os códigos que aparecem ao lado de vínculos e remunerações no extrato. Cada página explica o que o indicador quer dizer e o que conferir.</p>
  <?php foreach (['Pendência' => 'Pendências', 'Informativo' => 'Informativos'] as $g => $titulo): ?>
    <h2 class="grupo-indic"><?= e($titulo) ?></h2>
    <ul class="lista-indic">
      <?php foreach ($INDICADORES as $cod => $i): if ($i['grupo'] !== $g) continue; ?>
        <li><a href="<?= e(u('/indicadores/' . strtolower($cod) . '/')) ?>"><code class="cod"><?= e($cod) ?></code></a> <span><?= e($i['curto']) ?></span></li>
      <?php endforeach; ?>
    </ul>
  <?php endforeach; ?>
  <p class="meta texto">Os textos oficiais vêm da legenda do extrato e as demais explicações da prática previdenciária. Confira sempre a legenda do seu extrato e a legislação vigente.</p>
</main>
<?php
    rodape();

} elseif (preg_match('#^/indicadores/([a-z0-9-]+)$#', $rota, $m) && isset($INDICADORES[strtoupper($m[1])])) {
    $cod = strtoupper($m[1]);
    $i = $INDICADORES[$cod];
    $caminho = '/indicadores/' . strtolower($cod) . '/';
    $titulo = $cod . ' no CNIS: o que significa';
    $desc = $cod . ': ' . $i['curto'] . ' Veja o que significa e o que conferir no extrato do CNIS.';
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
    $parecidos = array_slice(array_keys(array_filter($INDICADORES, fn($x, $k) => $k !== $cod && $x['grupo'] === $i['grupo'], ARRAY_FILTER_USE_BOTH)), 0, 4);
    ?>
<main class="wrap pagina">
  <article class="artigo">
    <p class="migalha"><a href="<?= e(u('/indicadores/')) ?>">Indicadores do CNIS</a></p>
    <h1><code class="cod"><?= e($cod) ?></code> no CNIS: o que significa</h1>
    <p class="meta"><?= e($i['grupo']) ?>. Revisado em <?= e(data_br(INDICADORES_REVISADOS)) ?>.</p>
    <p class="lead"><?= e($i['curto']) ?></p>
    <?php if ($i['oficial']): ?>
      <p class="oficial"><strong>Legenda do extrato:</strong> <?= e($i['oficial']) ?></p>
    <?php else: ?>
      <p class="oficial">Este código nem sempre vem explicado na legenda do extrato. A descrição abaixo segue a prática previdenciária, então confira também a legenda do seu documento.</p>
    <?php endif; ?>
    <h2>O que significa</h2>
    <p><?= e($i['sig']) ?></p>
    <h2>Por que importa</h2>
    <p><?= e($i['imp']) ?></p>
    <h2>O que conferir</h2>
    <ul>
      <?php foreach ($i['conf'] as $c): ?><li><?= e($c) ?></li><?php endforeach; ?>
    </ul>
    <h2>Base normativa</h2>
    <p><?= e($i['base']) ?> Veja os links oficiais em <a href="<?= e(u('/legislacao/')) ?>">Legislação</a>; os textos mudam, então confira a versão vigente.</p>
    <?php if ($parecidos): ?>
      <h2>Veja também</h2>
      <ul class="lista-indic">
        <?php foreach ($parecidos as $k): ?>
          <li><a href="<?= e(u('/indicadores/' . strtolower($k) . '/')) ?>"><code class="cod"><?= e($k) ?></code></a> <span><?= e($INDICADORES[$k]['curto']) ?></span></li>
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

} elseif ($rota === '/legislacao') {
    topo('Legislação previdenciária | ' . SITE_NOME, 'Links oficiais para a Lei 8.213/91, o Decreto 3.048/99 e a IN PRES/INSS 128/2022.', '/legislacao/');
    ?>
<main class="wrap pagina">
  <h1>Legislação previdenciária</h1>
  <p class="lead texto">As normas usadas como referência nos guias. Os links levam às fontes oficiais.</p>
  <ul class="normas">
    <?php foreach ($NORMAS as $n): ?>
      <li>
        <a href="<?= e($n['url']) ?>" target="_blank" rel="noopener noreferrer"><?= e($n['titulo']) ?></a>
        <p><?= e($n['texto']) ?></p>
        <p class="fonte">Fonte: <?= e($n['fonte']) ?>.</p>
      </li>
    <?php endforeach; ?>
  </ul>
  <p class="meta texto">Links conferidos em <?= NORMAS_CONFERIDAS_EM ?>. As normas podem ter sido alteradas desde então, e esta lista não substitui a leitura do texto vigente.</p>
</main>
<?php
    rodape();

} elseif ($rota === '/privacidade') {
    topo('Política de privacidade | ' . SITE_NOME, 'Como o site trata dados de visitantes e por que o extrato do CNIS não sai do seu navegador.', '/privacidade/');
    ?>
<main class="wrap pagina">
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
<main class="wrap pagina">
  <h1>Análise de CNIS</h1>
  <p class="lead texto">Envie o PDF do extrato ou cole o texto para ver o tempo contado, os salários faltantes e as pendências.</p>
  <p class="aviso-privacidade">Tudo acontece no seu navegador. O extrato não é enviado, salvo ou registrado.</p>

  <form id="cnis-form" class="painel">
    <label class="campo">PDF do extrato
      <input type="file" id="cnis-arquivo" accept="application/pdf,.pdf">
    </label>
    <label class="campo">Ou cole o texto do extrato
      <textarea id="cnis-texto" rows="7" spellcheck="false"></textarea>
    </label>
    <div class="acoes">
      <button class="btn" type="submit">Analisar</button>
      <button class="btn btn-leve" type="button" id="cnis-exemplo">Carregar exemplo fictício</button>
      <button class="btn btn-leve" type="button" id="cnis-limpar">Limpar</button>
    </div>
    <p class="msg" id="cnis-msg" role="status"></p>
  </form>

  <div id="cnis-resultado" aria-live="polite"></div>
</main>
<script src="<?= e(u('/assets/vendor/pdf.min.js')) ?>"></script>
<script src="<?= e(u('/assets/cnis.js')) ?>?v=<?= filemtime(__DIR__ . '/assets/cnis.js') ?>"></script>
<?php
    rodape();

} elseif ($rota === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $urls = [['/', null], ['/blog/', null], ['/indicadores/', INDICADORES_REVISADOS], ['/legislacao/', null], ['/privacidade/', null]];
    foreach (array_keys($INDICADORES) as $k) $urls[] = ['/indicadores/' . strtolower($k) . '/', INDICADORES_REVISADOS];
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
