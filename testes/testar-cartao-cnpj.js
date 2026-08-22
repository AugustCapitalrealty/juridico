/**
 * Testes da consulta ao cartão CNPJ (CartaoCNPJ.gs).
 *
 *     node testes/testar-cartao-cnpj.js
 *
 * Cobre só a lógica pura — formatação do código CNAE e mapeamento do payload.
 * A chamada de rede em si se verifica rodando testarCartaoCNPJ() dentro do
 * editor do Apps Script, que é onde o código de fato roda.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appsScript = (arquivo) =>
  fs.readFileSync(path.join(__dirname, '..', 'apps-script', arquivo), 'utf8');

// Stubs das APIs do Apps Script. UrlFetchApp devolve erro de propósito: os
// testes cobrem validação e mapeamento, não a rede — a chamada real se
// verifica com testarCartaoCNPJ() dentro do editor.
const ctx = {
  Logger: { log: () => {} },
  console,
  CacheService: { getScriptCache: () => null },
  UrlFetchApp: {
    fetch: () => ({ getResponseCode: () => 503, getContentText: () => '' })
  }
};
vm.createContext(ctx);
vm.runInContext(appsScript('Utils.gs'), ctx);
vm.runInContext(appsScript('CartaoCNPJ.gs'), ctx);

let falhas = 0;
function conferir(rotulo, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : ' FALHA') + '  ' + rotulo +
    (ok ? '' : '\n         esperado: ' + JSON.stringify(esperado) +
               '\n           obtido: ' + JSON.stringify(obtido)));
}

console.log('\nformatarCNAE — o zero à esquerda que a API perde por ser número');
// Do parecer manual da Azimute:
conferir('230600 (number) -> 02.30-6-00', ctx.formatarCNAE(230600), '02.30-6-00');
conferir('8299701 -> 82.99-7-01', ctx.formatarCNAE(8299701), '82.99-7-01');
conferir('7112000 -> 71.12-0-00 (CNAE principal)', ctx.formatarCNAE(7112000), '71.12-0-00');
conferir('string "0230600"', ctx.formatarCNAE('0230600'), '02.30-6-00');
conferir('ja formatado passa limpo', ctx.formatarCNAE('02.30-6-00'), '02.30-6-00');
conferir('vazio -> vazio', ctx.formatarCNAE(''), '');
conferir('null -> vazio', ctx.formatarCNAE(null), '');

console.log('\n_mapearCartaoCNPJ — payload no formato da BrasilAPI');
const payload = {
  cnpj: '04967284000140',
  razao_social: 'AZIMUTE ENGENHEIROS CONSULTORES LTDA',
  nome_fantasia: 'AZIMUTE',
  cnae_fiscal: 7112000,
  cnae_fiscal_descricao: 'Serviços de engenharia',
  codigo_natureza_juridica: 2062,
  natureza_juridica: 'Sociedade Empresária Limitada',
  descricao_situacao_cadastral: 'ATIVA',
  cnaes_secundarios: [
    { codigo: 230600, descricao: 'Atividades de apoio à produção florestal' },
    { codigo: 8299701, descricao: 'Medição de consumo de energia elétrica, gás e água' }
  ]
};
const m = ctx._mapearCartaoCNPJ(payload);
conferir('ok', m.ok, true);
conferir('cnaes secundarios formatados', m.cnaesSecundarios, [
  '02.30-6-00 - Atividades de apoio à produção florestal',
  '82.99-7-01 - Medição de consumo de energia elétrica, gás e água'
]);
conferir('cnae principal', m.cnaePrincipal, '71.12-0-00 - Serviços de engenharia');
conferir('natureza juridica', m.naturezaJuridica, '2062 - Sociedade Empresária Limitada');
conferir('situacao', m.situacao, 'ATIVA');

console.log('\n_mapearCartaoCNPJ — exemplo literal da documentação da BrasilAPI');
// Copiado da resposta de exemplo publicada em brasilapi.com.br/docs, para
// que uma mudança de contrato apareça aqui antes de aparecer no parecer.
const doc = ctx._mapearCartaoCNPJ({
  cnpj: '19131243000197',
  razao_social: 'OPEN KNOWLEDGE BRASIL',
  nome_fantasia: 'REDE PELO CONHECIMENTO LIVRE',
  cnae_fiscal: 9430800,
  cnae_fiscal_descricao: 'Atividades de associações de defesa de direitos sociais',
  codigo_natureza_juridica: 3999,
  natureza_juridica: 'Associação Privada',
  descricao_situacao_cadastral: 'ATIVA',
  cnaes_secundarios: []
});
conferir('cnae principal (9430800)', doc.cnaePrincipal,
  '94.30-8-00 - Atividades de associações de defesa de direitos sociais');
conferir('natureza juridica (3999)', doc.naturezaJuridica, '3999 - Associação Privada');
conferir('razao social', doc.razaoSocial, 'OPEN KNOWLEDGE BRASIL');

console.log('\n_mapearCartaoCNPJ — degradação quando a API muda');
conferir('sem cnaes_secundarios', ctx._mapearCartaoCNPJ({ razao_social: 'X' }).cnaesSecundarios, []);
conferir('cnaes_secundarios nao-array', ctx._mapearCartaoCNPJ({ cnaes_secundarios: 'oops' }).cnaesSecundarios, []);
conferir('payload nulo nao quebra', ctx._mapearCartaoCNPJ(null).ok, false);
conferir('CNAE "00" filtrado (empresa sem secundario)',
  ctx._mapearCartaoCNPJ({ cnaes_secundarios: [{ codigo: 0, descricao: 'Não informada' }] }).cnaesSecundarios, []);
conferir('nomes camelCase alternativos',
  ctx._mapearCartaoCNPJ({ razaoSocial: 'ACME' }).razaoSocial, 'ACME');

console.log('\nconsultarCartaoCNPJ — validação antes de gastar uma chamada de rede');
const erroDe = (cnpj) => ctx.consultarCartaoCNPJ(cnpj).erro || '';
conferir('vazio é recusado', erroDe('').indexOf('inválido') >= 0, true);
conferir('curto demais é recusado', erroDe('123').indexOf('inválido') >= 0, true);
conferir('CPF (11 dígitos) é recusado', erroDe('12345678901').indexOf('inválido') >= 0, true);
// CNPJ alfanumérico entra em vigor no Brasil e a API já o aceita; um
// replace(/\D/g) teria comido as letras e transformado num CNPJ curto.
conferir('alfanumérico não é mutilado pela limpeza',
  erroDe('12ABC34501DE35').indexOf('inválido') >= 0, false);

console.log(falhas === 0 ? '\nTodos os casos passaram.\n' : '\n' + falhas + ' falha(s).\n');
process.exit(falhas === 0 ? 0 : 1);
