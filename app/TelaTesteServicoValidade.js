import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { calcularDiasRestantes, classificarSituacao } from '../services/ServicoValidade';
import { resumirProdutos, ordenarPorValidade } from '../services/ServicoDashboard';
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
 * Tela de teste temporária para validação das Issues #4 (ServicoValidade) e #5 (ServicoDashboard).
 * Será removida na Issue #10 junto com os mocks.
 */
export default function TelaTesteServicoValidade() {
  const hojeIso = dataParaIso(new Date());

  const casosComoProdutos = CASOS_DE_TESTE.map((caso) => new Produto({
    id: `teste-${caso.offset}`,
    nome: caso.nome,
    quantidade: 1,
    dataDeValidade: dataRelativa(caso.offset),
    fotoUri: null,
    dataDeCadastro: hojeIso,
  }));

  const resumo = resumirProdutos(casosComoProdutos);
  const ordenados = ordenarPorValidade(casosComoProdutos);
  const somaContadores = resumo.vencidos + resumo.venceEstaSemana + resumo.venceEsteMes + resumo.ok;

  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Teste do ServicoValidade e ServicoDashboard</Text>
      <Text style={styles.descricao}>
        Tela de teste temporária das issues #4 e #5 para validação das regras de vencimento nos casos-limite e das agregações do dashboard.
      </Text>

      {casosComoProdutos.map((produto) => {
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

      <View style={styles.divisor} />

      <Text style={styles.tituloSecao}>Dashboard (Issue #5)</Text>
      <Text style={styles.descricao}>
        Agregações calculadas com ServicoDashboard sobre os 5 casos acima.
      </Text>

      {/* Contadores e verificação de consistência */}
      <View style={styles.cardDashboard}>
        <View style={styles.linhaTotal}>
          <Text style={styles.rotuloTotal}>Total de produtos:</Text>
          <Text style={styles.valorTotal}>
            {resumo.total} <Text style={styles.somaTotal}>(Soma dos 4 contadores: {somaContadores})</Text>
          </Text>
        </View>

        <View style={styles.gradeContadores}>
          <View style={[styles.itemContador, { borderColor: situacoes.vencido.cor }]}>
            <Text style={[styles.numeroContador, { color: situacoes.vencido.cor }]}>{resumo.vencidos}</Text>
            <Text style={styles.rotuloContador}>{situacoes.vencido.rotulo}</Text>
          </View>
          <View style={[styles.itemContador, { borderColor: situacoes.venceEstaSemana.cor }]}>
            <Text style={[styles.numeroContador, { color: situacoes.venceEstaSemana.cor }]}>{resumo.venceEstaSemana}</Text>
            <Text style={styles.rotuloContador}>{situacoes.venceEstaSemana.rotulo}</Text>
          </View>
          <View style={[styles.itemContador, { borderColor: situacoes.venceEsteMes.cor }]}>
            <Text style={[styles.numeroContador, { color: situacoes.venceEsteMes.cor }]}>{resumo.venceEsteMes}</Text>
            <Text style={styles.rotuloContador}>{situacoes.venceEsteMes.rotulo}</Text>
          </View>
          <View style={[styles.itemContador, { borderColor: situacoes.ok.cor }]}>
            <Text style={[styles.numeroContador, { color: situacoes.ok.cor }]}>{resumo.ok}</Text>
            <Text style={styles.rotuloContador}>{situacoes.ok.rotulo}</Text>
          </View>
        </View>
      </View>

      {/* Lista ordenada por validade */}
      <Text style={styles.tituloSecao}>Lista ordenada por validade</Text>
      <Text style={styles.descricao}>
        Ordenada com ordenarPorValidade (mais próximo primeiro).
      </Text>

      <View style={styles.cardDashboard}>
        {ordenados.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.linhaOrdenada,
              index < ordenados.length - 1 && styles.bordaInferior,
            ]}
          >
            <Text style={styles.nomeCasoOrdenado}>{item.nome}</Text>
            <Text style={styles.valor}>{formatarDataBR(item.dataDeValidade)}</Text>
          </View>
        ))}
      </View>
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
  divisor: {
    height: 1,
    backgroundColor: cores.borda,
    marginVertical: espacamento.md,
  },
  tituloSecao: {
    fontSize: fonte.media,
    fontWeight: 'bold',
    color: cores.texto,
    marginBottom: espacamento.xs,
  },
  cardDashboard: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    padding: espacamento.md,
    marginBottom: espacamento.md,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: espacamento.md,
    flexWrap: 'wrap',
  },
  rotuloTotal: {
    fontSize: fonte.normal,
    fontWeight: 'bold',
    color: cores.texto,
  },
  valorTotal: {
    fontSize: fonte.normal,
    fontWeight: 'bold',
    color: cores.texto,
  },
  somaTotal: {
    fontSize: fonte.pequena,
    fontWeight: 'normal',
    color: cores.textoSecundario,
  },
  gradeContadores: {
    flexDirection: 'row',
    gap: espacamento.xs,
  },
  itemContador: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espacamento.sm,
    borderWidth: 1,
    borderRadius: raio.sm,
    backgroundColor: cores.fundo,
  },
  numeroContador: {
    fontSize: fonte.titulo,
    fontWeight: 'bold',
  },
  rotuloContador: {
    fontSize: 11,
    color: cores.textoSecundario,
    textAlign: 'center',
    marginTop: 2,
  },
  linhaOrdenada: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: espacamento.sm,
  },
  bordaInferior: {
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  nomeCasoOrdenado: {
    fontSize: fonte.normal,
    color: cores.texto,
    fontWeight: '500',
  },
});

