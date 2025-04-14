import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import {
    saveOfflineData,
    loadOfflineData,
    saveOfflineModeStatus,
    loadOfflineModeStatus,
    saveLastOfflineSaveTimestamp,
    loadLastOfflineSaveTimestamp
} from '../utils/storageUtils';
import { supabase } from '../lib/supabase'; // Import supabase for data fetching

// Create context
const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(true); // Assume connected initially
    const [isOfflineMode, setIsOfflineMode] = useState(false); // Whether user chose offline mode
    const [lastOfflineSaveTimestamp, setLastOfflineSaveTimestamp] = useState(null);
    const [isSavingData, setIsSavingData] = useState(false); // Loading state for save button
    const [initialCheckDone, setInitialCheckDone] = useState(false); // Track initial network check

    // Effect to subscribe to network changes and load initial state
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const currentlyConnected = state.isConnected && state.isInternetReachable;
            console.log('[NetworkContext] Network State Change:', state);
            console.log(`[NetworkContext] Connected: ${currentlyConnected}`);

            setIsConnected(currentlyConnected ?? true); // Update connection status

            // Handle initial connection check and potential popup
            if (!initialCheckDone) {
                if (currentlyConnected === false) { // Check for explicitly false
                    // Prompt user only on the first launch if disconnected
                    promptOfflineMode();
                }
                setInitialCheckDone(true); // Mark initial check as done
            } else {
                // After initial check, if connection DROPS and we're NOT in offline mode
                if (currentlyConnected === false && !isOfflineMode) {
                    promptOfflineMode();
                }
                // If connection RESTORES and we ARE in offline mode
                if (currentlyConnected === true && isOfflineMode) {
                    // Optionally ask user if they want to exit offline mode automatically
                    // For now, let them exit manually via header button
                }
            }
        });

        // Load initial offline mode status and timestamp from storage
        const loadInitialState = async () => {
            const storedIsOffline = await loadOfflineModeStatus();
            const storedTimestamp = await loadLastOfflineSaveTimestamp();
            setIsOfflineMode(storedIsOffline);
            setLastOfflineSaveTimestamp(storedTimestamp);
            console.log(`[NetworkContext] Initial Load: isOfflineMode=${storedIsOffline}, lastSave=${storedTimestamp}`);
        };

        loadInitialState();

        return () => {
            unsubscribe(); // Cleanup listener
        };
    }, [initialCheckDone, isOfflineMode]); // Add isOfflineMode dependency

    // Function to prompt the user about offline mode
    const promptOfflineMode = () => {
        // Prevent prompt if already in offline mode
        if (isOfflineMode) return;

        Alert.alert(
            "Keine Internetverbindung",
            "Keine Internetverbindung gefunden. Willst du in den Offline-Modus wechseln?",
            [
                {
                    text: "Offline Modus",
                    onPress: () => toggleOfflineMode(true), // Switch to offline mode
                },
                {
                    text: "Abbrechen",
                    style: "cancel",
                    onPress: () => console.log("Offline mode cancelled by user."),
                },
            ],
            { cancelable: false }
        );
    };

    // Function to toggle offline mode manually
    const toggleOfflineMode = useCallback(async (offline) => {
        console.log(`[NetworkContext] Toggling offline mode to: ${offline}`);
        setIsOfflineMode(offline);
        await saveOfflineModeStatus(offline);
        if (offline && !isConnected) {
             console.log("[NetworkContext] Entered offline mode while disconnected.");
        }
        if (!offline && isConnected) {
             console.log("[NetworkContext] Exited offline mode while connected.");
             // Potentially trigger data refresh here if needed
        }
    }, [isConnected]);

    // Function to fetch and save necessary data for offline use
    const saveDataForOffline = useCallback(async () => {
        if (!isConnected) {
            Alert.alert("Keine Verbindung", "Du benötigst eine Internetverbindung, um Offline-Daten zu speichern.");
            return { success: false, error: "No internet connection" };
        }
        if (isSavingData) {
            console.log("[NetworkContext] Data saving already in progress.");
            return { success: false, error: "Saving already in progress"};
        }

        console.log("[NetworkContext] Starting offline data save...");
        setIsSavingData(true);
        let success = true;
        let errorMsg = null;

        try {
            // Fetch and save data concurrently
            const [articlesResult, filtersResult, eventsResult, chatGroupsResult] = await Promise.allSettled([
                supabase
                    .from('article_listings')
                    .select('*')
                    .order('published_at', { ascending: false }),
                supabase
                    .from('article_filters')
                    .select('name, is_highlighted')
                    .order('display_order', { ascending: true }),
                supabase
                    .from('event_listings')
                    .select('*'), // Fetch all event data including recurrence
                supabase
                    .from('chat_group_listings')
                    .select('*')
                    .neq('type', 'bot'), // Exclude bots
            ]);

            // Process Articles
            if (articlesResult.status === 'fulfilled' && !articlesResult.value.error) {
                await saveOfflineData('articles', articlesResult.value.data || []);
                console.log(`[NetworkContext] Saved ${articlesResult.value.data?.length ?? 0} articles.`);
            } else {
                console.error("[NetworkContext] Error fetching articles:", articlesResult.reason || articlesResult.value.error);
                throw new Error("Artikel konnten nicht geladen werden."); // Throw error if critical data fails
            }

            // Process Article Filters
            if (filtersResult.status === 'fulfilled' && !filtersResult.value.error) {
                await saveOfflineData('article_filters', filtersResult.value.data || []);
                console.log(`[NetworkContext] Saved ${filtersResult.value.data?.length ?? 0} filters.`);
            } else {
                console.error("[NetworkContext] Error fetching article filters:", filtersResult.reason || filtersResult.value.error);
                // Decide if this is critical enough to throw
            }

            // Process Events
            if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
                await saveOfflineData('events', eventsResult.value.data || []);
                console.log(`[NetworkContext] Saved ${eventsResult.value.data?.length ?? 0} events.`);
            } else {
                console.error("[NetworkContext] Error fetching events:", eventsResult.reason || eventsResult.value.error);
                throw new Error("Events konnten nicht geladen werden.");
            }

            // Process Chat Groups
            if (chatGroupsResult.status === 'fulfilled' && !chatGroupsResult.value.error) {
                await saveOfflineData('chat_groups', chatGroupsResult.value.data || []);
                console.log(`[NetworkContext] Saved ${chatGroupsResult.value.data?.length ?? 0} chat groups.`);
            } else {
                console.error("[NetworkContext] Error fetching chat groups:", chatGroupsResult.reason || chatGroupsResult.value.error);
                throw new Error("Chat-Gruppen konnten nicht geladen werden.");
            }

            // --- Update Timestamp ---
            const now = Date.now();
            setLastOfflineSaveTimestamp(now);
            await saveLastOfflineSaveTimestamp(now);
            console.log("[NetworkContext] Offline data save completed successfully.");

        } catch (err) {
            console.error("[NetworkContext] Error during offline data save:", err);
            success = false;
            errorMsg = err.message || "Ein Fehler ist beim Speichern aufgetreten.";
            Alert.alert("Speichern fehlgeschlagen", errorMsg);
        } finally {
            setIsSavingData(false);
        }

        return { success, error: errorMsg };
    }, [isConnected, isSavingData]); // Add dependencies


    const value = {
        isConnected,
        isOfflineMode,
        lastOfflineSaveTimestamp,
        isSavingData,
        toggleOfflineMode,
        saveDataForOffline,
    };

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
};

// Custom hook to use the context
export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
}; 