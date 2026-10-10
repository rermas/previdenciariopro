// Testes da verificação de pensão por morte. Rodar: node tests/pensao.test.js
// Dados fictícios. Tabelas: Portaria ME 424/2020 (óbito desde 01/01/2021) e Lei 13.135/2015 (18/06/2015 a 31/12/2020).
const assert = require('node:assert/strict');
const C = require('../assets/cnis.js');
require('../assets/direito.js');
const P = require('../assets/pensao.js');
const NIT = '1.234.567.890-1';
const HOJE = { y: 2026, m: 10, d: 8 };
const dia = (o) => o.d + '/' + o.m + '/' + o.y;
const pad = (n) => String(n).padStart(2, '0');

// Vínculo de empregado com remunerações mensais de [ano, mês] a [ano, mês]; fim opcional (dd/mm/aaaa)
function vinculo(ini, ate, fim) {
  const meses = [];
  let y = ini[0], m = ini[1];
  while (y < ate[0] || (y === ate[0] && m <= ate[1])) { meses.push(`${pad(m)}/${y} 1.500,00`); if (++m > 12) { m = 1; y++; } }
  const linhas = [];
  for (let i = 0; i < meses.length; i += 3) linhas.push(meses.slice(i, i + 3).join(' '));
  return [`1 ${NIT} 11.111.111/0001-11 EMPRESA Empregado 01/${pad(ini[1])}/${ini[0]}${fim ? ' ' + fim : ''}`, 'Remunerações', ...linhas].join('\n');
}
const rodar = (txt, ent) => P.pensaoPorMorte(C.analisar(txt, HOJE), ent, HOJE);

// Poucas contribuições (3): cônjuge recebe 4 meses, mas o direito existe (carência zero)
let r = rodar(vinculo([2022, 1], [2022, 3], '10/03/2022'), { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1990-05-05', uniao: '2015-01-01' });
assert.equal(r.contribuicoes.total, 3);
assert.equal(r.contribuicoes.tem18, false);
assert.equal(r.duracao.meses, 4);
assert.equal(dia(r.duracao.fim), '10/7/2022');
assert.equal(r.conclusao.status, 'provavel', 'a regra das 18 contribuições não impede a pensão');

// 18 ou mais contribuições e mais de 2 anos de união: pela idade no óbito (tabela 2021). Óbito em 10/03/2022
const longo = vinculo([2020, 1], [2022, 3], '10/03/2022');
const caso = (nasc, extra) => rodar(longo, Object.assign({ obito: '2022-03-10', dependente: 'conjuge', nascimento: nasc, uniao: '2018-01-01' }, extra));
r = caso('1990-05-05'); // 31 anos
assert.equal(r.duracao.anos, 15);
assert.equal(dia(r.duracao.fim), '10/3/2037');
assert.equal(r.tabela.destaque, '31 a 41 anos');
assert.equal(caso('2000-03-11').duracao.anos, 3, '21 anos (faz 22 um dia depois do óbito)');
assert.equal(caso('2000-03-10').duracao.anos, 6, '22 anos completos');
assert.equal(caso('1994-03-11').duracao.anos, 6, '27 anos');
assert.equal(caso('1994-03-10').duracao.anos, 10, '28 anos');
assert.equal(caso('1991-03-11').duracao.anos, 10, '30 anos');
assert.equal(caso('1991-03-10').duracao.anos, 15, '31 anos');
assert.equal(caso('1980-03-11').duracao.anos, 15, '41 anos');
assert.equal(caso('1980-03-10').duracao.anos, 20, '42 anos');
assert.equal(caso('1977-03-11').duracao.anos, 20, '44 anos');
r = caso('1977-03-10'); // 45 anos
assert.equal(r.duracao.vitalicia, true);
assert.equal(r.duracao.rotulo, 'Vitalícia');

// Menos de 2 anos de união: 4 meses, mesmo com 18 contribuições e 45 anos
r = caso('1977-03-10', { uniao: '2020-06-01' });
assert.equal(r.duracao.meses, 4);
assert.equal(r.duracao.vitalicia, false);
// Acidente dispensa as 18 contribuições e os 2 anos
r = rodar(vinculo([2022, 1], [2022, 3], '10/03/2022'), { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1990-05-05', uniao: '2022-01-01', acidente: true });
assert.equal(r.duracao.anos, 15);
// Sem a data da união não dá para decidir entre 4 meses e a tabela
r = caso('1990-05-05', { uniao: '' });
assert.equal(r.duracao.indeterminada, true);

// Tabela anterior (óbito de 18/06/2015 a 31/12/2020): 44 anos vitalícia, 43 anos 20 anos
const antigo = vinculo([2017, 1], [2019, 1], '10/01/2019');
const caso15 = (nasc) => rodar(antigo, { obito: '2019-01-10', dependente: 'companheiro', nascimento: nasc, uniao: '2010-01-01' });
assert.equal(caso15('1975-01-10').duracao.vitalicia, true, '44 anos');
assert.equal(caso15('1975-01-11').duracao.anos, 20, '43 anos');
assert.equal(caso15('1998-01-10').duracao.anos, 6, '21 anos na tabela anterior');
assert.equal(caso15('1975-01-11').tabela.nome, '2015');

// Filho: até 21 anos; maior de 21 sem invalidez não é dependente; inválido sem limite; a regra de 18 não se aplica
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '2010-01-01' });
assert.equal(dia(r.duracao.fim), '1/1/2031');
assert.equal(r.duracao.rotulo, 'Até os 21 anos');
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '1999-01-01' });
assert.equal(r.dependente.apto, false);
assert.equal(r.conclusao.status, 'nao_demonstrado');
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '1999-01-01', invalido: true });
assert.equal(r.dependente.apto, true);
assert.equal(r.duracao.vitalicia, true);
// Pais: vitalícia, mas exige dependência econômica comprovada
r = rodar(longo, { obito: '2022-03-10', dependente: 'pai_mae' });
assert.equal(r.duracao.vitalicia, true);
assert.equal(r.conclusao.status, 'depende');
r = rodar(longo, { obito: '2022-03-10', dependente: 'pai_mae', economica: true });
assert.equal(r.conclusao.status, 'provavel');
// Irmão: até 21 anos
r = rodar(longo, { obito: '2022-03-10', dependente: 'irmao', nascimento: '2008-06-01', economica: true });
assert.equal(dia(r.duracao.fim), '1/6/2029');

