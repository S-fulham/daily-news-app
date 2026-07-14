import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ALL_CATEGORIES, Category } from '../lib/types';

type Props = {
  category: Category | null;
  onClose: () => void;
};

export default function UpgradeModal({ category, onClose }: Props) {
  const label = ALL_CATEGORIES.find((c) => c.key === category)?.label ?? category;

  return (
    <Modal visible={category !== null} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Upgrade to unlock {label}</Text>
          <Text style={styles.body}>
            {label} coverage is available on a paid plan. Upgrade to get the daily synthesis for
            this category alongside General.
          </Text>
          <Pressable
            style={styles.upgradeButton}
            onPress={() => {
              onClose();
              Alert.alert('Coming soon', 'Payments are not wired up yet in this build.');
            }}
          >
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  body: { fontSize: 15, color: '#555', lineHeight: 21, marginBottom: 20 },
  upgradeButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { alignItems: 'center', paddingVertical: 8 },
  closeButtonText: { color: '#777', fontSize: 15 },
});
