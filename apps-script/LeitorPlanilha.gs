/**
 * Leitura da planilha de pesquisa (relatório da plataforma) e consolidação
 * dos dados em um único objeto usado para preencher o rascunho.
 *
 * Toda leitura é defensiva: aba ausente ou coluna renomeada produz campo
 * vazio e um alerta, nunca uma exceção — o rascunho é gerado mesmo assim,
 * com os buracos visíveis para quem for revisar.
 */

/** Devolve a aba pelo nome, ou null se não existir. */
function _aba(planilha, nome) {
  return planilha.getSheetByName(nome);
}

/** Matriz de valores da aba, ou [] se a aba não existir / estiver vazia. */
function _valores(planilha, nome) {
  var aba = _aba(planilha, nome);
  if (!aba) return [];
  var intervalo = aba.getDataRange();
  return intervalo ? intervalo.getValues() : [];
}

/**
 * Constrói um mapa rótulo -> valor para abas em que o rótulo fica na linha
 * imediatamente acima do valor (layout da aba "Capa").
 */
function _mapaRotuloValor(matriz) {
  var mapa = {};
  for (var l = 0; l < matriz.length - 1; l++) {
    for (var c = 0; c < matriz[l].length; c++) {
      var rotulo = normalizar(matriz[l][c]);
      if (!rotulo) continue;
      if (mapa[rotulo] === undefined) {
        mapa[rotulo] = matriz[l + 1][c];
      }
    }
  }
  return mapa;
}

/** Índice da coluna cujo cabeçalho corresponde a um dos nomes aceitos. */
function _indiceColuna(cabecalho, nomesAceitos) {
  var alvos = nomesAceitos.map(normalizar);
  for (var c = 0; c < cabecalho.length; c++) {
    if (alvos.indexOf(normalizar(cabecalho[c])) >= 0) return c;
  }
  return -1;
}

/** Linhas de dados de uma aba tabular simples (primeira linha = cabeçalho). */
function _linhasDados(matriz) {
  if (matriz.length < 2) return [];
  return matriz.slice(1).filter(function (linha) {
    return linha.some(function (celula) { return !vazio(celula); });
  });
}

/**
 * Lê a planilha inteira e devolve o objeto de dados consolidado.
 * @param {string} idPlanilha ID da planilha de pesquisa.
 * @return {Object} dados + lista de alertas encontrados na leitura.
 */
function lerPlanilhaPesquisa(idPlanilha) {
  var planilha = SpreadsheetApp.openById(idPlanilha);
  var alertas = [];

  var dados = {
    alertas: alertas,
    nomePlanilha: planilha.getName()
  };

  _lerIdentificacao(planilha, dados, alertas);
  _lerProcessos(planilha, dados, alertas);
  _lerRestricoes(planilha, dados, alertas);
  _lerRelacionamentos(planilha, dados, alertas);
  _lerContatos(planilha, dados);
  _lerFontesPublicas(planilha, dados);

  return dados;
}

