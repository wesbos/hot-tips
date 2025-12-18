import 'core-js/proposals/array-grouping-v2';
import 'core-js/full/array';


// It's a better filter

const orders = [
  { countryCode: `US`, name: `John`, product: `stickers` },
  { countryCode: `CA`, name: `Sarah`, product: `shirt` },
  { countryCode: `MX`, name: `Carlos`, product: `skateboard` },
  { countryCode: `FR`, name: `Marie`, product: `hoodie` },
  { countryCode: `JP`, name: `Yuki`, product: `basketball` },
  { countryCode: `US`, name: `Emily`, product: `stickers` },
  { countryCode: `US`, name: `Scott`, product: `shirt` },
  { countryCode: `CA`, name: `David`, product: `shirt` },
  { countryCode: `MX`, name: `Juan`, product: `skateboard` },
];

const countryCodes = [`US`, `CA`, `MX`, `FR`, `JP`];
const products = [`stickers`, `shirt`, `skateboard`, `hoodie`, `basketball`];

for (let i = 0; i < 1000; i++) {
  orders.push({
    countryCode: countryCodes[Math.floor(Math.random() * countryCodes.length)],
    name: `Name${i}`, // You can replace this with any name generation logic
    product: products[Math.floor(Math.random() * products.length)],
  });
}

/* Object.groupBy */
const ordersByCountry = Object.groupBy(orders, (order) => order.countryCode);
// console.log(ordersByCountry);

// Works for maps too - could be useful for grouping by multiple keys
const ordersByCountryMap = Map.groupBy(orders, (order) => order.countryCode);

// with a for loop
const ordersByCountryForLoop = {};
for (const order of orders) {
  const { countryCode } = order;
  if (!ordersByCountryForLoop[countryCode]) {
    ordersByCountryForLoop[countryCode] = [];
  }
  ordersByCountryForLoop[countryCode].push(order);
}

// VS using a reduce
const ordersByCountry2 = orders.reduce((acc, order) => {
  const { countryCode } = order;
  if (!acc[countryCode]) {
    acc[countryCode] = [];
  }
  acc[countryCode].push(order);
  return acc;
});

// Map Group BY
const utterances = [
  { text: `Hello Welcome to the show`, start: 0, end: 3 },
  { text: `JavaScript popular for web dev`, start: 4, end: 7 },
  { text: `Variables declared with var, let`, start: 8, end: 11 },
  { text: `Prototype inheritance in JavaScript`, start: 12, end: 15 },
  { text: `DOM API manipulates HTML`, start: 16, end: 19 },
  { text: `Callbacks used for async code`, start: 20, end: 23 },
  { text: `Runs client-side and server-side`, start: 24, end: 27 },
  { text: `React and Vue popular frameworks`, start: 28, end: 31 },
  { text: `Node.js runs JavaScript outside browser`, start: 32, end: 35 },
  { text: `ECMAScript is the language spec`, start: 36, end: 39 },
];

const topics = [
  { topic: `Topic 1`, start: 0 },
  { topic: `Topic 2`, start: 12 },
  { topic: `Topic 3`, start: 24 },
];

const groupedTopics = Map.groupBy(utterances, (utterance) =>
  // Find the topic this one fits into
  topics.find((topic, i) => {
    const { start } = topic;
    const end = topics.at(i + 1)?.start ?? Infinity;
    return utterance.start >= start && utterance.end <= end;
  })
);

console.log(groupedTopics);

for (const [topic, utty] of groupedTopics) {
  console.log(topic.topic);
  console.table(utty);
}
