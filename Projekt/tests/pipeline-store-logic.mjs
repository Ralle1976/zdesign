/**
 * Pure logic tests mirroring zdesign-store applyStepEvent behaviour.
 */
import assert from 'node:assert/strict';

function applyStepEvent(steps, evt) {
  if (evt.step === 'complete') {
    const next = steps.map((s) =>
      s.status === 'active' ? { ...s, status: 'done' } : s,
    );
    next.push({
      step: 'complete',
      label: evt.label ?? 'Fertig',
      detail: evt.detail,
      status: 'done',
    });
    return next;
  }
  const next = steps.map((s) =>
    s.status === 'active' ? { ...s, status: 'done' } : s,
  );
  const isStart = evt.step.endsWith('-start');
  next.push({
    step: evt.step,
    label: evt.label ?? evt.step,
    detail: evt.detail,
    composite: evt.composite,
    status: isStart ? 'active' : 'done',
  });
  return next;
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}:`, e.message);
    process.exitCode = 1;
  }
}

test('start step becomes active', () => {
  const steps = applyStepEvent([], { step: 'craft-start', label: 'Craft' });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].status, 'active');
});

test('second start closes previous active', () => {
  let steps = applyStepEvent([], { step: 'craft-start', label: 'Craft' });
  steps = applyStepEvent(steps, { step: 'critique-start', label: 'Critique' });
  assert.equal(steps[0].status, 'done');
  assert.equal(steps[1].status, 'active');
});

test('complete marks active done and appends complete', () => {
  let steps = applyStepEvent([], { step: 'craft-start', label: 'Craft' });
  steps = applyStepEvent(steps, { step: 'complete', label: 'Fertig' });
  assert.equal(steps[0].status, 'done');
  assert.equal(steps[1].step, 'complete');
  assert.equal(steps[1].status, 'done');
});

test('parallel tracks stay isolated', () => {
  const tracks = new Map();
  const applyVariant = (name, evt) => {
    tracks.set(name, applyStepEvent(tracks.get(name) ?? [], evt));
  };
  applyVariant('A', { step: 'a-start', label: 'A' });
  applyVariant('B', { step: 'b-start', label: 'B' });
  applyVariant('A', { step: 'a-done', label: 'A done' });
  assert.equal(tracks.get('A').length, 2);
  assert.equal(tracks.get('B').length, 1);
  assert.equal(tracks.get('B')[0].status, 'active');
});

console.log(`\n${passed}/4 store logic tests passed\n`);