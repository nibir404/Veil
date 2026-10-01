import test from 'node:test';
import assert from 'node:assert/strict';

// Test mathematical projections for the GTA Vice City rotating radar
function toRadarLocal(dx, dz, yaw, scale = 1) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const rx = (-dx * cosY + dz * sinY) * scale;
  const ry = (dx * sinY + dz * cosY) * scale;
  return { rx, ry, dist: Math.hypot(rx, ry), angle: Math.atan2(ry, rx) };
}

function northAngleOnRim(yaw) {
  return Math.atan2(Math.cos(yaw), Math.sin(yaw));
}

test('facing North: North is at top of radar (ry < 0) and East is to the right (rx > 0)', () => {
  const yaw = Math.PI; // facing North (+Z)
  const northPoint = toRadarLocal(0, 10, yaw);
  assert.equal(Math.round(northPoint.rx), 0);
  assert(northPoint.ry < 0, 'North point must be UPwards (-Y) on radar screen');

  const eastPoint = toRadarLocal(10, 0, yaw);
  assert(eastPoint.rx > 0, 'East point must be to the RIGHT (+X) on radar screen');
  assert.equal(Math.round(eastPoint.ry), 0);

  const nAngle = northAngleOnRim(yaw);
  assert.equal(Math.round(nAngle * 1000), Math.round((-Math.PI / 2) * 1000));
});

test('facing East: East is at top of radar and North is to the left (rx < 0)', () => {
  const yaw = -Math.PI / 2; // facing East (+X)
  const eastPoint = toRadarLocal(10, 0, yaw);
  assert.equal(Math.abs(Math.round(eastPoint.rx)), 0);
  assert(eastPoint.ry < 0, 'East point must be UPwards (-Y) when facing East');

  const northPoint = toRadarLocal(0, 10, yaw);
  assert(northPoint.rx < 0, 'North point must be to the LEFT (-X) when facing East');
  assert.equal(Math.abs(Math.round(northPoint.ry)), 0);

  const nAngle = northAngleOnRim(yaw);
  assert.equal(Math.round(Math.abs(nAngle) * 1000), Math.round(Math.PI * 1000));
});

test('facing West: West is at top of radar and North is to the right (rx > 0)', () => {
  const yaw = Math.PI / 2; // facing West (-X)
  const westPoint = toRadarLocal(-10, 0, yaw);
  assert.equal(Math.round(westPoint.rx), 0);
  assert(westPoint.ry < 0, 'West point must be UPwards (-Y) when facing West');

  const northPoint = toRadarLocal(0, 10, yaw);
  assert(northPoint.rx > 0, 'North point must be to the RIGHT (+X) when facing West');
  assert.equal(Math.round(northPoint.ry), 0);

  const nAngle = northAngleOnRim(yaw);
  assert.equal(Math.round(nAngle * 1000), 0);
});

test('facing South: North is at bottom of radar (ry > 0)', () => {
  const yaw = 0; // facing South (-Z)
  const northPoint = toRadarLocal(0, 10, yaw);
  assert.equal(Math.round(northPoint.rx), 0);
  assert(northPoint.ry > 0, 'North point must be DOWNwards (+Y) when facing South');

  const nAngle = northAngleOnRim(yaw);
  assert.equal(Math.round(nAngle * 1000), Math.round((Math.PI / 2) * 1000));
});
