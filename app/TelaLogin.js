/**
 * TelaLogin (APP-06) — login e cadastro, alternados por um botão. Fala
 * somente com AuthService (não conhece o repositório nem a fila offline).
 * Em caso de sucesso, avisa a navegação pelo callback aoAutenticar (prop);
 * a decisão de qual stack mostrar é de App.js (APP-07), não desta tela.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import AuthService from '../services/AuthService';
import { cores, espacamento, fonte, estilosBase } from '../theme/theme';

const EMAIL_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar({ modo, nome, email, senha }) {
  const erros = {};
  if (modo === 'cadastro' && !nome.trim()) {
    erros.nome = 'Informe seu nome.';
  }
  if (!email.trim()) {
    erros.email = 'Informe seu e-mail.';
  } else if (!EMAIL_BASICO.test(email.trim())) {
    erros.email = 'Informe um e-mail válido.';
  }
  if (!senha) {
    erros.senha = 'Informe sua senha.';
  } else if (senha.length < 6) {
    erros.senha = 'A senha deve ter no mínimo 6 caracteres.';
  }
  return erros;
}

function mensagemDeErro(erro) {
  return erro?.message || 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

export default function TelaLogin({ aoAutenticar }) {
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'cadastro'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  // Trava síncrona contra toque duplo: o `disabled` do botão só vale após o re-render.
  const enviandoRef = useRef(false);

  const modoCadastro = modo === 'cadastro';
  const rotuloAcao = modoCadastro ? 'Criar conta' : 'Entrar';

  function limparErro(campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function alternarModo() {
    setModo((atual) => (atual === 'entrar' ? 'cadastro' : 'entrar'));
    setErros({});
  }

  async function enviar() {
    if (enviandoRef.current) return;
    const novosErros = validar({ modo, nome, email, senha });
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    enviandoRef.current = true;
    setEnviando(true);
    try {
      const sessao = modoCadastro
        ? await AuthService.registrar(nome.trim(), email.trim(), senha)
        : await AuthService.login(email.trim(), senha);
      aoAutenticar?.(sessao.usuario);
    } catch (erro) {
      setSenha('');
      Alert.alert(modoCadastro ? 'Erro ao criar conta' : 'Erro ao entrar', mensagemDeErro(erro));
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilosBase.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>{modoCadastro ? 'Criar conta' : 'Entrar'}</Text>

        {modoCadastro ? (
          <View style={styles.grupo}>
            <Text style={estilosBase.rotulo}>Nome</Text>
            <TextInput
              style={[estilosBase.campo, erros.nome && styles.campoComErro]}
              placeholder="Seu nome"
              placeholderTextColor={cores.textoSecundario}
              value={nome}
              onChangeText={(texto) => { setNome(texto); limparErro('nome'); }}
              accessibilityLabel="Nome"
              autoCapitalize="words"
              editable={!enviando}
            />
            {erros.nome ? <Text style={estilosBase.textoErro}>{erros.nome}</Text> : null}
          </View>
        ) : null}

        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>E-mail</Text>
          <TextInput
            style={[estilosBase.campo, erros.email && styles.campoComErro]}
            placeholder="seu@email.com"
            placeholderTextColor={cores.textoSecundario}
            value={email}
            onChangeText={(texto) => { setEmail(texto); limparErro('email'); }}
            accessibilityLabel="E-mail"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!enviando}
          />
          {erros.email ? <Text style={estilosBase.textoErro}>{erros.email}</Text> : null}
        </View>

        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>Senha</Text>
          <TextInput
            style={[estilosBase.campo, erros.senha && styles.campoComErro]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={cores.textoSecundario}
            value={senha}
            onChangeText={(texto) => { setSenha(texto); limparErro('senha'); }}
            accessibilityLabel="Senha"
            secureTextEntry
            editable={!enviando}
          />
          {erros.senha ? <Text style={estilosBase.textoErro}>{erros.senha}</Text> : null}
        </View>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botaoEnviar, enviando && styles.botaoDesabilitado]}
          onPress={enviar}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel={rotuloAcao}
        >
          {enviando ? <ActivityIndicator color={cores.textoInverso} /> : <Text style={estilosBase.textoBotaoPrimario}>{rotuloAcao}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoAlternar}
          onPress={alternarModo}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel={modoCadastro ? 'Já tenho conta' : 'Criar conta nova'}
        >
          <Text style={styles.textoAlternar}>
            {modoCadastro ? 'Já tenho conta. Entrar' : 'Não tenho conta. Criar conta'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: espacamento.md, flexGrow: 1, justifyContent: 'center' },
  titulo: { fontSize: fonte.titulo, fontWeight: 'bold', color: cores.texto, marginBottom: espacamento.lg, textAlign: 'center' },
  grupo: { marginBottom: espacamento.md },
  campoComErro: { borderColor: cores.erro },
  botaoEnviar: { marginTop: espacamento.sm },
  botaoDesabilitado: { opacity: 0.6 },
  botaoAlternar: { marginTop: espacamento.md, alignItems: 'center' },
  textoAlternar: { color: cores.primaria, fontSize: fonte.pequena, fontWeight: '600' },
});