import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Text, Sphere } from '@react-three/drei';
import { Play, Pause, RotateCcw, Camera, Globe, Moon, Zap, User, Weight, Settings, Eye, Home, Lock, Unlock, ChevronDown } from 'lucide-react';
import * as THREE from 'three';

// 物理定数
const GRAVITY_CONSTANTS = {
  earth: 9.81,
  moon: 1.62,
  mars: 3.71,
  space: 0 // 無重力環境
};

const ARM_LENGTH = 4; // 回転軸からユニバーサルまでの距離
const BOX_MASS = 50; // kg（箱の質量）

// 慣性物理定数
const BOX_MOMENT_OF_INERTIA = BOX_MASS * 1.2 * 1.2 / 6; // 箱の慣性モーメント
const ANGULAR_DAMPING = 0.88; // 角速度減衰
const INERTIA_RESPONSE_FACTOR = 0.12; // 慣性応答係数
const GRAVITY_ALIGNMENT_SPEED = 1.5; // 重力方向への整列速度
const CENTRIFUGAL_BULGE_FACTOR = 0.8; // 遠心力ふくらみ係数

// 惑星データ
const PLANET_DATA = {
  earth: { name: '地球', gravity: 9.81, color: '#3b82f6', radius: 8 },
  moon: { name: '月', gravity: 1.62, color: '#94a3b8', radius: 6 },
  mars: { name: '火星', gravity: 3.71, color: '#8b4513', radius: 7 },
  space: { name: '宇宙空間', gravity: 0, color: '#000000', radius: 0 }
};

// 箱の種類データ
const BOX_TYPES = {
  cube: { name: '立方体', dimensions: [1.2, 1.2, 1.2] },
  rectangle: { name: '長方形', dimensions: [1.8, 1.2, 1.2] },
  sphere: { name: '球体', dimensions: [1.2, 1.2, 1.2] } // 直径1.2mの球体
};

// 居住区データ
const HABITAT_CONFIGS = {
  single: { name: '単一居住区', count: 1 },
  dual: { name: '2居住区', count: 2 },
  quad: { name: '4居住区', count: 4 },
  hexa: { name: '6居住区', count: 6 },
  octa: { name: '8居住区', count: 8 }
};

// カメラモードデータ
const CAMERA_MODES = {
  external: { name: '外観視点', position: [12, 8, 12], target: [0, 0, 0] },
  internal: { name: '箱内視点', position: [4, -0.8, 0.3], target: [4, -0.8, 0] },
  universal: { name: 'ユニバーサル視点', position: [4, 0.5, 1.0], target: [4, 0, 0] },
  top: { name: '上面視点', position: [0, 15, 0], target: [0, 0, 0] }
};