/** Identificação da empresa: Receita Federal, Dados Pessoais, Capa, Perfil. */
function _lerIdentificacao(planilha, dados, alertas) {
  var receita = _valores(planilha, ABAS.RECEITA_FEDERAL);
  if (receita.length >= 2) {
    var cab = receita[0];
    var lin = receita[1];
    var pegar = function (nomes) {
      var i = _indiceColuna(cab, nomes);
      return i >= 0 ? lin[i] : '';
    };
    dados.razaoSocial = String(pegar(['Razão social', 'Razao social']) || '');
    dados.cnpj = formatarCNPJ(pegar(['CNPJ']));
    dados.capitalSocial = paraNumero(pegar(['Capital social']));
    dados.dataAbertura = formatarData(pegar(['Data de abertura']));
    dados.porte = String(pegar(['Porte']) || '');
    dados.cnaePrincipal = String(pegar(['Atividade econômica', 'Atividade economica']) || '');
    dados.naturezaJuridica = String(pegar(['Natureza juridica', 'Natureza jurídica']) || '');
    dados.endereco = String(pegar(['Endereço na Receita Federal', 'Endereco na Receita Federal']) || '');
  } else {
    alertas.push('Aba "' + ABAS.RECEITA_FEDERAL + '" não encontrada ou vazia.');
  }

  var pessoais = _valores(planilha, ABAS.DADOS_PESSOAIS);
  if (pessoais.length >= 2) {
    var cabP = pessoais[0];
    var linP = pessoais[1];
    var iFantasia = _indiceColuna(cabP, ['Nome fantasia']);
    if (iFantasia >= 0) dados.nomeFantasia = String(linP[iFantasia] || '');
    if (!dados.razaoSocial) {
      var iRazao = _indiceColuna(cabP, ['Razão Social', 'Razao Social']);
      if (iRazao >= 0) dados.razaoSocial = String(linP[iRazao] || '');
    }
  }
  if (!dados.nomeFantasia) dados.nomeFantasia = dados.razaoSocial || '';

  var capa = _mapaRotuloValor(_valores(planilha, ABAS.CAPA));
  dados.idadeEmpresa = String(capa[normalizar('Idade da Empresa')] || '');
  dados.riscoReputacional = String(capa[normalizar('Risco Reputacional')] || '');
  dados.riscoJuridico = String(capa[normalizar('Risco Jurídico (Documento)')] || '');
  dados.riscoCredito = String(capa[normalizar('Risco Crédito')] || '');
  dados.pepMidias = String(capa[normalizar('PEP/Mídias Negativas')] || '');
  dados.apontamentosJudiciais = String(capa[normalizar('Apontamentos Judiciais')] || '');
  dados.apontamentosFinanceiros = String(capa[normalizar('Apontamentos Financeiros')] || '');
  if (!dados.dataAbertura) dados.dataAbertura = formatarData(capa[normalizar('Data da Fundação')]);

  var perfil = _valores(planilha, ABAS.PERFIL);
  if (perfil.length >= 2) {
    var cabF = perfil[0];
    var linF = perfil[1];
    var pegarF = function (nomes) {
      var i = _indiceColuna(cabF, nomes);
      return i >= 0 ? linF[i] : '';
    };
    dados.faturamentoPresumido = paraNumero(pegarF(['Faturamento anual presumido']));
    dados.qtdFuncionarios = String(pegarF(['Qtd. Funcionarios', 'Qtd. Funcionários']) || '');
    if (!dados.porte) dados.porte = String(pegarF(['Porte']) || '');
    if (!dados.capitalSocial) dados.capitalSocial = paraNumero(pegarF(['Capital Social']));
  }
  if (!dados.faturamentoPresumido) {
    dados.faturamentoPresumido = paraNumero(capa[normalizar('Faturamento Anual via Bureau')]);
  }
}

/**
 * Estatísticas processuais a partir da aba "Processos (DOCUMENTO)".
 * Aqui está o maior ganho da automação: totais, processos em andamento e
 * valores de exposição por polo, hoje somados à mão.
 */
