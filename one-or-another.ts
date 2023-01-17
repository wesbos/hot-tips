interface CourseBase {
  name: string;
  // more properties here
}

interface FreeCourse extends CourseBase {
  youtube: string;
}

interface PaidCourse extends CourseBase {
  price: number;
}

type Course = FreeCourse | PaidCourse;

const myCourse: Course = {
  name: 'TypeScript',
  price: 69,
  youtube: 'hehe',
};

// 🔥 Use TypeScript's `never` to enforce "one or the other" properties on a type
// You can use function overloading.

interface Candy {
  name: string;
  price: number;
}

interface Chocolate extends Candy {
  nuts: boolean;
}

const candy: Candy = {
  name: 'Snickers',
  price: 1.99,
  notReal: 'hehe',
};

const candy2 = {
  name: 'Snickers',
  price: 1.99,
  notReal: 'hehe',
} as Candy;

const chocolate: Chocolate = {
  name: 'Snickers',
  price: 1.99,
  nuts: true,
};

function logCandy(candy: Candy) {
  console.log(candy.name);
}

logCandy({ name: 'Snickers', price: 1.99, notReal: 'hehe' });
