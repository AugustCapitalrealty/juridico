/**
 * Configurações do gerador de rascunho de parecer reputacional.
 *
 * Preencha MODELO_DOC_ID e PASTA_DESTINO_ID uma única vez, após criar o
 * documento modelo e a pasta de destino no Drive.
 */

var CONFIG = {
  // ID do Google Docs que serve de modelo (contém os marcadores {{...}} e <<...>>).
  // Modelo: "MODELO_Parecer Reputacional (automação)"
  MODELO_DOC_ID: '1NEuuun4KFom6s613RwG9ib82r4pu4iuUK8ABcp7DoM4',

  // ID da pasta do Drive onde os rascunhos gerados serão salvos.
  // Deixe vazio para salvar na mesma pasta do modelo.
  PASTA_DESTINO_ID: '1737rnQNhJzrESCpI8idRxUXp6UHdiVI4',

  // Aba do painel onde ficam os campos de entrada preenchidos pela equipe.
  ABA_PAINEL: 'Gerar Parecer',

  // Prefixo do nome do arquivo gerado.
  PREFIXO_ARQUIVO: 'RASCUNHO_Parecer Reputacional'
};

/**
 * Nomes das abas esperadas na planilha de pesquisa (relatório da plataforma).
 * Centralizados aqui para que uma mudança de nomenclatura na origem seja
 * corrigida em um único lugar.
 */
var ABAS = {
  CAPA: 'Capa',
  DADOS_PESSOAIS: 'Dados Pessoais',
  RECEITA_FEDERAL: 'Receita Federal',
  QSA: 'Sócios e Administradores (QSA)',
  PARTICIPACOES: 'Participação em outras empresas',
  EMPRESAS_RELACIONADAS: 'Empresas Relacionadas',
  FILIAIS: 'Filiais',
  PROCESSOS_DOC: 'Processos (DOCUMENTO)',
  PROCESSOS_NOME: 'Processos (NOME)',
  PROCESSOS_RESUMO: 'Processos Resumo',
  PROTESTOS: 'Protestos em Cartório',
  SERASA_SPC: 'Serasa SPC',
  SERASA_SCORE: 'Serasa - Consulta Score',
  BOA_VISTA: 'Boa Vista',
  PERFIL: 'Perfil Sociodemografico',
  TRANSPARENCIA: 'Portal da Transparência',
  TELEFONES: 'Telefones',
  EMAILS: 'Emails',
  DIARIOS: 'Diarios Oficiais',
  BUSCADORES: 'Internet - Buscadores',
  MIDIAS_IA: 'Mídias IA'
};

/**
 * Campos de entrada manual do painel: dados do negócio e de fontes que não
 * constam no relatório da plataforma. Cada item vira uma linha do painel.
 *
 *   chave    - nome do marcador no modelo, sem as chaves duplas
 *   rotulo   - texto exibido no painel
 *   exemplo  - dica de preenchimento
 *   obrigatorio - bloqueia a geração se estiver vazio
 */
var CAMPOS_MANUAIS = [
  {
    chave: 'LINK_PLANILHA',
    rotulo: 'Link (ou ID) da planilha de pesquisa',
    exemplo: 'https://docs.google.com/spreadsheets/d/.../edit',
    obrigatorio: true
  },
  {
    chave: 'DATA_PESQUISA',
    rotulo: 'Data da pesquisa',
    exemplo: 'deixe vazio para usar a data de hoje',
    obrigatorio: false
  },
  {
    chave: 'ESCOPO',
    rotulo: 'Escopo da contratação',
    exemplo: 'Projeto de Instalações Elétricas',
    obrigatorio: true
  },
  {
    chave: 'SOLICITACAO',
    rotulo: 'Nº da solicitação',
    exemplo: '#254',
    obrigatorio: true
  },
  {
    chave: 'EMPREENDIMENTO',
    rotulo: 'Empreendimento',
    exemplo: 'Mega Canoas',
    obrigatorio: true
  },
  {
    chave: 'VALOR_CONTRATACAO',
    rotulo: 'Valor envolvido na contratação',
    exemplo: '110000 ou R$ 110.000,00',
    obrigatorio: true
  },
  {
    chave: 'COMPROT',
    rotulo: 'COMPROT (resultado da consulta)',
    exemplo: '120 resultados mapeados',
    obrigatorio: false
  },
  {
    chave: 'TRANSPARENCIA_TEXTO',
    rotulo: 'Portal da Transparência - valores/período',
    exemplo: 'no período de 2013 a 2020 recebeu R$ 31.362,25',
    obrigatorio: false
  }
];

/*
 * CNAE_SECUNDARIO saiu desta lista: deixou de ser digitado e passou a vir do
 * cartão CNPJ pela BrasilAPI (CartaoCNPJ.gs). O marcador continua existindo
 * no modelo e o valor continua trafegando em `manuais`, só que preenchido
 * por enriquecerComCartaoCNPJ em vez de pelo formulário.
 */