// プルダウンコンポーネント
function Dropdown({ 
  label, 
  value, 
  options, 
  onChange, 
  className = "" 
}: { 
  label: string;
  value: string;
  options: { [key: string]: { name: string } };
  onChange: (value: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-slate-300 text-sm mb-2">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
      >
        <span>{options[value]?.name || value}</span>
        <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50">
          {Object.entries(options).map(([key, option]) => (
            <button
              key={key}
              onClick={() => {
                onChange(key);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-slate-600 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === key ? 'bg-blue-600 text-white' : 'text-slate-300'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// メイン回転機構（回転軸）
function MainRotatingMechanism({ rpm, isRotating, planet, personMass, connectingArmLength, habitatCount, rotationLocked, boxType, boxSize }: { 
  rpm: number; 
  isRotating: boolean; 
  planet: keyof typeof PLANET_DATA;
  personMass: number;
  connectingArmLength: number;
  habitatCount: number;
  rotationLocked: boolean;
  boxType: keyof typeof BOX_TYPES;
  boxSize: number;
}) {
  const mechanismRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (mechanismRef.current && isRotating) {
      const angularVelocity = (rpm * 2 * Math.PI) / 60; // RPMをrad/sに変換
      mechanismRef.current.rotation.y += angularVelocity * delta;
    }
  });

  return (
    <group ref={mechanismRef}>
      {/* 中央回転軸（明るい青色の円筒） */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 2, 32]} />
        <meshStandardMaterial 
          color="#60a5fa" 
          metalness={0.8} 
          roughness={0.2}
          emissive="#3b82f6"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* 回転軸の中心軸（明るい赤色） */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 2.5, 16]} />
        <meshStandardMaterial 
          color="#f87171" 
          metalness={0.9} 
          roughness={0.1}
          emissive="#dc2626"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* 複数の水平アーム（居住区の数に応じて配置） */}
      {Array.from({ length: habitatCount }, (_, index) => {
        const angle = (index * 2 * Math.PI) / habitatCount;
        
        return (
          <group key={index} position={[0, 0, 0]} rotation={[0, angle, 0]}>
            <HorizontalArmToUniversal 
              rpm={rpm} 
              isRotating={isRotating} 
              planet={planet} 
              personMass={personMass}
              connectingArmLength={connectingArmLength}
              habitatIndex={index}
              rotationLocked={rotationLocked}
              boxType={boxType}
              boxSize={boxSize}
            />
          </group>
        );
      })}
    </group>
  );
}

// 水平アーム（回転軸→ユニバーサル）
function HorizontalArmToUniversal({ rpm, isRotating, planet, personMass, connectingArmLength, habitatIndex, rotationLocked, boxType, boxSize }: { 
  rpm: number; 
  isRotating: boolean; 
  planet: keyof typeof PLANET_DATA;
  personMass: number;
  connectingArmLength: number;
  habitatIndex: number;
  rotationLocked: boolean;
  boxType: keyof typeof BOX_TYPES;
  boxSize: number;
}) {
  return (
    <group>
      {/* 水平アーム本体 */}
      <mesh position={[ARM_LENGTH / 2, 0, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[ARM_LENGTH, 0.15, 0.15]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* アーム先端のユニバーサルジョイント */}
      <group position={[ARM_LENGTH, 0, 0]}>
        <UniversalJointAssembly 
          rpm={rpm} 
          isRotating={isRotating} 
          planet={planet} 
          personMass={personMass}
          connectingArmLength={connectingArmLength}
          habitatIndex={habitatIndex}
          rotationLocked={rotationLocked}
          boxType={boxType}
          boxSize={boxSize}
        />
      </group>
    </group>
  );
}

// ユニバーサルジョイント組立体
function UniversalJointAssembly({ rpm, isRotating, planet, personMass, connectingArmLength, habitatIndex, rotationLocked, boxType, boxSize }: { 
  rpm: number; 
  isRotating: boolean; 
  planet: keyof typeof PLANET_DATA;
  personMass: number;
  connectingArmLength: number;
  habitatIndex: number;
  rotationLocked: boolean;
  boxType: keyof typeof BOX_TYPES;
  boxSize: number;
}) {
  const universalJointRef = useRef<THREE.Group>(null);
  const [jointAngles, setJointAngles] = useState({ x: 0, z: 0 });
  const [angularVelocities, setAngularVelocities] = useState({ x: 0, z: 0 });
  
  useFrame((state, delta) => {
    const planetGravity = PLANET_DATA[planet].gravity;
    const totalMass = BOX_MASS + personMass;
    
    if (isRotating && rpm > 0) {
      // 遠心力計算
      const angularVelocity = (rpm * 2 * Math.PI) / 60;
      const centrifugalAcceleration = angularVelocity * angularVelocity * ARM_LENGTH;
      
      // 目標角度（重力と遠心力の合成）
      let targetAngleZ;
      if (planet === 'space') {
        // 無重力環境では完全に外側（水平）を向く
        targetAngleZ = Math.PI / 2; // 90度
      } else {
        targetAngleZ = Math.atan(centrifugalAcceleration / planetGravity);
      }
      
      const maxAngle = Math.PI / 2; // 最大90度
      const clampedTargetZ = Math.min(targetAngleZ, maxAngle);
      const targetAngleX = 0; // X軸は中立
      
      // 質量による慣性効果
      const massInertiaFactor = Math.sqrt(totalMass / 50);
      const responseSpeed = GRAVITY_ALIGNMENT_SPEED / massInertiaFactor;
      
      // 角度差
      const angleDiffZ = clampedTargetZ - jointAngles.z;
      const angleDiffX = targetAngleX - jointAngles.x;
      
      // 角速度更新
      const newVelocities = {
        x: (angularVelocities.x + angleDiffX * responseSpeed * delta) * ANGULAR_DAMPING,
        z: (angularVelocities.z + angleDiffZ * responseSpeed * delta) * ANGULAR_DAMPING
      };
      
      // 新しい角度
      const newAngles = {
        x: jointAngles.x + newVelocities.x * delta,
        z: jointAngles.z + newVelocities.z * delta
      };
      
      setJointAngles(newAngles);
      setAngularVelocities(newVelocities);
      
      // ユニバーサルジョイントの回転適用
      if (universalJointRef.current) {
        universalJointRef.current.rotation.x = newAngles.x;
        universalJointRef.current.rotation.z = newAngles.z;
      }
    } else {
      // 停止時の処理を惑星別に分ける
      if (planet === 'space') {
        // 無重力環境では現在の角度を維持（下がらない）
        // 角速度のみ減衰させる
        const newVelocities = {
          x: angularVelocities.x * ANGULAR_DAMPING,
          z: angularVelocities.z * ANGULAR_DAMPING
        };
        
        setAngularVelocities(newVelocities);
        
        // 角度は現在の位置を維持
        if (universalJointRef.current) {
          universalJointRef.current.rotation.x = jointAngles.x;
          universalJointRef.current.rotation.z = jointAngles.z;
        }
      } else {
        // 惑星重力環境では重力で垂直に戻る
        const returnSpeed = GRAVITY_ALIGNMENT_SPEED * 1.5;
        
        const angleDiffX = -jointAngles.x;
        const angleDiffZ = -jointAngles.z;
        
        const newVelocities = {
          x: (angularVelocities.x + angleDiffX * returnSpeed * delta) * ANGULAR_DAMPING,
          z: (angularVelocities.z + angleDiffZ * returnSpeed * delta) * ANGULAR_DAMPING
        };
        
        const newAngles = {
          x: jointAngles.x + newVelocities.x * delta,
          z: jointAngles.z + newVelocities.z * delta
        };
        
        setJointAngles(newAngles);
        setAngularVelocities(newVelocities);
        
        if (universalJointRef.current) {
          universalJointRef.current.rotation.x = newAngles.x;
          universalJointRef.current.rotation.z = newAngles.z;
        }
      }
    }
  });

  return (
    <group>
      {/* ユニバーサルジョイント固定部（青い円筒） */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 16]} />
        <meshStandardMaterial color="#1e40af" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* ユニバーサルジョイント球体部 */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* ユニバーサルジョイント可動部（X軸・Z軸に自由に動く） */}
      <group ref={universalJointRef}>
        {/* X軸ピン（赤） */}
        <mesh rotation={[0, Math.PI/2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 12]} />
          <meshStandardMaterial color="#dc2626" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Z軸ピン（赤） */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 12]} />
          <meshStandardMaterial color="#dc2626" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* ユニバーサルから箱への接続アーム */}
        <ConnectingArmToBox 
          rpm={rpm} 
          isRotating={isRotating} 
          planet={planet} 
          personMass={personMass}
          jointAngles={jointAngles}
          connectingArmLength={connectingArmLength}
          habitatIndex={habitatIndex}
          rotationLocked={rotationLocked}
          boxType={boxType}
          boxSize={boxSize}
        />
      </group>
    </group>
  );
}

