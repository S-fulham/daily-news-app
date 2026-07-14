import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ALL_CATEGORIES, Category } from '../lib/types';

type Props = {
  activeCategory: Category;
  unlockedCategories: Category[];
  onSelectUnlocked: (category: Category) => void;
  onSelectLocked: (category: Category) => void;
};

export default function CategoryTabs({
  activeCategory,
  unlockedCategories,
  onSelectUnlocked,
  onSelectLocked,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ALL_CATEGORIES.map(({ key, label }) => {
        const unlocked = unlockedCategories.includes(key);
        const active = key === activeCategory;
        return (
          <Pressable
            key={key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => (unlocked ? onSelectUnlocked(key) : onSelectLocked(key))}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {label}
              {!unlocked ? ' 🔒' : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  tabActive: { backgroundColor: '#111' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#444' },
  tabTextActive: { color: '#fff' },
});
