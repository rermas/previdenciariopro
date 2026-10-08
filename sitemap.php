<?php
require __DIR__ . '/config.php';

header('Content-Type: application/xml; charset=utf-8');

$posts = require __DIR__ . '/blog/posts.php';
$hoje = date('Y-m-d');

// A página da ferramenta (/analise-cnis/) fica fora do sitemap enquanto estiver em desenvolvimento.
$urls = [['/', null], ['/blog/', null], ['/legislacao/', null], ['/privacidade/', null]];
foreach ($posts as $p) {
    if ($p['date'] <= $hoje) {
        $urls[] = ['/blog/' . $p['slug'] . '/', $p['date']];
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as [$caminho, $data]) {
    echo '  <url><loc>' . htmlspecialchars(SITE_URL . $caminho, ENT_XML1, 'UTF-8') . '</loc>';
    if ($data) {
        echo '<lastmod>' . $data . '</lastmod>';
    }
    echo "</url>\n";
}
echo "</urlset>\n";
