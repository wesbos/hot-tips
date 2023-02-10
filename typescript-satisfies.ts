/* eslint-disable */
type Setting = string | number | { [key: string]: Setting } | Setting[];
type Settings = Record<string, Setting>;

function getData() {
  return { data: 'good' };
}

const mySettings = {
  title: `Wes' Website`,
  data: getData(),
  size: 200,
  overrides: [
    { 'font-size': '20px' },
  ],
  styleConfig: {
    color: 'red',
  },
} satisfies Settings;

mySettings.overrides.at(0)?.['font-size'];

// Valid Properties
mySettings.title = 'New title';
console.log(mySettings.size);
// Invalid Properties
console.log(mySettings.scott);
mySettings.limt = 200;

mySettings.size.toLocaleString();

mySettings.overrides.at(0)?.['font-size'];

console.log(metaData.title);
console.log(metaData.doesntExist);

type DictionaryMap = Map<string, string | number>;
type DictionaryRecord = Record<string, string | number>;
type DictionaryObject = { [key: string]: string | number };

/* prettier-disable */
const dictionaryObject = {
  welcome: 'Welcome to My Website!',
  buy: 'Buy it now!',
  price: 100,
} satisfies DictionaryObject;

const dictionaryObjectConst = {
  welcome: 'Welcome to My Website!',
  buy: 'Buy it now!',
  price: 100,
} as const;

dictionaryObject.nope;
// satisfies can be Updated
dictionaryObject.welcome = 'Welcome to My Website!';
// const cant
dictionaryObjectConst.welcome = 'Welcome to My Website!';

dictionaryObject.newVal = 'Welcome to My Website!';

const dictionaryMap = new Map([
  [
    'welcome',
    'Welcome to My Website!',
  ],
  [
    'buy',
    'Buy it now!',
  ],
]) satisfies DictionaryMap;

dictionaryMap.get('welcome');

// Narrowing

type User = {
  id: string | number;
};

const wes: User = {
  id: 'wesbos',
};


console.log(wes.id.toUpperCase());
console.log(wes.id.toFixed());
wes.id = 200;
wes.id = 'Cool';

function logUser(user: User satisfies { id: string }) {
  user.id
}

if (typeof wes.id === 'string') {
  console.log(wes.id.toUpperCase());
} else {
  console.log(wes.id.toFixed());
}

