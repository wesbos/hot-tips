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


async function settleUp(promise) {
  try {
    const data = await promise;
    return [data, undefined];
  } catch (err) {
    return [undefined, err];
  }
}

      // Cathes Thrown errors too
      async function collect(func) {
        try {
          const data = await func();
          return [data, undefined];
        } catch (err) {
          return [undefined, err];
        }
      }

      // no args
      await collect(getCheese); //?
      // Bound Func
      await collect(getCheese.bind(null, true)); //?
      // Arrow Func
      await collect(() => getCheese(true)); //?

      // Thrown Error
      await collect(async () => {
        throw new Error('Cheese Sucks but thrown');
      });//?

      // Syntax Error
      await collect(async () => {
        console.lag('heee')
      });//?



// Higher Order Function - returns a function that returns a promise
function settle(func) {
  return async function(...args) {
    try {
      // Because we call it here, we catch catch thrown errors
      const data = await func(...args);
      return [data, undefined];
    } catch (err) {
      return [undefined, err];
    }
  }
}

// See how we call the function returned from settle(getCheese)
await settle(getCheese)(); //?
await settle(getCheese)(true); //?
await settle(console.lag)('Sup'); //?






