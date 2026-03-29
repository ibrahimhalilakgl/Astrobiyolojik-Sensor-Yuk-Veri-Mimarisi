import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  LANDING_FLOW_STEPS,
  getFlowNodePositions,
  getAiNodePosition,
} from "../../data/landingFlow";

function FlowNode({ position, color, delay = 0, active = false }) {
  const mesh = useRef(null);
  const scaleRef = useRef(0.38);
  const emissiveRef = useRef(0.06);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime * 0.35 + delay;
    mesh.current.rotation.y = t * 0.4;
    mesh.current.rotation.x = Math.sin(t * 0.3) * 0.08;

    const targetS = active ? 0.52 : 0.38;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetS, 0.06);
    mesh.current.scale.setScalar(scaleRef.current);

    const targetE = active ? 0.26 : 0.06;
    emissiveRef.current = THREE.MathUtils.lerp(emissiveRef.current, targetE, 0.08);
    const mat = mesh.current.material;
    if (mat && "emissiveIntensity" in mat) {
      mat.emissiveIntensity = emissiveRef.current;
    }
  });

  return (
    <mesh ref={mesh} position={position} castShadow receiveShadow scale={0.38}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={color}
        metalness={0.2}
        roughness={0.62}
        emissive={color}
        emissiveIntensity={0.06}
      />
    </mesh>
  );
}

function AiOrb({ position, color = "#00F2FF", active = false }) {
  const mesh = useRef(null);
  const groupRef = useRef(null);
  const emissiveRef = useRef(0.12);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    mesh.current.rotation.y = t * 0.55;
    mesh.current.rotation.z = t * 0.2;
    mesh.current.position.y = Math.sin(t * 0.8) * 0.06;

    const targetE = active ? 0.35 : 0.12;
    emissiveRef.current = THREE.MathUtils.lerp(emissiveRef.current, targetE, 0.08);
    const mat = mesh.current.material;
    if (mat && "emissiveIntensity" in mat) {
      mat.emissiveIntensity = emissiveRef.current;
    }
    if (groupRef.current) {
      const ts = active ? 1.08 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(ts, ts, ts), 0.06);
    }
  });

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]} scale={1}>
      <mesh ref={mesh} castShadow>
        <torusKnotGeometry args={[0.32, 0.09, 64, 12]} />
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.45}
          emissive={color}
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh position={[0, 0, 0]} scale={1.35}>
        <sphereGeometry args={[0.52, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.12 : 0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DataArc({ points, color }) {
  const curve = useMemo(() => {
    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.35);
  }, [points]);
  const sampled = useMemo(() => curve.getPoints(64), [curve]);
  return (
    <Line
      points={sampled}
      color={color}
      lineWidth={1.2}
      transparent
      opacity={0.55}
    />
  );
}

function BranchLines({ from, via, to, color, active }) {
  const opacity = active ? 0.72 : 0.4;
  return (
    <>
      <Line
        points={[from, via]}
        color={color}
        lineWidth={1}
        transparent
        opacity={opacity}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      <Line
        points={[via, to]}
        color={color}
        lineWidth={1}
        transparent
        opacity={opacity}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
    </>
  );
}

function SceneContent({ activeStepIndex = null, aiActive = false }) {
  const positions = useMemo(() => getFlowNodePositions(LANDING_FLOW_STEPS.length), []);
  const aiPos = useMemo(() => getAiNodePosition(positions), [positions]);
  const p2 = positions[2];
  const p3 = positions[3];
  const mainPathPoints = useMemo(() => [...positions], [positions]);
  const branchHot = aiActive || (activeStepIndex === 2 || activeStepIndex === 3);

  return (
    <>
      <color attach="background" args={["#12151c"]} />
      <fog attach="fog" args={["#12151c", 8, 22]} />

      <ambientLight intensity={0.38} />
      <directionalLight
        position={[6, 10, 8]}
        intensity={0.55}
        color="#d4e4f0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 4, -6]} intensity={0.22} color="#c4b8dc" />
      <pointLight position={[0, 2.5, 2]} intensity={0.15} color="#a8c4c8" distance={12} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]} receiveShadow>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#161b24" roughness={0.92} metalness={0.05} />
      </mesh>

      <DataArc points={mainPathPoints} color="#4a5568" />

      {LANDING_FLOW_STEPS.map((step, i) => (
        <FlowNode
          key={step.id}
          position={positions[i]}
          color={step.color}
          delay={i * 0.4}
          active={activeStepIndex === i}
        />
      ))}

      <BranchLines
        from={p2}
        via={aiPos}
        to={p3}
        color={branchHot ? "#a894c4" : "#7a6b8a"}
        active={branchHot}
      />
      <AiOrb position={aiPos} active={aiActive} />

      <OrbitControls
        enableZoom={true}
        minDistance={6}
        maxDistance={14}
        autoRotate
        autoRotateSpeed={aiActive ? 0.55 : 0.35}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 5}
        target={[0, 0.2, 0]}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

export default function FlowScene3D({ activeStepIndex = null, aiActive = false }) {
  return (
    <div className="h-full w-full min-h-[280px] rounded-xl overflow-hidden border border-white/[0.06] bg-[#12151c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 2.4, 9.2], fov: 42, near: 0.1, far: 40 }}
      >
        <SceneContent activeStepIndex={activeStepIndex} aiActive={aiActive} />
      </Canvas>
    </div>
  );
}
