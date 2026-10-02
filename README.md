# Controle de Validade de Alimentos

Aplicativo mobile (React Native + Expo) para registro e controle de produtos perecíveis:
cadastro com foto, alerta de itens "vencendo esta semana" e notificações locais antes do vencimento.

**Disciplina:** Programação para Dispositivos Móveis
**Grupo:** Paulo Moura, Arthur Alexandre e João Victor Lucena

## Decisões do projeto (fonte de verdade)

- **Plataforma:** Android · **Stack:** React Native (JSX) com Expo, testado no Expo Go
- **Navegação:** React Navigation (template blank — expo-router descartado)
- **Escopo da Etapa 1:** CRUD completo com persistência local em JSON (expo-file-system)
- **Escopo da Etapa 2:** persistência em banco REMOTO via API (mesma interface do repositório)
- **Identificação do produto:** foto do alimento/rótulo pela câmera. Sem código de barras e sem
  OCR (a validade não vem do EAN; a entrada de data é manual com date picker). OCR descartado
  do MVP por instabilidade técnica.
- **Notificações:** locais, 3 dias antes do vencimento (expo-notifications; atenção à permissão
  no Android 13+)

## Arquitetura e padrão de projeto

Padrão central: **Repository**, em arquitetura em camadas (MVC simplificado).

    Tela (Screen) → ServicoValidade (regras de negócio) → ProdutoRepository (interface)
                                                              ↓
                                                  JsonProdutoRepository (Etapa 1)
                                                              ↓
                                                  produtos.json (FileSystem do dispositivo)

- **Por que Repository:** as telas nunca acessam a origem dos dados diretamente. Na Etapa 2,
  troca-se apenas a implementação (JsonProdutoRepository → ApiProdutoRepository) sem alterar telas.
- **Singleton** no repositório: fonte de verdade única para todas as telas.
- **Modelo:** Produto = id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro.
  Regras de vencimento (dias restantes; vencido / esta semana / este mês / ok) centralizadas
  no ServicoValidade.

## Estrutura de pastas (planejada)

    app/           → telas (navegação via React Navigation)
    components/    → componentes reutilizáveis
    services/      → ServicoValidade, ServicoDashboard, NotificacoesService, CameraService
    data/          → ProdutoRepository (interface) + JsonProdutoRepository (Etapa 1)
    
## Fluxo de trabalho Git (regra do grupo)

- Desenvolvimento exclusivamente na branch **`dev`**
- Merge para **`main`** quando estável — `main` é a branch de publicação/entrega
- **Toda outra branch é excluída** após ser mesclada (nada de branches permanentes extras)
- Mensagens de commit no padrão **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`)
- Commits finais feitos pelo grupo, após revisão das alterações

## Divisão de responsabilidades — Etapa 1

Cada integrante é responsável por 4 issues, desenvolvidas de forma independente
contra o contrato de dados definido na issue #1 (modelo `Produto` e interface
`ProdutoRepository`), usando mocks onde a integração só ocorre no fim do bloco.

| Integrante | Bloco | Issues | Responsabilidades |
|---|---|---|---|
| Paulo Moura | Dados e regras | #3–#6 | `JsonProdutoRepository` (CRUD em JSON), `ServicoValidade` (regras de vencimento), `ServicoDashboard` (agregações), testes unitários |
| Arthur Alexandre | Interface | #7–#10 | Tema visual e componentes reutilizáveis, tela de cadastro (formulário + date picker), tela de listagem (busca e filtro), dashboard "vencendo esta semana" e troca do mock pelo repositório real |
| João Victor Lucena | Recursos do dispositivo | #11–#14 | `CameraService` (foto/galeria com permissões), `NotificacoesService` (alertas locais 3 dias antes do vencimento), integração da foto no fluxo do app, testes de integração e validação final |

## Regra de manutenção deste README

⚠️ Este README é **fonte de verdade viva**: a cada issue concluída, ele deve ser
corrigido/adaptado para permanecer coerente com o contexto e o andamento do projeto.
Manter o README atualizado integra os critérios de aceite de cada issue no GitHub.

## Licença

Distribuído sob a **Licença MIT** — ver o arquivo `LICENSE`.
Copyright (c) 2026 Paulo Moura Menezes, Arthur Alexandre e João Victor Lucena.

## Como executar

    npm install
    npx expo start

Escaneie o QR Code com o Expo Go (celular e PC na mesma rede Wi-Fi).

## Histórico de decisões

- 2026-10-01 — Repositório inicializado; scaffold do Expo (template blank) mesclado ao `main`;
  `.gitignore` unificado; fluxo de branches `dev` → `main` definido.
- 2026-10-01 — Licença do template do Expo substituída por MIT própria do grupo; README
  consolidado com navegação via React Navigation.
- 2026-10-02 — Plano da Etapa 1 concluído: 14 issues criadas no GitHub (2 de
  fundação + 4 por integrante, blocos independentes contra o contrato da #1);
  `NotificacoesService` movida para o bloco do João;   labels `setup`, `feat` e `docs` configuradas.
