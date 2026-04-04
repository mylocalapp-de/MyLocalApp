import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
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
import { supabase } from '../lib/supabase';

// --- Konfiguration ---
const OFFLINE_DEBOUNCE_MS = 4000;    // 4s offline bevor Alert kommt
const DISMISS_COOLDOWN_MS = 30000;   // 30s Ruhe nach "Abbrechen"
const INITIAL_GRACE_PERIOD_MS = 6000; // 6s nach App-Start ignorieren (iOS isInternetReachable-Flicker)

const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [lastOfflineSaveTimestamp, setLastOfflineSaveTimestamp] = useState(null);
    const [isSavingData, setIsSavingData] = useState(false);

    // Refs für stabile Zugriffe im Listener
    const isOfflineModeRef = useRef(false);
    const isPromptOpenRef = useRef(false);
    const dismissedAtRef = useRef(0);       // Timestamp des letzten "Abbrechen"
    const debounceTimerRef = useRef(null);  // Debounce-Timer für Offline-Erkennung
    const mountedAtRef = useRef(Date.now()); // App-Start-Zeitpunkt

    // Ref synchron halten
    useEffect(() => {
        isOfflineModeRef.current = isOfflineMode;
    }, [isOfflineMode]);

    // Prompt mit allen Guards
    const promptOfflineMode = useCallback(() => {
        // Guard 1: Schon im Offline-Modus
        if (isOfflineModeRef.current) return;
        // Guard 2: Alert ist schon offen
        if (isPromptOpenRef.current) return;
        // Guard 3: Cooldown nach "Abbrechen" läuft noch
        if (Date.now() - dismissedAtRef.current < DISMISS_COOLDOWN_MS) return;
        // Guard 4: Grace Period nach App-Start (iOS-Startup-Flicker)
        if (Date.now() - mountedAtRef.current < INITIAL_GRACE_PERIOD_MS) return;

        isPromptOpenRef.current = true;

        Alert.alert(
            "Keine Internetverbindung",
            "Keine Internetverbindung gefunden. Willst du in den Offline-Modus wechseln?",
            [
                {
                    text: "Offline Modus",
                    onPress: () => {
                        isPromptOpenRef.current = false;
                        // Ref sofort synchron setzen (nicht auf useEffect warten)
                        isOfflineModeRef.current = true;
                        setIsOfflineMode(true);
                        saveOfflineModeStatus(true);
                    },
                },
                {
                    text: "Abbrechen",
                    style: "cancel",
                    onPress: () => {
                        isPromptOpenRef.current = false;
                        dismissedAtRef.current = Date.now(); // Cooldown starten
                    },
                },
            ],
            { cancelable: false }
        );
    }, []);

    // NetInfo Listener mit Debouncing
    useEffect(() => {
        const handleConnectivityChange = (state) => {
            // null bei isInternetReachable = noch unbekannt → NICHT als offline werten
            // Nur definitiv false = wirklich offline
            const isDefinitelyOffline =
                state.isConnected === false ||
                (state.isInternetReachable === false && state.isInternetReachable !== null);

            const isOnline = !isDefinitelyOffline;
            setIsConnected(isOnline);

            // Wenn wieder online: Debounce-Timer abbrechen
            if (isOnline) {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                }
                return;
            }

            // Offline erkannt: Debounce starten (nur wenn noch kein Timer läuft)
            if (!debounceTimerRef.current) {
                debounceTimerRef.current = setTimeout(() => {
                    debounceTimerRef.current = null;

                    // Nach Ablauf nochmal aktiv prüfen ob wirklich offline
                    NetInfo.fetch().then((currentState) => {
                        const stillOffline =
                            currentState.isConnected === false ||
                            currentState.isInternetReachable === false;
                        if (stillOffline) {
                            promptOfflineMode();
                        }
                    });
                }, OFFLINE_DEBOUNCE_MS);
            }
        };

        const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

        return () => {
            unsubscribe();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [promptOfflineMode]);

    // Initial state laden (non-sticky: Offline-Modus wird nicht gespeichert)
    useEffect(() => {
        const loadInitialState = async () => {
            const storedTimestamp = await loadLastOfflineSaveTimestamp();
            setIsOfflineMode(false);
            isOfflineModeRef.current = false;
            await saveOfflineModeStatus(false);
            setLastOfflineSaveTimestamp(storedTimestamp);
        };
        loadInitialState();
    }, []);

    // Wenn Verbindung zurückkommt und Offline-Modus aktiv war → automatisch beenden
    useEffect(() => {
        if (isConnected && isOfflineMode) {
            setIsOfflineMode(false);
            isOfflineModeRef.current = false;
            saveOfflineModeStatus(false);
        }
    }, [isConnected, isOfflineMode]);

    // Offline-Modus manuell umschalten
    const toggleOfflineMode = useCallback(async (offline) => {
        // Ref sofort synchron setzen
        isOfflineModeRef.current = offline;
        setIsOfflineMode(offline);
        await saveOfflineModeStatus(offline);
    }, []); // keine unnötigen Dependencies

    // Daten für Offline-Nutzung speichern
    const saveDataForOffline = useCallback(async () => {
        if (!isConnected) {
            Alert.alert("Keine Verbindung", "Du benötigst eine Internetverbindung, um Offline-Daten zu speichern.");
            return { success: false, error: "No internet connection" };
        }
        if (isSavingData) {
            return { success: false, error: "Saving already in progress" };
        }

        setIsSavingData(true);
        let success = true;
        let errorMsg = null;

        try {
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
                    .select('*'),
                supabase
                    .from('chat_group_listings')
                    .select('*')
                    .neq('type', 'bot'),
            ]);

            if (articlesResult.status === 'fulfilled' && !articlesResult.value.error) {
                await saveOfflineData('articles', articlesResult.value.data || []);
            } else {
                console.error("[NetworkContext] Error fetching articles:", articlesResult.reason || articlesResult.value.error);
                throw new Error("Artikel konnten nicht geladen werden.");
            }

            if (filtersResult.status === 'fulfilled' && !filtersResult.value.error) {
                await saveOfflineData('article_filters', filtersResult.value.data || []);
            } else {
                console.error("[NetworkContext] Error fetching article filters:", filtersResult.reason || filtersResult.value.error);
            }

            if (eventsResult.status === 'fulfilled' && !eventsResult.value.error) {
                await saveOfflineData('events', eventsResult.value.data || []);
            } else {
                console.error("[NetworkContext] Error fetching events:", eventsResult.reason || eventsResult.value.error);
                throw new Error("Events konnten nicht geladen werden.");
            }

            if (chatGroupsResult.status === 'fulfilled' && !chatGroupsResult.value.error) {
                await saveOfflineData('chat_groups', chatGroupsResult.value.data || []);
            } else {
                console.error("[NetworkContext] Error fetching chat groups:", chatGroupsResult.reason || chatGroupsResult.value.error);
                throw new Error("Chat-Gruppen konnten nicht geladen werden.");
            }

            const now = Date.now();
            setLastOfflineSaveTimestamp(now);
            await saveLastOfflineSaveTimestamp(now);

        } catch (err) {
            console.error("[NetworkContext] Error during offline data save:", err);
            success = false;
            errorMsg = err.message || "Ein Fehler ist beim Speichern aufgetreten.";
            Alert.alert("Speichern fehlgeschlagen", errorMsg);
        } finally {
            setIsSavingData(false);
        }

        return { success, error: errorMsg };
    }, [isConnected, isSavingData]);

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

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};
