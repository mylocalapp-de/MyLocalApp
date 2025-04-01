import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

// Simple component to display environment variables status in development
const EnvDebug = () => {
  // Only show in development mode
  if (!__DEV__) return null;

  const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra || {};
  
  const urlStatus = supabaseUrl ? '✅ Defined' : '❌ Undefined';
  const keyStatus = supabaseAnonKey ? '✅ Defined' : '❌ Undefined';
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Environment Variables Status</Text>
      <Text style={styles.item}>Supabase URL: {urlStatus}</Text>
      <Text style={styles.item}>Supabase Anon Key: {keyStatus}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    margin: 10,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  item: {
    marginBottom: 3,
  },
});

export default EnvDebug; 