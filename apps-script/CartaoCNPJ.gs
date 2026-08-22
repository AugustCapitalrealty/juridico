/**
 * Consulta ao cartão CNPJ pela BrasilAPI.
 *
 * Existe para resolver o maior bloco de digitação manual que sobrava: os
 * CNAEs secundários, que não vêm no relatório da plataforma e hoje são
 * copiados à mão do cartão CNPJ (17 linhas no caso Azimute).
 *
 * A consulta nunca derruba a geração: falha de rede, CNPJ não encontrado ou
 * resposta em formato inesperado viram alerta no checklist e o campo volta a
 * ser preenchido à mão.
 *
 * Endpoint: https://brasilapi.com.br/api/cnpj/v1/{cnpj} (fonte: Minha Receita)
 * Documentação: https://brasilapi.com.br/docs
 *
 * Campos usados, conforme o contrato publicado:
 *   cnae_fiscal                 número  (9430800 — sem o zero à esquerda)
 *   cnae_fiscal_descricao       texto
 *   cnaes_secundarios           [{codigo, descricao}]
 *   codigo_natureza_juridica    número  (3999)
 *   natureza_juridica           texto
 *   descricao_situacao_cadastral texto  ("ATIVA")
 *
 * O payload traz bem mais (endereço, qsa, capital social, regime tributário);
 * só puxamos o que falta no relatório da plataforma, para não criar duas
 * fontes de verdade concorrentes para o mesmo dado.
 */

var BRASIL_API = {
  URL: 'https://brasilapi.com.br/api/cnpj/v1/',
  TIMEOUT_MS: 20000,
  CACHE_SEGUNDOS: 21600 // 6 horas: o cartão CNPJ não muda dentro de uma sessão de trabalho
};

/**
 * Busca o cartão CNPJ e devolve os campos que interessam ao parecer.
 *
 * @param {string} cnpj Com ou sem máscara.
 * @return {{ok: boolean, erro: (string|undefined), cnaesSecundarios: string[],
 *           cnaePrincipal: string, naturezaJuridica: string, razaoSocial: string,
 *           nomeFantasia: string, situacao: string}}
 */
function consultarCartaoCNPJ(cnpj) {
  // Tira só a formatação (pontos, barra, hífen, espaço) em vez de tudo que
  // não for dígito: o CNPJ alfanumérico já é aceito pela API, e um
  // replace(/\D/g) mutilaria as letras silenciosamente.
  var digitos = String(cnpj === null || cnpj === undefined ? '' : cnpj)
    .replace(/[.\-\/\s]/g, '')
    .toUpperCase();

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(digitos)) {
    return { ok: false, erro: 'CNPJ inválido para consulta: "' + cnpj + '".' };
  }

  var cache = CacheService.getScriptCache();
  var chave = 'cartao-cnpj-' + digitos;
  var guardado = cache ? cache.get(chave) : null;
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (erro) {
      // Cache corrompido não pode impedir a consulta: segue para a rede.
    }
  }

  var resultado = _buscarCartaoCNPJ(digitos);

  // Só vale guardar sucesso — erro de rede costuma ser transitório.
  if (resultado.ok && cache) {
    try {
      cache.put(chave, JSON.stringify(resultado), BRASIL_API.CACHE_SEGUNDOS);
    } catch (erro) {
      // Estourou o limite de tamanho do cache; seguir sem cachear.
    }
  }

  return resultado;
}

/** Chamada de rede propriamente dita, isolada para manter consultarCartaoCNPJ legível. */
function _buscarCartaoCNPJ(digitos) {
  var resposta;

  try {
    resposta = UrlFetchApp.fetch(BRASIL_API.URL + digitos, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true
    });
  } catch (erro) {
    return { ok: false, erro: 'Falha de rede ao consultar o cartão CNPJ: ' +
      String(erro && erro.message ? erro.message : erro) };
  }

  var codigo = resposta.getResponseCode();

  if (codigo === 400) {
    return { ok: false, erro: 'CNPJ ' + formatarCNPJ(digitos) + ' recusado como mal formatado pela BrasilAPI.' };
  }
  if (codigo === 404) {
    return { ok: false, erro: 'CNPJ ' + formatarCNPJ(digitos) + ' não encontrado na base da Receita.' };
  }
  if (codigo === 429) {
    return { ok: false, erro: 'BrasilAPI recusou por excesso de consultas (429). Tente de novo em alguns minutos.' };
  }
  if (codigo !== 200) {
    return { ok: false, erro: 'BrasilAPI respondeu HTTP ' + codigo + '.' };
  }

  var payload;
  try {
    payload = JSON.parse(resposta.getContentText());
  } catch (erro) {
    return { ok: false, erro: 'Resposta da BrasilAPI não é JSON válido.' };
  }

  return _mapearCartaoCNPJ(payload);
}

/**
 * Traduz o payload da API para o que o parecer usa.
 *
 * Aceita variação de nomenclatura entre versões da API: cada campo é buscado
 * numa lista de nomes possíveis, então uma renomeação no upstream degrada
 * para campo vazio em vez de quebrar a geração.
 */
