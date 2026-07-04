import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FOCUS_CHALLENGE_TOTAL_DAYS} from '../../focusChallenge/dayTemplates';
import {localDateIso} from '../../promos/streakEngagement';

type Props = {
  currentDay: number;
  lastCompletedDate: string | null;
  status: 'idle' | 'active' | 'failed' | 'complete';
};

export function FocusChallengeDayStrip({currentDay, lastCompletedDate, status}: Props) {
  const today = localDateIso();
  const completedCount =
    status === 'complete'
      ? FOCUS_CHALLENGE_TOTAL_DAYS
      : lastCompletedDate != null
        ? Math.max(0, currentDay - 1)
        : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({length: FOCUS_CHALLENGE_TOTAL_DAYS}, (_, i) => {
          const day = i + 1;
          const done = day <= completedCount;
          const isToday =
            status === 'active' && day === currentDay && lastCompletedDate !== today;
          return (
            <View
              key={day}
              style={[
                styles.cell,
                done && styles.cellDone,
                isToday && styles.cellToday,
                !done && !isToday && styles.cellLocked,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.legend}>
        {status === 'complete'
          ? '30 / 30 days complete'
          : status === 'active'
            ? `Day ${currentDay} of ${FOCUS_CHALLENGE_TOTAL_DAYS}`
            : 'Not started'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 6},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 3},
  cell: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cellDone: {backgroundColor: '#34D399'},
  cellToday: {backgroundColor: '#5CE1FF'},
  cellLocked: {backgroundColor: 'rgba(255,255,255,0.06)'},
  legend: {fontSize: 11, color: 'rgba(255,255,255,0.45)'},
});
