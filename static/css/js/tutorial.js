/* FitTrack - 3D exercise tutorials
   Needs Three.js r128 loaded first. Usage: FitTrackTutorial.open(exerciseId, buttonElement)
   FitTrackTutorial.has(exerciseId) tells you whether an exercise has a tutorial. */
(function (root) {
"use strict";

/* ---------- vector helpers ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mid = (a, b) => mix(a, b, 0.5);
const lerp = (a, b, t) => a + (b - a) * t;
const rad = d => d * Math.PI / 180;

/* ---------- body model ---------- */
const D = { thigh: .45, shin: .45, upper: .30, fore: .27, torso: .52, shX: .215, shY: .47, hipX: .10, ankle: .055 };

/* torso frame: left (x), up (y, pelvis to head), front (z, chest direction) */
function mkFrame(p, up, front) { up = nrm(up); front = nrm(front); return { p, up, front, left: cross(up, front) }; }
const pitchFrame = (p, a) => mkFrame(p, [0, Math.cos(a), Math.sin(a)], [0, -Math.sin(a), Math.cos(a)]);
const relDir = (F, x, y, z) => add(mul(F.left, x), add(mul(F.up, y), mul(F.front, z)));
const relPt = (F, x, y, z) => add(F.p, relDir(F, x, y, z));
const Sh = (F, sg) => relPt(F, sg * D.shX, D.shY, 0);

/* two-bone solver: root -> mid -> end, bending towards the pole direction */
function bend(root, target, l1, l2, pole) {
  const d = sub(target, root), dist = len(d), dir = dist > 1e-9 ? mul(d, 1 / dist) : [0, -1, 0];
  const r = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-4);
  const a = (l1 * l1 - l2 * l2 + r * r) / (2 * r), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  let pv = sub(pole, mul(dir, dot(pole, dir)));
  if (len(pv) < 1e-6) { pv = cross(dir, [1, 0, 0]); if (len(pv) < 1e-6) pv = cross(dir, [0, 0, 1]); }
  return { mid: add(add(root, mul(dir, a)), mul(nrm(pv), h)), end: add(root, mul(dir, r)), miss: Math.max(dist - r, 0) };
}

/* ---------- equipment helpers ---------- */
const C = { bar: 0xa7afb3, plate: 0x2b3034, pad: 0x434a4f, frame: 0x7c848a, cable: 0x15171a };
const cyl = (a, b, r, c) => ({ k: 'c', a, b, r, c });
const box = (c, sz, col, up, front) => ({ k: 'b', c, sz, col, up: up || [0, 1, 0], front: front || [0, 0, 1] });
const dumbbell = (c, ax) => {
  ax = nrm(ax);
  const o = [cyl(add(c, mul(ax, -.085)), add(c, mul(ax, .085)), .012, C.bar)];
  [-1, 1].forEach(g => o.push(cyl(add(c, mul(ax, g * .06)), add(c, mul(ax, g * .09)), .05, C.plate)));
  return o;
};
const barbell = (c, ax) => {
  ax = ax || [1, 0, 0];
  const o = [cyl(add(c, mul(ax, -.65)), add(c, mul(ax, .65)), .014, C.bar)];
  [-1, 1].forEach(g => {
    o.push(cyl(add(c, mul(ax, g * .46)), add(c, mul(ax, g * .50)), .2, C.plate));
    o.push(cyl(add(c, mul(ax, g * .51)), add(c, mul(ax, g * .54)), .16, C.plate));
  });
  return o;
};
const sym = (x, y, z) => sg => [sg * x, y, z];
const feet = (w, z = 0, y = D.ankle) => sg => [sg * w, y, z];
const std = (y = .96, z = 0, a = 0) => pitchFrame([0, y, z], a);
const seat = (z = -.03) => [box([0, .40, z], [.38, .07, .40], C.pad), box([0, .19, z], [.08, .38, .08], C.frame)];
const backPad = F => box(relPt(F, 0, .30, -.14), [.40, .85, .07], C.pad, F.up, F.front);
const bar2 = (o, ext) => cyl(add(o.arms[0].grip, [ext, 0, 0]), add(o.arms[1].grip, [-ext, 0, 0]), .016, C.bar);

/* ---------- exercises ----------
   s runs 0 -> 1 -> 0 during each rep. phases = [s rising, hold at s=1, s falling]. */
const EX = {};

EX.benchPress = { name: 'Bench Press', group: 'Chest', target: ['chest'], sec: ['shoulder', 'triceps'], yaw: -1, ty: .7, dist: 3.7,
  phases: ['Lower the bar to your chest', 'Pause on your chest', 'Press back up'],
  cues: ['Lie flat with your eyes under the bar and your feet planted on the floor.', 'Lower the bar slowly to your mid-chest, elbows at about 45 degrees.', 'Press back up until your arms are straight. Do not bounce the bar. Use a spotter for heavy sets.'],
  pose: s => {
    const F = mkFrame([0, .54, 0], [0, 0, -1], [0, 1, 0]), y = lerp(1.08, .70, s), z = lerp(-.45, -.36, s);
    return { F, hand: sg => [sg * .30, y, z], ep: [.7, -.4, -.6], foot: feet(.2, .40), kp: sym(.1, 1, .3),
      props: o => [box([0, .38, -.225], [.32, .10, 1.25], C.pad), box([0, .165, -.7], [.06, .33, .06], C.frame), box([0, .165, .3], [.06, .33, .06], C.frame),
        box([-.72, .625, -.45], [.07, 1.25, .07], C.frame), box([.72, .625, -.45], [.07, 1.25, .07], C.frame), ...barbell(mid(o.arms[0].grip, o.arms[1].grip))] };
  } };

EX.squat = { name: 'Squat', group: 'Legs', target: ['quads', 'glutes'], sec: ['hamstrings', 'abs'], yaw: -1, ty: .95, dist: 4.2,
  phases: ['Sit down and back', 'Hold at parallel', 'Drive up through your heels'],
  cues: ['Set the bar on your upper back, feet shoulder-width apart, toes slightly out.', 'Sit down and back until your thighs are parallel to the floor, knees over your toes.', 'Drive through your whole foot to stand up. Keep your chest up and core braced.'],
  pose: s => {
    const th = .12 + 1.45 * s, k = .15 + 1.85 * s;
    const y = D.ankle + .45 * Math.cos(th - k) + .45 * Math.cos(th), z = -(.45 * Math.sin(th) + .45 * Math.sin(th - k));
    const F = pitchFrame([0, y, z], .42 * th), bc = relPt(F, 0, .50, -.12);
    return { F, hand: sg => relPt(F, sg * .34, .50, -.12), ep: [.5, -1, -.3], foot: feet(.13), toe: sym(.3, 0, 1), kp: sym(.2, 0, 1), props: () => barbell(bc) };
  } };

EX.latPulldown = { name: 'Lat Pulldown', group: 'Back', target: ['back'], sec: ['biceps'], yaw: 2.6, ty: 1.2, dist: 4.8,
  phases: ['Pull the bar to your chest', 'Squeeze your back', 'Let the bar rise slowly'],
  cues: ['Sit with your thighs under the pad and grip the bar slightly wider than your shoulders.', 'Lean back a little and pull the bar to your upper chest, driving your elbows down and back.', 'Let the bar rise until your arms are fully stretched. Do not swing your body.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.05], -.18), y = lerp(1.44, .95, s), z = lerp(.05, .20, s);
    return { F, hand: sg => [sg * .50, y, z], ep: [.4, -1, -.5], foot: feet(.15, .55), kp: sym(.05, .6, 1),
      props: o => {
        const c = mid(o.arms[0].grip, o.arms[1].grip), pl = [0, 2.2, .10];
        return [...seat(), box([0, .68, .28], [.40, .09, .16], C.pad), box([0, 1.15, -.55], [.10, 2.3, .10], C.frame), box([0, 2.25, -.22], [.10, .08, .70], C.frame),
          cyl([c[0] - .6, c[1], c[2]], [c[0] + .6, c[1], c[2]], .016, C.bar), cyl([c[0] - .6, c[1], c[2]], pl, .005, C.cable), cyl([c[0] + .6, c[1], c[2]], pl, .005, C.cable)];
      } };
  } };

EX.shoulderPress = { name: 'Shoulder Press', group: 'Shoulders', target: ['shoulder'], sec: ['triceps'], yaw: -.6, ty: 1.1, dist: 4.4,
  phases: ['Press overhead', 'Lock out at the top', 'Lower to your shoulders'],
  cues: ['Sit with your back supported and the weights at shoulder height.', 'Press straight up until your arms are almost fully straight.', 'Lower under control back to shoulder height. Keep your ribs down.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.02], -.05), x = lerp(.40, .24, s), y = lerp(1.12, 1.55, s), z = lerp(.05, .02, s);
    return { F, hand: sg => [sg * x, y, z], ep: [.9, -1, 0], foot: feet(.16, .40), kp: sym(0, .4, 1), db: [1, 0, 0], props: () => [...seat(-.02), backPad(F)] };
  } };

EX.bicepCurl = { name: 'Bicep Curl', group: 'Biceps', target: ['biceps'], sec: ['forearm'], yaw: -.6, ty: 1.0, dist: 4.2,
  phases: ['Curl up', 'Squeeze at the top', 'Lower slowly'],
  cues: ['Stand tall, elbows tucked at your sides, palms facing forward.', 'Curl the weights toward your shoulders without moving your elbows.', 'Squeeze at the top, then lower slowly. Do not swing your back.'],
  pose: s => {
    const F = std(), e = lerp(.05, 2.45, s), E = sg => add(Sh(F, sg), [sg * .03, -.30, .02]);
    return { F, elbow: E, hand: sg => { const q = E(sg); return [q[0], q[1] - .27 * Math.cos(e), q[2] + .27 * Math.sin(e)]; }, foot: feet(.13), db: [1, 0, 0] };
  } };

EX.hammerCurl = { name: 'Hammer Curl', group: 'Biceps', target: ['biceps', 'forearm'], sec: [], yaw: -.6, ty: 1.0, dist: 4.2,
  phases: ['Curl up', 'Squeeze at the top', 'Lower slowly'],
  cues: ['Stand tall with the weights at your sides, palms facing each other.', 'Curl the weights up toward your shoulders without turning your wrists.', 'Lower slowly. Keep your elbows pinned to your sides.'],
  pose: s => {
    const F = std(), e = lerp(.05, 2.45, s), E = sg => add(Sh(F, sg), [sg * .03, -.30, .02]);
    return { F, elbow: E, hand: sg => { const q = E(sg); return [q[0], q[1] - .27 * Math.cos(e), q[2] + .27 * Math.sin(e)]; }, foot: feet(.13), db: [0, Math.sin(e), Math.cos(e)] };
  } };

const pushdown = (F, e) => {
  const E = sg => add(Sh(F, sg), [sg * .03, -.30, -.02]);
  return { F, elbow: E, hand: sg => { const q = E(sg); return [q[0] - sg * .07, q[1] - .27 * Math.cos(e), q[2] + .27 * Math.sin(e)]; }, foot: feet(.13),
    props: o => { const c = mid(o.arms[0].grip, o.arms[1].grip); return [cyl(add(o.arms[0].grip, [.06, 0, 0]), add(o.arms[1].grip, [-.06, 0, 0]), .015, C.bar), cyl([0, 2.12, .50], c, .005, C.cable),
      box([0, 1.06, .62], [.14, 2.12, .14], C.frame), box([0, 2.10, .55], [.14, .14, .30], C.frame)]; } };
};
EX.tricepPushdown = { name: 'Tricep Pushdown', group: 'Triceps', target: ['triceps'], sec: [], yaw: -.8, ty: 1.1, dist: 4.4,
  phases: ['Push the handle down', 'Squeeze your triceps', 'Let it rise slowly'],
  cues: ['Stand facing the cable with the bar high and your elbows tucked at your sides.', 'Push the handle down until your arms are fully straight.', 'Let it rise until your forearms are just past parallel. Keep your elbows still.'],
  pose: s => pushdown(pitchFrame([0, .96, 0], .10), lerp(1.95, .12, s)) };

EX.inclinePress = { name: 'Incline Bench Press', group: 'Chest', target: ['chest'], sec: ['shoulder', 'triceps'], yaw: -1, ty: .9, dist: 4.0,
  phases: ['Lower the bar to your upper chest', 'Pause on your chest', 'Press back up'],
  cues: ['Set the bench to 30 to 45 degrees and lie back with your feet flat.', 'Lower the bar to your upper chest with control.', 'Press back up until your arms are straight.'],
  pose: s => {
    const b = .70, F = mkFrame([0, .56, .05], [0, Math.sin(b), -Math.cos(b)], [0, Math.cos(b), Math.sin(b)]), up = lerp(.43, .36, s), fr = lerp(.55, .14, s);
    return { F, hand: sg => relPt(F, sg * .30, up, fr), ep: [.7, -.4, -.6], foot: feet(.22, .45), kp: sym(.1, 1, .4),
      props: o => [box([0, .40, .12], [.34, .10, .40], C.pad), box([0, .2, .1], [.08, .4, .08], C.frame), box(relPt(F, 0, .26, -.075), [.34, .72, .07], C.pad, F.up, F.front),
        box([-.72, .7, -.3], [.07, 1.4, .07], C.frame), box([.72, .7, -.3], [.07, 1.4, .07], C.frame), ...barbell(mid(o.arms[0].grip, o.arms[1].grip))] };
  } };

EX.pecDeck = { name: 'Pec Deck', group: 'Chest', target: ['chest'], sec: ['shoulder'], yaw: -.6, ty: 1.1, dist: 4.4,
  phases: ['Bring the pads together', 'Squeeze your chest', 'Open slowly'],
  cues: ['Sit with your back flat and your forearms on the pads, elbows level with your shoulders.', 'Bring the pads together in front of your chest and squeeze.', 'Return slowly until you feel a stretch. Do not let the weights touch down.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.03], -.10), f = rad(5 + 100 * s), E = sg => add(Sh(F, sg), [sg * Math.cos(f) * .30, 0, Math.sin(f) * .30]);
    return { F, elbow: E, hand: sg => add(E(sg), [0, .27, 0]), foot: feet(.15, .35), kp: sym(0, .4, 1),
      props: o => {
        const out = [...seat(-.02), backPad(F), box([0, 1.05, .70], [.14, 1.7, .14], C.frame)];
        o.arms.forEach(a => { const top = add(a.end, [0, .06, 0]); out.push(cyl(add(a.mid, [0, -.05, 0]), top, .052, C.pad), cyl(top, [0, top[1], .70], .02, C.frame)); });
        return out;
      } };
  } };

EX.pushUp = { name: 'Push-up', group: 'Chest', target: ['chest'], sec: ['shoulder', 'triceps', 'abs'], yaw: -1.45, ty: .5, dist: 3.4,
  phases: ['Lower your chest', 'Pause just above the floor', 'Push back up'],
  cues: ['Hands slightly wider than your shoulders, body in one straight line from head to heels.', 'Lower your chest to just above the floor, elbows at about 45 degrees.', 'Push the floor away until your arms are straight. Drop to your knees if your form breaks.'],
  pose: s => {
    const h = lerp(.60, .19, s), A = [0, .14, -.80], ph = Math.asin((h - A[1]) / 1.37), dir = [0, Math.sin(ph), Math.cos(ph)];
    const F = mkFrame(add(A, mul(dir, .895)), dir, [0, -Math.cos(ph), Math.sin(ph)]);
    return { F, flat: true, hand: sg => [sg * .22, .035, .52], ep: [.6, -.7, -.5], foot: sg => [sg * .10, .14, -.80], toe: () => [0, -.5, .866], props: () => [box([0, .01, .1], [.8, .02, 2.0], C.pad)] };
  } };

const fly = (F, s) => sg => { const S = Sh(F, sg); return add(S, mul(nrm(mix(nrm([sg * .505, .161, -.12]), nrm([-sg * .115, -.279, .33]), s)), lerp(.54, .52, s))); };
EX.highLowFly = { name: 'High to Low Fly', group: 'Chest', target: ['chest'], sec: ['shoulder'], yaw: -.5, ty: 1.15, dist: 4.8,
  phases: ['Sweep your hands down and together', 'Squeeze your chest', 'Open slowly'],
  cues: ['Set the pulleys high, stand with one foot forward and a slight bend in your elbows.', 'Bring your hands down and together in front of your lower chest in a wide arc.', 'Return slowly, keeping the same elbow bend throughout.'],
  pose: s => {
    const F = pitchFrame([0, .90, 0], .22);
    return { F, hand: fly(F, s), ep: [.2, -1, -.3], foot: sg => [sg * .12, D.ankle, sg > 0 ? .26 : -.26], kp: sym(.1, 0, 1),
      props: o => { const out = []; o.arms.forEach((a, i) => { const g = i ? -1 : 1; out.push(cyl([g * .95, 2.10, -.05], a.grip, .005, C.cable), box([g * 1.0, 1.06, -.05], [.12, 2.12, .12], C.frame), box([g * .98, 2.10, -.05], [.22, .10, .14], C.frame)); }); return out; } };
  } };

EX.pullUp = { name: 'Pull-up', group: 'Back', target: ['back'], sec: ['biceps', 'forearm'], yaw: 2.7, ty: 1.35, dist: 5.4,
  phases: ['Pull your chin over the bar', 'Hold at the top', 'Lower slowly'],
  cues: ['Hang with an overhand grip slightly wider than your shoulders and arms fully straight.', 'Pull yourself up until your chin clears the bar, leading with your chest.', 'Lower slowly to a full hang. Use an assisted machine or bands if you are still building strength.'],
  pose: s => {
    const py = lerp(1.19, 1.67, s), F = pitchFrame([0, py, -.06 * s], -.12 * s);
    return { F, hand: sg => [sg * .40, 2.18, 0], ep: [.5, -1, .3], foot: sg => [sg * .08, py - .84, -.06 * s - .18], toe: () => [0, -.85, .5], kp: sym(0, 0, 1),
      props: () => [cyl([-.62, 2.2, 0], [.62, 2.2, 0], .02, C.bar), box([-.62, 1.1, 0], [.07, 2.2, .07], C.frame), box([.62, 1.1, 0], [.07, 2.2, .07], C.frame), box([-.62, .02, 0], [.3, .04, .6], C.frame), box([.62, .02, 0], [.3, .04, .6], C.frame)] };
  } };

const row = (wide) => s => {
  const F = pitchFrame([0, .54, -.05], lerp(.28, -.12, s)), x = wide ? .28 : .07, hy = lerp(.40, .24, s), hz = lerp(wide ? .52 : .50, .14, s);
  return { F, hand: sg => relPt(F, sg * x, hy, hz), ep: wide ? [.9, -.2, -.6] : [.15, -.3, -1], foot: sg => [sg * .14, .42, .76], toe: () => [0, .9, .25], fup: () => [0, .25, -.9], kp: sym(0, 1, .2),
    props: o => { const c = mid(o.arms[0].grip, o.arms[1].grip);
      return [...seat(-.10), box([0, .45, .82], [.55, .40, .04], C.frame), box([0, .55, 1.55], [.14, 1.1, .14], C.frame), cyl([0, .50, 1.50], c, .005, C.cable),
        wide ? bar2(o, .08) : bar2(o, .02)]; } };
};
EX.seatedRow = { name: 'Seated Row', group: 'Back', target: ['back'], sec: ['biceps'], yaw: -1.3, ty: .95, dist: 4.4,
  phases: ['Pull the bar to your stomach', 'Squeeze your shoulder blades', 'Extend your arms slowly'],
  cues: ['Sit with your feet on the platform and knees slightly bent, arms straight.', 'Keep your chest up and pull the handle to your lower ribs, squeezing your shoulder blades.', 'Extend your arms slowly without rounding your back or rocking.'],
  pose: row(true) };
EX.closeGripRow = { name: 'Close Grip Row', group: 'Back', target: ['back'], sec: ['biceps'], yaw: -1.3, ty: .95, dist: 4.4,
  phases: ['Pull the handle to your stomach', 'Squeeze your back', 'Extend your arms slowly'],
  cues: ['Sit with a close-grip (V) handle, feet on the platform and knees slightly bent.', 'Keep your chest up and pull the handle to your stomach, elbows close to your body.', 'Squeeze your back, then extend your arms slowly.'],
  pose: row(false) };

EX.deadlift = { name: 'Deadlift', group: 'Back', target: ['back', 'glutes', 'hamstrings'], sec: ['quads', 'forearm'], yaw: -1.2, ty: .85, dist: 4.4,
  phases: ['Stand up with the bar', 'Lock out and squeeze your glutes', 'Lower the bar with a flat back'],
  cues: ['Feet hip-width apart, bar over mid-foot. Hinge at the hips and set a flat back with your chest up.', 'Push the floor away, keeping the bar close to your legs, until you stand tall.', 'Lower by pushing your hips back first, then bending your knees. Keep your back flat.'],
  pose: s => {
    const a = lerp(1.15, .02, s), F = pitchFrame([0, lerp(.558, .96, s), .03 - .47 * Math.sin(a)], a), S = relPt(F, 0, .47, 0);
    return { F, hand: sg => [sg * .30, S[1] - .55, S[2]], ep: [.3, -.2, -1], foot: feet(.13), kp: sym(.1, 0, 1), props: o => barbell(mid(o.arms[0].grip, o.arms[1].grip)) };
  } };

EX.tbarRow = { name: 'T-Bar Row', group: 'Back', target: ['back'], sec: ['biceps'], yaw: -1.1, ty: .8, dist: 4.4,
  phases: ['Row the handle to your chest', 'Squeeze your shoulder blades', 'Lower slowly'],
  cues: ['Straddle the bar, knees bent and torso hinged to about 45 degrees with a flat back.', 'Pull the handle toward your chest, driving your elbows back.', 'Lower slowly with control, without rounding your back.'],
  pose: s => {
    const F = pitchFrame([0, .80, -.22], .85), S = Sh(F, 1), P = [0, .06, 1.35];
    return { F, hand: sg => mix([sg * .08, S[1] - .54, S[2]], relPt(F, sg * .08, .22, .25), s), ep: [.6, -.4, -1], foot: feet(.2), kp: sym(.1, 0, 1),
      props: o => { const hm = mid(o.arms[0].grip, o.arms[1].grip), d = nrm(sub(hm, P)), E = add(hm, mul(d, .24));
        return [cyl(P, E, .022, C.bar), cyl(o.arms[0].grip, o.arms[1].grip, .015, C.bar), cyl(add(E, [-.07, 0, 0]), add(E, [-.03, 0, 0]), .16, C.plate), cyl(add(E, [.03, 0, 0]), add(E, [.07, 0, 0]), .16, C.plate), box([0, .03, 1.35], [.2, .06, .2], C.frame)]; } };
  } };

EX.preacherCurl = { name: 'Preacher Curl', group: 'Biceps', target: ['biceps'], sec: ['forearm'], yaw: -1, ty: 1.0, dist: 4.2,
  phases: ['Curl up', 'Squeeze at the top', 'Lower slowly'],
  cues: ['Sit with your upper arms flat on the pad and a weight in each hand.', 'Curl the weights up toward your shoulders and squeeze your biceps.', 'Lower slowly until your arms are almost straight, without letting the weights drop.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.28], .10), d = [0, -.707, .707], n = [0, .707, .707], e = lerp(.12, 2.45, s);
    const E = sg => add(add(Sh(F, sg), mul(d, .30)), [sg * .03, 0, 0]), S0 = Sh(F, 1);
    return { F, elbow: E, hand: sg => add(E(sg), mul(add(mul(d, Math.cos(e)), mul(n, Math.sin(e))), .27)), foot: feet(.15, .30), kp: sym(0, .5, 1), db: [1, 0, 0],
      props: () => [...seat(-.25), box(add(add([0, S0[1], S0[2]], mul(d, .28)), mul(n, -.05)), [.42, .62, .07], C.pad, d, n), box([0, .30, S0[2] + .45], [.10, .60, .10], C.frame)] };
  } };

EX.cableCurl = { name: 'Cable Curl', group: 'Biceps', target: ['biceps'], sec: ['forearm'], yaw: -.8, ty: 1.0, dist: 4.6,
  phases: ['Curl the bar up', 'Squeeze at the top', 'Lower slowly'],
  cues: ['Face the low cable with a straight bar, elbows tucked at your sides.', 'Curl the bar up toward your shoulders, keeping your upper arms still.', 'Squeeze at the top, then lower until your arms are straight.'],
  pose: s => {
    const F = std(), e = lerp(.05, 2.45, s), E = sg => add(Sh(F, sg), [sg * .03, -.30, .02]);
    return { F, elbow: E, hand: sg => { const q = E(sg); return [q[0], q[1] - .27 * Math.cos(e), q[2] + .27 * Math.sin(e)]; }, foot: feet(.13),
      props: o => [bar2(o, .06), cyl([0, .18, .90], mid(o.arms[0].grip, o.arms[1].grip), .005, C.cable), box([0, .55, .98], [.14, 1.1, .14], C.frame)] };
  } };

EX.tricepDip = { name: 'Tricep Dip', group: 'Triceps', target: ['triceps'], sec: ['chest', 'shoulder'], yaw: -1.2, ty: 1.0, dist: 4.8,
  phases: ['Lower your body', 'Pause with elbows at 90 degrees', 'Press back up'],
  cues: ['Grip the parallel bars and hold your body up with straight arms.', 'Bend your elbows to lower until they reach about 90 degrees, keeping them close to your body.', 'Press back up until your arms are straight. Do not let your shoulders shrug up.'],
  pose: s => {
    const sy = lerp(1.69, 1.50, s), a = lerp(.15, .40, s), sz = lerp(0, .05, s);
    const F = pitchFrame([0, sy - .47 * Math.cos(a), sz - .47 * Math.sin(a)], a);
    return { F, hand: sg => [sg * .30, 1.13, 0], ep: [.35, -.3, -1], foot: sg => [sg * .08, F.p[1] - .80, F.p[2] - .30], toe: () => [0, -.85, .5], kp: sym(0, 0, 1),
      props: () => { const o = []; [-1, 1].forEach(g => { o.push(cyl([g * .30, 1.11, -.35], [g * .30, 1.11, .45], .02, C.bar), box([g * .30, .55, -.33], [.06, 1.1, .06], C.frame), box([g * .30, .55, .43], [.06, 1.1, .06], C.frame)); }); return o; } };
  } };

EX.overheadExt = { name: 'Overhead Tricep Extension', group: 'Triceps', target: ['triceps'], sec: [], yaw: -.7, ty: 1.2, dist: 4.4,
  phases: ['Lower the weight behind your head', 'Stretch your triceps', 'Extend your arms'],
  cues: ['Hold one dumbbell with both hands overhead, arms straight and core tight.', 'Bend your elbows to lower the weight behind your head, upper arms close to your ears.', 'Extend your arms back to the top without flaring your elbows.'],
  pose: s => {
    const F = std(), e = lerp(.05, 2.40, s), E = sg => add(Sh(F, sg), [-sg * .06, .295, -.02]);
    const hand = sg => { const q = E(sg); return [q[0] - sg * .10, q[1] + .27 * Math.cos(e), q[2] - .27 * Math.sin(e)]; };
    return { F, elbow: E, hand, foot: feet(.13), props: o => dumbbell(mid(o.arms[0].grip, o.arms[1].grip), [0, 1, 0]) };
  } };

EX.lunges = { name: 'Lunges', group: 'Legs', target: ['quads', 'glutes'], sec: ['hamstrings', 'calf'], yaw: -1.3, ty: .85, dist: 4.4,
  phases: ['Lower straight down', 'Pause with both knees at 90 degrees', 'Drive back up'],
  cues: ['Stand tall in a split stance, a weight in each hand.', 'Lower until both knees are bent at about 90 degrees, back knee just above the floor.', 'Keep your front knee over your ankle and your torso upright. Push through your front heel to rise.'],
  pose: s => {
    const F = std(lerp(.84, .52, s), lerp(0, -.07, s)), S = Sh(F, 1);
    return { F, hand: sg => [sg * .245, S[1] - .55, S[2] + .02], ep: [.2, -1, 0], db: [0, 0, 1],
      foot: sg => sg > 0 ? [.10, D.ankle, .38] : [-.10, .13, -.52], toe: sg => sg > 0 ? [0, 0, 1] : [0, -.6, .8], kp: sg => sg > 0 ? [0, 0, 1] : [0, -.5, .9] };
  } };

EX.legPress = { name: 'Leg Press', group: 'Legs', target: ['quads', 'glutes'], sec: ['hamstrings', 'calf'], yaw: -1.4, ty: .8, dist: 4.4,
  phases: ['Lower the platform', 'Pause with knees near 90 degrees', 'Press back up'],
  cues: ['Sit with your back flat against the pad and feet shoulder-width apart in the middle of the platform.', 'Release the safety handles and lower until your knees are at about 90 degrees.', 'Press through your heels until your legs are almost straight, without locking your knees.'],
  pose: s => {
    const up = [0, .707, -.707], r = [0, .707, .707], p = [0, .42, -.35], F = mkFrame(p, up, [0, .707, .707]), d = lerp(.86, .50, s);
    return { F, hand: sg => relPt(F, sg * .34, .12, .14), ep: [.9, 0, -.5], foot: sg => add(add(p, mul(r, d)), [sg * .17, 0, 0]), toe: () => up, fup: () => mul(r, -1), kp: sg => [sg * .25, .707, -.707],
      props: () => [backPad(F), box([0, .30, -.30], [.42, .08, .45], C.pad), box(add(add(p, mul(r, d + .10)), mul(up, .12)), [.70, .70, .05], C.frame, up, r),
        cyl(add(p, [-.42, 0, 0]), add(add(p, mul(r, 1.3)), [-.42, 0, 0]), .03, C.frame), cyl(add(p, [.42, 0, 0]), add(add(p, mul(r, 1.3)), [.42, 0, 0]), .03, C.frame)] };
  } };

EX.calfRaise = { name: 'Calf Raise', group: 'Legs', target: ['calf'], sec: [], yaw: -1, ty: 1.1, dist: 4.4,
  phases: ['Rise onto your toes', 'Squeeze your calves', 'Lower slowly'],
  cues: ['Stand with the balls of your feet on a step and your heels hanging off.', 'Rise up as high as you can onto your toes and pause.', 'Lower slowly until you feel a deep stretch in your calves.'],
  pose: s => {
    const t = .65 * s, ay = .175 + .10 * Math.sin(t), F = std(ay + .893);
    return { F, hand: sg => [sg * .26, F.p[1] + .47 - .55, .02], ep: [.2, -1, 0], db: [0, 0, 1], foot: sg => [sg * .12, ay, 0], toe: () => [0, -Math.sin(t), Math.cos(t)],
      props: () => [box([0, .06, .28], [.5, .12, .6], C.pad)] };
  } };

EX.legExtension = { name: 'Leg Extension', group: 'Legs', target: ['quads'], sec: [], yaw: -1.2, ty: .8, dist: 4.0,
  phases: ['Extend your legs', 'Squeeze your quads', 'Lower slowly'],
  cues: ['Sit with your back against the pad and the roller resting on your lower shins.', 'Extend your legs until they are almost straight, squeezing your quads.', 'Lower slowly. Do not use momentum or lock your knees hard.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.12], -.18), ps = lerp(.15, 1.45, s), K = sg => [sg * .10, .56, .33];
    return { F, hand: sg => [sg * .28, .62, -.05], ep: [.8, -1, 0], knee: K, foot: sg => add(K(sg), [0, -.45 * Math.cos(ps), .45 * Math.sin(ps)]), toe: () => [0, Math.sin(ps), Math.cos(ps)], fup: () => [0, Math.cos(ps), -Math.sin(ps)], kp: () => [0, 1, .2],
      props: o => { const a = mid(o.legs[0].end, o.legs[1].end); return [...seat(-.10), backPad(F), cyl([-.22, a[1], a[2]], [.22, a[1], a[2]], .045, C.pad), cyl(a, [0, .38, .36], .02, C.frame)]; } };
  } };

EX.hamstringCurl = { name: 'Hamstring Curl', group: 'Legs', target: ['hamstrings'], sec: ['calf'], yaw: -1.25, ty: .6, dist: 3.8,
  phases: ['Curl your heels toward your glutes', 'Squeeze your hamstrings', 'Lower slowly'],
  cues: ['Lie face down with the roller just above your heels and your knees at the edge of the pad.', 'Curl your heels toward your glutes and squeeze your hamstrings.', 'Return slowly without letting your hips lift off the pad.'],
  pose: s => {
    const F = mkFrame([0, .54, 0], [0, 0, -1], [0, -1, 0]), m = sg => sg * F.left[0], ps = lerp(.08, 2.05, s), th = ps - Math.PI / 2, K = sg => [m(sg) * .10, .50, .45];
    return { F, hand: sg => [m(sg) * .25, .52, -.80], ep: [.8, 0, -.6], knee: K, foot: sg => add(K(sg), [0, .45 * Math.sin(ps), .45 * Math.cos(ps)]), toe: () => [0, Math.sin(th), Math.cos(th)], fup: () => [0, Math.cos(th), -Math.sin(th)],
      kp: () => [0, -1, 0], props: o => { const a = mid(o.legs[0].end, o.legs[1].end), r = [0, a[1] + .06, a[2]]; return [box([0, .37, .10], [.34, .12, 1.30], C.pad), cyl([-.22, r[1], r[2]], [.22, r[1], r[2]], .045, C.pad), cyl(r, [0, .48, .52], .02, C.frame)]; } };
  } };

EX.lateralRaise = { name: 'Lateral Raise', group: 'Shoulders', target: ['shoulder'], sec: [], yaw: -.4, ty: 1.1, dist: 4.4,
  phases: ['Raise to shoulder height', 'Pause at the top', 'Lower slowly'],
  cues: ['Hold the weights at your sides with a slight bend in your elbows.', 'Raise your arms out to the sides until they reach shoulder height.', 'Lower slowly. Use light weights and avoid swinging.'],
  pose: s => {
    const F = std(), u = rad(6 + 84 * s);
    return { F, hand: sg => add(Sh(F, sg), [sg * .55 * Math.sin(u), -.55 * Math.cos(u), .03]), ep: [.2, -1, -.4], db: [0, 0, 1], foot: feet(.13) };
  } };

EX.arnoldPress = { name: 'Arnold Press', group: 'Shoulders', target: ['shoulder'], sec: ['triceps'], yaw: -.5, ty: 1.1, dist: 4.4,
  phases: ['Rotate and press overhead', 'Lock out at the top', 'Reverse back down'],
  cues: ['Sit with the dumbbells at chest height, palms facing you.', 'Press the weights up while rotating your palms to face forward.', 'Finish with your arms almost straight overhead, then reverse the motion slowly.'],
  pose: s => {
    const F = pitchFrame([0, .54, -.02], -.05), w = Math.sin(Math.PI * s), ph = Math.PI * s;
    const E = sg => { const S = Sh(F, sg); return add(mix(add(S, [sg * .02, -.17, .24]), add(S, [sg * .06, .28, 0]), s), [sg * .12 * w, 0, 0]); };
    return { F, elbow: E, hand: sg => { const q = E(sg); return add(q, [-sg * lerp(.03, -.01, s) + sg * .10 * w, lerp(.26, .26, s), lerp(.06, 0, s)]); }, foot: feet(.16, .40), kp: sym(0, .4, 1), db: [Math.cos(ph), 0, Math.sin(ph)], props: () => [...seat(-.02), backPad(F)] };
  } };

EX.rearDeltFly = { name: 'Rear Delt Fly', group: 'Shoulders', target: ['shoulder', 'back'], sec: [], yaw: -.9, ty: .85, dist: 4.4,
  phases: ['Raise your arms out to the sides', 'Squeeze your rear shoulders', 'Lower slowly'],
  cues: ['Hinge forward at the hips with a flat back and a weight in each hand.', 'With a slight bend in your elbows, raise your arms out to the sides until level with your shoulders.', 'Lower slowly. Keep the weights light and your neck relaxed.'],
  pose: s => {
    const F = pitchFrame([0, .80, -.33], 1.15), u = rad(5 + 85 * s);
    return { F, hand: sg => add(Sh(F, sg), [sg * .54 * Math.sin(u), -.54 * Math.cos(u), 0]), ep: [.2, -.3, -1], db: [0, 0, 1], foot: feet(.13), kp: sym(.1, 0, 1) };
  } };

/* exercise id (from the exercises table) -> tutorial. Duplicate rows share one tutorial. */
const IDS = { 1: 'benchPress', 2: 'squat', 3: 'latPulldown', 4: 'shoulderPress', 5: 'bicepCurl', 6: 'tricepPushdown', 7: 'inclinePress', 8: 'pecDeck', 9: 'pushUp', 10: 'highLowFly',
  11: 'pullUp', 12: 'seatedRow', 13: 'deadlift', 14: 'tbarRow', 15: 'closeGripRow', 16: 'hammerCurl', 17: 'preacherCurl', 18: 'cableCurl', 19: 'tricepDip', 20: 'overheadExt',
  21: 'tricepPushdown', 22: 'lunges', 23: 'legPress', 24: 'calfRaise', 25: 'legExtension', 26: 'hamstringCurl', 27: 'lateralRaise', 28: 'shoulderPress', 29: 'arnoldPress', 30: 'rearDeltFly' };

/* ---------- body solver ---------- */
/* direction the elbow/knee point (away from the inside of the joint); falls back to the pole when the limb is straight */
function vertexDir(root, mid, end, pole) {
  const u1 = nrm(sub(mid, root)), u2 = nrm(sub(end, mid)), v = sub(u1, u2), l = len(v), w = Math.min(l / .3, 1);
  return nrm(add(l > 1e-6 ? mul(v, w / l) : [0, 0, 0], mul(nrm(pole), 1 - w)));
}
function solve(def, s) {
  const st = def.pose(s), F = st.F, lx = F.left[0], o = { F, arms: [], legs: [], miss: [] };
  [1, -1].forEach(sg => {
    const S = relPt(F, sg * D.shX, D.shY, 0), H = st.hand(sg);
    const ep = st.ep || (st.elbow ? [.15, -.6, -1] : [.3, -.6, -.3]), pole = relDir(F, sg * ep[0], ep[1], ep[2]);
    let a;
    if (st.elbow) { const m = add(S, mul(nrm(sub(st.elbow(sg), S)), D.upper)); a = { mid: m, end: add(m, mul(nrm(sub(H, m)), D.fore)), miss: 0 }; }
    else a = bend(S, H, D.upper, D.fore, pole);
    a.S = S; a.dir = nrm(sub(a.end, a.mid)); a.flat = !!st.flat;
    a.grip = add(a.end, mul(a.flat ? [0, 0, 1] : a.dir, .045));
    a.front = mul(vertexDir(S, a.mid, a.end, pole), -1);      /* biceps side */
    o.arms.push(a); o.miss.push(a.miss);
    const hip = relPt(F, sg * D.hipX, 0, 0), A = st.foot(sg), kpole = st.kp ? st.kp(sg) : [sg * lx * .12, 0, 1];
    let l;
    if (st.knee) { const m = add(hip, mul(nrm(sub(st.knee(sg), hip)), D.thigh)); l = { mid: m, end: add(m, mul(nrm(sub(A, m)), D.shin)), miss: 0 }; }
    else l = bend(hip, A, D.thigh, D.shin, kpole);
    l.hip = hip; l.toe = st.toe ? st.toe(sg) : [sg * lx * .15, 0, 1]; l.fup = st.fup ? st.fup(sg) : [0, 1, 0];
    l.front = vertexDir(hip, l.mid, l.end, kpole);            /* quad / kneecap side */
    o.legs.push(l); o.miss.push(l.miss);
  });
  o.props = st.props ? st.props(o) : [];
  if (st.db) o.arms.forEach(a => o.props.push(...dumbbell(a.grip, st.db)));
  return o;
}

/* ---------- athlete figure (Three.js) ---------- */
const SKIN = 0xd7dadc, MUSC = 0xc6cbce, RED = 0xd8382d, PINK = 0xee9a92, SHORTS = 0x1b1c1f, HAIR = 0x383c40;

function createFigure(T) {
  const meshes = [], root = new T.Group(), sph = new T.SphereGeometry(1, 18, 14);
  const m4 = new T.Matrix4(), V = a => new T.Vector3(a[0], a[1], a[2]);
  const cBase = new T.Color(), cRed = new T.Color(RED), cPink = new T.Color(PINK);
  const mk = (geo, part, col, dbl) => {
    const c = col === undefined ? SKIN : col, m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: c, roughness: .8, metalness: 0, side: dbl ? T.DoubleSide : T.FrontSide }));
    m.userData = { part, base: c }; m.castShadow = true; m.receiveShadow = true; meshes.push(m); return m;
  };
  const ell = (rx, ry, rz, x, y, z, part, col) => { const m = mk(sph, part, col === undefined ? MUSC : col); m.scale.set(rx, ry, rz); m.position.set(x, y, z); return m; };
  const lathe = (pts, part, col) => mk(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), 24), part, col, true);
  const group = (...kids) => { const g = new T.Group(); kids.forEach(k => g.add(k)); root.add(g); return g; };
  const basis = (obj, x, y, z) => { m4.makeBasis(V(x), V(y), V(z)); obj.quaternion.setFromRotationMatrix(m4); };

  /* torso: x = left, y = up from pelvis, z = chest */
  const torso = group(
    lathe([[0, 0], [.115, .01], [.122, .10], [.135, .19], [.158, .29], [.175, .39], [.165, .45], [.11, .50], [.05, .525]], 'torso'),
    lathe([[.125, -.10], [.15, -.04], [.158, .02], [.14, .075]], 'shorts', SHORTS),
    mk(new T.CylinderGeometry(.05, .056, .11, 14), 'neck'),
    mk(sph, 'head'), mk(sph, 'head'), mk(sph, 'head'), mk(new T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * .52), 'hair', HAIR));
  const [chest, shorts, neck, head, jaw, nose, hair] = torso.children;
  chest.scale.z = .66; shorts.scale.z = .78; neck.position.y = .535;
  head.scale.set(.092, .115, .10); head.position.set(0, .69, .005);
  jaw.scale.set(.063, .05, .075); jaw.position.set(0, .625, .03);
  nose.scale.set(.014, .022, .02); nose.position.set(0, .68, .1);
  hair.scale.set(.097, .12, .105); hair.position.set(0, .70, 0);
  [1, -1].forEach(g => {
    torso.add(ell(.09, .07, .052, g * .088, .355, .093, 'chest'), ell(.07, .045, .042, g * .085, .42, .08, 'chest'));
    torso.add(ell(.05, .095, .045, g * .118, .22, .03, 'abs'), ell(.083, .145, .05, g * .125, .29, -.085, 'back'));
    torso.add(ell(.075, .06, .04, g * .075, .40, -.10, 'back'), ell(.06, .075, .04, g * .05, .15, -.09, 'back'), ell(.10, .06, .065, g * .085, .485, -.005, 'back'));
    [0, 1, 2].forEach(r => torso.add(ell(.032, .03, .02, g * .034, .15 + r * .07, .095, 'abs')));
    torso.add(ell(.088, .09, .08, g * .07, -.03, -.085, 'glutes', SHORTS));
    const ear = ell(.012, .025, .018, g * .092, .69, 0, 'head', SKIN); torso.add(ear);
  });

  const arms = [1, -1].map(() => {
    const up = group(
      lathe([[.040, -.30], [.046, -.27], [.056, -.2], [.060, -.12], [.058, -.05], [.052, 0]], 'upperArm', SKIN),
      ell(.042, .09, .040, 0, -.12, .034, 'biceps'), ell(.040, .095, .038, 0, -.12, -.036, 'triceps'), ell(.076, .088, .07, 0, -.015, 0, 'shoulder'), ell(.042, .042, .042, 0, -.30, 0, 'joint', SKIN));
    const fore = group(lathe([[.029, -.27], [.036, -.2], [.045, -.10], [.047, -.04], [.041, 0]], 'forearm', SKIN), ell(.041, .09, .038, 0, -.085, .004, 'forearm'));
    const hand = group(ell(.033, .047, .017, 0, -.045, 0, 'hand', SKIN), ell(.03, .042, .013, 0, -.11, .003, 'hand', SKIN), ell(.011, .03, .012, .03, -.055, .012, 'hand', SKIN));
    return { up, fore, hand };
  });
  const legs = [1, -1].map(() => {
    const thigh = group(
      lathe([[.058, -.45], [.07, -.38], [.092, -.28], [.104, -.15], [.10, -.06], [.09, 0]], 'thigh', SKIN),
      ell(.074, .20, .06, 0, -.25, .045, 'quads'), ell(.07, .18, .055, 0, -.25, -.045, 'hamstrings'),
      mk(new T.CylinderGeometry(.113, .108, .19, 22), 'shorts', SHORTS), ell(.06, .06, .06, 0, -.45, 0, 'joint', SKIN));
    thigh.children[3].position.y = -.095;
    const shin = group(lathe([[.035, -.45], [.042, -.38], [.052, -.25], [.064, -.12], [.065, -.05], [.06, 0]], 'shin', SKIN),
      ell(.06, .125, .058, 0, -.13, -.045, 'calf'), ell(.034, .12, .032, 0, -.2, .038, 'shin'), ell(.04, .04, .04, 0, -.45, 0, 'joint', SKIN));
    const foot = group(ell(.045, .036, .12, 0, -.028, .05, 'foot', SKIN), ell(.04, .04, .045, 0, -.012, -.035, 'foot', SKIN), ell(.042, .016, .04, 0, -.044, .15, 'foot', SKIN));
    return { thigh, shin, foot };
  });

  /* equipment pools */
  const ug = new T.CylinderGeometry(1, 1, 1, 16); ug.translate(0, .5, 0);
  const bg = new T.BoxGeometry(1, 1, 1), pools = { c: [], b: [] };
  const upv = new T.Vector3(0, 1, 0);
  function drawProps(list) {
    const used = { c: 0, b: 0 };
    list.forEach(p => {
      const pool = pools[p.k], i = used[p.k]++;
      if (!pool[i]) { const m = new T.Mesh(p.k === 'c' ? ug : bg, new T.MeshStandardMaterial({ roughness: .6, metalness: .3 })); m.castShadow = true; m.receiveShadow = true; root.add(m); pool.push(m); }
      const m = pool[i]; m.visible = true; m.material.color.setHex(p.k === 'c' ? p.c : p.col);
      if (p.k === 'c') {
        const d = sub(p.b, p.a), l = len(d);
        m.position.set(p.a[0], p.a[1], p.a[2]); m.scale.set(p.r, Math.max(l, 1e-4), p.r);
        if (l > 1e-6) m.quaternion.setFromUnitVectors(upv, V(mul(d, 1 / l)));
      } else {
        const up = nrm(p.up), fr = nrm(p.front);
        m.position.set(p.c[0], p.c[1], p.c[2]); m.scale.set(p.sz[0], p.sz[1], p.sz[2]); basis(m, cross(up, fr), up, fr);
      }
    });
    ['c', 'b'].forEach(k => { for (let i = used[k]; i < pools[k].length; i++) pools[k][i].visible = false; });
  }

  /* bone group: local -y runs along the bone, local +z is the muscle-front direction */
  function bone(g, a, b, front) {
    const d = nrm(sub(b, a)); let f = sub(front, mul(d, dot(front, d)));
    if (len(f) < 1e-4) { f = cross(d, [1, 0, 0]); if (len(f) < 1e-4) f = cross(d, [0, 0, 1]); }
    f = nrm(f); const y = mul(d, -1);
    g.position.set(a[0], a[1], a[2]); basis(g, cross(y, f), y, f);
  }
  function pose(o, s, cur) {
    const F = o.F;
    torso.position.set(F.p[0], F.p[1], F.p[2]); basis(torso, F.left, F.up, F.front);
    o.arms.forEach((a, i) => {
      bone(arms[i].up, a.S, a.mid, a.front); bone(arms[i].fore, a.mid, a.end, a.front);
      if (a.flat) { const y = [0, 0, -1], z = [0, -1, 0]; arms[i].hand.position.set(a.end[0], a.end[1], a.end[2]); basis(arms[i].hand, cross(y, z), y, z); }
      else bone(arms[i].hand, a.end, add(a.end, a.dir), a.front);
    });
    o.legs.forEach((l, i) => {
      bone(legs[i].thigh, l.hip, l.mid, l.front); bone(legs[i].shin, l.mid, l.end, l.front);
      const t = nrm(l.toe), u = nrm(sub(l.fup, mul(t, dot(l.fup, t))));
      legs[i].foot.position.set(l.end[0], l.end[1], l.end[2]); basis(legs[i].foot, cross(u, t), u, t);
    });
    drawProps(o.props);
    const prim = cur.target, sec = cur.sec || [];
    meshes.forEach(m => {
      const pt = m.userData.part, c = m.material.color;
      cBase.setHex(m.userData.base);
      if (prim.indexOf(pt) !== -1) { c.copy(cBase).lerp(cRed, .72 + .28 * s); m.material.emissive.setRGB(.16 * s, .02 * s, .01 * s); }
      else if (sec.indexOf(pt) !== -1) { c.copy(cBase).lerp(cPink, .45 + .4 * s); m.material.emissive.setRGB(0, 0, 0); }
      else { c.copy(cBase); m.material.emissive.setRGB(0, 0, 0); }
    });
  }
  return { root, pose, meshes };
}

