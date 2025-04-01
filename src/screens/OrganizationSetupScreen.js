import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Keyboard, 
  TouchableWithoutFeedback, 
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext'; // To switch context after success

const OrganizationSetupScreen = ({ navigation }) => {
  const [mode, setMode] = useState('select'); // 'select', 'create', 'join'
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { createOrganization, joinOrganizationByInviteCode } = useAuth();
  const { switchOrganizationContext } = useOrganization();

  const handleCreate = async () => {
    if (!orgName.trim() || orgName.trim().length < 3) {
      setError('Organisationsname muss mind. 3 Zeichen lang sein.');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    setError('');
    
    const result = await createOrganization(orgName.trim());
    
    setIsLoading(false);
    
    if (result.success) {
      Alert.alert('Erfolg', `Organisation "${result.data.name}" wurde erstellt!`);
      // Optionally switch context immediately
      // await switchOrganizationContext(result.data.id); 
      navigation.goBack(); // Go back to profile screen after creation
    } else {
      setError(result.error?.message || 'Organisation konnte nicht erstellt werden.');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Bitte gib einen Einladungscode ein.');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);
    setError('');
    
    const result = await joinOrganizationByInviteCode(inviteCode.trim());
    
    setIsLoading(false);
    
    if (result.success) {
      Alert.alert('Erfolg', `Du bist "${result.data.name}" beigetreten!`);
      // Optionally switch context immediately
      // await switchOrganizationContext(result.data.id);
      navigation.goBack(); // Go back to profile screen after joining
    } else {
      setError(result.error?.message || 'Beitritt fehlgeschlagen.');
    }
  };

  const renderContent = () => {
    if (mode === 'create') {
      return (
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Name der neuen Organisation</Text>
          <TextInput
            style={styles.input}
            placeholder="z.B. Sportverein Musterdorf"
            value={orgName}
            onChangeText={setOrgName}
            autoCapitalize="words"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity 
            style={[styles.button, styles.actionButton, isLoading && styles.buttonDisabled]} 
            onPress={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Organisation erstellen</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode('select'); setError(''); }}>
            <Text style={styles.backLink}>Zurück</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (mode === 'join') {
      return (
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Einladungscode</Text>
          <TextInput
            style={styles.input}
            placeholder="Code eingeben"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            maxLength={8} // Assuming invite codes are 8 chars
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity 
            style={[styles.button, styles.actionButton, isLoading && styles.buttonDisabled]} 
            onPress={handleJoin}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Organisation beitreten</Text>}
          </TouchableOpacity>
           <TouchableOpacity onPress={() => { setMode('select'); setError(''); }}>
            <Text style={styles.backLink}>Zurück</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default: mode === 'select'
    return (
      <View style={styles.selectionContainer}>
        <TouchableOpacity style={[styles.button, styles.optionButton]} onPress={() => { setMode('create'); setError(''); }}>
           <Ionicons name="add-circle-outline" size={24} color="#4285F4" style={styles.buttonIcon} />
          <Text style={styles.buttonTextAlt}>Neue Organisation erstellen</Text>
        </TouchableOpacity>
        <Text style={styles.orText}>oder</Text>
        <TouchableOpacity style={[styles.button, styles.optionButton]} onPress={() => { setMode('join'); setError(''); }}>
           <Ionicons name="log-in-outline" size={24} color="#34A853" style={styles.buttonIcon} />
          <Text style={styles.buttonTextAlt}>Bestehender Organisation beitreten</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          <Text style={styles.title}>Organisation verwalten</Text>
          <View style={{ width: 24 }} /> {/* Spacer */}
        </View>
        <Text style={styles.subtitle}>
          Erstelle eine neue Organisation (Verein, Gemeinde, Unternehmen) oder trete einer bestehenden mittels Einladungscode bei.
        </Text>
        
        {renderContent()}
        
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
   scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40, // Extra padding at the top
    alignItems: 'center',
  },
   header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
   backButton: {
     padding: 5, // Easier tap target
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1, // Allow title to take space
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  selectionContainer: {
    width: '100%',
    alignItems: 'center',
  },
   formContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    maxWidth: 350,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
   optionButton: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#eee',
   },
  actionButton: {
     backgroundColor: '#4285F4',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
   buttonTextAlt: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 10,
  },
   buttonIcon: {
    marginRight: 5,
  },
  orText: {
    marginVertical: 15,
    color: '#888',
    fontSize: 14,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  backLink: {
    marginTop: 25,
    color: '#4285F4',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default OrganizationSetupScreen; 