


async function fetchBill(...guests) {
  const total = await calculateBill(...guests);
  return total;
}

const total = fetchBill('wes', 'scott');


function* deliCounterTicketMaker() {
  let ticket = 1;
  while (true) {
    ticket += 1;
    yield ticket;
    if(ticket === 99) ticket = 1;
  }
}

const deli = deliCounterTicketMaker();
deli.next().value;


* async
* generators
* iterators
* ...rest Params
* arrow functions

