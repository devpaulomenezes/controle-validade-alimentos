/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes do OfflineFirstProdutoRepository (APP-05). As três fontes — cache
 * local, fila offline e API — são fakes em memória injetados pelo construtor;
 * nenhum teste depende de rede nem do FileSystem real.
 */
import { OfflineFirstProdutoRepository } from '../data/OfflineFirstProdutoRepository';
import ProdutoRepository from '../data/ProdutoRepository';

// Os singletons padrão (JsonProdutoRepository, FilaSincronizacao e AuthService)
// leem FileSystem.documentDirectory ao serem importados.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => '[]'),
  writeAsStringAsync: jest.fn(async () => {}),
  moveAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

// Mensagens no formato real do ApiProdutoRepository (sem campo .status).
const ERRO_REDE = () => new Error('Falha de conexão com o servidor. Verifique sua internet.');
const erroStatus = (status) => new Error(`Erro do servidor (status ${status}).`);
const ERRO_404_ATUALIZAR = () => new Error('Produto não encontrado para atualização.');

/** Espera o fim do que foi disparado em segundo plano (os fakes só usam microtasks). */
const aguardarSegundoPlano = () => new Promise((resolve) => setImmediate(resolve));

function criarFilaFake(itensIniciais = []) {
  let itens = itensIniciais.map((item) => ({ ...item }));
  let contador = 0;
  return {
    listar: jest.fn(async () => itens.map((item) => ({ ...item }))),
    enfileirar: jest.fn(async ({ tipo, produtoId, payload, usuarioId }) => {
      contador += 1;
      const operacao = { idOperacao: `op-${contador}`, tipo, produtoId, payload, usuarioId };
      itens.push(operacao);
      return operacao;
    }),
    removerOperacao: jest.fn(async (idOperacao) => {
      itens = itens.filter((item) => item.idOperacao !== idOperacao);
    }),
    _itens: () => itens,
  };
}

function criarLocalRepoFake() {
  let produtos = [];
  let contador = 0;
  return {
    async listar() {
      return produtos.map((p) => ({ ...p }));
    },
    async salvar(produto) {
      contador += 1;
      const novo = { ...produto, id: produto.id || `local-${contador}` };
      produtos.push(novo);
      return { ...novo };
    },
    async atualizar(produto) {
      const indice = produtos.findIndex((p) => p.id === produto.id);
      if (indice === -1) throw new Error(`Produto ${produto.id} não encontrado`);
      produtos[indice] = { ...produto };
    },
    async remover(id) {
      produtos = produtos.filter((p) => p.id !== id);
    },
    async buscarPorId(id) {
      const produto = produtos.find((p) => p.id === id);
      return produto ? { ...produto } : null;
    },
    substituirTodos: jest.fn(async (lista) => {
      produtos = lista.map((p) => ({ ...p }));
    }),
    limpar: jest.fn(async () => {
      produtos = [];
    }),
    _produtos: () => produtos,
  };
}

/**
 * API fake com estado (como o servidor real): guarda o que recebe e devolve
 * em listar(). `online = false` faz toda chamada falhar como sem conexão.
 * `chamadas` registra a ordem dos envios.
 */
function criarRemotoFake() {
  let produtos = [];
  const chamadas = [];
  const remoto = {
    online: true,
    chamadas,
    listar: jest.fn(async () => {
      exigirConexao();
      return produtos.map((p) => ({ ...p }));
    }),
    salvar: jest.fn(async (produto) => {
      exigirConexao();
      chamadas.push(['salvar', produto.id]);
      if (!produtos.some((p) => p.id === produto.id)) produtos.push({ ...produto });
    }),
    atualizar: jest.fn(async (produto) => {
      exigirConexao();
      chamadas.push(['atualizar', produto.id]);
      produtos = produtos.map((p) => (p.id === produto.id ? { ...produto } : p));
    }),
    remover: jest.fn(async (id) => {
      exigirConexao();
      chamadas.push(['remover', id]);
      produtos = produtos.filter((p) => p.id !== id);
    }),
    _produtos: () => produtos,
  };
  function exigirConexao() {
    if (!remoto.online) throw ERRO_REDE();
  }
  return remoto;
}