// Filho maior inválido: sem limite de idade, mas a invalidez/deficiência precisa de perícia médica
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho_maior_invalido', nascimento: '1990-01-01' });
assert.equal(r.dependente.tipo, 'filho');
assert.equal(r.dependente.apto, true);
assert.equal(r.duracao.vitalicia, true);
assert.equal(r.duracao.rotulo, 'Sem limite de idade');
assert.equal(r.conclusao.status, 'depende');
assert.match(r.conclusao.rotulo, /perícia médica/);
assert.match(r.dependente.linhas.join(' '), /perícia médica/);
assert.ok(r.documentos.some((x) => /perícia médica/.test(x)));
assert.ok(r.conclusao.pendencias.some((x) => /perícia médica/.test(x)));
// Sem data de nascimento também funciona
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho_maior_invalido' });
assert.equal(r.duracao.vitalicia, true);
assert.equal(r.conclusao.pendencias.some((x) => /Informe/.test(x)), false);
// Marcar "inválido" em qualquer dependente também exige a perícia
r = rodar(longo, { obito: '2022-03-10', dependente: 'irmao', nascimento: '1990-01-01', invalido: true, economica: true });
assert.equal(r.conclusao.status, 'depende');
assert.match(r.dependente.linhas.join(' '), /perícia médica/);

