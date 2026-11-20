/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes do tema claro e escuro (TEMA-01): exportações estáticas preservadas,
 * paleta clara por padrão, troca para a escura sem reiniciar, persistência
 * em tema.json (inclusive arquivo ausente ou inválido), erro do hook fora do
 * ThemeProvider e o botão de alternância no cabeçalho do App.js.
 */
import React, { useEffect } from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as FileSystem from 'expo-file-system/legacy';
import {
  cores,
  coresEscuras,
  situacoes,
  situacoesEscuras,
  estilosBase,
  espacamento,
  raio,
  fonte,
  temas,
} from '../theme/theme';
import { ThemeProvider, useTema, CAMINHO_PREFERENCIA_TEMA } from '../theme/ThemeContext';
import App from '../App';
import AuthService from '../services/AuthService';

const mockArquivos = {};
const mockTelas = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArquivos, caminho),
  })),
  readAsStringAsync: jest.fn(async (caminho) => {
    if (!Object.prototype.hasOwnProperty.call(mockArquivos, caminho)) {
      throw new Error(`Arquivo não encontrado: ${caminho}`);
    }
    return mockArquivos[caminho];
  }),
  writeAsStringAsync: jest.fn(async (caminho, conteudo) => {
    mockArquivos[caminho] = conteudo;
  }),
}));

jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: { obterSessao: jest.fn() },
}));

// Telas simuladas: a inicial mostra o botão de tema que recebe do App.js.
jest.mock('../app/TelaInicial', () => {
  const React = require('react');
  return function TelaInicialSimulada(props) {
    mockTelas.inicial = props;
    const { BotaoTema } = props;
    return BotaoTema ? React.createElement(BotaoTema) : null;
  };
});
jest.mock('../app/TelaLogin', () => () => null);
jest.mock('../app/TelaCadastro', () => () => null);
jest.mock('../app/TelaDetalhe', () => () => null);

const CAMINHO = '/documentos-teste/tema.json';

/** Consumidor do hook: entrega a quem testa cada valor de useTema(). */
function Consumidor({ aoReceberTema }) {
  const tema = useTema();
  useEffect(() => {
    aoReceberTema(tema);
  }, [tema, aoReceberTema]);
  return <Text>{tema.nome}</Text>;
}

