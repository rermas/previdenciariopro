# Monta dados/indicadores.json a partir do PDF do Anexo V da Portaria DIRBEN/INSS 990/2022 (relação dos indicadores do CNIS).
# Uso: python3 tools/indicadores_anexo_v.py caminho/AnexoV.pdf    (requer pdfplumber)
# A classificação do efeito de cada código (impacto) é editorial e fica neste script. Depois rode: node tools/gerar-indicadores.js
import json, re, sys, os
import pdfplumber
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
pdf = pdfplumber.open(sys.argv[1])
o = []
for i, p in enumerate(pdf.pages):
    for t in p.extract_tables():
        for r in t:
            c = [(x or '').replace('\n', ' ').strip() for x in r]
            if len(c) < 5 or c[0] == 'TIPO': continue
            if not c[2] and o:
                for k, v in zip(['tipo', 'grupo', 'sigla', 'desc', 'escl'], c):
                    if v: o[-1][k] = (o[-1][k] + ' ' + v).strip()
                continue
            o.append(dict(pg=i + 1, tipo=c[0], grupo=c[1], sigla=c[2], desc=c[3], escl=c[4]))
# Corrige desalinhamentos nas quebras de página (linhas de rodapé que levaram texto do registro seguinte).
def idx(s, start=0):
    for i in range(start, len(o)):
        if o[i]['sigla'].startswith(s): return i
    raise KeyError(s)
junk = [i for i, x in enumerate(o) if not x['tipo']]
for j in junk:
    nxt = o[j + 1]
    nxt['escl'] = o[j]['escl'] + ' ' + nxt['escl']
i166 = idx('IVIN-MAND- ELETIVO- PARCIAL'); i167 = i166 + 1
if o[i167]['escl'].startswith('indicador.'):
    o[i167]['escl'] = o[i167]['escl'][len('indicador.'):].strip(); o[i166]['escl'] += ' indicador.'
o = [x for x in o if x['tipo']]
RX_JUNK = re.compile(r'\s*(?:Ane|Anexo)?\s*(?:xo\s*)?2333\s*6228\s*S?\s*(?:EI)?\s*35014\s*\.?\s*538728/2022-59\s*/?\s*(?:pg\.?\s*\d+)?\s*(?:\.\s*\d+)?')
def limpa(t):
    t = RX_JUNK.sub(' ', t)
    t = re.sub(r'\s*\.?\s*538728/2022-59\s*/\s*pg\.?\s*\d+', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'([A-Z])- (?=[A-Z0-9])', r'\1-', t)  # "PREM- EXT" -> "PREM-EXT"
    return t
def norm(s):
    s = limpa(s)
    m = re.match(r'PREC-FBR \(FBR-\s*(AUT-[A-Z]+)\)', s)
    if m: return 'FBR-' + m.group(1)
    m = re.match(r'IRECOL \((\w+)\)', s)
    if m: return m.group(1)
    s = s.split(' ')[0]
    return s.replace('Ç', 'C')
TIPO = {'CsPendencia': 'Pendência', 'CsIndicador': 'Indicador', 'CsAcerto': 'Acerto'}
reg = {}
ordem = []
for x in o:
    c = norm(x['sigla'])
    desc = limpa(x['desc']); escl = limpa(x['escl']); grupo = limpa(x['grupo'])
    if c in reg:
        r = reg[c]
        if desc not in r['descricao']: r['descricao'] += ' / ' + desc
        if escl not in r['esclarecimento']: r['esclarecimento'] += ' ' + escl
        if grupo not in r['grupoAnexo']: r['grupoAnexo'] += ' e ' + grupo
        continue
    reg[c] = {'cod': c, 'tipo': TIPO[x['tipo']], 'grupoAnexo': grupo, 'descricao': desc, 'esclarecimento': escl, 'pagina': x['pg']}
    ordem.append(c)

# ---- Classificação do efeito no reconhecimento de direitos ----
V, K, MAND, DATAS_I, DATAS_F, DATAS, TC, NASC, MIN, AT, INF = 'vinculo', 'competencia', 'mandato', 'datas-inicio', 'datas-fim', 'datas', 'tc', 'idade-minima', 'minimo', 'atencao', 'info'
imp = {}
def put(cat, *cods):
    for c in cods: imp[c] = cat
