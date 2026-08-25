/**
 * Geração do rascunho: copia o documento modelo, substitui os marcadores
 * pelos dados da planilha e monta os blocos dinâmicos.
 *
 * Convenções de marcador no modelo:
 *   {{CAMPO}}      - valor simples, pode estar dentro de célula de tabela
 *   <<BLOCO_X>>    - parágrafo inteiro substituído por conteúdo gerado
 *
 * As seções de análise jurídica não são preenchidas: o modelo já traz a
 * marcação "A PREENCHER" e o script apenas insere, logo abaixo, os dados de
 * apoio que embasam a redação.
 */

/**
 * @param {Object} dados Saída de lerPlanilhaPesquisa().
 * @param {Object} manuais Mapa chave -> valor dos campos preenchidos no painel.
 * @return {{id: string, url: string, nome: string, pendencias: string[]}}
 */
function gerarRascunho(dados, manuais) {
  if (!CONFIG.MODELO_DOC_ID || CONFIG.MODELO_DOC_ID.indexOf('COLE_AQUI') === 0) {
    throw new Error('Configure o MODELO_DOC_ID no arquivo Config.gs antes de gerar o rascunho.');
  }

  var pendencias = [];

  var modelo = DriveApp.getFileById(CONFIG.MODELO_DOC_ID);
  var nome = _nomeArquivo(dados, manuais);
  var pasta = CONFIG.PASTA_DESTINO_ID
    ? DriveApp.getFolderById(CONFIG.PASTA_DESTINO_ID)
    : modelo.getParents().next();

  var copia = modelo.makeCopy(nome, pasta);
  var documento = DocumentApp.openById(copia.getId());
  var corpo = documento.getBody();

  var valores = _montarValores(dados, manuais, pendencias);

  Object.keys(valores).forEach(function (chave) {
    var valor = valores[chave];
    if (Array.isArray(valor)) {
      _substituirMultilinha(corpo, '{{' + chave + '}}', valor);
    } else {
      corpo.replaceText(escaparRegex('{{' + chave + '}}'), _texto(valor));
    }
  });

  _preencherBlocos(corpo, dados, manuais, pendencias);

  // Precisa rodar antes do checklist para que os órfãos apareçam nele.
  _sinalizarMarcadoresOrfaos(corpo, pendencias);

  _inserirChecklist(corpo, dados, pendencias);

  // Rede de segurança: nenhum marcador pode sobreviver até o documento final.
  // _sinalizarMarcadoresOrfaos roda antes do checklist e ignora o marcador
  // dele por construção, então sem esta varredura o checklist seria o único
  // marcador capaz de vazar sem ninguém ser avisado.
  _limparMarcadoresRestantes(corpo);

  documento.saveAndClose();

  return {
    id: copia.getId(),
    url: copia.getUrl(),
    nome: nome,
    pendencias: pendencias
  };
}

