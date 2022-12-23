import readline from 'node:readline/promises';
import { languages } from './languages.js';


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const lcLine = line.toLowerCase();
    const hits = languages
      .filter((c) => c.includes(lcLine));
    // Show all completions if none found
    return [hits.length ? hits : languages, line];
  },
  historySize: 10,
  history: languages,
});


async function ask() {
  const response = await
  rl.question('Best programming language? > ');

  if(response === 'java') {
    let count = 1;
    let up = true;
    setInterval(() => {
      if(count === 20) up = false;
      if(count === 0) up = true;
      console.log(`💩`.repeat(up ? count++ : count--));
    }, 10)
  }
  else {
    console.log(`Great Choice!
  ${response}!Is a great language!`);
  }
  ask();
}
ask()
