import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { cores, espacamento, raio, fonte } from '../theme/theme';

/** "1 alteração", "3 alterações". */
function descreverPendentes(pendentes) {
  return pendentes === 1 ? '1 alteração' : `${pendentes} alterações`;
}

/**
 * Banner de status da sincronização (APP-08), no topo da TelaInicial.
 * Aparece só quando há alterações aguardando envio ou uma sincronização em
 * andamento; tocar nele pede uma nova sincronização. NÃO acessa a fila nem o
 * repositório: recebe tudo por props.
 *
 * @param {Object} props
 * @param {number} props.pendentes - Alterações do usuário ainda na fila.
 * @param {boolean} props.sincronizando - Se há uma sincronização em andamento.
 * @param {() => void} [props.aoSincronizar] - Chamado ao tocar no banner; ignorado
 *   enquanto `sincronizando` (o banner fica desabilitado).
 */
export default function IndicadorSincronizacao({ pendentes = 0, sincronizando = false, aoSincronizar }) {
  if (!sincronizando && !(pendentes > 0)) return null;

  const texto = sincronizando
    ? 'Sincronizando...'
    : `Modo offline: ${descreverPendentes(pendentes)} aguardando conexão`;

  return (
    <TouchableOpacity
      style={[styles.banner, sincronizando ? styles.bannerSincronizando : styles.bannerOffline]}
      onPress={() => aoSincronizar?.()}
      disabled={sincronizando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityHint={sincronizando ? undefined : 'Toque para tentar sincronizar agora'}
      accessibilityState={{ disabled: sincronizando, busy: sincronizando }}
    >
      {sincronizando ? <ActivityIndicator size="small" color={cores.primariaEscura} /> : null}
      <View style={styles.textos}>
        <Text style={[styles.texto, sincronizando ? styles.textoSincronizando : styles.textoOffline]}>
          {texto}
        </Text>
        {sincronizando ? null : <Text style={styles.dica}>Toque para tentar agora</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    marginHorizontal: espacamento.md,
    marginTop: espacamento.md,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
    borderRadius: raio.md,
    borderWidth: 1,
  },
  bannerOffline: {
    backgroundColor: cores.fundoAviso,
    borderColor: cores.aviso,
  },
  bannerSincronizando: {
    backgroundColor: cores.fundoInfo,
    borderColor: cores.primaria,
  },
  textos: {
    flex: 1,
  },
  texto: {
    fontSize: fonte.normal,
    fontWeight: 'bold',
  },
  textoOffline: {
    color: cores.aviso,
  },
  // primariaEscura: contraste AA (4,5:1) sobre fundoInfo; a primaria fica abaixo.
  textoSincronizando: {
    color: cores.primariaEscura,
  },
  dica: {
    fontSize: fonte.pequena,
    color: cores.aviso,
    marginTop: espacamento.xs / 2,
  },
});
