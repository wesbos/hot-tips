const time = new Intl
  .RelativeTimeFormat('fr', {
    numeric: 'auto'
  });

time.format(1, 'days');
time.format(-1, 'days');
time.format(22, 'day');

time.format(1, 'month');
time.format(-1, 'month');
time.format(0, 'month');
time.format(10, 'month');

time.format(-1, 'quarter');
time.format(-1, 'seconds');
time.format(0, 'seconds');

