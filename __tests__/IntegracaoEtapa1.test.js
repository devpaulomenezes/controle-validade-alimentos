/* global describe, it, expect, beforeEach, jest */
/**
 * Testes de integração da Etapa 1 (Issue #14).
 * Verifica as peças funcionando em conjunto: JsonProdutoRepository,
 * ServicoValidade, ServicoDashboard, CameraService.persistirFoto e
 * NotificacoesService.agendarAlerta no cenário completo de 5 produtos.
 */
import repositorio from '../data/JsonProdutoRepository';
import Produto from '../data/Produto';
import { calcularDiasRestantes, classificarSituacao } from '../services/ServicoValidade';
import { ordenarPorValidade, resumirProdutos } from '../services/ServicoDashboard';
import CameraService from '../services/CameraService';
import NotificacoesService from '../services/NotificacoesService';

const mockArmazenamento = {};
const mockNotificacoesAgendadas = [];

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho),
  })),
  makeDirectoryAsync: jest.fn(async (caminho) => {
    mockArmazenamento[caminho] = '__DIR__';
  }),
  copyAsync: jest.fn(async ({ from, to }) => {
    mockArmazenamento[to] = mockArmazenamento[from] || `conteudo-copiado-de:${from}`;
  }),
  readAsStringAsync: jest.fn(async (caminho) => {
    if (!Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho)) {
      throw new Error(`Arquivo não encontrado: ${caminho}`);
    }
    return mockArmazenamento[caminho];
  }),
  writeAsStringAsync: jest.fn(async (caminho, conteudo) => {
    mockArmazenamento[caminho] = conteudo;
  }),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}));

jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn(async () => {}),
}));

jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn(async (req) => {
    const id = `notif-${mockNotificacoesAgendadas.length + 1}`;
    mockNotificacoesAgendadas.push({ identifier: id, ...req });
    return id;
  }),
}));

jest.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockNotificacoesAgendadas]),
}));

jest.mock('expo-notifications/build/cancelAllScheduledNotificationsAsync', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockNotificacoesAgendadas.length = 0;
  }),
}));

/**
 * Retorna a data local de hoje deslocada em N dias no formato 'YYYY-MM-DD'.
 * @param {number} deslocamentoDias
 * @returns {string}
 */
function dataIso(deslocamentoDias) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoDias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

