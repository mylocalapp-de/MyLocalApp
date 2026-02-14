/**
 * ImagePickerButton — Reusable image picker with gallery permission handling,
 * multi-select support, and thumbnail preview strip.
 *
 * Props:
 *   images           – array of image assets (each must have .uri; optionally .base64)
 *   onImagesChange   – (newImages) => void
 *   maxImages        – number (default 10)
 *   allowMultiple    – boolean (default true)
 *   quality          – 0–1 (default 0.8)
 *   requestBase64    – boolean (default true) — needed for Supabase uploads
 *   label            – string (default 'Bilder')
 *   showCoverBadge   – boolean (default true)
 *   disabled         – boolean
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';

const ImagePickerButton = ({
  images = [],
  onImagesChange,
  maxImages = 10,
  allowMultiple = true,
  quality = 0.8,
  requestBase64 = true,
  label = 'Bilder',
  showCoverBadge = true,
  disabled = false,
}) => {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Berechtigung benötigt',
        'Wir benötigen die Berechtigung, um auf deine Fotos zugreifen zu können.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: allowMultiple,
      selectionLimit: maxImages - images.length,
      quality,
      base64: requestBase64,
    });

    if (!result.canceled && result.assets) {
      onImagesChange([...images, ...result.assets]);
    }
  };

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const atLimit = images.length >= maxImages;

  return (
    <View>
      <Text style={styles.label}>{label} (Optional, max. {maxImages})</Text>

      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewScroll}
          contentContainerStyle={styles.previewContent}
        >
          {images.map((asset, index) => (
            <View key={`${asset.uri}-${index}`} style={styles.previewItem}>
              <Image source={{ uri: asset.uri }} style={styles.thumb} />
              <TouchableOpacity onPress={() => removeImage(index)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
              {showCoverBadge && index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.pickerButton, (disabled || atLimit) && styles.pickerDisabled]}
        onPress={pickImage}
        disabled={disabled || atLimit}
      >
        <Ionicons name="images" size={20} color={colors.primary} style={{ marginRight: 10 }} />
        <Text style={styles.pickerText}>
          {images.length > 0
            ? `Weitere Bilder hinzufügen (${images.length}/${maxImages})`
            : 'Bilder auswählen'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 15,
  },
  previewScroll: {
    marginTop: 10,
    marginBottom: 5,
  },
  previewContent: {
    paddingRight: 10,
  },
  previewItem: {
    position: 'relative',
    marginRight: 10,
  },
  thumb: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHighlight,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  pickerText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ImagePickerButton;
