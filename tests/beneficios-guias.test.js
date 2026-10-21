// Testes dos guias por benefício (dados/beneficios/*.json). Rodar: node tests/beneficios-guias.test.js
// Confere campos, tamanhos para SEO e se todo link interno aponta para algo que existe.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lerDir = (d) => Object.fromEntries(fs.readdirSync(path.join(raiz, d)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(raiz, d, f), 'utf8'))]));
const guias = lerDir('dados/beneficios');
const termos = lerDir('dados/glossario');
const perguntas = lerDir('dados/perguntas');
const leis = lerDir('dados/legislacao');
const fontes = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'fontes.json'), 'utf8'));
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const posts = new Set([...fs.readFileSync(path.join(raiz, 'index.php'), 'utf8').matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));
const GRUPOS = ['aposentadorias', 'incapacidade', 'familia', 'assistencial'];

assert.ok(Object.keys(guias).length >= 12, 'pelo menos 12 guias');
const ordens = new Set();
function textos(g) {
  const t = [g.introducao, ...g.como_pedir, ...g.documentos, ...g.conferir_no_cnis, ...g.erros_comuns, ...g.exemplo];
  for (const r of g.resumo_rapido) t.push(r.valor);
  for (const s of g.secoes) for (const p of s.texto) t.push(...(Array.isArray(p) ? p : [p]));
  for (const q of g.perguntas_frequentes) t.push(q.pergunta, q.resposta);
  return t;
}
for (const [slug, g] of Object.entries(guias)) {
  const ctx = slug + ': ';
  assert.match(slug, /^[a-z0-9-]+$/, ctx + 'slug');
  assert.ok(GRUPOS.includes(g.grupo), ctx + 'grupo');
  assert.ok(Number.isInteger(g.ordem) && !ordens.has(g.ordem), ctx + 'ordem'); ordens.add(g.ordem);
  assert.ok(g.titulo.length >= 30 && g.titulo.length <= 75, ctx + 'título com ' + g.titulo.length);
  assert.ok(g.resumo.length >= 90 && g.resumo.length <= 160, ctx + 'resumo com ' + g.resumo.length);
  assert.ok(g.resumo_rapido.length >= 5 && g.secoes.length >= 3, ctx + 'resumo rápido e seções');
  assert.ok(g.como_pedir.length >= 3 && g.documentos.length >= 3 && g.conferir_no_cnis.length >= 2 && g.erros_comuns.length >= 3, ctx + 'listas');
  assert.ok(g.exemplo.length >= 1 && g.perguntas_frequentes.length >= 2 && g.fontes.length >= 2, ctx + 'exemplo, perguntas e fontes');
  assert.ok(g.fontes.some((f) => /gov\.br\/(inss|pt-br)/.test(fontes[f.fonte]?.[1] || '')), ctx + 'pelo menos uma página do INSS ou gov.br');
  for (const f of g.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  for (const t of g.termos) assert.ok(termos[t], ctx + 'termo ' + t);
  for (const p of g.perguntas) assert.ok(perguntas[p], ctx + 'pergunta ' + p);
  for (const l of g.legislacao) assert.ok(leis[l], ctx + 'legislação ' + l);
  for (const a of g.artigos) assert.ok(posts.has(a), ctx + 'artigo ' + a);
  for (const i of g.indicadores) assert.ok(indicadores.has(i), ctx + 'indicador ' + i);
  for (const r of g.relacionados) assert.ok(guias[r] && r !== slug, ctx + 'relacionado ' + r);
  const palavras = textos(g).join(' ').split(/\s+/).length;
  assert.ok(palavras >= 600, ctx + 'texto curto: ' + palavras + ' palavras');
  for (const s of textos(g)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto');
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      const ok = { termo: termos, q: perguntas, leg: leis, ben: guias }[tipo]?.[alvo] || (tipo === 'post' && posts.has(alvo))
        || (tipo === 'ind' && indicadores.has(alvo)) || (tipo === 'fonte' && fontes[alvo]);
      assert.ok(ok, ctx + 'link quebrado ' + m[1]);
    }
  }
}
const recebidos = new Set(Object.values(guias).flatMap((g) => g.relacionados));
for (const slug of Object.keys(guias)) assert.ok(recebidos.has(slug), 'guia sem links de entrada: ' + slug);
console.log('guias de benefícios ok (' + Object.keys(guias).length + ' guias)');
