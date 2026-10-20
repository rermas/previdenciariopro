// Testes do glossário (dados/glossario/*.json). Rodar: node tests/glossario.test.js
// Confere campos obrigatórios, tamanho do resumo e se todo link interno aponta para algo que existe.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dados', 'glossario');
const fontes = JSON.parse(fs.readFileSync(path.join(dir, '_fontes.json'), 'utf8'));
const termos = {};
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  termos[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
}
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const php = fs.readFileSync(path.join(__dirname, '..', 'index.php'), 'utf8');
const posts = new Set([...php.matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));
const CATEGORIAS = ['segurados', 'protecao', 'contribuicao', 'tempo', 'calculo', 'beneficios', 'processo', 'cnis'];

assert.ok(Object.keys(termos).length >= 40, 'pelo menos 40 termos');
for (const [k, [rot, url]] of Object.entries(fontes)) {
  assert.ok(rot && /^https:\/\/[a-z0-9.-]+\.(gov\.br|leg\.br|jus\.br)\//.test(url), 'fonte oficial: ' + k);
}

function textos(t) {
  const l = [t.definicao, ...t.exemplo];
  for (const s of t.secoes) for (const p of s.texto) l.push(...(Array.isArray(p) ? p : [p]));
  for (const q of t.perguntas) l.push(q.pergunta, q.resposta);
  return l;
}

for (const [slug, t] of Object.entries(termos)) {
  const ctx = slug + ': ';
  assert.match(slug, /^[a-z0-9-]+$/, ctx + 'slug');
  for (const c of ['termo', 'titulo', 'resumo', 'definicao']) assert.ok(t[c] && t[c].length >= 3, ctx + c);
  assert.ok(CATEGORIAS.includes(t.categoria), ctx + 'categoria');
  assert.ok(t.resumo.length >= 70 && t.resumo.length <= 160, ctx + 'resumo com ' + t.resumo.length + ' caracteres');
  assert.ok(t.titulo.length <= 75, ctx + 'título longo');
  assert.ok(t.secoes.length >= 2, ctx + 'seções');
  assert.ok(t.exemplo.length >= 1, ctx + 'exemplo');
  assert.ok(t.perguntas.length >= 1, ctx + 'perguntas');
  assert.ok(t.fontes.length >= 1, ctx + 'fontes');
  for (const f of t.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  for (const r of t.relacionados) assert.ok(termos[r] && r !== slug, ctx + 'relacionado ' + r);
  for (const a of t.artigos) assert.ok(posts.has(a), ctx + 'artigo ' + a);
  for (const i of t.indicadores) assert.ok(indicadores.has(i), ctx + 'indicador ' + i);
  for (const s of textos(t)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto: ' + s.slice(0, 50));
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      if (tipo === 'termo') assert.ok(termos[alvo] && alvo !== slug, ctx + 'link ' + alvo);
      else if (tipo === 'post') assert.ok(posts.has(alvo), ctx + 'post ' + alvo);
      else if (tipo === 'ind') assert.ok(indicadores.has(alvo), ctx + 'indicador ' + alvo);
      else if (tipo === 'fonte') assert.ok(fontes[alvo], ctx + 'fonte ' + alvo);
      else assert.fail(ctx + 'tipo de link ' + tipo);
    }
  }
}
// Todo termo recebe pelo menos um link de outro termo, para não ficar órfão.
const recebidos = new Set();
for (const [slug, t] of Object.entries(termos)) {
  t.relacionados.forEach((r) => recebidos.add(r));
  for (const s of textos(t)) for (const m of s.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) recebidos.add(m[1]);
}
for (const slug of Object.keys(termos)) assert.ok(recebidos.has(slug), 'termo sem links de entrada: ' + slug);
console.log('glossário ok (' + Object.keys(termos).length + ' termos)');