put(AT, 'PDESFAZ-AJ-EC103', 'PMOV-INCONSIST', 'PREM-BLOQ-EC103', 'PNIT-CRIT', 'PNIT-IND', 'PNIT-O094', 'PNIT-SC', 'PNIT-SUP', 'PSE-POS', 'NDET', 'PADM-EMPR', 'PCEI-EQP-INV', 'PEMP-IDINV', 'PRES-EMPR', 'PRPPS', 'PVIN-SUBSTIT-INC', 'PVIN-TRAB-INTERM',
    'IREC-INDPEND', 'IREM-INDPEND', 'ISE-CVU', 'IVIN-REG-PRELIM', 'IVIN-MAND-ELETIVO-PARCIAL', 'ASE-INDR', 'AVRC-IND', 'AVRC-INDJ', 'AVRC-INDR', 'AEXT-VP', 'AEXT-VPR', 'AEXT-VPT')
put(MIN, 'PSC-MEN-SM-EC103', 'PREC-MENOR-MIN')
put(K, 'PREC-CDCONC', 'PREC-COD1821', 'PREC-COD1821_FORA_VIG', 'PREC-CSE', 'PREC-FACULTCONC', 'PREC-FBR', 'PREC-FBR-ANT', 'PREC-LC150-DOM', 'PREC-OBITO', 'PREC-PMIG-DOM',
    'PREM-EXT', 'PREM-TSVE-PER-QUARENTENA', 'PREM-TSVE-PER-TERM-JUD', 'PREM-TSVE-POS-QUARENTENA', 'PREM-TSVE-POS-TERM-JUD', 'PREM-TSVE-PROC-TRAB', 'PREM-NASC',
    'PREM-EMPR', 'PREM-FORA-ATIV-INTERM', 'PREM-FORA-CONVOC', 'PREM-FORA-REINTEG-ANISTIA', 'PREM-FORA-REINTEG-OUTROSTIPOS', 'PREM-FORA-REINTEG-PROC-TRAB', 'PREM-FVIN', 'PREM-IVIN', 'PREM-OBITO',
    'PREM-PER-DESLIG-APOSENT', 'PREM-PER-DESLIG-JUD', 'PREM-POS-DESLIG-APOSENT', 'PREM-POS-DESLIG-JUD', 'PREM-POSQRT', 'PREM-POS-QUARENTENA', 'PREM-REINTEG-ANISTIA', 'PREM-REINTEG-OUTROSTIPOS', 'PREM-VINC-PROC-TRAB', 'IREC-FBR-IND')
for c in ordem:
    if c.startswith('FBR-AUT-'): imp[c] = K
put(NASC, 'PDT-NASC-FIL-INV', 'PDT-NASC-FIL-MENOR-INV')
put(V, 'PSE-NEG', 'PSE-PEN', 'PDIV-DADOS-GFIP', 'PEMP-CAD', 'PEXT', 'PRPSE', 'PVIN-ADM-OBITO', 'PVIN-OBITO', 'PVIN-AGRUP-INC', 'PVIN-CAGED', 'PVIN-DESLIG-OBITO', 'PVIN-IRREG', 'PVIN-REC-PROC-TRAB', 'PVIN-RESP-INDIRETO-PROC-TRAB',
    'AEXT-IND', 'AEXT-INDJ', 'AEXT-INDR', 'ASE-IND', 'ASE-NSE', 'ASE-RNEG')
put(MAND, 'PVIN-MAND-ELETIVO-TOTAL', 'PVIN-ME')
put(DATAS_I, 'PVIN-ADMISSAO-PROC-TRAB')
put(DATAS_F, 'PVIN-DESLIG-PROC-TRAB', 'PVIN-DESLIG-JUSTICA-TRAB')
put(DATAS, 'PVIN-ADMISSAO-DESLIG-PROC-TRAB', 'PVIN-UNIC-CONTR-PROC-TRAB', 'PVIN-UNIC-CONTR-TSVE-PROC-TRAB')
put(TC, 'IREC-LC123', 'IREC-MEI', 'ILEI123', 'IMEI', 'IREC-FBR')
CANCELA = {'PEXT': ['AEXT-VT', 'AEXT-VTJ', 'AEXT-VTR'], 'PDIV-DADOS-GFIP': ['ADIV-DADOS-GFIP']}

