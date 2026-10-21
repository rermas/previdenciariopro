// Testes de documentos e requerimentos (dados/documentos/*.json). Rodar: node tests/documentos.test.js
// Confere campos, tamanhos para SEO, fontes oficiais e se todo link interno aponta para algo que existe.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lerDir = (d) => Object.fromEntries(fs.readdirSync(path.join(raiz, d)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(raiz, d, f), 'utf8'))]));
const docs = lerDir('dados/documentos');
const termos = lerDir('dados/glossario');
const perguntas = lerDir('dados/perguntas');
const leis = lerDir('dados/legislacao');
const guias = lerDir('dados/beneficios');
const regras = lerDir('dados/transicao');
const fontes = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'fontes.json'), 'utf8'));
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const posts = new Set([...fs.readFileSync(path.join(raiz, 'index.php'), 'utf8').matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));

assert.ok(Object.keys(docs).length >= 12, 'pelo menos 12 páginas');
for (const [k, [rot, url]] of Object.entries(fontes)) {
  assert.ok(rot && /^https:\/\/[a-z0-9.-]+\.(gov\.br|leg\.br|jus\.br)\//.test(url), 'fonte oficial: ' + k);
}
function textos(d) {
  const t = [d.introducao, ...d.passos, ...d.dicas];
  for (const c of d.checklist) t.push(...c.itens);
  for (const s of d.secoes) for (const p of s.texto) t.push(...(Array.isArray(p) ? p : [p]));
  for (const q of d.perguntas_frequentes) t.push(q.pergunta, q.resposta);
  return t;
}
const ordens = new Set();
for (const [slug, d] of Object.entries(docs)) {
  const ctx = slug + ': ';
  assert.ok(['documentos', 'requerimentos'].includes(d.grupo), ctx + 'grupo');
  assert.ok(Number.isInteger(d.ordem) && !ordens.has(d.ordem), ctx + 'ordem'); ordens.add(d.ordem);
  assert.ok(d.titulo.length >= 30 && d.titulo.length <= 75, ctx + 'título com ' + d.titulo.length);
  assert.ok(d.resumo.length >= 90 && d.resumo.length <= 160, ctx + 'resumo com ' + d.resumo.length);
  if (d.grupo === 'documentos') assert.ok(d.checklist.length >= 3, ctx + 'lista de documentos');
  else assert.ok(d.passos.length >= 4, ctx + 'passo a passo');
  assert.ok(d.secoes.length >= 2 && d.perguntas_frequentes.length >= 2 && d.dicas.length >= 2, ctx + 'estrutura');
  assert.ok(d.fontes.some((f) => /gov\.br\/(inss|pt-br|previdencia)|portalin|meu\.inss/.test(fontes[f.fonte]?.[1] || '')), ctx + 'fonte do INSS ou gov.br');
  assert.ok(textos(d).join(' ').split(/\s+/).length >= 400, ctx + 'texto curto');
  for (const f of d.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  for (const t of d.termos) assert.ok(termos[t], ctx + 'termo ' + t);
  for (const p of d.perguntas) assert.ok(perguntas[p], ctx + 'pergunta ' + p);
  for (const b of d.beneficios) assert.ok(guias[b], ctx + 'guia ' + b);
  for (const l of d.legislacao) assert.ok(leis[l], ctx + 'legislação ' + l);
  for (const a of d.artigos) assert.ok(posts.has(a), ctx + 'artigo ' + a);
  for (const r of d.relacionados) assert.ok(docs[r] && r !== slug, ctx + 'relacionado ' + r);
  for (const s of textos(d)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto');
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      const ok = { termo: termos, q: perguntas, leg: leis, ben: guias, tr: regras, doc: docs }[tipo]?.[alvo] || (tipo === 'post' && posts.has(alvo))
        || (tipo === 'ind' && indicadores.has(alvo)) || (tipo === 'fonte' && fontes[alvo]);
      assert.ok(ok, ctx + 'link quebrado ' + m[1]);
    }
  }
}
const recebidos = new Set(Object.values(docs).flatMap((d) => d.relacionados));
for (const slug of Object.keys(docs)) assert.ok(recebidos.has(slug), 'página sem links de entrada: ' + slug);
console.log('documentos e requerimentos ok (' + Object.keys(docs).length + ' páginas)');
