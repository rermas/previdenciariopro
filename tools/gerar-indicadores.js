// Copia a tabela de indicadores (dados/indicadores.json, do Anexo V da Portaria DIRBEN/INSS 990/2022) para assets/cnis.js,
// entre os marcadores "<indicadores>" e "</indicadores>". A ferramenta continua num arquivo só e funciona offline.
// Uso: node tools/gerar-indicadores.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const dados = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'indicadores.json'), 'utf8'));
const SEV = { vinculo: 'atencao', competencia: 'atencao', mandato: 'atencao', 'datas-inicio': 'atencao', 'datas-fim': 'atencao', datas: 'atencao', 'idade-minima': 'atencao', minimo: 'atencao', atencao: 'atencao', tc: 'info', info: 'info' };
const curta = (t) => { t = t.split(' / ')[0].replace(/\s*\(Não é possível.*$/, '').trim(); return t.charAt(0).toLowerCase() + t.slice(1); };
const linhas = dados.indicadores.map((r) => '    ' + JSON.stringify(r.cod) + ': [' + [SEV[r.impacto], curta(r.descricao), r.impacto].map((x) => JSON.stringify(x)).join(', ') + ']');
const cancela = {};
dados.indicadores.forEach((r) => { if (r.cancelado_por) cancela[r.cod] = r.cancelado_por; });
const bloco = [
  '  // <indicadores> Gerado por tools/gerar-indicadores.js a partir de dados/indicadores.json. Não edite à mão.',
  '  // Fonte: ' + dados.fonte + '. Conferido em ' + dados.conferido.split('-').reverse().join('/') + '.',
  '  // [gravidade, descrição oficial, efeito]. Efeito: vinculo/competencia = não computado até tratar; mandato = até 18/09/2004 não conta como empregado;',
  '  // datas-* = trecho alterado por processo trabalhista precisa de prova; idade-minima; tc = só fora da aposentadoria por tempo sem complementação;',
  '  // minimo = tratado pelo valor; atencao = sem exclusão automática; info = informativo.',
  '  var INDICADORES = {',
  linhas.join(',\n'),
  '  };',
  '  var CANCELA_IND = ' + JSON.stringify(cancela) + ';',
  '  // </indicadores>'
].join('\n');
const arq = path.join(raiz, 'assets', 'cnis.js');
let js = fs.readFileSync(arq, 'utf8');
const ini = js.indexOf('  // <indicadores>'), fim = js.indexOf('  // </indicadores>');
if (ini < 0 || fim < 0) throw new Error('Marcadores <indicadores> não encontrados em assets/cnis.js');
js = js.slice(0, ini) + bloco + js.slice(fim + '  // </indicadores>'.length);
fs.writeFileSync(arq, js);
console.log(dados.indicadores.length + ' indicadores gravados em assets/cnis.js');