function _lerProcessos(planilha, dados, alertas) {
  var matriz = _valores(planilha, ABAS.PROCESSOS_DOC);
  dados.processos = {
    total: 0,
    emAndamento: 0,
    naoEncerrados: 0,
    valorReu: 0,
    valorAutor: 0,
    listaEmAndamento: [],
    porStatus: {}
  };

  if (matriz.length < 2) {
    alertas.push('Aba "' + ABAS.PROCESSOS_DOC + '" não encontrada ou sem processos.');
    return;
  }

  var cab = matriz[0];
  var iPolo = _indiceColuna(cab, ['Polo']);
  var iValor = _indiceColuna(cab, ['Valor da Causa']);
  var iStatus = _indiceColuna(cab, ['Status']);
  var iNumero = _indiceColuna(cab, ['N° Processo', 'Nº Processo', 'N Processo']);
  var iTribunal = _indiceColuna(cab, ['Tribunal']);
  var iAssuntos = _indiceColuna(cab, ['Assuntos']);
  var iRamo = _indiceColuna(cab, ['Ramo de Direito']);
  var iClasse = _indiceColuna(cab, ['Classe Processual']);
  var iDistribuicao = _indiceColuna(cab, ['Data de Distribuição', 'Data de Distribuicao']);
  var iOrgao = _indiceColuna(cab, ['Órgão Julgador', 'Orgao Julgador']);

  if (iPolo < 0 || iValor < 0 || iStatus < 0) {
    alertas.push('Colunas Polo / Valor da Causa / Status não localizadas em "' +
      ABAS.PROCESSOS_DOC + '". Valores de exposição não foram calculados.');
  }

  // "Em andamento" segue a prática adotada nos pareceres da área: conta
  // apenas os processos em tramitação. Suspensos e em grau de recurso não
  // entram nesse número, mas aparecem na tabela de apoio com o status
  // visível e são apontados no checklist, para decisão de quem revisa.
  var EM_ANDAMENTO = ['em tramitacao'];
  var NAO_ENCERRADOS = ['em tramitacao', 'suspenso', 'em grau de recurso'];

  var linhas = _linhasDados(matriz);
  dados.processos.total = linhas.length;

  linhas.forEach(function (linha) {
    var polo = normalizar(iPolo >= 0 ? linha[iPolo] : '');
    var status = String(iStatus >= 0 ? linha[iStatus] : '').trim();
    var valor = paraNumero(iValor >= 0 ? linha[iValor] : 0);

    if (polo === 'passivo') dados.processos.valorReu += valor;
    else if (polo === 'ativo') dados.processos.valorAutor += valor;

    var chaveStatus = status || 'NÃO INFORMADO';
    dados.processos.porStatus[chaveStatus] = (dados.processos.porStatus[chaveStatus] || 0) + 1;

    var statusNormalizado = normalizar(status);
    if (EM_ANDAMENTO.indexOf(statusNormalizado) >= 0) dados.processos.emAndamento++;

    if (NAO_ENCERRADOS.indexOf(statusNormalizado) >= 0) {
      dados.processos.naoEncerrados++;
      dados.processos.listaEmAndamento.push({
        numero: String(iNumero >= 0 ? linha[iNumero] : '') || '(sem número)',
        tribunal: String(iTribunal >= 0 ? linha[iTribunal] : ''),
        polo: String(iPolo >= 0 ? linha[iPolo] : ''),
        status: status,
        valor: valor,
        classe: String(iClasse >= 0 ? linha[iClasse] : ''),
        assuntos: String(iAssuntos >= 0 ? linha[iAssuntos] : ''),
        ramo: String(iRamo >= 0 ? linha[iRamo] : ''),
        distribuicao: formatarData(iDistribuicao >= 0 ? linha[iDistribuicao] : ''),
        orgao: String(iOrgao >= 0 ? linha[iOrgao] : '')
      });
    }
  });

  // Ordena do maior valor para o menor: o que mais pesa aparece primeiro.
  dados.processos.listaEmAndamento.sort(function (a, b) { return b.valor - a.valor; });

  dados.processosResumo = _lerResumoProcessos(planilha);

  var porNome = _valores(planilha, ABAS.PROCESSOS_NOME);
  dados.processosPorNome = porNome.length >= 2 ? _linhasDados(porNome).length : 0;
}

