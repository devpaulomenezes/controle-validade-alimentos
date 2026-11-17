/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes da TelaCadastro nos modos criação e edição (issue #19).
 * Renderiza a tela com react-test-renderer (já instalado como dependência do
 * jest-expo; nenhuma dependência nova) e aciona os botões pelas props.
 *
 * Inclui o caso EXTRA (além dos oito do prompt) da decisão 3: se atualizar()
 * falha, a foto nova copiada nesta tentativa é apagada e a original é mantida.
 */
import React from 'react';
import { Alert, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import TelaCadastro from '../app/TelaCadastro';
import repositorio from '../data/JsonProdutoRepository';
import Produto from '../data/Produto';

const mockArmazenamento = {};
const mockNotificacoesAgendadas = [];
const mockSeletorData = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho),
  })),
  makeDirectoryAsync: jest.fn(async (caminho) => {
    mockArmazenamento[caminho] = '__DIR__';
  }),
  copyAsync: jest.fn(async ({ from, to }) => {
    mockArmazenamento[to] = mockArmazenamento[from] ?? `copia-de:${from}`;
  }),
  deleteAsync: jest.fn(async (caminho) => {
    delete mockArmazenamento[caminho];
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

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props) => {
    mockSeletorData.props = props;
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
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

jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    const indice = mockNotificacoesAgendadas.findIndex((n) => n.identifier === identifier);
    if (indice !== -1) mockNotificacoesAgendadas.splice(indice, 1);
  }),
}));

jest.mock('expo-notifications/build/cancelAllScheduledNotificationsAsync', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockNotificacoesAgendadas.length = 0;
  }),
}));

const CAMINHO_JSON = '/documentos-teste/produtos.json';
const FOTO_ORIGINAL = '/documentos-teste/fotos/foto-original.jpg';
const URI_CAMERA = 'file:///cache/ImagePicker/nova.jpg';

function dataIso(deslocamentoDias) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoDias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function criarNavegacao() {
  return { goBack: jest.fn(), setOptions: jest.fn(), navigate: jest.fn() };
}

/** Renderiza a tela e devolve utilitários para acionar botões pelo rótulo/texto. */
async function renderizar(navigation, params) {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <TelaCadastro navigation={navigation} route={{ params }} />
    );
  });

  const raiz = renderer.root;
  const temTexto = (no, texto) =>
    no.findAll((filho) => filho.props.children === texto).length > 0;

  return {
    temBotaoPorRotulo: (rotulo) =>
      raiz.findAll((no) => no.props.accessibilityLabel === rotulo).length > 0,
    async tocarPorRotulo(rotulo) {
      const [botao] = raiz.findAll(
        (no) => no.props.accessibilityLabel === rotulo && typeof no.props.onPress === 'function'
      );
      await act(async () => {
        await botao.props.onPress();
      });
    },
    async tocarPorTexto(texto) {
      const [botao] = raiz.findAll(
        (no) => typeof no.props.onPress === 'function' && temTexto(no, texto)
      );
      await act(async () => {
        await botao.props.onPress();
      });
    },
    valoresDosCampos: () => raiz.findAllByType(TextInput).map((t) => t.props.value),
    async digitarNoCampo(indice, texto) {
      const campo = raiz.findAllByType(TextInput)[indice];
      await act(async () => {
        campo.props.onChangeText(texto);
      });
    },
    desmontar: () => renderer.unmount(),
  };
}

/** Escolhe "Tirar foto" no Alert de opções, devolvendo a nova URI da câmera. */
async function trocarFotoPelaCamera(tela, alertSpy) {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: URI_CAMERA }] });
  alertSpy.mockClear();
  await tela.tocarPorRotulo('Trocar foto');
  const botoes = alertSpy.mock.calls.find(([titulo]) => titulo === 'Foto do produto')[2];
  await act(async () => {
    await botoes.find((b) => b.text === 'Tirar foto').onPress();
  });
}

function produtoBase() {
  return new Produto({
    id: 'prod-1',
    nome: 'Leite Integral',
    quantidade: 2,
    dataDeValidade: dataIso(20),
    fotoUri: FOTO_ORIGINAL,
    dataDeCadastro: '2026-10-05T12:00:00.000Z',
  });
}

