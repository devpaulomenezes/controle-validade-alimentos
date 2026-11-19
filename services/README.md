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
  - Método `agendarAlerta(produto)`: dispara notificação imediata se faltam 3 dias ou menos (ou se já venceu), ou agenda alerta local para 3 dias antes do vencimento às 09:00. Chamado pela `TelaCadastro` ao salvar (#10).
  - Dias restantes calculados pelo `ServicoValidade.calcularDiasRestantes` (#10) — sem cálculo de datas próprio.

## Autenticação e Sessão (APP-02)

- **`AuthService.js`:**
  - Singleton. `login(email, senha)` → `POST /auth/login` (401 → `Error("Credenciais inválidas.")`); `registrar(nome, email, senha)` → `POST /auth/registro` (409 → `Error` com a `mensagem` do servidor). Base da URL: `EXPO_PUBLIC_API_URL`.
  - Sucesso grava `sessao.json` (`expo-file-system/legacy`) com `{ token, usuario: { id, nome, email } }` e retorna esses dados.
  - `obterSessao()`, `obterToken()` e `obterUsuarioId()` leem só o arquivo local (sem rede); arquivo ausente ou JSON corrompido devolve `null`.
  - `logout()` remove `sessao.json`; idempotente (sem arquivo, não lança erro).
  - Testes: `__tests__/AuthService.test.js` (mocks de `fetch` e do FileSystem).

## Regras de Negócio (bloco do Paulo)

- **`ServicoValidade.js` (Issue #4):**
  - Regras de vencimento — `calcularDiasRestantes` e `classificarSituacao`, serviço puro. Única fonte do cálculo de datas: usado pela `TelaInicial`, pelo `ServicoDashboard` e pelo `NotificacoesService`.
- **`ServicoDashboard.js` (Issue #5):**
  - Agregações do dashboard — `resumirProdutos` e `ordenarPorValidade`, serviço puro que delega a classificação ao ServicoValidade.