/** Colunas de contagem por tribunal e por ano da aba "Processos Resumo". */
function _lerResumoProcessos(planilha) {
  var matriz = _valores(planilha, ABAS.PROCESSOS_RESUMO);
  var resumo = { estaduais: [], federais: [], trabalhistas: [], superiores: [], porAno: [] };
  if (matriz.length < 2) return resumo;

  var cab = matriz[0];
  var colunas = [
    { chave: 'estaduais', nomes: ['Estaduais'] },
    { chave: 'federais', nomes: ['Federais'] },
    { chave: 'trabalhistas', nomes: ['Trabalhistas'] },
    { chave: 'superiores', nomes: ['Superiores'] },
    { chave: 'porAno', nomes: ['Processos por Ano'] }
  ];

  colunas.forEach(function (coluna) {
    var i = _indiceColuna(cab, coluna.nomes);
    if (i < 0) return;
    for (var l = 1; l < matriz.length; l++) {
      if (!vazio(matriz[l][i])) resumo[coluna.chave].push(String(matriz[l][i]).trim());
    }
  });

  return resumo;
}

/** Protestos, Serasa, Boa Vista e demais restritivos financeiros. */
function _lerRestricoes(planilha, dados, alertas) {
  var protestos = _valores(planilha, ABAS.PROTESTOS);
  dados.protestos = { quantidade: 0, itens: [], total: 0 };
  if (protestos.length >= 2) {
    var cab = protestos[0];
    var iTitulo = _indiceColuna(cab, ['Título', 'Titulo', 'Valor']);
    var iCartorio = _indiceColuna(cab, ['Cartório', 'Cartorio']);
    var iUF = _indiceColuna(cab, ['UF']);
    _linhasDados(protestos).forEach(function (linha) {
      var valor = iTitulo >= 0 ? linha[iTitulo] : '';
      var cartorio = iCartorio >= 0 ? String(linha[iCartorio]) : '';
      var uf = iUF >= 0 ? String(linha[iUF]) : '';
      dados.protestos.itens.push({
        valor: formatarBRL(valor),
        cartorio: _capitalizarCartorio(cartorio),
        uf: uf,
        descricao: formatarBRL(valor) + ' - ' + _capitalizarCartorio(cartorio) + (uf ? ' - ' + uf : '')
      });
      dados.protestos.total += paraNumero(valor);
    });
    dados.protestos.quantidade = dados.protestos.itens.length;
  }

  var score = _valores(planilha, ABAS.SERASA_SCORE);
  dados.serasaScoreTexto = '';
  if (score.length >= 2) {
    var iRisco = _indiceColuna(score[0], ['Risco']);
    if (iRisco >= 0) dados.serasaScoreTexto = String(score[1][iRisco] || '').trim();
  }

  // Serasa SPC traz apenas cabeçalhos de seção quando não há pendência.
  var spc = _valores(planilha, ABAS.SERASA_SPC);
  dados.serasaPendencias = _contarPendenciasPorSecao(spc);
  dados.serasaResultado = dados.serasaPendencias > 0
    ? pluralizar(dados.serasaPendencias, 'pendência', 'pendências') + ' encontrada(s)'
    : 'Nada Consta';

  var boaVista = _valores(planilha, ABAS.BOA_VISTA);
  dados.boaVistaPendencias = _contarPendenciasPorSecao(boaVista);
  dados.boaVistaResultado = dados.boaVistaPendencias > 0
    ? pluralizar(dados.boaVistaPendencias, 'ocorrência', 'ocorrências') + ' encontrada(s)'
    : 'Nada Consta';
}

/**
 * Conta linhas de dado em abas organizadas em seções (título da seção,
 * cabeçalho, depois zero ou mais linhas). Uma linha só conta como dado se
 * a primeira célula estiver preenchida e não for título nem cabeçalho.
 */
function _contarPendenciasPorSecao(matriz) {
  if (!matriz || matriz.length === 0) return 0;

  var cabecalhosConhecidos = ['dt. vencimento', 'dt. inclusao', 'dt. ocorrencia', 'num. banco'];
  var total = 0;

  for (var l = 0; l < matriz.length; l++) {
    var linha = matriz[l];
    var primeira = normalizar(linha[0]);
    if (!primeira) continue;

    // Título de seção: só a primeira célula preenchida.
    var demaisPreenchidas = linha.slice(1).some(function (c) { return !vazio(c); });
    if (!demaisPreenchidas) continue;

    if (cabecalhosConhecidos.indexOf(primeira) >= 0) continue;

    total++;
  }

  return total;
}

