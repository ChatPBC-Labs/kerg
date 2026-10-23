/** Geometry builders: jointed primitive humanoid + small living-room set. */
import * as THREE from "three";

export function buildRobot(): {
  root: THREE.Group;
  joints: Record<string, THREE.Object3D>;
  body: THREE.Group;
  head: THREE.Group;
} {
  const skin = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.35, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3441, metalness: 0.5, roughness: 0.4 });
  const jointMat = new THREE.MeshStandardMaterial({ color: 0x7f8ea3, metalness: 0.6, roughness: 0.3 });

  const robot = new THREE.Group();
  const body = new THREE.Group();
  robot.add(body);
  const joints: Record<string, THREE.Object3D> = {};

  // torso + chest plate
  const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 6, 16), skin);
  t.position.y = 1.06;
  body.add(t);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.12), dark);
  chest.position.set(0, 1.14, 0.14);
  body.add(chest);

  // head with eyes + antenna
  const head = new THREE.Group();
  head.position.y = 1.5;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), skin);
  skull.scale.set(1, 1.08, 0.94);
  head.add(skull);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x0b0f14 }),
    );
    eye.position.set(0.065 * sx, 0.03, 0.145);
    head.add(eye);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09), jointMat);
  antenna.position.y = 0.2;
  head.add(antenna);
  body.add(head);

  const limb = (len: number, r: number, mat: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    mesh.position.y = -len / 2 - r;
    pivot.add(mesh);
    return pivot;
  };

  // jointed arms + legs
  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? -1 : 1;

    const shoulder = new THREE.Group();
    shoulder.position.set(0.3 * sx, 1.3, 0);
    body.add(shoulder);
    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), jointMat));
    const upper = limb(0.24, 0.05, skin);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    upper.add(elbow);
    const fore = limb(0.22, 0.045, skin);
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), dark);
    hand.position.y = -0.315;
    fore.add(hand);

    const hip = new THREE.Group();
    hip.position.set(0.13 * sx, 0.78, 0);
    body.add(hip);
    const thigh = limb(0.3, 0.06, skin);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    thigh.add(knee);
    const shin = limb(0.28, 0.05, skin);
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), dark);
    foot.position.set(0, -0.36, 0.04);
    shin.add(foot);

    joints[`shoulder${side}`] = shoulder;
    joints[`elbow${side}`] = elbow;
    joints[`hip${side}`] = hip;
    joints[`knee${side}`] = knee;
  }

  return { root: robot, joints, body, head };
}

export function buildRoom(): THREE.Group {
  const room = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c7c52, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x47505c, roughness: 0.95 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x516c6d, roughness: 0.9 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x6c8a8c, roughness: 0.95 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.8 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), wood);
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 40),
    new THREE.MeshStandardMaterial({ color: 0x775e50, roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.006;
  room.add(rug);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), wallMat);
  wall.position.set(0, 1.6, -4);
  room.add(wall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), wallMat);
  sideWall.position.set(-4.5, 1.6, 0.5);
  sideWall.rotation.y = Math.PI / 2;
  room.add(sideWall);

  const sofa = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.42, 0.95), sofaMat);
  base.position.y = 0.21;
  sofa.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 0.22), sofaMat);
  back.position.set(0, 0.7, -0.38);
  sofa.add(back);
  for (let i = 0; i < 3; i++) {
    const cu = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.78), cushionMat);
    cu.position.set(-0.74 + i * 0.74, 0.5, -0.05);
    sofa.add(cu);
  }
  sofa.position.set(-2.9, 0, -1.4);
  sofa.rotation.y = Math.PI / 2.6;
  room.add(sofa);

  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.07, 0.75), woodDark);
  top.position.y = 0.44;
  table.add(top);
  for (const [lx, lz] of [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42), woodDark);
    leg.position.set(lx, 0.21, lz);
    table.add(leg);
  }
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.045, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xc25050 }),
  );
  mug.position.set(0.28, 0.53, 0.05);
  table.add(mug);
  table.position.set(-0.6, 0, -2.35);
  room.add(table);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.1, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xa4713d, roughness: 0.9 }),
  );
  pot.position.set(2.4, 0.11, -2.6);
  room.add(pot);
  const bush = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.55, 12),
    new THREE.MeshStandardMaterial({ color: 0x3e7d4e, roughness: 0.9 }),
  );
  bush.position.set(2.4, 0.5, -2.6);
  room.add(bush);

  return room;
}
