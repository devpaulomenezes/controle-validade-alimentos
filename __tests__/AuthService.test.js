jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import AuthService from '../services/AuthService';

const CAMINHO = 'file:///docs/sessao.json';
const dadosApi = {
  token: 'abc123',
  usuario: { id: 'u1', nome: 'Ana', email: 'ana@x.com' },
};

function resposta(status, corpo) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(corpo),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  globalThis.fetch = jest.fn();
});

describe('AuthService', () => {
  test('login com sucesso grava a sessão e retorna os dados', async () => {
    globalThis.fetch.mockResolvedValue(resposta(200, dadosApi));
    const r = await AuthService.login('ana@x.com', '123456');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      CAMINHO,
      JSON.stringify(dadosApi)
    );
    expect(r).toEqual(dadosApi);
  });

  test('registro com sucesso grava a sessão e retorna os dados', async () => {
    globalThis.fetch.mockResolvedValue(resposta(201, dadosApi));
    const r = await AuthService.registrar('Ana', 'ana@x.com', '123456');
    expect(globalThis.fetch.mock.calls[0][0]).toBe('http://api.test/auth/registro');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      CAMINHO,
      JSON.stringify(dadosApi)
    );
    expect(r).toEqual(dadosApi);
  });

  test('login com 401 lança "Credenciais inválidas." e não grava', async () => {
    globalThis.fetch.mockResolvedValue(resposta(401, { mensagem: 'x' }));
    await expect(AuthService.login('a@x.com', 'errada')).rejects.toThrow(
      'Credenciais inválidas.'
    );
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  test('registro com 409 lança a mensagem do servidor', async () => {
    globalThis.fetch.mockResolvedValue(
      resposta(409, { mensagem: 'E-mail já cadastrado no sistema.' })
    );
    await expect(
      AuthService.registrar('Ana', 'ana@x.com', '123456')
    ).rejects.toThrow('E-mail já cadastrado no sistema.');
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  test('obterSessao lê o arquivo sem fazer requisição de rede', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(dadosApi));
    expect(await AuthService.obterSessao()).toEqual(dadosApi);
    expect(await AuthService.obterToken()).toBe('abc123');
    expect(await AuthService.obterUsuarioId()).toBe('u1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('obterSessao retorna null com arquivo corrompido', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.readAsStringAsync.mockResolvedValue('{não é json');
    expect(await AuthService.obterSessao()).toBeNull();
    expect(await AuthService.obterToken()).toBeNull();
    expect(await AuthService.obterUsuarioId()).toBeNull();
  });

  test('obterSessao retorna null quando o arquivo não existe', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    expect(await AuthService.obterSessao()).toBeNull();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  test('logout remove o arquivo existente', async () => {
    FileSystem.deleteAsync.mockResolvedValue(undefined);
    await AuthService.logout();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(CAMINHO, {
      idempotent: true,
    });
  });

  test('logout sem arquivo não lança erro (idempotente)', async () => {
    FileSystem.deleteAsync.mockResolvedValue(undefined);
    await expect(AuthService.logout()).resolves.toBeUndefined();
    await expect(AuthService.logout()).resolves.toBeUndefined();
  });
});
