/**
 * Consultas à API do Portal da Transparência (CGU).
 *
 * Duas coisas que a planilha não entrega e esta API entrega, ambas por CNPJ:
 *
 *   1. O valor recebido de entes públicos — hoje digitado à mão, porque a
 *      coluna "Descrição" da aba do relatório vem vazia.
 *   2. As listas restritivas na fonte oficial — CEIS, CNEP, CEPIM e acordos
 *      de leniência. Hoje isso chega pela plataforma, cuja marcação de
 *      apontamentos é justamente a que está sob suspeita (100 de 100
 *      vínculos sinalizados na pesquisa da Azimute).
 *
 * Exige token gratuito, obtido por cadastro em
 * https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
 *
 * O token é credencial: fica em Propriedades do Script, nunca no código.
 * Editor do Apps Script > Configurações do projeto > Propriedades do script,
 * com a chave abaixo. Ou rode `definirTokenPortal('seu-token')` uma vez.
 */

var PORTAL_TRANSPARENCIA = {
  BASE: 'https://api.portaldatransparencia.gov.br/api-de-dados/',
  PROPRIEDADE_TOKEN: 'PORTAL_TRANSPARENCIA_TOKEN',

  // Nome do cabeçalho de autenticação. Se a CGU mudar, é aqui que se ajusta:
  // o diagnóstico devolve 401 de forma explícita quando está errado.
  CABECALHO_TOKEN: 'chave-api-dados',

  TIMEOUT_MS: 30000,
  CACHE_SEGUNDOS: 21600,

  // A API tem limite por minuto e responde 429 quando estourado. Uma pausa
  // curta entre chamadas de um mesmo lote evita queimar a cota à toa.
  PAUSA_ENTRE_CHAMADAS_MS: 400
};

/** Guarda o token nas propriedades do script. Rode uma vez, no editor. */
function definirTokenPortal(token) {
  var limpo = String(token || '').trim();
  if (!limpo) throw new Error('Informe o token: definirTokenPortal("seu-token").');

  PropertiesService.getScriptProperties()
    .setProperty(PORTAL_TRANSPARENCIA.PROPRIEDADE_TOKEN, limpo);

  return 'Token guardado. Rode testarPortalTransparencia() para conferir.';
}

function _tokenPortal() {
  return PropertiesService.getScriptProperties()
    .getProperty(PORTAL_TRANSPARENCIA.PROPRIEDADE_TOKEN) || '';
}

/**
 * Chamada genérica à API. Devolve sempre objeto simples — a geração do
 * parecer nunca pode cair porque um serviço externo oscilou.
 *
 * @param {string} caminho Trecho após /api-de-dados/, ex.: 'ceis'.
 * @param {Object} parametros Mapa de query string.
 * @return {{ok: boolean, erro: (string|undefined), dados: (Array|Object|undefined)}}
 */