/* ---------- popup + renderer (browser only) ---------- */
let R = null, ui = null, cur = null, raf = 0, running = false, playing = true, slow = false, tm = 0, last = 0, lastPhase = '', opener = null;
let yaw = 0, tYaw = 0, tgt = [0, 1, 0], tTgt = [0, 1, 0], dist = 4.4, tDist = 4.4;
const CYC = 4.4;
const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ease(x) { return x * x * (3 - 2 * x); }
function rep(p) { return p < .4 ? ease(p / .4) : p < .5 ? 1 : p < .9 ? 1 - ease((p - .5) / .4) : 0; }

function css() {
  const st = document.createElement('style');
  st.textContent = `
.ftt-scrim{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,7,9,.62);z-index:2000}
.ftt-scrim[hidden]{display:none}
.ftt-sheet{width:min(460px,100%);max-height:100%;overflow-y:auto;background:var(--surface,#1b2023);border:1px solid var(--line,#30383b);border-radius:var(--radius-lg,1.25rem);box-shadow:0 24px 60px rgba(0,0,0,.55);color:var(--ink,#f4f7f5);font-family:inherit}
.ftt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 16px 8px 20px}
.ftt-title{margin:0;font-size:1.25rem;font-weight:800;color:var(--brand-lime,#c6f135);letter-spacing:-.02em}
.ftt-group{color:var(--muted,#9ca8a5);font-size:.82rem}
.ftt-x{font:inherit;font-size:22px;line-height:1;width:36px;height:36px;border-radius:.7rem;border:1px solid var(--line,#30383b);background:transparent;color:var(--ink,#f4f7f5);cursor:pointer}
.ftt-x:hover{border-color:var(--brand-lime,#c6f135);color:var(--brand-lime,#c6f135)}
.ftt-stage{position:relative;height:min(340px,48vh);margin:0 12px;border-radius:.9rem;background:radial-gradient(300px 240px at 50% 45%,#ffffff,#e3e7e9);touch-action:pan-y;cursor:grab;overflow:hidden}
.ftt-stage:active{cursor:grabbing}.ftt-stage canvas{display:block;width:100%;height:100%}
.ftt-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#4a545a;font-size:.9rem}
.ftt-legend{position:absolute;left:10px;bottom:8px;font-size:.75rem;color:#4a545a;display:flex;align-items:center;gap:6px;pointer-events:none}
.ftt-legend i{width:10px;height:10px;border-radius:50%;background:#d8382d;display:inline-block}
.ftt-legend i+span+i{margin-left:8px;background:#ee9a92}
.ftt-phase{margin:12px 20px 4px;font-weight:700;font-size:1rem;min-height:24px;color:var(--ink,#f4f7f5)}
.ftt-controls{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;padding:8px 20px 0}
.ftt-seg{display:inline-flex;border:1px solid var(--line,#30383b);border-radius:.6rem;overflow:hidden}
.ftt-seg button{font:inherit;font-size:.8rem;font-weight:600;padding:7px 12px;border:0;background:transparent;color:var(--muted,#9ca8a5);cursor:pointer}
.ftt-seg button+button{border-left:1px solid var(--line,#30383b)}
.ftt-seg button[aria-pressed=true]{background:var(--surface-hover,#242c2f);color:var(--ink,#f4f7f5)}
.ftt-row{display:inline-flex;gap:8px}
.ftt-btn{font:inherit;font-size:.8rem;font-weight:700;padding:7px 12px;border-radius:.6rem;border:1px solid var(--line-light,#465154);background:transparent;color:var(--ink-soft,#b5c0bd);cursor:pointer}
.ftt-btn:hover,.ftt-btn[aria-pressed=true]{border-color:var(--brand-lime,#c6f135);color:var(--brand-lime,#c6f135)}
.ftt-scrub{display:block;width:calc(100% - 40px);margin:12px 20px 0;accent-color:var(--brand-lime,#c6f135)}
.ftt-cues{margin:12px 20px 20px;padding-left:20px;color:var(--ink-soft,#b5c0bd);font-size:.9rem}
.ftt-cues li{margin-bottom:4px}
.ftt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ftt-sheet :focus-visible{outline:2px solid var(--brand-lime,#c6f135);outline-offset:2px}`;
  document.head.appendChild(st);
}

