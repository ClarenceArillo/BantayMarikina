import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { HAZARD_TYPES, SEVERITY_LEVELS, type HazardSeverity, type HazardType, type ReportDateFilter, type ReportFilters } from '@/types/hazard';

const DATE_OPTIONS: { label: string; value: ReportDateFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

type ReportFilterBarProps = {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  compact?: boolean;
};

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        active ? { backgroundColor: theme.primaryTint, borderColor: theme.primary } : null,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipText, { color: active ? theme.primaryDark : theme.muted }]}>{label}</Text>
    </Pressable>
  );
}

export const ReportFilterBar = memo(function ReportFilterBar({ filters, onChange, compact = false }: ReportFilterBarProps) {
  const theme = useAppTheme();

  const resetFilters = () => onChange({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });

  return (
    <View style={[styles.container, compact ? styles.compactContainer : null, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
      <View style={styles.sections}>
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {DATE_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={filters.dateRange === option.value}
                label={option.label}
                onPress={() => onChange({ ...filters, dateRange: option.value })}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>HAZARD TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <FilterChip active={!filters.hazardType || filters.hazardType === 'All'} label="All Hazards" onPress={() => onChange({ ...filters, hazardType: 'All' })} />
            {HAZARD_TYPES.map((type) => (
              <FilterChip key={type} active={filters.hazardType === type} label={type} onPress={() => onChange({ ...filters, hazardType: type as HazardType })} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>SEVERITY & SOURCE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <FilterChip active={!filters.severity || filters.severity === 'All'} label="All Severity" onPress={() => onChange({ ...filters, severity: 'All' })} />
            {SEVERITY_LEVELS.map((level) => (
              <FilterChip key={level} active={filters.severity === level} label={level} onPress={() => onChange({ ...filters, severity: level as HazardSeverity })} />
            ))}
            <FilterChip active={filters.status === 'active'} label="Unresolved" onPress={() => onChange({ ...filters, status: 'active' })} />
            <FilterChip active={filters.status === 'resolved'} label="Resolved" onPress={() => onChange({ ...filters, status: 'resolved' })} />
            <FilterChip active={filters.source === 'community'} label="Community Reports" onPress={() => onChange({ ...filters, source: 'community' })} />
            <FilterChip active={filters.source === 'official'} label="Official Alerts" onPress={() => onChange({ ...filters, source: 'official' })} />
            <Pressable style={[styles.resetButton, { borderColor: theme.border }]} onPress={resetFilters}>
              <Text style={[styles.resetText, { color: theme.primary }]}>Reset</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  compactContainer: {
    maxHeight: 260,
  },
  sections: {
    gap: 12,
    paddingVertical: 12,
  },
  sectionBlock: {
    gap: 7,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 12,
  },
  row: {
    gap: 8,
    paddingHorizontal: 12,
    paddingRight: 18,
  },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '900',
  },
  resetButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
