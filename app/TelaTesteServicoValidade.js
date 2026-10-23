import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { calcularDiasRestantes, classificarSituacao } from '../services/ServicoValidade';
import Produto from '../data/Produto';
import { dataParaIso, formatarDataBR } from '../components/formatoData';
import { cores, situacoes, espacamento, raio, fonte, estilosBase } from '../components/theme';

/** Gera uma data ISO ('YYYY-MM-DD') somando dias à data local de hoje. */
function dataRelativa(offset) {
  const data = new Date();
  data.setDate(data.getDate() + offset);
  return dataParaIso(data);
}

const CASOS_DE_TESTE = [
  { nome: 'Venceu ontem', offset: -1 },
  { nome: 'Vence hoje', offset: 0 },
  { nome: 'Vence em 7 dias', offset: 7 },
  { nome: 'Vence em 8 dias', offset: 8 },
  { nome: 'Vence no mês que vem (35 dias)', offset: 35 },
];

/**
 * Tela de teste temporária para validação da Issue #4 (ServicoValidade).
 * Será removida na Issue #10 junto com os mocks.
 */
export default function TelaTesteServicoValidade() {
  const hojeIso = dataParaIso(new Date());

  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Teste do ServicoValidade</Text>
      <Text style={styles.descricao}>
        Tela de teste temporária da issue #4 para validação das regras de vencimento nos casos-limite.
      </Text>

      {CASOS_DE_TESTE.map((caso) => {
        const produto = new Produto({
          id: `teste-${caso.offset}`,
          nome: caso.nome,
          quantidade: 1,
          dataDeValidade: dataRelativa(caso.offset),
          fotoUri: null,
          dataDeCadastro: hojeIso,
        });

        const dias = calcularDiasRestantes(produto.dataDeValidade);
        const situacao = classificarSituacao(produto);
        const configSituacao = situacoes[situacao];

        return (
          <View key={produto.id} style={[styles.card, { borderLeftColor: configSituacao.cor }]}>
            <View style={styles.cabecalhoCard}>
              <Text style={styles.nomeCaso}>{produto.nome}</Text>
              <View style={[styles.selo, { backgroundColor: configSituacao.fundo }]}>
                <Text style={[styles.textoSelo, { color: configSituacao.cor }]}>
                  {configSituacao.rotulo}
                </Text>
              </View>
            </View>

            <Text style={styles.detalhe}>
              Validade: <Text style={styles.valor}>{formatarDataBR(produto.dataDeValidade)}</Text>
            </Text>
            <Text style={styles.detalhe}>
              Dias restantes: <Text style={styles.valor}>{dias} dia(s)</Text>
            </Text>
            <Text style={styles.detalhe}>
              Situação: <Text style={[styles.valor, { color: configSituacao.cor }]}>{situacao}</Text>
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    padding: espacamento.md,
    paddingBottom: espacamento.xl,
  },
  titulo: {
    fontSize: fonte.titulo,
    fontWeight: 'bold',
    color: cores.texto,
    marginBottom: espacamento.xs,
  },
  descricao: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
    marginBottom: espacamento.md,
  },
  card: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderLeftWidth: 4,
    padding: espacamento.md,
    marginBottom: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cabecalhoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: espacamento.xs,
  },
  nomeCaso: {
    fontSize: fonte.media,
    fontWeight: 'bold',
    color: cores.texto,
  },
  selo: {
    paddingHorizontal: espacamento.sm,
    paddingVertical: 2,
    borderRadius: raio.pill,
  },
  textoSelo: {
    fontSize: fonte.pequena,
    fontWeight: '600',
  },
  detalhe: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
    marginTop: 2,
  },
  valor: {
    fontWeight: '600',
    color: cores.texto,
  },
});