// Sem qualidade de segurado na data do óbito: direito não demonstrado
r = rodar(vinculo([2010, 1], [2012, 12], '31/12/2012'), { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' });
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.match(r.conclusao.rotulo, /qualidade/);

// Início: pedido em até 90 dias conta do óbito; depois, do requerimento (180 dias para menor de 16)
const par = { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' };
assert.equal(dia(rodar(longo, Object.assign({ requerimento: '2022-06-08' }, par)).inicio.dib), '10/3/2022');
assert.equal(dia(rodar(longo, Object.assign({ requerimento: '2022-06-09' }, par)).inicio.dib), '9/6/2022');
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '2010-01-01', requerimento: '2022-08-01' });
assert.equal(dia(r.inicio.dib), '10/3/2022', 'menor de 16: 180 dias');

// Óbito antes da Lei 13.135/2015 fica fora desta verificação de duração
r = rodar(vinculo([2013, 1], [2014, 3], '10/03/2014'), { obito: '2014-03-10', dependente: 'conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' });
assert.equal(r.duracao.indeterminada, true);
// Sem data do óbito
r = rodar(longo, { dependente: 'conjuge' });
assert.equal(r.conclusao.status, 'incompleta');

// --- Alinhamento com a IN PRES/INSS 128/2022 ---
// Instituidor aposentado (não por incapacidade): dispensa as 18 contribuições (art. 375, § 3º)
const aposentadoTxt = vinculo([2022, 1], [2022, 3], '10/03/2022') + '\n2 ' + NIT + ' 1234567890 Benefício 42 - APOSENTADORIA POR TEMPO DE CONTRIBUICAO 01/01/2015';
r = rodar(aposentadoTxt, { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' });
assert.equal(r.contribuicoes.aposentado, true);
assert.equal(r.contribuicoes.tem18, true);
assert.equal(r.duracao.vitalicia, true);
// Aposentadoria por incapacidade NÃO dispensa
r = rodar(vinculo([2022, 1], [2022, 3], '10/03/2022') + '\n2 ' + NIT + ' 1234567890 Benefício 32 - APOSENTADORIA POR INVALIDEZ 01/01/2015', { obito: '2022-03-10', dependente: 'conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' });
assert.equal(r.contribuicoes.aposentado, false);
assert.equal(r.duracao.meses, 4);

// Requerimento depois do fim da cota do cônjuge: indeferido (art. 375, § 7º)
r = rodar(longo, { obito: '2022-03-10', dependente: 'conjuge', nascimento: '2000-03-11', uniao: '2018-01-01', requerimento: '2026-05-01' });
assert.equal(r.duracao.anos, 3);
assert.equal(r.conclusao.status, 'nao_demonstrado');
assert.match(r.conclusao.rotulo, /fora do prazo/);
// Filho não sofre esse indeferimento
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '2010-01-01', requerimento: '2024-05-01' });
assert.notEqual(r.conclusao.status, 'nao_demonstrado');

// Filho inválido com 10 anos de idade no óbito vale como maior de 16: 90 dias
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '2015-01-01', invalido: true, requerimento: '2022-08-01' });
assert.equal(dia(r.inicio.dib), '1/8/2022');
// Filho nascido após o óbito: DIB no nascimento (art. 369-A)
r = rodar(longo, { obito: '2022-03-10', dependente: 'filho', nascimento: '2022-06-01' });
assert.equal(dia(r.inicio.dib), '1/6/2022');

// Ex-cônjuge: exige prova de alimentos/ajuda financeira
r = rodar(longo, { obito: '2022-03-10', dependente: 'ex_conjuge', nascimento: '1977-03-10', uniao: '2000-01-01' });
assert.equal(r.conclusao.status, 'depende');
r = rodar(longo, { obito: '2022-03-10', dependente: 'ex_conjuge', nascimento: '1977-03-10', uniao: '2000-01-01', economica: true });
assert.equal(r.conclusao.status, 'provavel');

// Tabela de 2015 vale desde 01/03/2015 (art. 375)
r = rodar(vinculo([2013, 6], [2015, 3], '10/03/2015'), { obito: '2015-03-10', dependente: 'conjuge', nascimento: '1990-01-01', uniao: '2005-01-01' });
assert.ok(r.duracao.anos || r.duracao.vitalicia, 'óbito em 03/2015 usa a tabela da Lei 13.135/2015');
assert.equal(r.tabela.nome, '2015');

console.log('pensao.test.js: ok');
