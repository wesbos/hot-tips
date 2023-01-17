// if ('') {
//   console.log('yep')
// } else {
//   console.log('nope')
// }
// /*
//   Truthy
// */
// !!true;
// !!'beginnerjavascript.com';
// !!1;
// !!-1;
// !!"false";
// !!{};
// !!{ name: 'wes' };
// !! new Date();
// !![];

// // Falsy
// !!false;
// !!0;
// !!-0;
// !!+0;
// !!0n;
// !!'';
// !!null;
// !!undefined;
// !!NaN;

// let score1 = undefined;
// let score2 = 0;

// if(score2) {
//   console.log('Yes a score');
// } else {
//   console.log('no score');
// }

true;

!true;
!!true;

false;
!false;
!!false;
!!false;
!!false;

!!0;
!!'';

!![];
!![].length;

!!['wes'].length;
!!['wes'];
!!Object.keys({ name: 'wes' }).length;

const name = 'wes';

if (name) {
  console.log('you have no name!');
}

let score;
!!score;
const score2 = 0;
!!score2;

export {};
