// Testes das perguntas frequentes (dados/perguntas/*.json). Rodar: node tests/perguntas.test.js
// Confere campos, tamanhos para SEO e se todo link interno aponta para algo que existe.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lerDir = (d) => Object.fromEntries(fs.readdirSync(path.join(raiz, d)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(raiz, d, f), 'utf8'))]));
const perguntas = lerDir('dados/perguntas');
const termos = lerDir('dados/glossario');
const fontes = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'fontes.json'), 'utf8'));
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const posts = new Set([...fs.readFileSync(path.join(raiz, 'index.php'), 'utf8').matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));
const CATEGORIAS = ['cnis', 'contribuicoes', 'protecao', 'aposentadoria', 'beneficios', 'processo'];

assert.ok(Object.keys(perguntas).length >= 30, 'pelo menos 30 perguntas');
function textos(q) {
  const l = [q.resposta, ...q.exemplo];
  for (const s of q.secoes) for (const p of s.texto) l.push(...(Array.isArray(p) ? p : [p]));
  return l;
}
for (const [slug, q] of Object.entries(perguntas)) {
  const ctx = slug + ': ';
  assert.match(slug, /^[a-z0-9-]+$/, ctx + 'slug');
  assert.ok(!termos[slug], ctx + 'slug igual a um termo do glossário');
  assert.ok(q.pergunta.endsWith('?'), ctx + 'pergunta sem interrogação');
  assert.ok(CATEGORIAS.includes(q.categoria), ctx + 'categoria');
  assert.ok(q.titulo.length >= 30 && q.titulo.length <= 75, ctx + 'título com ' + q.titulo.length);
  assert.ok(q.resumo.length >= 90 && q.resumo.length <= 160, ctx + 'resumo com ' + q.resumo.length);
  const palavras = q.resposta.replace(/\[\[[^|\]]+\|?([^\]]*)\]\]/g, '$1').split(/\s+/).length;
  assert.ok(palavras >= 25 && palavras <= 75, ctx + 'resposta curta com ' + palavras + ' palavras');
  assert.ok(q.secoes.length >= 2 && q.exemplo.length >= 1 && q.fontes.length >= 1, ctx + 'estrutura');
  for (const f of q.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  for (const t of q.termos) assert.ok(termos[t], ctx + 'termo ' + t);
  for (const a of q.artigos) assert.ok(posts.has(a), ctx + 'artigo ' + a);
  for (const i of q.indicadores) assert.ok(indicadores.has(i), ctx + 'indicador ' + i);
  assert.ok(q.relacionadas.length >= 2, ctx + 'relacionadas');
  for (const r of q.relacionadas) assert.ok(perguntas[r] && r !== slug, ctx + 'relacionada ' + r);
  for (const s of textos(q)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto');
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      const ok = { termo: termos, q: perguntas }[tipo]?.[alvo] || (tipo === 'post' && posts.has(alvo))
        || (tipo === 'ind' && indicadores.has(alvo)) || (tipo === 'fonte' && fontes[alvo]);
      assert.ok(ok, ctx + 'link quebrado ' + m[1]);
    }
  }
}
// Toda pergunta recebe link de pelo menos outra, para não ficar órfã.
const recebidas = new Set(Object.values(perguntas).flatMap((q) => q.relacionadas));
for (const slug of Object.keys(perguntas)) assert.ok(recebidas.has(slug), 'pergunta sem links de entrada: ' + slug);
console.log('perguntas ok (' + Object.keys(perguntas).length + ' perguntas)');