// 接続アーム（ユニバーサル→箱）- 遠心加速逆慣性力（Y軸後ろ）効果付き
function ConnectingArmToBox({ rpm, isRotating, planet, personMass, jointAngles, connectingArmLength, habitatIndex, rotationLocked, boxType, boxSize }: { 
  rpm: number; 
  isRotating: boolean; 
  planet: keyof typeof PLANET_DATA;
  personMass: number;
  jointAngles: { x: number; z: number };
  connectingArmLength: number;
  habitatIndex: number;
  rotationLocked: boolean;
  boxType: keyof typeof BOX_TYPES;
  boxSize: number;
}) {
  const armRef = useRef<THREE.Group>(null);
  const [inertialLagAngle, setInertialLagAngle] = useState(0);
  
  useFrame((state, delta) => {
    const planetGravity = PLANET_DATA[planet].gravity;
    
    if (isRotating && rpm > 0) {
      // 遠心力計算
      const angularVelocity = (rpm * 2 * Math.PI) / 60;
      const centrifugalAcceleration = angularVelocity * angularVelocity * ARM_LENGTH;
      
      // 遠心加速逆慣性力（Y軸後ろ方向への遅れ角度）
      let targetLagAngle;
      if (planet === 'space') {
        // 無重力環境では慣性効果が軽減される
        targetLagAngle = Math.atan(centrifugalAcceleration / 10) * CENTRIFUGAL_BULGE_FACTOR * 0.3;
      } else {
        targetLagAngle = Math.atan(centrifugalAcceleration / planetGravity) * CENTRIFUGAL_BULGE_FACTOR;
      }
      
      const maxLagAngle = Math.PI / 6; // 最大30度
      const clampedLagAngle = Math.min(targetLagAngle, maxLagAngle);
      
      // 慣性による遅れ効果
      const lagSpeed = 2.0;
      const angleDiff = clampedLagAngle - inertialLagAngle;
      const newLagAngle = inertialLagAngle + angleDiff * lagSpeed * delta;
      
      setInertialLagAngle(newLagAngle);
      
      // アームの傾き適用（Y軸後ろ方向の遠心加速逆慣性力）
      if (armRef.current) {
        armRef.current.rotation.x = -newLagAngle; // Y軸後ろ方向（-X回転）
      }
    } else {
      // 停止時の処理を惑星別に分ける
      if (planet === 'space') {
        // 無重力環境では現在の角度を維持
        if (armRef.current) {
          armRef.current.rotation.x = -inertialLagAngle;
        }
      } else {
        // 惑星重力環境では垂直に戻る
        const returnSpeed = 3.0;
        const angleDiff = -inertialLagAngle;
        const newLagAngle = inertialLagAngle + angleDiff * returnSpeed * delta;
        
        setInertialLagAngle(newLagAngle);
        
        if (armRef.current) {
          armRef.current.rotation.x = -newLagAngle;
        }
      }
    }
  });

  return (
    <group ref={armRef}>
      {/* 垂直接続アーム（ユニバーサルから箱まで） - 遠心加速逆慣性力効果 */}
      <mesh position={[0, -connectingArmLength/2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, connectingArmLength, 12]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* アーム先端の接続部 */}
      <mesh position={[0, -connectingArmLength, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* 箱型居住区（アームの先端に固定接続） */}
      <group position={[0, -connectingArmLength - (boxType === 'sphere' ? boxSize/2 : BOX_TYPES[boxType].dimensions[1]/2), 0]}>
        <BoxHabitat 
          rpm={rpm} 
          isRotating={isRotating} 
          planet={planet} 
          personMass={personMass}
          jointAngles={jointAngles}
          connectingArmLength={connectingArmLength}
          inertialLagAngle={inertialLagAngle}
          habitatIndex={habitatIndex}
          rotationLocked={rotationLocked}
          boxType={boxType}
          boxSize={boxSize}
        />
      </group>
    </group>
  );
}

// 箱型居住区（正確な座標系と人の回転方向向き）
function BoxHabitat({ rpm, isRotating, planet, personMass, jointAngles, connectingArmLength, inertialLagAngle, habitatIndex, rotationLocked, boxType, boxSize }: { 
  rpm: number; 
  isRotating: boolean; 
  planet: keyof typeof PLANET_DATA;
  personMass: number;
  jointAngles: { x: number; z: number };
  connectingArmLength: number;
  inertialLagAngle: number;
  habitatIndex: number;
  rotationLocked: boolean;
  boxType: keyof typeof BOX_TYPES;
  boxSize: number;
}) {
  const boxRef = useRef<THREE.Group>(null);
  const personRef = useRef<THREE.Group>(null);
  const gravityArrowRef = useRef<THREE.Group>(null);
  const centrifugalArrowRef = useRef<THREE.Group>(null);
  const [boxRotation, setBoxRotation] = useState(0);
  
  // 箱の寸法を取得
  const boxDimensions = BOX_TYPES[boxType].dimensions.map(dim => dim * boxSize);
  
  useFrame((state, delta) => {
    const planetGravity = PLANET_DATA[planet].gravity;
    const totalMass = BOX_MASS + personMass;
    
    if (isRotating && rpm > 0) {
      // 遠心力計算
      const angularVelocity = (rpm * 2 * Math.PI) / 60;
      const centrifugalAcceleration = angularVelocity * angularVelocity * ARM_LENGTH;
      
      // 合成重力計算
      const totalGravity = planet === 'space' ? 
        centrifugalAcceleration : 
        Math.sqrt(centrifugalAcceleration * centrifugalAcceleration + planetGravity * planetGravity);
      
      // 重力方向角度（箱内での重力方向）
      const gravityAngle = planet === 'space' ? 
        Math.PI / 2 : // 無重力では90度（完全に外側）
        Math.atan2(centrifugalAcceleration, planetGravity);
      
      // 箱の自己回転制御
      if (rotationLocked && boxRef.current) {
        // 回転固定：箱が常に一定方向を向く
        const targetRotation = -angularVelocity * state.clock.getElapsedTime();
        setBoxRotation(targetRotation);
        boxRef.current.rotation.y = targetRotation;
      } else if (boxRef.current) {
        // 自由回転：箱は遠心力に追従
        boxRef.current.rotation.y = 0;
        setBoxRotation(0);
      }
      
      // 重力矢印の表示（無重力では非表示）
      if (gravityArrowRef.current) {
        if (planet === 'space') {
          gravityArrowRef.current.visible = false;
        } else {
          gravityArrowRef.current.visible = true;
          const gravityStrength = Math.min(planetGravity / GRAVITY_CONSTANTS.earth, 2);
          gravityArrowRef.current.scale.y = gravityStrength;
          gravityArrowRef.current.position.set(0, -boxDimensions[1]/2 + 0.1, 0);
          gravityArrowRef.current.rotation.set(0, 0, 0);
        }
      }
      
      // 遠心力矢印の表示
      if (centrifugalArrowRef.current) {
        const centrifugalStrength = Math.min(centrifugalAcceleration / GRAVITY_CONSTANTS.earth, 3);
        centrifugalArrowRef.current.scale.y = centrifugalStrength;
        centrifugalArrowRef.current.position.set(boxDimensions[0]/2 - 0.1, 0, 0);
        centrifugalArrowRef.current.rotation.set(0, 0, -Math.PI/2);
      }
      
      // 人の回転方向向きと重力追従（床に垂直に立つ）
      if (personRef.current) {
        // 球体の場合は球の底部に床面を設定
        const baseY = boxType === 'sphere' ? 
          -boxSize/2 + 0.1 + 0.4 : // 球体：球の底部 + 床厚み + 人の高さ
          -boxDimensions[1]/2 + 0.4; // 他の形状：箱の底部 + 人の高さ
        
        // 人の位置（床面に固定）
        personRef.current.position.set(0, baseY, 0);
        
        // 人の姿勢制御
        if (planet === 'space') {
          // 無重力環境：遠心力方向を「下」として立つ
          const rotationDirection = angularVelocity > 0 ? Math.PI/2 : -Math.PI/2;
          personRef.current.rotation.y = rotationDirection;
          personRef.current.rotation.z = 0;
          personRef.current.rotation.x = 0;
        } else {
          // 惑星重力環境：回転方向を向く + 床に垂直に立つ
          const rotationDirection = angularVelocity > 0 ? Math.PI/2 : -Math.PI/2;
          personRef.current.rotation.y = rotationDirection;
          
          // 床に垂直に立つ（重力の影響で少し傾くが基本は垂直）
          const gravityTiltEffect = gravityAngle * 0.1;
          personRef.current.rotation.z = gravityTiltEffect;
          personRef.current.rotation.x = 0;
        }
        
        // 箱の自己回転に追従
        if (rotationLocked) {
          personRef.current.rotation.y += boxRotation;
        }
        
        // 質量による微調整（呼吸のような微細な動き）
        const massEffect = (personMass / 70) * 0.1;
        const timeEffect = Math.sin(state.clock.getElapsedTime() * 2) * massEffect * 0.02;
        personRef.current.rotation.y += timeEffect;
      }
    } else {
      // 停止時の復帰処理を惑星別に分ける
      if (boxRef.current) {
        if (planet === 'space') {
          // 無重力環境では現在の回転を維持
          if (rotationLocked) {
            boxRef.current.rotation.y = boxRotation;
          }
        } else {
          // 惑星重力環境では垂直に戻る
          boxRef.current.rotation.y = THREE.MathUtils.lerp(boxRef.current.rotation.y, 0, delta * 3);
          setBoxRotation(0);
        }
      }
      
      if (gravityArrowRef.current) {
        gravityArrowRef.current.visible = planet !== 'space';
        gravityArrowRef.current.scale.y = 1;
        gravityArrowRef.current.position.set(0, -boxDimensions[1]/2 + 0.1, 0);
        gravityArrowRef.current.rotation.set(0, 0, 0);
      }
      
      if (centrifugalArrowRef.current) {
        centrifugalArrowRef.current.scale.y = 0.1;
        centrifugalArrowRef.current.position.set(boxDimensions[0]/2 - 0.1, 0, 0);
        centrifugalArrowRef.current.rotation.set(0, 0, -Math.PI/2);
      }
      
      if (personRef.current) {
        // 球体の場合は球の底部に床面を設定
        const baseY = boxType === 'sphere' ? 
          -boxSize/2 + 0.1 + 0.4 : // 球体：球の底部 + 床厚み + 人の高さ
          -boxDimensions[1]/2 + 0.4; // 他の形状：箱の底部 + 人の高さ
        
        // 人を中央の直立姿勢に戻す（正面向き、床に垂直）
        personRef.current.position.set(0, baseY, 0);
        
        if (planet === 'space') {
          // 無重力環境では現在の姿勢を維持
          // 特に変更しない
        } else {
          // 惑星重力環境では直立姿勢に戻る
          personRef.current.rotation.x = THREE.MathUtils.lerp(personRef.current.rotation.x, 0, delta * 3);
          personRef.current.rotation.y = THREE.MathUtils.lerp(personRef.current.rotation.y, 0, delta * 3);
          personRef.current.rotation.z = THREE.MathUtils.lerp(personRef.current.rotation.z, 0, delta * 3);
        }
      }
    }
  });

  // 箱の形状に応じたレンダリング
  const renderHabitat = () => {
    if (boxType === 'sphere') {
      return (
        <>
          {/* 球体の外殻（半透明ワイヤーフレーム） */}
          <mesh>
            <sphereGeometry args={[boxSize/2, 32, 32]} />
            <meshStandardMaterial 
              color="#64748b" 
              transparent 
              opacity={0.3} 
              wireframe={true}
            />
          </mesh>
          
          {/* 球体の床面（球の底部に平面） */}
          <mesh position={[0, -boxSize/2 + 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[boxSize/3, 32]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          
          {/* 球体の床面グリッド（放射状） */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <mesh 
                key={`radial-${i}`} 
                position={[0, -boxSize/2 + 0.105, 0]} 
                rotation={[-Math.PI/2, 0, angle]}
              >
                <boxGeometry args={[boxSize/3, 0.005, 0.01]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
            );
          })}
          
          {/* 球体の床面グリッド（同心円） */}
          {[0.1, 0.2, 0.3].map((radius, i) => (
            <mesh 
              key={`circle-${i}`} 
              position={[0, -boxSize/2 + 0.105, 0]} 
              rotation={[-Math.PI/2, 0, 0]}
            >
              <ringGeometry args={[radius * boxSize, radius * boxSize + 0.01, 32]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          ))}
        </>
      );
    } else {
      // 立方体・長方形の場合
      return (
        <>
          {/* 箱の枠組み（立方体/長方形フレーム） */}
          {/* 上下の正方形/長方形枠 */}
          {[-boxDimensions[1]/2, boxDimensions[1]/2].map((y, i) => (
            <group key={`frame-${i}`}>
              <mesh position={[0, y, -boxDimensions[2]/2]}>
                <boxGeometry args={[boxDimensions[0], 0.02, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[0, y, boxDimensions[2]/2]}>
                <boxGeometry args={[boxDimensions[0], 0.02, 0.02]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[-boxDimensions[0]/2, y, 0]}>
                <boxGeometry args={[0.02, 0.02, boxDimensions[2]]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[boxDimensions[0]/2, y, 0]}>
                <boxGeometry args={[0.02, 0.02, boxDimensions[2]]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
            </group>
          ))}
          
          {/* 垂直の枠（4つの角） */}
          {[
            [-boxDimensions[0]/2, 0, -boxDimensions[2]/2], [boxDimensions[0]/2, 0, -boxDimensions[2]/2],
            [-boxDimensions[0]/2, 0, boxDimensions[2]/2], [boxDimensions[0]/2, 0, boxDimensions[2]/2]
          ].map((pos, i) => (
            <mesh key={`vertical-${i}`} position={pos}>
              <boxGeometry args={[0.02, boxDimensions[1], 0.02]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          ))}
          
          {/* 床面（箱と一体で動く） */}
          <mesh position={[0, -boxDimensions[1]/2 + 0.02, 0]}>
            <boxGeometry args={[boxDimensions[0] - 0.1, 0.04, boxDimensions[2] - 0.1]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          
          {/* 床面のグリッド模様（箱と一体） */}
          {Array.from({ length: Math.floor(boxDimensions[0] * 4) }, (_, i) => (
            <group key={`grid-${i}`}>
              <mesh position={[(-boxDimensions[0]/2 + 0.1) + (i * 0.25), -boxDimensions[1]/2 + 0.025, 0]}>
                <boxGeometry args={[0.01, 0.005, boxDimensions[2] - 0.1]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              {i < Math.floor(boxDimensions[2] * 4) && (
                <mesh position={[0, -boxDimensions[1]/2 + 0.025, (-boxDimensions[2]/2 + 0.1) + (i * 0.25)]}>
                  <boxGeometry args={[boxDimensions[0] - 0.1, 0.005, 0.01]} />
                  <meshStandardMaterial color="#64748b" />
                </mesh>
              )}
            </group>
          ))}
        </>
      );
    }
  };

  return (
    <group ref={boxRef}>
      {/* 箱の天井接続ポイント（アームとの固定接続） */}
      <mesh position={[0, boxType === 'sphere' ? boxSize/2 : boxDimensions[1]/2, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* 居住区番号表示 */}
      <Text
        position={[0, (boxType === 'sphere' ? boxSize/2 : boxDimensions[1]/2) + 0.2, 0]}
        fontSize={0.1}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        居住区 #{habitatIndex + 1}
      </Text>
      
      {/* 回転固定状態表示 */}
      <mesh position={[0, (boxType === 'sphere' ? boxSize/2 : boxDimensions[1]/2) + 0.1, 0]}>
        <boxGeometry args={[0.3, 0.05, 0.01]} />
        <meshStandardMaterial color={rotationLocked ? "#10b981" : "#ef4444"} />
      </mesh>
      <Text
        position={[0, (boxType === 'sphere' ? boxSize/2 : boxDimensions[1]/2) + 0.1, 0.01]}
        fontSize={0.03}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {rotationLocked ? "回転固定" : "自由回転"}
      </Text>
      
      {/* 箱の種類表示 */}
      <Text
        position={[0, (boxType === 'sphere' ? boxSize/2 : boxDimensions[1]/2) + 0.05, 0]}
        fontSize={0.04}
        color="#60a5fa"
        anchorX="center"
        anchorY="middle"
      >
        {BOX_TYPES[boxType].name}
      </Text>
      
      {/* 箱の形状レンダリング */}
      {renderHabitat()}
      
      {/* ピクトグラム人形（床に垂直に立つ + 回転方向向き） */}
      <group ref={personRef}>
        {/* 体重表示プレート */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.3, 0.08, 0.01]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <Text
          position={[0, 0.5, 0.01]}
          fontSize={0.03}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          体重: {personMass}kg
        </Text>
        
        {/* ピクトグラム風の頭 */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        
        {/* ピクトグラム風の胴体 */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.35, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        
        {/* ピクトグラム風の腕 */}
        <mesh position={[-0.15, 0.15, 0]} rotation={[0, 0, Math.PI / 6]}>
          <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0.15, 0.15, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        
        {/* ピクトグラム風の脚 */}
        <mesh position={[-0.08, -0.25, 0]} rotation={[0, 0, Math.PI / 12]}>
          <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0.08, -0.25, 0]} rotation={[0, 0, -Math.PI / 12]}>
          <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        
        {/* ピクトグラム風の足（床に接地） */}
        <mesh position={[-0.1, -0.42, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0.1, -0.42, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f4f6" emissiveIntensity={0.1} />
        </mesh>
        
        {/* ピクトグラム風の顔 */}
        <mesh position={[-0.03, 0.32, 0.07]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0.03, 0.32, 0.07]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0.28, 0.07]}>
          <boxGeometry args={[0.04, 0.005, 0.005]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      </group>
      
      {/* 重力方向矢印（下Z軸方向） */}
      <group ref={gravityArrowRef}>
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
          <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <coneGeometry args={[0.04, 0.1, 8]} />
          <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.06}
          color="#3b82f6"
          anchorX="center"
          anchorY="middle"
        >
          重力
        </Text>
      </group>
      
      {/* 遠心力方向矢印（X軸外側方向） */}
      <group ref={centrifugalArrowRef}>
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <coneGeometry args={[0.04, 0.1, 8]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.06}
          color="#ef4444"
          anchorX="center"
          anchorY="middle"
        >
          {planet === 'space' ? '純粋人工重力' : '遠心力'}
        </Text>
      </group>
    </group>
  );
}

// シンプルな地球コンポーネント
function SimpleEarth({ position }: { position: [number, number, number] }) {
  const earthRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <mesh ref={earthRef} position={position}>
      <sphereGeometry args={[8, 32, 32]} />
      <meshPhongMaterial 
        color="#3b82f6"
        emissive="#1e40af"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

// シンプルな月コンポーネント
function SimpleMoon({ position }: { position: [number, number, number] }) {
  const moonRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={moonRef} position={position}>
      <sphereGeometry args={[6, 32, 32]} />
      <meshPhongMaterial 
        color="#94a3b8"
        emissive="#475569"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

// シンプルな火星コンポーネント
function SimpleMars({ position }: { position: [number, number, number] }) {
  const marsRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <mesh ref={marsRef} position={position}>
      <sphereGeometry args={[7, 32, 32]} />
      <meshPhongMaterial 
        color="#8b4513"
        emissive="#7c2d12"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

// 惑星背景コンポーネント（シンプル版）
function PlanetaryEnvironment({ planet }: { planet: keyof typeof PLANET_DATA }) {
  return (
    <>
      <color attach="background" args={[
        planet === 'earth' ? '#87ceeb' : 
        planet === 'moon' ? '#0f0f23' : 
        planet === 'mars' ? '#8b4513' : 
        '#000000' // 宇宙空間
      ]} />
      
      {planet === 'earth' && <SimpleEarth position={[0, -15, 0]} />}
      {planet === 'moon' && <SimpleMoon position={[0, -12, 0]} />}
      {planet === 'mars' && <SimpleMars position={[0, -14, 0]} />}
      
      {(planet === 'moon' || planet === 'mars' || planet === 'space') && (
        <Stars radius={100} depth={50} count={planet === 'space' ? 8000 : 5000} factor={6} saturation={0} fade speed={0.3} />
      )}
      
      {planet === 'earth' && (
        <fog attach="fog" args={['#87ceeb', 25, 120]} />
      )}
      
      {planet === 'mars' && (
        <fog attach="fog" args={['#8b4513', 30, 100]} />
      )}
    </>
  );
}

// メインアプリコンポーネント
export default function App() {
  const [rpm, setRpm] = useState(20);
  const [isRotating, setIsRotating] = useState(false);
  const [cameraMode, setCameraMode] = useState<keyof typeof CAMERA_MODES>('external');
  const [planet, setPlanet] = useState<keyof typeof PLANET_DATA>('earth');
  const [showPhysicsInfo, setShowPhysicsInfo] = useState(true);
  const [personMass, setPersonMass] = useState(70);
  const [connectingArmLength, setConnectingArmLength] = useState(0.8);
  const [habitatConfig, setHabitatConfig] = useState<keyof typeof HABITAT_CONFIGS>('dual');
  const [rotationLocked, setRotationLocked] = useState(false);
  const [boxType, setBoxType] = useState<keyof typeof BOX_TYPES>('cube');
  const [boxSize, setBoxSize] = useState(1.0);

  const habitatCount = HABITAT_CONFIGS[habitatConfig].count;

  // 物理値の計算
  const planetGravity = PLANET_DATA[planet].gravity;
  const angularVelocity = (rpm * 2 * Math.PI) / 60;
  const centrifugalAcceleration = isRotating ? angularVelocity * angularVelocity * ARM_LENGTH : 0;
  
  const totalMass = BOX_MASS + personMass;
  const gravitationalForce = totalMass * planetGravity;
  const centrifugalForce = isRotating ? totalMass * centrifugalAcceleration : 0;
  const totalForce = isRotating ? 
    (planet === 'space' ? centrifugalForce : Math.sqrt(centrifugalForce * centrifugalForce + gravitationalForce * gravitationalForce)) : 
    gravitationalForce;
  const totalGravity = totalForce / totalMass;
  
  const artificialGravityRatio = totalGravity / GRAVITY_CONSTANTS.earth;
  const idealAngle = isRotating ? 
    (planet === 'space' ? 90 : Math.atan(centrifugalAcceleration / planetGravity) * (180 / Math.PI)) : 0;
  const gravityAngle = isRotating ? 
    (planet === 'space' ? 90 : Math.atan2(centrifugalAcceleration, planetGravity) * (180 / Math.PI)) : 0;
  const inertialLagAngle = isRotating ? 
    (planet === 'space' ? 
      Math.atan(centrifugalAcceleration / 10) * CENTRIFUGAL_BULGE_FACTOR * 0.3 * (180 / Math.PI) :
      Math.atan(centrifugalAcceleration / planetGravity) * CENTRIFUGAL_BULGE_FACTOR * (180 / Math.PI)) : 0;

  // カメラ位置の計算
  const getCameraPosition = (): [number, number, number] => {
    const mode = CAMERA_MODES[cameraMode];
    if (cameraMode === 'internal') {
      return [ARM_LENGTH, -connectingArmLength - (boxType === 'sphere' ? boxSize/2 : BOX_TYPES[boxType].dimensions[1]/2) + 0.3, 0.3];
    }
    if (cameraMode === 'universal') {
      return [ARM_LENGTH, 0.5, 1.0];
    }
    return mode.position;
  };

  const getCameraTarget = (): [number, number, number] => {
    const mode = CAMERA_MODES[cameraMode];
    if (cameraMode === 'internal') {
      return [ARM_LENGTH, -connectingArmLength - (boxType === 'sphere' ? boxSize/2 : BOX_TYPES[boxType].dimensions[1]/2), 0];
    }
    if (cameraMode === 'universal') {
      return [ARM_LENGTH, 0, 0];
    }
    return mode.target;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">ステラクレードル Mk-1（実験機）多居住区シミュレーター</h1>
            <p className="text-slate-400">複数居住区 + 自己回転固定機能 + 無重力環境対応 + プルダウン選択</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                isRotating 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isRotating ? <Pause size={20} /> : <Play size={20} />}
              <span>{isRotating ? '停止' : '再生'}</span>
            </button>
            <button
              onClick={() => setShowPhysicsInfo(!showPhysicsInfo)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              物理情報
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* 3Dキャンバス */}
        <div className="flex-1 relative">
          <Canvas>
            <PlanetaryEnvironment planet={planet} />
            
            <ambientLight intensity={0.4} />
            <directionalLight 
              position={[15, 15, 10]} 
              intensity={1.5} 
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[0, 0, 15]} intensity={0.6} />
            <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ffffff" />
            
            <PerspectiveCamera 
              makeDefault 
              position={getCameraPosition()} 
              fov={60}
            />
            <OrbitControls 
              enablePan={true} 
              enableZoom={true} 
              enableRotate={true}
              target={getCameraTarget()}
            />
            
            <MainRotatingMechanism 
              rpm={rpm} 
              isRotating={isRotating} 
              planet={planet} 
              personMass={personMass}
              connectingArmLength={connectingArmLength}
              habitatCount={habitatCount}
              rotationLocked={rotationLocked}
              boxType={boxType}
              boxSize={boxSize}
            />
          </Canvas>
          
          {/* 物理情報オーバーレイ */}
          {showPhysicsInfo && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-4 rounded-lg backdrop-blur-sm">
              <h3 className="font-bold mb-2">多居住区物理シミュレーション</h3>
              <div className="space-y-1 text-sm">
                <div>惑星: {PLANET_DATA[planet].name}（重力: {planetGravity.toFixed(2)} m/s²）</div>
                <div>居住区数: {habitatCount}個（円周均等配置）</div>
                <div>箱の種類: {BOX_TYPES[boxType].name}（サイズ: {boxSize.toFixed(1)}m）</div>
                <div>回転固定: {rotationLocked ? '有効' : '無効'}</div>
                <div>総質量: {totalMass.toFixed(1)} kg（箱: {BOX_MASS}kg + 人: {personMass}kg）</div>
                <div>接続アーム長: {connectingArmLength.toFixed(2)} m</div>
                <div>回転数: {rpm.toFixed(1)} RPM</div>
                <div>遠心加速度: {centrifugalAcceleration.toFixed(2)} m/s²</div>
                <div>合成重力: {totalGravity.toFixed(2)} m/s² ({artificialGravityRatio.toFixed(2)} g)</div>
                <div>理想角度: {idealAngle.toFixed(1)}°</div>
                <div>重力方向: {gravityAngle.toFixed(1)}°</div>
                <div>慣性遅れ角度: {inertialLagAngle.toFixed(1)}°</div>
                {planet === 'space' && (
                  <div className="mt-2 text-xs text-yellow-300">
                    <div>• 無重力環境：純粋な人工重力実験</div>
                    <div>• 遠心力のみが作用</div>
                    <div>• 停止時も箱は下がらない</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* コントロールパネル */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 p-6 space-y-6 overflow-y-auto">
          {/* プルダウン選択セクション */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-3">環境・設定選択</h3>
            
            {/* 惑星選択 */}
            <Dropdown
              label="惑星環境"
              value={planet}
              options={PLANET_DATA}
              onChange={(value) => setPlanet(value as keyof typeof PLANET_DATA)}
            />
            
            {/* 箱の種類選択 */}
            <Dropdown
              label="箱の種類"
              value={boxType}
              options={BOX_TYPES}
              onChange={(value) => setBoxType(value as keyof typeof BOX_TYPES)}
            />
            
            {/* 居住区設定選択 */}
            <Dropdown
              label="居住区設定"
              value={habitatConfig}
              options={HABITAT_CONFIGS}
              onChange={(value) => setHabitatConfig(value as keyof typeof HABITAT_CONFIGS)}
            />
            
            {/* カメラ視点選択 */}
            <Dropdown
              label="カメラ視点"
              value={cameraMode}
              options={CAMERA_MODES}
              onChange={(value) => setCameraMode(value as keyof typeof CAMERA_MODES)}
            />
          </div>

          {/* 箱サイズ調整 */}
          <div>
            <h3 className="text-white font-semibold mb-3">
              <Settings size={16} className="inline mr-2" />
              箱サイズ調整
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">
                  サイズ倍率: {boxSize.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={boxSize}
                  onChange={(e) => setBoxSize(Number(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
              
              <div className="bg-slate-700 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <Settings size={16} className="text-slate-400" />
                  <span className="text-slate-300">実寸法:</span>
                  <span className="text-blue-400 font-medium">
                    {boxType === 'sphere' ? 
                      `直径 ${boxSize.toFixed(1)}m` : 
                      `${(BOX_TYPES[boxType].dimensions[0] * boxSize).toFixed(1)} × ${(BOX_TYPES[boxType].dimensions[1] * boxSize).toFixed(1)} × ${(BOX_TYPES[boxType].dimensions[2] * boxSize).toFixed(1)}m`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 回転固定制御 */}
          <div>
            <h3 className="text-white font-semibold mb-3">
              <Lock size={16} className="inline mr-2" />
              回転制御
            </h3>
            <button
              onClick={() => setRotationLocked(!rotationLocked)}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                rotationLocked 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              {rotationLocked ? <Lock size={20} /> : <Unlock size={20} />}
              <span>{rotationLocked ? '回転固定中' : '自由回転'}</span>
            </button>
            <p className="text-xs text-slate-400 mt-2">
              {rotationLocked 
                ? '居住区が常に一定方向を向きます' 
                : '居住区が遠心力に追従して回転します'
              }
            </p>
          </div>

          {/* 質量設定 */}
          <div>
            <h3 className="text-white font-semibold mb-3">質量設定</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">
                  <User size={16} className="inline mr-1" />
                  被験者体重: {personMass} kg
                </label>
                <input
                  type="range"
                  min="40"
                  max="120"
                  step="5"
                  value={personMass}
                  onChange={(e) => setPersonMass(Number(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>40kg</span>
                  <span>80kg</span>
                  <span>120kg</span>
                </div>
              </div>
              
              <div className="bg-slate-700 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <Weight size={16} className="text-slate-400" />
                  <span className="text-slate-300">総質量:</span>
                  <span className="text-blue-400 font-medium">{totalMass} kg</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  全居住区合計: {(totalMass * habitatCount).toFixed(0)} kg
                </div>
              </div>
            </div>
          </div>

          {/* 接続アーム長設定 */}
          <div>
            <h3 className="text-white font-semibold mb-3">
              <Settings size={16} className="inline mr-2" />
              接続アーム長調整
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">
                  ユニバーサル→箱アーム長: {connectingArmLength.toFixed(2)} m
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.05"
                  value={connectingArmLength}
                  onChange={(e) => setConnectingArmLength(Number(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0.3m</span>
                  <span>1.0m</span>
                  <span>2.0m</span>
                </div>
              </div>
              
              <div className="bg-slate-700 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <Settings size={16} className="text-slate-400" />
                  <span className="text-slate-300">慣性遅れ:</span>
                  <span className="text-purple-400 font-medium">{inertialLagAngle.toFixed(1)}°</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {planet === 'space' ? '無重力環境で軽減' : '遠心加速逆慣性力効果'}
                </div>
              </div>
            </div>
          </div>

          {/* 回転制御 */}
          <div>
            <h3 className="text-white font-semibold mb-3">回転機構制御</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-2">
                  回転数: {rpm} RPM
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={rpm}
                  onChange={(e) => setRpm(Number(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0</span>
                  <span>30</span>
                  <span>60</span>
                </div>
              </div>
            </div>
          </div>

          {/* 多居住区システム情報 */}
          <div className="bg-slate-700 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">多居住区システム</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">居住区数:</span>
                <span className="text-blue-400">{habitatCount}個</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">配置角度:</span>
                <span className="text-green-400">{(360/habitatCount).toFixed(0)}°間隔</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">箱の種類:</span>
                <span className="text-purple-400">{BOX_TYPES[boxType].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">回転制御:</span>
                <span className={rotationLocked ? 'text-green-400' : 'text-yellow-400'}>
                  {rotationLocked ? '固定' : '自由'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">環境:</span>
                <span className="text-purple-400">{PLANET_DATA[planet].name}</span>
              </div>
            </div>
            <p className="text-slate-300 text-xs mt-2 leading-relaxed">
              複数の居住区が円周上に均等配置され、
              {rotationLocked ? '各居住区は常に一定方向を向きます。' : '遠心力に追従して自然に回転します。'}
              {planet === 'space' && ' 無重力環境では停止時も箱は下がりません。'}
            </p>
          </div>

          {/* 実験状態 */}
          <div className="bg-slate-700 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">実験状態</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">回転機構:</span>
                <span className={isRotating ? 'text-green-400' : 'text-red-400'}>
                  {isRotating ? '動作中' : '停止中'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">重力環境:</span>
                <span className="text-blue-400">{PLANET_DATA[planet].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">人の状態:</span>
                <span className="text-green-400">
                  {isRotating ? 
                    (planet === 'space' ? '遠心力方向立ち' : '床に垂直立ち') : 
                    (planet === 'space' ? '現在姿勢維持' : '正面向き')
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">視点:</span>
                <span className="text-purple-400">
                  {CAMERA_MODES[cameraMode].name}
                </span>
              </div>
            </div>
          </div>

          {/* 安全情報 */}
          <div className="bg-amber-900 bg-opacity-50 p-4 rounded-lg border border-amber-600">
            <h4 className="text-amber-200 font-medium mb-2">⚠️ 多居住区実験</h4>
            <div className="text-amber-100 text-xs space-y-1">
              <div>• 居住区数: 1, 2, 4, 6, 8個から選択</div>
              <div>• 箱の種類: 立方体, 長方形, 球体</div>
              <div>• 円周均等配置で安定性確保</div>
              <div>• 回転固定機能で姿勢制御</div>
              <div>• 無重力環境対応（停止時も下がらない）</div>
              <div>• 最大回転数: 60 RPM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}