/** RASCUNHO_Parecer Reputacional_Empresa_2026.08.19 */
function _nomeArquivo(dados, manuais) {
  var data = manuais.DATA_PESQUISA
    ? String(manuais.DATA_PESQUISA).replace(/\//g, '.')
    : Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy.MM.dd');
  var empresa = (dados.razaoSocial || dados.nomePlanilha || 'Pesquisada').trim();
  return CONFIG.PREFIXO_ARQUIVO + '_' + empresa + '_' + data;
}

function _texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

/**
 * Monta o mapa marcador -> valor. Um valor em array vira várias linhas
 * dentro do mesmo parágrafo/célula.
 */
function _montarValores(dados, manuais, pendencias) {
  var p = dados.processos;

  var dataPesquisa = manuais.DATA_PESQUISA ||
    Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy');

  var capitalTexto = dados.capitalSocial
    ? formatarBRL(dados.capitalSocial) + ' (' + _primeiraMaiuscula(porExtenso(dados.capitalSocial)) + ')'
    : _pendente('Capital social não localizado na planilha', pendencias);

  var exposicao = [
    'Valores como réu: ' + formatarBRL(p.valorReu),
    'Valores como autor: ' + formatarBRL(p.valorAutor)
  ];

  var protestosQtd = dados.protestos.quantidade > 0
    ? pluralizar(dados.protestos.quantidade, 'resultado encontrado', 'resultados encontrados')
    : 'Nada consta';

  var protestosObs = dados.protestos.quantidade > 0
    ? dados.protestos.itens.map(function (item) { return item.descricao; })
    : ['-'];

  var textoProcessos = 'Foram identificados, ao todo, ' +
    pluralizar(p.total, 'processo judicial', 'processos judiciais') +
    ' envolvendo a Pesquisada, dos quais ' + p.emAndamento +
    (p.emAndamento === 1 ? ' permanece' : ' permanecem') + ' em andamento.';

  return {
    // Cabeçalho
    DATA_PESQUISA: dataPesquisa,
    RAZAO_SOCIAL: dados.razaoSocial || '',
    NOME_FANTASIA: dados.nomeFantasia || '',
    CNPJ: dados.cnpj || '',
    DATA_ABERTURA: dados.dataAbertura || '',
    ESCOPO: manuais.ESCOPO || _pendente('Escopo não informado no painel', pendencias),
    SOLICITACAO: manuais.SOLICITACAO || _pendente('Nº da solicitação não informado', pendencias),
    EMPREENDIMENTO: manuais.EMPREENDIMENTO || _pendente('Empreendimento não informado', pendencias),

    // Tabela de indicadores
    VALOR_CONTRATACAO: manuais.VALOR_CONTRATACAO
      ? formatarBRL(manuais.VALOR_CONTRATACAO)
      : _pendente('Valor da contratação não informado', pendencias),
    CAPITAL_SOCIAL: capitalTexto,
    FATURAMENTO_PRESUMIDO: dados.faturamentoPresumido
      ? formatarBRL(dados.faturamentoPresumido)
      : _pendente('Faturamento presumido não localizado', pendencias),
    ENDERECO: dados.endereco || '',
    EXPOSICAO_JURIDICA: exposicao,
    EXPOSICAO_OBS: 'Foram identificados ' + pluralizar(p.total, 'processo', 'processos') +
      ', dos quais ' + p.emAndamento + ' em andamento.',
    COMPROT: manuais.COMPROT || _pendente('COMPROT não informado (consulta manual)', pendencias),
    PROTESTOS_QTD: protestosQtd,
    PROTESTOS_OBS: protestosObs,
    SERASA_RESULTADO: dados.serasaResultado || '',
    SERASA_OBS: dados.serasaScoreTexto ||
      _pendente('Score Serasa não localizado na planilha', pendencias),

    // Corpo do parecer
    QTD_PARTICIPACOES: String(dados.qtdParticipacoes || 0),
    QTD_FILIAIS: String(dados.qtdFiliais || 0),
    CNAE_PRINCIPAL: dados.cnaePrincipal || '',
    NATUREZA_JURIDICA: dados.naturezaJuridica || '',
    PORTE: dados.porte || '',
    QTD_FUNCIONARIOS: dados.qtdFuncionarios || '',
    IDADE_EMPRESA: dados.idadeEmpresa || '',
    TEXTO_PROCESSOS: textoProcessos,
    TOTAL_PROCESSOS: String(p.total),
    PROCESSOS_EM_ANDAMENTO: String(p.emAndamento),
    TRANSPARENCIA_TEXTO: manuais.TRANSPARENCIA_TEXTO ||
      _pendente('Valores do Portal da Transparência não informados', pendencias),
    QTD_TRANSPARENCIA: String(dados.transparencia.quantidade || 0),

    // Classificações trazidas da capa do relatório
    RISCO_REPUTACIONAL: dados.riscoReputacional || '',
    RISCO_JURIDICO_PLATAFORMA: dados.riscoJuridico || '',
    RISCO_CREDITO: dados.riscoCredito || '',
    PEP_MIDIAS: dados.pepMidias || ''
  };
}

function _primeiraMaiuscula(texto) {
  var s = String(texto || '');
  return s ? s.charAt(0).toUpperCase() + s.substring(1) : s;
}

/** Registra a pendência e devolve o texto que ficará visível no rascunho. */
function _pendente(mensagem, pendencias) {
  pendencias.push(mensagem);
  return '[ A PREENCHER ]';
}

/**
 * Substitui um marcador por várias linhas dentro do mesmo parágrafo/célula,
 * usando quebra de linha suave (Shift+Enter, caractere U+000B) em vez de
 * parágrafos novos.
 *
 * Criar parágrafos novos exige copiar a formatação do original — e isso
 * falha quando o tamanho de fonte do marcador vem herdado do estilo do
 * documento em vez de fixado no caractere, porque getAttributes() só
 * enxerga o que está sobrescrito explicitamente. Reaproveitando o mesmo
 * parágrafo/run original não há nada para copiar: a formatação é a mesma
 * porque é, literalmente, o mesmo texto.
 */
function _substituirMultilinha(corpo, marcador, linhas) {
  var achado = corpo.findText(escaparRegex(marcador));
  if (!achado) return false;

  var elemento = achado.getElement();
  var paragrafo = _paragrafoDe(elemento);
  var texto = _naoVazio(linhas.join('\u000b'));

  if (!paragrafo) {
    corpo.replaceText(escaparRegex(marcador), texto);
    return true;
  }

  paragrafo.setText(texto);
  return true;
}

/**
 * Sobe na árvore até o parágrafo (ou item de lista) que contém o elemento.
 * Ambos aceitam setText/getAttributes/removeFromParent, então o chamador
 * não precisa distinguir os dois casos.
 */
function _paragrafoDe(elemento) {
  var atual = elemento;
  while (atual) {
    var tipo = atual.getType();
    if (tipo === DocumentApp.ElementType.PARAGRAPH ||
        tipo === DocumentApp.ElementType.LIST_ITEM) {
      return atual;
    }
    if (tipo === DocumentApp.ElementType.BODY_SECTION) return null;
    atual = atual.getParent();
  }
  return null;
}

/**
 * Remove um parágrafo com segurança. O Google Docs recusa remover o último
 * parágrafo de uma seção (comum logo após quebras de página/seção no
 * modelo) — nesse caso, em vez de remover, apenas esvazia o parágrafo.
 * Um parágrafo totalmente vazio também é recusado, daí o espaço.
 */
function _removerParagrafoSeguro(paragrafo) {
  try {
    paragrafo.removeFromParent();
  } catch (erro) {
    paragrafo.setText(' ');
  }
}

/**
 * O Google Docs recusa inserir parágrafo, item de lista ou célula de
 * tabela com texto totalmente vazio — comum quando um campo da planilha
 * (nome, documento) está em branco. Troca por um espaço nesses casos.
 */
function _naoVazio(texto) {
  var t = String(texto === null || texto === undefined ? '' : texto);
  return t.length > 0 ? t : ' ';
}

/** Localiza o parágrafo de um marcador de bloco e devolve pai + índice. */
function _localizarBloco(corpo, marcador) {
  var achado = corpo.findText(escaparRegex(marcador));
  if (!achado) return null;

  var paragrafo = _paragrafoDe(achado.getElement());
  if (!paragrafo) return null;

  return {
    paragrafo: paragrafo,
    pai: paragrafo.getParent(),
    indice: paragrafo.getParent().getChildIndex(paragrafo)
  };
}

/** Preenche todos os blocos dinâmicos do modelo. */
function _preencherBlocos(corpo, dados, manuais, pendencias) {
  _blocoCnaeSecundario(corpo, manuais, pendencias);
  _blocoSocios(corpo, dados);
  _blocoParticipacoes(corpo, dados);
  _blocoResumoProcessos(corpo, dados);
  _blocoProcessosAndamento(corpo, dados);
  _blocoEmpresasRelacionadas(corpo, dados);
  _blocoTransparencia(corpo, dados);
}

/**
 * CNAEs secundários não constam no relatório da plataforma: chegam em
 * `manuais.CNAE_SECUNDARIO`, um por linha, preenchidos por
 * enriquecerComCartaoCNPJ a partir do cartão CNPJ. Quando a consulta falha o
 * bloco fica marcado como pendente e o motivo aparece nos avisos de leitura.
 */
function _blocoCnaeSecundario(corpo, manuais, pendencias) {
  var local = _localizarBloco(corpo, '<<BLOCO_CNAE_SECUNDARIO>>');
  if (!local) return;

  var linhas = String(manuais.CNAE_SECUNDARIO || '')
    .split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });

  if (linhas.length === 0) {
    pendencias.push('CNAEs secundários em branco — a consulta ao cartão CNPJ não trouxe ' +
      'resultado (o motivo está nos avisos de leitura).');
    _substituirPorParagrafos(local, ['[ A PREENCHER — copiar do cartão CNPJ da Receita Federal ]'], true);
    return;
  }

  _substituirPorLista(local, linhas);
}

