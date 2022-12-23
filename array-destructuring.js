let canvas= {}
let vid= {}



const [host1, host2] = ['wes', 'scott'];
host1;
host2;

// 1. created varaibles based on index
const csv = '123,wes,bos';1
const [id, first, last] = csv.split(',');
id;
first;
last;

// 2. Swapping variable values
let playing = 'wes';
let waiting = 'scott';

// swap values
let tmp = playing;
playing = waiting;
waiting = tmp;
playing;
waiting;

[playing, waiting] = [waiting, playing];
playing;
waiting;
[playing, waiting] = [waiting, playing];
playing;
waiting;

// 3. Assiging multiple properties at once. Maybe a bit of a reach
[canvas.width, canvas.height] = [vid.videoWidth, vid.videoHeight];
