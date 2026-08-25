# Mapeamento de campos

Referência de todos os marcadores do documento modelo e de onde vem cada
valor. Use ao alterar o modelo ou ao investigar um campo que saiu errado.

## Marcadores simples: `{{CAMPO}}`

Substituídos por texto. Funcionam dentro de células de tabela.

| Marcador | Origem |
|---|---|
| `{{DATA_PESQUISA}}` | painel; vazio usa a data de hoje |
| `{{RAZAO_SOCIAL}}` | `Receita Federal` → Razão social |
| `{{NOME_FANTASIA}}` | `Dados Pessoais` → Nome fantasia |
| `{{CNPJ}}` | `Receita Federal` → CNPJ, com máscara aplicada |
| `{{DATA_ABERTURA}}` | `Receita Federal` → Data de abertura, normalizada para dd/MM/aaaa |
| `{{ESCOPO}}` | painel |
| `{{SOLICITACAO}}` | painel |
| `{{EMPREENDIMENTO}}` | painel |
| `{{VALOR_CONTRATACAO}}` | painel, formatado em reais |
| `{{CAPITAL_SOCIAL}}` | `Receita Federal`, com valor por extenso entre parênteses |
| `{{FATURAMENTO_PRESUMIDO}}` | `Perfil Sociodemografico`, com queda para `Capa` |
| `{{ENDERECO}}` | `Receita Federal` → Endereço na Receita Federal |
| `{{EXPOSICAO_JURIDICA}}` | soma de `Valor da Causa` por polo; duas linhas |
| `{{EXPOSICAO_OBS}}` | total de processos e quantos em andamento |
| `{{COMPROT}}` | painel |
| `{{PROTESTOS_QTD}}` | contagem em `Protestos em Cartório` |
| `{{PROTESTOS_OBS}}` | uma linha por protesto: valor, cartório e UF |
| `{{SERASA_RESULTADO}}` | `Serasa SPC`: "Nada Consta" ou nº de pendências |
| `{{SERASA_OBS}}` | `Serasa - Consulta Score` → coluna Risco |
| `{{QTD_PARTICIPACOES}}` | contagem em `Participação em outras empresas` |
| `{{QTD_FILIAIS}}` | contagem em `Filiais` |
| `{{CNAE_PRINCIPAL}}` | `Receita Federal` → Atividade econômica |
| `{{NATUREZA_JURIDICA}}` | `Receita Federal` → Natureza jurídica |
| `{{PORTE}}`, `{{QTD_FUNCIONARIOS}}` | `Perfil Sociodemografico` |
| `{{IDADE_EMPRESA}}` | `Capa` |
| `{{TEXTO_PROCESSOS}}` | frase montada com total e em andamento |
| `{{TOTAL_PROCESSOS}}`, `{{PROCESSOS_EM_ANDAMENTO}}` | `Processos (DOCUMENTO)` |
| `{{TRANSPARENCIA_TEXTO}}` | painel |
| `{{QTD_TRANSPARENCIA}}` | contagem em `Portal da Transparência` |
| `{{RISCO_REPUTACIONAL}}`, `{{RISCO_JURIDICO_PLATAFORMA}}`, `{{RISCO_CREDITO}}`, `{{PEP_MIDIAS}}` | `Capa` |

Campo sem origem disponível vira `[ A PREENCHER ]` no rascunho e entra no
checklist final.

## Marcadores de bloco: `<<BLOCO_X>>`

O parágrafo inteiro é substituído por conteúdo gerado — lista ou tabela.

| Marcador | Conteúdo |
|---|---|
| `<<BLOCO_SOCIOS>>` | tabela: documento, nome, qualificação, situação |
| `<<BLOCO_PARTICIPACOES>>` | lista de empresas com CNPJ |
| `<<BLOCO_EMPRESAS_RELACIONADAS>>` | resumo do total + tabela das empresas sinalizadas, agrupadas (até 30), ordenadas por nº de vínculos |
| `<<BLOCO_RESUMO_PROCESSOS>>` | distribuição por tribunal e por ano |
| `<<BLOCO_PROCESSOS_ANDAMENTO>>` | tabela dos processos não encerrados, do maior valor de causa para o menor |
| `<<BLOCO_TRANSPARENCIA>>` | documentos de pagamento (com exercícios) e contagem de vínculos cadastrais |
| `<<BLOCO_CNAE_SECUNDARIO>>` | CNAEs do cartão CNPJ (BrasilAPI); falha vira bloco "A PREENCHER" |
| `<<BLOCO_CHECKLIST>>` | pendências, avisos de leitura e data de geração |

