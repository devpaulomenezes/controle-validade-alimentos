# Serviços (`services/`)

Camada de serviços do aplicativo, dividida em regras de negócio e recursos do dispositivo.

## Recursos do Dispositivo (bloco do João)

- **`CameraService.js` (Issue #11):**
  - Métodos estáticos: `CameraService.tirarFoto()` e `CameraService.escolherDaGaleria()`.
  - Tratamento de permissões com `expo-image-picker` (concedida, negada e negada permanentemente com direcionamento às configurações do sistema via `Linking.openSettings()`).
  - Captura comprimida (`quality: 0.6`, `allowsEditing: false`, `mediaTypes: ['images']`).
  - Tratamento de cancelamento sem erros (retorna `null`).
  - Retorna a URI local em string, formato compatível com o campo `fotoUri` do contrato `Produto`.
  - Método `CameraService.persistirFoto(uriTemporaria)` (Issue #13): copia a imagem do cache temporário para o diretório permanente de documentos (`FileSystem.documentDirectory/fotos/`), garantindo que a foto permaneça válida e visível após fechar e reabrir o app.

- **`NotificacoesService.js` (Issue #12):**
  - Serviço puro para agendamento de alertas locais usando `expo-notifications`.
  - Método `agendarAlerta(produto)`: dispara notificação imediata se faltam 3 dias ou menos (ou se já venceu), ou agenda alerta local para 3 dias antes do vencimento às 09:00.

## Regras de Negócio (bloco do Paulo)

- **`ServicoValidade.js` (Issue #4):**
  - Regras de vencimento — `calcularDiasRestantes` e `classificarSituacao`, serviço puro.
