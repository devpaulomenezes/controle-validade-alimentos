import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function TelaCadastro({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.infoText}>Cadastro de produtos será implementado em issue futura.</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
