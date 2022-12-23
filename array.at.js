const tops = [
  'sauce',
  'cheese',
  'pepperoni',
  'sausage',
  'peppers',
  'onions',
  'mushrooms',
];

const rgba = [
  255,
  0,
  0,
  0.2,
  0,
  255,
  0,
  0.8,
];

// prettier-multiline-arrays-set-line-pattern: 4
const rgbaGood = [
  255, 0, 0, 0.2,
  0, 255, 0, 0.8,
];

// prettier-multiline-arrays-set-line-pattern: 2 1
const people = [
  'Wes', 'Bos',
  123,
  'Scott', 'Tolinksi',
  456,
];
// prettier-multiline-arrays-set-line-pattern: 1 2 3 4 5 6 5 4 3 2 1
const shit = [
  '💩',
  '💩', '💩',
  '💩', '💩', '💩',
  '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩',
  '💩', '💩', '💩',
  '💩', '💩',
  '💩',
  '💩',
  '💩', '💩',
  '💩', '💩', '💩',
  '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩', '💩',
  '💩', '💩', '💩', '💩',
  '💩', '💩', '💩',
  '💩', '💩',
  '💩',
];

tops.at(0);
tops.at(1);
tops[tops.length - 1];
tops.at(-1);
tops.at(-2);

tops[Math.floor(Math.random() * tops.length)];

tops.at(Math.random() * tops.length);
