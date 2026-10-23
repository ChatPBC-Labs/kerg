/**
 * Robot3D — three.js playground: a jointed humanoid (pure primitives, no
 * external assets) in a small living-room scene. Behavior is driven
 * imperatively via the PlaygroundHandle API using ruleEngine decisions.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Action } from "./ruleEngine";
import { buildRobot, buildRoom } from "./scene";

export interface ActionOpts {
  durationMs: number;
  speedFactor: number;
  bubble?: string;
  faceUser?: boolean;
}

export interface PlaygroundHandle {
  play(action: Action, opts: ActionOpts): void;
  setBubble(text: string | null): void;
}

type Running = { mode: "running"; action: Action; prog: number; durationMs: number; speedFactor: number; faceUser: boolean };
type Idle = { mode: "idle" };
type Pose = Running | Idle;

export const Robot3D = forwardRef<PlaygroundHandle>(function Robot3D(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<Pose>({ mode: "idle" });
  const threeRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    play(action: Action, opts: ActionOpts) {
      poseRef.current = {
        mode: "running",
        action,
        prog: 0,
        durationMs: Math.max(200, opts.durationMs || 1500),
        speedFactor: opts.speedFactor || 1,
        faceUser: !!opts.faceUser,
      };
      setOverlayBubble(opts.bubble ?? null);
    },
    setBubble(text: string | null) {
      setOverlayBubble(text);
    },
  }));

  function setOverlayBubble(text: string | null) {
    const el = bubbleRef.current;
    if (!el) return;
    el.textContent = text ?? "";
    el.style.opacity = text ? "1" : "0";
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12161c);
    scene.fog = new THREE.Fog(0x12161c, 9, 17);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 40);
    camera.position.set(2.7, 1.9, 4.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(2.5, 4.5, 3);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-3, 2, -1);
    scene.add(fill);

    scene.add(buildRoom());
    const { joints } = buildRobot();
    const robot = joints.body.parent as THREE.Group;
    scene.add(robot);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;

    const resize = () => {
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 420;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const ease = (t: number) => t * t * (3 - 2 * t);
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const J = joints as Record<string, THREE.Object3D | any>;
    const bodyJ = J.body;
    const headJ = J.head;
    const bubbleAnchor = new THREE.Vector3();
    let last = performance.now();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // neutral pose every frame (no drift)
      for (const k of Object.keys(J)) if (k !== "body" && k !== "head") J[k].rotation.set(0, 0, 0);
      robot.position.set(0, 0, 0);
      bodyJ.rotation.set(0, 0, 0);
      headJ.rotation.set(0, 0, 0);

      // idle breathing + wandering gaze
      const t = now / 1000;
      const breathe = Math.sin(t * 1.6) * 0.5 + 0.5;
      bodyJ.position.y = 0.008 * breathe;
      J.shoulderL.rotation.z = 0.08 + 0.02 * breathe;
      J.shoulderR.rotation.z = -0.08 - 0.02 * breathe;
      headJ.rotation.y = Math.sin(t * 0.4) * 0.12;

      const pose = poseRef.current;
      if (pose.mode === "running") {
        pose.prog += (dt * 1000 * pose.speedFactor) / Math.max(1, pose.durationMs);
        const p = clamp(pose.prog, 0, 1);
        const q = ease(p);
        switch (pose.action) {
          case "wave": {
            J.shoulderR.rotation.z = -2.05 * q;
            J.elbowR.rotation.z = -0.5 * q + Math.sin(p * Math.PI * 5) * 0.55 * q;
            headJ.rotation.z = 0.12 * q;
            if (pose.faceUser) headJ.rotation.y = 0.5 * q;
            break;
          }
          case "walk": {
            const ph = p * Math.PI * 6;
            J.hipL.rotation.x = Math.sin(ph) * 0.5 * q;
            J.hipR.rotation.x = -Math.sin(ph) * 0.5 * q;
            J.kneeL.rotation.x = Math.max(0, Math.sin(ph - 0.9)) * 0.7 * q;
            J.kneeR.rotation.x = Math.max(0, Math.sin(ph - 0.9 + Math.PI)) * 0.7 * q;
            J.shoulderL.rotation.x = -Math.sin(ph) * 0.45 * q;
            J.shoulderR.rotation.x = Math.sin(ph) * 0.45 * q;
            bodyJ.position.y = Math.abs(Math.sin(ph)) * 0.04 * q;
            break;
          }
          case "sit": {
            J.hipL.rotation.x = 1.35 * q;
            J.hipR.rotation.x = 1.35 * q;
            J.kneeL.rotation.x = -1.75 * q;
            J.kneeR.rotation.x = -1.75 * q;
            bodyJ.position.y = -0.36 * q;
            bodyJ.rotation.x = 0.1 * q;
            J.shoulderL.rotation.x = 0.25 * q;
            J.shoulderR.rotation.x = 0.25 * q;
            J.elbowL.rotation.x = -0.6 * q;
            J.elbowR.rotation.x = -0.6 * q;
            break;
          }
          case "dance": {
            const dph = p * Math.PI * 4;
            bodyJ.rotation.y = Math.sin(dph) * 0.35 * q;
            bodyJ.position.y = Math.abs(Math.sin(dph * 2)) * 0.05 * q;
            J.shoulderL.rotation.z = 2.1 + Math.sin(dph) * 0.35;
            J.shoulderR.rotation.z = -2.1 - Math.sin(dph + Math.PI) * 0.35;
            headJ.rotation.z = Math.sin(dph) * 0.18 * q;
            break;
          }
          case "speak": {
            headJ.rotation.x = Math.sin(p * Math.PI * 5) * 0.09 * q;
            bodyJ.rotation.y = Math.sin(t * 1.2) * 0.06;
            if (pose.faceUser) headJ.rotation.y = 0.45 * q;
            break;
          }
          case "pick": {
            const reach = Math.sin(p * Math.PI);
            bodyJ.rotation.x = 0.3 * reach * q;
            J.shoulderR.rotation.x = -1.25 * reach * q;
            J.shoulderR.rotation.z = -0.25 * reach * q;
            J.elbowR.rotation.x = -0.55 * reach * q + 0.3;
            bodyJ.position.y = -0.08 * reach * q;
            break;
          }
          case "kitchen": {
            // only reachable when the constitution allows; gentle walk loop
            const ph = p * Math.PI * 6;
            J.hipL.rotation.x = Math.sin(ph) * 0.45 * q;
            J.hipR.rotation.x = -Math.sin(ph) * 0.45 * q;
            J.shoulderL.rotation.x = -Math.sin(ph) * 0.4 * q;
            J.shoulderR.rotation.x = Math.sin(ph) * 0.4 * q;
            break;
          }
        }
        if (pose.prog >= 1) {
          poseRef.current = { mode: "idle" } as Idle;
          setOverlayBubble(null);
        }
      }

      // speech bubble anchored to the head
      const el = bubbleRef.current;
      if (el && el.style.opacity === "1") {
        bubbleAnchor.set(0, 1.98, 0).applyMatrix4(robot.matrixWorld);
        bubbleAnchor.project(camera);
        el.style.left = `${(bubbleAnchor.x * 0.5 + 0.5) * 100}%`;
        el.style.top = `${(-bubbleAnchor.y * 0.5 + 0.5) * 100}%`;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 420, overflow: "hidden" }}
    >
      <div
        ref={bubbleRef}
        style={{
          position: "absolute",
          transform: "translate(-50%, -120%)",
          background: "#ffffff",
          color: "#1a202c",
          padding: "6px 10px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          opacity: 0,
          transition: "opacity 0.25s",
          pointerEvents: "none",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
});