describe('TelaCadastro: criação e edição (issue #19)', () => {
  let alertSpy;
  let consoleErro;

  beforeEach(() => {
    for (const chave of Object.keys(mockArmazenamento)) {
      delete mockArmazenamento[chave];
    }
    mockNotificacoesAgendadas.length = 0;
    FileSystem.copyAsync.mockClear();
    FileSystem.deleteAsync.mockClear();
    FileSystem.writeAsStringAsync.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErro.mockRestore();
  });

  async function semearBase() {
    mockArmazenamento[FOTO_ORIGINAL] = 'bytes-originais';
    await repositorio.salvar(produtoBase());
  }

  it('modo edição: título "Editar produto", campos pré-preenchidos e botão "Remover foto" visível', async () => {
    await semearBase();
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Editar produto' });
    expect(tela.valoresDosCampos()).toEqual(['Leite Integral', '2']);
    expect(tela.temBotaoPorRotulo('Remover foto')).toBe(true);
    tela.desmontar();
  });

  it('modo criação: título "Novo produto"; salvar() grava, o alerta leva o id real (produtoId) e mostra "Produto salvo"', async () => {
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, undefined);
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Novo produto' });
    expect(tela.valoresDosCampos()).toEqual(['', '']);
    expect(tela.temBotaoPorRotulo('Remover foto')).toBe(false);

    // Sem preencher nada, as validações impedem a gravação.
    await tela.tocarPorTexto('Salvar');
    expect(mockArmazenamento[CAMINHO_JSON]).toBeUndefined();

    await tela.digitarNoCampo(0, 'Queijo Prato');
    await tela.digitarNoCampo(1, '3');
    await tela.tocarPorRotulo('Selecionar data de validade');
    await act(async () => {
      mockSeletorData.props.onValueChange({}, new Date(2030, 0, 15));
    });
    await tela.tocarPorTexto('Salvar');

    const [salvo] = await repositorio.listar();
    expect(salvo.nome).toBe('Queijo Prato');
    expect(salvo.quantidade).toBe(3);
    expect(salvo.dataDeValidade).toBe('2030-01-15');
    expect(salvo.id).toBeTruthy();
    expect(salvo.dataDeCadastro).toBeTruthy();
    // O alerta agendado leva o id real gerado pelo repositório.
    expect(mockNotificacoesAgendadas).toHaveLength(1);
    expect(mockNotificacoesAgendadas[0].content.data.produtoId).toBe(salvo.id);
    expect(alertSpy).toHaveBeenCalledWith('Produto salvo', expect.any(String), expect.any(Array));
    tela.desmontar();
  });

  it('edição com sucesso: chama atualizar() mantendo id e dataDeCadastro, reagenda o alerta e volta, sem "Produto salvo"', async () => {
    await semearBase();
    // Alerta antigo do produto, agendado antes da edição.
    mockNotificacoesAgendadas.push({
      identifier: 'antigo',
      content: { data: { produtoId: 'prod-1' } },
      trigger: {},
    });
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    await tela.tocarPorTexto('Salvar');

    const [salvo] = await repositorio.listar();
    expect(salvo.id).toBe('prod-1');
    expect(salvo.dataDeCadastro).toBe('2026-10-05T12:00:00.000Z');
    expect(salvo.fotoUri).toBe(FOTO_ORIGINAL);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalledWith('Produto salvo', expect.anything(), expect.anything());
    // Cancelou o antigo e agendou um novo: continua exatamente 1 alerta do produto.
    const doProduto = mockNotificacoesAgendadas.filter((n) => n.content.data?.produtoId === 'prod-1');
    expect(doProduto).toHaveLength(1);
    expect(doProduto[0].identifier).not.toBe('antigo');
    // Sem troca de foto: nada copiado nem apagado.
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(mockArmazenamento[FOTO_ORIGINAL]).toBe('bytes-originais');
    tela.desmontar();
  });

  it('troca de foto na edição: salva a nova e apaga a antiga do disco só depois do sucesso', async () => {
    await semearBase();
    mockArmazenamento[URI_CAMERA] = 'bytes-novos';
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    await trocarFotoPelaCamera(tela, alertSpy);
    await tela.tocarPorTexto('Salvar');

    const [salvo] = await repositorio.listar();
    expect(salvo.fotoUri).toMatch(/^\/documentos-teste\/fotos\/foto-.*\.jpg$/);
    expect(salvo.fotoUri).not.toBe(FOTO_ORIGINAL);
    expect(mockArmazenamento[salvo.fotoUri]).toBe('bytes-novos');
    expect(mockArmazenamento[FOTO_ORIGINAL]).toBeUndefined();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    tela.desmontar();
  });

  it('remover a foto na edição: grava fotoUri null e apaga a foto antiga do disco', async () => {
    await semearBase();
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    await tela.tocarPorRotulo('Remover foto');
    // Antes de salvar a foto antiga ainda existe.
    expect(mockArmazenamento[FOTO_ORIGINAL]).toBe('bytes-originais');
    await tela.tocarPorTexto('Salvar');

    const [salvo] = await repositorio.listar();
    expect(salvo.fotoUri).toBeNull();
    expect(mockArmazenamento[FOTO_ORIGINAL]).toBeUndefined();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    tela.desmontar();
  });

  it('falha de gravação na edição: mostra "Erro ao salvar", não volta, não mostra "Produto salvo" e não altera a base', async () => {
    await semearBase();
    const baseAntes = mockArmazenamento[CAMINHO_JSON];
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disco cheio'));
    await tela.tocarPorTexto('Salvar');

    expect(alertSpy).toHaveBeenCalledWith('Erro ao salvar', 'disco cheio');
    expect(alertSpy).not.toHaveBeenCalledWith('Produto salvo', expect.anything(), expect.anything());
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(mockArmazenamento[CAMINHO_JSON]).toBe(baseAntes);
    tela.desmontar();
  });

  it('EXTRA (decisão 3): se atualizar() falha após trocar a foto, apaga a foto NOVA copiada e mantém a original', async () => {
    await semearBase();
    mockArmazenamento[URI_CAMERA] = 'bytes-novos';
    const navigation = criarNavegacao();
    const tela = await renderizar(navigation, { produto: { ...produtoBase() } });

    await trocarFotoPelaCamera(tela, alertSpy);
    FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disco cheio'));
    await tela.tocarPorTexto('Salvar');

    // A cópia nova foi feita e depois descartada; a original segue intacta.
    expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
    const copiadaPara = FileSystem.copyAsync.mock.calls[0][0].to;
    expect(copiadaPara).toMatch(/^\/documentos-teste\/fotos\//);
    expect(mockArmazenamento[copiadaPara]).toBeUndefined();
    expect(mockArmazenamento[FOTO_ORIGINAL]).toBe('bytes-originais');
    // A base continua apontando para a foto original.
    const [salvo] = await repositorio.listar();
    expect(salvo.fotoUri).toBe(FOTO_ORIGINAL);
    expect(alertSpy).toHaveBeenCalledWith('Erro ao salvar', 'disco cheio');
    expect(navigation.goBack).not.toHaveBeenCalled();
    // Nenhuma exclusão da foto original foi solicitada.
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(FOTO_ORIGINAL, expect.anything());
    tela.desmontar();
  });
});
