// Testes da legislação comentada (dados/legislacao/*.json). Rodar: node tests/legislacao.test.js
// Confere campos, tamanhos para SEO e se todo link interno aponta para algo que existe.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lerDir = (d) => Object.fromEntries(fs.readdirSync(path.join(raiz, d)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(raiz, d, f), 'utf8'))]));
const leis = lerDir('dados/legislacao');
const termos = lerDir('dados/glossario');
const perguntas = lerDir('dados/perguntas');
const fontes = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'fontes.json'), 'utf8'));
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const posts = new Set([...fs.readFileSync(path.join(raiz, 'index.php'), 'utf8').matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));
const GRUPOS = ['lei8213', 'ec103', 'lei8212', 'outras'];

assert.ok(Object.keys(leis).length >= 14, 'pelo menos 14 páginas');
for (const [k, [rot, url]] of Object.entries(fontes)) {
  assert.ok(rot && /^https:\/\/[a-z0-9.-]+\.(gov\.br|leg\.br|jus\.br)\//.test(url), 'fonte oficial: ' + k);
}
function textos(l) {
  const t = [l.introducao, ...l.na_pratica, ...l.exemplo];
  for (const d of l.dispositivos) t.push(d.o_que_diz, ...d.comentario);
  return t;
}
for (const [slug, l] of Object.entries(leis)) {
  const ctx = slug + ': ';
  assert.match(slug, /^[a-z0-9-]+$/, ctx + 'slug');
  assert.ok(GRUPOS.includes(l.grupo), ctx + 'grupo');
  assert.ok(l.titulo.length >= 30 && l.titulo.length <= 75, ctx + 'título com ' + l.titulo.length);
  assert.ok(l.resumo.length >= 90 && l.resumo.length <= 160, ctx + 'resumo com ' + l.resumo.length);
  assert.ok(l.norma && l.introducao && Number.isInteger(l.ordem), ctx + 'norma, introdução e ordem');
  assert.ok(l.dispositivos.length >= 3, ctx + 'dispositivos');
  for (const d of l.dispositivos) assert.ok(d.referencia && d.o_que_diz && d.comentario.length >= 1, ctx + 'dispositivo incompleto');
  assert.ok(l.na_pratica.length >= 2 && l.exemplo.length >= 1 && l.fontes.length >= 1, ctx + 'estrutura');
  for (const f of l.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  for (const t of l.termos) assert.ok(termos[t], ctx + 'termo ' + t);
  for (const p of l.perguntas) assert.ok(perguntas[p], ctx + 'pergunta ' + p);
  for (const a of l.artigos) assert.ok(posts.has(a), ctx + 'artigo ' + a);
  for (const i of l.indicadores) assert.ok(indicadores.has(i), ctx + 'indicador ' + i);
  for (const r of l.relacionadas) assert.ok(leis[r] && r !== slug, ctx + 'relacionada ' + r);
  for (const s of textos(l)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto');
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      const ok = { termo: termos, q: perguntas, leg: leis }[tipo]?.[alvo] || (tipo === 'post' && posts.has(alvo))
        || (tipo === 'ind' && indicadores.has(alvo)) || (tipo === 'fonte' && fontes[alvo]);
      assert.ok(ok, ctx + 'link quebrado ' + m[1]);
    }
  }
}
const recebidas = new Set(Object.values(leis).flatMap((l) => l.relacionadas));
for (const slug of Object.keys(leis)) assert.ok(recebidas.has(slug), 'página sem links de entrada: ' + slug);
console.log('legislação ok (' + Object.keys(leis).length + ' páginas)');
