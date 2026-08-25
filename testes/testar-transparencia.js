/**
 * Testes da leitura do Portal da Transparência (LeitorPlanilha.gs).
 *
 *     node testes/testar-transparencia.js
 *
 * As linhas abaixo são as 13 ocorrências reais da pesquisa da Azimute,
 * copiadas da aba "Portal da Transparência". O ponto do teste é a separação
 * entre documento de pagamento e vínculo cadastral: a busca do portal
 * devolve os dois misturados, e contar tudo como "ocorrência" sugere que a
 * empresa recebeu 13 vezes quando foram 8.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appsScript = (arquivo) =>
  fs.readFileSync(path.join(__dirname, '..', 'apps-script', arquivo), 'utf8');

const PORTAL = 'https://portaldatransparencia.cgu.gov.br';
const LINHAS = [
  ['Titulo', 'URL', 'Descrição'],
  ['Pessoa Jurídica: 04.967.284/0001-40 - AZIMUTE ENGENHEIROS CONSULTORES LTDA',
    PORTAL + '/busca/pessoa-juridica/04967284000140-azimute-engenheiros-consultores-ltda', ''],
  ['Documento Pagamento 2019DF800006', PORTAL + '/despesas/pagamento/530023000012019DF800006', ''],
  ['Documento Pagamento 2019DR800004', PORTAL + '/despesas/pagamento/530023000012019DR800004', ''],
  ['Documento Pagamento 2019DR800011', PORTAL + '/despesas/pagamento/530023000012019DR800011', ''],
  ['Documento Pagamento 2019DF800016', PORTAL + '/despesas/pagamento/530023000012019DF800016', ''],
  ['Documento Pagamento 2019DF800013', PORTAL + '/despesas/pagamento/530023000012019DF800013', ''],
  ['Documento Pagamento 2019DR800008', PORTAL + '/despesas/pagamento/530023000012019DR800008', ''],
  ['Documento Pagamento 2021DF800003', PORTAL + '/despesas/pagamento/530023000012021DF800003', ''],
  ['Documento Pagamento 2021DR800003', PORTAL + '/despesas/pagamento/530023000012021DR800003', ''],
  ['ANA CAROLINA BRUSKE - ***.908.219-** - Sócio(a) da empresa: 04.967.284/0001-40',
    PORTAL + '/busca/pessoa-juridica/04967284000140-azimute-engenheiros-consultores-ltda', ''],
  ['CAMILA BRUSKE DE LIMA - ***.533.099-** - Sócio(a) da empresa: 04.967.284/0001-40',
    PORTAL + '/busca/pessoa-juridica/04967284000140-azimute-engenheiros-consultores-ltda', ''],
  ['ANTONIO CARLOS RAMUSKI - ***.947.099-** - Sócio(a) da empresa: 04.967.284/0001-40',
    PORTAL + '/busca/pessoa-juridica/04967284000140-azimute-engenheiros-consultores-ltda', ''],
  ['JOSE ANTONIO VALDEZ - ***.014.549-** - Sócio(a) da empresa: 04.967.284/0001-40',
    PORTAL + '/busca/pessoa-juridica/04967284000140-azimute-engenheiros-consultores-ltda', '']
];

const abas = { 'Portal da Transparência': LINHAS };
const planilhaFalsa = {
  getSheetByName: (nome) => abas[nome]
    ? { getDataRange: () => ({ getValues: () => abas[nome] }) }
    : null
};

const ctx = { Logger: { log: () => {} }, console };
vm.createContext(ctx);
vm.runInContext(appsScript('Config.gs'), ctx);
vm.runInContext(appsScript('Utils.gs'), ctx);
vm.runInContext(appsScript('LeitorPlanilha.gs'), ctx);

const dados = {};
ctx._lerFontesPublicas(planilhaFalsa, dados);
const t = dados.transparencia;

let falhas = 0;
function conferir(rotulo, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : ' FALHA') + '  ' + rotulo +
    (ok ? '' : '\n         esperado: ' + JSON.stringify(esperado) +
               '\n           obtido: ' + JSON.stringify(obtido)));
}

console.log('\nPortal da Transparência — Azimute (13 ocorrências reais)');
conferir('total de ocorrências', t.quantidade, 13);
conferir('documentos de pagamento', t.pagamentos.length, 8);
conferir('vínculos cadastrais (empresa + 4 sócios)', t.vinculos.length, 5);
conferir('exercícios extraídos dos códigos', t.anos, ['2019', '2021']);

console.log('\nExtração do exercício do código do documento');
conferir('2019DF800006 -> 2019', t.pagamentos[0].ano, '2019');
conferir('2021DR800003 -> 2021', t.pagamentos[7].ano, '2021');
conferir('vínculo não tem exercício', t.vinculos[0].ano, '');

console.log('\nAba ausente não quebra a leitura');
const vazio = {};
ctx._lerFontesPublicas({ getSheetByName: () => null }, vazio);
conferir('quantidade zero', vazio.transparencia.quantidade, 0);
conferir('pagamentos vazio', vazio.transparencia.pagamentos, []);
conferir('anos vazio', vazio.transparencia.anos, []);

console.log(falhas === 0 ? '\nTodos os casos passaram.\n' : '\n' + falhas + ' falha(s).\n');
process.exit(falhas === 0 ? 0 : 1);
