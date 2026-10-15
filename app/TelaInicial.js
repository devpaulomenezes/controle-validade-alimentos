import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ProdutoCard from '../components/ProdutoCard';
import EmptyState from '../components/EmptyState';
import PainelDashboard from '../components/PainelDashboard';
import { cores, situacoes, espacamento, raio, fonte, estilosBase } from '../components/theme';
// MOCKS: trocados pelo JsonProdutoRepository (#3) e pelos serviços reais (#4 e #5)
// assim que eles estiverem na dev; é a parte que falta da issue #10.
import repositorio from '../mocks/MockProdutoRepository';
import { classificarSituacao, ordenarPorValidade, resumirProdutos } from '../mocks/servicosMock';

const FILTROS = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'vencido', rotulo: 'Vencidos' },
  { chave: 'venceEstaSemana', rotulo: 'Vencem esta semana' },
  { chave: 'venceEsteMes', rotulo: 'Vencem este mês' },
  { chave: 'ok', rotulo: 'Ok' },
];

/** Minúsculas e sem acentos, para "lei" encontrar "Leite" e "feijao" encontrar "Feijão". */
function normalizar(texto) {
  const minusculo = texto.toLowerCase();
  return typeof minusculo.normalize === 'function'
    ? minusculo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : minusculo;
}

/** Lê os produtos do repositório, já ordenados e com a situação de cada um. */
async function carregarItens() {
  const produtos = ordenarPorValidade(await repositorio.listar());
  return produtos.map((produto) => ({ produto, situacao: classificarSituacao(produto) }));
}

export default function TelaInicial({ navigation }) {
  const [itens, setItens] = useState([]); // [{ produto, situacao }]
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');

  const abrirCadastro = useCallback(() => navigation.navigate('Cadastro'), [navigation]);
  const abrirMenuTestes = useCallback(() => {
    Alert.alert('Recursos do Dispositivo', 'Selecione a tela de teste desejada:', [
      { text: 'Câmera (Issue #11)', onPress: () => navigation.navigate('TesteCamera') },
      { text: 'Notificações (Issue #12)', onPress: () => navigation.navigate('TesteNotificacoes') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={abrirMenuTestes}
          accessibilityRole="button"
          accessibilityLabel="Menu de testes"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.areaBotaoCabecalho}
        >
          <Text style={styles.botaoCabecalho}>Testes</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={abrirCadastro}
          accessibilityRole="button"
          accessibilityLabel="Adicionar produto"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.areaBotaoCabecalho}
        >
          <Text style={styles.botaoCabecalho}>+ Novo</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, abrirCadastro, abrirMenuTestes]);

  // Recarrega sempre que a tela ganha foco (ex.: ao voltar do cadastro).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregarItens()
        .then((novos) => {
          if (ativo) setItens(novos);
        })
        .catch((erro) => console.error('[TelaInicial] erro ao carregar produtos:', erro))
        .finally(() => {
          if (ativo) setCarregando(false);
        });
      return () => {
        ativo = false;
      };
    }, [])
  );

  const confirmarRemocao = useCallback((produto) => {
    Alert.alert('Remover produto', `Remover "${produto.nome}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await repositorio.remover(produto.id);
            setItens(await carregarItens());
          } catch (erro) {
            console.error('[TelaInicial] erro ao remover produto:', erro);
            Alert.alert('Erro', 'Não foi possível remover o produto. Tente novamente.');
          }
        },
      },
    ]);
  }, []);

  const resumo = useMemo(() => resumirProdutos(itens.map(({ produto }) => produto)), [itens]);

  const itensVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return itens.filter(
      ({ produto, situacao }) =>
        (filtro === 'todas' || situacao === filtro) && normalizar(produto.nome).includes(termo)
    );
  }, [itens, busca, filtro]);

  if (carregando) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  if (itens.length === 0) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <EmptyState textoAcao="+ Adicionar produto" onAcao={abrirCadastro} />
      </View>
    );
  }

  return (
    <View style={estilosBase.tela}>
      <View style={styles.topo}>
        <PainelDashboard resumo={resumo} onSelecionar={setFiltro} />
        <TextInput
          style={estilosBase.campo}
          placeholder="Buscar por nome"
          placeholderTextColor={cores.textoSecundario}
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtros}
          keyboardShouldPersistTaps="handled"
        >
          {FILTROS.map(({ chave, rotulo }) => {
            const ativo = filtro === chave;
            const cor = situacoes[chave]?.cor ?? cores.primaria;
            return (
              <TouchableOpacity
                key={chave}
                onPress={() => setFiltro(chave)}
                style={[styles.chip, ativo && { backgroundColor: cor, borderColor: cor }]}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.textoChip, ativo && styles.textoChipAtivo]}>{rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={itensVisiveis}
        keyExtractor={({ produto }) => produto.id}
        renderItem={({ item }) => (
          <ProdutoCard produto={item.produto} situacao={item.situacao} onRemover={confirmarRemocao} />
        )}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <EmptyState
            icone="🔍"
            mensagem="Nenhum produto encontrado"
            descricao="Tente outro nome ou outro filtro."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    justifyContent: 'center',
  },
  areaBotaoCabecalho: {
    paddingVertical: espacamento.sm,
    paddingHorizontal: espacamento.sm,
  },
  botaoCabecalho: {
    color: cores.textoInverso,
    fontSize: fonte.normal,
    fontWeight: 'bold',
  },
  topo: {
    paddingHorizontal: espacamento.md,
    paddingTop: espacamento.md,
  },
  filtros: {
    paddingVertical: espacamento.sm,
    gap: espacamento.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: 6,
  },
  textoChip: {
    fontSize: fonte.pequena,
    color: cores.texto,
  },
  textoChipAtivo: {
    color: cores.textoInverso,
    fontWeight: 'bold',
  },
  lista: {
    paddingHorizontal: espacamento.md,
    paddingBottom: espacamento.xl,
  },
});