/**
 * Quadro societário atual e histórico. Reordena por seção (Ativo antes de
 * Histórico) em vez de seguir a ordem bruta da planilha, já que a aba QSA
 * às vezes lista o bloco de históricos antes do de ativos.
 */
function _blocoSocios(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_SOCIOS>>');
  if (!local) return;

  if (!dados.socios || dados.socios.length === 0) {
    _substituirPorParagrafos(local, ['Nenhum sócio ou administrador identificado no relatório.'], false);
    return;
  }

  var ordenados = dados.socios.slice().sort(function (a, b) {
    var pesoA = a.secao === 'Ativo' ? 0 : 1;
    var pesoB = b.secao === 'Ativo' ? 0 : 1;
    return pesoA - pesoB;
  });

  var tabela = [['Documento', 'Nome', 'Qualificação', 'Situação']];
  ordenados.forEach(function (socio) {
    tabela.push([socio.documento, socio.nome, socio.qualificacao, socio.secao]);
  });

  _substituirPorTabela(local, tabela);
}

/** Participações societárias em outras empresas. */
function _blocoParticipacoes(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_PARTICIPACOES>>');
  if (!local) return;

  if (!dados.participacoes || dados.participacoes.length === 0) {
    _substituirPorParagrafos(local, ['Nenhuma participação societária mapeada.'], false);
    return;
  }

  var linhas = dados.participacoes.map(function (item) {
    return item.nome + (item.cnpj ? ' — ' + item.cnpj : '');
  });

  _substituirPorLista(local, linhas);
}

