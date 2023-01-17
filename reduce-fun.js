/* eslint-disable */

const arr1 = [
  { name: 'Joe Brown', goals: 0, assists: 0, points: 0 },
  { name: 'Jim Bob', goals: 2, assists: 1, points: 3 },
  { name: 'Harry Styles', goals: 1, assists: 1, points: 2 },
  { name: 'Craig Mack', goals: 5, assists: 7, points: 12 },
];

const arr2 = [
  { name: 'Craig Mack', goals: 3, assists: 3, points: 6, ppg: 0, ppa: 0, pims: 0, },
  { name: 'Jim Bob', goals: 1, assists: 4, points: 5, ppg: 0, ppa: 1, pims: 0 },
  { name: 'Joe Brown', goals: 0, assists: 0, points: 0, ppg: 0, ppa: 0, pims: 0, },
  { name: 'Harry Styles', goals: 0, assists: 0, points: 0, ppg: 0, ppa: 0, pims: 0, },
];

function addItUp(...arraysOfData) {
  const data = arraysOfData.flat();
  const tally = data.reduce(function(tallyArray, item) {
    // first check if this person is new
    const { name, ...points } = item;
    console.log(`Working on ${name}`);
    console.log(points);
    tallyArray[name] = tallyArray[name] || {};
    // Loop over each of their properties and add them up
    Object.entries(points).forEach(([key, val]) => {
      if(tallyArray[name][key]) {
        // Already exists, so we increment the value by the next line
        tallyArray[name][key] = tallyArray[name][key] + val;
      } else {
        // brand new, set it to that value!
        tallyArray[name][key] = val;
      }
    })
    return tallyArray;
  }, {});
  return tally;
}

// const result = addItUp(arr1, arr2);
// console.table(result)

