/**
 * TEMA VISUAL CENTRAL — cores, espaçamentos e estilos base do app.
 * Telas e componentes importam daqui em vez de repetir valores soltos,
 * para manter a identidade visual consistente (issue #7).
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

export const estilosBase = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.fundo,
  },
  botaoPrimario: {
    backgroundColor: cores.primaria,
    paddingVertical: 12,
    paddingHorizontal: espacamento.lg,
    borderRadius: raio.md,
    alignItems: 'center',
  },
  textoBotaoPrimario: {
    color: cores.textoInverso,
    fontSize: fonte.normal,
    fontWeight: 'bold',
  },
  rotulo: {
    fontSize: fonte.normal,
    fontWeight: '600',
    color: cores.texto,
    marginBottom: espacamento.xs,
  },
  campo: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    paddingVertical: 12,
    fontSize: fonte.normal,
    color: cores.texto,
  },
  textoErro: {
    color: cores.erro,
    fontSize: fonte.pequena,
    marginTop: espacamento.xs,
  },
});