/** Distribuição dos processos por tribunal e por ano. */
function _blocoResumoProcessos(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_RESUMO_PROCESSOS>>');
  if (!local) return;

  var resumo = dados.processosResumo || {};
  var grupos = [
    { titulo: 'Estaduais', itens: resumo.estaduais || [] },
    { titulo: 'Federais', itens: resumo.federais || [] },
    { titulo: 'Trabalhistas', itens: resumo.trabalhistas || [] },
    { titulo: 'Superiores', itens: resumo.superiores || [] }
  ].filter(function (g) { return g.itens.length > 0; });

  if (grupos.length === 0) {
    _substituirPorParagrafos(local, ['Sem distribuição por tribunal disponível no relatório.'], false);
    return;
  }

  var linhas = grupos.map(function (g) {
    return g.titulo + ': ' + g.itens.join('; ');
  });

  if (resumo.porAno && resumo.porAno.length > 0) {
    linhas.push('Por ano: ' + resumo.porAno.join('; '));
  }

  _substituirPorLista(local, linhas);
}

/**
 * Dados de apoio para a análise humana: os processos ainda ativos, do maior
 * valor de causa para o menor. É a informação que hoje é garimpada à mão
 * na planilha antes de escrever a seção "Processos".
 */
function _blocoProcessosAndamento(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_PROCESSOS_ANDAMENTO>>');
  if (!local) return;

  var lista = dados.processos.listaEmAndamento || [];
  if (lista.length === 0) {
    _substituirPorParagrafos(local, ['Nenhum processo em andamento identificado.'], false);
    return;
  }

  var tabela = [['Nº do processo', 'Tribunal', 'Polo', 'Situação', 'Classe / Assunto', 'Valor da causa', 'Distribuição']];
  lista.forEach(function (proc) {
    var materia = proc.classe || '';
    if (proc.assuntos) materia += (materia ? ' — ' : '') + proc.assuntos;
    tabela.push([
      proc.numero,
      proc.tribunal,
      proc.polo,
      proc.status,
      materia,
      formatarBRL(proc.valor),
      proc.distribuicao
    ]);
  });

  _substituirPorTabela(local, tabela);
}

/**
 * Empresas e pessoas ligadas, com destaque para as sinalizadas.
 *
 * A planilha traz uma linha por par empresa-sócio, então a mesma empresa
 * aparece várias vezes seguidas (uma por sócio em comum). Agrupar por
 * empresa e mostrar em tabela — em vez da lista corrida original — deixa
 * o vínculo mais fácil de escanear, e ordenar pelo nº de vínculos destaca
 * primeiro as empresas com mais administradores em comum com a Pesquisada.
 */
