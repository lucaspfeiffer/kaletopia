/**
 * Social event market: a toy model of a prediction market as an information
 * processor, with an optional social layer on top.
 *
 * A hidden truth θ is the real probability of some event. Agents each hold a
 * private belief. A few are informed (their signal is close to θ). The rest
 * share a popular narrative that is off by a bias. Everyone trades against a
 * logarithmic market scoring rule market maker, so the price drifts toward a
 * confidence-weighted average of beliefs.
 *
 * With the social layer on, agents post their belief to followers, who move
 * toward what they read. "open" lets anyone post. "positions" only lets
 * agents post once they hold a position, and readers weight posts by the size
 * of the poster's position: skin in the game.
 *
 * Deterministic for a given seed. No DOM. The whole run is precomputed so a
 * reader can scrub it.
 */
export const defaults = {
    agents: 120,
    informedShare: 0.2,
    bias: 0.18,
    noise: 0.08,
    informedNoise: 0.04,
    social: 'positions',
    follows: 6,
    trust: 0.3,
    liquidity: 40,
    ticks: 240,
    seed: 7,
};
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gaussian(rand) {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** Points scattered in a disc with a little mutual repulsion, for drawing. */
function scatter(n, rand) {
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
        let best = 0, bx = 0.5, by = 0.5;
        for (let k = 0; k < 12; k++) {
            const r = Math.sqrt(rand()) * 0.47;
            const a = rand() * Math.PI * 2;
            const x = 0.5 + r * Math.cos(a);
            const y = 0.5 + r * Math.sin(a);
            let dmin = Infinity;
            for (let j = 0; j < i; j++) {
                const dx = pts[j * 2] - x, dy = pts[j * 2 + 1] - y;
                dmin = Math.min(dmin, dx * dx + dy * dy);
            }
            if (dmin > best) {
                best = dmin;
                bx = x;
                by = y;
            }
        }
        pts[i * 2] = bx;
        pts[i * 2 + 1] = by;
    }
    return pts;
}
export function simulate(p) {
    const rand = mulberry32(p.seed);
    const n = p.agents;
    const truth = 0.25 + rand() * 0.5;
    const biasSign = rand() < 0.5 ? -1 : 1;
    const bias = biasSign * p.bias;
    const informed = new Uint8Array(n);
    const belief = new Float32Array(n);
    const confidence = new Float32Array(n);
    const voice = new Float32Array(n);
    const shares = new Float32Array(n);
    const nInformed = Math.round(n * p.informedShare);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    for (let k = 0; k < nInformed; k++)
        informed[order[k]] = 1;
    for (let i = 0; i < n; i++) {
        if (informed[i]) {
            belief[i] = clamp(truth + gaussian(rand) * p.informedNoise, 0.02, 0.98);
            confidence[i] = 0.85 + rand() * 0.15;
        }
        else {
            belief[i] = clamp(truth + bias + gaussian(rand) * p.noise, 0.02, 0.98);
            confidence[i] = 0.15 + rand() * 0.2;
        }
        voice[i] = rand();
    }
    const follows = [];
    for (let i = 0; i < n; i++) {
        const set = new Set();
        const k = Math.max(1, Math.round(p.follows * (0.5 + rand())));
        while (set.size < Math.min(k, n - 1)) {
            const j = Math.floor(rand() * n);
            if (j !== i)
                set.add(j);
        }
        follows.push([...set]);
    }
    const followers = Array.from({ length: n }, () => []);
    follows.forEach((list, i) => list.forEach((j) => followers[j].push(i)));
    const layout = scatter(n, mulberry32(p.seed ^ 0x9e3779b9));
    // LMSR market maker
    let qY = 0, qN = 0;
    const b = p.liquidity;
    const price = () => 1 / (1 + Math.exp((qN - qY) / b));
    // Position limits scale with confidence: conviction sizes the bet.
    const maxPos = 30;
    const limit = (i) => maxPos * confidence[i];
    const posThreshold = 4;
    const ticks = [];
    let errSum = 0;
    for (let t = 0; t < p.ticks; t++) {
        const pNow = price();
        // Trade
        for (let i = 0; i < n; i++) {
            if (rand() > 0.35)
                continue;
            const gap = belief[i] - pNow;
            if (Math.abs(gap) < 0.02)
                continue;
            const size = confidence[i] * 6 * Math.abs(gap);
            const lim = limit(i);
            if (gap > 0) {
                const d = Math.min(size, lim - shares[i]);
                if (d > 0) {
                    qY += d;
                    shares[i] += d;
                }
            }
            else {
                const d = Math.min(size, lim + shares[i]);
                if (d > 0) {
                    qN += d;
                    shares[i] -= d;
                }
            }
        }
        // Post
        const posts = [];
        if (p.social !== 'off') {
            for (let i = 0; i < n; i++) {
                let prob = 0.12 * voice[i];
                if (p.social === 'positions') {
                    const pos = Math.abs(shares[i]);
                    if (pos < posThreshold)
                        continue;
                    prob *= Math.min(1, pos / posThreshold);
                }
                if (rand() < prob) {
                    // Cheap talk: with nothing at stake, what people say drifts from what they think.
                    const said = p.social === 'open' ? clamp(belief[i] + gaussian(rand) * 0.12, 0.02, 0.98) : belief[i];
                    posts.push({ from: i, belief: said, shares: shares[i] });
                }
            }
        }
        // Read: each follower moves toward the posts they saw this tick
        if (posts.length > 0) {
            const sum = new Float32Array(n);
            const wsum = new Float32Array(n);
            for (const post of posts) {
                // Skin in the game: readers weight a post by the size of the position behind it.
                const w = p.social === 'positions' ? (Math.abs(post.shares) / maxPos) ** 2 : 1;
                for (const f of followers[post.from]) {
                    sum[f] += w * post.belief;
                    wsum[f] += w;
                }
            }
            for (let i = 0; i < n; i++) {
                if (wsum[i] === 0)
                    continue;
                // A small stake pulls a little; several large stakes average out.
                const pull = (sum[i] - wsum[i] * belief[i]) / Math.max(1, wsum[i]);
                // Agents with their own data hold it against what they read.
                const trust = p.trust * (informed[i] ? 0.1 : 1);
                belief[i] = clamp(belief[i] + trust * pull, 0.02, 0.98);
            }
        }
        const pAfter = price();
        errSum += Math.abs(pAfter - truth);
        ticks.push({ price: pAfter, beliefs: Float32Array.from(belief), shares: Float32Array.from(shares), posts });
    }
    return { params: p, truth, informed, follows, layout, ticks, meanError: errSum / p.ticks };
}
