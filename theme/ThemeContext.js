/**
 * ThemeContext (TEMA-01) — tema claro e escuro do app.
 *
 * O ThemeProvider guarda o tema ativo, lê a preferência salva em tema.json
 * (pasta de documentos do app, via expo-file-system/legacy, no mesmo padrão
 * de produtos.json e sessao.json) ao montar e a regrava a cada alternância.
 * O hook useTema() devolve a paleta ativa e a função de alternância.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { temas } from './theme';

export const CAMINHO_PREFERENCIA_TEMA = `${FileSystem.documentDirectory}tema.json`;

/**
 * Lê a preferência salva. Arquivo ausente (primeira execução) devolve 'claro';
 * conteúdo ilegível ou com valor desconhecido também devolve 'claro'.
 *
 * @returns {Promise<'claro'|'escuro'>}
 */
export async function lerPreferenciaTema() {
  try {
    const info = await FileSystem.getInfoAsync(CAMINHO_PREFERENCIA_TEMA);
    if (!info.exists) return 'claro';
    const dados = JSON.parse(await FileSystem.readAsStringAsync(CAMINHO_PREFERENCIA_TEMA));
    return Object.prototype.hasOwnProperty.call(temas, dados?.tema) ? dados.tema : 'claro';
  } catch (erro) {
    console.error('[ThemeContext] não foi possível ler tema.json; usando o tema claro:', erro);
    return 'claro';
  }
}

/**
 * Grava a preferência em tema.json: { "tema": "claro" | "escuro" }.
 *
 * @param {'claro'|'escuro'} nome
 * @returns {Promise<void>}
 */
export async function salvarPreferenciaTema(nome) {
  await FileSystem.writeAsStringAsync(CAMINHO_PREFERENCIA_TEMA, JSON.stringify({ tema: nome }));
}

const ThemeContext = createContext(null);

/**
 * Envolve o app (App.js). Até a preferência salva ser lida, `carregando` é
 * true e o tema é o claro; o App.js espera essa leitura para não piscar o
 * tema errado na abertura.
 */
export function ThemeProvider({ children }) {
  const [nome, setNome] = useState('claro');
  const [carregando, setCarregando] = useState(true);
  const nomeRef = useRef('claro'); // tema atual, para alternâncias seguidas
  const alternadoRef = useRef(false); // o usuário alternou antes de a leitura terminar
  const gravacaoRef = useRef(Promise.resolve()); // gravações em série, na ordem dos toques

  useEffect(() => {
    let ativo = true;
    lerPreferenciaTema().then((salvo) => {
      if (!ativo) return;
      // Se o usuário já alternou, a escolha dele vale mais que a preferência antiga.
      if (!alternadoRef.current) {
        nomeRef.current = salvo;
        setNome(salvo);
      }
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const alternarTema = useCallback(() => {
    const novo = nomeRef.current === 'escuro' ? 'claro' : 'escuro';
    nomeRef.current = novo;
    alternadoRef.current = true;
    setNome(novo);
    // Falha ao gravar não desfaz a troca: só a preferência deixa de persistir.
    gravacaoRef.current = gravacaoRef.current
      .then(() => salvarPreferenciaTema(novo))
      .catch((erro) => {
        console.error('[ThemeContext] não foi possível salvar tema.json:', erro);
      });
  }, []);

  const valor = useMemo(
    () => ({ ...temas[nome], alternarTema, carregando }),
    [nome, alternarTema, carregando]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

/**
 * Tema ativo: { nome, escuro, cores, situacoes, estilosBase, alternarTema,
 * carregando }. Só funciona dentro do ThemeProvider; fora dele, lança erro.
 */
export function useTema() {
  const valor = useContext(ThemeContext);
  if (!valor) {
    throw new Error('useTema() deve ser usado dentro de <ThemeProvider> (o App.js envolve o app com ele).');
  }
  return valor;
}

/** Valor de useTemaOpcional() fora do ThemeProvider: o tema claro, sem alternância. */
const TEMA_PADRAO = Object.freeze({ ...temas.claro, alternarTema: () => {}, carregando: false });

/**
 * Como useTema(), mas fora do ThemeProvider devolve o tema claro em vez de
 * lançar erro. Usado pelas TELAS (app/), que também são renderizadas
 * isoladamente nos testes de tela — ex.: TelaCadastroEdicao.test.js renderiza
 * a TelaCadastro sem provider. Componentes (components/) usam useTema().
 */
export function useTemaOpcional() {
  return useContext(ThemeContext) ?? TEMA_PADRAO;
}

export default ThemeContext;