function criarRepositorio({ fila, usuarioId = 'u1' } = {}) {
  const local = criarLocalRepoFake();
  const remoto = criarRemotoFake();
  const filaUsada = fila ?? criarFilaFake();
  const repo = new OfflineFirstProdutoRepository({
    localRepo: local,
    remotoRepo: remoto,
    fila: filaUsada,
    obterUsuarioId: jest.fn(async () => usuarioId),
  });
  return { repo, local, remoto, fila: filaUsada };
}

const produto = (nome) => ({ nome, quantidade: 1, dataDeValidade: '2026-12-31', fotoUri: null });

/** Volta a conexão e zera as contagens das tentativas que falharam offline. */
function reconectar(remoto) {
  remoto.online = true;
  ['listar', 'salvar', 'atualizar', 'remover'].forEach((metodo) => remoto[metodo].mockClear());
}

/** Grava sem conexão e espera a tentativa de envio em segundo plano falhar. */
async function escreverOffline(contexto, escrita) {
  contexto.remoto.online = false;
  const resultado = await escrita(contexto.repo);
  await aguardarSegundoPlano();
  return resultado;
}

describe('OfflineFirstProdutoRepository', () => {
  let consoleErro;

  beforeEach(() => {
    consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('implementa o contrato ProdutoRepository', () => {
    const { repo } = criarRepositorio();
    expect(repo).toBeInstanceOf(ProdutoRepository);
  });

  describe('sem conexão', () => {
    it('salvar, atualizar, remover, listar e buscarPorId funcionam sem lançar erro de rede', async () => {
      const contexto = criarRepositorio();
      const { repo, remoto } = contexto;
      remoto.online = false;

      const leite = await repo.salvar(produto('Leite'));
      const arroz = await repo.salvar(produto('Arroz'));
      await repo.atualizar({ ...leite, quantidade: 3 });
      await repo.remover(arroz.id);

      await expect(repo.listar()).resolves.toEqual([{ ...leite, quantidade: 3 }]);
      await expect(repo.buscarPorId(leite.id)).resolves.toEqual({ ...leite, quantidade: 3 });
      await expect(repo.buscarPorId(arroz.id)).resolves.toBeNull();
      expect(contexto.local.substituirTodos).not.toHaveBeenCalled();
    });

    it('cada escrita gera exatamente um item na fila, com usuarioId preenchido', async () => {
      const contexto = criarRepositorio({ usuarioId: 'u1' });

      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      await escreverOffline(contexto, (repo) => repo.atualizar({ ...leite, quantidade: 2 }));
      await escreverOffline(contexto, (repo) => repo.remover(leite.id));

      expect(contexto.fila._itens()).toEqual([
        { idOperacao: 'op-1', tipo: 'SALVAR', produtoId: leite.id, payload: leite, usuarioId: 'u1' },
        {
          idOperacao: 'op-2',
          tipo: 'ATUALIZAR',
          produtoId: leite.id,
          payload: { ...leite, quantidade: 2 },
          usuarioId: 'u1',
        },
        { idOperacao: 'op-3', tipo: 'REMOVER', produtoId: leite.id, payload: null, usuarioId: 'u1' },
      ]);
    });

    it('a escrita grava no cache local e não espera a resposta da API', async () => {
      const { repo, local, remoto, fila } = criarRepositorio();
      remoto.salvar.mockImplementation(() => new Promise(() => {})); // servidor que nunca responde

      const salvo = await repo.salvar(produto('Leite'));

      expect(local._produtos()).toEqual([salvo]);
      expect(fila._itens()).toHaveLength(1);
    });

    it('falha ao enfileirar não é lançada para a tela (o cache local já foi gravado)', async () => {
      const { repo, local, fila } = criarRepositorio();
      fila.enfileirar.mockRejectedValueOnce(new Error('disco cheio'));

      const salvo = await repo.salvar(produto('Leite'));

      expect(local._produtos()).toEqual([salvo]);
      expect(consoleErro).toHaveBeenCalled();
    });
  });

  describe('sincronizar()', () => {
    it('com a conexão restabelecida, envia a fila na ordem de criação, mapeando cada tipo', async () => {
      const contexto = criarRepositorio();
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const arroz = await escreverOffline(contexto, (repo) => repo.salvar(produto('Arroz')));
      await escreverOffline(contexto, (repo) => repo.atualizar({ ...leite, quantidade: 5 }));
      await escreverOffline(contexto, (repo) => repo.remover(arroz.id));
      const { repo, remoto, fila, local } = contexto;

      reconectar(remoto);
      const resultado = await repo.sincronizar();

      expect(resultado).toEqual({ sessaoExpirada: false });
      expect(remoto.chamadas).toEqual([
        ['salvar', leite.id],
        ['salvar', arroz.id],
        ['atualizar', leite.id],
        ['remover', arroz.id],
      ]);
      // SALVAR/ATUALIZAR enviam o payload; REMOVER envia só o produtoId (o mesmo id do cliente).
      expect(remoto.salvar).toHaveBeenNthCalledWith(1, leite);
      expect(remoto.atualizar).toHaveBeenCalledWith({ ...leite, quantidade: 5 });
      expect(remoto.remover).toHaveBeenCalledWith(arroz.id);
      expect(fila._itens()).toEqual([]);
      // Fila vazia: o cache passa a espelhar o servidor.
      expect(local.substituirTodos).toHaveBeenCalledTimes(1);
      expect(local._produtos()).toEqual([{ ...leite, quantidade: 5 }]);
    });

    it('falha de rede no meio da fila não reenvia os já processados e retoma do item que falhou', async () => {
      const contexto = criarRepositorio();
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      await escreverOffline(contexto, (repo) => repo.atualizar({ ...leite, quantidade: 2 }));
      const feijao = await escreverOffline(contexto, (repo) => repo.salvar(produto('Feijão')));
      const { repo, remoto, fila } = contexto;

      reconectar(remoto);
      remoto.atualizar.mockRejectedValueOnce(ERRO_REDE());
      await repo.sincronizar();

      expect(remoto.chamadas).toEqual([['salvar', leite.id]]);
      expect(fila._itens().map((item) => item.tipo)).toEqual(['ATUALIZAR', 'SALVAR']);

      await repo.sincronizar();

      expect(remoto.chamadas).toEqual([
        ['salvar', leite.id],
        ['atualizar', leite.id],
        ['salvar', feijao.id],
      ]);
      expect(remoto.salvar).toHaveBeenCalledTimes(2); // o primeiro item não foi reenviado
      expect(fila._itens()).toEqual([]);
    });

    it('erro 5xx interrompe e mantém o item e os seguintes na fila, sem substituir o cache', async () => {
      const contexto = criarRepositorio();
      await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      await escreverOffline(contexto, (repo) => repo.salvar(produto('Arroz')));
      const { repo, remoto, fila, local } = contexto;

      reconectar(remoto);
      remoto.salvar.mockRejectedValueOnce(erroStatus(503));
      const resultado = await repo.sincronizar();

      expect(resultado).toEqual({ sessaoExpirada: false });
      expect(remoto.salvar).toHaveBeenCalledTimes(1);
      expect(fila._itens()).toHaveLength(2);
      expect(local.substituirTodos).not.toHaveBeenCalled();
    });

    it('erro 4xx (exceto 401) descarta o item, registra no console e não bloqueia os seguintes', async () => {
      const contexto = criarRepositorio();
      const invalido = await escreverOffline(contexto, (repo) => repo.salvar(produto('Inválido')));
      const fantasma = await escreverOffline(contexto, (repo) => repo.salvar(produto('Fantasma')));
      await escreverOffline(contexto, (repo) => repo.atualizar({ ...fantasma, quantidade: 9 }));
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const { repo, remoto, fila } = contexto;

      reconectar(remoto);
      remoto.salvar.mockRejectedValueOnce(erroStatus(400)); // Inválido
      remoto.salvar.mockRejectedValueOnce(erroStatus(409)); // Fantasma
      remoto.atualizar.mockRejectedValueOnce(ERRO_404_ATUALIZAR());
      consoleErro.mockClear();
      const resultado = await repo.sincronizar();

      expect(resultado).toEqual({ sessaoExpirada: false });
      expect(remoto.chamadas).toEqual([['salvar', leite.id]]);
      expect(fila._itens()).toEqual([]);
      expect(consoleErro).toHaveBeenCalledTimes(3);
      expect(remoto._produtos().map((p) => p.id)).toEqual([leite.id]);
      expect(remoto._produtos().some((p) => p.id === invalido.id)).toBe(false);
    });

    it('erro 401 interrompe a sincronização e mantém os itens na fila', async () => {
      const contexto = criarRepositorio();
      await escreverOffline(contexto, (repo) => repo.salvar(produto('A')));
      await escreverOffline(contexto, (repo) => repo.salvar(produto('B')));
      const { repo, remoto, fila, local } = contexto;

      reconectar(remoto);
      const erro401 = erroStatus(401);
      erro401.status = 401; // um .status numérico, quando existir, tem prioridade sobre a mensagem
      remoto.salvar.mockRejectedValue(erro401);
      const resultado = await repo.sincronizar();

      expect(resultado).toEqual({ sessaoExpirada: true });
      expect(remoto.salvar).toHaveBeenCalledTimes(1);
      expect(fila._itens()).toHaveLength(2);
      expect(local.substituirTodos).not.toHaveBeenCalled();
    });

    it('401 ao buscar a base remota também sinaliza sessão expirada', async () => {
      const { repo, remoto, local } = criarRepositorio();
      remoto.listar.mockRejectedValueOnce(erroStatus(401));

      await expect(repo.sincronizar()).resolves.toEqual({ sessaoExpirada: true });
      expect(local.substituirTodos).not.toHaveBeenCalled();
    });

    it('itens de outros usuários na fila não são enviados nem removidos', async () => {
      const itemDeOutro = {
        idOperacao: 'outro-1',
        tipo: 'SALVAR',
        produtoId: 'p-u2',
        payload: { id: 'p-u2', nome: 'Do outro usuário' },
        usuarioId: 'u2',
      };
      const contexto = criarRepositorio({ fila: criarFilaFake([itemDeOutro]), usuarioId: 'u1' });
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const { repo, remoto, fila, local } = contexto;

      reconectar(remoto);
      await repo.sincronizar();

      expect(remoto.chamadas).toEqual([['salvar', leite.id]]);
      expect(fila._itens()).toEqual([itemDeOutro]);
      // A fila do usuário atual esvaziou; os itens do outro não impedem a atualização do cache.
      expect(local.substituirTodos).toHaveBeenCalledTimes(1);
    });

    it('substituirTodos é chamado somente quando a fila do usuário está vazia', async () => {
      const contexto = criarRepositorio();
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const { repo, remoto, local } = contexto;

      // Com pendência e sem conexão: nunca substitui (apagaria a alteração offline).
      await repo.sincronizar();
      await repo.listar();
      expect(local.substituirTodos).not.toHaveBeenCalled();

      reconectar(remoto);
      await repo.sincronizar();

      expect(local.substituirTodos).toHaveBeenCalledTimes(1);
      expect(local.substituirTodos).toHaveBeenCalledWith([leite]);
    });

    it('duas chamadas simultâneas de sincronizar() não enviam o mesmo item duas vezes', async () => {
      const contexto = criarRepositorio();
      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const arroz = await escreverOffline(contexto, (repo) => repo.salvar(produto('Arroz')));
      const { repo, remoto, fila } = contexto;

      reconectar(remoto);
      const primeira = repo.sincronizar();
      const segunda = repo.sincronizar();
      const [resultado1, resultado2] = await Promise.all([primeira, segunda]);

      expect(segunda).toBe(primeira); // a segunda chamada reaproveita a que está em andamento
      expect(resultado1).toEqual({ sessaoExpirada: false });
      expect(resultado2).toEqual(resultado1);
      expect(remoto.chamadas).toEqual([
        ['salvar', leite.id],
        ['salvar', arroz.id],
      ]);
      expect(fila._itens()).toEqual([]);
    });

    it('a trava é liberada mesmo quando a sincronização termina com erro', async () => {
      const contexto = criarRepositorio();
      await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      const { repo, remoto, fila } = contexto;

      reconectar(remoto);
      fila.listar.mockRejectedValueOnce(new Error('falha de leitura da fila'));
      await expect(repo.sincronizar()).rejects.toThrow('falha de leitura da fila');

      await expect(repo.sincronizar()).resolves.toEqual({ sessaoExpirada: false });
      expect(remoto.salvar).toHaveBeenCalledTimes(1);
      expect(fila._itens()).toEqual([]);
    });

    it('escrita feita durante a busca da base remota não é apagada do cache', async () => {
      const { repo, remoto, local } = criarRepositorio();
      let liberarListar;
      remoto.listar.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            liberarListar = () => resolve([]); // o servidor ainda não tem o produto novo
          })
      );

      const sincronizacao = repo.sincronizar(); // fila vazia: fica esperando a base remota
      await aguardarSegundoPlano();
      const leite = await repo.salvar(produto('Leite')); // escrita no meio da sincronização
      liberarListar();
      await sincronizacao;

      // A rodada viu a pendência, enviou o produto e só então espelhou o servidor.
      expect(remoto.chamadas).toEqual([['salvar', leite.id]]);
      expect(local.substituirTodos).toHaveBeenCalledTimes(1);
      expect(local.substituirTodos).toHaveBeenCalledWith([leite]);
      expect(local._produtos()).toEqual([leite]);
    });

    it('listar e buscarPorId devolvem o cache já atualizado pela base do servidor', async () => {
      const { repo, remoto } = criarRepositorio();
      await remoto.salvar({ id: 'srv-1', nome: 'Do servidor', quantidade: 1 });
      remoto.chamadas.length = 0;

      await expect(repo.listar()).resolves.toEqual([{ id: 'srv-1', nome: 'Do servidor', quantidade: 1 }]);
      await expect(repo.buscarPorId('srv-1')).resolves.toEqual({
        id: 'srv-1',
        nome: 'Do servidor',
        quantidade: 1,
      });
    });
  });

  describe('apoio ao logout (APP-07)', () => {
    it('quantidadePendente conta só as operações do usuário atual', async () => {
      const itemDeOutro = { idOperacao: 'outro-1', tipo: 'REMOVER', produtoId: 'x', payload: null, usuarioId: 'u2' };
      const contexto = criarRepositorio({ fila: criarFilaFake([itemDeOutro]), usuarioId: 'u1' });
      expect(await contexto.repo.quantidadePendente()).toBe(0);

      const leite = await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));
      await escreverOffline(contexto, (repo) => repo.remover(leite.id));

      expect(await contexto.repo.quantidadePendente()).toBe(2);
      reconectar(contexto.remoto);
      await contexto.repo.sincronizar();
      expect(await contexto.repo.quantidadePendente()).toBe(0);
    });

    it('limparCacheLocal esvazia o cache local e não mexe na fila', async () => {
      const contexto = criarRepositorio();
      await escreverOffline(contexto, (repo) => repo.salvar(produto('Leite')));

      await contexto.repo.limparCacheLocal();

      expect(contexto.local.limpar).toHaveBeenCalledTimes(1);
      expect(contexto.local._produtos()).toEqual([]);
      expect(contexto.fila._itens()).toHaveLength(1);
    });
  });
});