function _blocoEmpresasRelacionadas(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_EMPRESAS_RELACIONADAS>>');
  if (!local) return;

  var rel = dados.empresasRelacionadas || { total: 0, itens: [] };
  if (rel.total === 0) {
    _substituirPorParagrafos(local, ['Nenhuma empresa relacionada mapeada.'], false);
    return;
  }

  var sinalizados = rel.itens.filter(function (i) { return i.apontamento; });
  if (sinalizados.length === 0) {
    _substituirPorParagrafos(local, [
      'Total de vínculos mapeados: ' + rel.total +
        '. Nenhum com sinalização em PEP/Listas, MPT ou Offshores.'
    ], false);
    return;
  }

  var porEmpresa = {};
  var ordem = [];
  sinalizados.forEach(function (item) {
    var chave = item.nome + '|' + item.cnpj;
    if (!porEmpresa[chave]) {
      porEmpresa[chave] = { nome: item.nome, cnpj: item.cnpj, vinculos: [] };
      ordem.push(chave);
    }
    var rotulo = item.socio || '';
    if (item.relacao) rotulo += (rotulo ? ' — ' : '') + item.relacao;
    if (rotulo) porEmpresa[chave].vinculos.push(rotulo);
  });

  var empresas = ordem.map(function (chave) { return porEmpresa[chave]; });
  empresas.sort(function (a, b) { return b.vinculos.length - a.vinculos.length; });

  var resumo = 'Total de vínculos mapeados: ' + rel.total +
    ' | com sinalização em PEP/Listas, MPT ou Offshores: ' + rel.comApontamento + '.';
  var paragrafoResumo = local.pai.insertParagraph(local.indice, resumo);
  paragrafoResumo.setAttributes(local.paragrafo.getAttributes());
  paragrafoResumo.editAsText().setItalic(true).setFontSize(9);
  local.indice += 1;

  var limite = 30;
  var tabela = [['Empresa', 'CNPJ', 'Vínculo']];
  empresas.slice(0, limite).forEach(function (emp) {
    tabela.push([emp.nome, emp.cnpj || '-', emp.vinculos.join('; ')]);
  });

  if (empresas.length > limite) {
    tabela.push(['... e mais ' + (empresas.length - limite) +
      ' empresas sinalizadas. Relação completa na aba "' + ABAS.EMPRESAS_RELACIONADAS + '".', '', '']);
  }

  _substituirPorTabela(local, tabela);
}

/** Ocorrências no Portal da Transparência. */
function _blocoTransparencia(corpo, dados) {
  var local = _localizarBloco(corpo, '<<BLOCO_TRANSPARENCIA>>');
  if (!local) return;

  var itens = (dados.transparencia && dados.transparencia.itens) || [];
  if (itens.length === 0) {
    _substituirPorParagrafos(local, ['Nenhuma ocorrência no Portal da Transparência.'], false);
    return;
  }

  var limite = 15;
  var linhas = itens.slice(0, limite).map(function (item) { return item.titulo; });
  if (itens.length > limite) {
    linhas.push('... e mais ' + (itens.length - limite) + ' ocorrências.');
  }

  _substituirPorLista(local, linhas);
}

/** Troca o parágrafo do marcador por parágrafos simples. */
function _substituirPorParagrafos(local, linhas, destacar) {
  var referencia = local.paragrafo;
  var atributosParagrafo = referencia.getAttributes();
  var atributosTexto = referencia.editAsText().getAttributes(0);

  linhas.forEach(function (linha, i) {
    var novo = local.pai.insertParagraph(local.indice + i, _naoVazio(linha));
    novo.setAttributes(atributosParagrafo);
    novo.editAsText().setAttributes(atributosTexto);
    if (destacar && linha) {
      novo.editAsText().setBackgroundColor('#fff2cc').setBold(true);
    }
  });

  _removerParagrafoSeguro(referencia);
}

/** Troca o parágrafo do marcador por uma lista com marcadores. */
function _substituirPorLista(local, linhas) {
  var referencia = local.paragrafo;

  linhas.forEach(function (linha, i) {
    var item = local.pai.insertListItem(local.indice + i, _naoVazio(linha));
    item.setGlyphType(DocumentApp.GlyphType.BULLET);
    if (linha) item.editAsText().setFontSize(10);
  });

  _removerParagrafoSeguro(referencia);
}

