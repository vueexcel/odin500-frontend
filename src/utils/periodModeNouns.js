/**
 * Shared period nouns for ticker return UIs (tabs, legends, stats badges).
 * @param {'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily'} periodMode
 * @returns {{ title: string, lower: string, statsLabel: string }}
 */
export function periodModeNouns(periodMode) {
  switch (periodMode) {
    case 'quarterly':
      return { title: 'Quarters', lower: 'quarters', statsLabel: 'Quarterly' };
    case 'monthly':
      return { title: 'Months', lower: 'months', statsLabel: 'Monthly' };
    case 'weekly':
      return { title: 'Weeks', lower: 'weeks', statsLabel: 'Weekly' };
    case 'daily':
      return { title: 'Days', lower: 'days', statsLabel: 'Daily' };
    default:
      return { title: 'Years', lower: 'years', statsLabel: 'Annual' };
  }
}
