import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOrganization } from '../context/OrganizationContext';
// Optional: Import Image Picker if you want logo upload
// import * as ImagePicker from 'expo-image-picker';

const OrganizationOnboardingScreen = () => {
    const navigation = useNavigation();
    const { actions: orgActions, isLoading: orgLoading } = useOrganization();

    const [mode, setMode] = useState('join'); // 'join' or 'create'
    const [inviteCode, setInviteCode] = useState('');
    const [orgName, setOrgName] = useState('');
    const [logoUri, setLogoUri] = useState(null); // For logo preview
    const [error, setError] = useState('');

    // TODO: Implement Image Picker logic if needed
    const handlePickLogo = async () => {
        // Request permissions if needed
        // const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        // if (status !== 'granted') {
        //   alert('Sorry, we need camera roll permissions to make this work!');
        //   return;
        // }

        // let result = await ImagePicker.launchImageLibraryAsync({
        //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
        //   allowsEditing: true,
        //   aspect: [1, 1],
        //   quality: 1,
        // });

        // if (!result.canceled) {
        //   setLogoUri(result.assets[0].uri);
        //   // TODO: You'll need to upload this URI to Supabase storage and get the public URL
        // }
        Alert.alert("Logo Upload", "Logo-Upload ist noch nicht implementiert.");
    };

    const handleJoin = async () => {
        if (!inviteCode.trim()) {
            setError('Bitte gib einen Einladungscode ein.');
            return;
        }
        setError('');
        const result = await orgActions.joinOrganization(inviteCode);
        if (result.success) {
            Alert.alert(
                result.alreadyMember ? "Bereits Mitglied" : "Erfolgreich beigetreten",
                result.alreadyMember ? `Du bist bereits Mitglied dieser Organisation.` : `Du bist ${orgName || 'der Organisation'} erfolgreich beigetreten.`
            );
            navigation.goBack(); // Go back to profile screen after joining
        } else {
            setError(result.error?.message || 'Beitritt fehlgeschlagen. Überprüfe den Code.');
        }
    };

    const handleCreate = async () => {
        if (!orgName.trim()) {
            setError('Bitte gib einen Namen für die Organisation ein.');
            return;
        }
        setError('');

        // TODO: Upload logo if logoUri is set, get public URL
        const logoPublicUrl = null; // Placeholder

        const result = await orgActions.createOrganization(orgName, logoPublicUrl);
        if (result.success) {
            Alert.alert("Organisation erstellt", `Die Organisation "${result.data.name}" wurde erfolgreich erstellt.`);
            // Optionally switch context immediately?
            // await orgActions.switchContext(result.data.id);
            navigation.goBack(); // Go back to profile screen
        } else {
            setError(result.error?.message || 'Organisation konnte nicht erstellt werden.');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Custom Header */} 
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Organisation</Text>
                <View style={{ width: 24 }} /> {/* Spacer */} 
            </View>

            {/* Mode Switcher */} 
            <View style={styles.modeSwitcher}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'join' && styles.modeButtonActive]}
                    onPress={() => setMode('join')}
                >
                    <Text style={[styles.modeText, mode === 'join' && styles.modeTextActive]}>Beitreten</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]}
                    onPress={() => setMode('create')}
                >
                    <Text style={[styles.modeText, mode === 'create' && styles.modeTextActive]}>Erstellen</Text>
                </TouchableOpacity>
            </View>

            {/* Form based on mode */} 
            {mode === 'join' ? (
                <View style={styles.formContainer}>
                    <Text style={styles.formLabel}>Einladungscode eingeben</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ABCDEFGH"
                        value={inviteCode}
                        onChangeText={setInviteCode}
                        autoCapitalize="characters"
                        maxLength={8} // Assuming 8-char codes
                    />
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    <TouchableOpacity
                        style={[styles.actionButton, orgLoading && styles.buttonDisabled]}
                        onPress={handleJoin}
                        disabled={orgLoading}
                    >
                        {orgLoading ?
                            <ActivityIndicator color="#fff" /> :
                            <Text style={styles.actionButtonText}>Organisation beitreten</Text>
                        }
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.formContainer}>
                    <Text style={styles.formLabel}>Name der Organisation</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="z.B. Sportverein Musterdorf"
                        value={orgName}
                        onChangeText={setOrgName}
                    />

                    <Text style={styles.formLabel}>Logo (Optional)</Text>
                    <View style={styles.logoContainer}>
                        <Image
                            source={logoUri ? { uri: logoUri } : require('../../assets/avatar_placeholder.png')}
                            style={styles.logoPreview}
                        />
                        <TouchableOpacity style={styles.logoButton} onPress={handlePickLogo}>
                            <Text style={styles.logoButtonText}>Logo auswählen</Text>
                        </TouchableOpacity>
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}
                    <TouchableOpacity
                        style={[styles.actionButton, orgLoading && styles.buttonDisabled]}
                        onPress={handleCreate}
                        disabled={orgLoading}
                    >
                        {orgLoading ?
                            <ActivityIndicator color="#fff" /> :
                            <Text style={styles.actionButtonText}>Organisation erstellen</Text>
                        }
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    modeSwitcher: {
        flexDirection: 'row',
        margin: 20,
        backgroundColor: '#eee',
        borderRadius: 8,
        overflow: 'hidden',
    },
    modeButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeButtonActive: {
        backgroundColor: '#fff',
        borderBottomWidth: 2,
        borderBottomColor: '#4285F4',
    },
    modeText: {
        fontSize: 16,
        color: '#666',
    },
    modeTextActive: {
        color: '#4285F4',
        fontWeight: 'bold',
    },
    formContainer: {
        paddingHorizontal: 20,
    },
    formLabel: {
        fontSize: 14,
        color: '#555',
        marginBottom: 8,
        marginTop: 15,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        paddingVertical: 12,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    actionButton: {
        backgroundColor: '#4285F4',
        borderRadius: 5,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 30,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.7,
        backgroundColor: '#a0c3ff',
    },
    errorText: {
        color: '#dc3545',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 15,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    logoPreview: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#e0e0e0',
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    logoButton: {
        backgroundColor: '#eee',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 5,
    },
    logoButtonText: {
        color: '#333',
    },
});

export default OrganizationOnboardingScreen; 