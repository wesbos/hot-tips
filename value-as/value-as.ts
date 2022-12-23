
const number = document.querySelector<HTMLInputElement>('input[type="number"]');
const text = document.querySelector<HTMLInputElement>('input[type="text"]');
const date = document.querySelector<HTMLInputElement>('input[type="date"]');

if(!number || !text || !date) throw new Error('shit');

get

// Numbers
const t = number.value * 1.13;
const t2 = number.valueAsNumber * 1.13;

// Dates!
const d = new Date(date.value);
const d2 = date.valueAsDate;

// Use Methods right away!
date.valueAsDate?.getFullYear();

// Setters!
number.value = 200;
number.valueAsNumber = 200;

date.value = new Date();
date.valueAsDate = new Date();








