/* eslint-disable */
function weekdays(locale?: string, format: Intl.DateTimeFormatOptions['weekday'] = 'long') {
  const weekday = Intl.DateTimeFormat(locale, { weekday: format });
  return Array.from({ length: 7 }, (_, i) => weekday.format(new Date(0, 0).setDate(i)));
}

            function months(locale?: string, format: Intl.DateTimeFormatOptions['month'] = 'long') {
              const month = Intl.DateTimeFormat(locale, { month: format });
              return Array.from({ length: 12 }, (_, i) => month.format(new Date(0, 0).setMonth(i)));
            }

            weekdays();
            weekdays('fr-CA');
            weekdays('en', 'short');
            weekdays('en', 'narrow');
            months();
            months('ar-EG');
            months('nl-NL', 'short');
            months('fi', 'narrow');
            months('fi', '2-digit');


export {};
