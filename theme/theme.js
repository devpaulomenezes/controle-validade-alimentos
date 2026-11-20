/**
 * TEMA VISUAL CENTRAL — cores, espaçamentos e estilos base do app.
 * Telas e componentes importam daqui em vez de repetir valores soltos,
 * para manter a identidade visual consistente (issue #7).
 *
 * TEMA-01: há uma paleta clara e uma escura, reunidas em `temas`. As
 * exportações estáticas (`cores`, `situacoes`, `estilosBase`, `espacamento`,
 * `raio`, `fonte`) continuam existindo com os valores CLAROS — quem precisa
 * seguir o tema ativo usa o hook `useTema()` de theme/ThemeContext.js.
 */
import { StyleSheet } from 'react-native';

export const cores = {
  primaria: '#1e6fd9',
  primariaEscura: '#1557ad',
  fundo: '#f4f6fa',
  superficie: '#ffffff',
  texto: '#1f2933',
  textoSecundario: '#616e7c',
  textoInverso: '#ffffff',
  borda: '#d9e0e8',
  erro: '#c62828',
  sucesso: '#2e7d32',
  // Banner de sincronização (APP-08): alterações aguardando conexão / enviando.
  aviso: '#9a5b00',
  fundoAviso: '#fff4d6',
  fundoInfo: '#e3f0fd',
  // Cabeçalho da navegação e sombra dos cartões (TEMA-01).
  cabecalho: '#1e6fd9',
  textoCabecalho: '#ffffff',
  sombra: '#000000',
};

/**
 * Paleta escura (TEMA-01): as mesmas chaves de `cores`. Todos os pares de
 * texto/fundo usados no app têm contraste de pelo menos 4,5:1 (WCAG AA).
 * `textoInverso` é o texto sobre a cor primária (botões, filtro ativo), por
 * isso fica escuro aqui; o cabeçalho usa `cabecalho`/`textoCabecalho`.
 */
export const coresEscuras = {
  primaria: '#58a6ff',
  primariaEscura: '#388bfd',
  fundo: '#0d1117',
  superficie: '#161b22',
  texto: '#e6edf3',
  textoSecundario: '#9ba6b2',
  textoInverso: '#0d1117',
  borda: '#30363d',
  erro: '#ff7b72',
  sucesso: '#3fb950',
  aviso: '#e3b341',
  fundoAviso: '#2b2111',
  fundoInfo: '#10243e',
  cabecalho: '#161b22',
  textoCabecalho: '#e6edf3',
  sombra: '#000000',
};

/**
 * Cores e rótulos de cada situação de vencimento. As chaves seguem os
 * valores retornados por ServicoValidade.classificarSituacao (issue #4).
 */
export const situacoes = {
  vencido: { rotulo: 'Vencido', cor: '#c62828', fundo: '#fdecea' },
  venceEstaSemana: { rotulo: 'Vence esta semana', cor: '#9a5b00', fundo: '#fff4d6' },
  venceEsteMes: { rotulo: 'Vence este mês', cor: '#1565c0', fundo: '#e3f0fd' },
  ok: { rotulo: 'Ok', cor: '#2e7d32', fundo: '#e7f5e9' },
};

/** Situações na paleta escura (TEMA-01): mesmos rótulos, cores para fundo escuro. */
export const situacoesEscuras = {
  vencido: { ...situacoes.vencido, cor: '#ff7b72', fundo: '#3a1d1f' },
  venceEstaSemana: { ...situacoes.venceEstaSemana, cor: '#e3b341', fundo: '#2f2610' },
  venceEsteMes: { ...situacoes.venceEsteMes, cor: '#79c0ff', fundo: '#0f2a44' },
  ok: { ...situacoes.ok, cor: '#56d364', fundo: '#12301c' },
};

export const espacamento = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const raio = {
  sm: 6,
  md: 10,
  pill: 999,
};

export const fonte = {
  pequena: 13,
  normal: 15,
  media: 17,
  titulo: 22,
};

/** Estilos base (tela, botão primário, rótulo, campo, erro) para uma paleta. */
export function criarEstilosBase(paleta) {
  return StyleSheet.create({
    tela: {
      flex: 1,
      backgroundColor: paleta.fundo,
    },
    botaoPrimario: {
      backgroundColor: paleta.primaria,
      paddingVertical: 12,
      paddingHorizontal: espacamento.lg,
      borderRadius: raio.md,
      alignItems: 'center',
    },
    textoBotaoPrimario: {
      color: paleta.textoInverso,
      fontSize: fonte.normal,
      fontWeight: 'bold',
    },
    rotulo: {
      fontSize: fonte.normal,
      fontWeight: '600',
      color: paleta.texto,
      marginBottom: espacamento.xs,
    },
    campo: {
      backgroundColor: paleta.superficie,
      borderWidth: 1,
      borderColor: paleta.borda,
      borderRadius: raio.md,
      paddingHorizontal: espacamento.md,
      paddingVertical: 12,
      fontSize: fonte.normal,
      color: paleta.texto,
    },
    textoErro: {
      color: paleta.erro,
      fontSize: fonte.pequena,
      marginTop: espacamento.xs,
    },
  });
}

export const estilosBase = criarEstilosBase(cores);

/**
 * Os dois temas do app (TEMA-01), no formato entregue por useTema():
 * nome, se é escuro, cores, situações e estilos base da paleta.
 */
export const temas = {
  claro: { nome: 'claro', escuro: false, cores, situacoes, estilosBase },
  escuro: {
    nome: 'escuro',
    escuro: true,
    cores: coresEscuras,
    situacoes: situacoesEscuras,
    estilosBase: criarEstilosBase(coresEscuras),
  },
};