EFEITO = {
    V: 'O INSS não computa o vínculo para reconhecimento de direitos enquanto a pendência não for tratada. Na análise, o vínculo marcado com ela fica fora do tempo e da carência; se a marca estiver só em uma competência, só ela sai.',
    K: 'A competência marcada não é computada para reconhecimento de direitos enquanto a pendência não for tratada. Na análise, ela fica fora do tempo e da carência.',
    MAND: 'O período de mandato eletivo até 18/09/2004 não conta como segurado empregado. De 02/1998 a 09/2004 pode contar como facultativo, se houver opção e recolhimento. Na análise, a parte do vínculo até 18/09/2004 fica de fora.',
    DATAS_I: 'A parte do vínculo acrescentada pela nova data de admissão precisa ser comprovada. Na análise, o período anterior à primeira remuneração do vínculo fica de fora.',
    DATAS_F: 'O período entre a última remuneração e a data de desligamento precisa ser comprovado. Na análise, o que passa do mês da última remuneração fica de fora.',
    DATAS: 'Os trechos do vínculo alterados pelo processo trabalhista precisam ser comprovados. Na análise, o período antes da primeira e depois da última remuneração fica de fora.',
    TC: 'A competência do plano simplificado (11% ou 5%) não conta na aposentadoria por tempo de contribuição nem na CTC sem complementação para 20%. Para carência e aposentadoria por idade ela conta normalmente.',
    NASC: 'Períodos e remunerações anteriores à idade mínima permitida (12, 14 ou 16 anos, conforme a época) não são considerados pelos sistemas de benefícios. Na análise, essa parte fica de fora quando a data de nascimento aparece no extrato.',
    MIN: 'A competência abaixo do salário mínimo não conta sem complementação, utilização ou agrupamento (EC 103/2019, art. 29). A análise trata isso pelo valor: na simulação há a pergunta sobre complementar.',
    AT: 'Não tira o período da contagem por si só, mas pode exigir documentos ou ajuste no CNIS. Confira antes de requerer.',
    INF: 'Informativo: não exige tratamento nem impede o cômputo.'
}
ESPEC = {
    'PADM-EMPR': 'Segundo o Anexo V, não há impacto no reconhecimento de direitos se o vínculo for comprovado e validado. A análise mantém o vínculo, com aviso.',
    'PRES-EMPR': 'Segundo o Anexo V, não há impacto no reconhecimento de direitos se o vínculo for comprovado e validado. A análise mantém o vínculo, com aviso.',
    'PRPPS': 'Pode impactar quando parte do vínculo for de regime próprio: essa parte só entra com certidão de tempo de contribuição (CTC). A análise mantém o vínculo, com aviso.',
    'PVIN-TRAB-INTERM': 'Desde 15/05/2025 esses vínculos vão para o sistema de benefícios (Portaria DIRBEN/INSS 1.283/2025). A análise mantém o vínculo, com aviso; remunerações fora do período de atividade têm pendência própria.',
    'PSE-POS': 'Mesmo positivo, o período migrado do CAFIR ou do RGP precisa de ratificação. A análise mantém o período, com aviso.',
    'NDET': 'O dia de início foi estimado como o último do mês. A análise mantém o vínculo; comprovar a data real pode acrescentar dias.',
    'ISE-CVU': 'O período de segurado especial concomitante com outra atividade não é computado automaticamente. Na análise o tempo concomitante já é contado uma vez só.',
    'IVIN-REG-PRELIM': 'Enquanto só houver o registro preliminar, o vínculo não traz afastamentos, o que afeta benefícios por incapacidade. Peça ao empregador o evento S-2200.',
    'IVIN-MAND-ELETIVO-PARCIAL': 'Parte do vínculo é de mandato eletivo: o trecho até 18/09/2004 não conta como empregado. Como o extrato não mostra qual trecho, a análise mantém o vínculo, com aviso.',
    'PREM-BLOQ-EC103': 'A competência não pode participar de complementação, utilização ou agrupamento enquanto a pendência de origem não for resolvida.',
    'PDESFAZ-AJ-EC103': 'No ano civil marcado não podem ser feitos ajustes de complementação, utilização ou agrupamento.',
    'IREC-FBR-IND': 'O recolhimento de facultativo de baixa renda foi indeferido ou invalidado: a competência não conta. Pode ser complementada para outra alíquota.',
    'PREC-FACULTCONC': 'O recolhimento de facultativo concomitante com atividade obrigatória fica pendente e não é considerado. Se a concomitância vier de vínculo sem data de saída ou código de pagamento errado, corrigir o CNIS pode liberar a competência.',
    'AEXT-IND': 'O pedido de acerto do vínculo extemporâneo foi negado: a parte extemporânea continua fora. Na análise, o vínculo fica fora do tempo e da carência.',
    'AEXT-INDJ': 'O acerto do vínculo extemporâneo foi negado por decisão judicial. Na análise, o vínculo fica fora do tempo e da carência.',
    'AEXT-INDR': 'O acerto do vínculo extemporâneo foi negado em recurso. Na análise, o vínculo fica fora do tempo e da carência.',
    'AEXT-VP': 'O acerto foi deferido só em parte: confira qual período foi confirmado.', 'AEXT-VPR': 'O acerto foi deferido só em parte: confira qual período foi confirmado.', 'AEXT-VPT': 'O acerto foi deferido só em parte: confira qual período foi confirmado.',
    'AEXT-VT': 'Acerto confirmado: a pendência PEXT deixa de excluir o vínculo.', 'AEXT-VTJ': 'Acerto confirmado: a pendência PEXT deixa de excluir o vínculo.', 'AEXT-VTR': 'Acerto confirmado: a pendência PEXT deixa de excluir o vínculo.',
    'ADIV-DADOS-GFIP': 'Validação feita: a pendência PDIV-DADOS-GFIP deixa de excluir o vínculo ou a remuneração.',
    'PSUC-DIVERG-DT-ADM': 'O próprio INSS desativou este indicador em 19/09/2024. Não deve aparecer em extratos atuais.',
    'PVIN-RE': 'Afeta só a causa da rescisão registrada, não a contagem do tempo.',
    'ASE-INDR': 'O nome e a explicação do Anexo V divergem (indeferido recursal x incluído por acórdão). Confira o período no CNIS antes de contar.',
}
for c in ordem:
    r = reg[c]
    if c not in imp:
        imp[c] = INF
    r['impacto'] = imp[c]
    r['efeito'] = ESPEC.get(c) or EFEITO[imp[c]]
    if c in CANCELA: r['cancelado_por'] = CANCELA[c]
    if r['tipo'] == 'Pendência' and r['impacto'] == INF and c.startswith('PDARF'): r['efeito'] = 'Aparece só na consulta de Darf do Portal CNIS, não no extrato do segurado. ' + ('O Darf restituído totalmente deixa de ter valor na competência.' if c == 'PDARF-RESTIT-TOTAL' else 'Não entra na análise do extrato.')
    if c.startswith('IDARF'): r['efeito'] = 'Aparece só na consulta de Darf do Portal CNIS, não no extrato do segurado.'
saida = {'fonte': 'Portaria DIRBEN/INSS nº 990, de 28/03/2022, Anexo V (Relação dos indicadores disponibilizados no CNIS), alterada pela Portaria DIRBEN/INSS nº 1.316, de 24/11/2025',
         'conferido': '2026-10-18', 'indicadores': [reg[c] for c in ordem]}
json.dump(saida, open(os.path.join(RAIZ, 'dados', 'indicadores.json'), 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(ordem), Counter(imp[c] for c in ordem))
print([c for c in ordem])
bad = [c for c in ordem if re.search(r'2333|538728|SEI 35014', reg[c]['descricao'] + reg[c]['esclarecimento'] + reg[c]['grupoAnexo'])]
print('lixo:', bad)
