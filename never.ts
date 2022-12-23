// Great for exhaustive switch statement
type Bird = { kind: 'bird', legs: number; wings: 2; };
type Dog = { kind: 'dog', legs: number; };
type Fish = { kind: 'fish', fins: number; };
type Animals = Bird | Dog | Fish;

function animalAppendages(animal: Animals): number {
  switch (animal.kind) {
    case 'bird':
      return animal.wings + animal.legs;
    case 'dog':
      return animal.legs + 1; // tail
    case 'fish':
      return animal.fins;
    default:
      // this should never happen
      let neverHappens: never = animal;
      return neverHappens;
  }
}

type CurrencyOptions = 'CAD' | 'USD' | 'EUR';

function getRate(rate: CurrencyOptions): number {
  if (rate === 'CAD') {
    return 1.3;
  }
  else if (rate === 'USD') {
    return 1;
  }
  // return( rate as never);
  // const neverEver: never = rate;
  // return neverEver;
}
