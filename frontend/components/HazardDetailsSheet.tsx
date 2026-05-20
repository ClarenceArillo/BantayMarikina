import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { useAuthSession } from '@/context/auth-context';
import { useReportEngagement } from '@/hooks/useReportEngagement';
import {
  addReportComment,
  recordReportView,
  reportCommunityPost,
  toggleReportLike,
} from '@/services/hazardReportService';
import type { HazardReport, ReportModerationCategory } from '@/types/hazard';

function formatDate(report: HazardReport) {
  if (!report.timestamp) return { date: 'Pending sync', time: '' };

  return {
    date: report.timestamp.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: report.timestamp.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

export function HazardDetailsSheet({
  report,
  onClose,
}: {
  report: HazardReport | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const [commentText, setCommentText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ReportModerationCategory>('misleading_information');
  const { engagement } = useReportEngagement(report?.id, session?.uid);
  const displayTime = report ? formatDate(report) : null;

  useEffect(() => {
    if (report?.id && session?.uid) {
      recordReportView(report.id, session.uid).catch(() => undefined);
    }
  }, [report?.id, session?.uid]);

  async function handleLike() {
    if (!report?.id || !session?.uid) return;
    await toggleReportLike(report.id, session.uid).catch((error) => {
      Alert.alert('Unable to update like', error instanceof Error ? error.message : 'Please try again.');
    });
  }

  async function handleComment() {
    if (!report?.id || !session?.uid) return;

    try {
      await addReportComment(report.id, session.uid, session.full_name || session.username || 'Resident', commentText);
      setCommentText('');
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleReportPost() {
    if (!report?.id || !session?.uid) return;

    try {
      await reportCommunityPost(report.id, session.uid, selectedCategory);
      Alert.alert('Report received', 'Thank you. Community moderation will review this post automatically.');
    } catch (error) {
      Alert.alert('Unable to report post', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <Modal visible={Boolean(report)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      {report ? (
        <View style={[styles.sheet, { backgroundColor: theme.surface, shadowColor: theme.black }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text style={[styles.type, { color: theme.text }]}>{report.hazardType}</Text>
                <Text style={[styles.location, { color: theme.muted }]}>{report.barangay || 'Marikina City'} • {report.source || 'community'}</Text>
              </View>
              <View style={[styles.severityBadge, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                <Text style={[styles.severityText, { color: theme.warning }]}>{report.severity || 'Unverified'}</Text>
              </View>
            </View>

            {report.imageUrl ? <Image source={{ uri: report.imageUrl }} style={styles.photo} /> : null}

            <Text style={[styles.description, { color: theme.text }]}>{report.description || 'No description provided.'}</Text>

            <View style={styles.engagementRow}>
              <Pressable style={[styles.engagementButton, { backgroundColor: engagement.likedByMe ? theme.primaryTint : theme.surfaceMuted }]} onPress={handleLike}>
                <Text style={[styles.engagementText, { color: engagement.likedByMe ? theme.primary : theme.muted }]}>Like {engagement.likeCount}</Text>
              </Pressable>
              <View style={[styles.engagementButton, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.engagementText, { color: theme.muted }]}>Comments {engagement.commentCount}</Text>
              </View>
              <View style={[styles.engagementButton, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.engagementText, { color: theme.muted }]}>Views {engagement.viewCount}</Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Date</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{displayTime?.date}</Text>
              </View>
              <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Time</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{displayTime?.time || '--'}</Text>
              </View>
              <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Reporter</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{report.reporterName || 'Resident'}</Text>
              </View>
              <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Coordinates</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </Text>
              </View>
            </View>

            <View style={styles.commentBox}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Comments</Text>
              {engagement.comments.slice(-3).map((comment) => (
                <View key={comment.id} style={[styles.commentItem, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.commentAuthor, { color: theme.text }]}>{comment.userName}</Text>
                  <Text style={[styles.commentBody, { color: theme.muted }]}>{comment.body}</Text>
                </View>
              ))}
              <View style={styles.commentInputRow}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment"
                  placeholderTextColor={theme.placeholder}
                  style={[styles.commentInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                />
                <Pressable style={[styles.postButton, { backgroundColor: theme.primary }]} onPress={handleComment}>
                  <Text style={styles.postButtonText}>Post</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.moderationBox}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Report Post</Text>
              <View style={styles.categoryRow}>
                {(['false_report', 'inaccurate_image', 'misleading_information', 'spam', 'other'] as ReportModerationCategory[]).map((category) => (
                  <Pressable
                    key={category}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      selectedCategory === category ? { backgroundColor: theme.dangerSoft, borderColor: theme.danger } : null,
                    ]}
                    onPress={() => setSelectedCategory(category)}>
                    <Text style={[styles.categoryText, { color: selectedCategory === category ? theme.danger : theme.muted }]}>
                      {category.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={[styles.reportButton, { borderColor: theme.danger }]} onPress={handleReportPost} disabled={engagement.reportedByMe}>
                <Text style={[styles.reportButtonText, { color: theme.danger }]}>{engagement.reportedByMe ? 'Already Reported' : 'Submit Community Report'}</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.closeButton, { backgroundColor: theme.primary }]} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    bottom: 0,
    elevation: 18,
    maxHeight: '88%',
    left: 0,
    padding: 18,
    paddingBottom: 28,
    position: 'absolute',
    right: 0,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    width: 46,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 10,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  type: {
    fontSize: 22,
    fontWeight: '900',
  },
  location: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  severityBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '900',
  },
  photo: {
    borderRadius: 12,
    height: 156,
    width: '100%',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 8,
  },
  engagementButton: {
    alignItems: 'center',
    borderRadius: 13,
    flex: 1,
    paddingVertical: 10,
  },
  engagementText: {
    fontSize: 11,
    fontWeight: '900',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    borderRadius: 12,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  commentBox: {
    gap: 9,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  commentItem: {
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '900',
  },
  commentBody: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  commentInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  commentInput: {
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    fontSize: 13,
    height: 42,
    paddingHorizontal: 12,
  },
  postButton: {
    alignItems: 'center',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  moderationBox: {
    gap: 9,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  reportButton: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
  },
  reportButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