function buildUI() {
  css();
  const el = document.createElement('div');
  el.className = 'ftt-scrim'; el.hidden = true;
  el.innerHTML = `<div class="ftt-sheet" role="dialog" aria-modal="true" aria-labelledby="ftt-name">
  <div class="ftt-head"><div><h3 class="ftt-title" id="ftt-name"></h3><div class="ftt-group"></div></div><button type="button" class="ftt-x" aria-label="Close tutorial">&times;</button></div>
  <div class="ftt-stage" tabindex="0" aria-label="3D athlete demonstrating the exercise. Drag or use the left and right arrow keys to rotate the view."><div class="ftt-legend"><i></i><span>Working muscle</span><i></i><span>Assisting</span></div></div>
  <p class="ftt-phase"></p>
  <div class="ftt-controls">
    <div class="ftt-seg" role="group" aria-label="Camera angle"><button type="button" data-v="0" aria-pressed="false">Front</button><button type="button" data-v="1" aria-pressed="false">Side</button><button type="button" data-v="2" aria-pressed="false">Back</button></div>
    <div class="ftt-row"><button type="button" class="ftt-btn" data-a="play">Pause</button><button type="button" class="ftt-btn" data-a="slow" aria-pressed="false">Slow motion</button></div>
  </div>
  <label class="ftt-sr" for="ftt-scrub">Position in the repetition</label>
  <input class="ftt-scrub" id="ftt-scrub" type="range" min="0" max="1000" value="0">
  <ol class="ftt-cues"></ol></div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s);
  ui = { el, sheet: q('.ftt-sheet'), name: q('.ftt-title'), group: q('.ftt-group'), x: q('.ftt-x'), stage: q('.ftt-stage'), phase: q('.ftt-phase'), cues: q('.ftt-cues'),
    play: q('[data-a=play]'), slow: q('[data-a=slow]'), scrub: q('.ftt-scrub'), views: Array.from(el.querySelectorAll('[data-v]')) };

  const setPlay = v => { playing = v; ui.play.textContent = v ? 'Pause' : 'Play'; };
  ui.play.onclick = () => setPlay(!playing);
  ui.slow.onclick = () => { slow = !slow; ui.slow.setAttribute('aria-pressed', String(slow)); };
  ui.scrub.oninput = () => { setPlay(false); tm = ui.scrub.value / 1000 * CYC; };
  ui.setPlay = setPlay;
  const clearViews = () => ui.views.forEach(b => b.setAttribute('aria-pressed', 'false'));
  ui.views.forEach((b, i) => b.onclick = () => {
    const A = [0, -Math.PI / 2, Math.PI][i];
    tYaw = A + 2 * Math.PI * Math.round((tYaw - A) / (2 * Math.PI));
    clearViews(); b.setAttribute('aria-pressed', 'true');
  });
  let drag = false, lx = 0;
  ui.stage.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; try { ui.stage.setPointerCapture(e.pointerId); } catch (_) {} });
  ui.stage.addEventListener('pointermove', e => { if (!drag) return; tYaw -= (e.clientX - lx) * .012; lx = e.clientX; clearViews(); });
  ['pointerup', 'pointercancel'].forEach(n => ui.stage.addEventListener(n, () => { drag = false; }));
  ui.stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { tYaw += .25; clearViews(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { tYaw -= .25; clearViews(); e.preventDefault(); }
  });
  ui.x.onclick = close;
  el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
  document.addEventListener('keydown', e => {
    if (el.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      const f = ui.sheet.querySelectorAll('button,input,[tabindex="0"]'), a = f[0], b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { b.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === b) { a.focus(); e.preventDefault(); }
    }
  });
}

function buildScene() {
  const T = root.THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { const f = document.createElement('div'); f.className = 'ftt-fallback'; f.textContent = 'The 3D view is not supported on this device. Use the written steps below.'; ui.stage.appendChild(f); return false; }
  renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  ui.stage.insertBefore(renderer.domElement, ui.stage.firstChild);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, .1, 60);
  scene.add(new T.HemisphereLight(0xffffff, 0xb4bcc0, .85));
  const key = new T.DirectionalLight(0xffffff, .85); key.position.set(2.2, 5, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  const sc = key.shadow.camera; sc.left = -2.6; sc.right = 2.6; sc.top = 3; sc.bottom = -1.4; sc.near = .5; sc.far = 14;
  scene.add(key);
  const fill = new T.DirectionalLight(0xffffff, .4); fill.position.set(-3, 2.5, -2.5); scene.add(fill);
  const disc = new T.Mesh(new T.CircleGeometry(1.8, 56), new T.MeshStandardMaterial({ color: 0xe2e6e8, roughness: 1 })); disc.rotation.x = -Math.PI / 2; disc.position.y = -.003; disc.receiveShadow = true; scene.add(disc);
  const ground = new T.Mesh(new T.CircleGeometry(4, 48), new T.ShadowMaterial({ opacity: .24 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const fig = createFigure(T); scene.add(fig.root);
  R = { renderer, scene, camera, fig };
  if (root.ResizeObserver) new ResizeObserver(resize).observe(ui.stage);
  root.addEventListener('resize', resize);
  resize();
  return true;
}

function resize() {
  if (!R) return;
  const w = ui.stage.clientWidth, h = ui.stage.clientHeight;
  if (!w || !h) return;
  R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
}

function frame(now) {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (playing) tm += dt * (slow ? .5 : 1);
  const p = (tm / CYC) % 1, s = rep(p);
  R.fig.pose(solve(cur, s), s, cur);
  yaw += (tYaw - yaw) * .14; dist += (tDist - dist) * .12;
  for (let i = 0; i < 3; i++) tgt[i] += (tTgt[i] - tgt[i]) * .12;
  const cp = .16;
  R.camera.position.set(tgt[0] + dist * Math.sin(yaw) * Math.cos(cp), tgt[1] + dist * Math.sin(cp), tgt[2] + dist * Math.cos(yaw) * Math.cos(cp));
  R.camera.lookAt(tgt[0], tgt[1], tgt[2]);
  const txt = p < .4 ? cur.phases[0] : p < .5 ? cur.phases[1] : p < .9 ? cur.phases[2] : 'Reset';
  if (txt !== lastPhase) { ui.phase.textContent = txt; lastPhase = txt; }
  if (playing) ui.scrub.value = Math.round(p * 1000);
  R.renderer.render(R.scene, R.camera);
}

function open(id, trigger) {
  const def = EX[IDS[id]];
  if (!def) return;
  if (!ui) buildUI();
  Array.from(ui.stage.querySelectorAll('.ftt-fallback')).forEach(n => n.remove());
  cur = def; opener = trigger || null;
  ui.name.textContent = def.name; ui.group.textContent = def.group;
  ui.cues.innerHTML = ''; def.cues.forEach(c => { const li = document.createElement('li'); li.textContent = c; ui.cues.appendChild(li); });
  ui.el.hidden = false; document.body.style.overflow = 'hidden';
  if (!R && !(root.THREE && buildScene())) {
    if (!root.THREE) { const f = document.createElement('div'); f.className = 'ftt-fallback'; f.textContent = 'The 3D library could not be loaded. Check your internet connection.'; ui.stage.appendChild(f); }
    ui.x.focus(); return;
  }
  resize();
  tm = 0; lastPhase = ''; ui.scrub.value = 0; ui.setPlay(!reduced());
  yaw = tYaw = def.yaw; tgt = [0, def.ty, 0]; tTgt = tgt.slice(); dist = tDist = def.dist;
  ui.views.forEach(b => b.setAttribute('aria-pressed', 'false'));
  cancelAnimationFrame(raf); running = true; last = performance.now(); raf = requestAnimationFrame(frame); ui.x.focus();
}
function close() {
  running = false; cancelAnimationFrame(raf);
  if (ui) { ui.el.hidden = true; document.body.style.overflow = ''; }
  if (opener && opener.focus) opener.focus();
}

root.FitTrackTutorial = { has: id => !!EX[IDS[id]], open, close, _solve: (id, s) => solve(EX[IDS[id]], s), _ids: IDS, _ex: EX, _createFigure: createFigure };
})(typeof window !== 'undefined' ? window : globalThis);