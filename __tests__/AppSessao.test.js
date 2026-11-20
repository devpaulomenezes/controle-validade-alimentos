/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes do App.js (APP-07): escolha da stack pela sessão local, troca para a
 * stack principal após o login (sem voltar ao login), logout e sessão expirada.
 * Usa o NavigationContainer e o native stack reais; as telas são simuladas e
 * guardam as props recebidas em `mockTelas`, para o teste acionar os callbacks.
 */
import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import AuthService from '../services/AuthService';

const mockTelas = {};

jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: { obterSessao: jest.fn() },
}));

// O ThemeProvider (TEMA-01) lê tema.json ao abrir: sem o arquivo, usa o tema claro.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => {}),
}));

jest.mock('../app/TelaLogin', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function TelaLoginSimulada(props) {
    mockTelas.login = props;
    return React.createElement(Text, null, 'Tela de login');
  };
});

jest.mock('../app/TelaInicial', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function TelaInicialSimulada(props) {
    mockTelas.inicial = props;
    return React.createElement(Text, null, 'Tela inicial');
  };
});

jest.mock('../app/TelaCadastro', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function TelaCadastroSimulada() {
    return React.createElement(Text, null, 'Tela de cadastro');
  };
});

jest.mock('../app/TelaDetalhe', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function TelaDetalheSimulada() {
    return React.createElement(Text, null, 'Tela de detalhe');
  };
});

const SESSAO = { token: 'tok-1', usuario: { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com' } };

async function renderizarApp() {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<App />);
  });
  const textos = () => renderer.root.findAllByType(Text).map((no) => no.props.children);
  return {
    mostra: (texto) => textos().includes(texto),
    async executar(callback) {
      await act(async () => {
        callback();
      });
    },
    async desmontar() {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

describe('App: sessão e navegação (APP-07)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const chave of Object.keys(mockTelas)) delete mockTelas[chave];
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sem sessão salva, abre na TelaLogin', async () => {
    AuthService.obterSessao.mockResolvedValue(null);
    const app = await renderizarApp();

    expect(app.mostra('Tela de login')).toBe(true);
    expect(app.mostra('Tela inicial')).toBe(false);
    expect(typeof mockTelas.login.aoAutenticar).toBe('function');
    await app.desmontar();
  });

  it('com sessão salva, abre direto na lista (só lê a sessão local, sem rede)', async () => {
    AuthService.obterSessao.mockResolvedValue(SESSAO);
    const app = await renderizarApp();

    expect(app.mostra('Tela inicial')).toBe(true);
    expect(app.mostra('Tela de login')).toBe(false);
    expect(AuthService.obterSessao).toHaveBeenCalledTimes(1);
    await app.desmontar();
  });

  it('após o login, troca para a stack principal sem permitir voltar ao login', async () => {
    AuthService.obterSessao.mockResolvedValue(null);
    const app = await renderizarApp();

    await app.executar(() => mockTelas.login.aoAutenticar(SESSAO.usuario));

    expect(app.mostra('Tela inicial')).toBe(true);
    expect(app.mostra('Tela de login')).toBe(false);
    const { navigation } = mockTelas.inicial;
    expect(navigation.canGoBack()).toBe(false);
    expect(navigation.getState().routes.map((rota) => rota.name)).toEqual(['Inicial']);
    expect(navigation.getState().routeNames).not.toContain('Login');
    await app.desmontar();
  });

  it('"Sair" (aoDeslogar) volta para a TelaLogin', async () => {
    AuthService.obterSessao.mockResolvedValue(SESSAO);
    const app = await renderizarApp();

    await app.executar(() => mockTelas.inicial.aoDeslogar());

    expect(app.mostra('Tela de login')).toBe(true);
    expect(app.mostra('Tela inicial')).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    await app.desmontar();
  });

  it('sessão expirada volta para a TelaLogin com o aviso', async () => {
    AuthService.obterSessao.mockResolvedValue(SESSAO);
    const app = await renderizarApp();

    await app.executar(() => mockTelas.inicial.aoSessaoExpirada());

    expect(app.mostra('Tela de login')).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sessão expirada',
      'Sua sessão expirou. Entre novamente para sincronizar as alterações.'
    );
    await app.desmontar();
  });
});