/** "TABELIONATO DE NOTAS..." -> "Tabelionato de Notas...". */
function _capitalizarCartorio(texto) {
  var s = String(texto || '').trim();
  if (!s) return '';
  var minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return s.toLowerCase().split(/\s+/).map(function (palavra, i) {
    if (i > 0 && minusculas.indexOf(palavra) >= 0) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.substring(1);
  }).join(' ');
}

/** QSA, participações, filiais e empresas relacionadas. */
function _lerRelacionamentos(planilha, dados, alertas) {
  dados.socios = _lerQSA(planilha);

  var participacoes = _valores(planilha, ABAS.PARTICIPACOES);
  dados.participacoes = [];
  if (participacoes.length >= 2) {
    var cabP = participacoes[0];
    var iCnpj = _indiceColuna(cabP, ['CNPJ']);
    var iNome = _indiceColuna(cabP, ['Nome']);
    _linhasDados(participacoes).forEach(function (linha) {
      dados.participacoes.push({
        cnpj: formatarDocumento(iCnpj >= 0 ? linha[iCnpj] : ''),
        nome: String(iNome >= 0 ? linha[iNome] : '').trim()
      });
    });
  }
  dados.qtdParticipacoes = dados.participacoes.length;

  var filiais = _valores(planilha, ABAS.FILIAIS);
  dados.qtdFiliais = filiais.length >= 2 ? _linhasDados(filiais).length : 0;

  var relacionadas = _valores(planilha, ABAS.EMPRESAS_RELACIONADAS);
  dados.empresasRelacionadas = { total: 0, comApontamento: 0, itens: [] };
  if (relacionadas.length >= 2) {
    var cabR = relacionadas[0];
    var iCnpjR = _indiceColuna(cabR, ['CNPJ']);
    var iNomeR = _indiceColuna(cabR, ['Nome']);
    var iSocio = _indiceColuna(cabR, ['Sócio', 'Socio']);
    var iRelacao = _indiceColuna(cabR, ['Relação', 'Relacao']);
    var iPep = _indiceColuna(cabR, ['PEP/Listas']);
    var iMpt = _indiceColuna(cabR, ['MPTs']);
    var iOff = _indiceColuna(cabR, ['Offshores']);

    _linhasDados(relacionadas).forEach(function (linha) {
      var marcado = [iPep, iMpt, iOff].some(function (i) {
        return i >= 0 && normalizar(linha[i]) === 'consta';
      });
      dados.empresasRelacionadas.total++;
      if (marcado) dados.empresasRelacionadas.comApontamento++;
      dados.empresasRelacionadas.itens.push({
        cnpj: formatarDocumento(iCnpjR >= 0 ? linha[iCnpjR] : ''),
        nome: String(iNomeR >= 0 ? linha[iNomeR] : '').trim(),
        socio: String(iSocio >= 0 ? linha[iSocio] : '').trim(),
        relacao: String(iRelacao >= 0 ? linha[iRelacao] : '').trim(),
        apontamento: marcado
      });
    });
  }
}