## Como os números dos processos são apurados

Tudo sai da aba `Processos (DOCUMENTO)`, com as colunas localizadas pelo nome
do cabeçalho.

- **Total**: linhas com algum dado preenchido.
- **Em andamento**: status `EM TRAMITACAO`. É a definição usada nos pareceres
  da área — ver a seção final do README.
- **Não encerrados**: `EM TRAMITACAO`, `SUSPENSO` e `EM GRAU DE RECURSO`.
  Alimenta a tabela de apoio; a diferença para "em andamento" vira aviso no
  checklist.
- **Exposição como réu**: soma de `Valor da Causa` onde `Polo` é `PASSIVO`.
- **Exposição como autor**: mesma soma onde `Polo` é `ATIVO`.

Linhas com polo `N/D` não entram em nenhuma das somas, o que reproduz o
critério do parecer redigido à mão.

## Cartão CNPJ (BrasilAPI)

Os CNAEs secundários não constam no relatório da plataforma. Em vez de
digitação manual, `CartaoCNPJ.gs` consulta
`https://brasilapi.com.br/api/cnpj/v1/{cnpj}` com o CNPJ que a planilha já
traz, e usa `cnaes_secundarios`. Por isso o formulário não tem campo para
eles: `enriquecerComCartaoCNPJ` preenche `manuais.CNAE_SECUNDARIO` antes de
`gerarRascunho` ser chamado.

Duas armadilhas do contrato da API, ambas cobertas por teste:

- **O código do CNAE vem como número**, então o zero à esquerda se perde:
  `230600`, não `"0230600"`. Sem completar para 7 dígitos, `02.30-6-00`
  sairia como `23.06-0-0`.
- **O CNPJ pode ser alfanumérico** (formato novo, já aceito pela API). A
  limpeza tira só pontuação; um `replace(/\D/g)` comeria as letras.

A consulta nunca derruba a geração: falha vira aviso no checklist e o campo
volta a ser preenchido à mão. O resultado fica em cache por 6 horas.

`testarCartaoCNPJ()` roda no editor do Apps Script e mostra a resposta crua
nos registros de execução — é como conferir se o contrato mudou.

## Portal da Transparência

A aba tem três colunas — `Titulo`, `URL`, `Descrição` — e a `Descrição` vem
**vazia**. O valor recebido não está na planilha: quem redige abre os links e
soma. Por isso `TRANSPARENCIA_TEXTO` continua sendo digitado.

O que dá para apurar sozinho, e o script apura:

- **Tipo de ocorrência**, pela URL. `/despesas/pagamento/` é dinheiro
  recebido; o resto é a página cadastral da empresa e uma linha por sócio.
  Na Azimute são 8 pagamentos e 5 vínculos, não "13 recebimentos".
- **Exercício**, pelo código do documento: `2019DF800006` → 2019.

Os exercícios encontrados vão para o checklist para serem comparados com o
período digitado. Na pesquisa da Azimute os códigos são de **2019 e 2021**,
enquanto o parecer redigido à mão diz "de 2013 a 2020" — divergência que o
script sinaliza sem resolver, porque não dá para saber daqui se o período do
parecer veio do próprio portal (que mostra mais histórico que a busca) ou de
um parecer anterior.

**O valor não é automatizável pela planilha.** A CGU publica uma API em
`api.portaldatransparencia.gov.br` que exige token gratuito por cadastro;
seria o caminho, mas é integração nova e não foi feita.

## Conversão de números

A planilha mistura dois formatos na mesma coluna: `61500.00`, vindo da API, e
`1.808.100,42`, no padrão brasileiro. `paraNumero` trata os dois. O caso
ambíguo é um valor com um único ponto e sem vírgula:

- três dígitos após o ponto (`3.102`) → separador de milhar
- dois dígitos (`1234.56`) → decimal

Os testes cobrem os dois casos.
