import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Sphere, Cylinder, Box } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Info, 
  Eye, 
  Globe, 
  Home, 
  Camera,
  ChevronDown
} from 'lucide-react';

// 物理定数
const PHYSICS = {
  EARTH_GRAVITY: 9.81,
  MOON_GRAVITY: 1.62,
  MARS_GRAVITY: 3.71,
  SPACE_GRAVITY: 0.0,
  ARM_LENGTH: 4.0,
  MAX_RPM: 60,
  MAX_HINGE_ANGLE: 60,
  HUMAN_MASS: 70,
  BOX_MASS: 50
};

// 惑星環境設定
const PLANET_CONFIGS = {
  earth: {
    name: '地球',
    gravity: PHYSICS.EARTH_GRAVITY,
    color: '#4A90E2',
    atmosphere: '#87CEEB',
    description: '標準重力環境'
  },
  moon: {
    name: '月',
    gravity: PHYSICS.MOON_GRAVITY,
    color: '#C0C0C0',
    atmosphere: '#000011',
    description: '低重力環境'
  },
  mars: {
    name: '火星',
    gravity: PHYSICS.MARS_GRAVITY,
    color: '#CD5C5C',
    atmosphere: '#8B4513',
    description: '中重力環境'
  },
  space: {
    name: '宇宙空間',
    gravity: PHYSICS.SPACE_GRAVITY,
    color: '#000011',
    atmosphere: '#000033',
    description: '無重力環境'
  }
};

