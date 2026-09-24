// Problem generators aligned to the Bluebonnet Learning K-5 Math module list
// (Grade 2 and Grade 4 scope and sequence). Each generator returns
// { text, answer, choices?, hint }. Answers are strings; numeric answers are
// checked by value, so "4.50" == "4.5" and "2/4" == "1/2".

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => n.toLocaleString('en-US');
const NAMES = ['Mia', 'Sofia', 'Ava', 'Lily', 'Emma', 'Zoe', 'Nora', 'Ivy', 'Luna', 'Rosa', 'Elena', 'Maya'];
const money = (x) => x.toFixed(2);
const dec = (x, places) => String(Number(x.toFixed(places)));
const cmp = (a, b) => (a < b ? '<' : a > b ? '>' : '=');
const CMP_CHOICES = ['<', '>', '='];

// ---------------------------------------------------------------- Grade 2
const G2 = [
  {
    id: 'g2m1', name: 'Module 1: Add & subtract facts within 20',
    gens: [
      () => { const a = R(3, 10), b = R(3, 10); return { text: `${a} + ${b} = ?`, answer: `${a + b}`, hint: 'Make a ten! Start with the bigger number and count on.' }; },
      () => { const c = R(11, 20), b = R(3, 9); return { text: `${c} − ${b} = ?`, answer: `${c - b}`, hint: `Take away to get to 10 first, then take away the rest.` }; },
      () => { const a = R(3, 12), s = R(a + 2, 20); return { text: `${a} + ? = ${s}`, answer: `${s - a}`, hint: `Count up from ${a} to ${s}.` }; },
      () => { const a = R(4, 9); return { text: `A dragon has ${a} red eggs and ${a + 1} blue eggs.\nHow many eggs in all?`, answer: `${2 * a + 1}`, hint: `Use a double: ${a} + ${a}, then add 1 more.` }; },
    ],
  },
  {
    id: 'g2m2', name: 'Module 2: Measuring length',
    gens: [
      () => { const a = R(12, 45), b = R(11, 40); return { text: `A dragon's tail is ${a} cm long. Its neck is ${b} cm long.\nHow many centimeters is that altogether?`, answer: `${a + b}`, hint: 'Altogether means add.' }; },
      () => { const a = R(40, 95), b = R(12, a - 10); return { text: `A ribbon is ${a} cm long. The knight cuts off ${b} cm.\nHow many centimeters are left?`, answer: `${a - b}`, hint: 'Cut off means take away. Subtract.' }; },
      () => { const a = R(30, 90), b = R(10, a - 5); return { text: `Rope A is ${a} meters long. Rope B is ${b} meters long.\nHow many meters longer is Rope A?`, answer: `${a - b}`, hint: 'How much longer? Subtract the short one from the long one.' }; },
      () => { const [thing, unit] = pick([['the castle wall', 'meters'], ['a pencil', 'centimeters'], ['a soccer field', 'meters'], ['a crayon', 'centimeters'], ['a bug', 'centimeters'], ['a hallway', 'meters']]); return { text: `Which unit is best to measure the length of ${thing}?`, answer: unit, choices: ['centimeters', 'meters'], hint: 'Small things: centimeters. Big things: meters.' }; },
    ],
  },
  {
    id: 'g2m3', name: 'Module 3: Place value to 1,200',
    gens: [
      () => { const h = R(1, 9), t = R(0, 9), o = R(0, 9); return { text: `${h} hundreds, ${t} tens, ${o} ones = ?`, answer: `${h * 100 + t * 10 + o}`, hint: 'Write the hundreds digit, then tens, then ones.' }; },
      () => { const n = R(101, 999), p = pick(['hundreds', 'tens', 'ones']); const d = p === 'hundreds' ? Math.floor(n / 100) : p === 'tens' ? Math.floor(n / 10) % 10 : n % 10; return { text: `What digit is in the ${p} place of ${n}?`, answer: `${d}`, hint: 'Hundreds, tens, ones: read the places from left to right.' }; },
      () => { const n = R(110, 1090), [k, word] = pick([[10, '10 more'], [-10, '10 less'], [100, '100 more'], [-100, '100 less']]); return { text: `What is ${word} than ${fmt(n)}?`, answer: `${n + k}`, hint: `${Math.abs(k) === 10 ? 'Only the tens digit changes (unless it rolls over).' : 'Only the hundreds digit changes (unless it rolls over).'}` }; },
      () => { const h = R(1, 9), t = R(1, 9), o = R(1, 9); return { text: `${h * 100} + ${t * 10} + ${o} = ?`, answer: `${h * 100 + t * 10 + o}`, hint: 'This is expanded form. Put the digits in their places.' }; },
      () => { const a = R(100, 1200); let b = R(100, 1200); if (Math.random() < 0.2) b = a; return { text: `Which symbol makes this true?\n${fmt(a)}  __  ${fmt(b)}`, answer: cmp(a, b), choices: CMP_CHOICES, hint: 'Compare the biggest place first. The alligator mouth eats the bigger number.' }; },
      () => { const s = pick([5, 10, 100]), st = s * R(2, 9); return { text: `Skip count by ${s}s:\n${st}, ${st + s}, ${st + 2 * s}, ?`, answer: `${st + 3 * s}`, hint: `Add ${s} each time.` }; },
    ],
  },
  {
    id: 'g2m4', name: 'Module 4: Add & subtract within 100',
    gens: [
      () => { const a = R(15, 68), b = R(12, 99 - a); return { text: `${a} + ${b} = ?`, answer: `${a + b}`, hint: 'Add the tens, add the ones, then put them together.' }; },
      () => { const a = R(40, 99), b = R(12, a - 5); return { text: `${a} − ${b} = ?`, answer: `${a - b}`, hint: 'If you need more ones, break apart a ten.' }; },
      () => { const a = R(35, 95), b = R(12, a - 8); return { text: `The castle had ${a} gold coins.\nA sneaky dragon took ${b} coins.\nHow many coins are left?`, answer: `${a - b}`, hint: 'Took away means subtract.' }; },
      () => { const a = R(18, 55), b = R(15, 40); return { text: `There are ${a} red gems and ${b} blue gems in the treasure room.\nHow many gems in all?`, answer: `${a + b}`, hint: 'In all means add.' }; },
      () => { const n1 = pick(NAMES), n2 = pick(NAMES.filter((x) => x !== n1)); const a = R(40, 90), b = R(15, a - 8); return { text: `${n1} has ${a} stickers. ${n2} has ${b} stickers.\nHow many more stickers does ${n1} have?`, answer: `${a - b}`, hint: 'How many more? Subtract the smaller number from the bigger one.' }; },
    ],
  },
  {
    id: 'g2m5', name: 'Module 5: Add & subtract within 1,000',
    gens: [
      () => { const a = R(120, 650), b = R(110, 999 - a); return { text: `${a} + ${b} = ?`, answer: `${a + b}`, hint: 'Add hundreds, then tens, then ones. Regroup 10 ones as 1 ten if needed.' }; },
      () => { const a = R(300, 999), b = R(110, a - 50); return { text: `${a} − ${b} = ?`, answer: `${a - b}`, hint: 'Subtract ones, tens, hundreds. Break apart a ten or a hundred if you need to.' }; },
      () => { const a = R(210, 560), b = R(120, 400); return { text: `The royal library has ${a} books.\nThe wizard brings ${b} more books.\nHow many books now?`, answer: `${a + b}`, hint: 'More books means add.' }; },
      () => { const a = R(400, 950), b = R(120, a - 100); return { text: `A tower has ${a} steps. The princess climbed ${b} steps.\nHow many steps are left to climb?`, answer: `${a - b}`, hint: 'Steps left: subtract the steps already climbed.' }; },
    ],
  },
  {
    id: 'g2m6', name: 'Module 6: Equal groups, arrays, even & odd',
    gens: [
      () => { const g = R(2, 5), n = R(2, 5); return { text: `${g} groups of ${n} = ?`, answer: `${g * n}`, hint: `Add ${n} a total of ${g} times.` }; },
      () => { const r = R(2, 5), c = R(2, 5); return { text: `The knights stand in ${r} rows.\nThere are ${c} knights in each row.\nHow many knights in all?`, answer: `${r * c}`, hint: `Add ${c} for each row: ${Array(r).fill(c).join(' + ')}.` }; },
      () => { const n = R(2, 5), k = R(3, 5); return { text: `${Array(k).fill(n).join(' + ')} = ?`, answer: `${n * k}`, hint: `Skip count by ${n}s.` }; },
      () => { const n = R(5, 40); return { text: `Is ${n} even or odd?`, answer: n % 2 ? 'odd' : 'even', choices: ['even', 'odd'], hint: 'Look at the ones digit. 0, 2, 4, 6, 8 are even.' }; },
      () => { const n = R(6, 20); return { text: `Double ${n}. What is ${n} + ${n}?`, answer: `${2 * n}`, hint: 'Doubles: add the number to itself.' }; },
    ],
  },
  {
    id: 'g2m7', name: 'Module 7: Money, data, inches & feet',
    gens: [
      () => { let q, d, n, p; do { q = R(0, 3); d = R(0, 4); n = R(0, 3); p = R(0, 4); } while (q + d + n + p < 3 || 25 * q + 10 * d + 5 * n + p > 100); const parts = []; if (q) parts.push(`${q} quarter${q > 1 ? 's' : ''}`); if (d) parts.push(`${d} dime${d > 1 ? 's' : ''}`); if (n) parts.push(`${n} nickel${n > 1 ? 's' : ''}`); if (p) parts.push(`${p} penn${p > 1 ? 'ies' : 'y'}`); return { text: `You find ${parts.join(', ')} in the treasure chest.\nHow many cents is that?`, answer: `${25 * q + 10 * d + 5 * n + p}`, hint: 'Quarter = 25¢, dime = 10¢, nickel = 5¢, penny = 1¢. Count the biggest coins first.' }; },
      () => { const a = R(45, 99), b = R(15, a - 10); return { text: `You have ${a}¢. You buy a magic potion for ${b}¢.\nHow many cents do you have left?`, answer: `${a - b}`, hint: 'Spend means subtract.' }; },
      () => { const c = R(4, 12), d = R(c + 2, 20), f = R(3, 10); return { text: `Favorite castle pets:\nCats: ${c}    Dogs: ${d}    Fish: ${f}\nHow many more kids like dogs than cats?`, answer: `${d - c}`, hint: 'How many more: subtract cats from dogs.' }; },
      () => { const c = R(4, 12), d = R(4, 12), f = R(3, 10); return { text: `Favorite castle pets:\nCats: ${c}    Dogs: ${d}    Fish: ${f}\nHow many kids voted in all?`, answer: `${c + d + f}`, hint: 'In all: add all three numbers.' }; },
      () => { const a = R(20, 40), b = R(8, a - 5); return { text: `A sword is ${a} inches long. A dagger is ${b} inches long.\nHow many inches longer is the sword?`, answer: `${a - b}`, hint: 'Subtract the shorter length from the longer one.' }; },
    ],
  },
  {
    id: 'g2m8', name: 'Module 8: Shapes & fractions',
    gens: [
      () => { const [s, n] = pick([['triangle', 3], ['square', 4], ['rectangle', 4], ['pentagon', 5], ['hexagon', 6], ['octagon', 8]]); const what = pick(['sides', 'vertices (corners)']); return { text: `How many ${what} does a ${s} have?`, answer: `${n}`, hint: 'Picture the shape and count carefully.' }; },
      () => { const [w, n] = pick([['halves', 2], ['fourths', 4], ['eighths', 8]]); return { text: `How many ${w} make one whole?`, answer: `${n}`, hint: `${w[0].toUpperCase() + w.slice(1)} means the whole is cut into ${n} equal parts.` }; },
      () => { const a = R(1, 7); return { text: `A pizza is cut into 8 equal slices.\nYou eat ${a} slices. How many eighths are left?`, answer: `${8 - a}`, hint: '8 eighths make the whole pizza. Take away the slices you ate.' }; },
      () => { const [n, w] = pick([[2, 'half'], [4, 'fourth'], [8, 'eighth']]); return { text: `A cake is cut into ${n} equal parts.\nWhat is each part called?`, answer: w, choices: ['half', 'fourth', 'eighth'], hint: '2 parts = halves, 4 parts = fourths, 8 parts = eighths.' }; },
      () => { const [s, n] = pick([['cube', 6], ['rectangular prism', 6], ['triangular prism', 5], ['square pyramid', 5]]); return { text: `How many faces does a ${s} have?`, answer: `${n}`, hint: 'Faces are the flat sides. Count top, bottom, and all around.' }; },
    ],
  },
];

