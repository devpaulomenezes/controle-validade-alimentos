import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { cores, situacoes, espacamento, raio, fonte } from './theme';
import { formatarDataBR } from './formatoData';

/**
 * Cartão de um produto na listagem.
 *
 * O cartão NÃO calcula datas: a situação chega pronta (calculada pelo
 * ServicoValidade, ou pelo mock enquanto ele não está integrado).
 *
 * @param {Object} props
 * @param {import('../data/Produto').default} props.produto - Produto do contrato da issue #1.
 * @param {'vencido'|'venceEstaSemana'|'venceEsteMes'|'ok'} props.situacao - Situação já classificada.
 */
export default function ProdutoCard({ produto, situacao }) {
  const [erroImagem, setErroImagem] = useState(false);
  const estiloSituacao = situacoes[situacao];
  const corDestaque = estiloSituacao ? estiloSituacao.cor : cores.borda;
  const temFoto = Boolean(produto.fotoUri) && !erroImagem;

  return (
    <View style={[styles.card, { borderLeftColor: corDestaque }]}>
      {temFoto ? (
        <Image
          source={{ uri: produto.fotoUri }}
          style={styles.foto}
          onError={() => setErroImagem(true)}
        />
      ) : (
        <View style={[styles.foto, styles.placeholder]}>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.nome} numberOfLines={1}>{produto.nome}</Text>
        <Text style={styles.detalhe}>Quantidade: {produto.quantidade}</Text>
        <Text style={styles.detalhe}>Validade: {formatarDataBR(produto.dataDeValidade)}</Text>

        {estiloSituacao ? (
          <View style={[styles.selo, { backgroundColor: estiloSituacao.fundo }]}>
            <Text style={[styles.textoSelo, { color: estiloSituacao.cor }]}>
              {estiloSituacao.rotulo}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderLeftWidth: 6,
    padding: espacamento.md,
    marginBottom: espacamento.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  foto: {
    width: 64,
    height: 64,
    borderRadius: raio.sm,
    marginRight: espacamento.md,
    backgroundColor: cores.fundo,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
  },
  info: {
    flex: 1,
  },
  nome: {
    fontSize: fonte.media,
    fontWeight: 'bold',
    color: cores.texto,
    marginBottom: espacamento.xs,
  },
  detalhe: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
  },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: 3,
    marginTop: espacamento.sm,
  },
  textoSelo: {
    fontSize: fonte.pequena,
    fontWeight: 'bold',
  },
});
