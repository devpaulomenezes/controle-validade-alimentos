import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { cores, situacoes, espacamento, raio, fonte, estilosBase } from '../theme/theme';
import repositorio from '../data/OfflineFirstProdutoRepository';
import AuthService from '../services/AuthService';
import { classificarSituacao } from '../services/ServicoValidade';
import { ordenarPorValidade, resumirProdutos } from '../services/ServicoDashboard';
import NotificacoesService from '../services/NotificacoesService';
import CameraService from '../services/CameraService';

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

export default function TelaInicial({ navigation, aoDeslogar, aoSessaoExpirada }) {
  const [itens, setItens] = useState([]); // [{ produto, situacao }]
  const [carregando, setCarregando] = useState(true);
  const [removendo, setRemovendo] = useState(false);
  const [erroCarga, setErroCarga] = useState(null); // mensagem quando listar() falha
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [saindo, setSaindo] = useState(false);

  const abrirCadastro = useCallback(() => navigation.navigate('Cadastro'), [navigation]);
  const abrirDetalhe = useCallback(
    (produto) => navigation.navigate('TelaDetalhe', { produtoId: produto.id }),
    [navigation]
  );
  // Cópia simples: o React Navigation avisa sobre instâncias de classe nos params.
  const abrirEdicao = useCallback(
    (produto) => navigation.navigate('Cadastro', { produto: { ...produto } }),
    [navigation]
  );

  /** Falha ao ler a base: avisa, mostra o estado de falha e NÃO grava nada. */
  const tratarErroCarga = useCallback((erro) => {
    console.error('[TelaInicial] erro ao carregar produtos:', erro);
    const mensagem = erro?.message || 'Não foi possível carregar os produtos.';
    setItens([]);
    setErroCarga(mensagem);
    Alert.alert('Erro ao carregar', mensagem);
  }, []);

  /** 401 na sincronização: apaga a sessão local e avisa o App.js (volta ao login). */
  const tratarSessaoExpirada = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (erro) {
      console.error('[TelaInicial] erro ao apagar a sessão expirada:', erro);
    }
    aoSessaoExpirada?.();
  }, [aoSessaoExpirada]);

  /**
   * Logout: bloqueado enquanto houver operações do usuário na fila (sair agora
   * perderia esses dados). Sem pendências, limpa o cache local — o próximo
   * usuário não vê os produtos do anterior — e só então apaga a sessão.
   */
  const sair = useCallback(async () => {
    if (saindo) return;
    setSaindo(true);
    try {
      const totalPendentes = await repositorio.quantidadePendente();
      if (totalPendentes > 0) {
        const quantidade =
          totalPendentes === 1 ? '1 alteração' : `${totalPendentes} alterações`;
        Alert.alert(
          'Alterações não sincronizadas',
          `Você tem ${quantidade} aguardando conexão. Conecte-se à internet antes de sair, para não perder esses dados.`
        );
        return;
      }
      await repositorio.limparCacheLocal();
      await AuthService.logout();
      aoDeslogar?.();
    } catch (erro) {
      console.error('[TelaInicial] erro ao sair:', erro);
      Alert.alert('Erro', erro?.message || 'Não foi possível sair. Tente novamente.');
    } finally {
      setSaindo(false);
    }
  }, [saindo, aoDeslogar]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={sair}
          disabled={saindo}
          accessibilityRole="button"
          accessibilityLabel="Sair"
          accessibilityState={{ disabled: saindo }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.areaBotaoCabecalho}
        >
          <Text style={styles.botaoCabecalho}>Sair</Text>
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
  }, [navigation, abrirCadastro, sair, saindo]);

  // "Em andamento" fica numa ref, e não num estado: se este useCallback
  // dependesse de um estado que ele mesmo altera, sua identidade mudaria a
  // cada execução e o useFocusEffect abaixo o chamaria em loop.
  const sincronizandoRef = useRef(false);

  /** Envia a fila, baixa a base remota e recarrega a lista a partir do cache local. */
  const sincronizarRepositorio = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    try {
      let sessaoExpirada = false;
      try {
        const resultado = await repositorio.sincronizar();
        sessaoExpirada = Boolean(resultado?.sessaoExpirada);
      } catch (erro) {
        // Sincronizar é melhor-esforço: a lista local ainda é carregada abaixo.
        console.error('[TelaInicial] erro ao sincronizar:', erro);
      }
      if (sessaoExpirada) {
        await tratarSessaoExpirada();
        return;
      }
      try {
        setItens(await carregarItens());
        setErroCarga(null);
      } catch (erro) {
        tratarErroCarga(erro);
      }
    } finally {
      sincronizandoRef.current = false;
    }
  }, [tratarErroCarga, tratarSessaoExpirada]);

  // Sincroniza e recarrega sempre que a tela ganha foco (ex.: ao voltar do cadastro).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      sincronizarRepositorio().finally(() => {
        if (ativo) setCarregando(false);
      });
      return () => {
        ativo = false;
      };
    }, [sincronizarRepositorio])
  );

  const confirmarRemocao = useCallback(
    (produto) => {
      Alert.alert('Remover produto', `Remover "${produto.nome}" da lista?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (removendo) return;
            setRemovendo(true);
            try {
              // Ordem obrigatória: 1) cancelar alerta, 2) remover do repositório,
              // 3) apagar a foto (só se o 2 teve sucesso), 4) recarregar.
              try {
                await NotificacoesService.cancelarAlerta(produto.id);
                await repositorio.remover(produto.id);
              } catch (erro) {
                console.error('[TelaInicial] erro ao remover produto:', erro);
                Alert.alert(
                  'Erro',
                  erro?.message || 'Não foi possível remover o produto. Tente novamente.'
                );
                return;
              }
              await CameraService.removerFoto(produto.fotoUri);
              try {
                setItens(await carregarItens());
                setErroCarga(null);
              } catch (erro) {
                tratarErroCarga(erro);
              }
            } finally {
              setRemovendo(false);
            }
          },
        },
      ]);
    },
    [removendo, tratarErroCarga]
  );

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

  if (erroCarga) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <EmptyState icone="⚠️" mensagem="Falha ao carregar os produtos" descricao={erroCarga} />
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
          <ProdutoCard
            produto={item.produto}
            situacao={item.situacao}
            onRemover={confirmarRemocao}
            onPress={abrirDetalhe}
            onEditar={abrirEdicao}
          />
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
