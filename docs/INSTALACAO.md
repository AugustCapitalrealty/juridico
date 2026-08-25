# Instalação

Passo a passo para deixar o gerador no ar no Workspace da Capital Realty.
A instalação é feita uma vez; depois disso a equipe só abre a URL do app.

## Arquivos já criados no Drive

Ficam na pasta dos pareceres:

| Arquivo | Para que serve |
|---|---|
| `MODELO_Parecer Reputacional (automação)` | documento modelo com os marcadores |

O `Config.gs` já aponta para o modelo e para a pasta de destino corretos.

## 1. Criar o projeto

1. Abra [script.google.com](https://script.google.com) e clique em **Novo projeto**.
2. Renomeie para **Gerador de Parecer Reputacional**.
3. Apague o `Código.gs` em branco.
4. Crie um arquivo para cada `.gs` de `apps-script/` (botão **+ → Script**),
   com o mesmo nome, e cole o conteúdo:
   - `Config.gs`
   - `Utils.gs`
   - `LeitorPlanilha.gs`
   - `CartaoCNPJ.gs`
   - `PortalTransparencia.gs`
   - `GeradorRascunho.gs`
   - `WebApp.gs`
5. Salve (Ctrl+S).

> O projeto é **independente** — não fica vinculado a nenhuma planilha. Foi
> assim que o erro de "planilha ativa nula" deixou de existir.

## 2. Publicar como app da web

1. Botão **Implantar → Nova implantação**.
2. Em **Tipo**, escolha **App da Web**.
3. Configure:
   - **Executar como**: Eu (sua conta)
   - **Quem pode acessar**: Capital Realty
4. Clique em **Implantar** e autorize quando o Google pedir. O script precisa
   de acesso a Planilhas, Documentos e Drive.
5. Na primeira autorização aparece "app não verificado": é esperado para
   scripts internos. Clique em **Avançado → Acessar (nome do projeto)**.
6. Copie a **URL do app da web** e distribua para a equipe.

> A autorização inclui acesso à internet (`script.external_request`), usado
> para consultar o cartão CNPJ na BrasilAPI.

## 3. Conferir a consulta ao cartão CNPJ

No editor, selecione a função `testarCartaoCNPJ` e clique em **Executar**.
Abra **Registros de execução**: deve listar os CNAEs secundários da Azimute.

Vale rodar depois de qualquer atualização do código — é a forma mais rápida
de descobrir que a BrasilAPI mudou de formato, antes que isso apareça num
parecer.

## 4. Token do Portal da Transparência (opcional, em desenvolvimento)

A API da CGU permite consultar, pelo CNPJ, o valor recebido de entes
públicos e as listas restritivas oficiais (CEIS, CNEP, CEPIM, acordos de
leniência). Exige token gratuito.

1. Cadastre um e-mail em
   <https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email>.
2. No editor, rode `definirTokenPortal('o-token-recebido')` **uma vez**.
   O token vai para as Propriedades do Script — nunca para o código, que é
   versionado.
3. Rode `testarPortalTransparencia()` e confira os **Registros de execução**.

> Enquanto o parsing das respostas não estiver escrito, o gerador não usa
> essas consultas: elas existem só no diagnóstico. O valor do Portal da
> Transparência continua sendo digitado no formulário.

> Ao alterar o código depois, é preciso **Implantar → Gerenciar implantações →
> editar → Nova versão**. Sem isso a URL continua servindo a versão antiga.

## Uso no dia a dia

1. Suba o relatório da plataforma para o Drive e abra-o como Planilhas Google.
2. Abra a URL do app.
3. Preencha o formulário:
   - link da planilha daquele caso (obrigatório)
   - escopo, nº da solicitação, empreendimento, valor da contratação (obrigatórios)
   - COMPROT e Portal da Transparência (quando houver)

   Os CNAEs secundários não são pedidos: vêm do cartão CNPJ automaticamente.
4. **Testar leitura** confere os números da planilha sem criar arquivo — vale
   fazer na primeira vez que usar um relatório de formato diferente.
5. **Gerar rascunho**. A tela devolve o link do documento e a lista de pontos
   a revisar.

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
- **Campo manual novo?** Acrescente a entrada em `CAMPOS_MANUAIS`
  (`Config.gs`), que é a fonte da verdade sobre o que é obrigatório, **e** o
  input correspondente em `getPaginaHTML` (`WebApp.gs`). O formulário é só a
  camada de apresentação; a validação continua saindo do `Config.gs`.
