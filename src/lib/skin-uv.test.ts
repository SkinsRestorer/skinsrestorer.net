import assert from "node:assert/strict";
import { test } from "node:test";
import { SkinObject } from "skinview3d/libs/model.js";
import { Box3, Raycaster, Vector3, type Mesh } from "three";
import type { SkinVariant } from "./skin";
import {
  mirrorPixel,
  skinParts,
  skinRegions,
  type SkinFace,
} from "./skin-regions";
import { hitToPixel } from "./skin-uv";

const directions: Record<SkinFace, Vector3> = {
  front: new Vector3(0, 0, 1),
  back: new Vector3(0, 0, -1),
  left: new Vector3(1, 0, 0),
  right: new Vector3(-1, 0, 0),
  top: new Vector3(0, 1, 0),
  bottom: new Vector3(0, -1, 0),
};

function model(variant: SkinVariant) {
  const skin = new SkinObject();
  skin.modelType = variant === "slim" ? "slim" : "default";
  skin.updateMatrixWorld(true);
  return skin;
}

/** Cast a ray at a point on one side of a mesh, from outside the model. */
function castAt(mesh: Mesh, outward: Vector3, point: Vector3) {
  const origin = point.clone().addScaledVector(outward, 100);
  const ray = new Raycaster(origin, outward.clone().negate());
  return ray.intersectObject(mesh, false)[0];
}

for (const variant of ["classic", "slim"] as const) {
  test(`every ${variant} face center on the 3D model maps to its own texture face`, () => {
    const skin = model(variant);
    for (const part of skinParts)
      for (const layer of ["base", "outer"] as const) {
        const mesh = (
          layer === "base" ? skin[part].innerLayer : skin[part].outerLayer
        ) as Mesh;
        const box = new Box3().setFromObject(mesh);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        for (const region of skinRegions(variant).filter(
          (r) => r.part === part && r.layer === layer,
        )) {
          const outward = directions[region.face];
          const point = center
            .clone()
            .add(outward.clone().multiply(size).multiplyScalar(0.5));
          const hit = castAt(mesh, outward, point);
          assert.ok(
            hit?.uv && hit.faceIndex !== undefined,
            `${part} ${region.face}`,
          );
          const pixel = hitToPixel(
            variant,
            part,
            layer,
            hit.faceIndex!,
            hit.uv!,
          );
          assert.equal(
            pixel?.region,
            region,
            `${part} ${layer} ${region.face}`,
          );
          assert.equal(pixel?.x, region.x + Math.floor(region.width / 2));
          assert.equal(pixel?.y, region.y + Math.floor(region.height / 2));
        }
      }
  });
}

test("3D hits keep the texture orientation of the face", () => {
  const skin = model("classic");
  const head = skin.head.innerLayer as Mesh;
  // The front faces +z. The player's right side is at -x, which is the first
  // texture column of the front face.
  const front = castAt(head, directions.front, new Vector3(-3.5, 7.5, 4));
  assert.deepEqual(
    (({ x, y }) => ({ x, y }))(
      hitToPixel("classic", "head", "base", front.faceIndex!, front.uv!)!,
    ),
    { x: 8, y: 8 },
  );
  // On the left side (+x), the column next to the front is the first column.
  const left = castAt(head, directions.left, new Vector3(4, 7.5, 3.5));
  assert.deepEqual(
    (({ x, y }) => ({ x, y }))(
      hitToPixel("classic", "head", "base", left.faceIndex!, left.uv!)!,
    ),
    { x: 16, y: 8 },
  );
  // A hit exactly on an edge stays on the face that was hit.
  const edge = hitToPixel("classic", "head", "base", 8, {
    x: 16 / 64,
    y: 1 - 16 / 64,
  });
  assert.deepEqual([edge?.x, edge?.y], [15, 15]);
});

const counterpart = {
  head: "head",
  body: "body",
  rightArm: "leftArm",
  leftArm: "rightArm",
  rightLeg: "leftLeg",
  leftLeg: "rightLeg",
} as const;

for (const variant of ["classic", "slim"] as const) {
  test(`${variant} mirror pixels match the reflected point on the 3D model`, () => {
    const skin = model(variant);
    const mirror = new Vector3(-1, 1, 1);
    for (const part of skinParts)
      for (const layer of ["base", "outer"] as const) {
        const meshOf = (name: (typeof skinParts)[number]) =>
          (layer === "base"
            ? skin[name].innerLayer
            : skin[name].outerLayer) as Mesh;
        const mesh = meshOf(part);
        const other = meshOf(counterpart[part]);
        const box = new Box3().setFromObject(mesh);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        for (const region of skinRegions(variant).filter(
          (r) => r.part === part && r.layer === layer,
        )) {
          const outward = directions[region.face];
          // The two world axes along the face, matched to its pixel counts.
          const [across, down] =
            region.face === "front" || region.face === "back"
              ? (["x", "y"] as const)
              : region.face === "left" || region.face === "right"
                ? (["z", "y"] as const)
                : (["x", "z"] as const);
          const covered = new Set<number>();
          for (let i = 0; i < region.width; i++)
            for (let j = 0; j < region.height; j++) {
              const point = center
                .clone()
                .add(outward.clone().multiply(size).multiplyScalar(0.5));
              point[across] =
                box.min[across] + ((i + 0.5) / region.width) * size[across];
              point[down] =
                box.min[down] + ((j + 0.5) / region.height) * size[down];
              const hit = castAt(mesh, outward, point);
              const source = hitToPixel(
                variant,
                part,
                layer,
                hit.faceIndex!,
                hit.uv!,
              )!;
              covered.add(source.y * 64 + source.x);
              const reflected = castAt(
                other,
                outward.clone().multiply(mirror),
                point.clone().multiply(mirror),
              );
              const target = hitToPixel(
                variant,
                counterpart[part],
                layer,
                reflected.faceIndex!,
                reflected.uv!,
              )!;
              assert.deepEqual(
                mirrorPixel(variant, source.x, source.y),
                { x: target.x, y: target.y },
                `${part} ${layer} ${region.face} ${source.x},${source.y}`,
              );
            }
          // Every pixel of the face was checked.
          assert.equal(covered.size, region.width * region.height);
        }
      }
  });
}
