/**
 * TELA DE TESTE TEMPORÁRIA (issue #7) — exibe os componentes reutilizáveis
 * com produtos mock, um em cada situação. Será removida quando a listagem
 * real (issue #9) passar a usar os mesmos componentes.
 */
import React from 'react';
import { ScrollView, Text, Image, StyleSheet } from 'react-native';
import ProdutoCard from '../components/ProdutoCard';
import EmptyState from '../components/EmptyState';
import { cores, espacamento, fonte, estilosBase } from '../components/theme';
import Produto from '../data/Produto';

// Imagem local do projeto, só para testar o cartão com foto.
const fotoExemplo = Image.resolveAssetSource(require('../assets/icon.png')).uri;

// A situação vem fixa junto do mock: o cartão apenas a exibe.
const exemplos = [
  {
    situacao: 'vencido',
    produto: new Produto({ id: 't1', nome: 'Iogurte natural', quantidade: 2, dataDeValidade: '2026-10-10', fotoUri: null, dataDeCadastro: '2026-10-01' }),
  },
  {
    situacao: 'venceEstaSemana',
    produto: new Produto({ id: 't2', nome: 'Leite integral', quantidade: 6, dataDeValidade: '2026-10-16', fotoUri: fotoExemplo, dataDeCadastro: '2026-10-01' }),
  },
  {
    situacao: 'venceEsteMes',
    produto: new Produto({ id: 't3', nome: 'Queijo mussarela', quantidade: 1, dataDeValidade: '2026-10-28', fotoUri: null, dataDeCadastro: '2026-10-01' }),
  },
  {
    situacao: 'ok',
    produto: new Produto({ id: 't4', nome: 'Arroz branco 5 kg', quantidade: 3, dataDeValidade: '2027-04-20', fotoUri: null, dataDeCadastro: '2026-10-01' }),
  },
];

export default function TelaTesteComponentes() {
  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.secao}>ProdutoCard — 4 situações</Text>
      {exemplos.map(({ produto, situacao }) => (
        <ProdutoCard key={produto.id} produto={produto} situacao={situacao} />
      ))}

      <Text style={styles.secao}>EmptyState</Text>
      <EmptyState textoAcao="+ Adicionar produto" onAcao={() => console.log('[TelaTesteComponentes] ação do EmptyState')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    padding: espacamento.md,
  },
  secao: {
    fontSize: fonte.media,
    fontWeight: 'bold',
    color: cores.texto,
    marginTop: espacamento.md,
    marginBottom: espacamento.sm,
  },
});
