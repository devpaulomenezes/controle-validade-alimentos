import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { cores, espacamento, fonte, estilosBase } from './theme';

/**
 * Estado de lista vazia: ícone, mensagem e chamada para ação opcional.
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

const styles = StyleSheet.create({
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
