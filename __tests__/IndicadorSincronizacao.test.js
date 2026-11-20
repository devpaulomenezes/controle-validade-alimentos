/* global describe, it, expect, beforeEach, afterEach, jest, __dirname */
/**
 * Testes da APP-08: componente IndicadorSincronizacao (banner oculto,
 * singular/plural, "Sincronizando..." e toque) e sua integração na
 * TelaInicial (banner que some quando a fila esvazia e puxar para atualizar).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { Alert, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import IndicadorSincronizacao from '../components/IndicadorSincronizacao';
import TelaInicial from '../app/TelaInicial';
import repositorio from '../data/OfflineFirstProdutoRepository';
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
  default: { logout: jest.fn(async () => {}) },
}));

jest.mock('../services/NotificacoesService', () => ({
  __esModule: true,
  default: { cancelarAlerta: jest.fn() },
}));

jest.mock('../services/CameraService', () => ({
  __esModule: true,
  default: { removerFoto: jest.fn() },
}));

// O ThemeProvider (TEMA-01) lê tema.json ao montar: sem o arquivo, usa o tema claro.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => {}),
}));

// Como o useFocusEffect: roda ao montar e quando a identidade do callback muda.
// `mockFoco.ganharFoco()` simula a tela voltar a ter foco (ex.: retorno do cadastro).
const mockFoco = { efeito: null, ganharFoco: () => mockFoco.efeito() };
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: (efeito) => {
      mockFoco.efeito = efeito;
      useEffect(efeito, [efeito]);
    },
  };
});

const PRODUTO = {
  id: 'p1',
  nome: 'Leite',
  quantidade: 1,
  dataDeValidade: '2030-01-01',
  fotoUri: null,
  dataDeCadastro: '2026-11-01T10:00:00.000Z',
};

function promessaPendente() {
  let resolver;
  let rejeitar;
  const promessa = new Promise((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

function utilitarios(renderer) {
  const raiz = renderer.root;
  return {
    temTexto: (texto) => raiz.findAll((no) => no.props.children === texto).length > 0,
    banner: () =>
      raiz.findAll(
        (no) =>
          typeof no.props.onPress === 'function' &&
          typeof no.props.accessibilityLabel === 'string' &&
          /^(Modo offline|Sincronizando)/.test(no.props.accessibilityLabel)
      )[0],
    raiz,
  };
}

describe('IndicadorSincronizacao (componente)', () => {
  async function renderizar(props) {
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<IndicadorSincronizacao {...props} />);
    });
    return { renderer, ...utilitarios(renderer) };
  }

  it('não aparece sem pendências e sem sincronização em andamento', async () => {
    const { renderer } = await renderizar({ pendentes: 0, sincronizando: false, aoSincronizar: jest.fn() });
    expect(renderer.toJSON()).toBeNull();
  });

  it('com 1 pendência, usa o singular', async () => {
    const tela = await renderizar({ pendentes: 1, sincronizando: false });
    expect(tela.temTexto('Modo offline: 1 alteração aguardando conexão')).toBe(true);
  });

  it('com várias pendências, usa o plural e a quantidade correta', async () => {
    const tela = await renderizar({ pendentes: 3, sincronizando: false });
    expect(tela.temTexto('Modo offline: 3 alterações aguardando conexão')).toBe(true);
  });

  it('durante a sincronização, mostra "Sincronizando..." com indicador e fica desabilitado', async () => {
    const tela = await renderizar({ pendentes: 2, sincronizando: true, aoSincronizar: jest.fn() });

    expect(tela.temTexto('Sincronizando...')).toBe(true);
    expect(tela.temTexto('Modo offline: 2 alterações aguardando conexão')).toBe(false);
    expect(tela.raiz.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(tela.banner().props.disabled).toBe(true);
  });

  it('aparece também sem pendências quando a sincronização está em andamento', async () => {
    const tela = await renderizar({ pendentes: 0, sincronizando: true });
    expect(tela.temTexto('Sincronizando...')).toBe(true);
  });

  it('tocar no banner chama aoSincronizar uma vez', async () => {
    const aoSincronizar = jest.fn();
    const tela = await renderizar({ pendentes: 2, sincronizando: false, aoSincronizar });

    await act(async () => {
      tela.banner().props.onPress();
    });

    expect(aoSincronizar).toHaveBeenCalledTimes(1);
    expect(tela.banner().props.disabled).toBe(false);
  });

  it('não importa a FilaSincronizacao nem nenhum repositório', () => {
    const fonte = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'IndicadorSincronizacao.js'),
      'utf8'
    );
    const importacoes = fonte.match(/from\s+['"][^'"]+['"]/g) ?? [];

    expect(importacoes.length).toBeGreaterThan(0);
    importacoes.forEach((importacao) => {
      expect(importacao).not.toMatch(/data\/|FilaSincronizacao|Repository/);
    });
  });
});

describe('TelaInicial: banner de sincronização e puxar para atualizar (APP-08)', () => {
  async function renderizarTela() {
    const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <TelaInicial navigation={navigation} aoDeslogar={jest.fn()} aoSessaoExpirada={jest.fn()} />
        </ThemeProvider>
      );
    });
    const util = utilitarios(renderer);
    return {
      ...util,
      controleAtualizacao: () => {
        const [lista] = util.raiz.findAllByType(FlatList);
        if (lista) return lista.props.refreshControl;
        return util.raiz.findAllByType(ScrollView).find((no) => no.props.refreshControl)?.props
          .refreshControl;
      },
      async desmontar() {
        await act(async () => {
          renderer.unmount();
        });
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    repositorio.sincronizar.mockResolvedValue({ sessaoExpirada: false });
    repositorio.listar.mockResolvedValue([PRODUTO]);
    repositorio.quantidadePendente.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sem pendências, o banner não aparece', async () => {
    const tela = await renderizarTela();

    expect(tela.banner()).toBeUndefined();
    await tela.desmontar();
  });

  it('mostra "Sincronizando..." na sincronização do foco e some quando a fila esvazia, sem ação do usuário', async () => {
    repositorio.quantidadePendente.mockResolvedValue(2);
    const tela = await renderizarTela();
    expect(tela.temTexto('Modo offline: 2 alterações aguardando conexão')).toBe(true);

    // A tela volta a ter foco (ex.: retorno do cadastro) com a conexão de volta.
    const pendente = promessaPendente();
    repositorio.sincronizar.mockReturnValue(pendente.promessa);
    await act(async () => {
      mockFoco.ganharFoco();
    });
    expect(tela.temTexto('Sincronizando...')).toBe(true);

    repositorio.quantidadePendente.mockResolvedValue(0);
    await act(async () => {
      pendente.resolver({ sessaoExpirada: false });
    });

    expect(tela.temTexto('Sincronizando...')).toBe(false);
    expect(tela.banner()).toBeUndefined();
    await tela.desmontar();
  });

  it('com pendências após a sincronização, mostra a quantidade aguardando conexão', async () => {
    repositorio.quantidadePendente.mockResolvedValue(2);
    const tela = await renderizarTela();

    expect(tela.temTexto('Modo offline: 2 alterações aguardando conexão')).toBe(true);
    await tela.desmontar();
  });

  it('tocar no banner chama sincronizar() uma vez, mesmo com toque repetido durante o envio', async () => {
    repositorio.quantidadePendente.mockResolvedValue(1);
    const tela = await renderizarTela();
    expect(repositorio.sincronizar).toHaveBeenCalledTimes(1); // foco

    const pendente = promessaPendente();
    repositorio.sincronizar.mockReturnValue(pendente.promessa);
    const onPress = tela.banner().props.onPress;
    await act(async () => {
      onPress();
    });
    expect(tela.temTexto('Sincronizando...')).toBe(true);
    await act(async () => {
      onPress(); // segundo toque com a sincronização ainda em andamento: ignorado
    });

    expect(repositorio.sincronizar).toHaveBeenCalledTimes(2);

    repositorio.quantidadePendente.mockResolvedValue(0);
    await act(async () => {
      pendente.resolver({ sessaoExpirada: false });
    });
    expect(tela.banner()).toBeUndefined();
    await tela.desmontar();
  });

  it('puxar a lista chama sincronizar() e exibe o indicador de carregamento até terminar', async () => {
    const tela = await renderizarTela();
    expect(tela.controleAtualizacao().props.refreshing).toBe(false);

    const pendente = promessaPendente();
    repositorio.sincronizar.mockReturnValue(pendente.promessa);
    await act(async () => {
      tela.controleAtualizacao().props.onRefresh();
    });

    expect(repositorio.sincronizar).toHaveBeenCalledTimes(2); // foco + puxar
    expect(tela.controleAtualizacao().props.refreshing).toBe(true);

    await act(async () => {
      pendente.resolver({ sessaoExpirada: false });
    });

    expect(tela.controleAtualizacao().props.refreshing).toBe(false);
    expect(repositorio.listar).toHaveBeenCalledTimes(2); // a lista foi recarregada
    await tela.desmontar();
  });

  it('puxar a lista durante uma sincronização em andamento mantém o indicador até ela terminar', async () => {
    const tela = await renderizarTela();
    const pendente = promessaPendente();
    repositorio.sincronizar.mockReturnValue(pendente.promessa);
    await act(async () => {
      mockFoco.ganharFoco(); // sincronização do foco fica em andamento
    });

    await act(async () => {
      tela.controleAtualizacao().props.onRefresh();
    });

    expect(repositorio.sincronizar).toHaveBeenCalledTimes(2); // montagem + foco; o puxar reaproveitou
    expect(tela.controleAtualizacao().props.refreshing).toBe(true);

    await act(async () => {
      pendente.resolver({ sessaoExpirada: false });
    });
    expect(tela.controleAtualizacao().props.refreshing).toBe(false);
    await tela.desmontar();
  });

  it('erro ou 401 na sincronização não deixam o banner preso em "Sincronizando..."', async () => {
    repositorio.quantidadePendente.mockResolvedValue(1);
    const tela = await renderizarTela();
    const comErro = promessaPendente();
    repositorio.sincronizar.mockReturnValue(comErro.promessa);
    await act(async () => {
      mockFoco.ganharFoco();
    });
    expect(tela.temTexto('Sincronizando...')).toBe(true);

    await act(async () => {
      comErro.rejeitar(new Error('falha inesperada'));
    });
    expect(tela.temTexto('Sincronizando...')).toBe(false);
    expect(tela.temTexto('Modo offline: 1 alteração aguardando conexão')).toBe(true);

    const com401 = promessaPendente();
    repositorio.sincronizar.mockReturnValue(com401.promessa);
    await act(async () => {
      tela.banner().props.onPress();
    });
    expect(tela.temTexto('Sincronizando...')).toBe(true);
    await act(async () => {
      com401.resolver({ sessaoExpirada: true });
    });
    expect(tela.temTexto('Sincronizando...')).toBe(false);
    await tela.desmontar();
  });

  it('com a lista vazia, o banner e o puxar para atualizar continuam disponíveis', async () => {
    repositorio.listar.mockResolvedValue([]);
    repositorio.quantidadePendente.mockResolvedValue(1);
    const tela = await renderizarTela();

    expect(tela.temTexto('Nenhum produto cadastrado')).toBe(true);
    expect(tela.temTexto('Modo offline: 1 alteração aguardando conexão')).toBe(true);

    await act(async () => {
      tela.controleAtualizacao().props.onRefresh();
    });
    expect(repositorio.sincronizar).toHaveBeenCalledTimes(2);
    await tela.desmontar();
  });
});
