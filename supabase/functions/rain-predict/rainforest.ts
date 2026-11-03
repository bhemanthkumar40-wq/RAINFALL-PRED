// A tiny random-forest-style ensemble of decision trees.
// Implements a lightweight CART (CART-with-gini) tree and a forest bagging,
// so the same model code runs in both the browser and an edge function
// (no native bindings, no .pkl/.joblib dependency at runtime).
//
// This is intentionally compact — a production model would use scikit-learn
// / XGBoost trained offline (see python/train_rain_model.py), then serialized
// to .joblib. The TS implementation mirrors that pipeline for in-browser /
// serverless inference without a Python runtime.

export interface Features {
  humidity: number;        // %
  temperature_c: number;    // C
  pressure_hpa: number;     // hPa
  wind_speed_kmh: number;   // km/h
  cloud_cover_pct: number;  // %
}

export interface LabeledRow extends Features {
  rain: boolean;
  rainfall_mm: number;
}

export interface Prediction {
  rain_probability: number; // 0..1
  predicted_intensity_mm: number;
}

// ---------------------------------------------------------------------------
// Decision tree (CART, gini). Each leaf stores the fraction of rain-positive
// samples and the mean rainfall among them, so a tree answers both the
// classification (probability of rain) and regression (expected mm).
// ---------------------------------------------------------------------------
interface TreeNode {
  leaf: boolean;
  // internal
  feature?: keyof Features;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  // leaf
  pRain?: number;
  meanRain?: number;
}

const FEATURE_KEYS: (keyof Features)[] = [
  'humidity',
  'temperature_c',
  'pressure_hpa',
  'wind_speed_kmh',
  'cloud_cover_pct',
];

function gini(rows: LabeledRow[]): number {
  if (rows.length === 0) return 0;
  const p = rows.filter((r) => r.rain).length / rows.length;
  return 1 - p * p - (1 - p) * (1 - p);
}

function bestSplit(
  rows: LabeledRow[],
  features: (keyof Features)[],
  rng: () => number,
): { feature: keyof Features; threshold: number; gain: number } | null {
  let best: { feature: keyof Features; threshold: number; gain: number } | null = null;
  const parentGini = gini(rows);

  for (const feature of features) {
    const values = [...new Set(rows.map((r) => r[feature]))].sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;
      const left = rows.filter((r) => r[feature] <= threshold);
      const right = rows.filter((r) => r[feature] > threshold);
      if (left.length === 0 || right.length === 0) continue;
      const w = gini(left) * left.length + gini(right) * right.length;
      const gain = parentGini - w / rows.length;
      if (!best || gain > best.gain) best = { feature, threshold, gain };
    }
  }
  return best;
}

function buildTree(
  rows: LabeledRow[],
  features: (keyof Features)[],
  depth: number,
  maxDepth: number,
  rng: () => number,
): TreeNode {
  const rainCount = rows.filter((r) => r.rain).length;
  const pRain = rainCount / rows.length;
  const meanRain = rows.length ? rows.reduce((s, r) => s + r.rainfall_mm, 0) / rows.length : 0;

  // Stop: pure node, depth cap, or tiny leaf.
  if (depth >= maxDepth || rows.length < 4 || pRain === 0 || pRain === 1) {
    return { leaf: true, pRain, meanRain };
  }

  const split = bestSplit(rows, features, rng);
  if (!split || split.gain <= 0.0001) return { leaf: true, pRain, meanRain };

  const leftRows = rows.filter((r) => r[split.feature] <= split.threshold);
  const rightRows = rows.filter((r) => r[split.feature] > split.threshold);

  return {
    leaf: false,
    feature: split.feature,
    threshold: split.threshold,
    left: buildTree(leftRows, features, depth + 1, maxDepth, rng),
    right: buildTree(rightRows, features, depth + 1, maxDepth, rng),
  };
}

