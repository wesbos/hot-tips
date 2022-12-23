const example = {
  data: "a",
  next: {
    data: "b",
    next: {
      data: "c",
      next: {
        data: "d",
        next: {
          data: "e",
          next: {
            data: "f",
            next: {
              data: "g",
              next: {
                data: "h",
                next: null
              }
            }
          }
        }
      }
    }
  }
};

function lastThree(example) {
  const letters = [];

  function getLetter(obj) {
    if(obj.data) {
      letters.push(obj.data);
    }
    if(obj.next) {
      getLetter(obj.next);
    }
  }

  // kick it off
  getLetter(example)

  console.log(letters);
  const lastThree = letters.slice(letters.length - 3);
  return lastThree.join('');
}

const result = lastThree(example);
result === 'fgh'; //?

export default lastThree;
