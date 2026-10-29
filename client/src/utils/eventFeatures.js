export const STUDENT_YEAR_OPTIONS = [
  { value: 'first', label: 'First Year' },
  { value: 'second', label: 'Second Year' },
  { value: 'third', label: 'Third Year' },
  { value: 'fourth', label: 'Fourth Year' }
];

export const DEFAULT_ELIGIBLE_YEARS = STUDENT_YEAR_OPTIONS.map(({ value }) => value);

export const getEventFeatureDetails = (event = {}) => {
  const eligibleYears = Array.isArray(event.eligibleYears)
    ? event.eligibleYears.filter((year) =>
        STUDENT_YEAR_OPTIONS.some((option) => option.value === year)
      )
    : [...DEFAULT_ELIGIBLE_YEARS];

  return {
    aictePointsAvailable: event.aictePointsAvailable === true,
    attendanceProvided: event.attendanceProvided === true,
    eligibleYears,
    eligibleYearsLabel: eligibleYears.length
      ? STUDENT_YEAR_OPTIONS
          .filter(({ value }) => eligibleYears.includes(value))
          .map(({ label }) => label)
          .join(', ')
      : 'None specified'
  };
};
