/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes da TelaInicial na APP-07: sincronização no foco, botão "Sair"
 * (bloqueado com pendências; sem pendências limpa o cache e desloga) e
 * sessão expirada (401). Repositório e AuthService são mocks.
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import TelaInicial from '../app/TelaInicial';
import repositorio from '../data/OfflineFirstProdutoRepository';
import AuthService from '../services/AuthService';
import { ThemeProvider } from '../theme/ThemeContext';

jest.mock('../data/OfflineFirstProdutoRepository', () => ({
  __esModule: true,
  default: {
    sincronizar: jest.fn(),
    listar: jest.fn(),
    quantidadePendente: jest.fn(),
    limparCacheLocal: jest.fn(),
    remover: jest.fn(),
  },
}));

jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: { logout: jest.fn() },
}));

jest.mock('../services/NotificacoesService', () => ({
  __esModule: true,
  default: { cancelarAlerta: jest.fn() },
}));

jest.mock('../services/CameraService', () => ({
  __esModule: true,
  default: { removerFoto: jest.fn() },
}));

// useFocusEffect reexecuta o efeito quando a identidade do callback muda; o
// mock reproduz isso com useEffect([efeito]), então um callback instável
// faria sincronizar() ser chamado em loop e o teste de foco falharia.
// O ThemeProvider (TEMA-01) lê tema.json ao montar: sem o arquivo, usa o tema claro.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => {}),
}));

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (efeito) => useEffect(efeito, [efeito]) };
});

async function renderizar() {
  const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
  const aoDeslogar = jest.fn();
  const aoSessaoExpirada = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <TelaInicial
          navigation={navigation}
          aoDeslogar={aoDeslogar}
          aoSessaoExpirada={aoSessaoExpirada}
        />
      </ThemeProvider>
    );
  });
  return {
    aoDeslogar,
    aoSessaoExpirada,
    async tocarSair() {
      const opcoes = navigation.setOptions.mock.calls.at(-1)[0];
      await act(async () => {
        await opcoes.headerLeft().props.onPress();
      });
    },
    async desmontar() {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

describe('TelaInicial: sessão e sincronização (APP-07)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    repositorio.sincronizar.mockResolvedValue({ sessaoExpirada: false });
    repositorio.listar.mockResolvedValue([]);
    repositorio.quantidadePendente.mockResolvedValue(0);
    repositorio.limparCacheLocal.mockResolvedValue();
    AuthService.logout.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ao ganhar foco sincroniza uma única vez (sem loop) e carrega a lista', async () => {
    const tela = await renderizar();

    expect(repositorio.sincronizar).toHaveBeenCalledTimes(1);
    expect(repositorio.listar).toHaveBeenCalledTimes(1);
    await tela.desmontar();
  });

  it('"Sair" com pendências avisa e não limpa o cache nem desloga', async () => {
    const tela = await renderizar();
    repositorio.quantidadePendente.mockResolvedValue(2);

    await tela.tocarSair();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Alterações não sincronizadas',
      expect.stringContaining('2 alterações')
    );
    expect(repositorio.limparCacheLocal).not.toHaveBeenCalled();
    expect(AuthService.logout).not.toHaveBeenCalled();
    expect(tela.aoDeslogar).not.toHaveBeenCalled();
    await tela.desmontar();
  });

  it('"Sair" sem pendências limpa o cache, apaga a sessão e avisa o App, nessa ordem', async () => {
    const ordem = [];
    repositorio.limparCacheLocal.mockImplementation(async () => ordem.push('limparCacheLocal'));
    AuthService.logout.mockImplementation(async () => ordem.push('logout'));
    const tela = await renderizar();
    tela.aoDeslogar.mockImplementation(() => ordem.push('aoDeslogar'));

    await tela.tocarSair();

    expect(ordem).toEqual(['limparCacheLocal', 'logout', 'aoDeslogar']);
    await tela.desmontar();
  });

  it('se limpar o cache falha, mostra erro e não desloga', async () => {
    repositorio.limparCacheLocal.mockRejectedValue(new Error('Falha ao gravar.'));
    const tela = await renderizar();

    await tela.tocarSair();

    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao gravar.');
    expect(AuthService.logout).not.toHaveBeenCalled();
    expect(tela.aoDeslogar).not.toHaveBeenCalled();
    await tela.desmontar();
  });

  it('sessão expirada na sincronização apaga a sessão e avisa o App', async () => {
    repositorio.sincronizar.mockResolvedValue({ sessaoExpirada: true });
    const tela = await renderizar();

    expect(AuthService.logout).toHaveBeenCalledTimes(1);
    expect(tela.aoSessaoExpirada).toHaveBeenCalledTimes(1);
    expect(repositorio.listar).not.toHaveBeenCalled();
    expect(repositorio.limparCacheLocal).not.toHaveBeenCalled();
    await tela.desmontar();
  });

  it('falha ao sincronizar não impede carregar a lista local', async () => {
    repositorio.sincronizar.mockRejectedValue(new Error('erro inesperado'));
    const tela = await renderizar();

    expect(repositorio.listar).toHaveBeenCalledTimes(1);
    expect(tela.aoSessaoExpirada).not.toHaveBeenCalled();
    await tela.desmontar();
  });
});
