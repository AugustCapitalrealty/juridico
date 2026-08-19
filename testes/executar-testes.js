/**
 * Teste de integração do leitor da planilha.
 *
 * Carrega os arquivos .gs em um contexto Node com stubs mínimos das APIs do
 * Apps Script e roda lerPlanilhaPesquisa() contra um dump real da planilha
 * de pesquisa, conferindo os números contra o parecer redigido à mão.
 *
 *   node testes/executar-testes.js [caminho-do-dump.json]
 *
 * O dump é gerado a partir do .xlsx exportado da planilha, no formato
 * { "Nome da aba": [[linha], [linha], ...] }.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS_GS = ['Config.gs', 'Utils.gs', 'LeitorPlanilha.gs'];

const caminhoDump = process.argv[2] || path.join(__dirname, 'planilha-exemplo.json');

if (!fs.existsSync(caminhoDump)) {
  console.error('Dump da planilha não encontrado: ' + caminhoDump);
  console.error('Gere-o a partir do .xlsx da pesquisa antes de rodar os testes.');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(caminhoDump, 'utf8'));

/** Stub de Sheet: expõe apenas o que o leitor usa. */
function criarAba(nome, linhas) {
  return {
    getName: () => nome,
    getDataRange: () => (linhas.length ? { getValues: () => linhas } : null)
  };
}

const contexto = {
  console,
  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'Planilha de teste',
      getSheetByName: (nome) =>
        Object.prototype.hasOwnProperty.call(dump, nome) ? criarAba(nome, dump[nome]) : null
    })
  },
  Utilities: {
    formatDate: (data) => data.toISOString().slice(0, 10)
  }
};

vm.createContext(contexto);
ARQUIVOS_GS.forEach((arquivo) => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'apps-script', arquivo), 'utf8');
  vm.runInContext(codigo, contexto, { filename: arquivo });
});

// --- microframework de asserção -------------------------------------------

let passou = 0;
let falhou = 0;

function conferir(descricao, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (ok) {
    passou++;
    console.log('  ok   ' + descricao + '  ->  ' + obtido);
  } else {
    falhou++;
    console.log('  FALHA ' + descricao);
    console.log('        esperado: ' + esperado);
    console.log('        obtido:   ' + obtido);
  }
}

// --- testes de formatação e valor por extenso ------------------------------

console.log('\nFormatação e conversão de números');
conferir('paraNumero padrão API', contexto.paraNumero('61500.00'), 61500);
conferir('paraNumero padrão BR', contexto.paraNumero('1.808.100,42'), 1808100.42);
conferir('paraNumero com R$', contexto.paraNumero('R$ 110.000,00'), 110000);
conferir('paraNumero milhar sem decimal', contexto.paraNumero('3.102'), 3102);
conferir('paraNumero vazio', contexto.paraNumero('-'), 0);
conferir('formatarBRL', contexto.formatarBRL(1808100.42), 'R$ 1.808.100,42');
conferir('formatarBRL centavos redondos', contexto.formatarBRL(239.89), 'R$ 239,89');
conferir('formatarCNPJ', contexto.formatarCNPJ('04967284000140'), '04.967.284/0001-40');
conferir('formatarData ISO', contexto.formatarData('2002-03-22T00:00:00.000Z'), '22/03/2002');

console.log('\nValor por extenso');
conferir('capital social do parecer', contexto.porExtenso(3102000),
  'três milhões e cento e dois mil reais');
conferir('mil exato', contexto.porExtenso(1000), 'mil reais');
conferir('um real', contexto.porExtenso(1), 'um real');
conferir('cem', contexto.porExtenso(100), 'cem reais');
conferir('com centavos', contexto.porExtenso(239.89),
  'duzentos e trinta e nove reais e oitenta e nove centavos');

// --- teste de integração contra os números do parecer ----------------------

console.log('\nLeitura da planilha (conferido contra o parecer redigido à mão)');
const dados = contexto.lerPlanilhaPesquisa('id-de-teste');

conferir('razão social', dados.razaoSocial, 'AZIMUTE ENGENHEIROS CONSULTORES LTDA');
conferir('CNPJ', dados.cnpj, '04.967.284/0001-40');
conferir('data de abertura', dados.dataAbertura, '22/03/2002');
conferir('capital social', contexto.formatarBRL(dados.capitalSocial), 'R$ 3.102.000,00');
conferir('faturamento presumido', contexto.formatarBRL(dados.faturamentoPresumido),
  'R$ 244.158.237,60');
conferir('natureza jurídica', dados.naturezaJuridica, '206-2 - Sociedade Empresária Limitada');

conferir('total de processos', dados.processos.total, 38);
conferir('processos em andamento (em tramitação)', dados.processos.emAndamento, 8);
conferir('processos não encerrados (inclui suspensos e em recurso)',
  dados.processos.naoEncerrados, 11);
conferir('exposição como réu', contexto.formatarBRL(dados.processos.valorReu),
  'R$ 1.808.100,42');
conferir('exposição como autor', contexto.formatarBRL(dados.processos.valorAutor),
  'R$ 1.107.572,16');
conferir('tabela de apoio traz todos os não encerrados',
  dados.processos.listaEmAndamento.length, 11);

conferir('protestos', dados.protestos.quantidade, 3);
conferir('total protestado', contexto.formatarBRL(dados.protestos.total), 'R$ 2.469,78');
conferir('Serasa sem pendências', dados.serasaResultado, 'Nada Consta');
conferir('Boa Vista sem pendências', dados.boaVistaResultado, 'Nada Consta');
conferir('participações societárias', dados.qtdParticipacoes, 23);
conferir('filiais', dados.qtdFiliais, 3);
conferir('sócios e administradores', dados.socios.length, 25);
conferir('ocorrências no Portal da Transparência', dados.transparencia.quantidade, 13);

console.log('\nAvisos de leitura: ' +
  (dados.alertas.length ? '\n  - ' + dados.alertas.join('\n  - ') : 'nenhum'));

console.log('\n' + passou + ' passaram, ' + falhou + ' falharam.');
process.exit(falhou > 0 ? 1 : 0);