/** Sócios e administradores, separando quadro atual de histórico. */
function _lerQSA(planilha) {
  var matriz = _valores(planilha, ABAS.QSA);
  var socios = [];
  if (matriz.length === 0) return socios;

  var secao = 'Ativo';
  var cab = null;

  for (var l = 0; l < matriz.length; l++) {
    var linha = matriz[l];
    var primeira = normalizar(linha[0]);
    if (!primeira) continue;

    if (primeira === 'ativos') { secao = 'Ativo'; continue; }
    if (primeira === 'historicos') { secao = 'Histórico'; continue; }
    if (primeira === 'cpf' || primeira === 'cnpj' || primeira === 'documento') {
      cab = linha;
      continue;
    }

    if (!cab) continue;

    var iNome = _indiceColuna(cab, ['Nome']);
    var iQualificacao = _indiceColuna(cab, ['Qualificação', 'Qualificacao']);
    var iPep = _indiceColuna(cab, ['PEP/Mídias', 'PEP/Midias']);

    socios.push({
      documento: formatarDocumento(linha[0]),
      nome: String(iNome >= 0 ? linha[iNome] : '').trim(),
      qualificacao: String(iQualificacao >= 0 ? linha[iQualificacao] : '').trim(),
      pep: String(iPep >= 0 ? linha[iPep] : '').trim(),
      secao: secao
    });
  }

  return socios;
}

/** Telefones e e-mails, priorizando os marcados como principais. */
function _lerContatos(planilha, dados) {
  dados.telefones = _lerContato(planilha, ABAS.TELEFONES, ['Telefone']);
  dados.emails = _lerContato(planilha, ABAS.EMAILS, ['E-mail', 'Email']);
}

function _lerContato(planilha, nomeAba, nomesColuna) {
  var matriz = _valores(planilha, nomeAba);
  var lista = [];
  if (matriz.length === 0) return lista;

  var secao = 'Ativo';
  var cab = null;

  for (var l = 0; l < matriz.length; l++) {
    var linha = matriz[l];
    var primeira = normalizar(linha[0]);
    if (!primeira) continue;

    if (primeira === 'ativos') { secao = 'Ativo'; continue; }
    if (primeira === 'historicos') { secao = 'Histórico'; continue; }

    if (_indiceColuna(linha, nomesColuna) === 0) { cab = linha; continue; }
    if (!cab) continue;

    var iPrincipal = _indiceColuna(cab, ['Principal?']);
    lista.push({
      valor: String(linha[0]).trim(),
      principal: iPrincipal >= 0 && normalizar(linha[iPrincipal]) === 'sim',
      secao: secao
    });
  }

  return lista;
}

/** Portal da Transparência, diários oficiais e buscadores. */
function _lerFontesPublicas(planilha, dados) {
  var transparencia = _valores(planilha, ABAS.TRANSPARENCIA);
  dados.transparencia = { quantidade: 0, itens: [] };
  if (transparencia.length >= 2) {
    var cab = transparencia[0];
    var iTitulo = _indiceColuna(cab, ['Titulo', 'Título']);
    var iUrl = _indiceColuna(cab, ['URL']);
    _linhasDados(transparencia).forEach(function (linha) {
      dados.transparencia.itens.push({
        titulo: String(iTitulo >= 0 ? linha[iTitulo] : '').trim(),
        url: String(iUrl >= 0 ? linha[iUrl] : '').trim()
      });
    });
    dados.transparencia.quantidade = dados.transparencia.itens.length;
  }

  var diarios = _valores(planilha, ABAS.DIARIOS);
  dados.qtdDiarios = diarios.length >= 2 ? _linhasDados(diarios).length : 0;

  var buscadores = _valores(planilha, ABAS.BUSCADORES);
  dados.buscadores = [];
  if (buscadores.length >= 2) {
    var cabB = buscadores[0];
    var iTit = _indiceColuna(cabB, ['Titulo', 'Título']);
    var iUrlB = _indiceColuna(cabB, ['URL']);
    _linhasDados(buscadores).forEach(function (linha) {
      dados.buscadores.push({
        titulo: String(iTit >= 0 ? linha[iTit] : '').trim(),
        url: String(iUrlB >= 0 ? linha[iUrlB] : '').trim()
      });
    });
  }

  var midias = _valores(planilha, ABAS.MIDIAS_IA);
  dados.qtdMidiasNegativas = midias.length >= 2 ? _linhasDados(midias).length : 0;
}
