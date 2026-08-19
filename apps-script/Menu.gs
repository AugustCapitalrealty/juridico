/**
 * Interface: menu do painel, montagem da aba de entrada e disparo da geração.
 *
 * Este script fica vinculado a uma planilha "Painel" fixa da equipe. A cada
 * novo parecer, a equipe cola o link da planilha de pesquisa daquele caso e
 * preenche os campos de negócio — o script não precisa ser copiado a cada
 * pesquisa nova.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Parecer Jurídico')
    .addItem('Gerar rascunho', 'acaoGerarRascunho')
    .addSeparator()
    .addItem('Configurar painel (primeira vez)', 'configurarPainel')
    .addItem('Testar leitura da planilha', 'acaoTestarLeitura')
    .addToUi();
}

/** Cria (ou recria) a aba de entrada com os campos manuais. */
function configurarPainel() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(CONFIG.ABA_PAINEL);

  if (!aba) {
    aba = planilha.insertSheet(CONFIG.ABA_PAINEL, 0);
  } else {
    aba.clear();
  }

  aba.getRange('A1').setValue('Gerador de rascunho — Parecer Reputacional');
  aba.getRange('A1:C1').merge()
    .setFontSize(14).setFontWeight('bold')
    .setBackground('#1f3864').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  aba.getRange('A2:C2').merge()
    .setValue('Preencha a coluna B e use o menu "Parecer Jurídico > Gerar rascunho".')
    .setFontStyle('italic').setFontColor('#666666');

  var cabecalho = ['Campo', 'Preencher aqui', 'Observação'];
  aba.getRange(3, 1, 1, 3).setValues([cabecalho])
    .setFontWeight('bold').setBackground('#d9e2f3');

  var linhas = CAMPOS_MANUAIS.map(function (campo) {
    return [campo.rotulo + (campo.obrigatorio ? ' *' : ''), '', campo.exemplo];
  });

  aba.getRange(4, 1, linhas.length, 3).setValues(linhas);

  aba.getRange(4, 1, linhas.length, 1).setFontWeight('bold').setBackground('#f2f2f2');
  aba.getRange(4, 2, linhas.length, 1).setBackground('#fffde7').setWrap(true);
  aba.getRange(4, 3, linhas.length, 1).setFontColor('#888888').setFontStyle('italic');

  aba.setColumnWidth(1, 320);
  aba.setColumnWidth(2, 380);
  aba.setColumnWidth(3, 340);
  aba.setFrozenRows(3);

  var rodape = 4 + linhas.length + 1;
  aba.getRange(rodape, 1, 1, 3).merge()
    .setValue('* campos obrigatórios. Os demais dados são lidos automaticamente da planilha de pesquisa.')
    .setFontStyle('italic').setFontColor('#666666');

  SpreadsheetApp.getUi().alert('Painel configurado',
    'A aba "' + CONFIG.ABA_PAINEL + '" foi criada. Preencha os campos e use ' +
    '"Parecer Jurídico > Gerar rascunho".', SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Lê os campos manuais do painel e devolve um mapa chave -> valor. */
function lerCamposManuais() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(CONFIG.ABA_PAINEL);
  if (!aba) {
    throw new Error('Aba "' + CONFIG.ABA_PAINEL + '" não encontrada. ' +
      'Use "Parecer Jurídico > Configurar painel (primeira vez)".');
  }

  var valores = aba.getRange(4, 1, CAMPOS_MANUAIS.length, 2).getValues();
  var manuais = {};
  var faltando = [];

  CAMPOS_MANUAIS.forEach(function (campo, i) {
    var valor = valores[i][1];
    if (Object.prototype.toString.call(valor) === '[object Date]') {
      valor = formatarData(valor);
    }
    valor = String(valor === null || valor === undefined ? '' : valor).trim();
    manuais[campo.chave] = valor;
    if (campo.obrigatorio && !valor) faltando.push(campo.rotulo);
  });

  if (faltando.length > 0) {
    throw new Error('Preencha os campos obrigatórios no painel:\n\n• ' + faltando.join('\n• '));
  }

  return manuais;
}

/** Ação do menu: gera o rascunho e mostra o link. */
function acaoGerarRascunho() {
  var ui = SpreadsheetApp.getUi();

  try {
    var manuais = lerCamposManuais();
    var idPesquisa = extrairId(manuais.LINK_PLANILHA);

    if (!idPesquisa) {
      ui.alert('Informe o link da planilha de pesquisa no painel.');
      return;
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('Lendo a planilha de pesquisa...', 'Gerando', 30);
    var dados = lerPlanilhaPesquisa(idPesquisa);

    SpreadsheetApp.getActiveSpreadsheet().toast('Montando o rascunho...', 'Gerando', 30);
    var resultado = gerarRascunho(dados, manuais);

    var mensagem = 'Rascunho criado:\n\n' + resultado.nome + '\n\n' + resultado.url;

    if (resultado.pendencias.length > 0) {
      mensagem += '\n\nPendências de preenchimento manual (' + resultado.pendencias.length + '):\n• ' +
        resultado.pendencias.join('\n• ');
    }

    mensagem += '\n\nAs seções de análise jurídica ficaram em branco, com os dados de apoio logo abaixo.';

    ui.alert('Rascunho gerado', mensagem, ui.ButtonSet.OK);

  } catch (erro) {
    ui.alert('Não foi possível gerar o rascunho', String(erro.message || erro), ui.ButtonSet.OK);
  }
}

/**
 * Ação do menu: lê a planilha e mostra os números apurados, sem gerar
 * documento. Serve para conferir o mapeamento antes de rodar de verdade.
 */
function acaoTestarLeitura() {
  var ui = SpreadsheetApp.getUi();

  try {
    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PAINEL);
    if (!aba) throw new Error('Configure o painel primeiro.');

    var idPesquisa = extrairId(aba.getRange(4, 2).getValue());
    if (!idPesquisa) throw new Error('Informe o link da planilha de pesquisa.');

    var dados = lerPlanilhaPesquisa(idPesquisa);
    var p = dados.processos;

    var linhas = [
      'Razão social: ' + dados.razaoSocial,
      'CNPJ: ' + dados.cnpj,
      'Abertura: ' + dados.dataAbertura,
      'Capital social: ' + formatarBRL(dados.capitalSocial),
      '   por extenso: ' + porExtenso(dados.capitalSocial),
      'Faturamento presumido: ' + formatarBRL(dados.faturamentoPresumido),
      '',
      'Processos (total): ' + p.total,
      'Processos em andamento: ' + p.emAndamento,
      'Exposição como réu: ' + formatarBRL(p.valorReu),
      'Exposição como autor: ' + formatarBRL(p.valorAutor),
      '',
      'Sócios/administradores: ' + dados.socios.length,
      'Participações: ' + dados.qtdParticipacoes,
      'Filiais: ' + dados.qtdFiliais,
      'Protestos: ' + dados.protestos.quantidade + ' (' + formatarBRL(dados.protestos.total) + ')',
      'Serasa: ' + dados.serasaResultado,
      'Portal da Transparência: ' + dados.transparencia.quantidade + ' ocorrências'
    ];

    if (dados.alertas.length > 0) {
      linhas.push('', 'Avisos:');
      dados.alertas.forEach(function (a) { linhas.push('• ' + a); });
    }

    ui.alert('Leitura da planilha', linhas.join('\n'), ui.ButtonSet.OK);

  } catch (erro) {
    ui.alert('Erro na leitura', String(erro.message || erro), ui.ButtonSet.OK);
  }
}