async function renderizarComProvider() {
  const registro = { atual: null };
  const aoReceberTema = (tema) => {
    registro.atual = tema;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <Consumidor aoReceberTema={aoReceberTema} />
      </ThemeProvider>
    );
  });
  return {
    registro,
    async alternar() {
      await act(async () => {
        registro.atual.alternarTema();
      });
    },
    async desmontar() {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

describe('Tema claro e escuro (TEMA-01)', () => {
  let consoleErro;

  beforeEach(() => {
    for (const chave of Object.keys(mockArquivos)) delete mockArquivos[chave];
    jest.clearAllMocks();
    consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('theme/theme.js', () => {
    it('mantém as exportações estáticas, com os valores da paleta clara', () => {
      expect(cores.fundo).toBe('#f4f6fa');
      expect(cores.primaria).toBe('#1e6fd9');
      expect(situacoes.vencido).toEqual({ rotulo: 'Vencido', cor: '#c62828', fundo: '#fdecea' });
      expect(estilosBase.tela.backgroundColor).toBe(cores.fundo);
      expect(estilosBase.campo.color).toBe(cores.texto);
      expect(espacamento.md).toBe(16);
      expect(raio.md).toBe(10);
      expect(fonte.normal).toBe(15);
      expect(temas.claro.cores).toBe(cores);
      expect(temas.claro.situacoes).toBe(situacoes);
      expect(temas.claro.estilosBase).toBe(estilosBase);
    });

    it('a paleta escura tem as mesmas chaves da clara, e as situações os mesmos rótulos', () => {
      expect(Object.keys(coresEscuras).sort()).toEqual(Object.keys(cores).sort());
      expect(Object.keys(situacoesEscuras).sort()).toEqual(Object.keys(situacoes).sort());
      for (const chave of Object.keys(situacoes)) {
        expect(situacoesEscuras[chave].rotulo).toBe(situacoes[chave].rotulo);
      }
      expect(temas.escuro.cores).toBe(coresEscuras);
      expect(temas.escuro.estilosBase.tela.backgroundColor).toBe(coresEscuras.fundo);
    });
  });

  describe('ThemeProvider e useTema()', () => {
    it('usa a paleta clara por padrão quando tema.json não existe', async () => {
      const tela = await renderizarComProvider();

      expect(CAMINHO_PREFERENCIA_TEMA).toBe(CAMINHO);
      expect(tela.registro.atual.nome).toBe('claro');
      expect(tela.registro.atual.escuro).toBe(false);
      expect(tela.registro.atual.cores).toBe(cores);
      expect(tela.registro.atual.carregando).toBe(false);
      expect(consoleErro).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('alterna para a escura e de volta para a clara, sem reiniciar', async () => {
      const tela = await renderizarComProvider();

      await tela.alternar();
      expect(tela.registro.atual.nome).toBe('escuro');
      expect(tela.registro.atual.escuro).toBe(true);
      expect(tela.registro.atual.cores).toBe(coresEscuras);
      expect(tela.registro.atual.situacoes).toBe(situacoesEscuras);

      await tela.alternar();
      expect(tela.registro.atual.nome).toBe('claro');
      expect(tela.registro.atual.cores).toBe(cores);
      await tela.desmontar();
    });

    it('grava a preferência em tema.json e a mantém ao fechar e reabrir o app', async () => {
      const primeiraAbertura = await renderizarComProvider();
      await primeiraAbertura.alternar();
      expect(JSON.parse(mockArquivos[CAMINHO])).toEqual({ tema: 'escuro' });
      await primeiraAbertura.desmontar();

      const segundaAbertura = await renderizarComProvider();

      expect(segundaAbertura.registro.atual.nome).toBe('escuro');
      expect(segundaAbertura.registro.atual.cores).toBe(coresEscuras);
      await segundaAbertura.desmontar();
    });

    it('tema.json inválido ou com valor desconhecido assume o tema claro', async () => {
      mockArquivos[CAMINHO] = '{ isto não é json';
      const comJsonInvalido = await renderizarComProvider();
      expect(comJsonInvalido.registro.atual.nome).toBe('claro');
      await comJsonInvalido.desmontar();

      mockArquivos[CAMINHO] = JSON.stringify({ tema: 'roxo' });
      const comValorDesconhecido = await renderizarComProvider();
      expect(comValorDesconhecido.registro.atual.nome).toBe('claro');
      await comValorDesconhecido.desmontar();
    });

    it('falha ao gravar a preferência não impede a troca de tema', async () => {
      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disco cheio'));
      const tela = await renderizarComProvider();

      await tela.alternar();

      expect(tela.registro.atual.nome).toBe('escuro');
      expect(consoleErro).toHaveBeenCalled();
      await tela.desmontar();
    });

    it('alternar antes de terminar a leitura não é desfeito pela preferência salva', async () => {
      mockArquivos[CAMINHO] = JSON.stringify({ tema: 'claro' });
      let liberarLeitura;
      FileSystem.readAsStringAsync.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            liberarLeitura = () => resolve(JSON.stringify({ tema: 'claro' }));
          })
      );
      const tela = await renderizarComProvider();
      expect(tela.registro.atual.carregando).toBe(true);

      await tela.alternar();
      await act(async () => {
        liberarLeitura();
      });

      expect(tela.registro.atual.nome).toBe('escuro');
      expect(tela.registro.atual.carregando).toBe(false);
      await tela.desmontar();
    });

    it('useTema() fora do ThemeProvider lança um erro claro', () => {
      expect(() => {
        act(() => {
          TestRenderer.create(<Consumidor aoReceberTema={() => {}} />);
        });
      }).toThrow(/ThemeProvider/);
    });
  });

  describe('botão de alternância no cabeçalho (App.js)', () => {
    it('alterna o tema do app sem reiniciar e grava a preferência', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      AuthService.obterSessao.mockResolvedValue({ token: 't', usuario: { id: 'u1' } });
      let renderer;
      await act(async () => {
        renderer = TestRenderer.create(<App />);
      });
      const botao = (rotulo) =>
        renderer.root.findAll(
          (no) => no.props.accessibilityLabel === rotulo && typeof no.props.onPress === 'function'
        )[0];

      expect(typeof mockTelas.inicial.BotaoTema).toBe('function');
      expect(botao('Usar tema escuro')).toBeDefined();

      await act(async () => {
        botao('Usar tema escuro').props.onPress();
      });

      expect(botao('Usar tema claro')).toBeDefined();
      expect(JSON.parse(mockArquivos[CAMINHO])).toEqual({ tema: 'escuro' });
      await act(async () => {
        renderer.unmount();
      });
    });
  });
});
