// Vector art for the beasts and monsters: giant rat, kobold, giant bat, goblin, giant snake, wolf, orc raider, skeleton, headless, gargoyle, roper
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
        // Digitigrade clawed legs (proportioned ~0.55-0.60 human scale, feet at y=0.92)
        vgPoly(ctx, s, [[.42, .76], [.36, .84], [.32, .92], [.42, .92], [.42, .85], [.46, .76]], '#9a3412', O, lw * .8);
        vgPoly(ctx, s, [[.54, .76], [.58, .84], [.56, .92], [.66, .92], [.62, .85], [.58, .76]], '#9a3412', O, lw * .8);
        vgPoly(ctx, s, [[.30, .92], [.32, .90], [.34, .92]], '#fffbeb', null);
        vgPoly(ctx, s, [[.40, .92], [.42, .90], [.44, .92]], '#fffbeb', null);
        vgPoly(ctx, s, [[.54, .92], [.56, .90], [.58, .92]], '#fffbeb', null);
        vgPoly(ctx, s, [[.64, .92], [.66, .90], [.68, .92]], '#fffbeb', null);
        // Sinuous draconic tail with dorsal spines
        vgPath(ctx, s, [[.40, .78], [.26, .84], [.12, .80], [.06, .85]], '#b45309', s * .04);
        vgPoly(ctx, s, [[.24, .82], [.22, .77], [.20, .83]], '#7c2d12', null);
        vgPoly(ctx, s, [[.14, .79], [.12, .74], [.10, .80]], '#7c2d12', null);
        // Scaly hunched torso & pale belly plates
        vgPoly(ctx, s, [[.38, .56], [.62, .56], [.60, .78], [.38, .78]], vgLin(ctx, 0, s * .56, 0, s * .78, [[0, '#c2410c'], [1, '#7c2d12']]), O, lw);
        vgPoly(ctx, s, [[.46, .58], [.58, .58], [.56, .76], [.46, .76]], '#fdba74', null);
        vgPath(ctx, s, [[.47, .64], [.57, .64]], '#ea580c', lw * .6);
        vgPath(ctx, s, [[.47, .70], [.56, .70]], '#ea580c', lw * .6);
        // Tattered rags & pouch
        vgPoly(ctx, s, [[.36, .74], [.64, .74], [.62, .84], [.54, .80], [.48, .85], [.38, .82]], '#44403c', O, lw * .7);
        vgPath(ctx, s, [[.36, .74], [.64, .74]], '#78350f', lw * 1.2);
        vgBall(ctx, s * .42, s * .78, s * .03, '#78350f', '#451a03', O, lw * .6);
        // Arms & notched spear
        vgPoly(ctx, s, [[.38, .60], [.30, .68], [.34, .74], [.40, .68]], '#c2410c', O, lw * .8);
        vgPoly(ctx, s, [[.60, .60], [.70, .66], [.68, .74], [.58, .68]], '#c2410c', O, lw * .8);
        vgPath(ctx, s, [[.70, .84], [.86, .34]], '#78350f', s * .028);
        vgPath(ctx, s, [[.84, .40], [.87, .33]], '#d97706', lw * .9);
        vgPoly(ctx, s, [[.84, .36], [.92, .24], [.88, .38]], '#cbd5e1', O, lw * .7);
        // Head with backward horns & reptilian snout
        vgBall(ctx, s * .50, s * .46, s * .11, '#c2410c', '#7c2d12', O, lw);
        vgPoly(ctx, s, [[.42, .40], [.30, .32], [.42, .44]], '#571c0c', O, lw * .7);
        vgPoly(ctx, s, [[.48, .38], [.38, .28], [.48, .42]], '#571c0c', O, lw * .7);
        vgPoly(ctx, s, [[.52, .44], [.72, .48], [.70, .55], [.52, .53]], '#d9631a', O, lw);
        vgPath(ctx, s, [[.67, .48], [.69, .48]], '#451a03', lw * .7);
        vgEll(ctx, s * .53, s * .44, s * .035, s * .035, '#fde047', O, lw * .6);
        vgPath(ctx, s, [[.53, .415], [.53, .465]], '#451a03', lw * .8);
        vgPath(ctx, s, [[.54, .52], [.70, .52]], '#451a03', lw);
        vgPoly(ctx, s, [[.58, .52], [.60, .56], [.62, .52]], '#fffbeb', null);
        vgPoly(ctx, s, [[.65, .52], [.66, .56], [.68, .52]], '#fffbeb', null);
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
        // Crouched wiry legs & ragged pointed boots (proportioned ~0.68 human scale, feet at y=0.92)
        vgPoly(ctx, s, [[.38, .74], [.34, .84], [.30, .92], [.42, .92], [.42, .85], [.46, .74]], '#4d7c0f', O, lw * .8);
        vgPoly(ctx, s, [[.54, .74], [.58, .84], [.56, .92], [.68, .92], [.64, .85], [.58, .74]], '#4d7c0f', O, lw * .8);
        vgPoly(ctx, s, [[.27, .92], [.42, .92], [.41, .87], [.31, .87], [.26, .90]], '#292524', O, lw * .7);
        vgPoly(ctx, s, [[.55, .92], [.70, .92], [.69, .87], [.59, .87], [.54, .90]], '#292524', O, lw * .7);
        // Chunky hunched torso in patched leather jerkin
        vgPoly(ctx, s, [[.34, .52], [.66, .52], [.63, .76], [.37, .76]], vgLin(ctx, 0, s * .52, 0, s * .76, [[0, '#78350f'], [1, '#451a03']]), O, lw);
        vgPoly(ctx, s, [[.38, .56], [.50, .56], [.48, .66], [.36, .66]], '#3f2208', O, lw * .6);
        vgPath(ctx, s, [[.39, .61], [.47, .61]], '#d97706', lw * .7);
        vgPath(ctx, s, [[.43, .57], [.43, .65]], '#d97706', lw * .7);
        vgPath(ctx, s, [[.36, .72], [.64, .72]], '#292524', s * .03);
        vgPoly(ctx, s, [[.47, .70], [.53, .70], [.53, .74], [.47, .74]], '#a8a29e', O, lw * .6);
        // Arms
        vgPoly(ctx, s, [[.34, .54], [.22, .64], [.28, .72], [.36, .66]], '#65a30d', O, lw * .8);
        vgPath(ctx, s, [[.23, .66], [.29, .70]], '#451a03', s * .025);
        vgPoly(ctx, s, [[.66, .54], [.78, .60], [.76, .70], [.64, .66]], '#65a30d', O, lw * .8);
        // Jagged notched scimitar
        vgPath(ctx, s, [[.75, .68], [.79, .63]], '#78350f', s * .03);
        vgPoly(ctx, s, [[.72, .66], [.78, .60], [.82, .64], [.76, .70]], '#475569', O, lw * .6);
        vgPoly(ctx, s, [[.77, .62], [.88, .40], [.85, .36], [.94, .22], [.95, .32], [.86, .52], [.82, .64]], vgLin(ctx, s * .75, 0, s * .95, 0, [[0, '#cbd5e1'], [1, '#64748b']]), O, lw);
        vgPath(ctx, s, [[.85, .36], [.94, .22]], '#f8fafc', lw * .8);
        // Signature huge bat ears
        vgPoly(ctx, s, [[.36, .42], [.10, .28], [.16, .46], [.36, .50]], '#84cc16', O, lw);
        vgPoly(ctx, s, [[.34, .43], [.16, .32], [.20, .44]], '#a3e635', null);
        vgPoly(ctx, s, [[.64, .42], [.90, .28], [.84, .46], [.64, .50]], '#84cc16', O, lw);
        vgPoly(ctx, s, [[.66, .43], [.84, .32], [.80, .44]], '#a3e635', null);
        // Head, nose & toothy grin
        vgBall(ctx, s * .50, s * .42, s * .13, '#84cc16', '#4d7c0f', O, lw);
        vgPoly(ctx, s, [[.47, .42], [.50, .54], [.55, .44]], '#65a30d', O, lw * .8);
        vgEll(ctx, s * .50, s * .52, s * .03, s * .02, '#3f6212', null);
        vgEyes(ctx, s * .50, s * .40, s * .06, s * .022, '#fde047');
        vgEyes(ctx, s * .50, s * .40, s * .06, s * .010, '#ef4444');
        vgPath(ctx, s, [[.40, .49], [.50, .53], [.60, .49]], '#1c1917', lw * 1.1);
        vgPoly(ctx, s, [[.42, .50], [.44, .56], [.46, .51]], '#fef9c3', null);
        vgPoly(ctx, s, [[.48, .52], [.50, .57], [.52, .52]], '#fef9c3', null);
        vgPoly(ctx, s, [[.54, .51], [.56, .56], [.58, .50]], '#fef9c3', null);
    },
    snake(ctx, s, t, lw, O) {
        const sw = Math.sin(t * .1) * .015;
        // Coiled muscular body
        vgEll(ctx, s * .50, s * .85, s * .36, s * .09, vgLin(ctx, 0, s * .76, 0, s * .94, [[0, '#15803d'], [1, '#052e16']]), O, lw);
        vgEll(ctx, s * .50, s * .77, s * .28, s * .08, '#166534', O, lw);
        vgEll(ctx, s * .50, s * .69, s * .21, s * .07, '#15803d', O, lw);
        // Diamond back-scales
        for (let i = 0; i < 7; i++) {
            vgPoly(ctx, s, [[.24 + i * .085, .85], [.27 + i * .085, .82], [.30 + i * .085, .85], [.27 + i * .085, .88]], '#facc15', null);
            vgPoly(ctx, s, [[.26 + i * .085, .85], [.27 + i * .085, .835], [.28 + i * .085, .85], [.27 + i * .085, .865]], '#14532d', null);
        }
        for (let i = 0; i < 5; i++) {
            vgPoly(ctx, s, [[.32 + i * .09, .77], [.35 + i * .09, .74], [.38 + i * .09, .77], [.35 + i * .09, .80]], '#facc15', null);
        }
        // Rearing S-curve neck with flared hood
        vgPath(ctx, s, [[.56, .68], [.64, .50 + sw], [.54, .36], [.46, .26]], '#166534', s * .13);
        vgPath(ctx, s, [[.56, .68], [.64, .50 + sw], [.54, .36], [.46, .26]], '#22c55e', s * .07);
        // Flared hood membrane
        vgPoly(ctx, s, [[.54, .44 + sw], [.70, .46 + sw], [.62, .34], [.48, .32]], '#15803d', O, lw * .8);
        vgPoly(ctx, s, [[.56, .44 + sw], [.66, .45 + sw], [.60, .36], [.50, .34]], '#16a34a', null);
        // Viper head
        vgPoly(ctx, s, [[.34, .20], [.52, .16], [.62, .24], [.54, .32], [.36, .28]], vgLin(ctx, s * .34, 0, s * .62, 0, [[0, '#22c55e'], [1, '#14532d']]), O, lw);
        // Slit eye with venom glow
        vgGlow(ctx, s * .50, s * .22, s * .08, '250,204,21', .3);
        vgEll(ctx, s * .50, s * .22, s * .035, s * .035, '#fde047', O, lw * .6);
        vgPath(ctx, s, [[.50, .195], [.50, .245]], '#052e16', lw * .8);
        // Nostril pit
        vgBall(ctx, s * .38, s * .22, s * .012, '#052e16', '#052e16', null);
        // Forked tongue
        vgPath(ctx, s, [[.36, .26], [.24, .28], [.18, .24]], '#ef4444', lw);
        vgPath(ctx, s, [[.24, .28], [.18, .32]], '#ef4444', lw);
        // Needle fangs
        vgPoly(ctx, s, [[.38, .27], [.39, .34], [.42, .27]], '#fffbeb', null);
        vgPoly(ctx, s, [[.43, .27], [.44, .33], [.46, .27]], '#fffbeb', null);
        // Dripping venom droplets
        vgBall(ctx, s * .39, s * .36, s * .016, '#a3e635', '#4d7c0f', null);
        vgBall(ctx, s * .44, s * .35, s * .014, '#a3e635', '#4d7c0f', null);
    },
    wolf(ctx, s, t, lw, O) {
        // Quadruped predator (back at human waist height ~0.54, horizontal span x=0.08..0.92)
        vgPoly(ctx, s, [[.24, .64], [.20, .78], [.22, .92], [.28, .92], [.26, .80], [.30, .66]], '#57534e', O, lw * .8);
        vgPoly(ctx, s, [[.34, .62], [.30, .78], [.32, .92], [.38, .92], [.36, .78], [.40, .64]], '#78716c', O, lw * .8);
        vgPath(ctx, s, [[.22, .92], [.20, .92]], '#0c0a09', lw * 1.5);
        vgPath(ctx, s, [[.32, .92], [.30, .92]], '#0c0a09', lw * 1.5);
        // Bushy tail
        vgPoly(ctx, s, [[.20, .58], [.08, .64], [.06, .74], [.12, .80], [.18, .70], [.22, .64]], vgLin(ctx, s * .2, s * .6, s * .06, s * .75, [[0, '#78716c'], [1, '#44403c']]), O, lw);
        vgPath(ctx, s, [[.14, .68], [.08, .72]], '#a8a29e', lw * .7);
        // Flank, muscular chest and thick neck ruff
        vgEll(ctx, s * .46, s * .60, s * .28, s * .14, vgLin(ctx, 0, s * .46, 0, s * .74, [[0, '#a8a29e'], [.5, '#78716c'], [1, '#44403c']]), O, lw);
        vgEll(ctx, s * .64, s * .58, s * .14, s * .15, '#8c857f', O, lw);
        vgPoly(ctx, s, [[.58, .48], [.72, .40], [.78, .54], [.64, .66]], vgLin(ctx, s * .6, 0, s * .8, 0, [[0, '#d6d3d1'], [1, '#78716c']]), O, lw);
        vgPoly(ctx, s, [[.68, .62], [.66, .68], [.72, .64]], '#e7e5e4', null);
        vgPoly(ctx, s, [[.60, .58], [.58, .64], [.64, .60]], '#e7e5e4', null);
        // Forelegs
        vgPoly(ctx, s, [[.64, .64], [.63, .80], [.64, .92], [.70, .92], [.68, .80], [.69, .64]], '#57534e', O, lw * .8);
        vgPoly(ctx, s, [[.73, .62], [.72, .78], [.74, .92], [.80, .92], [.78, .78], [.78, .62]], '#78716c', O, lw * .8);
        vgPath(ctx, s, [[.64, .92], [.62, .92]], '#0c0a09', lw * 1.5);
        vgPath(ctx, s, [[.74, .92], [.72, .92]], '#0c0a09', lw * 1.5);
        // Head, snout, ears, snarl and amber eye
        vgBall(ctx, s * .76, s * .42, s * .11, '#a8a29e', '#57534e', O, lw);
        vgPoly(ctx, s, [[.70, .36], [.68, .22], [.75, .32]], '#57534e', O, lw * .8);
        vgPoly(ctx, s, [[.76, .34], [.76, .20], [.82, .32]], '#78716c', O, lw * .8);
        vgPoly(ctx, s, [[.77, .32], [.77, .23], [.80, .31]], '#f5f5f4', null);
        vgPoly(ctx, s, [[.78, .40], [.94, .45], [.88, .54], [.76, .52]], '#8c857f', O, lw);
        vgBall(ctx, s * .93, s * .45, s * .022, '#1c1917', '#0c0a09', null);
        vgPath(ctx, s, [[.84, .45], [.88, .43]], '#44403c', lw * .8);
        vgPoly(ctx, s, [[.83, .49], [.90, .47], [.86, .53]], '#1c0a09', null);
        vgPoly(ctx, s, [[.87, .47], [.88, .52], [.89, .47]], '#fffbeb', null);
        vgPoly(ctx, s, [[.85, .52], [.86, .48], [.87, .52]], '#fffbeb', null);
        vgEll(ctx, s * .80, s * .40, s * .024, s * .020, '#fbbf24', O, lw * .6, -.2);
        vgPath(ctx, s, [[.80, .385], [.80, .415]], '#0c0a09', lw * .8);
    },
    orc(ctx, s, t, lw, O) {
        // Orc Raider: towering, broad marauder (height y=0.12..0.93, shoulder span x=0.18..0.82)
        vgPoly(ctx, s, [[.34, .74], [.30, .85], [.26, .93], [.40, .93], [.42, .85], [.44, .74]], '#365314', O, lw);
        vgPoly(ctx, s, [[.56, .74], [.58, .85], [.60, .93], [.74, .93], [.70, .85], [.66, .74]], '#365314', O, lw);
        vgPoly(ctx, s, [[.25, .84], [.41, .84], [.40, .93], [.25, .93]], vgLin(ctx, s * .25, 0, s * .41, 0, [[0, '#64748b'], [1, '#334155']]), O, lw * .8);
        vgPoly(ctx, s, [[.59, .84], [.75, .84], [.74, .93], [.59, .93]], vgLin(ctx, s * .59, 0, s * .75, 0, [[0, '#64748b'], [1, '#334155']]), O, lw * .8);
        vgBall(ctx, s * .35, s * .80, s * .04, '#94a3b8', '#475569', O, lw * .7);
        vgBall(ctx, s * .65, s * .80, s * .04, '#94a3b8', '#475569', O, lw * .7);
        // Shaggy fur kilt & iron skull belt
        vgPoly(ctx, s, [[.30, .64], [.70, .64], [.74, .78], [.64, .74], [.54, .80], [.44, .74], [.34, .80], [.26, .74]], '#78350f', O, lw);
        vgPath(ctx, s, [[.36, .68], [.34, .76]], '#451a03', lw * .8);
        vgPath(ctx, s, [[.62, .68], [.64, .76]], '#451a03', lw * .8);
        vgPoly(ctx, s, [[.28, .62], [.72, .62], [.70, .68], [.30, .68]], '#292524', O, lw);
        vgBall(ctx, s * .50, s * .65, s * .04, '#e2e8f0', '#94a3b8', O, lw * .7);
        // Heavy muscular torso, plate harness & war paint
        vgPoly(ctx, s, [[.22, .38], [.78, .38], [.70, .64], [.30, .64]], vgLin(ctx, s * .22, 0, s * .78, 0, [[0, '#4d7c0f'], [.5, '#65a30d'], [1, '#365314']]), O, lw);
        vgPoly(ctx, s, [[.28, .38], [.40, .38], [.62, .64], [.50, .64]], '#57300f', O, lw * .8);
        vgPoly(ctx, s, [[.72, .38], [.60, .38], [.38, .64], [.50, .64]], '#57300f', O, lw * .8);
        [[.35, .44], [.45, .52], [.55, .52], [.65, .44]].forEach(([x, y]) => vgBall(ctx, s * x, s * y, s * .016, '#facc15', '#b45309', null));
        vgPath(ctx, s, [[.32, .48], [.42, .56]], '#dc2626', lw * 1.5);
        vgPath(ctx, s, [[.36, .46], [.46, .54]], '#dc2626', lw * 1.5);
        // Arms & spiked vambrace
        vgPoly(ctx, s, [[.24, .40], [.12, .52], [.16, .66], [.26, .56]], '#4d7c0f', O, lw);
        vgPoly(ctx, s, [[.76, .40], [.86, .50], [.82, .64], [.72, .56]], '#4d7c0f', O, lw);
        vgPoly(ctx, s, [[.14, .54], [.24, .50], [.22, .62], [.12, .64]], '#475569', O, lw * .7);
        // Massive two-handed notched war axe
        vgPath(ctx, s, [[.82, .12], [.84, .88]], '#57300f', s * .04);
        vgPath(ctx, s, [[.81, .56], [.85, .62]], '#d97706', lw);
        vgPath(ctx, s, [[.85, .56], [.81, .62]], '#d97706', lw);
        vgPoly(ctx, s, [[.84, .18], [.98, .12], [.97, .24], [.93, .26], [.98, .36], [.84, .42]], vgLin(ctx, s * .84, 0, s * .98, 0, [[0, '#e2e8f0'], [1, '#475569']]), O, lw);
        vgPoly(ctx, s, [[.82, .20], [.70, .14], [.69, .24], [.73, .26], [.68, .34], [.82, .38]], vgLin(ctx, s * .82, 0, s * .68, 0, [[0, '#e2e8f0'], [1, '#475569']]), O, lw);
        vgPath(ctx, s, [[.98, .12], [.97, .24], [.93, .26], [.98, .36]], '#f8fafc', lw * .8);
        vgPoly(ctx, s, [[.81, .14], [.83, .06], [.85, .14]], '#cbd5e1', O, lw * .7);
        // Head, tusks, red eyes and horned helm
        vgBall(ctx, s * .50, s * .28, s * .15, '#84cc16', '#3f6212', O, lw);
        vgPoly(ctx, s, [[.38, .33], [.62, .33], [.60, .41], [.40, .41]], '#4d7c0f', O, lw * .8);
        vgPoly(ctx, s, [[.42, .37], [.44, .27], [.47, .37]], '#fffbeb', O, lw * .6);
        vgPoly(ctx, s, [[.53, .37], [.56, .27], [.58, .37]], '#fffbeb', O, lw * .6);
        vgPath(ctx, s, [[.45, .36], [.55, .36]], '#1c1917', lw * 1.2);
        vgPoly(ctx, s, [[.36, .26], [.64, .26], [.62, .22], [.38, .22]], '#365314', O, lw * .7);
        vgGlow(ctx, s * .50, s * .25, s * .12, '239,68,68', .4);
        vgEyes(ctx, s * .50, s * .25, s * .06, s * .022, '#ef4444');
        vgEyes(ctx, s * .50, s * .25, s * .06, s * .010, '#fef08a');
        vgPoly(ctx, s, [[.34, .24], [.50, .14], [.66, .24], [.62, .18], [.50, .15], [.38, .18]], vgLin(ctx, 0, s * .14, 0, s * .24, [[0, '#cbd5e1'], [1, '#334155']]), O, lw);
        vgPath(ctx, s, [[.50, .14], [.50, .24]], '#1e293b', lw);
        vgPoly(ctx, s, [[.36, .22], [.22, .12], [.28, .10], [.40, .18]], '#fef3c7', O, lw * .8);
        vgPoly(ctx, s, [[.64, .22], [.78, .12], [.72, .10], [.60, .18]], '#fef3c7', O, lw * .8);
    },
    skull(ctx, s, t, lw, O) {
        // Skeleton: animated skeletal frame (height matches human warrior frame y=0.18..0.92, hollow negative space)
        vgPath(ctx, s, [[.45, .66], [.40, .78]], '#e7e5e4', s * .04);
        vgPath(ctx, s, [[.55, .66], [.60, .78]], '#e7e5e4', s * .04);
        vgBall(ctx, s * .40, s * .78, s * .026, '#f5f5f4', '#a8a29e', O, lw * .6);
        vgBall(ctx, s * .60, s * .78, s * .026, '#f5f5f4', '#a8a29e', O, lw * .6);
        vgPath(ctx, s, [[.40, .78], [.38, .90]], '#e7e5e4', s * .035);
        vgPath(ctx, s, [[.60, .78], [.62, .90]], '#e7e5e4', s * .035);
        vgPoly(ctx, s, [[.32, .92], [.42, .92], [.40, .88], [.34, .88]], '#d6d3d1', O, lw * .7);
        vgPoly(ctx, s, [[.58, .92], [.68, .92], [.66, .88], [.60, .88]], '#d6d3d1', O, lw * .7);
        // Tattered battle shroud & pelvis
        vgPoly(ctx, s, [[.36, .62], [.64, .62], [.66, .74], [.58, .70], [.50, .76], [.42, .70], [.34, .74]], 'rgba(71,85,105,.75)', O, lw * .8);
        vgPoly(ctx, s, [[.42, .62], [.58, .62], [.56, .67], [.50, .65], [.44, .67]], '#e7e5e4', O, lw * .7);
        // Vertebral column & articulated rib cage
        vgPath(ctx, s, [[.50, .36], [.50, .63]], '#e7e5e4', s * .038);
        for (let i = 0; i < 5; i++) vgPath(ctx, s, [[.47, .40 + i * .045], [.53, .40 + i * .045]], '#a8a29e', lw * .8);
        for (let i = 0; i < 5; i++) {
            const y = .40 + i * .044, w = .16 - i * .014;
            ctx.beginPath();
            ctx.moveTo(s * .50, y * s);
            ctx.quadraticCurveTo(s * (.50 - w), (y - .02) * s, s * (.50 - w * .85), (y + .035) * s);
            ctx.moveTo(s * .50, y * s);
            ctx.quadraticCurveTo(s * (.50 + w), (y - .02) * s, s * (.50 + w * .85), (y + .035) * s);
            ctx.strokeStyle = '#f5f5f4'; ctx.lineWidth = s * .026; ctx.lineCap = 'round'; ctx.stroke();
            ctx.strokeStyle = O; ctx.lineWidth = lw * .6; ctx.stroke();
        }
        // Left arm with cracked ancient buckler
        vgPath(ctx, s, [[.36, .40], [.26, .52], [.30, .64]], '#e7e5e4', s * .03);
        vgBall(ctx, s * .24, s * .58, s * .12, '#94a3b8', '#334155', O, lw);
        vgBall(ctx, s * .24, s * .58, s * .04, '#cbd5e1', '#64748b', O, lw * .6);
        vgPath(ctx, s, [[.16, .54], [.22, .60], [.18, .66]], '#1e293b', lw);
        // Right arm with pitted ancient longsword
        vgPath(ctx, s, [[.64, .40], [.74, .50], [.78, .44]], '#e7e5e4', s * .03);
        vgBall(ctx, s * .78, s * .44, s * .025, '#f5f5f4', '#a8a29e', O, lw * .6);
        vgPoly(ctx, s, [[.78, .46], [.88, .30], [.96, .12], [.93, .32], [.84, .50]], vgLin(ctx, s * .78, 0, s * .96, 0, [[0, '#cbd5e1'], [1, '#475569']]), O, lw);
        vgPath(ctx, s, [[.84, .36], [.91, .24]], '#f1f5f9', lw * .7);
        vgPoly(ctx, s, [[.75, .44], [.81, .50], [.83, .48], [.77, .42]], '#78350f', O, lw * .7);
        // Cranium, jaw with teeth & crimson unholy embers
        vgBall(ctx, s * .50, s * .24, s * .125, '#fafaf9', '#a8a29e', O, lw);
        vgPoly(ctx, s, [[.41, .28], [.59, .28], [.56, .34], [.44, .34]], '#e7e5e4', O, lw * .8);
        vgPoly(ctx, s, [[.44, .32], [.56, .32], [.55, .37], [.45, .37]], '#e7e5e4', O, lw * .7);
        for (let i = 0; i < 4; i++) vgPath(ctx, s, [[.465 + i * .024, .32], [.465 + i * .024, .37]], '#44403c', lw * .8);
        vgPoly(ctx, s, [[.49, .27], [.50, .30], [.51, .27]], '#0c0a09', null);
        vgEll(ctx, s * .45, s * .24, s * .034, s * .040, '#0c0a09');
        vgEll(ctx, s * .55, s * .24, s * .034, s * .040, '#0c0a09');
        vgGlow(ctx, s * .50, s * .24, s * .12, '239,68,68', .35);
        vgEyes(ctx, s * .50, s * .24, s * .05, s * .014, '#ef4444');
        vgEyes(ctx, s * .50, s * .24, s * .05, s * .006, '#fee2e2');
    },
    headless(ctx, s, t, lw, O) {
        // Headless: hulking brute (broad muscular frame, shoulders at y=0.22, width x=0.18..0.82)
        vgPoly(ctx, s, [[.36, .72], [.32, .84], [.28, .93], [.42, .93], [.44, .84], [.46, .72]], '#a16207', O, lw);
        vgPoly(ctx, s, [[.54, .72], [.56, .84], [.58, .93], [.72, .93], [.68, .84], [.64, .72]], '#a16207', O, lw);
        vgPath(ctx, s, [[.33, .80], [.43, .82]], '#78350f', lw * 1.3);
        vgPath(ctx, s, [[.57, .80], [.67, .82]], '#78350f', lw * 1.3);
        // Ragged loincloth
        vgPoly(ctx, s, [[.30, .64], [.70, .64], [.72, .76], [.50, .79], [.28, .76]], '#57534e', O, lw);
        vgPoly(ctx, s, [[.48, .64], [.52, .64], [.51, .69], [.49, .69]], '#f5f5f4', O, lw * .6);
        // Bulging muscular torso
        vgPoly(ctx, s, [[.20, .24], [.80, .24], [.72, .68], [.28, .68]], vgLin(ctx, 0, s * .24, 0, s * .68, [[0, '#d6a77a'], [.5, '#c08f62'], [1, '#854d0e']]), O, lw);
        vgPath(ctx, s, [[.26, .34], [.48, .40], [.50, .44]], 'rgba(67,20,7,.35)', lw);
        vgPath(ctx, s, [[.74, .34], [.52, .40], [.50, .44]], 'rgba(67,20,7,.35)', lw);
        // Severed neck stump with exposed vertebra bone ring
        vgEll(ctx, s * .50, s * .24, s * .12, s * .04, '#881337', O, lw);
        vgEll(ctx, s * .50, s * .24, s * .09, s * .028, '#4c0519', null);
        vgBall(ctx, s * .50, s * .24, s * .035, '#fafaf9', '#cbd5e1', O, lw * .6);
        vgEll(ctx, s * .50, s * .24, s * .012, s * .012, '#0c0a09', null);
        // Arms & vicious spiked tree-trunk maul
        vgPoly(ctx, s, [[.20, .26], [.08, .40], [.12, .60], [.24, .52]], '#c08f62', O, lw);
        vgPoly(ctx, s, [[.80, .26], [.92, .38], [.88, .56], [.76, .50]], '#c08f62', O, lw);
        vgPath(ctx, s, [[.88, .62], [.92, .18]], '#78350f', s * .06);
        vgPoly(ctx, s, [[.86, .26], [.98, .22], [.96, .12], [.84, .16]], '#57300f', O, lw);
        vgPath(ctx, s, [[.85, .21], [.97, .17]], '#475569', lw * 1.5);
        vgPoly(ctx, s, [[.98, .17], [1.04, .15], [.97, .21]], '#cbd5e1', O, lw * .6);
        vgPoly(ctx, s, [[.84, .21], [.78, .19], [.85, .25]], '#cbd5e1', O, lw * .6);
        vgPoly(ctx, s, [[.90, .14], [.91, .06], [.94, .13]], '#cbd5e1', O, lw * .6);
        // Demonic face on chest
        vgGlow(ctx, s * .50, s * .36, s * .15, '239,68,68', .4);
        vgEyes(ctx, s * .50, s * .36, s * .09, s * .032, '#fef08a');
        vgEyes(ctx, s * .50, s * .36, s * .09, s * .018, '#dc2626');
        vgEyes(ctx, s * .50, s * .36, s * .09, s * .008, '#450a0a');
        vgPath(ctx, s, [[.50, .39], [.48, .45], [.52, .45]], '#78350f', lw * 1.2);
        vgEll(ctx, s * .50, s * .55, s * .14, s * .06, '#1c0a05', O, lw);
        for (let i = 0; i < 6; i++) vgPoly(ctx, s, [[.38 + i * .042, .515], [.40 + i * .042, .56], [.42 + i * .042, .515]], '#fffbeb', null);
        for (let i = 0; i < 6; i++) vgPoly(ctx, s, [[.39 + i * .042, .585], [.41 + i * .042, .54], [.43 + i * .042, .585]], '#fffbeb', null);
    },
    wings(ctx, s, t, lw, O) {
        // Gargoyle: expansive stone wings, living slate body and magma glow (wingspan x=0.04..0.96)
        const flap = Math.sin(t * 0.09) * 0.03;
        [-1, 1].forEach(d => {
            const X = (x) => (.5 + d * x);
            vgPoly(ctx, s, [
                [X(.10), .44],
                [X(.44), .12 + flap],
                [X(.42), .26 + flap * .5],
                [X(.48), .42],
                [X(.36), .44],
                [X(.42), .62],
                [X(.26), .56],
                [X(.18), .70],
                [X(.10), .62]
            ], vgLin(ctx, s * .5, 0, s * (.5 + d * .48), 0, [[0, '#475569'], [1, '#1e293b']]), O, lw);
            vgPath(ctx, s, [[X(.10), .44], [X(.44), .12 + flap]], '#94a3b8', lw * 1.4);
            vgPath(ctx, s, [[X(.12), .46], [X(.42), .26 + flap * .5]], '#64748b', lw);
            vgPath(ctx, s, [[X(.12), .48], [X(.48), .42]], '#64748b', lw);
            vgPath(ctx, s, [[X(.12), .50], [X(.42), .62]], '#64748b', lw);
            vgPoly(ctx, s, [[X(.44), .12 + flap], [X(.48), .09 + flap], [X(.43), .16 + flap]], '#cbd5e1', O, lw * .8);
        });
        // Barbed stone tail
        vgPath(ctx, s, [[.58, .74], [.76, .84], [.88, .76], [.92, .82]], '#475569', s * .04);
        vgPoly(ctx, s, [[.90, .80], [.96, .82], [.92, .88]], '#64748b', O, lw * .8);
        // Raptor stone talons & legs
        vgPoly(ctx, s, [[.38, .68], [.46, .68], [.42, .88], [.32, .88]], '#475569', O, lw);
        vgPoly(ctx, s, [[.54, .68], [.62, .68], [.68, .88], [.58, .88]], '#475569', O, lw);
        vgPoly(ctx, s, [[.30, .88], [.44, .88], [.46, .93], [.28, .93]], '#334155', O, lw);
        vgPoly(ctx, s, [[.56, .88], [.70, .88], [.72, .93], [.54, .93]], '#334155', O, lw);
        for (let i = 0; i < 3; i++) {
            vgPoly(ctx, s, [[.28 + i * .05, .93], [.29 + i * .05, .95], [.30 + i * .05, .93]], '#cbd5e1', null);
            vgPoly(ctx, s, [[.56 + i * .05, .93], [.57 + i * .05, .95], [.58 + i * .05, .93]], '#cbd5e1', null);
        }
        // Chiseled granite torso with molten fissures
        vgPoly(ctx, s, [[.34, .38], [.66, .38], [.62, .72], [.38, .72]], vgLin(ctx, s * .34, 0, s * .66, 0, [[0, '#64748b'], [.5, '#475569'], [1, '#334155']]), O, lw);
        vgPath(ctx, s, [[.38, .48], [.50, .54], [.62, .48]], '#1e293b', lw);
        vgPath(ctx, s, [[.44, .44], [.48, .52], [.46, .62]], '#f97316', lw * .9);
        vgPath(ctx, s, [[.54, .46], [.52, .56], [.56, .64]], '#ea580c', lw * .9);
        // Stone arms & talons
        vgPoly(ctx, s, [[.34, .40], [.22, .50], [.26, .64], [.36, .56]], '#475569', O, lw);
        vgPoly(ctx, s, [[.66, .40], [.78, .50], [.74, .64], [.64, .56]], '#475569', O, lw);
        for (let i = 0; i < 3; i++) {
            vgPoly(ctx, s, [[.24 + i * .03, .64], [.23 + i * .03, .69], [.26 + i * .03, .65]], '#cbd5e1', null);
            vgPoly(ctx, s, [[.72 + i * .03, .64], [.73 + i * .03, .69], [.74 + i * .03, .65]], '#cbd5e1', null);
        }
        // Demonic stone head, swept horns & molten sulfur eyes
        vgBall(ctx, s * .50, s * .28, s * .125, '#64748b', '#334155', O, lw);
        vgPoly(ctx, s, [[.42, .22], [.32, .08], [.44, .18]], '#334155', O, lw * .8);
        vgPoly(ctx, s, [[.58, .22], [.68, .08], [.56, .18]], '#334155', O, lw * .8);
        vgPoly(ctx, s, [[.38, .26], [.30, .24], [.38, .30]], '#475569', O, lw * .7);
        vgPoly(ctx, s, [[.62, .26], [.70, .24], [.62, .30]], '#475569', O, lw * .7);
        vgPoly(ctx, s, [[.44, .33], [.56, .33], [.54, .38], [.46, .38]], '#1e293b', null);
        vgPoly(ctx, s, [[.46, .33], [.47, .37], [.48, .33]], '#f8fafc', null);
        vgPoly(ctx, s, [[.52, .33], [.53, .37], [.54, .33]], '#f8fafc', null);
        vgGlow(ctx, s * .50, s * .26, s * .12, '249,115,22', .5);
        vgEyes(ctx, s * .50, s * .26, s * .05, s * .022, '#f97316');
        vgEyes(ctx, s * .50, s * .26, s * .05, s * .010, '#fde047');
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
