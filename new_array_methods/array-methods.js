import tosorted from 'array.prototype.tosorted';
import toreversed from 'array.prototype.toreversed';
import tospliced from 'array.prototype.tospliced';
import withh from 'array.prototype.with';

tosorted.shim();
toreversed.shim();
tospliced.shim();
withh.shim();

const array = [1, 2, 3, 4];
array.map(num => num * 2);
array;

// reverse, sort and splice mutate!
const backwards = array.reverse();
array;


const dontTouchMe = [1, 2, 3, 4];

// Reverse Items
dontTouchMe.toReversed();
dontTouchMe.toSorted();
dontTouchMe.toSpliced(1,2);
dontTouchMe.with(1,'💩');