function predictTree(node: TreeNode, x: Features): { pRain: number; meanRain: number } {
  while (!node.leaf) {
    if (x[node.feature!] <= node.threshold!) node = node.left!;
    else node = node.right!;
  }
  return { pRain: node.pRain ?? 0, meanRain: node.meanRain ?? 0 };
}

// ---------------------------------------------------------------------------
// Random forest: bootstrap samples + random feature subset per split.
// ---------------------------------------------------------------------------
export interface RainForest {
  trees: TreeNode[];
  features: (keyof Features)[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainRainForest(
  rows: LabeledRow[],
  opts: { nTrees?: number; maxDepth?: number; seed?: number } = {},
): RainForest {
  const { nTrees = 60, maxDepth = 8, seed = 7 } = opts;
  const rng = mulberry32(seed);
  const trees: TreeNode[] = [];
  const n = rows.length;

  for (let t = 0; t < nTrees; t++) {
    // bootstrap sample
    const sample: LabeledRow[] = [];
    for (let i = 0; i < n; i++) sample.push(rows[Math.floor(rng() * n)]);

    // random feature subset at each split (√p of 5 ≈ 2–3)
    const featureSubset = (): (keyof Features)[] => {
      const shuffled = [...FEATURE_KEYS].sort(() => rng() - 0.5);
      return shuffled.slice(0, Math.max(2, Math.round(Math.sqrt(FEATURE_KEYS.length))));
    };

    // wrap buildTree to use a fresh feature subset at every split call
    const buildWithSubset = (r: LabeledRow[], d: number): TreeNode => {
      const rainCount = r.filter((x) => x.rain).length;
      const pRain = rainCount / r.length;
      const meanRain = r.length ? r.reduce((s, x) => s + x.rainfall_mm, 0) / r.length : 0;
      if (d >= maxDepth || r.length < 4 || pRain === 0 || pRain === 1) {
        return { leaf: true, pRain, meanRain };
      }
      const split = bestSplit(r, featureSubset(), rng);
      if (!split || split.gain <= 0.0001) return { leaf: true, pRain, meanRain };
      const leftRows = r.filter((x) => x[split.feature] <= split.threshold);
      const rightRows = r.filter((x) => x[split.feature] > split.threshold);
      return {
        leaf: false,
        feature: split.feature,
        threshold: split.threshold,
        left: buildWithSubset(leftRows, d + 1),
        right: buildWithSubset(rightRows, d + 1),
      };
    };

    trees.push(buildWithSubset(sample, 0));
  }

  return { trees, features: FEATURE_KEYS };
}

export function predictRain(forest: RainForest, x: Features): Prediction {
  let pSum = 0;
  let mSum = 0;
  for (const tree of forest.trees) {
    const { pRain, meanRain } = predictTree(tree, x);
    pSum += pRain;
    // intensity only counts when the tree thinks rain is likely
    mSum += pRain > 0.5 ? meanRain : 0;
  }
  const n = forest.trees.length;
  const rain_probability = pSum / n;
  const predicted_intensity_mm =
    rain_probability > 0.5 ? mSum / Math.max(1, forest.trees.length / 2) : 0;
  return { rain_probability, predicted_intensity_mm };
}

// Plain-language advice for farmers.
export function farmerAdvice(p: Prediction): string {
  const prob = p.rain_probability;
  const mm = p.predicted_intensity_mm;
  if (prob >= 0.75) {
    return mm > 20
      ? 'Heavy rain likely. Delay irrigation, postpone spraying, and shelter delicate crops. Drain channels clear.'
      : 'Rain very likely. Hold off watering today — save the irrigation cost and let nature do the work.';
  }
  if (prob >= 0.5) {
    return 'Rain is more likely than not. Light watering only if soil is dry; postpone spraying that washes off easily.';
  }
  if (prob >= 0.25) {
    return 'Rain possible but not certain. Plan outdoor fieldwork early; keep an eye on the sky this afternoon.';
  }
  return 'Dry day expected. Good window for irrigation, sowing, and fertilizer application.';
}
