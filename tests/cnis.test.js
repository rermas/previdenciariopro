// Testes da lógica de análise. Rodar com: node tests/cnis.test.js
// Os dados abaixo são fictícios e servem só para validar as contas.
const assert = require('node:assert/strict');
const CNIS = require('../assets/js/cnis.js');

const EXTRATO = [
  'Vínculos',
  '1 EMPRESA A 12345678901234 Empregado 01/03/2010 31/12/2010',
  '03/2010 1.000,00',
  '04/2010 1.000,00',
  // 05/2010 propositalmente ausente
  '06/2010 1.000,00',
  '07/2010 1.000,00',
  '08/2010 1.000,00',
  '09/2010 1.000,00',
  '10/2010 1.000,00',
  '11/2010 1.000,00',
  '12/2010 1.000,00',
  '2 EMPRESA B 98765432109876 Empregado 01/06/2011',
  '06/2011 2.000,00',
  '07/2011 0,00',
  'Indicador: sem informação',
  '3 EMPRESA C 11122233344455 Empregado 01/10/2010 31/12/2010',
  '10/2010 500,00'
].join('\n');

const HOJE = { y: 2011, m: 8, d: 31 };

// 1) Conversões básicas
assert.equal(CNIS.valorDe('1.234,56'), 1234.56);
assert.equal(CNIS.valorDe('0,00'), 0);
assert.equal(CNIS.dataDe('31/02/2010'), null, 'data inexistente deve ser rejeitada');
assert.equal(CNIS.dataDe('01/03/2010').ord - CNIS.dataDe('28/02/2010').ord, 1);
assert.equal(CNIS.formatarDuracao(398), '1 ano, 1 mês, 3 dias');
assert.equal(CNIS.rotuloMes(2010 * 12 + 4), '05/2010');

// 2) Análise do extrato de exemplo
const r = CNIS.analisar(EXTRATO, HOJE);

assert.equal(r.vinculos.length, 3, 'três vínculos reconhecidos');
assert.equal(r.resumo.validos, 3);

const v1 = r.vinculos[0];
assert.equal(v1.dias, 306, 'Mar/2010 a Dez/2010 inclusive');
assert.equal(v1.mesesSemRemuneracao, 1, 'só 05/2010 falta no vínculo 1');
assert.deepEqual(v1.faixasSemRemuneracao, [{ de: '05/2010', ate: '05/2010', qtd: 1 }]);

const v2 = r.vinculos[1];
assert.equal(v2.emAberto, true, 'vínculo sem data final fica em aberto');
assert.equal(v2.dias, 92, 'Jun/2011 até a data de hoje (31/08/2011)');
assert.equal(v2.mesesSemRemuneracao, 1, 'falta 08/2011');

// Concomitância: vínculo 3 está inteiro dentro do vínculo 1.
// Tempo contado não pode duplicar: 306 + 92 = 398 dias.
assert.equal(r.resumo.diasUnicos, 398);
assert.equal(r.resumo.diasBrutos, 490, 'soma bruta conta o período duplicado');
assert.equal(r.resumo.duracao, '1 ano, 1 mês, 3 dias');

// Pendências
const msgs = r.pendencias.map(p => p.msg).join(' | ');
assert.match(msgs, /sem informação/, 'palavra-chave do extrato é apontada');
assert.match(msgs, /Remuneração zerada em 07\/2011/, 'remuneração zero é apontada');
assert.match(msgs, /concomitante com a linha 16 \(92 dias em comum\)/, 'concomitância é apontada');
assert.match(msgs, /sem data de fim/, 'vínculo em aberto é informado');
assert.equal(r.resumo.erros, 0);
assert.equal(r.resumo.atencoes, 2);
assert.equal(r.resumo.mesesSemRemuneracao, 4, '1 (vínculo 1) + 1 (vínculo 2) + 2 (vínculo 3: 11 e 12/2010)');

// 3) Erros de dado devem aparecer como erro, não sumir
const ruim = CNIS.analisar('9 EMPRESA X 11111111111 Empregado 31/02/2010 01/01/2011', HOJE);
assert.equal(ruim.resumo.erros, 1, 'data inválida vira erro');
assert.equal(ruim.resumo.validos, 0);

// 4) Texto vazio não quebra
const vazio = CNIS.analisar('', HOJE);
assert.equal(vazio.resumo.totalVinculos, 0);
assert.equal(vazio.resumo.diasUnicos, 0);

console.log('Todos os testes passaram.');
