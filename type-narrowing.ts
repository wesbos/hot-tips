type Success = { message: string; value: number }
type Failure = { message: string; error: string }
type Response = Success | Failure

const responses: (Success | Failure)[] = [
  { message: 'Success', value: 69 },
  { message: 'Failure', error: 'shoot' },
  { message: 'Success', value: 777 },
]

//·  only Success has a value property. Narrow it down!
const response = responses[0];

// Using `in` works. checks up the prototype chain
if('value' in response) {
  response.value;
  // ^?
}

// hasOwnProperty() doesn't. (only checks instance)
if (response.hasOwnProperty('value')) {
  response.value;
  //  ^?
}

// Type Guard with Predicate works
function isSuccess(response: Response): response is Success {
  return response.hasOwnProperty('value');
}

if (isSuccess(response)) {
  response.value;
  //  ^?
}




const successes = responses
  .filter(response => response.hasOwnProperty('value'))
  .map(response => response.value);


const successes2 = responses
  .filter((response): response is Success => response.hasOwnProperty('value'))
  .map(response => response.value);



export{}

