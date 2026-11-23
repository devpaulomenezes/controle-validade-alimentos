import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { espacamento, fonte } from '../theme/theme';
import { useTema } from '../theme/ThemeContext';

/**
 * Estado de lista vazia: ícone, mensagem e chamada para ação opcional.
 * As cores vêm do tema ativo (TEMA-01), via useTema().
 *
 * @param {Object} props
 * @param {string} [props.icone] - Emoji exibido no topo.
 * @param {string} [props.mensagem] - Texto principal.
 * @param {string} [props.descricao] - Texto de apoio abaixo da mensagem.
 * @param {string} [props.textoAcao] - Rótulo do botão (sem ele, o botão não aparece).
 * @param {() => void} [props.onAcao] - Chamado ao tocar no botão.
 */
export default function EmptyState({
  icone = '🥫',
  mensagem = 'Nenhum produto cadastrado',
  descricao = 'Cadastre seus alimentos para acompanhar as datas de validade.',
  textoAcao,
  onAcao,
}) {
  const { cores, estilosBase } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);

  return (
    <View style={styles.container}>
      <Text style={styles.icone}>{icone}</Text>
      <Text style={styles.mensagem}>{mensagem}</Text>
      {descricao ? <Text style={styles.descricao}>{descricao}</Text> : null}

      {textoAcao && onAcao ? (
        <TouchableOpacity style={[estilosBase.botaoPrimario, styles.botao]} onPress={onAcao}>
          <Text style={estilosBase.textoBotaoPrimario}>{textoAcao}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function criarEstilos(cores) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: espacamento.xl,
      paddingHorizontal: espacamento.lg,
    },
    icone: {
      fontSize: 56,
      marginBottom: espacamento.md,
    },
    mensagem: {
      fontSize: fonte.media,
      fontWeight: 'bold',
      color: cores.texto,
      textAlign: 'center',
    },
    descricao: {
      fontSize: fonte.normal,
      color: cores.textoSecundario,
      textAlign: 'center',
      marginTop: espacamento.sm,
    },
    botao: {
      marginTop: espacamento.lg,
    },
  });
}
