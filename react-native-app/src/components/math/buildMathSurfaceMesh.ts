import {Skia} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import type {AudioSurfaceParams} from './mathRippleSurface';
import {
  colorForHeight,
  pondRippleHeight,
  projectSurfaceIsometric,
} from './mathRippleSurface';
const GRID = 20;
/** Horizontal extent of the plot (reference axes −5…5). */
const DOMAIN = 5.2;
/** Default wave mesh size inside the axis frame (~2× visual footprint). */
export const DEFAULT_MATH_MESH_SCALE = 1.85;

export type MathViewport = {
  yawOffset: number;
  pitchOffset: number;
  meshScale: number;
};

export type MathSurfaceMesh = {
  vertices: {x: number; y: number}[];
  colors: string[];
  indices: number[];
  wirePath: SkPath;
};

type GridNode = {
  sx: number;
  sy: number;
  z: number;
  color: string;
};

/**
 * Colored triangle mesh + wireframe — circular pond ripples synced to audio params.
 */
const DEFAULT_VIEWPORT: MathViewport = {
  yawOffset: 0,
  pitchOffset: 0,
  meshScale: DEFAULT_MATH_MESH_SCALE,
};

export function buildMathSurfaceMesh(
  width: number,
  height: number,
  timeSec: number,
  audio: AudioSurfaceParams,
  viewport: MathViewport = DEFAULT_VIEWPORT,
): MathSurfaceMesh {
  const w = Math.max(64, width);
  const h = Math.max(64, height);

  const grid: GridNode[][] = [];
  for (let j = 0; j <= GRID; j++) {
    const row: GridNode[] = [];
    const v = (j / GRID) * 2 - 1;
    for (let i = 0; i <= GRID; i++) {
      const u = (i / GRID) * 2 - 1;
      const x = u * DOMAIN;
      const y = v * DOMAIN;
      const z = pondRippleHeight(x, y, timeSec, audio);
      const {sx, sy, z: depth} = projectSurfaceIsometric(x, y, z, w, h, {
        meshScale: viewport.meshScale,
        yawOffset: viewport.yawOffset,
        pitchOffset: viewport.pitchOffset,
      });
      row.push({sx, sy, z: depth, color: colorForHeight(z)});
    }
    grid.push(row);
  }

  type Tri = {i0: number; i1: number; i2: number; depth: number};
  const tris: Tri[] = [];
  const vertices: {x: number; y: number}[] = [];
  const colors: string[] = [];

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i];
      const d = grid[j + 1][i + 1];

      const pushTri = (p0: GridNode, p1: GridNode, p2: GridNode) => {
        const base = vertices.length;
        vertices.push({x: p0.sx, y: p0.sy}, {x: p1.sx, y: p1.sy}, {x: p2.sx, y: p2.sy});
        colors.push(p0.color, p1.color, p2.color);
        tris.push({
          i0: base,
          i1: base + 1,
          i2: base + 2,
          depth: (p0.z + p1.z + p2.z) / 3,
        });
      };

      pushTri(a, b, c);
      pushTri(b, d, c);
    }
  }

  tris.sort((t1, t2) => t1.depth - t2.depth);
  const indices = tris.flatMap(t => [t.i0, t.i1, t.i2]);

  const wireB = Skia.PathBuilder.Make();
  const wireStep = 2;
  for (let j = 0; j <= GRID; j += wireStep) {
    for (let i = 0; i <= GRID; i++) {
      const p = grid[j][i];
      if (i === 0) {
        wireB.moveTo(p.sx, p.sy);
      } else {
        wireB.lineTo(p.sx, p.sy);
      }
    }
  }
  for (let i = 0; i <= GRID; i += wireStep) {
    for (let j = 0; j <= GRID; j++) {
      const p = grid[j][i];
      if (j === 0) {
        wireB.moveTo(p.sx, p.sy);
      } else {
        wireB.lineTo(p.sx, p.sy);
      }
    }
  }

  return {
    vertices,
    colors,
    indices,
    wirePath: wireB.build(),
  };
}
