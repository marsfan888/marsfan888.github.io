/* Small shared rules, also executable in Node for calendar/gesture verification. */
((root) => {
  'use strict';
  function parseDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 9999) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() / 86400000 : null;
  }
  const shanghaiDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  // Extract the Shanghai calendar date before comparing UTC calendar-day ordinals.
  // This is not a duration rounded down from the relationship's starting instant.
  const shanghaiDay = (timestamp = Date.now()) => {
    const parts = Object.fromEntries(shanghaiDate.formatToParts(timestamp).map(({ type, value }) => [type, value]));
    return parseDay(`${parts.year}-${parts.month}-${parts.day}`);
  };
  const togetherDays = (start, timestamp = Date.now()) => {
    const day = parseDay(start);
    return day === null ? null : shanghaiDay(timestamp) - day;
  };
  // Shanghai uses UTC+8 on the configured 2026 start date and subsequent dates.
  const millisecondsUntilShanghaiMidnight = (timestamp = Date.now()) =>
    (shanghaiDay(timestamp) + 1) * 86400000 - 8 * 3600000 - timestamp;
  function swipeDirection(start, end) {
    if (!start || !end) return 0;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35 ? (dx < 0 ? 1 : -1) : 0;
  }
  root.LoveUtils = Object.freeze({ parseDay, shanghaiDay, togetherDays, millisecondsUntilShanghaiMidnight, swipeDirection });
})(typeof window === 'undefined' ? globalThis : window);