function consultarPortal(caminho, parametros) {
  var token = _tokenPortal();
  if (!token) {
    return { ok: false, erro: 'Token do Portal da Transparência não configurado ' +
      '(rode definirTokenPortal no editor).', semToken: true };
  }

  var query = Object.keys(parametros || {})
    .filter(function (chave) {
      var v = parametros[chave];
      return v !== null && v !== undefined && String(v) !== '';
    })
    .map(function (chave) {
      return encodeURIComponent(chave) + '=' + encodeURIComponent(parametros[chave]);
    })
    .join('&');

  var url = PORTAL_TRANSPARENCIA.BASE + caminho + (query ? '?' + query : '');

  var cache = CacheService.getScriptCache();
  var chaveCache = 'portal-' + Utilities.base64EncodeWebSafe(url).substring(0, 200);
  var guardado = cache ? cache.get(chaveCache) : null;
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (erro) {
      // Cache inválido não impede a consulta.
    }
  }

  var cabecalhos = {};
  cabecalhos[PORTAL_TRANSPARENCIA.CABECALHO_TOKEN] = token;
  cabecalhos['Accept'] = 'application/json';

  var resposta;
  try {
    resposta = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: cabecalhos,
      muteHttpExceptions: true,
      validateHttpsCertificates: true
    });
  } catch (erro) {
    return { ok: false, erro: 'Falha de rede: ' +
      String(erro && erro.message ? erro.message : erro) };
  }

  var codigo = resposta.getResponseCode();
  var corpo = resposta.getContentText();

  if (codigo === 401 || codigo === 403) {
    return { ok: false, erro: 'Token recusado pela API (HTTP ' + codigo + '). ' +
      'Confira o token e o nome do cabeçalho em PORTAL_TRANSPARENCIA.CABECALHO_TOKEN.' };
  }
  if (codigo === 429) {
    return { ok: false, erro: 'Limite de requisições da API atingido (429). Tente mais tarde.' };
  }
  if (codigo !== 200) {
    return { ok: false, erro: 'API respondeu HTTP ' + codigo + ': ' + corpo.substring(0, 300) };
  }

  var dados;
  try {
    dados = JSON.parse(corpo);
  } catch (erro) {
    return { ok: false, erro: 'Resposta não é JSON válido.' };
  }

  var resultado = { ok: true, dados: dados };

  if (cache) {
    try {
      cache.put(chaveCache, JSON.stringify(resultado), PORTAL_TRANSPARENCIA.CACHE_SEGUNDOS);
    } catch (erro) {
      // Resposta grande demais para o cache; seguir sem cachear.
    }
  }

  return resultado;
}

/**
 * Diagnóstico: bate nos endpoints que interessam e mostra a resposta crua
 * nos registros de execução.
 *
 * É o passo que falta para escrever o parsing: os caminhos dos endpoints são
 * conhecidos, mas os nomes exatos dos parâmetros e dos campos de resposta
 * precisam ser vistos numa chamada real antes de virar código.
 *
 * Rode no editor do Apps Script e cole a saída de volta.
 */
function testarPortalTransparencia() {
  var cnpj = '04967284000140'; // Azimute Engenheiros Consultores

  if (!_tokenPortal()) {
    Logger.log('Token não configurado. Rode definirTokenPortal("seu-token") primeiro.');
    return;
  }

  // Cada entrada tenta um endpoint com o nome de parâmetro mais provável.
  // Erro aqui é informação: revela o nome certo na mensagem da API.
  var tentativas = [
    { rotulo: 'Recursos recebidos', caminho: 'despesas/recursos-recebidos',
      parametros: { codigoPessoa: cnpj, pagina: 1 } },
    { rotulo: 'Documentos por favorecido', caminho: 'despesas/documentos-por-favorecido',
      parametros: { codigoPessoa: cnpj, pagina: 1 } },
    { rotulo: 'CEIS (inidôneas e suspensas)', caminho: 'ceis',
      parametros: { codigoSancionado: cnpj, pagina: 1 } },
    { rotulo: 'CNEP (empresas punidas)', caminho: 'cnep',
      parametros: { codigoSancionado: cnpj, pagina: 1 } },
    { rotulo: 'CEPIM (impedidas)', caminho: 'cepim',
      parametros: { cnpjSancionado: cnpj, pagina: 1 } },
    { rotulo: 'Acordos de leniência', caminho: 'acordos-leniencia',
      parametros: { cnpjSancionada: cnpj, pagina: 1 } },
    { rotulo: 'Contratos por CNPJ', caminho: 'contratos/cpf-cnpj',
      parametros: { cpfCnpj: cnpj, pagina: 1 } }
  ];

  tentativas.forEach(function (t) {
    Logger.log('===== %s (%s) =====', t.rotulo, t.caminho);
    var r = consultarPortal(t.caminho, t.parametros);
    if (!r.ok) {
      Logger.log('ERRO: %s', r.erro);
    } else {
      var json = JSON.stringify(r.dados);
      Logger.log('itens: %s', Array.isArray(r.dados) ? r.dados.length : '(objeto)');
      Logger.log('%s', json.substring(0, 1200));
    }
    Utilities.sleep(PORTAL_TRANSPARENCIA.PAUSA_ENTRE_CHAMADAS_MS);
  });

  Logger.log('===== fim =====');
}