// ---------------------------------------------------------------- Grade 4
function uniqueDigitPlace() {
  for (;;) {
    const n = R(100000, 99999999), s = String(n), i = R(0, s.length - 1), d = s[i];
    if (d !== '0' && s.indexOf(d) === s.lastIndexOf(d)) return { n, d: Number(d), value: Number(d) * 10 ** (s.length - 1 - i) };
  }
}
const PLACES = [[10, 'ten'], [100, 'hundred'], [1000, 'thousand'], [10000, 'ten thousand'], [100000, 'hundred thousand']];
const DEN_WORD = { 2: 'halves', 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 8: 'eighths', 10: 'tenths', 12: 'twelfths', 100: 'hundredths' };

const G4 = [
  {
    id: 'g4m1', name: 'Module 1: Place value, rounding, add & subtract',
    gens: [
      () => { const { n, d, value } = uniqueDigitPlace(); return { text: `What is the value of the ${d} in ${fmt(n)}?`, answer: `${value}`, hint: 'Find the digit, then count its place: ones, tens, hundreds, thousands...' }; },
      () => { const [p, w] = pick(PLACES.slice(1)); const n = R(10000, 9999999); return { text: `Round ${fmt(n)} to the nearest ${w}.`, answer: `${Math.round(n / p) * p}`, hint: `Look at the digit just to the right of the ${w}s place. 5 or more rounds up.` }; },
      () => { const a = R(100000, 9999999); const b = Math.random() < 0.5 ? a + pick([-1, 1]) * pick([10, 1000, 100000]) : R(100000, 9999999); return { text: `Which symbol makes this true?\n${fmt(a)}  __  ${fmt(b)}`, answer: cmp(a, b), choices: CMP_CHOICES, hint: 'Line up the places. Compare from the left until the digits are different.' }; },
      () => { const ds = [R(1, 9), R(0, 9), R(1, 9), 0, R(1, 9), R(1, 9)]; const pw = [100000, 10000, 1000, 100, 10, 1]; const parts = ds.map((d, i) => d * pw[i]).filter((v) => v); return { text: `${parts.map(fmt).join(' + ')} = ?`, answer: `${parts.reduce((s, v) => s + v, 0)}`, hint: 'Expanded form: write each digit in its place. Use 0 for any missing place.' }; },
      () => { const a = R(10000, 89999), b = R(10000, 99999 - a + 10000); return { text: `${fmt(a)} + ${fmt(b)} = ?`, answer: `${a + b}`, hint: 'Line up the places and regroup when a column is 10 or more.' }; },
      () => { const a = R(20000, 99999), b = R(10000, a - 1000); return { text: `The dragon's hoard had ${fmt(a)} gold coins.\nThe queen took ${fmt(b)} coins for the kingdom.\nHow many coins are left?`, answer: `${a - b}`, hint: 'Subtract. Regroup from the next place when you need to.' }; },
    ],
  },
  {
    id: 'g4m2', name: 'Module 2: Metric conversions',
    gens: [
      () => { const [big, small, f] = pick([['km', 'm', 1000], ['m', 'cm', 100], ['kg', 'g', 1000], ['L', 'mL', 1000]]); const n = R(2, 9); return { text: `${n} ${big} = ? ${small}`, answer: `${n * f}`, hint: `1 ${big} = ${fmt(f)} ${small}. Multiply by ${fmt(f)}.` }; },
      () => { const l = R(1, 4), ml = R(1, 9) * 50; return { text: `A potion bottle holds ${l} L ${ml} mL.\nHow many mL is that?`, answer: `${l * 1000 + ml}`, hint: `1 L = 1,000 mL. Change the liters to mL, then add ${ml}.` }; },
      () => { const k = R(1, 5), m = R(1, 9) * 100; return { text: `${pick(NAMES)} rode her horse ${k} km ${m} m.\nHow many meters is that?`, answer: `${k * 1000 + m}`, hint: '1 km = 1,000 m.' }; },
      () => { const kg = R(2, 6), g = R(1, 9) * 100, eat = R(1, 9) * 100; return { text: `A bag of dragon food weighs ${kg} kg.\nThe dragon eats ${eat} g. How many grams are left?`, answer: `${kg * 1000 - eat}`, hint: `Change ${kg} kg to grams first (1 kg = 1,000 g), then subtract.` }; },
    ],
  },
  {
    id: 'g4m3', name: 'Module 3: Multiply & divide',
    gens: [
      () => { const a = R(1000, 4999), b = R(2, 9); return { text: `${fmt(a)} × ${b} = ?`, answer: `${a * b}`, hint: 'Multiply each place, then add the partial products.' }; },
      () => { const a = R(12, 49), b = R(11, 39); return { text: `${a} × ${b} = ?`, answer: `${a * b}`, hint: `Break it apart: ${a} × ${Math.floor(b / 10) * 10} plus ${a} × ${b % 10}.` }; },
      () => { const d = R(2, 9), q = R(100, Math.floor(9999 / d)); return { text: `${fmt(q * d)} ÷ ${d} = ?`, answer: `${q}`, hint: `How many groups of ${d}? Divide one place at a time, starting on the left.` }; },
      () => { const d = R(3, 9), q = R(5, 30), r = R(1, d - 1); return { text: `What is the remainder of ${q * d + r} ÷ ${d}?`, answer: `${r}`, hint: `Find the biggest multiple of ${d} that fits, then see what is left over.` }; },
      () => { const a = R(6, 25), k = R(3, 9), n1 = pick(NAMES), n2 = pick(NAMES.filter((x) => x !== n1)); return { text: `${n1} has ${a} gems.\n${n2} has ${k} times as many gems.\nHow many gems does ${n2} have?`, answer: `${a * k}`, hint: `"Times as many" means multiply: ${a} × ${k}.` }; },
      () => { const r = R(12, 35), c = R(12, 30); return { text: `The knights march in ${r} rows.\nEach row has ${c} knights.\nHow many knights are marching?`, answer: `${r * c}`, hint: 'Rows times knights in each row.' }; },
      () => { const d = R(3, 8), q = R(12, 99); return { text: `${q * d} jewels are shared equally among ${d} princesses.\nHow many jewels does each one get?`, answer: `${q}`, hint: 'Shared equally means divide.' }; },
    ],
  },
  {
    id: 'g4m4', name: 'Module 4: Angles, lines & shapes',
    gens: [
      () => { const a = R(20, 160); return { text: `Two angles make a straight line (180°).\nOne angle is ${a}°. What is the other angle?`, answer: `${180 - a}`, hint: 'The two angles add to 180°. Subtract.' }; },
      () => { const a = R(15, 75); return { text: `A right angle (90°) is split into two angles.\nOne is ${a}°. How many degrees is the other?`, answer: `${90 - a}`, hint: 'The two parts add to 90°.' }; },
      () => { const a = R(25, 80), b = R(20, 90); return { text: `Angle A is ${a}°. Angle B is ${b}°.\nThey join to make one big angle.\nHow many degrees is the big angle?`, answer: `${a + b}`, hint: 'Angles that join together add up.' }; },
      () => { const a = pick([R(10, 85), 90, R(95, 175)]); return { text: `An angle measures ${a}°.\nWhat kind of angle is it?`, answer: a < 90 ? 'acute' : a === 90 ? 'right' : 'obtuse', choices: ['acute', 'right', 'obtuse'], hint: 'Acute is less than 90°. Right is exactly 90°. Obtuse is more than 90°.' }; },
      () => { const [s, n] = pick([['square', 4], ['rectangle (not a square)', 2], ['equilateral triangle', 3], ['regular hexagon', 6]]); return { text: `How many lines of symmetry does a ${s} have?`, answer: `${n}`, hint: 'A line of symmetry folds the shape into two matching halves.' }; },
      () => { const [w, d] = pick([['quarter turn', 90], ['half turn', 180], ['three-quarter turn', 270], ['full turn', 360]]); return { text: `A full turn is 360°.\nHow many degrees is a ${w}?`, answer: `${d}`, hint: 'Split 360° into 4 equal quarter turns.' }; },
    ],
  },
  {
    id: 'g4m5', name: 'Module 5: Fractions',
    gens: [
      () => { const d = pick([4, 5, 6, 8, 10, 12]), a = R(1, d - 2), b = R(1, d - 1 - a); return { text: `${a}/${d} + ${b}/${d} = ?`, answer: `${a + b}/${d}`, hint: 'Same denominator: add the numerators, keep the denominator.' }; },
      () => { const d = pick([4, 5, 6, 8, 10, 12]), a = R(3, d), b = R(1, a - 1); return { text: `${a}/${d} − ${b}/${d} = ?`, answer: `${a - b}/${d}`, hint: 'Same denominator: subtract the numerators, keep the denominator.' }; },
      () => { const b = pick([2, 3, 4, 5, 6]), a = R(1, b - 1), k = R(2, 5); return { text: `${a}/${b} = ?/${b * k}`, answer: `${a * k}`, hint: `The denominator was multiplied by ${k}. Do the same to the numerator.` }; },
      () => { let a, b, c, d; do { b = pick([2, 3, 4, 5, 6, 8, 10, 12]); d = pick([2, 3, 4, 5, 6, 8, 10, 12]); a = R(1, b - 1); c = R(1, d - 1); } while (b === d && a === c); return { text: `Which symbol makes this true?\n${a}/${b}  __  ${c}/${d}`, answer: cmp(a * d, c * b), choices: CMP_CHOICES, hint: 'Compare each to 1/2, or rewrite them with the same denominator.' }; },
      () => { const d = pick([5, 6, 8, 10]), a = R(3, d - 1), b = R(1, a - 1); return { text: `${a}/${d} = ${b}/${d} + ?`, answer: `${a - b}/${d}`, hint: 'Decompose: what fraction do you add to get the total?' }; },
      () => { const d = pick([6, 8, 10, 12]), a = R(1, Math.floor(d / 2) - 1), b = R(1, d - 1 - a); return { text: `A wizard drinks ${a}/${d} of a potion in the morning\nand ${b}/${d} at night.\nHow much of the potion did he drink?`, answer: `${a + b}/${d}`, hint: 'Add the fractions. The denominator stays the same.' }; },
    ],
  },
  {
    id: 'g4m6', name: 'Module 6: Decimals & money',
    gens: [
      () => { const [d, pl] = pick([[10, 1], [100, 2]]), n = R(1, d - 1); return { text: `Write ${n}/${d} as a decimal.`, answer: dec(n / d, pl), hint: `${DEN_WORD[d] || 'hundredths'}: the ${d === 10 ? 'first' : 'second'} place after the decimal point.` }; },
      () => { const a = R(10, 500) / 100, b = R(10, 500) / 100; return { text: `${a.toFixed(2)} + ${b.toFixed(2)} = ?`, answer: dec(a + b, 2), hint: 'Line up the decimal points, then add like whole numbers.' }; },
      () => { const a = R(200, 900) / 100, b = R(10, Math.round(a * 100) - 10) / 100; return { text: `${a.toFixed(2)} − ${b.toFixed(2)} = ?`, answer: dec(a - b, 2), hint: 'Line up the decimal points, then subtract.' }; },
      () => { let a = R(1, 99) / 100, b = Math.random() < 0.5 ? R(1, 9) / 10 : R(1, 99) / 100; if (a === b) b = (Math.round(b * 100) + 1) / 100; const s = (x) => String(x).replace(/^0/, '0'); return { text: `Which symbol makes this true?\n${s(a)}  __  ${s(b)}`, answer: cmp(a, b), choices: CMP_CHOICES, hint: 'Write both with two decimal places (0.5 = 0.50), then compare.' }; },
      () => { const x = R(100, 800) / 100, y = R(100, 800) / 100; return { text: `A map costs $${money(x)}. A lantern costs $${money(y)}.\nHow much do they cost together?`, answer: dec(x + y, 2), hint: 'Add dollars and cents. Line up the decimal points.' }; },
      () => { const n = R(101, 999) / 100, p = pick(['tenths', 'hundredths']); const s = n.toFixed(2); return { text: `What digit is in the ${p} place of ${s}?`, answer: p === 'tenths' ? s[2] : s[3], hint: 'Tenths is right after the decimal point. Hundredths is next.' }; },
    ],
  },
  {
    id: 'g4m7', name: 'Module 7: Measurement, perimeter & area',
    gens: [
      () => { const [big, small, f] = pick([['feet', 'inches', 12], ['yards', 'feet', 3], ['gallons', 'quarts', 4], ['pounds', 'ounces', 16], ['hours', 'minutes', 60], ['minutes', 'seconds', 60]]); const n = R(2, 9); return { text: `${n} ${big} = ? ${small}`, answer: `${n * f}`, hint: `1 ${big.replace(/s$/, '').replace('feet', 'foot')} = ${f} ${small}. Multiply.` }; },
      () => { const l = R(4, 15), w = R(3, 12); return { text: `A castle garden is a rectangle ${l} feet long and ${w} feet wide.\nWhat is its area in square feet?`, answer: `${l * w}`, hint: 'Area = length × width.' }; },
      () => { const l = R(4, 25), w = R(3, 20); return { text: `A rectangle rug is ${l} feet long and ${w} feet wide.\nWhat is its perimeter in feet?`, answer: `${2 * (l + w)}`, hint: 'Perimeter = add all four sides: length + width + length + width.' }; },
      () => { const l = R(6, 20), w = R(3, l - 1); return { text: `A rectangle pen has a perimeter of ${2 * (l + w)} feet.\nIt is ${l} feet long. How wide is it?`, answer: `${w}`, hint: `Two lengths use ${2 * l} feet. Split what is left into two equal widths.` }; },
      () => { const w = R(3, 9), a = w * R(3, 12); return { text: `A rectangle has an area of ${a} square meters.\nIt is ${w} meters wide. How long is it?`, answer: `${a / w}`, hint: `Area ÷ width = length.` }; },
    ],
  },
];

