# Controle de Validade de Alimentos

Aplicativo mobile (React Native + Expo) para registro e controle de produtos perecíveis:
cadastro com foto, alerta de itens "vencendo esta semana" e notificações locais antes do vencimento.

**Disciplina:** Programação para Dispositivos Móveis
**Grupo:** Paulo Moura, Arthur Bento e João Victor Lucena

## Stack
- React Native (JSX) + Expo Go
- expo-router (navegação)
- expo-file-system (persistência JSON local — Etapa 1)
- expo-camera (foto do produto)
- expo-notifications (alertas locais)

## Estrutura de pastas (planejada)
app/           → telas (navegação via expo-router)
components/    → componentes reutilizáveis
services/      → NotificacoesService, CameraService
data/          → ProdutoRepository (interface) + JsonProdutoRepository (Etapa 1)
