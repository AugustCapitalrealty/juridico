# Instalação

Passo a passo para deixar o gerador funcionando no Workspace da Capital Realty.
A instalação é feita uma vez; depois disso, cada parecer novo só precisa do
link da planilha daquele caso.

## Arquivos já criados no Drive

Ambos ficam na mesma pasta dos pareceres:

| Arquivo | Para que serve |
|---|---|
| `MODELO_Parecer Reputacional (automação)` | documento modelo com os marcadores |
| `PAINEL_Gerador de Parecer Jurídico` | planilha onde a equipe dispara a geração |

O `Config.gs` já aponta para o modelo e para a pasta de destino corretos.

## 1. Instalar o código no painel

1. Abra a planilha **PAINEL_Gerador de Parecer Jurídico**.
2. Menu **Extensões → Apps Script**.
3. Apague o `Código.gs` que vem em branco.
4. Crie um arquivo para cada `.gs` de `apps-script/` (botão **+ → Script**),
   com o mesmo nome, e cole o conteúdo:
   - `Config.gs`
   - `Utils.gs`
   - `LeitorPlanilha.gs`
   - `GeradorRascunho.gs`
   - `Menu.gs`
5. Salve (Ctrl+S).

> O `appsscript.json` só é necessário se você usar o `clasp` para publicar.
> Colando pelo editor, o Apps Script gera o manifesto sozinho.

## 2. Autorizar

1. Ainda no editor, selecione a função `configurarPainel` e clique em **Executar**.
2. O Google vai pedir autorização — aceite. O script precisa de acesso a
   Planilhas, Documentos e Drive para ler a pesquisa e criar o rascunho.
3. Na primeira execução aparece o aviso "app não verificado": é esperado para
   scripts internos. Clique em **Avançado → Acessar (nome do projeto)**.

Ao final, a aba **Gerar Parecer** aparece na planilha, já formatada.

## 3. Recarregar o menu

Feche e reabra a planilha do painel. O menu **Parecer Jurídico** aparece ao
lado de "Ajuda".

## Uso no dia a dia

1. Suba o relatório da plataforma para o Drive e abra-o como Planilhas Google.
2. No painel, aba **Gerar Parecer**, preencha a coluna **Preencher aqui**:
   - link da planilha daquele caso (obrigatório)
   - escopo, nº da solicitação, empreendimento, valor da contratação (obrigatórios)
   - COMPROT, Portal da Transparência, CNAEs secundários (quando houver)
3. Menu **Parecer Jurídico → Testar leitura da planilha** para conferir os
   números antes de gerar. Esse passo não cria nenhum arquivo.
4. Menu **Parecer Jurídico → Gerar rascunho**.
5. O script mostra o link do rascunho e a lista de pendências.

O rascunho nasce com o nome
`RASCUNHO_Parecer Reputacional_<empresa>_<data>` e vai para a pasta de destino
configurada.

## Antes de finalizar o parecer

O rascunho termina com um **Checklist de revisão** listando tudo que ficou
pendente e os avisos de leitura da planilha. Preencha as seções marcadas em
amarelo e **apague o checklist** antes de finalizar.

## Manutenção

- **A plataforma renomeou uma aba ou coluna?** Ajuste `ABAS` em `Config.gs`
  (aba) ou a lista de nomes aceitos na chamada de `_indiceColuna`
  correspondente em `LeitorPlanilha.gs` (coluna). A leitura procura a coluna
  pelo nome do cabeçalho, então mudança de ordem das colunas não quebra nada.
- **Mudou o texto ou o layout do parecer?** Edite direto o documento modelo no
  Drive. Só não altere os marcadores `{{CAMPO}}` e `<<BLOCO_X>>`.
- **Precisa de um campo novo?** Acrescente o marcador no modelo e o valor em
  `_montarValores` (`GeradorRascunho.gs`). Marcador sem correspondência no
  código aparece no checklist em vez de passar batido.
- **Campo manual novo?** Acrescente uma entrada em `CAMPOS_MANUAIS`
  (`Config.gs`) e rode `configurarPainel` de novo.
