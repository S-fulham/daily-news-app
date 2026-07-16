import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Category, Story } from '../lib/types';
import { getExcerpt } from '../lib/text';
import CategoryTabs from '../components/CategoryTabs';
import UpgradeModal from '../components/UpgradeModal';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'Feed'>;

export default function FeedScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [unlockedCategories, setUnlockedCategories] = useState<Category[]>(['general']);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lockedModalCategory, setLockedModalCategory] = useState<Category | null>(null);

  const loadProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('unlocked_categories')
      .eq('id', session.user.id)
      .single();
    if (data?.unlocked_categories) setUnlockedCategories(data.unlocked_categories);
  }, [session]);

  const loadStories = useCallback(async (category: Category) => {
    const { data: latest } = await supabase
      .from('stories')
      .select('story_date')
      .eq('category', category)
      .order('story_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest?.story_date) {
      setStories([]);
      return;
    }

    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('category', category)
      .eq('story_date', latest.story_date)
      .order('rank', { ascending: true });

    setStories(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadStories(activeCategory)]);
      setLoading(false);
    })();
  }, [loadProfile, loadStories, activeCategory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStories(activeCategory);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Stories</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <CategoryTabs
        activeCategory={activeCategory}
        unlockedCategories={unlockedCategories}
        onSelectUnlocked={setActiveCategory}
        onSelectLocked={setLockedModalCategory}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No stories yet — run the pipeline script to generate today's feed.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ArticleDetail', { story: item })}
            >
              <Text style={styles.headline}>{item.headlines?.[0]?.title}</Text>
              <Text style={styles.summary}>{getExcerpt(item.article)}</Text>
              <Text style={styles.meta}>
                {item.outlet_count} outlets · {item.article_count} articles
              </Text>
            </Pressable>
          )}
        />
      )}

      <UpgradeModal category={lockedModalCategory} onClose={() => setLockedModalCategory(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  signOut: { color: '#999', fontSize: 14 },
  loader: { marginTop: 40 },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  headline: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  summary: { fontSize: 15, color: '#333', lineHeight: 21, marginBottom: 10 },
  meta: { fontSize: 12, color: '#999' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 60, paddingHorizontal: 24 },
});