function _mapearCartaoCNPJ(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, erro: 'Resposta da BrasilAPI em formato inesperado.' };
  }

  var pegar = function (nomes) {
    for (var i = 0; i < nomes.length; i++) {
      var valor = payload[nomes[i]];
      if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
        return String(valor).trim();
      }
    }
    return '';
  };

  var secundarios = payload.cnaes_secundarios || payload.cnaesSecundarios || [];
  if (!Array.isArray(secundarios)) secundarios = [];

  var listaSecundarios = secundarios
    .map(function (item) {
      if (!item || typeof item !== 'object') return '';
      var codigo = formatarCNAE(item.codigo !== undefined ? item.codigo : item.code);
      var descricao = String(item.descricao || item.description || '').trim();
      if (!codigo && !descricao) return '';
      return codigo && descricao ? codigo + ' - ' + descricao : (codigo || descricao);
    })
    .filter(function (linha) { return linha.length > 0; });

  // A API entrega "00" quando a empresa não tem CNAE secundário; não é dado real.
  listaSecundarios = listaSecundarios.filter(function (linha) {
    return linha.indexOf('00.00-0-00') !== 0;
  });

  var cnaePrincipalCodigo = formatarCNAE(pegar(['cnae_fiscal', 'cnaeFiscal']));
  var cnaePrincipalDesc = pegar(['cnae_fiscal_descricao', 'cnaeFiscalDescricao']);

  var naturezaCodigo = pegar(['codigo_natureza_juridica', 'codigoNaturezaJuridica']);
  var naturezaDesc = pegar(['natureza_juridica', 'naturezaJuridica']);

  return {
    ok: true,
    cnaesSecundarios: listaSecundarios,
    cnaePrincipal: cnaePrincipalCodigo && cnaePrincipalDesc
      ? cnaePrincipalCodigo + ' - ' + cnaePrincipalDesc
      : (cnaePrincipalDesc || cnaePrincipalCodigo),
    naturezaJuridica: naturezaCodigo && naturezaDesc
      ? naturezaCodigo + ' - ' + naturezaDesc
      : (naturezaDesc || naturezaCodigo),
    razaoSocial: pegar(['razao_social', 'razaoSocial', 'nome']),
    nomeFantasia: pegar(['nome_fantasia', 'nomeFantasia', 'fantasia']),
    situacao: pegar(['descricao_situacao_cadastral', 'descricaoSituacaoCadastral', 'situacao'])
  };
}

/**
 * Formata o código do CNAE no padrão usado no parecer: 0230600 -> 02.30-6-00.
 *
 * A API devolve número, então o zero à esquerda se perde (230600); o padding
 * para 7 dígitos é o que devolve "02.30-6-00" em vez de "23.06-0-0".
 */
function formatarCNAE(codigo) {
  var d = String(codigo === null || codigo === undefined ? '' : codigo).replace(/\D/g, '');
  if (!d) return '';

  while (d.length < 7) d = '0' + d;
  if (d.length !== 7) return String(codigo);

  return d.substring(0, 2) + '.' + d.substring(2, 4) + '-' + d.substring(4, 5) + '-' + d.substring(5);
}

/**
 * Completa os campos manuais com o cartão CNPJ, sem sobrescrever nada que a
 * equipe tenha digitado: o que veio do formulário sempre vence.
 *
 * @param {Object} dados Saída de lerPlanilhaPesquisa().
 * @param {Object} manuais Campos do formulário (alterado no lugar).
 * @param {string[]} alertas Lista de avisos que vai para o checklist.
 */
function enriquecerComCartaoCNPJ(dados, manuais, alertas) {
  if (manuais.CNAE_SECUNDARIO && manuais.CNAE_SECUNDARIO.trim()) return;

  var cartao = consultarCartaoCNPJ(dados.cnpj);

  if (!cartao.ok) {
    alertas.push('CNAEs secundários não preenchidos automaticamente: ' + cartao.erro +
      ' Copie do cartão CNPJ da Receita Federal.');
    return;
  }

  if (cartao.cnaesSecundarios.length === 0) {
    dados.cnaeSecundarioAutomatico = true;
    manuais.CNAE_SECUNDARIO = 'Não constam CNAEs secundários no cartão CNPJ.';
    return;
  }

  dados.cnaeSecundarioAutomatico = true;
  manuais.CNAE_SECUNDARIO = cartao.cnaesSecundarios.join('\n');
  alertas.push('CNAEs secundários (' + cartao.cnaesSecundarios.length +
    ') preenchidos automaticamente pelo cartão CNPJ da BrasilAPI — confira antes de finalizar.');
}

/**
 * Diagnóstico: rode no editor do Apps Script e veja o resultado em
 * "Registros de execução". Serve para conferir o formato da resposta da API
 * sem gerar documento nenhum.
 */
function testarCartaoCNPJ() {
  var cnpj = '04967284000140'; // Azimute Engenheiros Consultores

  var bruto = UrlFetchApp.fetch(BRASIL_API.URL + cnpj, { muteHttpExceptions: true });
  Logger.log('HTTP %s', bruto.getResponseCode());
  Logger.log('Resposta crua: %s', bruto.getContentText().substring(0, 1500));

  var cartao = consultarCartaoCNPJ(cnpj);
  Logger.log('--- Mapeado ---');
  Logger.log('ok: %s', cartao.ok);
  if (!cartao.ok) {
    Logger.log('erro: %s', cartao.erro);
    return;
  }
  Logger.log('Razão social: %s', cartao.razaoSocial);
  Logger.log('Situação: %s', cartao.situacao);
  Logger.log('CNAE principal: %s', cartao.cnaePrincipal);
  Logger.log('Natureza jurídica: %s', cartao.naturezaJuridica);
  Logger.log('CNAEs secundários (%s):', cartao.cnaesSecundarios.length);
  cartao.cnaesSecundarios.forEach(function (linha) { Logger.log('   %s', linha); });
}
