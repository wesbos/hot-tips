
const letters = ['b','A', 'c', 'D']
const ikea = ['Docksta', 'billy', 'Äpplarö','CHARMÖR'];

letters.sort();
ikea.sort();



letters.sort((a,b) => a.localeCompare(b));
letters;
ikea.sort((a,b) => a.localeCompare(b));
ikea;

const sel = ['a', 'B', 'b', 'Å','Ä','Ö']

sel.sort();

let en = sel.sort((a,b) => a.localeCompare(b));
en;

const enx = sel.sort((a, b) => a.localeCompare(b, 'en'));
enx;

const see = sel.sort((a, b) => a.localeCompare(b, 'se'));
see;




