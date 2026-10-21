import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, step } from './examples/circuit-vault/src/rules.mjs';
test('vault validates sequence, round progress, complete score and repeated finish',()=>{
  const run=newRun(()=>0,1000);
  for(let round=1;round<=6;round++)for(let i=0;i<round;i++)step(run,0,2000);
  assert(run.won&&run.done);assert(run.score>=2100);
  const score=run.score;step(run,0,2000);assert.equal(run.score,score);
});
test('wrong input and expired input cost lives; score cannot be supplied by client',()=>{
  const run=newRun(()=>0,0);step(run,1,1);assert.equal(run.lives,2);assert.equal(run.score,0);
  step(run,0,20000);assert.equal(run.lives,1);step(run,2,20001);assert(run.done&&!run.won);
});
