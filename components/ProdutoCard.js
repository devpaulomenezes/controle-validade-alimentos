import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { cores, situacoes, espacamento, raio, fonte } from './theme';
import { formatarDataBR } from './formatoData';

/**
 * Cartão de um produto na listagem.
 *
 * O cartão NÃO calcula datas: a situação chega pronta (calculada pelo
 * ServicoValidade).
 *
 * @param {Object} props
 * @param {import('../data/Produto').default} props.produto - Produto do contrato da issue #1.
 * @param {'vencido'|'venceEstaSemana'|'venceEsteMes'|'ok'} props.situacao - Situação já classificada.
 * @param {(produto) => void} [props.onRemover] - Quando informado, mostra o botão "Remover".
 * @param {(produto) => void} [props.onPress] - Chamado ao tocar no corpo do cartão (abre o detalhe).
 * @param {(produto) => void} [props.onEditar] - Quando informado, mostra o botão "Editar".
 */
export default function ProdutoCard({ produto, situacao, onRemover, onPress, onEditar }) {
  // Guarda a URI que falhou (e não um booleano): quando a foto muda, a nova
  // URI é diferente da que falhou e volta a ser exibida, sem precisar de efeito.
  const [uriComErro, setUriComErro] = useState(null);
  const estiloSituacao = situacoes[situacao];
  const corDestaque = estiloSituacao ? estiloSituacao.cor : cores.borda;
  const temFoto = Boolean(produto.fotoUri) && produto.fotoUri !== uriComErro;

  const Corpo = onPress ? TouchableOpacity : View;
  const propsCorpo = onPress
    ? {
        onPress: () => onPress(produto),
        accessibilityRole: 'button',
        accessibilityLabel: `Ver detalhes de ${produto.nome}`,
      }
    : {};

  return (
    <View style={[styles.card, { borderLeftColor: corDestaque }]}>
      <Corpo style={styles.corpo} {...propsCorpo}>
        {temFoto ? (
          <Image
            source={{ uri: produto.fotoUri }}
            style={styles.foto}
            onError={() => setUriComErro(produto.fotoUri)}
          />
        ) : (
          <View style={[styles.foto, styles.placeholder]}>
            <Text style={styles.iconePlaceholder}>🥫</Text>
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
      </Corpo>

      {onEditar || onRemover ? (
        <View style={styles.acoes}>
          {onEditar ? (
            <TouchableOpacity
              onPress={() => onEditar(produto)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${produto.nome}`}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.botaoAcao}
            >
              <Text style={styles.textoEditar}>Editar</Text>
            </TouchableOpacity>
          ) : null}
          {onRemover ? (
            <TouchableOpacity
              onPress={() => onRemover(produto)}
              accessibilityRole="button"
              accessibilityLabel={`Remover ${produto.nome}`}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.botaoAcao}
            >
              <Text style={styles.textoRemover}>Remover</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
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
  iconePlaceholder: {
    fontSize: 28,
    textAlign: 'center',
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
  corpo: {
    flex: 1,
    flexDirection: 'row',
  },
  acoes: {
    marginLeft: espacamento.sm,
    gap: espacamento.sm,
    alignItems: 'flex-end',
  },
  botaoAcao: {
    paddingVertical: espacamento.xs,
  },
  textoEditar: {
    fontSize: fonte.pequena,
    fontWeight: 'bold',
    color: cores.primaria,
  },
  textoRemover: {
    fontSize: fonte.pequena,
    fontWeight: 'bold',
    color: cores.erro,
  },
});