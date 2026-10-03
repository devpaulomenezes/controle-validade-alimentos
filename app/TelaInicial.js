import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function TelaInicial({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Meus produtos</Text>
      
      <Text style={styles.emptyText}>Nenhum produto cadastrado</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Cadastro')}
      >
        <Text style={styles.buttonText}>+ Adicionar produto</Text>
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007bff',
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