describe('Integração da Etapa 1 (Issue #14)', () => {
  beforeEach(() => {
    for (const chave of Object.keys(mockArmazenamento)) {
      delete mockArmazenamento[chave];
    }
    mockNotificacoesAgendadas.length = 0;
  });

  it('deve integrar cadastro (com e sem foto), persistência, listagem ordenada, filtros, dashboard e remoção no cenário de 5 produtos', async () => {
    // 1. Simula foto capturada pela câmera e persistida pelo CameraService
    const uriTemporaria = 'file:///cache/ImagePicker/foto-iogurte.jpg';
    mockArmazenamento[uriTemporaria] = 'bytes-imagem-iogurte';
    const fotoPersistida = await CameraService.persistirFoto(uriTemporaria);

    expect(fotoPersistida).toMatch(/^\/documentos-teste\/fotos\/foto-.*\.jpg$/);
    expect(mockArmazenamento[fotoPersistida]).toBe('bytes-imagem-iogurte');

    // 2. Monta o cenário de 5 produtos da Issue #14:
    //    1 vencido, 2 vencendo esta semana (1 com foto, 1 sem), 1 vencendo este mês e 1 ok
    const entradasCadastro = [
      { nome: 'Arroz Tipo 1', quantidade: 2, dataDeValidade: dataIso(45), fotoUri: null }, // ok
      { nome: 'Iogurte Natural', quantidade: 4, dataDeValidade: dataIso(2), fotoUri: fotoPersistida }, // venceEstaSemana (com foto)
      { nome: 'Leite Integral', quantidade: 1, dataDeValidade: dataIso(-3), fotoUri: null }, // vencido
      { nome: 'Pão de Forma', quantidade: 1, dataDeValidade: dataIso(15), fotoUri: null }, // venceEsteMes
      { nome: 'Queijo Minas', quantidade: 1, dataDeValidade: dataIso(6), fotoUri: null }, // venceEstaSemana (sem foto)
    ];

    for (const dados of entradasCadastro) {
      const produto = new Produto({
        id: null,
        nome: dados.nome,
        quantidade: dados.quantidade,
        dataDeValidade: dados.dataDeValidade,
        fotoUri: dados.fotoUri,
        dataDeCadastro: null,
      });
      await repositorio.salvar(produto);
      await NotificacoesService.agendarAlerta(produto);
    }

    // 3. Confirma persistência no arquivo produtos.json e sobrevivência da foto ao recarregar
    expect(mockArmazenamento['/documentos-teste/produtos.json']).toBeTruthy();
    const produtosPersistidos = await repositorio.listar();
    expect(produtosPersistidos).toHaveLength(5);

    const iogurteSalvo = produtosPersistidos.find((p) => p.nome === 'Iogurte Natural');
    expect(iogurteSalvo.fotoUri).toBe(fotoPersistida);
    expect(mockArmazenamento[iogurteSalvo.fotoUri]).toBe('bytes-imagem-iogurte');

    // 4. Verifica ordenação por validade mais próxima (ServicoDashboard.ordenarPorValidade)
    const ordenados = ordenarPorValidade(produtosPersistidos);
    expect(ordenados.map((p) => p.nome)).toEqual([
      'Leite Integral',
      'Iogurte Natural',
      'Queijo Minas',
      'Pão de Forma',
      'Arroz Tipo 1',
    ]);

    // 5. Verifica classificação individual (ServicoValidade.classificarSituacao)
    expect(ordenados.map((p) => classificarSituacao(p))).toEqual([
      'vencido',
      'venceEstaSemana',
      'venceEstaSemana',
      'venceEsteMes',
      'ok',
    ]);

    // 6. Verifica contadores do dashboard com os 5 produtos (ServicoDashboard.resumirProdutos)
    const resumoInicial = resumirProdutos(produtosPersistidos);
    expect(resumoInicial).toEqual({
      total: 5,
      vencidos: 1,
      venceEstaSemana: 2,
      venceEsteMes: 1,
      ok: 1,
    });

    // 7. Verifica remoção e atualização dos contadores do dashboard
    const leiteSalvo = produtosPersistidos.find((p) => p.nome === 'Leite Integral');
    await repositorio.remover(leiteSalvo.id);

    const produtosAposRemocao = await repositorio.listar();
    expect(produtosAposRemocao).toHaveLength(4);

    const resumoAposRemocao = resumirProdutos(produtosAposRemocao);
    expect(resumoAposRemocao).toEqual({
      total: 4,
      vencidos: 0,
      venceEstaSemana: 2,
      venceEsteMes: 1,
      ok: 1,
    });
  });

  it('deve agendar alerta imediato para produto vencendo em menos de 3 dias e alerta futuro para produto com folga', async () => {
    const produtoUrgente = new Produto({
      id: 'prod-urgente',
      nome: 'Iogurte Natural',
      quantidade: 2,
      dataDeValidade: dataIso(2),
      fotoUri: null,
      dataDeCadastro: new Date().toISOString(),
    });

    const produtoComFolga = new Produto({
      id: 'prod-folga',
      nome: 'Pão de Forma',
      quantidade: 1,
      dataDeValidade: dataIso(15),
      fotoUri: null,
      dataDeCadastro: new Date().toISOString(),
    });

    expect(calcularDiasRestantes(produtoUrgente.dataDeValidade)).toBe(2);
    expect(calcularDiasRestantes(produtoComFolga.dataDeValidade)).toBe(15);

    const idUrgente = await NotificacoesService.agendarAlerta(produtoUrgente);
    const idFolga = await NotificacoesService.agendarAlerta(produtoComFolga);

    expect(idUrgente).toBeTruthy();
    expect(idFolga).toBeTruthy();

    const agendadas = await NotificacoesService.listarAgendadas();
    expect(agendadas).toHaveLength(2);

    // Produto vencendo em 2 dias (<= 3 dias): gatilho imediato (2 segundos)
    expect(agendadas[0].content.title).toBe('Produto vencendo');
    expect(agendadas[0].content.body).toBe('Iogurte Natural vence em 2 dias!');
    expect(agendadas[0].trigger.seconds).toBe(2);

    // Produto vencendo em 15 dias (> 3 dias): gatilho por data (3 dias antes às 09:00)
    expect(agendadas[1].content.title).toBe('Produto vencendo');
    expect(agendadas[1].content.body).toBe('Pão de Forma vence em 15 dias!');
    expect(agendadas[1].trigger.date).toBeInstanceOf(Date);
    expect(agendadas[1].trigger.date.getHours()).toBe(9);
  });
});