// カスタムドロップダウンコンポーネント
const CustomDropdown = ({ 
  value, 
  onChange, 
  options, 
  label, 
  icon: Icon 
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; description?: string }>;
  label: string;
  icon: React.ComponentType<any>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors flex items-center justify-between"
        >
          <span>{selectedOption?.label}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-600 transition-colors ${
                  value === option.value ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-400">{option.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 人間のコンポーネント
const Human = ({ 
  position, 
  rotation, 
  gravityAngle, 
  isFloating = false 
}: { 
  position: [number, number, number]; 
  rotation: [number, number, number];
  gravityAngle: number;
  isFloating?: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && !isFloating) {
      // 合成重力の方向に応じて人の姿勢を調整
      groupRef.current.rotation.z = -gravityAngle;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* 頭 */}
      <Sphere args={[0.08]} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#FFDBAC" />
      </Sphere>
      
      {/* 胴体 */}
      <Box args={[0.12, 0.25, 0.08]} position={[0, 0.1, 0]}>
        <meshStandardMaterial color="#4169E1" />
      </Box>
      
      {/* 腕 */}
      <Box args={[0.04, 0.15, 0.04]} position={[-0.1, 0.05, 0]}>
        <meshStandardMaterial color="#FFDBAC" />
      </Box>
      <Box args={[0.04, 0.15, 0.04]} position={[0.1, 0.05, 0]}>
        <meshStandardMaterial color="#FFDBAC" />
      </Box>
      
      {/* 脚 */}
      <Box args={[0.05, 0.2, 0.05]} position={[-0.05, -0.15, 0]}>
        <meshStandardMaterial color="#000080" />
      </Box>
      <Box args={[0.05, 0.2, 0.05]} position={[0.05, -0.15, 0]}>
        <meshStandardMaterial color="#000080" />
      </Box>
    </group>
  );
};

// 重力ベクトル表示コンポーネント
const GravityVector = ({ 
  position, 
  direction, 
  magnitude, 
  color = '#ff0000' 
}: {
  position: [number, number, number];
  direction: [number, number, number];
  magnitude: number;
  color?: string;
}) => {
  const arrowLength = Math.min(magnitude * 0.3, 2.0);
  const endPosition: [number, number, number] = [
    position[0] + direction[0] * arrowLength,
    position[1] + direction[1] * arrowLength,
    position[2] + direction[2] * arrowLength
  ];

  return (
    <group>
      <Line
        points={[position, endPosition]}
        color={color}
        lineWidth={3}
      />
      {/* 矢印の先端 */}
      <mesh position={endPosition}>
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
};

// 居住区コンポーネント
const Habitat = ({ 
  position, 
  rotation, 
  hingeAngle, 
  gravityAngle, 
  boxSize, 
  boxType,
  isRotating, 
  planet,
  rpm,
  totalGravity,
  centrifugalAcceleration,
  planetGravity
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  hingeAngle: number;
  gravityAngle: number;
  boxSize: number;
  boxType: string;
  isRotating: boolean;
  planet: string;
  rpm: number;
  totalGravity: number;
  centrifugalAcceleration: number;
  planetGravity: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const hingeRef = useRef<THREE.Group>(null);

  // 箱の寸法を計算
  const getBoxDimensions = (): [number, number, number] => {
    switch (boxType) {
      case 'rectangle':
        return [boxSize * 1.5, boxSize, boxSize * 0.8];
      case 'sphere':
        return [boxSize, boxSize, boxSize];
      case 'cylinder':
        return [boxSize, boxSize, boxSize];
      case 'capsule':
        return [boxSize, boxSize * 1.2, boxSize];
      default: // cube
        return [boxSize, boxSize, boxSize];
    }
  };

  const boxDimensions = getBoxDimensions();

  useFrame(() => {
    if (hingeRef.current) {
      hingeRef.current.rotation.x = (hingeAngle * Math.PI) / 180;
    }
  });

  // 人の位置を計算
  const getHumanPosition = (): [number, number, number] => {
    let baseY: number;
    
    if (boxType === 'sphere') {
      // 球体の場合、底部に床面を配置
      baseY = -boxSize/2 + 0.1 + 0.4;
    } else {
      // その他の場合、箱の底面から少し上
      baseY = -boxDimensions[1]/2 + 0.4;
    }

    if (isRotating) {
      // 回転中は合成重力に応じて位置調整
      const gravityOffset = Math.sin(gravityAngle) * 0.1;
      return [gravityOffset, baseY, 0];
    } else {
      // 停止時の処理を惑星別に分岐
      if (planet === 'space') {
        // 無重力環境では現在位置を維持
        const currentGravityOffset = Math.sin(gravityAngle) * 0.1;
        return [currentGravityOffset, baseY, 0];
      } else {
        // 重力環境では中央に戻る
        return [0, baseY, 0];
      }
    }
  };

  const humanPosition = getHumanPosition();

  // 床面の描画
  const renderFloor = () => {
    if (boxType === 'sphere') {
      // 球体の場合：円形床面を底部に配置
      const floorY = -boxSize/2 + 0.1;
      const floorRadius = boxSize * 0.4;
      
      return (
        <group position={[0, floorY, 0]}>
          {/* 円形床面 */}
          <mesh rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[floorRadius, 32]} />
            <meshStandardMaterial 
              color="#444444" 
              transparent 
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* 放射状グリッド */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI * 2) / 8;
            const x1 = Math.cos(angle) * 0.1;
            const z1 = Math.sin(angle) * 0.1;
            const x2 = Math.cos(angle) * floorRadius;
            const z2 = Math.sin(angle) * floorRadius;
            
            return (
              <Line
                key={`radial-${i}`}
                points={[[x1, 0.01, z1], [x2, 0.01, z2]]}
                color="#666666"
                lineWidth={1}
              />
            );
          })}
          
          {/* 同心円グリッド */}
          {[0.2, 0.4, 0.6].map((radius, i) => (
            <Line
              key={`circle-${i}`}
              points={Array.from({ length: 33 }, (_, j) => {
                const angle = (j * Math.PI * 2) / 32;
                return [
                  Math.cos(angle) * floorRadius * radius,
                  0.01,
                  Math.sin(angle) * floorRadius * radius
                ];
              })}
              color="#666666"
              lineWidth={1}
            />
          ))}
        </group>
      );
    } else if (boxType === 'cylinder' || boxType === 'capsule') {
      // 円筒・カプセルの場合：円形床面
      const floorRadius = boxDimensions[0] * 0.4;
      
      return (
        <group position={[0, -boxDimensions[1]/2 + 0.05, 0]}>
          <mesh rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[floorRadius, 32]} />
            <meshStandardMaterial 
              color="#444444" 
              transparent 
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      );
    } else {
      // 立方体・長方形の場合：グリッド床面
      const gridSize = 0.2;
      const gridLines = [];
      
      // X方向のライン
      for (let i = -boxDimensions[0]/2; i <= boxDimensions[0]/2; i += gridSize) {
        gridLines.push([
          [i, -boxDimensions[1]/2 + 0.01, -boxDimensions[2]/2],
          [i, -boxDimensions[1]/2 + 0.01, boxDimensions[2]/2]
        ]);
      }
      
      // Z方向のライン
      for (let i = -boxDimensions[2]/2; i <= boxDimensions[2]/2; i += gridSize) {
        gridLines.push([
          [-boxDimensions[0]/2, -boxDimensions[1]/2 + 0.01, i],
          [boxDimensions[0]/2, -boxDimensions[1]/2 + 0.01, i]
        ]);
      }
      
      return (
        <>
          {gridLines.map((points, index) => (
            <Line
              key={index}
              points={points}
              color="#666666"
              lineWidth={1}
            />
          ))}
        </>
      );
    }
  };

  // 箱の構造を描画
  const renderBoxStructure = () => {
    switch (boxType) {
      case 'sphere':
        return (
          <Sphere args={[boxSize/2, 16, 16]}>
            <meshStandardMaterial 
              color="#00aaff" 
              wireframe 
              transparent 
              opacity={0.3}
            />
          </Sphere>
        );
        
      case 'cylinder':
        return (
          <Cylinder args={[boxDimensions[0]/2, boxDimensions[0]/2, boxDimensions[1], 16]}>
            <meshStandardMaterial 
              color="#00aaff" 
              wireframe 
              transparent 
              opacity={0.3}
            />
          </Cylinder>
        );
        
      case 'capsule':
        return (
          <group>
            {/* 中央の円筒部分 */}
            <Cylinder args={[boxDimensions[0]/2, boxDimensions[0]/2, boxDimensions[1] * 0.6, 16]}>
              <meshStandardMaterial 
                color="#00aaff" 
                wireframe 
                transparent 
                opacity={0.3}
              />
            </Cylinder>
            {/* 上部の半球 */}
            <Sphere 
              args={[boxDimensions[0]/2, 16, 8, 0, Math.PI * 2, 0, Math.PI/2]} 
              position={[0, boxDimensions[1] * 0.3, 0]}
            >
              <meshStandardMaterial 
                color="#00aaff" 
                wireframe 
                transparent 
                opacity={0.3}
              />
            </Sphere>
            {/* 下部の半球 */}
            <Sphere 
              args={[boxDimensions[0]/2, 16, 8, 0, Math.PI * 2, Math.PI/2, Math.PI/2]} 
              position={[0, -boxDimensions[1] * 0.3, 0]}
            >
              <meshStandardMaterial 
                color="#00aaff" 
                wireframe 
                transparent 
                opacity={0.3}
              />
            </Sphere>
          </group>
        );
        
      default: // cube, rectangle
        return (
          <Box args={boxDimensions}>
            <meshStandardMaterial 
              color="#00aaff" 
              wireframe 
              transparent 
              opacity={0.3}
            />
          </Box>
        );
    }
  };

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* ヒンジ機構 */}
      <group ref={hingeRef}>
        {/* 箱の構造 */}
        {renderBoxStructure()}
        
        {/* 床面 */}
        {renderFloor()}
        
        {/* 人間 */}
        <Human 
          position={humanPosition}
          rotation={[0, 0, 0]}
          gravityAngle={gravityAngle}
          isFloating={planet === 'space' && !isRotating}
        />
        
        {/* 重力ベクトル表示 */}
        {(isRotating || planet !== 'space') && (
          <GravityVector
            position={[0, 0, 0]}
            direction={[
              Math.sin(gravityAngle),
              -Math.cos(gravityAngle),
              0
            ]}
            magnitude={totalGravity / 10}
            color="#ff0000"
          />
        )}
        
        {/* 居住区ラベル */}
        <Text
          position={[0, boxDimensions[1]/2 + 0.3, 0]}
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          居住区 ({boxType === 'cube' ? '立方体' : 
                   boxType === 'rectangle' ? '長方形' :
                   boxType === 'sphere' ? '球体' :
                   boxType === 'cylinder' ? '円筒' : 'カプセル'})
        </Text>
      </group>
    </group>
  );
};

