async function getCheese(shouldError = false) {
  // after 1 second, return an array of cheese or Reject with an error
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldError) {
        return reject('Cheese Sucks');
      }
      resolve(['cheddar', 'brie', 'gouda']);
    }, 1);
  });
}

async function handler(request) {
  // first get the async data
  const cheese = await getCheese();

  if('error???') {
    return new Response(`Error from Above Promise`, { status: 500 });
  }
  return new Response(data, { status: 200 });
}


// Method 1: .then().catch()
getCheese()
  .then(cheeses => console.log(cheeses))
  .catch(err => console.log(err));

// Methods 2: try/catch
// Code here
try {
  const cheese = await getCheese();
  console.log(cheese);
} catch (err) {
  console.log(err);
}

// code here

// Method 3: Mix n Match - .catch()
const myCheese = await getCheese().catch(err => showMessage(err));
console.log(myCheese);

// Method 4: bring it to a single level

async function settleUp(promise) {
  try {
    const data = await promise;
    return [data, undefined];
  } catch (err) {
    return [undefined, err];
  }
}

const [cheeseData2, cheeseError2] = await asyncWrap(getCheese());

const results = await Promise.allSettled([getCheese(), getCheese(true)]);
console.log(results);

// https://twitter.com/nomsternom/status/1600190082551406592
// https://twitter.com/dev_santanag/status/1600301149675986945

// Method 4.1: non-async
function wrapIt(promise) {
  // Promise allSetteled will return an array of objects, we grab the first one
  // That object will only ever have one of these properties:
  // ✅ value - the resolved data
    // OR
  // ✅ reason - the rejected error
  return Promise.allSettled([promise]).then(function([{ value, reason }]) {
    return [value, reason];
  });
}

// Now we get a "tuple" - an array with two items, the first being the resolved data, the second being the rejected error.

// We can destructure it into two variables, named whatever we want
const [data, err] = await wrapIt(getCheese());  // ?
const [cheese, cheeseError] = await wrapIt(getCheese(true)); //?

// Some people prefer returning a "Result" type
function wrapItObject(promise) {
  return Promise.allSettled([promise]).then(function ([{ value, reason }]) {
    return { data:value, error:reason };
  });

}

// Then get a result object
const result = await wrapItObject(getCheese());
console.log(result);

// Or destructure it, and rename if needed
const { data: goodAssData, error: crappyError } = await wrapItObject(getCheese());
console.log(goodAssData, crappyError);

// Further Reading

// Packages: https://www.npmjs.com/package/await-to-js
// https://github.com/mats852/doublet
// https://github.com/thelinuxlich/go-go-try