export const MODULES = { 2: G2, 4: G4 };

// ------------------------------------------------------------ checking
export function parseValue(s) {
  s = String(s).replace(/[,\s$¢°]/g, '');
  if (!s) return NaN;
  if (s.includes('/')) {
    const [n, d, extra] = s.split('/');
    if (extra !== undefined || n === '' || d === '' || Number(d) === 0) return NaN;
    return Number(n) / Number(d);
  }
  return Number(s);
}

export function isCorrect(problem, input) {
  if (problem.choices) return input === problem.answer;
  const want = parseValue(problem.answer), got = parseValue(input);
  if (Number.isNaN(want) || Number.isNaN(got)) return String(input).trim().toLowerCase() === String(problem.answer).trim().toLowerCase();
  return Math.abs(want - got) < 1e-9;
}

// Spoken version of a problem (for the read-aloud button).
export function speakable(text) {
  const frac = (n, d) => { const w = DEN_WORD[d]; if (!w) return `${n} over ${d}`; return Number(n) === 1 ? `1 ${w === 'halves' ? 'half' : w.slice(0, -1)}` : `${n} ${w}`; };
  return text
    .replace(/\?\/(\d+)/g, (m, d) => `how many ${DEN_WORD[d] || `over ${d}`}`)
    .replace(/(\d+)\/(\d+)/g, (m, n, d) => frac(n, d))
    .replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/−/g, ' minus ')
    .replace(/__/g, ' blank ').replace(/= \? ([a-zA-Z]+)/g, 'equals how many $1?').replace(/= \?/g, 'equals what?').replace(/\+ \?/g, 'plus what number').replace(/, \?/g, ', what comes next?')
    .replace(/°/g, ' degrees').replace(/¢/g, ' cents').replace(/\n/g, ' ');
}

