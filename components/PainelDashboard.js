import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { espacamento, raio, fonte } from '../theme/theme';
import { useTema } from '../theme/ThemeContext';

/** Contadores da linha de baixo; `filtro` é a chave do filtro da listagem. */
const CONTADORES = [
  { campo: 'vencidos', filtro: 'vencido', rotulo: 'Vencidos' },
  { campo: 'venceEsteMes', filtro: 'venceEsteMes', rotulo: 'Este mês' },
  { campo: 'total', filtro: 'todas', rotulo: 'Total' },
];

/**
 * Painel do topo da tela inicial (issue #10): destaque para os produtos que
 * vencem esta semana e contadores de vencidos, deste mês e do total.
 * As cores vêm do tema ativo (TEMA-01), via useTema().
 *
 * O painel NÃO calcula nada: o resumo chega pronto do
 * ServicoDashboard.resumirProdutos.
 *
 * @param {Object} props
 * @param {{ total: number, vencidos: number, venceEstaSemana: number, venceEsteMes: number, ok: number }} props.resumo
 * @param {(filtro: string) => void} [props.onSelecionar] - Recebe a chave do filtro da listagem ao tocar num contador.
 */
export default function PainelDashboard({ resumo, onSelecionar }) {
  const { cores, situacoes } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const semana = situacoes.venceEstaSemana;
  const qtdSemana = resumo.venceEstaSemana;

  return (
    <View style={styles.painel}>
      <TouchableOpacity
        style={[styles.destaque, { backgroundColor: semana.fundo, borderColor: semana.cor }]}
        onPress={() => onSelecionar?.('venceEstaSemana')}
        disabled={!onSelecionar}
        accessibilityRole="button"
        accessibilityLabel={`${qtdSemana} ${qtdSemana === 1 ? 'produto vence' : 'produtos vencem'} esta semana`}
      >
        <Text style={[styles.numeroDestaque, { color: semana.cor }]}>{qtdSemana}</Text>
        <Text style={[styles.textoDestaque, { color: semana.cor }]}>
          {qtdSemana === 1 ? 'produto vence esta semana' : 'produtos vencem esta semana'}
        </Text>
      </TouchableOpacity>

      <View style={styles.linha}>
        {CONTADORES.map(({ campo, filtro, rotulo }) => (
          <TouchableOpacity
            key={campo}
            style={styles.contador}
            onPress={() => onSelecionar?.(filtro)}
            disabled={!onSelecionar}
            accessibilityRole="button"
            accessibilityLabel={`${rotulo}: ${resumo[campo]}`}
          >
            {/* "Total" não é uma situação: usa a cor do texto. */}
            <Text style={[styles.numero, { color: situacoes[filtro]?.cor ?? cores.texto }]}>
              {resumo[campo]}
            </Text>
            <Text style={styles.rotulo}>{rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function criarEstilos(cores) {
  return StyleSheet.create({
    painel: {
      marginBottom: espacamento.md,
      gap: espacamento.sm,
    },
    destaque: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: raio.md,
      paddingHorizontal: espacamento.md,
      paddingVertical: espacamento.sm + 2,
      gap: espacamento.sm + 2,
    },
    numeroDestaque: {
      fontSize: fonte.titulo + 6,
      fontWeight: 'bold',
    },
    textoDestaque: {
      flex: 1,
      fontSize: fonte.normal,
      fontWeight: '600',
    },
    linha: {
      flexDirection: 'row',
      gap: espacamento.sm,
    },
    contador: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.md,
      paddingVertical: espacamento.sm,
    },
    numero: {
      fontSize: fonte.titulo,
      fontWeight: 'bold',
    },
    rotulo: {
      fontSize: fonte.pequena,
      color: cores.textoSecundario,
    },
  });
}
