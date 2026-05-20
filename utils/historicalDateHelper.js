/**
 * Helper utilities for historical date testing
 */

/**
 * Parse historical dates from environment variable
 * @returns {Array<string>} Array of date strings in YYYY-MM-DD format
 */
export function getHistoricalDates() {
  const datesString = process.env.HISTORICAL_DATES || '';

  if (!datesString) {
    console.warn('HISTORICAL_DATES not set in environment. Using default dates.');
    return ['2024-01-01', '2024-03-15', '2024-06-30'];
  }

  // Split by comma and trim each date
  const dates = datesString.split(',').map(date => date.trim());

  // Validate date format
  const validDates = dates.filter(date => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
      return false;
    }

    // Additional validation - check if it's a valid date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error(`Invalid date: ${date}`);
      return false;
    }

    return true;
  });

  if (validDates.length === 0) {
    console.warn('No valid dates found. Using default dates.');
    return ['2024-01-01', '2024-03-15', '2024-06-30'];
  }

  return validDates;
}

/**
 * Format date for display
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get date range from historical dates
 * @returns {object} Object with startDate and endDate
 */
export function getDateRange() {
  const dates = getHistoricalDates();
  const sortedDates = dates.sort((a, b) => new Date(a) - new Date(b));

  return {
    startDate: sortedDates[0],
    endDate: sortedDates[sortedDates.length - 1],
    allDates: sortedDates
  };
}

/**
 * Check if a date is within the historical date range
 * @param {string} date - Date to check in YYYY-MM-DD format
 * @returns {boolean} True if date is within range
 */
export function isWithinHistoricalRange(date) {
  const { startDate, endDate } = getDateRange();
  const checkDate = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);

  return checkDate >= start && checkDate <= end;
}

/**
 * Generate SQL query with date parameter replaced
 * @param {string} sqlQuery - SQL query template with {END_DATE} placeholder
 * @param {string} date - Date to replace in YYYY-MM-DD format
 * @returns {string} SQL query with date replaced
 */
export function replaceDateInSQL(sqlQuery, date) {
  return sqlQuery.replace(/{END_DATE}/g, date);
}


/**
 * Validate if historical dates are in the past
 * @returns {boolean} True if all dates are in the past
 */
export function validateHistoricalDates() {
  const dates = getHistoricalDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  const futureDates = dates.filter(dateStr => {
    const date = new Date(dateStr);
    return date > today;
  });

  if (futureDates.length > 0) {
    console.warn(`Warning: Found future dates in HISTORICAL_DATES: ${futureDates.join(', ')}`);
    console.warn('Historical tests should use past dates only.');
    return false;
  }

  return true;
}

/**
 * Get days difference between two dates
 * @param {string} date1 - First date in YYYY-MM-DD format
 * @param {string} date2 - Second date in YYYY-MM-DD format
 * @returns {number} Number of days between dates
 */
export function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}