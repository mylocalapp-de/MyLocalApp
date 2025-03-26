import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const categories = [
  { id: 'kultur', name: 'Kultur', icon: 'color-palette-outline' },
  { id: 'sport', name: 'Sport', icon: 'football-outline' },
  { id: 'verkehr', name: 'Verkehr', icon: 'car-outline' },
  { id: 'politik', name: 'Politik', icon: 'business-outline' },
];

const OnboardingScreen = ({ navigation, route }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const { setPreferences, user, createProfile } = useAuth();
  
  // Extract userId and email from route params - this is key!
  const userId = route.params?.userId;
  const userEmail = route.params?.tempEmail;
  
  useEffect(() => {
    console.log('OnboardingScreen loaded with userId:', userId);
    if (userId) {
      setInitializing(false);
    } else {
      // Still try to get session
      checkSession();
    }
  }, [userId]);
  
  const checkSession = async () => {
    try {
      // Wait a bit to allow auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data } = await supabase.auth.getSession();
      console.log('Session check in onboarding:', data?.session ? 'Found' : 'Not found');
      
      if (!data?.session) {
        // Show message after 2 seconds if still no session
        setTimeout(() => {
          if (initializing) {
            Alert.alert(
              'Anmeldungsproblem',
              'Es gab ein Problem mit deiner Anmeldung. Bitte starte die App neu.',
              [{ text: 'OK' }]
            );
          }
        }, 2000);
      } else {
        setInitializing(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      // Set initializing to false after 3 seconds regardless
      setTimeout(() => setInitializing(false), 3000);
    }
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert('Keine Auswahl', 'Bitte wähle mindestens eine Kategorie aus');
      return;
    }

    setIsLoading(true);

    try {
      // Use userId from route params if available, otherwise try current user
      const effectiveUserId = userId || user?.id;
      
      if (!effectiveUserId) {
        console.error('No user available for setting preferences');
        Alert.alert('Fehler', 'Bitte starte die App neu und versuche es erneut.');
        return;
      }
      
      console.log('Saving preferences for user ID:', effectiveUserId);
      
      // Try creating/updating profile directly via RPC function if we have userId
      if (userId) {
        try {
          // Call database function directly to bypass RLS
          const { error: rpcError } = await supabase.rpc(
            'create_profile_bypass_rls',
            { 
              user_id: effectiveUserId,
              user_preferences: selectedCategories
            }
          );
          
          if (rpcError) {
            console.error('Error setting preferences via RPC:', rpcError);
            throw rpcError;
          } else {
            console.log('Successfully saved preferences via direct RPC');
            
            // For new users who just signed up (have userId and userEmail from route params)
            // Send a magic link instead of redirecting to login
            if (userId && userEmail) {
              console.log('Completing onboarding for new user:', userEmail);
              
              try {
                // Send a magic link to their email for passwordless login
                const { error: magicLinkError } = await supabase.auth.signInWithOtp({
                  email: userEmail,
                });
                
                if (magicLinkError) {
                  console.error('Error sending magic link:', magicLinkError);
                  
                  // Check if it's a rate limit error
                  const isRateLimitError = magicLinkError.message && 
                    (magicLinkError.message.includes('after') && 
                     magicLinkError.message.includes('seconds'));
                  
                  if (isRateLimitError) {
                    // Extract the remaining seconds from the error message if possible
                    let waitTime = 60; // Default to 60 seconds
                    try {
                      const matches = magicLinkError.message.match(/after (\d+) seconds/);
                      if (matches && matches.length > 1) {
                        waitTime = parseInt(matches[1], 10);
                      }
                    } catch (e) {
                      console.log('Could not parse wait time from error message');
                    }
                    
                    // Special handling for rate limit errors
                    console.log(`Rate limit hit for magic link. Need to wait ${waitTime} seconds`);
                    Alert.alert(
                      'Konto erfolgreich erstellt',
                      `Dein Konto wurde erstellt und deine Präferenzen gespeichert. Du hast bereits eine E-Mail erhalten. Bitte prüfe deinen Posteingang oder warte ${waitTime} Sekunden, um einen neuen Anmeldelink anzufordern.`,
                      [
                        { 
                          text: 'Zum Login', 
                          onPress: () => {
                            console.log('Navigating to Welcome screen after rate limit error');
                            navigation.reset({
                              index: 0,
                              routes: [{ name: 'Welcome' }],
                            });
                          }
                        },
                        {
                          text: `${waitTime} Sekunden warten`,
                          onPress: () => {
                            // Show waiting dialog
                            setIsLoading(true);
                            Alert.alert(
                              'Bitte warten',
                              `Wir senden dir in ${waitTime} Sekunden einen neuen Anmeldelink.`,
                              [{ text: 'Abbrechen', style: 'cancel', onPress: () => {
                                setIsLoading(false);
                                navigation.reset({
                                  index: 0,
                                  routes: [{ name: 'Welcome' }],
                                });
                              }}]
                            );
                            
                            // Set a timeout to retry after the wait time
                            setTimeout(async () => {
                              try {
                                setIsLoading(true);
                                const { error: retryError } = await supabase.auth.signInWithOtp({
                                  email: userEmail,
                                });
                                
                                if (retryError) {
                                  console.error('Error on retry sending magic link:', retryError);
                                  Alert.alert(
                                    'Fehler beim Senden',
                                    'Wir konnten keinen Anmeldelink senden. Bitte versuche es später erneut oder nutze die "Passwort vergessen" Option.',
                                    [{ text: 'OK', onPress: () => {
                                      navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'Welcome' }],
                                      });
                                    }}]
                                  );
                                } else {
                                  Alert.alert(
                                    'Link gesendet',
                                    'Der Anmeldelink wurde erfolgreich gesendet. Bitte überprüfe deine E-Mails.',
                                    [{ text: 'OK', onPress: () => {
                                      navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'Welcome' }],
                                      });
                                    }}]
                                  );
                                }
                              } catch (e) {
                                console.error('Unexpected error during retry:', e);
                                Alert.alert(
                                  'Fehler',
                                  'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.',
                                  [{ text: 'OK', onPress: () => {
                                    navigation.reset({
                                      index: 0,
                                      routes: [{ name: 'Welcome' }],
                                    });
                                  }}]
                                );
                              } finally {
                                setIsLoading(false);
                              }
                            }, waitTime * 1000);
                          }
                        }
                      ]
                    );
                  } else {
                    // General error fallback
                    Alert.alert(
                      'Konto erstellt',
                      'Dein Konto wurde erstellt und deine Präferenzen gespeichert. Bitte nutze die "Passwort vergessen" Option auf der Anmeldeseite, um ein Passwort zu setzen.',
                      [{ 
                        text: 'Zur Anmeldung', 
                        onPress: () => {
                          console.log('Navigating to Welcome screen for sign in');
                          navigation.reset({
                            index: 0,
                            routes: [{ name: 'Welcome' }],
                          });
                        }
                      }]
                    );
                  }
                  return;
                } else {
                  // Success - magic link sent
                  console.log('Magic link sent successfully to', userEmail);
                  Alert.alert(
                    'Fast geschafft!',
                    'Dein Konto wurde erstellt und deine Präferenzen gespeichert. Wir haben dir einen Anmeldelink an deine E-Mail-Adresse geschickt. Bitte öffne den Link, um dich anzumelden.',
                    [{ 
                      text: 'Verstanden', 
                      onPress: () => {
                        console.log('Navigating to Welcome screen after magic link sent');
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'Welcome' }],
                        });
                      }
                    }]
                  );
                }
              } catch (authError) {
                console.error('Error in authentication process:', authError);
                // Show a fallback message
                Alert.alert(
                  'Konto erstellt',
                  'Dein Konto wurde erstellt, aber wir konnten keinen Anmeldelink versenden. Bitte nutze die "Passwort vergessen" Option auf der Anmeldeseite.',
                  [{ 
                    text: 'OK', 
                    onPress: () => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Welcome' }],
                      });
                    }
                  }]
                );
                return;
              }
            }
            
            // For existing users who are already authenticated (no userEmail/userId from params)
            if (user) {
              console.log('Existing user already logged in, returning to app');
              // Do nothing - the context should handle the navigation automatically
              return;
            }
          }
        } catch (directError) {
          console.error('Error with direct preference saving:', directError);
          // Continue to fallback method
        }
      }
      
      // Fallback: use the context method
      console.log('Trying to set preferences through context');
      const { error } = await setPreferences(selectedCategories);
      
      if (error) {
        console.error('Error saving preferences:', error);
        throw error;
      } else {
        // Already authenticated user - no need to do anything special
        console.log('Preferences updated successfully, returning to app');
        // The auth context should already have the user, so just return
        return;
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert(
        'Fehler',
        'Beim Speichern der Präferenzen ist ein Fehler aufgetreten. Bitte versuche es später noch einmal.'
      );
    } finally {
      setIsLoading(false);
    }

    // Fallback - just go back to welcome
    console.log('Fallback: Navigating to Welcome screen');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
    return;
  };

  if (initializing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Account wird vorbereitet...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Deine Interessen</Text>
          <Text style={styles.subtitle}>
            Wähle die Kategorien aus, die dich besonders interessieren
          </Text>
        </View>

        <View style={styles.categoriesContainer}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                selectedCategories.includes(category.id) && styles.selectedCard,
              ]}
              onPress={() => toggleCategory(category.id)}
            >
              <Ionicons
                name={category.icon}
                size={32}
                color={selectedCategories.includes(category.id) ? '#fff' : '#4285F4'}
                style={styles.categoryIcon}
              />
              <Text
                style={[
                  styles.categoryName,
                  selectedCategories.includes(category.id) && styles.selectedText,
                ]}
              >
                {category.name}
              </Text>
              {selectedCategories.includes(category.id) && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.completeButton, isLoading && styles.disabledButton]}
          onPress={handleComplete}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.completeButtonText}>Fertig</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4285F4',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  selectedCard: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  categoryIcon: {
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedText: {
    color: '#fff',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  completeButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#A0B9E0',
  },
});

export default OnboardingScreen; 