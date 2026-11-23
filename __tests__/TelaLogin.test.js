/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes da TelaLogin (APP-06) com o AuthService simulado: alternância de
 * modo, validações, envio com sucesso, erro da API e estado de carregamento.
 */
import React from 'react';
import { Alert, TextInput, ActivityIndicator } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import TelaLogin from '../app/TelaLogin';
import AuthService from '../services/AuthService';

jest.mock('../services/AuthService', () => ({
  __esModule: true,
  default: { login: jest.fn(), registrar: jest.fn() },
}));

const PLACEHOLDER = { nome: 'Seu nome', email: 'seu@email.com', senha: 'Mínimo 6 caracteres' };
const USUARIO = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com' };

/** Promessa controlada pelo teste, para observar o estado "enviando". */
function promessaPendente() {
  let resolver;
  let rejeitar;
  const promessa = new Promise((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

// Importante no React 19 + react-test-renderer: TODO render, prop update e
// chamada de handler precisa estar dentro de act() (síncrono ou assíncrono),
// senão os testes corrompem silenciosamente uns aos outros no mesmo arquivo.
async function renderizar() {
  let renderer;
  const aoAutenticar = jest.fn();
  await act(async () => {
    renderer = TestRenderer.create(<TelaLogin aoAutenticar={aoAutenticar} />);
  });
  const raiz = renderer.root;

  const campo = (nomeCampo) =>
    raiz.findAllByType(TextInput).find((no) => no.props.placeholder === PLACEHOLDER[nomeCampo]);
  const botao = (rotulo) =>
    raiz.findAll(
      (no) => no.props.accessibilityLabel === rotulo && typeof no.props.onPress === 'function'
    )[0];

  return {
    aoAutenticar,
    campo,
    botao,
    quantidadeDeCampos: () => raiz.findAllByType(TextInput).length,
    temTexto: (texto) => raiz.findAll((no) => no.props.children === texto).length > 0,
    mostraCarregando: () => raiz.findAllByType(ActivityIndicator).length > 0,
    async digitar(nomeCampo, texto) {
      await act(async () => {
        campo(nomeCampo).props.onChangeText(texto);
      });
    },
    async tocar(rotulo) {
      await act(async () => {
        await botao(rotulo).props.onPress();
      });
    },
    /** Toca sem esperar a requisição terminar (para ver o estado de carregamento). */
    async tocarSemEsperar(rotulo) {
      await act(async () => {
        botao(rotulo).props.onPress();
      });
    },
    async desmontar() {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}

async function preencherLogin(tela, email = 'ana@exemplo.com', senha = 'segredo1') {
  await tela.digitar('email', email);
  await tela.digitar('senha', senha);
}

describe('TelaLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('alternância de modo', () => {
    it('começa no modo "Entrar", só com e-mail e senha', async () => {
      const tela = await renderizar();

      expect(tela.quantidadeDeCampos()).toBe(2);
      expect(tela.campo('nome')).toBeUndefined();
      expect(tela.botao('Entrar')).toBeDefined();
      await tela.desmontar();
    });

    it('alternar mostra ou esconde o campo de nome e muda o texto do botão', async () => {
      const tela = await renderizar();

      await tela.tocar('Criar conta nova');
      expect(tela.quantidadeDeCampos()).toBe(3);
      expect(tela.campo('nome')).toBeDefined();
      expect(tela.botao('Criar conta')).toBeDefined();
      expect(tela.temTexto('Criar conta')).toBe(true);
      expect(tela.botao('Entrar')).toBeUndefined();

      await tela.tocar('Já tenho conta');
      expect(tela.quantidadeDeCampos()).toBe(2);
      expect(tela.campo('nome')).toBeUndefined();
      expect(tela.botao('Entrar')).toBeDefined();
      await tela.desmontar();
    });

    it('alternar o modo limpa os erros de validação exibidos', async () => {
      const tela = await renderizar();
      await tela.tocar('Entrar');
      expect(tela.temTexto('Informe seu e-mail.')).toBe(true);

      await tela.tocar('Criar conta nova');

      expect(tela.temTexto('Informe seu e-mail.')).toBe(false);
      await tela.desmontar();
    });
  });

  describe('validações', () => {
    it('campos vazios exibem erro abaixo de cada campo e não chamam o AuthService', async () => {
      const tela = await renderizar();

      await tela.tocar('Entrar');

      expect(tela.temTexto('Informe seu e-mail.')).toBe(true);
      expect(tela.temTexto('Informe sua senha.')).toBe(true);
      expect(AuthService.login).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('no cadastro, o nome também é obrigatório', async () => {
      const tela = await renderizar();
      await tela.tocar('Criar conta nova');
      await preencherLogin(tela);
      await tela.digitar('nome', '   ');

      await tela.tocar('Criar conta');

      expect(tela.temTexto('Informe seu nome.')).toBe(true);
      expect(AuthService.registrar).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('e-mail sem @ ou sem domínio exibe erro e não chama o AuthService', async () => {
      const tela = await renderizar();

      await preencherLogin(tela, 'ana.exemplo.com');
      await tela.tocar('Entrar');
      expect(tela.temTexto('Informe um e-mail válido.')).toBe(true);

      await tela.digitar('email', 'ana@');
      await tela.tocar('Entrar');
      expect(tela.temTexto('Informe um e-mail válido.')).toBe(true);

      expect(AuthService.login).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('senha com menos de 6 caracteres exibe erro e não chama o AuthService', async () => {
      const tela = await renderizar();

      await preencherLogin(tela, 'ana@exemplo.com', '12345');
      await tela.tocar('Entrar');

      expect(tela.temTexto('A senha deve ter no mínimo 6 caracteres.')).toBe(true);
      expect(AuthService.login).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('o erro de um campo some ao digitar nele', async () => {
      const tela = await renderizar();
      await tela.tocar('Entrar');
      expect(tela.temTexto('Informe sua senha.')).toBe(true);

      await tela.digitar('senha', 's');

      expect(tela.temTexto('Informe sua senha.')).toBe(false);
      expect(tela.temTexto('Informe seu e-mail.')).toBe(true);
      await tela.desmontar();
    });
  });

  describe('envio', () => {
    it('login com sucesso chama AuthService.login e aoAutenticar uma vez, com o usuário retornado', async () => {
      AuthService.login.mockResolvedValue({ token: 'tok-1', usuario: USUARIO });
      const tela = await renderizar();

      await preencherLogin(tela, '  ana@exemplo.com  ', 'segredo1');
      await tela.tocar('Entrar');

      expect(AuthService.login).toHaveBeenCalledWith('ana@exemplo.com', 'segredo1');
      expect(tela.aoAutenticar).toHaveBeenCalledTimes(1);
      expect(tela.aoAutenticar).toHaveBeenCalledWith(USUARIO);
      expect(Alert.alert).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('cadastro com sucesso chama AuthService.registrar e aoAutenticar com o usuário retornado', async () => {
      AuthService.registrar.mockResolvedValue({ token: 'tok-2', usuario: USUARIO });
      const tela = await renderizar();
      await tela.tocar('Criar conta nova');

      await tela.digitar('nome', ' Ana ');
      await preencherLogin(tela);
      await tela.tocar('Criar conta');

      expect(AuthService.registrar).toHaveBeenCalledWith('Ana', 'ana@exemplo.com', 'segredo1');
      expect(AuthService.login).not.toHaveBeenCalled();
      expect(tela.aoAutenticar).toHaveBeenCalledTimes(1);
      expect(tela.aoAutenticar).toHaveBeenCalledWith(USUARIO);
      await tela.desmontar();
    });

    it('erro da API exibe Alert com a mensagem, limpa a senha e não chama aoAutenticar', async () => {
      AuthService.login.mockRejectedValue(new Error('Credenciais inválidas.'));
      const tela = await renderizar();

      await preencherLogin(tela);
      await tela.tocar('Entrar');

      expect(Alert.alert).toHaveBeenCalledWith('Erro ao entrar', 'Credenciais inválidas.');
      expect(tela.campo('senha').props.value).toBe('');
      expect(tela.campo('email').props.value).toBe('ana@exemplo.com');
      expect(tela.aoAutenticar).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('falta de conexão exibe Alert com a mensagem em português', async () => {
      const semConexao = 'Falha de conexão com o servidor. Verifique sua internet.';
      AuthService.registrar.mockRejectedValue(new Error(semConexao));
      const tela = await renderizar();
      await tela.tocar('Criar conta nova');

      await tela.digitar('nome', 'Ana');
      await preencherLogin(tela);
      await tela.tocar('Criar conta');

      expect(Alert.alert).toHaveBeenCalledWith('Erro ao criar conta', semConexao);
      expect(tela.aoAutenticar).not.toHaveBeenCalled();
      await tela.desmontar();
    });

    it('erro sem mensagem exibe um texto padrão em português', async () => {
      AuthService.login.mockRejectedValue(new Error(''));
      const tela = await renderizar();

      await preencherLogin(tela);
      await tela.tocar('Entrar');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Erro ao entrar',
        'Não foi possível concluir. Verifique sua conexão e tente novamente.'
      );
      await tela.desmontar();
    });
  });

  describe('estado de carregamento', () => {
    it('durante o envio, o botão mostra ActivityIndicator e fica desabilitado', async () => {
      const pendente = promessaPendente();
      AuthService.login.mockReturnValue(pendente.promessa);
      const tela = await renderizar();
      await preencherLogin(tela);
      expect(tela.mostraCarregando()).toBe(false);

      await tela.tocarSemEsperar('Entrar');

      expect(tela.mostraCarregando()).toBe(true);
      expect(tela.botao('Entrar').props.disabled).toBe(true);
      expect(tela.campo('email').props.editable).toBe(false);
      expect(tela.campo('senha').props.editable).toBe(false);

      await act(async () => {
        pendente.resolver({ token: 'tok-1', usuario: USUARIO });
      });

      expect(tela.mostraCarregando()).toBe(false);
      expect(tela.botao('Entrar').props.disabled).toBe(false);
      expect(tela.aoAutenticar).toHaveBeenCalledTimes(1);
      await tela.desmontar();
    });

    it('o carregamento termina também quando a requisição falha', async () => {
      const pendente = promessaPendente();
      AuthService.login.mockReturnValue(pendente.promessa);
      const tela = await renderizar();
      await preencherLogin(tela);

      await tela.tocarSemEsperar('Entrar');
      expect(tela.mostraCarregando()).toBe(true);

      await act(async () => {
        pendente.rejeitar(new Error('Erro do servidor (status 500).'));
      });

      expect(tela.mostraCarregando()).toBe(false);
      expect(tela.botao('Entrar').props.disabled).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith('Erro ao entrar', 'Erro do servidor (status 500).');
      await tela.desmontar();
    });

    it('toque duplo durante o envio não chama o AuthService duas vezes', async () => {
      const pendente = promessaPendente();
      AuthService.login.mockReturnValue(pendente.promessa);
      const tela = await renderizar();
      await preencherLogin(tela);
      const onPress = tela.botao('Entrar').props.onPress;

      await act(async () => {
        onPress();
        onPress(); // segundo toque antes do re-render que desabilita o botão
      });
      await act(async () => {
        pendente.resolver({ token: 'tok-1', usuario: USUARIO });
      });

      expect(AuthService.login).toHaveBeenCalledTimes(1);
      expect(tela.aoAutenticar).toHaveBeenCalledTimes(1);
      await tela.desmontar();
    });
  });
});