// ----------------------------------------------------- homework parser
// Format, one problem per line:   question | answer | choice; choice; choice
// Lines starting with # are comments. "[grade 2]" / "[grade 4]" start a
// section that only that grade gets; lines before any section go to both.
export function parseHomework(src, grade) {
  const out = [], errors = [];
  let section = null;
  String(src || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const sec = line.match(/^\[\s*grade\s*(\d)\s*\]$/i);
    if (sec) { section = Number(sec[1]); return; }
    if (section !== null && section !== grade) return;
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) { errors.push(`line ${i + 1}: need "question | answer"`); return; }
    const p = { text: parts[0].replace(/\\n/g, '\n'), answer: parts[1], hint: 'Look back at your homework page and try again!', homework: true };
    if (parts[2]) {
      p.choices = parts[2].split(';').map((s) => s.trim()).filter(Boolean);
      if (!p.choices.includes(p.answer)) p.choices.push(p.answer);
    } else if (Number.isNaN(parseValue(p.answer))) {
      errors.push(`line ${i + 1}: answer "${p.answer}" is not a number, so list choices after a second |`); return;
    }
    out.push(p);
  });
  return { problems: out, errors };
}

// ------------------------------------------------------ problem source
export class ProblemSource {
  constructor({ grade, moduleIds, homework = [], homeworkOnly = false }) {
    this.gens = MODULES[grade].filter((m) => moduleIds.includes(m.id)).flatMap((m) => m.gens);
    if (!this.gens.length) this.gens = MODULES[grade].flatMap((m) => m.gens);
    this.homework = homework.slice();
    this.homeworkOnly = homeworkOnly && homework.length > 0;
    this.hwIndex = 0;
    this.seen = new Set();
    this.lastGen = -1;
  }
  next() {
    if (this.hwIndex < this.homework.length) return this.homework[this.hwIndex++];
    if (this.homeworkOnly) return this.homework[this.hwIndex++ % this.homework.length];
    for (let tries = 0; tries < 40; tries++) {
      let gi = Math.floor(Math.random() * this.gens.length);
      if (gi === this.lastGen && this.gens.length > 1) gi = (gi + 1) % this.gens.length;
      const p = this.gens[gi]();
      if (this.seen.has(p.text)) continue;
      this.lastGen = gi; this.seen.add(p.text);
      return p;
    }
    return this.gens[0]();
  }
}
