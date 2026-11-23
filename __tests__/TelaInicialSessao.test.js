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
    aguardarSincronizacao: jest.fn(),
    listar: jest.fn(),
    listarLocal: jest.fn(),
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
  let contadores;
  let cacheLocal;
  let sincronizacaoEmCurso;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    contadores = { sincronizacoes: 0, leiturasLocais: 0 };
    cacheLocal = [];
    sincronizacaoEmCurso = null;

    repositorio.sincronizar.mockImplementation(() => {
      contadores.sincronizacoes += 1;
      const promessa = Promise.resolve({ sessaoExpirada: false }).finally(() => {
        if (sincronizacaoEmCurso === promessa) sincronizacaoEmCurso = null;
      });
      sincronizacaoEmCurso = promessa;
      return promessa;
    });
    repositorio.aguardarSincronizacao.mockImplementation(
      () => sincronizacaoEmCurso ?? Promise.resolve()
    );
    repositorio.listarLocal.mockImplementation(async () => {
      contadores.leiturasLocais += 1;
      return [...cacheLocal];
    });
    // Comportamento real do OfflineFirstProdutoRepository: listar() sincroniza
    // antes de ler o cache local. Se a tela chamar listar() após sincronizar(),
    // contadores.sincronizacoes passa para 2 e o teste falha.
    repositorio.listar.mockImplementation(async () => {
      await repositorio.sincronizar().catch(() => {});
      return repositorio.listarLocal();
    });
    repositorio.quantidadePendente.mockResolvedValue(0);
    repositorio.limparCacheLocal.mockImplementation(async () => {
      cacheLocal = [];
    });
    AuthService.logout.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ao ganhar foco sincroniza uma única vez (sem loop) e carrega a lista local sem nova sincronização', async () => {
    const tela = await renderizar();

    expect(contadores).toEqual({ sincronizacoes: 1, leiturasLocais: 1 });
    expect(repositorio.sincronizar).toHaveBeenCalledTimes(1);
    expect(repositorio.listarLocal).toHaveBeenCalledTimes(1);
    expect(repositorio.listar).not.toHaveBeenCalled();
    await tela.desmontar();
  });

  it('com OfflineFirstProdutoRepository real e fakes de dados, o foco faz só 1 sincronização e 1 leitura local', async () => {
    const { OfflineFirstProdutoRepository } = jest.requireActual(
      '../data/OfflineFirstProdutoRepository'
    );
    let produtosLocais = [];
    let sincronizacoesRemotas = 0;
    let leiturasLocais = 0;
    const repoReal = new OfflineFirstProdutoRepository({
      localRepo: {
        listar: async () => {
          leiturasLocais += 1;
          return [...produtosLocais];
        },
        substituirTodos: async (lista) => {
          produtosLocais = [...lista];
        },
        limpar: async () => {
          produtosLocais = [];
        },
      },
      remotoRepo: {
        listar: async () => {
          sincronizacoesRemotas += 1;
          return [
            {
              id: 'p1',
              nome: 'Leite',
              quantidade: 1,
              dataDeValidade: '2030-01-01',
              fotoUri: null,
            },
          ];
        },
      },
      fila: {
        listar: async () => [],
      },
      obterUsuarioId: async () => 'u1',
    });

    repositorio.sincronizar.mockImplementation(() => repoReal.sincronizar());
    repositorio.aguardarSincronizacao.mockImplementation(() => repoReal.aguardarSincronizacao());
    repositorio.listar.mockImplementation(() => repoReal.listar());
    repositorio.listarLocal.mockImplementation(() => repoReal.listarLocal());
    repositorio.quantidadePendente.mockImplementation(() => repoReal.quantidadePendente());
    repositorio.limparCacheLocal.mockImplementation(() => repoReal.limparCacheLocal());

    const tela = await renderizar();

    expect(sincronizacoesRemotas).toBe(1);
    expect(leiturasLocais).toBe(1);
    expect(repositorio.listar).not.toHaveBeenCalled();
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

  it('"Sair" durante sincronização em curso aguarda o término antes de limpar o cache, sem regravar dados do usuário anterior', async () => {
    const { OfflineFirstProdutoRepository } = jest.requireActual(
      '../data/OfflineFirstProdutoRepository'
    );
    const ordem = [];
    let produtosCache = [];
    let verificouPendenciasAntesDeLimpar = false;
    let limpouCache = false;
    let concluirDownloadRemoto;
    const repoReal = new OfflineFirstProdutoRepository({
      localRepo: {
        listar: async () => [...produtosCache],
        substituirTodos: async (lista) => {
          ordem.push('substituirTodos');
          produtosCache = [...lista];
        },
        limpar: async () => {
          limpouCache = true;
          ordem.push('limparCacheLocal');
          produtosCache = [];
        },
      },
      remotoRepo: {
        listar: () =>
          new Promise((resolve) => {
            concluirDownloadRemoto = () =>
              resolve([
                {
                  id: 'p-u1',
                  nome: 'Produto do usuário anterior',
                  quantidade: 1,
                  dataDeValidade: '2030-01-01',
                  fotoUri: null,
                },
              ]);
          }),
      },
      fila: {
        listar: async () => [],
      },
      obterUsuarioId: async () => 'u1',
    });

    repositorio.sincronizar.mockImplementation(() => repoReal.sincronizar());
    repositorio.aguardarSincronizacao.mockImplementation(() => repoReal.aguardarSincronizacao());
    repositorio.listar.mockImplementation(() => repoReal.listar());
    repositorio.listarLocal.mockImplementation(() => repoReal.listarLocal());
    repositorio.quantidadePendente.mockImplementation(async () => {
      if (ordem.includes('substituirTodos') && !limpouCache) {
        verificouPendenciasAntesDeLimpar = true;
      }
      return repoReal.quantidadePendente();
    });
    repositorio.limparCacheLocal.mockImplementation(() => repoReal.limparCacheLocal());
    AuthService.logout.mockImplementation(async () => {
      ordem.push('logout');
    });

    // Monta a tela: a sincronização do foco inicia e fica aguardando a resposta do servidor.
    const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
    const aoDeslogar = jest.fn(() => ordem.push('aoDeslogar'));
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <TelaInicial
            navigation={navigation}
            aoDeslogar={aoDeslogar}
            aoSessaoExpirada={jest.fn()}
          />
        </ThemeProvider>
      );
    });

    // Usuário toca em "Sair" enquanto a sincronização ainda está em andamento.
    const opcoes = navigation.setOptions.mock.calls.at(-1)[0];
    let promessaSair;
    await act(async () => {
      promessaSair = opcoes.headerLeft().props.onPress();
    });

    // Antes de a sincronização terminar, o cache ainda não foi limpo e o logout não ocorreu.
    expect(ordem).toEqual([]);

    // O servidor responde com os dados do usuário anterior e a rodada em curso termina.
    await act(async () => {
      concluirDownloadRemoto();
      await promessaSair;
    });

    // A sincronização gravou antes; em seguida o logout verificou pendências, limpou o cache e deslogou.
    expect(verificouPendenciasAntesDeLimpar).toBe(true);
    expect(produtosCache).toEqual([]);
    expect(ordem).toEqual([
      'substituirTodos',
      'limparCacheLocal',
      'logout',
      'aoDeslogar',
    ]);
    expect(aoDeslogar).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('"Sair" com sincronização que nunca responde conclui o logout após o tempo-limite sem travar o botão, e resposta tardia não chama substituirTodos', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    try {
      const {
        OfflineFirstProdutoRepository,
        TEMPO_LIMITE_AGUARDAR_SINCRONIZACAO_MS,
      } = jest.requireActual('../data/OfflineFirstProdutoRepository');
      const ordem = [];
      let produtosCache = [];
      let usuarioSessao = 'u1';
      let responderDownloadTravado;
      const substituirTodos = jest.fn(async (lista) => {
        ordem.push('substituirTodos');
        produtosCache = [...lista];
      });
      const repoReal = new OfflineFirstProdutoRepository({
        localRepo: {
          listar: async () => [...produtosCache],
          substituirTodos,
          limpar: async () => {
            ordem.push('limparCacheLocal');
            produtosCache = [];
          },
        },
        remotoRepo: {
          listar: () =>
            new Promise((resolve) => {
              responderDownloadTravado = resolve;
            }),
        },
        fila: {
          listar: async () => [],
        },
        obterUsuarioId: async () => usuarioSessao,
      });

      repositorio.sincronizar.mockImplementation(() => repoReal.sincronizar());
      repositorio.aguardarSincronizacao.mockImplementation(() => repoReal.aguardarSincronizacao());
      repositorio.listar.mockImplementation(() => repoReal.listar());
      repositorio.listarLocal.mockImplementation(() => repoReal.listarLocal());
      repositorio.quantidadePendente.mockImplementation(() => repoReal.quantidadePendente());
      repositorio.limparCacheLocal.mockImplementation(() => repoReal.limparCacheLocal());
      AuthService.logout.mockImplementation(async () => {
        usuarioSessao = null;
        ordem.push('logout');
      });

      const navigation = { setOptions: jest.fn(), navigate: jest.fn() };
      const aoDeslogar = jest.fn(() => ordem.push('aoDeslogar'));
      let renderer;
      await act(async () => {
        renderer = TestRenderer.create(
          <ThemeProvider>
            <TelaInicial
              navigation={navigation}
              aoDeslogar={aoDeslogar}
              aoSessaoExpirada={jest.fn()}
            />
          </ThemeProvider>
        );
      });

      const botaoSair = () => navigation.setOptions.mock.calls.at(-1)[0].headerLeft();
      let promessaSair;
      await act(async () => {
        promessaSair = botaoSair().props.onPress();
      });

      // Antes do limite: o botão está em estado "saindo" (desabilitado) e o logout ainda aguarda.
      expect(botaoSair().props.disabled).toBe(true);
      expect(aoDeslogar).not.toHaveBeenCalled();

      // Atingido o tempo-limite, o logout conclui e o botão deixa de ficar travado.
      await act(async () => {
        jest.advanceTimersByTime(TEMPO_LIMITE_AGUARDAR_SINCRONIZACAO_MS);
        await promessaSair;
      });

      expect(ordem).toEqual(['limparCacheLocal', 'logout', 'aoDeslogar']);
      expect(aoDeslogar).toHaveBeenCalledTimes(1);
      expect(botaoSair().props.disabled).toBe(false);

      // Se a sincronização travada finalmente responder depois do logout, a guarda impede substituirTodos.
      await act(async () => {
        responderDownloadTravado([
          {
            id: 'p-u1',
            nome: 'Produto atrasado do usuário anterior',
            quantidade: 1,
            dataDeValidade: '2030-01-01',
            fotoUri: null,
          },
        ]);
      });

      expect(substituirTodos).not.toHaveBeenCalled();
      expect(produtosCache).toEqual([]);

      await act(async () => {
        renderer.unmount();
      });
    } finally {
      jest.useRealTimers();
    }
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
    expect(repositorio.listarLocal).not.toHaveBeenCalled();
    expect(repositorio.listar).not.toHaveBeenCalled();
    expect(repositorio.limparCacheLocal).not.toHaveBeenCalled();
    await tela.desmontar();
  });

  it('falha ao sincronizar não impede carregar a lista local', async () => {
    repositorio.sincronizar.mockRejectedValue(new Error('erro inesperado'));
    const tela = await renderizar();

    expect(repositorio.listarLocal).toHaveBeenCalledTimes(1);
    expect(repositorio.listar).not.toHaveBeenCalled();
    expect(tela.aoSessaoExpirada).not.toHaveBeenCalled();
    await tela.desmontar();
  });
});
