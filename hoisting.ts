// Hoisted! Meaning it's available before it's declared
yeet();
// Not hoisted
noYeet();
yeetless();

function yeet() {
  console.log(1);
}

const noYeet = function() {
  console.log(2);
}

const yeetless = () => {
  console.log(3);
}

age;
var age = 20;


export {}
