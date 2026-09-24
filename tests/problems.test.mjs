import test from 'node:test';
import assert from 'node:assert/strict';
import {parseValue, parseHomework, isCorrect, keypadAnswer, ProblemSource} from '../js/problems.js';

test('mixed numbers, fractions, decimals and signs represent the correct value', () => {
  for (const [s, value] of [['1 1/2',1.5],['-1 1/2',-1.5],['−1/2',-.5],['7/8',.875],['4.50',4.5],['1,234',1234]]) assert.equal(parseValue(s),value);
  assert.ok(isCorrect({answer:'1 1/2'},'3/2'));
  assert.ok(isCorrect({answer:'1 1/2'},'1.5'));
  assert.ok(!isCorrect({answer:'1 1/2'},'5.5'));
  assert.ok(!isCorrect({answer:'0.0000000001'},'0'));
});
test('malformed and nonfinite numeric input is rejected', () => {
  for (const s of ['1/0','0/0','Infinity','0x10','1 2','1/2/3','1 3/2','1e3','']) {
    assert.ok(Number.isNaN(parseValue(s)),s);
    assert.equal(keypadAnswer(s),null,s);
    assert.ok(!isCorrect({answer:s},s),s);
  }
});
test('homework answers are enterable and grade sections stay separate', () => {
  const {problems,errors}=parseHomework('[grade 2]\nHalf | 1/2\nMixed | -1 1/2\n[grade 4]\nOther | 7',2);
  assert.deepEqual(errors,[]);assert.deepEqual(problems.map(p=>p.answer),['1/2','-3/2']);
  assert.equal(parseHomework('bad\ninvalid | 1/0',2).errors.length,2);
  assert.equal(parseHomework('word | odd | even; odd',2).problems[0].choices.length,2);
});
test('homework-only cannot silently fall back to generated practice', () => {
  assert.throws(()=>new ProblemSource({grade:2,moduleIds:[],homeworkOnly:true}),/valid homework/);
  const h=parseHomework('First | 1\nSecond | 2',2).problems;
  const source=new ProblemSource({grade:2,moduleIds:[],homework:h,homeworkOnly:true});
  assert.deepEqual(Array.from({length:5},()=>source.next().text),['First','Second','First','Second','First']);
});
