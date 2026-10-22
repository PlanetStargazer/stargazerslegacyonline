// Vector art for the beasts and lesser monsters: giant rat, kobold, giant bat, goblin, giant snake, wolf, headless, roper
// and the harmless wildlife (deer, antelope, hare, mountain goat). drawMonsterVectorOnContext() in game.js hands the
// shape name to EXTRA_MONSTER_ART; every painter draws into a 0..1 box scaled by s (the ground shadow is already down).

const EXTRA_MONSTER_ART = {
    wisp(ctx, s, t, lw, O) {                                   // a flock of three cold lights
        [[.3, .5, .9, 0], [.66, .42, 1.1, 2], [.5, .7, .75, 4]].forEach(([x, y, k, ph]) => {
            const bob = Math.sin(t * .09 + ph) * s * .04, cx = s * x + Math.sin(t * .05 + ph * 1.3) * s * .03, cy = s * y + bob, r = s * .12 * k;
            vgGlow(ctx, cx, cy, r * 2.6, '165,243,252', .55);
            vgPoly(ctx, s, [[x - .045 * k, y + .02], [x, y - .17 * k + (bob / s)], [x + .045 * k, y + .02]], 'rgba(165,243,252,.6)', null);          // a tail of flame
            vgBall(ctx, cx, cy, r, '#ecfeff', '#67e8f9', null);
            vgEll(ctx, cx - r * .3, cy - r * .1, r * .14, r * .2, '#0e7490'); vgEll(ctx, cx + r * .3, cy - r * .1, r * .14, r * .2, '#0e7490');
            vgEll(ctx, cx, cy + r * .35, r * .22, r * .12, '#0e7490');
        });
    },
    rat(ctx, s, t, lw, O) {
        vgPath(ctx, s, [[.22, .78], [.12, .70], [.08, .58], [.14, .50]], '#d4a5a5', s * .028);                       // tail
        vgEll(ctx, s * .48, s * .70, s * .26, s * .15, vgLin(ctx, 0, s * .55, 0, s * .85, [[0, '#8b7d6b'], [1, '#4a4036']]), O, lw);
        vgPoly(ctx, s, [[.66, .62], [.84, .68], [.80, .78], [.66, .80]], '#9a8a76', O, lw);                              // head
        vgPoly(ctx, s, [[.80, .68], [.90, .72], [.80, .76]], '#e8b4b4', O, lw * .7);                                     // snout
        vgBall(ctx, s * .70, s * .58, s * .06, '#e8b4b4', '#a56a6a', O, lw * .8);                                        // ear
        vgEll(ctx, s * .76, s * .66, s * .018, s * .018, '#ef4444');
        [[.40, .84], [.58, .84]].forEach(([x, y]) => vgPoly(ctx, s, [[x - .03, y - .06], [x + .05, y - .06], [x + .06, y + .05], [x - .04, y + .05]], '#6b5b4b', O, lw * .8));
        vgPath(ctx, s, [[.84, .72], [.95, .68]], 'rgba(255,255,255,.7)', lw * .5); vgPath(ctx, s, [[.84, .74], [.95, .76]], 'rgba(255,255,255,.7)', lw * .5);
        vgPoly(ctx, s, [[.78, .77], [.80, .83], [.82, .77]], '#fffbeb', null);                                           // fang
    },
    kobold(ctx, s, t, lw, O) {
        vgPoly(ctx, s, [[.40, .72], [.60, .72], [.62, .92], [.52, .92], [.50, .82], [.48, .92], [.38, .92]], '#92400e', O, lw);          // legs
        vgPath(ctx, s, [[.40, .78], [.22, .86], [.14, .80]], '#b45309', s * .035);                                                       // tail
        vgPoly(ctx, s, [[.34, .46], [.66, .46], [.64, .74], [.36, .74]], vgLin(ctx, 0, s * .46, 0, s * .74, [[0, '#b45309'], [1, '#78350f']]), O, lw);
        vgPoly(ctx, s, [[.34, .66], [.66, .66], [.68, .78], [.32, .78]], '#57534e', O, lw * .8);                                         // rags
        vgPoly(ctx, s, [[.34, .50], [.24, .60], [.28, .68], [.36, .62]], '#c2410c', O, lw);
        vgPoly(ctx, s, [[.66, .50], [.76, .56], [.74, .64], [.64, .60]], '#c2410c', O, lw);
        vgPath(ctx, s, [[.75, .60], [.88, .36]], '#a16207', s * .03); vgPoly(ctx, s, [[.86, .40], [.92, .30], [.92, .40]], '#cbd5e1', O, lw * .7);  // spear
        vgBall(ctx, s * .5, s * .34, s * .14, '#c2410c', '#7c2d12', O, lw);                                                              // head
        vgPoly(ctx, s, [[.54, .34], [.74, .38], [.72, .46], [.54, .44]], '#d9631a', O, lw);                                              // snout
        vgPoly(ctx, s, [[.40, .24], [.44, .10], [.48, .22]], '#7c2d12', O, lw * .8); vgPoly(ctx, s, [[.48, .22], [.52, .08], [.56, .22]], '#7c2d12', O, lw * .8);
        vgPoly(ctx, s, [[.38, .28], [.28, .22], [.38, .34]], '#c2410c', O, lw * .8);
        vgEyes(ctx, s * .5, s * .32, s * .05, s * .016, '#fde047');
        vgPoly(ctx, s, [[.62, .44], [.64, .50], [.66, .44]], '#fffbeb', null);
    },
    bat(ctx, s, t, lw, O) {
        const f = Math.sin(t * .22) * .1;
        const wing = (sg) => vgPoly(ctx, s, [[.5 + sg * .06, .40], [.5 + sg * .22, .22 - f], [.5 + sg * .44, .16 - f], [.5 + sg * .38, .30 - f * .5], [.5 + sg * .42, .42], [.5 + sg * .30, .40], [.5 + sg * .26, .52], [.5 + sg * .16, .46], [.5 + sg * .08, .56]], vgLin(ctx, s * .5, 0, s * (.5 + sg * .44), 0, [[0, '#4c1d95'], [1, '#1e1b4b']]), O, lw);
        wing(-1); wing(1);
        vgEll(ctx, s * .5, s * .52, s * .09, s * .14, '#3b0764', O, lw);
        vgBall(ctx, s * .5, s * .38, s * .09, '#4c1d95', '#2e1065', O, lw);
        vgPoly(ctx, s, [[.43, .34], [.40, .22], [.48, .30]], '#4c1d95', O, lw * .8); vgPoly(ctx, s, [[.57, .34], [.60, .22], [.52, .30]], '#4c1d95', O, lw * .8);
        vgEyes(ctx, s * .5, s * .38, s * .035, s * .014, '#ef4444');
        vgPoly(ctx, s, [[.47, .43], [.48, .48], [.49, .43]], '#fffbeb', null); vgPoly(ctx, s, [[.51, .43], [.52, .48], [.53, .43]], '#fffbeb', null);
    },
    goblin(ctx, s, t, lw, O) {
        vgPoly(ctx, s, [[.40, .70], [.49, .70], [.48, .92], [.38, .92]], '#3f6212', O, lw); vgPoly(ctx, s, [[.51, .70], [.60, .70], [.63, .92], [.52, .92]], '#3f6212', O, lw);
        vgPoly(ctx, s, [[.34, .44], [.66, .44], [.64, .72], [.36, .72]], '#78350f', O, lw);                                                // leather tunic
        vgPath(ctx, s, [[.38, .52], [.62, .52]], '#451a03', lw); vgPath(ctx, s, [[.38, .62], [.62, .62]], '#451a03', lw);
        vgPoly(ctx, s, [[.34, .48], [.22, .58], [.26, .68], [.36, .62]], '#65a30d', O, lw);
        vgPoly(ctx, s, [[.66, .48], [.78, .52], [.80, .64], [.68, .62]], '#65a30d', O, lw);
        vgPath(ctx, s, [[.80, .62], [.90, .30]], '#9ca3af', s * .035); vgPath(ctx, s, [[.90, .30], [.94, .22]], '#e5e7eb', s * .03);          // curved blade
        vgPoly(ctx, s, [[.30, .28], [.10, .18], [.14, .36], [.34, .36]], '#84cc16', O, lw);                                                // ears
        vgPoly(ctx, s, [[.70, .28], [.90, .18], [.86, .36], [.66, .36]], '#84cc16', O, lw);
        vgBall(ctx, s * .5, s * .32, s * .15, '#84cc16', '#3f6212', O, lw);
        vgPoly(ctx, s, [[.47, .32], [.50, .44], [.54, .34]], '#65a30d', O, lw * .7);                                                       // nose
        vgEyes(ctx, s * .5, s * .30, s * .055, s * .018, '#fde047');
        vgPath(ctx, s, [[.42, .40], [.50, .43], [.58, .40]], '#1c1917', lw * .8); vgPoly(ctx, s, [[.44, .41], [.46, .46], [.48, .42]], '#fffbeb', null);
    },
    snake(ctx, s, t, lw, O) {
        const sw = Math.sin(t * .1) * .015;
        // coiled body
        vgEll(ctx, s * .5, s * .84, s * .34, s * .09, '#166534', O, lw);
        vgEll(ctx, s * .5, s * .76, s * .27, s * .08, '#15803d', O, lw);
        vgEll(ctx, s * .5, s * .68, s * .20, s * .07, '#16a34a', O, lw);
        for (let i = 0; i < 6; i++) { vgEll(ctx, s * (.28 + i * .088), s * (.84 + (i % 2) * .004), s * .02, s * .03, '#facc15', null); }
        // the raised neck and head
        vgPath(ctx, s, [[.56, .66], [.62, .50 + sw], [.52, .36], [.46, .28]], '#15803d', s * .11);
        vgPath(ctx, s, [[.56, .66], [.62, .50 + sw], [.52, .36], [.46, .28]], '#22c55e', s * .06);
        vgPoly(ctx, s, [[.36, .22], [.52, .18], [.60, .26], [.52, .32], [.38, .30]], '#15803d', O, lw);
        vgEyes(ctx, s * .5, s * .24, s * .04, s * .014, '#fde047');
        vgPath(ctx, s, [[.38, .28], [.28, .30], [.24, .26]], '#ef4444', lw * .8); vgPath(ctx, s, [[.28, .30], [.24, .34]], '#ef4444', lw * .8);   // tongue
        vgPoly(ctx, s, [[.40, .29], [.41, .34], [.43, .29]], '#fffbeb', null);
    },
    wolf(ctx, s, t, lw, O) {
        vgPath(ctx, s, [[.18, .56], [.08, .50], [.06, .62]], '#78716c', s * .07);                                                         // tail
        vgEll(ctx, s * .46, s * .58, s * .30, s * .15, vgLin(ctx, 0, s * .43, 0, s * .73, [[0, '#a8a29e'], [1, '#57534e']]), O, lw);
        vgEll(ctx, s * .66, s * .54, s * .13, s * .15, '#8c857f', O, lw);                                                                 // shoulder
        [[.32, .86], [.42, .88], [.60, .86], [.70, .88]].forEach(([x, y], i) => vgPoly(ctx, s, [[x - .03, y - .22], [x + .04, y - .22], [x + .05, y + .05], [x - .03, y + .05]], i % 2 ? '#78716c' : '#57534e', O, lw * .8));
        vgPoly(ctx, s, [[.70, .42], [.84, .34], [.96, .44], [.86, .54], [.72, .56]], '#9a948e', O, lw);                                   // head
        vgPoly(ctx, s, [[.88, .40], [.99, .46], [.88, .52]], '#6b665f', O, lw * .8);
        vgPoly(ctx, s, [[.72, .38], [.74, .24], [.80, .36]], '#78716c', O, lw * .8);                                                       // ear
        vgEll(ctx, s * .83, s * .43, s * .016, s * .016, '#fde047');
        vgPoly(ctx, s, [[.90, .50], [.91, .55], [.93, .50]], '#fffbeb', null);
        vgPath(ctx, s, [[.40, .50], [.52, .52]], 'rgba(255,255,255,.25)', lw);
    },
    headless(ctx, s, t, lw, O) {
        vgPoly(ctx, s, [[.38, .70], [.48, .70], [.47, .93], [.35, .93]], '#92400e', O, lw); vgPoly(ctx, s, [[.52, .70], [.62, .70], [.65, .93], [.53, .93]], '#92400e', O, lw);
        vgPoly(ctx, s, [[.28, .28], [.72, .28], [.68, .72], [.32, .72]], vgLin(ctx, 0, s * .28, 0, s * .72, [[0, '#d6a77a'], [1, '#a16f46']]), O, lw);
        vgPoly(ctx, s, [[.32, .60], [.68, .60], [.70, .74], [.30, .74]], '#57534e', O, lw * .8);
        vgPoly(ctx, s, [[.28, .32], [.14, .46], [.16, .64], [.28, .56]], '#c08f62', O, lw); vgPoly(ctx, s, [[.72, .32], [.88, .40], [.86, .58], [.72, .54]], '#c08f62', O, lw);
        vgPath(ctx, s, [[.86, .56], [.90, .22]], '#78350f', s * .05); vgBall(ctx, s * .90, s * .20, s * .08, '#a16207', '#451a03', O, lw);      // club
        // the face is in the chest: eyes, a nose ridge and a wide toothed mouth
        vgGlow(ctx, s * .5, s * .46, s * .2, '239,68,68', .25);
        vgEyes(ctx, s * .5, s * .40, s * .09, s * .028, '#fef3c7'); vgEyes(ctx, s * .5, s * .40, s * .09, s * .012, '#7f1d1d');
        vgPath(ctx, s, [[.5, .42], [.48, .49], [.52, .49]], '#7c4a2a', lw);
        vgEll(ctx, s * .5, s * .56, s * .12, s * .045, '#1c0a05', O, lw * .8);
        for (let i = 0; i < 5; i++) vgPoly(ctx, s, [[.40 + i * .05, .535], [.425 + i * .05, .56], [.45 + i * .05, .535]], '#fffbeb', null);
        vgPoly(ctx, s, [[.40, .26], [.60, .26], [.58, .30], [.42, .30]], '#8b5a3a', O, lw * .7);                                         // the stump of the neck
    },
    roper(ctx, s, t, lw, O) {
        const w = Math.sin(t * .08);
        // tentacle strands reaching out of the mire
        [[-.32, .56, .1], [-.22, .40, -.1], [.30, .54, -.1], [.22, .38, .1], [-.40, .72, .0], [.40, .72, .0]].forEach(([dx, dy, sw], i) => {
            vgPath(ctx, s, [[.5 + dx * .3, .78], [.5 + dx * .8, dy + w * .03 * (i % 2 ? 1 : -1)], [.5 + dx + sw, dy - .12 + w * .04]], '#4d5b27', s * .035);
            vgEll(ctx, s * (.5 + dx + sw), s * (dy - .12 + w * .04), s * .02, s * .02, '#a3b34c');
        });
        vgPoly(ctx, s, [[.28, .88], [.34, .52], [.42, .26], [.50, .12], [.58, .26], [.66, .52], [.72, .88]], vgLin(ctx, s * .28, 0, s * .72, 0, [[0, '#7c8a3c'], [.5, '#a3b34c'], [1, '#4d5b27']]), O, lw);   // the stalagmite body
        vgPath(ctx, s, [[.40, .70], [.42, .40]], 'rgba(30,40,10,.4)', lw); vgPath(ctx, s, [[.60, .72], [.58, .44]], 'rgba(30,40,10,.4)', lw);
        vgBall(ctx, s * .5, s * .38, s * .1, '#fef9c3', '#a16207', O, lw);                                                                // the great eye
        vgBall(ctx, s * .5, s * .38, s * .045, '#7f1d1d', '#1c0a05', null, 0);
        vgEll(ctx, s * .5, s * .56, s * .09, s * .04, '#1c0a05', O, lw * .8);
        for (let i = 0; i < 4; i++) vgPoly(ctx, s, [[.44 + i * .04, .54], [.46 + i * .04, .575], [.48 + i * .04, .54]], '#fffbeb', null);
    },
    deer(ctx, s, t, lw, O) {
        vgEll(ctx, s * .46, s * .56, s * .26, s * .13, vgLin(ctx, 0, s * .43, 0, s * .69, [[0, '#b97a45'], [1, '#8a5a2b']]), O, lw);
        vgEll(ctx, s * .46, s * .64, s * .2, s * .05, '#f1e3cd', null);
        [[.30, .84], [.38, .86], [.56, .84], [.64, .86]].forEach(([x, y], i) => vgPoly(ctx, s, [[x - .02, y - .2], [x + .03, y - .2], [x + .035, y + .06], [x - .015, y + .06]], i % 2 ? '#8a5a2b' : '#6b4423', O, lw * .8));
        vgPath(ctx, s, [[.64, .50], [.74, .34]], '#a56a38', s * .09);                                                                     // neck
        vgPoly(ctx, s, [[.68, .28], [.82, .26], [.92, .36], [.82, .42], [.70, .40]], '#b97a45', O, lw);                                    // head
        vgEll(ctx, s * .90, s * .35, s * .022, s * .022, '#1c1917'); vgEll(ctx, s * .78, s * .31, s * .016, s * .016, '#1c1917');
        vgPoly(ctx, s, [[.70, .28], [.66, .20], [.74, .26]], '#8a5a2b', O, lw * .7);
        vgPath(ctx, s, [[.74, .26], [.70, .12], [.64, .06]], '#e7d3a8', lw * 1.3); vgPath(ctx, s, [[.70, .12], [.76, .06]], '#e7d3a8', lw * 1.3); vgPath(ctx, s, [[.78, .26], [.80, .12], [.86, .08]], '#e7d3a8', lw * 1.3);   // antlers
        vgPoly(ctx, s, [[.20, .50], [.14, .46], [.18, .58]], '#fffbeb', O, lw * .6);
        [[.40, .52], [.50, .48], [.34, .60]].forEach(([x, y]) => vgEll(ctx, x * s, y * s, s * .014, s * .014, '#f5e6c8'));
    },
    antelope(ctx, s, t, lw, O) {
        vgEll(ctx, s * .46, s * .56, s * .25, s * .115, vgLin(ctx, 0, s * .44, 0, s * .68, [[0, '#d6a85e'], [1, '#a67a3a']]), O, lw);
        vgEll(ctx, s * .46, s * .62, s * .22, s * .035, '#f8f1de', null);
        [[.30, .84], [.38, .86], [.56, .84], [.64, .86]].forEach(([x, y], i) => vgPoly(ctx, s, [[x - .015, y - .2], [x + .025, y - .2], [x + .03, y + .06], [x - .01, y + .06]], i % 2 ? '#9a6f31' : '#7c5a28', O, lw * .8));
        vgPath(ctx, s, [[.62, .50], [.74, .30]], '#c79a4e', s * .08);
        vgPoly(ctx, s, [[.68, .22], [.80, .20], [.92, .30], [.84, .38], [.70, .34]], '#d6a85e', O, lw);
        vgPath(ctx, s, [[.74, .24], [.66, .02]], '#3b2f1e', s * .022); vgPath(ctx, s, [[.78, .24], [.74, .00]], '#3b2f1e', s * .022);        // long straight horns
        vgEll(ctx, s * .90, s * .30, s * .02, s * .02, '#1c1917'); vgEll(ctx, s * .78, s * .27, s * .016, s * .016, '#1c1917');
        vgPath(ctx, s, [[.20, .52], [.12, .44]], '#3b2f1e', s * .03);
    },
    hare(ctx, s, t, lw, O) {
        const tw = Math.sin(t * .1) * .01;
        vgEll(ctx, s * .5, s * .72, s * .24, s * .17, vgLin(ctx, 0, s * .55, 0, s * .89, [[0, '#b8a58a'], [1, '#8a7a62']]), O, lw);
        vgBall(ctx, s * .26, s * .70, s * .06, '#f8f1de', '#d4c8b0', O, lw * .8);                                                         // tail
        vgBall(ctx, s * .66, s * .56, s * .12, '#c0ae92', '#8a7a62', O, lw);
        vgEll(ctx, s * .66, s * .30 - tw * s, s * .04, s * .15, '#c0ae92', O, lw, -.15); vgEll(ctx, s * .74, s * .31 + tw * s, s * .04, s * .15, '#b8a58a', O, lw, .12);
        vgEll(ctx, s * .66, s * .31, s * .018, s * .1, '#f1c9c9', null, 0, -.15);
        vgEll(ctx, s * .72, s * .55, s * .02, s * .02, '#1c1917'); vgEll(ctx, s * .77, s * .60, s * .016, s * .016, '#f1c9c9');
        vgEll(ctx, s * .40, s * .86, s * .12, s * .04, '#8a7a62', O, lw * .8);
    },
    goat(ctx, s, t, lw, O) {
        vgEll(ctx, s * .46, s * .58, s * .25, s * .13, vgLin(ctx, 0, s * .45, 0, s * .71, [[0, '#f5f5f4'], [1, '#c7c2bb']]), O, lw);
        [[.32, .86], [.40, .88], [.56, .86], [.64, .88]].forEach(([x, y], i) => vgPoly(ctx, s, [[x - .025, y - .2], [x + .035, y - .2], [x + .04, y + .05], [x - .02, y + .05]], i % 2 ? '#d6d3cd' : '#a8a29e', O, lw * .8));
        vgPath(ctx, s, [[.64, .52], [.74, .38]], '#e7e5e4', s * .1);
        vgPoly(ctx, s, [[.68, .30], [.82, .28], [.90, .38], [.80, .46], [.70, .42]], '#f5f5f4', O, lw);
        vgPath(ctx, s, [[.72, .30], [.66, .14], [.74, .06]], '#6b5a3a', s * .035); vgPath(ctx, s, [[.78, .29], [.80, .14], [.88, .10]], '#6b5a3a', s * .03);   // curved horns
        vgPoly(ctx, s, [[.82, .44], [.84, .58], [.88, .44]], '#d6d3cd', O, lw * .7);                                                      // beard
        vgEll(ctx, s * .84, s * .35, s * .018, s * .018, '#1c1917'); vgEll(ctx, s * .78, s * .33, s * .014, s * .014, '#fbbf24');
        vgPoly(ctx, s, [[.22, .52], [.16, .48], [.20, .60]], '#e7e5e4', O, lw * .6);
    }
};