// 回転アームシステム
const RotatingArmSystem = ({ 
  rpm, 
  numHabitats, 
  boxSize, 
  boxType,
  isRotating, 
  planet,
  totalGravity,
  centrifugalAcceleration,
  planetGravity,
  hingeAngle,
  gravityAngle,
  rotationFixed
}: {
  rpm: number;
  numHabitats: number;
  boxSize: number;
  boxType: string;
  isRotating: boolean;
  planet: string;
  totalGravity: number;
  centrifugalAcceleration: number;
  planetGravity: number;
  hingeAngle: number;
  gravityAngle: number;
  rotationFixed: boolean;
}) => {
  const systemRef = useRef<THREE.Group>(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  useFrame((state, delta) => {
    if (systemRef.current && isRotating) {
      const angularVelocity = (rpm * 2 * Math.PI) / 60;
      const rotationDelta = angularVelocity * delta;
      setCurrentRotation(prev => prev + rotationDelta);
      
      if (!rotationFixed) {
        systemRef.current.rotation.y = currentRotation;
      }
    }
  });

  // 居住区の配置を計算
  const getHabitatPositions = () => {
    const positions = [];
    const angleStep = (2 * Math.PI) / numHabitats;
    
    for (let i = 0; i < numHabitats; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * PHYSICS.ARM_LENGTH;
      const z = Math.sin(angle) * PHYSICS.ARM_LENGTH;
      positions.push({
        position: [x, 0, z] as [number, number, number],
        rotation: [0, -angle, 0] as [number, number, number]
      });
    }
    
    return positions;
  };

  const habitatPositions = getHabitatPositions();

  return (
    <group ref={systemRef}>
      {/* 中央回転軸 */}
      <Cylinder args={[0.1, 0.1, 2]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#cc0000" />
      </Cylinder>
      
      {/* 指示アーム */}
      {habitatPositions.map((_, index) => {
        const angle = (index * 2 * Math.PI) / numHabitats;
        const x = Math.cos(angle) * PHYSICS.ARM_LENGTH / 2;
        const z = Math.sin(angle) * PHYSICS.ARM_LENGTH / 2;
        
        return (
          <group key={`arm-${index}`}>
            <Cylinder 
              args={[0.05, 0.05, PHYSICS.ARM_LENGTH]} 
              position={[x, 0, z]}
              rotation={[0, 0, Math.PI/2 + angle]}
            >
              <meshStandardMaterial color="#0066cc" />
            </Cylinder>
          </group>
        );
      })}
      
      {/* 居住区 */}
      {habitatPositions.map((habitat, index) => (
        <Habitat
          key={`habitat-${index}`}
          position={habitat.position}
          rotation={habitat.rotation}
          hingeAngle={hingeAngle}
          gravityAngle={gravityAngle}
          boxSize={boxSize}
          boxType={boxType}
          isRotating={isRotating}
          planet={planet}
          rpm={rpm}
          totalGravity={totalGravity}
          centrifugalAcceleration={centrifugalAcceleration}
          planetGravity={planetGravity}
        />
      ))}
    </group>
  );
};

// 環境背景コンポーネント
const EnvironmentBackground = ({ planet }: { planet: string }) => {
  const { scene } = useThree();
  
  useEffect(() => {
    const config = PLANET_CONFIGS[planet as keyof typeof PLANET_CONFIGS];
    scene.background = new THREE.Color(config.atmosphere);
  }, [planet, scene]);

  const config = PLANET_CONFIGS[planet as keyof typeof PLANET_CONFIGS];

  return (
    <>
      {/* 惑星本体 */}
      <Sphere args={[20]} position={[0, -25, 0]}>
        <meshStandardMaterial color={config.color} />
      </Sphere>
      
      {/* 環境光 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      
      {/* 星空効果（宇宙・月環境） */}
      {(planet === 'space' || planet === 'moon') && (
        <>
          {Array.from({ length: 200 }, (_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
              ]}
            >
              <sphereGeometry args={[0.02]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </>
      )}
    </>
  );
};

// メインアプリケーション
const App: React.FC = () => {
  // 状態管理
  const [rpm, setRpm] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [planet, setPlanet] = useState('earth');
  const [numHabitats, setNumHabitats] = useState(2);
  const [boxSize, setBoxSize] = useState(1.2);
  const [boxType, setBoxType] = useState('cube');
  const [cameraView, setCameraView] = useState('external');
  const [rotationFixed, setRotationFixed] = useState(false);
  const [showPhysics, setShowPhysics] = useState(true);
  const [showSystemInfo, setShowSystemInfo] = useState(true);

  // 物理計算
  const planetGravity = PLANET_CONFIGS[planet as keyof typeof PLANET_CONFIGS].gravity;
  const angularVelocity = (rpm * 2 * Math.PI) / 60;
  const centrifugalAcceleration = Math.pow(angularVelocity, 2) * PHYSICS.ARM_LENGTH;
  const totalGravity = Math.sqrt(Math.pow(centrifugalAcceleration, 2) + Math.pow(planetGravity, 2));
  
  // ヒンジ角度計算（安全制限付き）
  const idealHingeAngle = planetGravity > 0 ? 
    Math.atan(centrifugalAcceleration / planetGravity) * (180 / Math.PI) : 
    (centrifugalAcceleration > 0 ? PHYSICS.MAX_HINGE_ANGLE : 0);
  const hingeAngle = Math.min(idealHingeAngle, PHYSICS.MAX_HINGE_ANGLE);
  
  // 重力方向角度
  const gravityAngle = planetGravity > 0 ? 
    Math.atan(centrifugalAcceleration / planetGravity) : 
    (centrifugalAcceleration > 0 ? Math.PI / 2 : 0);

  // 総質量計算
  const totalMass = (PHYSICS.BOX_MASS + PHYSICS.HUMAN_MASS) * numHabitats;

  // 制御関数
  const handleStart = () => setIsRotating(true);
  const handleStop = () => setIsRotating(false);
  const handleReset = () => {
    setIsRotating(false);
    setRpm(0);
  };

  // カメラ設定
  const getCameraPosition = (): [number, number, number] => {
    switch (cameraView) {
      case 'internal':
        return [PHYSICS.ARM_LENGTH, 0, 0];
      case 'universal':
        return [0, 8, 8];
      case 'top':
        return [0, 15, 0];
      default: // external
        return [12, 8, 12];
    }
  };

  const getCameraTarget = (): [number, number, number] => {
    switch (cameraView) {
      case 'internal':
        return [PHYSICS.ARM_LENGTH, 0, 0];
      case 'universal':
      case 'top':
        return [0, 0, 0];
      default: // external
        return [0, 0, 0];
    }
  };

  // プルダウンオプション
  const planetOptions = [
    { value: 'earth', label: '地球', description: '標準重力 (9.81 m/s²)' },
    { value: 'moon', label: '月', description: '低重力 (1.62 m/s²)' },
    { value: 'mars', label: '火星', description: '中重力 (3.71 m/s²)' },
    { value: 'space', label: '宇宙空間', description: '無重力 (0.00 m/s²)' }
  ];

  const habitatOptions = [
    { value: '2', label: '2個', description: '対向配置' },
    { value: '4', label: '4個', description: '十字配置' },
    { value: '6', label: '6個', description: '六角配置' },
    { value: '8', label: '8個', description: '八角配置' }
  ];

  const boxTypeOptions = [
    { value: 'cube', label: '立方体', description: 'グリッド模様の床面付き' },
    { value: 'rectangle', label: '長方形', description: '横長の居住空間' },
    { value: 'sphere', label: '球体', description: '球面内の平面床' },
    { value: 'cylinder', label: '円筒', description: '円筒内の円形床' },
    { value: 'capsule', label: 'カプセル', description: '上下半球付きの特殊形状' }
  ];

  const cameraOptions = [
    { value: 'external', label: '外観', description: '全体を俯瞰' },
    { value: 'internal', label: '箱内', description: '居住区内部' },
    { value: 'universal', label: 'ユニバーサル', description: '斜め上から' },
    { value: 'top', label: '上面', description: '真上から' }
  ];

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      {/* 3Dシーン */}
      <Canvas
        camera={{
          position: getCameraPosition(),
          fov: 60
        }}
        className="w-full h-full"
      >
        <EnvironmentBackground planet={planet} />
        
        <RotatingArmSystem
          rpm={rpm}
          numHabitats={numHabitats}
          boxSize={boxSize}
          boxType={boxType}
          isRotating={isRotating}
          planet={planet}
          totalGravity={totalGravity}
          centrifugalAcceleration={centrifugalAcceleration}
          planetGravity={planetGravity}
          hingeAngle={hingeAngle}
          gravityAngle={gravityAngle}
          rotationFixed={rotationFixed}
        />
        
        <OrbitControls
          target={getCameraTarget()}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={50}
          minDistance={2}
        />
      </Canvas>

      {/* 制御パネル */}
      <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 p-6 rounded-lg shadow-lg w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          制御パネル
        </h2>

        {/* 惑星環境選択 */}
        <div className="mb-4">
          <CustomDropdown
            value={planet}
            onChange={setPlanet}
            options={planetOptions}
            label="惑星環境"
            icon={Globe}
          />
        </div>

        {/* 居住区数選択 */}
        <div className="mb-4">
          <CustomDropdown
            value={numHabitats.toString()}
            onChange={(value) => setNumHabitats(parseInt(value))}
            options={habitatOptions}
            label="居住区数"
            icon={Home}
          />
        </div>

        {/* 箱の種類選択 */}
        <div className="mb-4">
          <CustomDropdown
            value={boxType}
            onChange={setBoxType}
            options={boxTypeOptions}
            label="箱の種類"
            icon={Home}
          />
        </div>

        {/* 箱のサイズ調整 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            箱のサイズ: {boxSize.toFixed(1)}m
          </label>
          <input
            type="range"
            min="0.8"
            max="2.5"
            step="0.1"
            value={boxSize}
            onChange={(e) => setBoxSize(parseFloat(e.target.value))}
            className="w-full slider"
          />
        </div>

        {/* カメラ視点選択 */}
        <div className="mb-4">
          <CustomDropdown
            value={cameraView}
            onChange={setCameraView}
            options={cameraOptions}
            label="カメラ視点"
            icon={Camera}
          />
        </div>

        {/* 回転制御 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            回転数: {rpm.toFixed(1)} RPM
          </label>
          <input
            type="range"
            min="0"
            max={PHYSICS.MAX_RPM}
            step="0.5"
            value={rpm}
            onChange={(e) => setRpm(parseFloat(e.target.value))}
            className="w-full slider"
          />
        </div>

        {/* 制御ボタン */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleStart}
            disabled={isRotating}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            開始
          </button>
          <button
            onClick={handleStop}
            disabled={!isRotating}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Pause className="w-4 h-4" />
            停止
          </button>
          <button
            onClick={handleReset}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </button>
        </div>

        {/* 回転固定 */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={rotationFixed}
              onChange={(e) => setRotationFixed(e.target.checked)}
              className="rounded"
            />
            回転固定: {rotationFixed ? '無効' : '有効'}
          </label>
        </div>

        {/* 表示オプション */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={showPhysics}
              onChange={(e) => setShowPhysics(e.target.checked)}
              className="rounded"
            />
            物理情報表示
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={showSystemInfo}
              onChange={(e) => setShowSystemInfo(e.target.checked)}
              className="rounded"
            />
            システム情報表示
          </label>
        </div>
      </div>

      {/* 物理情報パネル */}
      {showPhysics && (
        <div className="absolute top-4 right-4 physics-panel p-4 rounded-lg w-80">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Info className="w-5 h-5" />
            多居住区物理シミュレーション
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <div>惑星: {PLANET_CONFIGS[planet as keyof typeof PLANET_CONFIGS].name} (重力: {planetGravity.toFixed(2)} m/s²)</div>
            <div>居住区数: {numHabitats}個 (円周均等配置)</div>
            <div>箱の種類: {boxType === 'cube' ? '立方体' : 
                           boxType === 'rectangle' ? '長方形' :
                           boxType === 'sphere' ? '球体' :
                           boxType === 'cylinder' ? '円筒' : 'カプセル'} (サイズ: {boxSize.toFixed(1)}m)</div>
            <div>回転固定: {rotationFixed ? '無効' : '有効'}</div>
            <div>総質量: {totalMass.toFixed(1)} kg (箱: {PHYSICS.BOX_MASS}kg + 人: {PHYSICS.HUMAN_MASS}kg)</div>
            <div>接続アーム長: {PHYSICS.ARM_LENGTH.toFixed(2)} m</div>
            <div>回転数: {rpm.toFixed(1)} RPM</div>
            <div>遠心加速度: {centrifugalAcceleration.toFixed(2)} m/s²</div>
            <div>合成重力: {totalGravity.toFixed(2)} m/s² ({(totalGravity / PHYSICS.EARTH_GRAVITY).toFixed(2)} g)</div>
            <div>理想角度: {idealHingeAngle.toFixed(1)}°</div>
            <div>重力方向: {(gravityAngle * 180 / Math.PI).toFixed(1)}°</div>
            <div>慣性遠心角度: {hingeAngle.toFixed(1)}°</div>
          </div>
        </div>
      )}

      {/* システム情報パネル */}
      {showSystemInfo && (
        <div className="absolute bottom-4 left-4 physics-panel p-4 rounded-lg w-80">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            システム情報
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <div>実験装置: ステラクレードル Mk-1</div>
            <div>居住区形状: {boxType === 'cube' ? '立方体フレーム' : 
                            boxType === 'rectangle' ? '長方形フレーム' :
                            boxType === 'sphere' ? 'ワイヤーフレーム球体' :
                            boxType === 'cylinder' ? 'ワイヤーフレーム円筒' : 'カプセル型'}</div>
            <div>床面タイプ: {boxType === 'sphere' || boxType === 'cylinder' || boxType === 'capsule' ? '円形床面' : 'グリッド床面'}</div>
            <div>ヒンジ機構: 上下方向稼働</div>
            <div>ユニバーサルフリー: 2軸ジンバル</div>
            <div>安全制限: 最大{PHYSICS.MAX_HINGE_ANGLE}度</div>
            <div>視点: {cameraView === 'external' ? '外観視点' : 
                      cameraView === 'internal' ? '箱内視点' :
                      cameraView === 'universal' ? 'ユニバーサル視点' : '上面視点'}</div>
            <div>環境: {PLANET_CONFIGS[planet as keyof typeof PLANET_CONFIGS].description}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;