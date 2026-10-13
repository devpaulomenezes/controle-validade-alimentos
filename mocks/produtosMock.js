/**
 * MOCK TEMPORÁRIO — produtos de exemplo para testar a listagem (issue #9).
 * As validades são relativas a hoje, para que cada produto continue na
 * mesma situação em qualquer dia em que o app for testado. Inclui nomes
 * repetidos ("Leite ...") para testar a busca.
 */
import Produto from '../data/Produto';
import { dataParaIso } from '../components/formatoData';

function daquiA(dias) {
  const hoje = new Date();
  return dataParaIso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias));
}

const exemplos = [
  { nome: 'Iogurte natural', quantidade: 2, dias: -3 },
  { nome: 'Presunto fatiado', quantidade: 1, dias: -1 },
  { nome: 'Leite integral', quantidade: 6, dias: 0 },
  { nome: 'Pão de forma', quantidade: 1, dias: 3 },
  { nome: 'Leite desnatado', quantidade: 4, dias: 6 },
  { nome: 'Queijo mussarela', quantidade: 1, dias: 12 },
  { nome: 'Leite condensado', quantidade: 3, dias: 25 },
  { nome: 'Arroz branco 5 kg', quantidade: 2, dias: 180 },
  { nome: 'Feijão carioca', quantidade: 3, dias: 240 },
];

export function criarProdutosMock() {
  const cadastro = new Date().toISOString();
  return exemplos.map(
    ({ nome, quantidade, dias }, indice) =>
      new Produto({
        id: `mock-${indice + 1}`,
        nome,
        quantidade,
        dataDeValidade: daquiA(dias),
        fotoUri: null,
        dataDeCadastro: cadastro,
      })
  );
}
