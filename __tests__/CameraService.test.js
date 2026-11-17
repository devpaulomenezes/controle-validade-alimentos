/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes do CameraService.removerFoto (issue #19): só apaga dentro da pasta de
 * fotos do app (documentDirectory/fotos/) e nunca lança exceção.
 */
import * as FileSystem from 'expo-file-system/legacy';
import CameraService from '../services/CameraService';

const mockArmazenamento = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho),
  })),
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async ({ from, to }) => {
    mockArmazenamento[to] = mockArmazenamento[from] ?? 'conteudo';
  }),
  // idempotent: true — apagar arquivo inexistente não lança erro.
  deleteAsync: jest.fn(async (caminho) => {
    delete mockArmazenamento[caminho];
  }),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('CameraService.removerFoto', () => {
  let consoleLog;
  let consoleErro;

  beforeEach(() => {
    for (const chave of Object.keys(mockArmazenamento)) {
      delete mockArmazenamento[chave];
    }
    FileSystem.deleteAsync.mockClear();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleErro.mockRestore();
  });

  it('deve apagar o arquivo dentro do diretório de fotos do app', async () => {
    const uri = '/documentos-teste/fotos/foto-1.jpg';
    mockArmazenamento[uri] = 'bytes';

    const resultado = await CameraService.removerFoto(uri);

    expect(resultado).toBe(true);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri, { idempotent: true });
    expect(mockArmazenamento[uri]).toBeUndefined();
  });

  it('deve apagar uma foto criada por persistirFoto (mesmo diretório)', async () => {
    mockArmazenamento['file:///cache/ImagePicker/tmp.jpg'] = 'bytes';
    const persistida = await CameraService.persistirFoto('file:///cache/ImagePicker/tmp.jpg');
    expect(mockArmazenamento[persistida]).toBe('bytes');

    await CameraService.removerFoto(persistida);

    expect(mockArmazenamento[persistida]).toBeUndefined();
  });

  it('não deve apagar arquivos fora do diretório de fotos (ex.: galeria) e registra no console', async () => {
    const foraDaPasta = [
      'file:///storage/emulated/0/DCIM/Camera/IMG_0001.jpg',
      '/documentos-teste/produtos.json',
      '/documentos-teste/fotos/../produtos.json',
    ];
    for (const uri of foraDaPasta) {
      mockArmazenamento[uri] = 'bytes';
      expect(await CameraService.removerFoto(uri)).toBe(false);
      expect(mockArmazenamento[uri]).toBe('bytes');
    }

    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[CameraService]'));
  });

  it('não deve apagar nada nem lançar exceção para uri vazia ou nula', async () => {
    expect(await CameraService.removerFoto(null)).toBe(false);
    expect(await CameraService.removerFoto(undefined)).toBe(false);
    expect(await CameraService.removerFoto('')).toBe(false);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('não deve lançar exceção se o arquivo não existir', async () => {
    await expect(
      CameraService.removerFoto('/documentos-teste/fotos/inexistente.jpg')
    ).resolves.toBe(true);
  });

  it('não deve lançar exceção se a exclusão falhar: registra com o prefixo [CameraService]', async () => {
    FileSystem.deleteAsync.mockRejectedValueOnce(new Error('sem permissão'));

    await expect(
      CameraService.removerFoto('/documentos-teste/fotos/foto-2.jpg')
    ).resolves.toBe(false);

    expect(consoleErro).toHaveBeenCalledWith(
      expect.stringContaining('[CameraService]'),
      expect.any(Error)
    );
  });
});
