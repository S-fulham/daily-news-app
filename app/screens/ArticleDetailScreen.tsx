import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'ArticleDetail'>;

export default function ArticleDetailScreen({ route, navigation }: Props) {
  const { story } = route.params;
  const headline = story.headlines?.[0]?.title ?? 'Story';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.meta}>
          {story.outlet_count} outlets · {story.article_count} articles
        </Text>
        <Text style={styles.article}>{story.article}</Text>

        <Text style={styles.sourcesLabel}>Sources</Text>
        {story.headlines?.map((item, index) => (
          <Pressable
            key={`${item.url}-${index}`}
            onPress={() => item.url && Linking.openURL(item.url)}
            style={styles.sourceRow}
          >
            <Text style={styles.sourceTitle}>{item.title}</Text>
            <Text style={styles.sourceName}>{item.source}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  back: { fontSize: 16, color: '#111', fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  headline: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { fontSize: 12, color: '#999', marginBottom: 16 },
  article: { fontSize: 16, color: '#222', lineHeight: 24, marginBottom: 28 },
  sourcesLabel: { fontSize: 13, fontWeight: '700', color: '#777', marginBottom: 8 },
  sourceRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sourceTitle: { fontSize: 14, color: '#333', marginBottom: 2 },
  sourceName: { fontSize: 12, color: '#999' },
});