/**
 * Troca o parágrafo do marcador por uma tabela.
 * A primeira linha da matriz é tratada como cabeçalho.
 */
function _substituirPorTabela(local, matriz) {
  var referencia = local.paragrafo;

  // insertTable só existe no corpo do documento, não dentro de células.
  if (typeof local.pai.insertTable !== 'function') {
    _substituirPorLista(local, matriz.slice(1).map(function (linha) {
      return linha.join(' | ');
    }));
    return;
  }

  var matrizSegura = matriz.map(function (linha) {
    return linha.map(_naoVazio);
  });
  var tabela = local.pai.insertTable(local.indice, matrizSegura);

  var estiloCorpo = {};
  estiloCorpo[DocumentApp.Attribute.FONT_SIZE] = 8;
  estiloCorpo[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';

  for (var l = 0; l < tabela.getNumRows(); l++) {
    var linha = tabela.getRow(l);
    for (var c = 0; c < linha.getNumCells(); c++) {
      var celula = linha.getCell(c);
      celula.setAttributes(estiloCorpo);
      if (l === 0) {
        celula.setBackgroundColor('#efefef');
        celula.editAsText().setBold(true);
      }
    }
  }

  _removerParagrafoSeguro(referencia);
}

/**
 * Acrescenta ao final do documento um checklist do que precisa de revisão
 * humana, para que o rascunho não seja assinado com lacunas despercebidas.
 */
function _inserirChecklist(corpo, dados, pendencias) {
  var local = _localizarBloco(corpo, '<<BLOCO_CHECKLIST>>');

  var linhas = [];

  if (pendencias.length > 0) {
    linhas.push('Campos que precisam de preenchimento manual:');
    pendencias.forEach(function (p) { linhas.push('   • ' + p); });
  }

  if (dados.alertas && dados.alertas.length > 0) {
    linhas.push('Avisos de leitura da planilha:');
    dados.alertas.forEach(function (a) { linhas.push('   • ' + a); });
  }

  // "Em andamento" conta só os em tramitação; os demais não encerrados
  // precisam de decisão de quem revisa.
  var outros = (dados.processos.naoEncerrados || 0) - (dados.processos.emAndamento || 0);
  if (outros > 0) {
    linhas.push('Atenção: além dos ' + dados.processos.emAndamento +
      ' processos em tramitação, há ' + outros +
      ' suspenso(s) ou em grau de recurso, que não entram na contagem de ' +
      '"em andamento". Estão na tabela de apoio com a situação indicada — ' +
      'confirme se devem constar do parecer.');
  }

  linhas.push('Seções de análise jurídica a redigir: destaque de processos, ' +
    'mídias negativas, conclusão e recomendações.');
  linhas.push('Rascunho gerado em ' +
    Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm") +
    ' a partir da planilha "' + dados.nomePlanilha + '".');

  if (local) {
    _substituirPorParagrafos(local, linhas, false);
    return;
  }

  // Modelo sem o marcador: acrescenta a seção ao final.
  corpo.appendParagraph('').appendHorizontalRule();
  corpo.appendParagraph('Checklist de revisão (remover antes de finalizar)')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  linhas.forEach(function (linha) {
    corpo.appendParagraph(linha).setFontSize(9);
  });
}

/** Apaga qualquer marcador que tenha sobrado, já com as pendências registradas. */
function _limparMarcadoresRestantes(corpo) {
  corpo.replaceText('\\{\\{[A-Z_0-9]+\\}\\}', '');
  corpo.replaceText('<<[A-Z_0-9]+>>', '');
}

/**
 * Aponta marcadores do modelo que o código não conhece. O marcador do
 * checklist é ignorado porque ainda não foi processado neste ponto.
 */
function _sinalizarMarcadoresOrfaos(corpo, pendencias) {
  var texto = corpo.getText();
  var orfaos = texto.match(/\{\{[A-Z_0-9]+\}\}|<<[A-Z_0-9]+>>/g);
  if (!orfaos) return;

  var unicos = orfaos.filter(function (item, i) {
    return orfaos.indexOf(item) === i && item !== '<<BLOCO_CHECKLIST>>';
  });

  if (unicos.length === 0) return;

  pendencias.push('Marcadores do modelo sem correspondência no script: ' + unicos.join(', '));
}
