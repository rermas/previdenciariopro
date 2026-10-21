// Testes das regras de transição (dados/transicao/*.json). Rodar: node tests/transicao.test.js
// Confere os números das tabelas contra a EC 103/2019, campos, tamanhos para SEO e links internos.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lerDir = (d) => Object.fromEntries(fs.readdirSync(path.join(raiz, d)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(raiz, d, f), 'utf8'))]));
const regras = lerDir('dados/transicao');
const termos = lerDir('dados/glossario');
const perguntas = lerDir('dados/perguntas');
const leis = lerDir('dados/legislacao');
const guias = lerDir('dados/beneficios');
const fontes = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'fontes.json'), 'utf8'));
const indicadores = new Set(require('../dados/indicadores.json').indicadores.map((r) => r.cod));
const posts = new Set([...fs.readFileSync(path.join(raiz, 'index.php'), 'utf8').matchAll(/\['slug' => '([a-z0-9-]+)'/g)].map((m) => m[1]));

// Mesma fórmula do index.php (tabela_transicao): base + passo por ano desde o início, até o limite.
const valor = ([base, passo, limite], inicio, ano) => Math.min(base + passo * (ano - inicio), limite);
const tab = (slug, i = 0) => regras[slug].tabelas[i];
const v = (slug, sexo, ano, i = 0) => valor(tab(slug, i)[sexo], tab(slug, i).inicio, ano);

// Números da EC 103/2019 (texto do Planalto).
assert.equal(v('regra-de-pontos', 'mulher', 2019), 86); assert.equal(v('regra-de-pontos', 'homem', 2019), 96);
assert.equal(v('regra-de-pontos', 'mulher', 2026), 93); assert.equal(v('regra-de-pontos', 'homem', 2026), 103);
assert.equal(v('regra-de-pontos', 'homem', 2028), 105); assert.equal(v('regra-de-pontos', 'homem', 2027), 104);
assert.equal(v('regra-de-pontos', 'mulher', 2033), 100); assert.equal(v('regra-de-pontos', 'mulher', 2032), 99);
assert.equal(v('idade-minima-progressiva', 'mulher', 2026), 59.5); assert.equal(v('idade-minima-progressiva', 'homem', 2026), 64.5);
assert.equal(v('idade-minima-progressiva', 'homem', 2027), 65); assert.equal(v('idade-minima-progressiva', 'mulher', 2031), 62);
assert.equal(v('idade-minima-progressiva', 'mulher', 2030), 61.5);
assert.equal(v('aposentadoria-por-idade-na-transicao', 'mulher', 2023), 62); assert.equal(v('aposentadoria-por-idade-na-transicao', 'mulher', 2021), 61);
assert.equal(v('aposentadoria-por-idade-na-transicao', 'homem', 2026), 65);
assert.equal(v('professor-nas-regras-de-transicao', 'mulher', 2026, 0), 88); assert.equal(v('professor-nas-regras-de-transicao', 'homem', 2026, 0), 98);
assert.equal(v('professor-nas-regras-de-transicao', 'mulher', 2030, 0), 92); assert.equal(v('professor-nas-regras-de-transicao', 'homem', 2028, 0), 100);
assert.equal(v('professor-nas-regras-de-transicao', 'mulher', 2026, 1), 54.5); assert.equal(v('professor-nas-regras-de-transicao', 'homem', 2026, 1), 59.5);
assert.equal(v('professor-nas-regras-de-transicao', 'mulher', 2031, 1), 57); assert.equal(v('professor-nas-regras-de-transicao', 'homem', 2027, 1), 60);
// Cada tabela termina no ano em que os dois sexos chegam ao limite.
for (const [slug, r] of Object.entries(regras)) for (const t of r.tabelas) {
  if (t.tipo === 'pedagio') {
    for (const sexo of ['mulher', 'homem']) for (const tc of t[sexo]) assert.ok(tc < t.minimo[sexo], slug + ': tempo da tabela de pedágio abaixo do mínimo');
    continue;
  }
  assert.equal(valor(t.mulher, t.inicio, t.fim), t.mulher[2], slug + ': fim da tabela (mulher)');
  assert.equal(valor(t.homem, t.inicio, t.fim), t.homem[2], slug + ': fim da tabela (homem)');
}
// Pedágio de 50%: só para quem tinha mais de 28/33 anos.
for (const tc of tab('pedagio-de-50-por-cento').mulher) assert.ok(tc > 28);
for (const tc of tab('pedagio-de-50-por-cento').homem) assert.ok(tc > 33);

function textos(r) {
  const t = [r.introducao, ...r.exemplos];
  for (const x of r.requisitos) t.push(x.valor);
  for (const s of r.secoes) for (const p of s.texto) t.push(...(Array.isArray(p) ? p : [p]));
  for (const q of r.perguntas_frequentes) t.push(q.pergunta, q.resposta);
  return t;
}
const ordens = new Set();
for (const [slug, r] of Object.entries(regras)) {
  const ctx = slug + ': ';
  assert.ok(Number.isInteger(r.ordem) && !ordens.has(r.ordem), ctx + 'ordem'); ordens.add(r.ordem);
  assert.ok(r.titulo.length >= 30 && r.titulo.length <= 75, ctx + 'título com ' + r.titulo.length);
  assert.ok(r.resumo.length >= 90 && r.resumo.length <= 160, ctx + 'resumo com ' + r.resumo.length);
  assert.ok(r.nome && r.artigo && r.comparativo && r.comparativo.para_quem, ctx + 'nome, artigo e comparativo');
  assert.ok(r.requisitos.length >= 5 && r.secoes.length >= 3 && r.exemplos.length >= 2 && r.perguntas_frequentes.length >= 2, ctx + 'estrutura');
  assert.ok(textos(r).join(' ').split(/\s+/).length >= 450, ctx + 'texto curto');
  for (const f of r.fontes) assert.ok(fontes[f.fonte], ctx + 'fonte ' + f.fonte);
  assert.ok(r.fontes.some((f) => f.fonte === 'ec103'), ctx + 'cita a EC 103');
  for (const t of r.termos) assert.ok(termos[t], ctx + 'termo ' + t);
  for (const p of r.perguntas) assert.ok(perguntas[p], ctx + 'pergunta ' + p);
  for (const l of r.legislacao) assert.ok(leis[l], ctx + 'legislação ' + l);
  for (const b of r.beneficios) assert.ok(guias[b], ctx + 'guia ' + b);
  for (const x of r.relacionadas) assert.ok(regras[x] && x !== slug, ctx + 'relacionada ' + x);
  for (const s of textos(r)) {
    assert.equal((s.match(/\*\*/g) || []).length % 2, 0, ctx + 'negrito aberto: ' + s.slice(0, 50));
    assert.ok(!/[<>]/.test(s), ctx + 'HTML no texto');
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const [tipo, alvo] = m[1].includes(':') ? m[1].split(':') : ['termo', m[1]];
      const ok = { termo: termos, q: perguntas, leg: leis, ben: guias, tr: regras }[tipo]?.[alvo] || (tipo === 'post' && posts.has(alvo))
        || (tipo === 'ind' && indicadores.has(alvo)) || (tipo === 'fonte' && fontes[alvo]);
      assert.ok(ok, ctx + 'link quebrado ' + m[1]);
    }
  }
}
const recebidas = new Set(Object.values(regras).flatMap((r) => r.relacionadas));
for (const slug of Object.keys(regras)) assert.ok(recebidas.has(slug), 'regra sem links de entrada: ' + slug);
console.log('regras de transição ok (' + Object.keys(regras).length + ' páginas)');
