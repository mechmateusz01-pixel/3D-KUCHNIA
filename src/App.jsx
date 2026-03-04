import React, { useState, useRef, useEffect, Suspense, Component, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three' 

// --- 1. ZABEZPIECZENIE TEKSTUR ---
class TextureErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <meshStandardMaterial color={this.props.fallbackColor} />;
    return this.props.children;
  }
}

// --- 2. AUTOMATYCZNE CZYTANIE TEKSTUR ---
const textureModules = import.meta.glob('./textures/*.{jpg,jpeg,png}', { eager: true });
const DEKORY = {
  biel_alpejska: { name: 'Biel Alpejska (Gładka)', url: null, color: '#ffffff', scale: 1 },
  antracyt: { name: 'Antracyt (Gładki)', url: null, color: '#3d4246', scale: 1 }
};
Object.keys(textureModules).forEach((path) => {
  const fileName = path.split('/').pop();
  const id = fileName.split('.')[0];
  const displayName = id.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  DEKORY[id] = { name: displayName, url: textureModules[path].default, color: '#cccccc', scale: 0.3 };
});
const domyslnyDekorKlucz = Object.keys(DEKORY)[0];

// --- 3. MATERIAŁY ---
function PłytaMaterial({ dekor, w = 1, h = 1, rotate = false, offsetX = 0, offsetY = 0 }) {
  if (!dekor || !dekor.url) return <meshStandardMaterial color={dekor?.color || '#fff'} roughness={0.7} metalness={0.05} />;
  return (
    <TextureErrorBoundary fallbackColor={dekor.color}>
      <Suspense fallback={<meshStandardMaterial color={dekor.color} />}>
        <ActualTexture url={dekor.url} w={w} h={h} rotate={rotate} scale={dekor.scale} offsetX={offsetX} offsetY={offsetY} />
      </Suspense>
    </TextureErrorBoundary>
  );
}

function ActualTexture({ url, w, h, rotate, scale, offsetX = 0, offsetY = 0 }) {
  const baseTexture = useTexture(url);

  // Zamykamy CAŁĄ logikę i matematykę wewnątrz useMemo.
  // Dzięki dodaniu zmiennych na samym końcu [], zmuszamy Reacta do 
  // narysowania idealnie dociętej tekstury dla każdej kolejnej szafki.
  const texture = useMemo(() => {
    const cloned = baseTexture.clone();
    cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;

    if (rotate) {
      cloned.repeat.set(Math.max(0.1, h * scale), Math.max(0.1, w * scale));
      cloned.rotation = Math.PI / 2;
      // Wracamy do oryginału - to działało idealnie dla reszty kuchni!
      cloned.offset.set(offsetY * scale, -offsetX * scale);
    } else {
      cloned.repeat.set(Math.max(0.1, w * scale), Math.max(0.1, h * scale));
      cloned.rotation = 0;
      cloned.offset.set(offsetX * scale, offsetY * scale);
    }

    cloned.needsUpdate = true;
    return cloned;
  }, [baseTexture, w, h, rotate, scale, offsetX, offsetY]); // <-- Te zmienne to gwarancja, że słoje się odświeżą!

  return <meshStandardMaterial map={texture} color="#ffffff" roughness={0.5} metalness={0.1} />;
}
function MaterialPilśni() {
  const hdfTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#90775a'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#7a6349' : '#a68c6e';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, Math.random() * 3 + 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
  }, []);
  return <meshStandardMaterial map={hdfTexture} roughness={1} metalness={0} />;
}

// --- 4. KOMPONENTY 3D ---
function NozkaRegulowana({ height }) {
  const plateH = 0.015; const plateR = 0.028; const stemR = 0.015; const stemH = height - 2 * plateH;
  const mat = <meshStandardMaterial color="#2c2c2c" metalness={0.3} roughness={0.6} />;
  return (
    <group>
      <mesh position={[0, height/2 - plateH/2, 0]}><cylinderGeometry args={[plateR, plateR, plateH, 16]} />{mat}</mesh>
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[stemR, stemR, stemH, 16]} />{mat}</mesh>
      <mesh position={[0, -height/2 + plateH/2, 0]}><cylinderGeometry args={[plateR*0.95, plateR, plateH, 16]} />{mat}</mesh>
    </group>
  );
}

function AnimatedCornerDoors({ w, d, w2, d2, h, t, gap, dekorFront, isRight }) {
  const [open, setOpen] = useState(false);
  const hinge1 = useRef();
  const hinge2 = useRef();
  
  const dW1 = w - d2 - gap; // Długość frontu głównego
  const dW2 = w2 - d - gap; // Długość frontu bocznego

  useFrame(() => {
    // Zwiększony kąt otwarcia do 135 stopni (2.35 radiana)
    if (hinge1.current) hinge1.current.rotation.y = THREE.MathUtils.lerp(hinge1.current.rotation.y, open ? (isRight ? -2.35 : 2.35) : 0, 0.15);
    if (hinge2.current) hinge2.current.rotation.y = THREE.MathUtils.lerp(hinge2.current.rotation.y, open ? (isRight ? 2.35 : -2.35) : 0, 0.15);
  });

  // Rozpisane osobno dla prawej i lewej strony, by uniknąć błędów wektorów
  if (isRight) {
    return (
      <group onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {/* DRZWI 1 (Główne) - Zawias skrajny lewy */}
        <group position={[-w/2, h/2, d/2 - t/2]} ref={hinge1}>
          <mesh position={[dW1/2, 0, 0]}>
            <boxGeometry args={[dW1, h - gap, t]} />
            <PłytaMaterial dekor={dekorFront} w={dW1} h={h} />
          </mesh>
          {/* Uchwyt na ZEWNĘTRZNEJ ściance (+Z), obok wewnętrznego załamania */}
          <mesh position={[dW1 - 0.04, h/2 - 0.18, t/2 + 0.015]}>
            <boxGeometry args={[0.015, 0.15, 0.03]} />
            <meshStandardMaterial color="#d4d4d4" />
          </mesh>
        </group>

        {/* DRZWI 2 (Ramienia) - Zawias na samym końcu ramienia z tyłu */}
        <group position={[w/2 - d2 + t/2, h/2, -d/2 + w2]} ref={hinge2}>
          <mesh position={[0, 0, -dW2/2]}>
            <boxGeometry args={[t, h - gap, dW2]} />
            <PłytaMaterial dekor={dekorFront} w={dW2} h={h} />
          </mesh>
          {/* Uchwyt na ZEWNĘTRZNEJ ściance pokoju (-X) */}
          <mesh position={[-t/2 - 0.015, h/2 - 0.18, -dW2 + 0.04]}>
            <boxGeometry args={[0.03, 0.15, 0.015]} />
            <meshStandardMaterial color="#d4d4d4" />
          </mesh>
        </group>
      </group>
    );
  } else {
    return (
      <group onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {/* LEWY NAROŻNIK */}
        <group position={[w/2, h/2, d/2 - t/2]} ref={hinge1}>
          <mesh position={[-dW1/2, 0, 0]}><boxGeometry args={[dW1, h - gap, t]} /><PłytaMaterial dekor={dekorFront} w={dW1} h={h} /></mesh>
          <mesh position={[-dW1 + 0.04, h/2 - 0.18, t/2 + 0.015]}><boxGeometry args={[0.015, 0.15, 0.03]} /><meshStandardMaterial color="#d4d4d4" /></mesh>
        </group>

        <group position={[-w/2 + d2 - t/2, h/2, -d/2 + w2]} ref={hinge2}>
          <mesh position={[0, 0, -dW2/2]}><boxGeometry args={[t, h - gap, dW2]} /><PłytaMaterial dekor={dekorFront} w={dW2} h={h} /></mesh>
          <mesh position={[t/2 + 0.015, h/2 - 0.18, -dW2 + 0.04]}><boxGeometry args={[0.03, 0.15, 0.015]} /><meshStandardMaterial color="#d4d4d4" /></mesh>
        </group>
      </group>
    );
  }
}
function SzafkaNarozna({ cab, dekorFront, dekorBody }) {
  const { w, w2, d, d2, h, baseType, cornerSide } = cab;
  const t = 0.018; const baseH = 0.10;
  const isRight = cornerSide === 'prawy';
  const sign = isRight ? 1 : -1;
  const sideY = baseType === 'cokol' ? (h - baseH) / 2 : h / 2;
  const sideH = baseType === 'cokol' ? h + baseH : h;

  const safeW2 = w2 || 0.9;
  const safeD2 = d2 || 0.5;

  const effW = w - 0.5 + safeD2 - t; 
  const plateA_CenterX = sign * (safeD2 - 0.5 + t) / 2;
  const plateA_CenterZ = 0.25 - d/2 - t/2;
  const plateA_SizeZ = d - t;

  // NAPRAWA: Zastosowany ten sam "numer". Skracamy ramię 2 o grubość drzwiczek ('t')
  // i odpowiednio przesuwamy środek ciężkości płyty (plateB_CenterX).
  const plateB_SizeX = safeD2 - t;
  const plateB_CenterX = sign * (w/2 - 0.5 + (safeD2 + t)/2);
  const plateB_SizeZ = safeW2 - 0.5;
  const plateB_CenterZ = 0.25 - t + plateB_SizeZ / 2;

  const back1_W = effW;
  const back1_X = plateA_CenterX;
  const back1_Z = 0.25 - d;

  const back2_L = safeW2 - 0.5 - t + d;
  const back2_X = sign * (w/2 - 0.5 + safeD2);
  const back2_Z = safeW2/2 - d/2 - t/2;

  return (
    <group position={[0, baseH, 0]}>
      <group position={[0, sideY, 0]}>
        <mesh position={[-sign * (w/2 - t/2), 0, plateA_CenterZ]}>
          <boxGeometry args={[t, sideH, plateA_SizeZ]} />
          <PłytaMaterial dekor={dekorBody} w={d} h={sideH} />
        </mesh>

        {/* NAPRAWA: Skrócony o 't' zewnętrzny bok ramienia 2 */}
        <mesh position={[plateB_CenterX, 0, safeW2 - 0.25 - t/2]}>
          <boxGeometry args={[plateB_SizeX, sideH, t]} />
          <PłytaMaterial dekor={dekorBody} w={plateB_SizeX} h={sideH} />
        </mesh>
      </group>

      {[
        t/2, 
        ...Array.from({ length: cab.shelvesC || 0 }).map((_, i) => t/2 + ((h - 2*t) / ((cab.shelvesC || 0) + 1)) * (i + 1)), 
        h - t/2 
      ].map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          <mesh position={[plateA_CenterX, 0, plateA_CenterZ]}>
            <boxGeometry args={[effW, t, plateA_SizeZ]} />
            <PłytaMaterial dekor={dekorBody} w={effW} h={plateA_SizeZ} rotate />
          </mesh>
          {/* NAPRAWA: Skrócone o 't' półki i wieńce ramienia 2 */}
          <mesh position={[plateB_CenterX, 0, plateB_CenterZ]}>
            <boxGeometry args={[plateB_SizeX, t, plateB_SizeZ]} />
            <PłytaMaterial dekor={dekorBody} w={plateB_SizeX} h={plateB_SizeZ} rotate />
          </mesh>
        </group>
      ))}

      <group position={[0, h/2, 0]}>
        <group position={[back1_X, 0, back1_Z]}>
          <mesh position={[0, 0, 0.001]}><boxGeometry args={[back1_W, h, 0.002]} /><meshStandardMaterial color="#f8f8f8" /></mesh>
          <mesh position={[0, 0, -0.001]}><boxGeometry args={[back1_W, h, 0.002]} /><MaterialPilśni /></mesh>
        </group>
        <group position={[back2_X, 0, back2_Z]}>
          <mesh position={[-sign * 0.001, 0, 0]}><boxGeometry args={[0.002, h, back2_L]} /><meshStandardMaterial color="#f8f8f8" /></mesh>
          <mesh position={[sign * 0.001, 0, 0]}><boxGeometry args={[0.002, h, back2_L]} /><MaterialPilśni /></mesh>
        </group>
      </group>

      <AnimatedCornerDoors w={w} d={0.5} w2={safeW2} d2={0.5} h={h} t={t} gap={0.002} dekorFront={dekorFront} isRight={isRight} />

      {/* Cokół i Nóżki */}
      <group position={[0, -baseH/2, 0]}>
        {(() => {
          const isCokol = baseType === 'cokol' || baseType === 'Pełna skrzynia cokołowa';
          const cokolOffset = isCokol ? t : 0; 
          const recess = t + 0.05; 
          
          const mainToeW = w - 0.5 + recess + t - cokolOffset;
          const mainToeX = -sign * (w/2 - mainToeW/2 - cokolOffset);
          
          // POPRAWKA: Zmiana znaku na - t/2 idealnie cofa listwę główną na linię z szafkami obok
          const mainToeZ = 0.25 - recess - t/2; 

          const sideToeL = safeW2 - 0.5 + recess - cokolOffset;
          const sideToeZ = 0.25 - recess + sideToeL/2;
          
          // POPRAWKA: Zmiana znaku na + t/2 idealnie cofa listwę boczną
          const sideToeX = sign * (w/2 - 0.5 + recess + t/2);

          return (
            <>
              <mesh position={[mainToeX, 0, mainToeZ]}>
                <boxGeometry args={[mainToeW, baseH, t]} />
                <PłytaMaterial dekor={dekorBody} w={mainToeW} h={baseH} rotate />
              </mesh>
              <mesh position={[sideToeX, 0, sideToeZ]}>
                <boxGeometry args={[t, baseH, sideToeL]} />
                <PłytaMaterial dekor={dekorBody} w={sideToeL} h={baseH} rotate />
              </mesh>
            </>
          );
        })()}

        {baseType === 'nozki_regulowane' && (
          <>
            {/* POPRAWKA: Nóżki przednie wsunięte głębiej, na 15 cm (-0.15) od krawędzi frontu, dokładnie tak jak w zwykłych szafkach */}
            <group position={[-sign*(w/2 - 0.05), 0, 0.25 - 0.15]}><NozkaRegulowana height={baseH} /></group>
            <group position={[-sign*(w/2 - 0.05), 0, 0.25 - d + 0.05]}><NozkaRegulowana height={baseH} /></group>
            
            <group position={[sign*(w/2 - 0.5 + 0.15), 0, 0.25 - 0.15]}><NozkaRegulowana height={baseH} /></group>
            <group position={[sign*(w/2 - 0.5 + safeD2 - 0.05), 0, 0.25 - d + 0.05]}><NozkaRegulowana height={baseH} /></group>
            
            <group position={[sign*(w/2 - 0.5 + 0.15), 0, safeW2 - 0.25 - 0.05]}><NozkaRegulowana height={baseH} /></group>
            <group position={[sign*(w/2 - 0.5 + safeD2 - 0.05), 0, safeW2 - 0.25 - 0.05]}><NozkaRegulowana height={baseH} /></group>
          </>
        )}
      </group>
    </group>
  );
}
function FrontDrzwi({ doorWidth, height, t, gap, dekor, side = 'left' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef();
  useFrame(() => { if (ref.current) { const target = isOpen ? (side === 'left' ? -1.57 : 1.57) : 0; ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, target, 0.1); } });
  const meshX = side === 'left' ? doorWidth / 2 : -doorWidth / 2;
  return (
    <group ref={ref}>
      <mesh position={[meshX, 0, 0]} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}>
        <boxGeometry args={[Math.max(0.01, doorWidth - gap), Math.max(0.01, height - gap), t]} /><PłytaMaterial dekor={dekor} w={doorWidth} h={height} />
      </mesh>
      {/* Uchwyt obniżony do 18 cm od górnej krawędzi */}
      <mesh position={[side === 'left' ? doorWidth - 0.04 : -doorWidth + 0.04, height/2 - 0.18, t/2 + 0.015]}><boxGeometry args={[0.015, 0.15, 0.03]} /><meshStandardMaterial color="#d4d4d4" metalness={0.8} /></mesh>
    </group>
  );
}

function Szuflada({ width, heightD, depth, t, gap, dekorFront, dekorBody, yPos }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef();
  const baseZ = depth / 2 - t / 2;
  const tBox = 0.012; const bW = width - 4*t; const bD = depth - 2*t; const bH = heightD * 0.6;    
  useFrame(() => { if (ref.current) { const target = isOpen ? (baseZ + depth * 0.75) : baseZ; ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, target, 0.05); } });
  return (
    <group position={[0, yPos, baseZ]} ref={ref}>
      <mesh onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}><boxGeometry args={[Math.max(0.01, width - gap*2), Math.max(0.01, heightD - gap), t]} /><PłytaMaterial dekor={dekorFront} w={width} h={heightD} /></mesh>
      <mesh position={[0, heightD/2 - 0.04, t/2 + 0.015]}><boxGeometry args={[0.2, 0.015, 0.03]} /><meshStandardMaterial color="#d4d4d4" metalness={0.8} /></mesh>
      <group position={[0, 0, -t/2]}>
          <mesh position={[0, -heightD/2 + tBox/2 + 0.01, -bD/2]}><boxGeometry args={[Math.max(0.01, bW), tBox, Math.max(0.01, bD)]} /><PłytaMaterial dekor={dekorBody} w={bW} h={bD} rotate /></mesh>
          <mesh position={[-bW/2 + tBox/2, -heightD/2 + bH/2 + 0.01, -bD/2]}><boxGeometry args={[tBox, Math.max(0.01, bH), Math.max(0.01, bD)]} /><PłytaMaterial dekor={dekorBody} w={bD} h={bH} /></mesh>
          <mesh position={[bW/2 - tBox/2, -heightD/2 + bH/2 + 0.01, -bD/2]}><boxGeometry args={[tBox, Math.max(0.01, bH), Math.max(0.01, bD)]} /><PłytaMaterial dekor={dekorBody} w={bD} h={bH} /></mesh>
          <mesh position={[0, -heightD/2 + bH/2 + 0.01, -bD + tBox/2]}><boxGeometry args={[Math.max(0.01, bW - 2*tBox), Math.max(0.01, bH), tBox]} /><PłytaMaterial dekor={dekorBody} w={bW} h={bH} rotate /></mesh>
      </group>
    </group>
  );
}

function Szafka({ width, height, depth, dekorFront, dekorBody, type, baseType, doorCount, doorDirection, drawersCount, shelvesCount, drawerRatios, hybridSplit, hybridOrder }) {
  if (type === 'puste') return null; 
  
  const t = 0.018; const gap = 0.002; const baseH = 0.10;
  const sideH = baseType === 'cokol' ? height + baseH : height;
  const sideY = baseType === 'cokol' ? (height - baseH) / 2 : height / 2;
  
  const renderDrawers = (h, startY) => {
    const netH = h - (drawersCount * gap);
    let curY = startY; const revRatios = [...(drawerRatios || [])].reverse();
    return revRatios.map((r, i) => {
      const sh = (r / 100) * netH; const y = curY + sh / 2; curY += sh + gap;
      return (
        <React.Fragment key={i}>
          <Szuflada width={width} heightD={sh} depth={depth} t={t} gap={gap} dekorFront={dekorFront} dekorBody={dekorBody} yPos={y} />
          {i < revRatios.length - 1 && (
            <mesh position={[0, curY - gap/2, -t/2]}>
              <boxGeometry args={[Math.max(0.01, width-2*t), t, Math.max(0.01, depth-t)]} />
              <PłytaMaterial dekor={dekorBody} w={width} h={depth} rotate />
            </mesh>
          )}
        </React.Fragment>
      );
    });
  };
  
  const renderDoors = (h, startY) => {
    const safeShelves = shelvesCount || 0; // Blokada przed próbą wygenerowania "undefined" półek
    const step = (h - 2*t) / (safeShelves + 1);
    return (
      <group position={[0, startY + h/2, 0]}>
        {Array.from({ length: safeShelves }).map((_, i) => (
          <mesh key={i} position={[0, -h/2 + step*(i+1), -t/2+0.005]}>
            <boxGeometry args={[Math.max(0.01, width-2*t), t, Math.max(0.01, depth-t-0.02)]} /><PłytaMaterial dekor={dekorBody} w={width} h={depth} rotate />
          </mesh>
        ))}
        <group position={[0, 0, depth/2 - t/2]}>
          {doorCount === 1 ? <group position={[doorDirection === 'left' ? -width/2+gap : width/2-gap, 0, 0]}><FrontDrzwi doorWidth={width-gap*2} height={h} t={t} gap={gap} dekor={dekorFront} side={doorDirection} /></group> :
          <><group position={[-width/2+gap, 0, 0]}><FrontDrzwi doorWidth={width/2-gap} height={h} t={t} gap={gap} dekor={dekorFront} side="left" /></group><group position={[width/2-gap, 0, 0]}><FrontDrzwi doorWidth={width/2-gap} height={h} t={t} gap={gap} dekor={dekorFront} side="right" /></group></>}
        </group>
      </group>
    );
  };

  return (
    <group position={[0, baseH, 0]}>
      <mesh position={[-width/2 + t/2, sideY, -t/2]}><boxGeometry args={[t, sideH, depth - t]} /><PłytaMaterial dekor={dekorBody} w={depth} h={sideH} /></mesh>
      <mesh position={[width/2 - t/2, sideY, -t/2]}><boxGeometry args={[t, sideH, depth - t]} /><PłytaMaterial dekor={dekorBody} w={depth} h={sideH} /></mesh>
      <mesh position={[0, t/2, -t/2]}><boxGeometry args={[Math.max(0.01, width - 2*t), t, depth - t]} /><PłytaMaterial dekor={dekorBody} w={width} h={depth} rotate /></mesh>
      <mesh position={[0, height - t/2, depth/2 - t - 0.05]}><boxGeometry args={[Math.max(0.01, width - 2*t), t, 0.1]} /><PłytaMaterial dekor={dekorBody} w={width} h={0.1} rotate /></mesh>
      <mesh position={[0, height - t/2, -depth/2 + 0.05]}><boxGeometry args={[Math.max(0.01, width - 2*t), t, 0.1]} /><PłytaMaterial dekor={dekorBody} w={width} h={0.1} rotate /></mesh>
      
      {/* NAPRAWIONE: Wieniec dzielący hybrydę wskakuje na właściwą wysokość */}
      {type === 'hybryda' && (
         <mesh position={[0, hybridOrder === 'szuflady-gora' ? height - height*(hybridSplit/100) : height*(hybridSplit/100), -t/2]}>
            <boxGeometry args={[Math.max(0.01, width-2*t), t, Math.max(0.01, depth-t)]} />
            <PłytaMaterial dekor={dekorBody} w={width} h={depth} rotate />
         </mesh>
      )}

      <group position={[0, height/2, -depth/2 - 0.001]}>
        <mesh position={[0, 0, 0.001]}><boxGeometry args={[width, height, 0.001]} /><meshStandardMaterial color="#f8f8f8" roughness={0.8} /></mesh>
        <mesh position={[0, 0, -0.0005]}><boxGeometry args={[width, height, 0.002]} /><MaterialPilśni /></mesh>
      </group>
      <group position={[0, -baseH/2, 0]}>
        {baseType === 'nozki_regulowane' ? <><group position={[-width/2 + 0.05, 0, depth/2 - 0.15]}><NozkaRegulowana height={baseH} /></group><group position={[width/2 - 0.05, 0, depth/2 - 0.15]}><NozkaRegulowana height={baseH} /></group><group position={[-width/2 + 0.05, 0, -depth/2 + 0.05]}><NozkaRegulowana height={baseH} /></group><group position={[width/2 - 0.05, 0, -depth/2 + 0.05]}><NozkaRegulowana height={baseH} /></group><mesh position={[0, 0, depth/2 - t - 0.05 - t/2]}><boxGeometry args={[width, baseH, t]} /><PłytaMaterial dekor={dekorBody} w={width} h={baseH} rotate /></mesh></> : <mesh position={[0, 0, depth/2 - t - 0.05 - t/2]}><boxGeometry args={[Math.max(0.01, width - 2*t), baseH, t]} /><PłytaMaterial dekor={dekorBody} w={width} h={baseH} rotate /></mesh>}
      </group>
      <group position={[0, height/2, 0]}>
        {type === 'drzwi' && renderDoors(height, -height/2)}
        {type === 'szuflady' && renderDrawers(height, -height/2)}
        {type === 'hybryda' && (hybridOrder === 'szuflady-gora' ? <>{renderDrawers(height * (hybridSplit/100), height/2 - height*(hybridSplit/100))}{renderDoors(height * (1 - hybridSplit/100), -height/2)}</> : <>{renderDrawers(height * (hybridSplit/100), -height/2)}{renderDoors(height * (1 - hybridSplit/100), -height/2 + height*(hybridSplit/100))}</>)}
      </group>
    </group>
  );
}
// --- NOWY KOMPONENT: ŚCIANY 3D ---
function Walls3D({ nodes }) {
  if (nodes.length < 2) return null;
  const walls = [];
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const p1 = nodes[i];
    const p2 = nodes[i + 1];
    
    // Obliczamy długość, pozycję i kąt obrotu każdej ściany
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = -Math.atan2(dz, dx); 
    const posX = (p1.x + p2.x) / 2;
    const posZ = (p1.z + p2.z) / 2;

    walls.push(
      <mesh key={i} position={[posX, 1.25, posZ]} rotation={[0, angle, 0]}>
        <boxGeometry args={[length + 0.1, 2.5, 0.1]} /> {/* 0.1 to grubość ściany, 2.5 to wysokość */}
        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  return <group>{walls}</group>;
}

// --- 5. INTERFEJS (MINIATURY) ---
function MiniaturaSzafki({ cab, size = 50, showHandles = true }) {
  const scale = size / 1.5; 
  const widthPx = cab.w * scale; 
  const heightPx = cab.h * scale; 
  const basePx = 0.1 * scale; 
  
  const outlineColor = '#343a40'; 
  
  // TWARDY RESET KOLORÓW UI - Ikony są zablokowane i zawsze czyste (niezależnie od wybranych dekorów w 3D)
  const fColor = '#ffffff'; 
  const bColor = '#f8f9fa';

  const isCornerOrEmpty = cab.type === 'puste' || cab.type === 'naroznik';

  const bodyStyle = { 
    width: `${widthPx}px`, 
    height: `${heightPx}px`, 
    backgroundColor: isCornerOrEmpty ? 'transparent' : bColor, 
    padding: isCornerOrEmpty ? '0' : '1px', 
    boxSizing: 'border-box', 
    display: 'flex', 
    flexDirection: 'column', 
    border: isCornerOrEmpty ? 'none' : `1.5px solid ${outlineColor}`,
    position: 'relative' 
  };
  
  const frontStyle = { 
    backgroundColor: fColor, 
    position: 'relative', 
    width: '100%',
    border: `1px solid ${outlineColor}`, 
    boxSizing: 'border-box'
  };
  
  const Handle = ({ v = false, a = 'right', isDoor = false }) => {
    if (!showHandles) return null;
    return <div style={{ position: 'absolute', backgroundColor: outlineColor, borderRadius: '1px', ...(v ? { width: '2px', height: '6px', top: isDoor ? '15%' : '50%', [a]: '3px', transform: isDoor ? 'none' : 'translateY(-50%)' } : { width: '8px', height: '2px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }) }} />;
  };

  const renderEmptyX = () => (
    <div style={{width: '100%', height: '100%', position: 'relative', border: `1.5px dashed ${outlineColor}`, boxSizing: 'border-box'}}>
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <line x1="0" y1="0" x2="100%" y2="100%" stroke={outlineColor} strokeWidth="1.5" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke={outlineColor} strokeWidth="1.5" />
      </svg>
    </div>
  );

  const renderCornerIcon = () => {
    const isRight = cab.cornerSide !== 'lewy';
    return (
      <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible', transform: isRight ? 'scale(2.0)' : 'scale(-2.0, 2.0)' }}>
          <polygon points="50,20 85,38 70,48 50,38 30,48 15,38" fill={bColor} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="15,38 30,48 30,88 15,78" fill={bColor} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="70,48 85,38 85,78 70,88" fill={bColor} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="30,48 50,38 50,78 30,88" fill={fColor} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="50,38 70,48 70,88 50,78" fill={fColor} stroke={outlineColor} strokeWidth="3" strokeLinejoin="round" />
          {showHandles && (
            <>
              <line x1="43" y1="48" x2="43" y2="60" stroke={outlineColor} strokeWidth="3" strokeLinecap="round" />
              <line x1="57" y1="48" x2="57" y2="60" stroke={outlineColor} strokeWidth="3" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>
    );
  };

  const renderDoors = (hp) => {
    if (cab.doorsC === 2) return <div style={{ display: 'flex', width: '100%', height: hp ? `${hp}%` : '100%' }}><div style={{ ...frontStyle, width: '50%' }}><Handle v a="right" isDoor /></div><div style={{ ...frontStyle, width: '50%' }}><Handle v a="left" isDoor /></div></div>;
    const al = (cab.doorDirection === 'right') ? 'left' : 'right';
    return <div style={{ ...frontStyle, height: hp ? `${hp}%` : '100%' }}><Handle v a={al} isDoor /></div>;
  };

  const renderContent = () => {
    if (cab.type === 'puste') return renderEmptyX();
    if (cab.type === 'naroznik') return renderCornerIcon();
    if (cab.type === 'drzwi') return renderDoors();
    if (cab.type === 'szuflady') {
      return [33.33, 33.33, 33.34].map((r, i) => <div key={i} style={{ ...frontStyle, height: `${r}%` }}><Handle /></div>);
    }
    if (cab.type === 'hybryda') {
      const dH = cab.split; 
      const drP = <div style={{ height: `${dH}%`, display: 'flex', flexDirection: 'column' }}><div style={{ ...frontStyle, height: '100%' }}><Handle /></div></div>;
      const doP = renderDoors(100 - cab.split); 
      return cab.order === 'szuflady-gora' ? <>{drP}{doP}</> : <>{doP}{drP}</>;
    }
  };

  const isCocol = cab.baseType === 'cokol' || cab.baseType === 'Pełna skrzynia cokołowa';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={bodyStyle}>{renderContent()}</div>
      <div style={{ width: '100%', height: `${basePx}px`, backgroundColor: (isCocol && !isCornerOrEmpty) ? outlineColor : 'transparent', display: 'flex', justifyContent: 'space-around' }}>
        {(!isCocol && !isCornerOrEmpty) && <><div style={{ width: '2px', height: '100%', backgroundColor: outlineColor }} /><div style={{ width: '2px', height: '100%', backgroundColor: outlineColor }} /></>}
      </div>
    </div>
  );
}

function CustomSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <span>{DEKORY[value].name}</span><span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', marginTop: '4px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {Object.keys(DEKORY).map((k) => (
            <div key={k} onClick={() => { onChange(k); setIsOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '3px', border: '1px solid #eee', background: DEKORY[k].url ? `url(${DEKORY[k].url})` : DEKORY[k].color, backgroundSize: 'cover' }} />
              <span style={{ fontSize: '12px' }}>{DEKORY[k].name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DOMYSLNA_SZAFKA = {
  w: 0.6, h: 0.82, d: 0.5, type: 'drzwi', baseType: 'nozki_regulowane',
  drawersC: 3, doorsC: 1, shelvesC: 1, softClose: false, doorDirection: 'left',
  split: 30, order: 'szuflady-gora', ratios: [33.3, 33.3, 33.4],
  useCustomColors: false, fDecor: domyslnyDekorKlucz, bDecor: domyslnyDekorKlucz, hasWorktop: true,
  w2: 1.0, d2: 0.5, cornerSide: 'prawy' 
};

// --- 6. APLIKACJA GŁÓWNA ---
export default function App() {
  const [currentStep, setCurrentStep] = useState(1); // Zaczynamy od Kroku 1
  const [wallNodes, setWallNodes] = useState([]); // W przyszłości tu będziemy trzymać narysowane ściany w 2D
  const [previewNode, setPreviewNode] = useState(null);
  const [isHoveringStart, setIsHoveringStart] = useState(false);
  const [kitchenStart, setKitchenStart] = useState(null);
  const [previewKitchenStart, setPreviewKitchenStart] = useState(null);
  const [kitchenFlip, setKitchenFlip] = useState(false); // Opcja odbicia lustrzanego
  const [showStartModal, setShowStartModal] = useState(false); // NOWOŚĆ: Okienko popout

  const [cabinets, setCabinets] = useState([{ ...DOMYSLNA_SZAFKA, id: Date.now() }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showWorktopGlobal, setShowWorktopGlobal] = useState(false);
  const [worktopDecor, setWorktopDecor] = useState(domyslnyDekorKlucz);
  const [worktopDepth, setWorktopDepth] = useState(0.60); 
  const [globalF, setGlobalF] = useState(domyslnyDekorKlucz);
  const [globalB, setGlobalB] = useState(domyslnyDekorKlucz);

  const activeCab = cabinets[activeIdx] || cabinets[0];
  const updateActiveCab = (patch) => { setCabinets(prev => prev.map((cab, i) => i === activeIdx ? { ...cab, ...patch } : cab)); };

  const handleRatio = (idx, val) => {
    const nv = parseFloat(val); const diff = nv - activeCab.ratios[idx]; let next = [...activeCab.ratios]; next[idx] = nv;
    const others = next.map((_, i) => i).filter(i => i !== idx); const sumO = others.reduce((s, i) => s + activeCab.ratios[i], 0);
    if (sumO > 0) others.forEach(i => next[i] = Math.max(5, next[i] - (diff * (activeCab.ratios[i] / sumO))));
    const cSum = next.reduce((a, b) => a + b, 0); next[others[0]] += (100 - cSum); updateActiveCab({ ratios: next });
  };

  const addCabinet = () => {
    const n = [...cabinets, { ...DOMYSLNA_SZAFKA, id: Date.now(), d: activeCab.d, fDecor: globalF, bDecor: globalB }];
    setCabinets(n); setActiveIdx(n.length - 1);
  };

  const moveActiveCab = (direction) => {
    const newIdx = activeIdx + direction;
    if (newIdx < 0 || newIdx >= cabinets.length) return;
    const newCabs = [...cabinets];
    [newCabs[activeIdx], newCabs[newIdx]] = [newCabs[newIdx], newCabs[activeIdx]];
    setCabinets(newCabs);
    setActiveIdx(newIdx);
  };

  const finalPrice = cabinets.reduce((sum, cab) => sum + (cab.type === 'puste' ? 0 : Math.round((cab.w * cab.h * cab.d * 1150) + (cab.type !== 'drzwi' ? cab.drawersC * 180 : 95))), 0);

// SILNIK UKŁADU KUCHNI
  const layout = useMemo(() => {
    if (!kitchenStart) {
      const res = [];
      const cur = new THREE.Object3D();
      let rD = 0; let cD = 0;
      cabinets.forEach((cab) => {
        cur.translateX(cab.w / 2);
        cur.updateMatrixWorld();
        res.push({ id: cab.id, pos: [cur.position.x, 0, cur.position.z], rot: cur.rotation.y, dist: rD, crossDist: cD });
        cur.translateX(cab.w / 2); rD += cab.w;
        if (cab.type === 'naroznik') {
          const safeW2 = cab.w2 || 1.0;
          if (cab.cornerSide === 'prawy') {
            cur.translateX(-0.25); cur.translateZ(safeW2 - 0.25); cur.rotateY(-Math.PI / 2); cD += 0.07;
          } else {
            cur.translateX(-cab.w + 0.25); cur.translateZ(safeW2 - 0.25); cur.rotateY(Math.PI / 2); cD -= 0.07;
          }
          rD += safeW2 - 0.5;
        }
      });
      return res;
    }

    const localResult = [];
    const localCursor = new THREE.Object3D();
    let runDist = 0; let crossDist = 0;

    // Magiczna matematyka - decyduje czy musimy "odbić" układ
    const shouldFlip = (!kitchenStart.isClockwise) !== kitchenFlip;

    cabinets.forEach((cab) => {
      localCursor.translateX(cab.w / 2);
      localCursor.updateMatrixWorld();
      localResult.push({ id: cab.id, pos: [localCursor.position.x, 0, localCursor.position.z], rot: localCursor.rotation.y, dist: runDist, crossDist: crossDist });
      localCursor.translateX(cab.w / 2);
      runDist += cab.w;

      if (cab.type === 'naroznik') {
        // Czysta matematyka szafki - bez mieszania w to lustrzanego odbicia.
        // Skoro przy renderowaniu podmieniamy model, czysta ścieżka matematyczna po przejściu przez lustro dopasuje się perfekcyjnie!
        const isRight = cab.cornerSide === 'prawy';
        const safeW2 = cab.w2 || 1.0;
        
        if (isRight) {
          localCursor.translateX(-0.25);
          localCursor.translateZ(safeW2 - 0.25);
          localCursor.rotateY(-Math.PI / 2);
          crossDist += 0.07;
        } else {
          localCursor.translateX(-cab.w + 0.25);
          localCursor.translateZ(safeW2 - 0.25);
          localCursor.rotateY(Math.PI / 2);
          crossDist -= 0.07;
        }
        runDist += safeW2 - 0.5;
      }
    });

    const worldCursor = new THREE.Object3D();
    worldCursor.position.set(kitchenStart.x, 0, kitchenStart.z);
    worldCursor.rotation.y = Math.atan2(kitchenStart.inDx, kitchenStart.inDz); // BEZWZGLĘDNE FRONTEM DO ŚRODKA POKOJU
    worldCursor.translateZ((cabinets[0]?.d || 0.5) / 2);
    worldCursor.updateMatrixWorld();

    const finalResult = [];
    localResult.forEach(item => {
      const dummy = new THREE.Object3D();
      dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
      dummy.rotation.y = item.rot;

      if (shouldFlip) {
        dummy.position.x = -dummy.position.x;
        dummy.rotation.y = -dummy.rotation.y;
      }

      worldCursor.add(dummy);
      worldCursor.updateMatrixWorld();

      const worldPos = new THREE.Vector3();
      dummy.getWorldPosition(worldPos);
      const worldQuat = new THREE.Quaternion();
      dummy.getWorldQuaternion(worldQuat);
      const euler = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ');

      worldCursor.remove(dummy);

      finalResult.push({
        id: item.id,
        pos: [worldPos.x, worldPos.y, worldPos.z],
        rot: euler.y,
        dist: item.dist,
        crossDist: item.crossDist
      });
    });

    return finalResult;
  }, [cabinets, kitchenStart, kitchenFlip]);

  // ŚLEDZENIE ŚRODKA SCENY PRZEZ KAMERĘ
  const sceneCenter = useMemo(() => {
    if (layout.length === 0) return [0, 0.8, 0];
    let minX = layout[0].pos[0], maxX = layout[0].pos[0];
    let minZ = layout[0].pos[2], maxZ = layout[0].pos[2];
    layout.forEach(l => {
      minX = Math.min(minX, l.pos[0]); maxX = Math.max(maxX, l.pos[0]);
      minZ = Math.min(minZ, l.pos[2]); maxZ = Math.max(maxZ, l.pos[2]);
    });
    return [(minX + maxX) / 2, 0.8, (minZ + maxZ) / 2];
  }, [layout]);

// --- NOWOŚĆ: INTELIGENTNE ZAMYKANIE POKOJU (OPTYMALIZACJA ŚCIAN) ---
  const zamykajZOptymalizacja = () => {
    const first = wallNodes[0];
    const last = wallNodes[wallNodes.length - 1];
    let finalNodes = [];
    
    // 1. Standardowe domknięcie (z zachowaniem kąta prostego)
    if (last.x !== first.x && last.z !== first.z) {
      finalNodes = [...wallNodes, { x: first.x, z: last.z }, first];
    } else {
      finalNodes = [...wallNodes, first];
    }

    // 2. Czyszczenie zbędnych punktów (np. gdy ktoś zaczął rysować na środku ściany)
    let unique = finalNodes.slice(0, -1);
    let changed = true;
    while(changed && unique.length >= 3) {
      changed = false;
      let temp = [];
      for(let i = 0; i < unique.length; i++) {
        let prev = unique[(i - 1 + unique.length) % unique.length];
        let curr = unique[i];
        let next = unique[(i + 1) % unique.length];
        
        // Sprawdzamy, czy 3 kolejne punkty tworzą prostą linię w osi X lub Z
        let sameX = Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01;
        let sameZ = Math.abs(prev.z - curr.z) < 0.01 && Math.abs(curr.z - next.z) < 0.01;
        
        if (sameX || sameZ) {
          changed = true; // Wyrzucamy punkt środkowy (curr), pozwalając ścianom się scalić!
        } else {
          temp.push(curr);
        }
      }
      if (temp.length < 3) break; // Zabezpieczenie na wypadek ekstremalnych błędów
      unique = temp;
    }
    
    // Zapisujemy nowy, czysty kształt i resetujemy podglądy
    setWallNodes([...unique, unique[0]]);
    setIsHoveringStart(false);
    setPreviewNode(null);
    setShowStartModal(true); // NOWOŚĆ: Odpalamy popout!
  };

 return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', fontFamily: 'sans-serif', margin: 0, backgroundColor: '#f0f0f0' }}>
      
      {/* GÓRNY PASEK ZAKŁADEK (NAWIGACJA) */}
      <div style={{ display: 'flex', backgroundColor: '#2c3e50', padding: '10px 20px', gap: '15px', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 100 }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', marginRight: '30px' }}>Osobisty Stolarz 3D</div>
        
        <button 
          onClick={() => setCurrentStep(1)} 
          style={{ padding: '10px 20px', backgroundColor: currentStep === 1 ? '#40c057' : 'transparent', color: 'white', border: currentStep === 1 ? 'none' : '1px solid #7f8c8d', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.2s' }}
        >
          📐 Krok 1: Kształt i Ściany
        </button>

        <button 
          onClick={() => setCurrentStep(2)} 
          style={{ padding: '10px 20px', backgroundColor: currentStep === 2 ? '#40c057' : 'transparent', color: 'white', border: currentStep === 2 ? 'none' : '1px solid #7f8c8d', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.2s' }}
        >
          🗄️ Krok 2: Projektowanie Szafek
        </button>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ APLIKACJI (Zależna od wybranego kroku) */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

        {/* --- KROK 1: KREATOR ŚCIAN 2D --- */}
        {currentStep === 1 && (
          // DODANE: flex: 1, boxSizing: 'border-box' oraz większy padding z dołu (60px)
          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#e9ecef', padding: '20px 20px 60px 20px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h1 style={{ color: '#2c3e50', marginBottom: '5px' }}>Narysuj układ ścian</h1>
            <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>Kliknij na siatkę, aby postawić róg ściany. Skala siatki to co 0.5 metra.</p>

            

            {/* Obszar rysowania (SVG) */}
            <div 
              style={{ width: '600px', height: '600px', backgroundColor: 'white', border: '2px solid #bdc3c7', borderRadius: '8px', position: 'relative', cursor: isHoveringStart ? 'pointer' : 'crosshair', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', flexShrink: 0 }}
              onMouseMove={(e) => {
                const isRoomClosed = wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z;
                
                const rect = e.currentTarget.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const pz = e.clientY - rect.top;
                
                let x = Math.round((px - 300) / 1.2) / 100;
                let z = Math.round((pz - 300) / 1.2) / 100;

                // --- NOWOŚĆ: WYKRYWANIE ŚCIAN DLA STARTU KUCHNI ---
                if (isRoomClosed) {
                  let area = 0;
                  for (let i = 0; i < wallNodes.length - 1; i++) {
                    area += (wallNodes[i+1].x - wallNodes[i].x) * (wallNodes[i+1].z + wallNodes[i].z);
                  }
                  const isClockwise = area < 0;

                  let minDist = Infinity;
                  let bestPoint = null;
                  let bestAngle = 0;
                  let bestInDx = 0;
                  let bestInDz = 0;
                  let bestWallA = null;
                  let bestWallB = null;
                  let bestWallIdx = -1;
                  let bestT = 0;

                  for (let i = 0; i < wallNodes.length - 1; i++) {
                    const A = wallNodes[i]; const B = wallNodes[i+1];
                    const dx = B.x - A.x; const dz = B.z - A.z;
                    const lenSq = dx*dx + dz*dz;
                    if (lenSq === 0) continue;

                    let t = ((x - A.x)*dx + (z - A.z)*dz) / lenSq;
                    t = Math.max(0, Math.min(1, t)); 
                    
                    const projX = A.x + t * dx;
                    const projZ = A.z + t * dz;
                    const distSq = (x - projX)**2 + (z - projZ)**2;

                    if (distSq < minDist) {
                      minDist = distSq;
                      bestPoint = { x: projX, z: projZ };
                      
                      const len = Math.sqrt(lenSq);
                      const inDx = isClockwise ? -dz/len : dz/len;
                      const inDz = isClockwise ? dx/len : -dx/len;
                      bestInDx = inDx;
                      bestInDz = inDz;
                      bestAngle = Math.atan2(inDx, inDz); 
                      bestWallA = A;
                      bestWallB = B;
                      bestWallIdx = i;
                      bestT = t;
                    }
                  }
                  if (minDist < 0.25) setPreviewKitchenStart({ ...bestPoint, angle: bestAngle, inDx: bestInDx, inDz: bestInDz, isClockwise, wallA: bestWallA, wallB: bestWallB, wallIndex: bestWallIdx, t: bestT });
                  else setPreviewKitchenStart(null);
                  return;
                }

                // ... reszta standardowego rysowania
                if (wallNodes.length > 2) {
                  const firstPx = wallNodes[0].x * 120 + 300;
                  const firstPz = wallNodes[0].z * 120 + 300;
                  const distance = Math.sqrt(Math.pow(px - firstPx, 2) + Math.pow(pz - firstPz, 2));
                  if (distance < 30) { setIsHoveringStart(true); setPreviewNode(wallNodes[0]); return; }
                }
                setIsHoveringStart(false);

                if (wallNodes.length > 0) {
                  const last = wallNodes[wallNodes.length - 1];
                  if (Math.abs(x - last.x) > Math.abs(z - last.z)) z = last.z; else x = last.x; 
                }
                setPreviewNode({ x, z });
              }}
              onMouseLeave={() => { setPreviewNode(null); setIsHoveringStart(false); setPreviewKitchenStart(null); }}
              onClick={() => {
                const isRoomClosed = wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z;
                
                // --- NOWOŚĆ: ZATWIERDZENIE STARTU KUCHNI ---
                if (isRoomClosed) {
                  if (previewKitchenStart) setKitchenStart(previewKitchenStart);
                  return;
                }

                if (!previewNode) return;
                if (isHoveringStart && wallNodes.length > 2) { zamykajZOptymalizacja(); return; }
                if (wallNodes.length > 0 && previewNode.x === wallNodes[wallNodes.length - 1].x && previewNode.z === wallNodes[wallNodes.length - 1].z) return;
                setWallNodes([...wallNodes, previewNode]);
              }}
            >
              <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f2f6" strokeWidth="1"/></pattern></defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <line x1="300" y1="0" x2="300" y2="600" stroke="#dfe4ea" strokeWidth="2" />
                <line x1="0" y1="300" x2="600" y2="300" stroke="#dfe4ea" strokeWidth="2" />

                {/* Gotowe ściany (Mnożnik x120) */}
                {wallNodes.length > 0 && <path d={`M ${wallNodes.map(p => `${p.x * 120 + 300},${p.z * 120 + 300}`).join(' L ')}`} fill="none" stroke="#2c3e50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}

                {/* WYMIARY DLA GOTOWYCH ŚCIAN (Środek = x60 zamiast x30) */}
                {wallNodes.slice(0, -1).map((node, i) => {
                  const p1 = node; const p2 = wallNodes[i + 1];
                  const cx = (p1.x + p2.x) * 60 + 300; 
                  const cy = (p1.z + p2.z) * 60 + 300;
                  const dx = p2.x - p1.x;
                  const dz = p2.z - p1.z;
                  const len = Math.sqrt(dx * dx + dz * dz);
                  if (len === 0) return null;
                  
                  const dist = Math.round(len * 100);
                  const nx = -dz / len; const nz = dx / len;
                  
                  // --- NOWOŚĆ: DYNAMICZNY OFFSET ---
                  // Ściany poziome (gdzie tekst rozsuwamy w górę/dół) dostają mniejszy offset, bo ramka jest niska
                  // Ściany pionowe (rozsuwamy w lewo/prawo) zostają z szerokim offsetem 38px
                  const isHorizontal = Math.abs(dx) > Math.abs(dz);
                  const offset = isHorizontal ? 18 : 38; 
                  
                  const dimX = cx + nx * offset; const dimY = cy + nz * offset;
                  const nameX = cx - nx * offset; const nameY = cy - nz * offset;

                  return (
                    <g key={`label-${i}`}>
                      {/* NOWOŚĆ: Interaktywne okienko input osadzone prosto w SVG */}
                      <foreignObject x={dimX - 38} y={dimY - 15} width="76" height="30" style={{ overflow: 'visible' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #3498db', borderRadius: '4px', padding: '2px 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                             onMouseDown={(e) => e.stopPropagation()} 
                             onClick={(e) => e.stopPropagation()}
                        >
                          <input 
                            type="number" 
                            value={dist}
                            onChange={(e) => {
                              const newLen = parseInt(e.target.value);
                              if (isNaN(newLen) || newLen <= 0) return;
                              
                              const newNodes = wallNodes.map(n => ({ ...n }));
                              const A = newNodes[i];
                              const B = newNodes[i + 1];
                              const currentLength = Math.sqrt(dx * dx + dz * dz) || 1;
                              
                              B.x = A.x + (dx / currentLength) * (newLen / 100);
                              B.z = A.z + (dz / currentLength) * (newLen / 100);

                              const isRoomClosed = wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z;
                              if (isRoomClosed && i + 1 === newNodes.length - 1) { newNodes[0] = { ...B }; }
                              setWallNodes(newNodes);
                              
                              if (kitchenStart && kitchenStart.wallIndex !== undefined) {
                                 const kA = newNodes[kitchenStart.wallIndex];
                                 const kB = newNodes[kitchenStart.wallIndex + 1];
                                 setKitchenStart({
                                   ...kitchenStart, x: kA.x + kitchenStart.t * (kB.x - kA.x), z: kA.z + kitchenStart.t * (kB.z - kA.z), wallA: kA, wallB: kB
                                 });
                              }
                            }}
                            style={{ width: '45px', border: 'none', outline: 'none', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#2c3e50', padding: 0, margin: 0, backgroundColor: 'transparent' }}
                          />
                          <span style={{ fontSize: '11px', color: '#7f8c8d', marginLeft: '3px', fontWeight: 'bold', pointerEvents: 'none' }}>cm</span>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}

                {/* Linia i poziomy wymiar PODGLĄDU na żywo (Mnożniki x120 i x60) */}
                {!(wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z) && wallNodes.length > 0 && previewNode && (() => {
                  const p1 = wallNodes[wallNodes.length - 1]; 
                  const p2 = previewNode;
                  
                  // Funkcja pomocnicza do rysowania pojedynczego odcinka podglądu
                  const renderSegment = (start, end, keyStr) => {
                    const cx = (start.x + end.x) * 60 + 300; 
                    const cy = (start.z + end.z) * 60 + 300;
                    const dx = end.x - start.x; 
                    const dz = end.z - start.z;
                    const len = Math.sqrt(dx * dx + dz * dz);
                    if (len === 0) return null;
                    
                    const dist = Math.round(len * 100);
                    const nx = -dz / len; 
                    const nz = dx / len;
                    
                    const isHorizontal = Math.abs(dx) > Math.abs(dz);
                    const offset = isHorizontal ? 18 : 38;
                    const dimX = cx + nx * offset; 
                    const dimY = cy + nz * offset;

                    return (
                      <g key={keyStr}>
                        <line x1={start.x * 120 + 300} y1={start.z * 120 + 300} x2={end.x * 120 + 300} y2={end.z * 120 + 300} stroke={isHoveringStart ? "#e74c3c" : "#3498db"} strokeWidth="4" strokeDasharray="8,8" opacity={isHoveringStart ? "0.9" : "0.6"} />
                        <g>
                          <rect x={dimX - 26} y={dimY - 11} width="52" height="22" fill="white" rx="4" opacity="0.9" stroke={isHoveringStart ? "#e74c3c" : "#3498db"} strokeWidth="1" />
                          <text x={dimX} y={dimY + 1} textAnchor="middle" alignmentBaseline="middle" fontSize="12" fontWeight="bold" fill={isHoveringStart ? "#e74c3c" : "#3498db"}>{dist} cm</text>
                        </g>
                      </g>
                    );
                  };

                  // NOWOŚĆ: Jeśli najeżdżamy na start, a ściana jest ukośna - łamiemy podgląd w kąt prosty!
                  if (isHoveringStart && p1.x !== p2.x && p1.z !== p2.z) {
                    const pMid = { x: p2.x, z: p1.z }; // Punkt załamania (identyczny z ostatecznym)
                    return (
                      <g>
                        {renderSegment(p1, pMid, 'seg1')}
                        {renderSegment(pMid, p2, 'seg2')}
                      </g>
                    );
                  }

                  // Standardowa prosta linia, jeśli rysujemy normalnie
                  return renderSegment(p1, p2, 'seg1');
                })()}

                {/* Narożniki ścian (Mnożnik x120) */}
                {wallNodes.map((p, i) => { if (i === 0) return null; return <circle key={i} cx={p.x * 120 + 300} cy={p.z * 120 + 300} r="5" fill="#2c3e50" />; })}

                {wallNodes.length > 0 && (
                  <g>
                    <circle cx={wallNodes[0].x * 120 + 300} cy={wallNodes[0].z * 120 + 300} r={(isHoveringStart && !(wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z)) ? "12" : "6"} fill="#e74c3c" style={{ transition: 'r 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                    {isHoveringStart && !(wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z) && (
                      <text x={wallNodes[0].x * 120 + 300 + 18} y={wallNodes[0].z * 120 + 300 + 5} fill="#c0392b" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none', animation: 'fadeIn 0.2s' }}>Zamknij pokój</text>
                    )}
                  </g>
                )}
                {/* Podgląd kursora (Mnożnik x120) */}
                {previewNode && !isHoveringStart && !(wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z) && <circle cx={previewNode.x * 120 + 300} cy={previewNode.z * 120 + 300} r="5" fill="#3498db" opacity="0.6" />}
              {/* --- NOWOŚĆ: WIZUALIZACJA STARTU KUCHNI W SVG --- */}
                {wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z && (kitchenStart || previewKitchenStart) && (() => {
                  const p = kitchenStart || previewKitchenStart;
                  
                  // Zabezpieczenie przed starym stanem w pamięci po odświeżeniu kodu
                  if (!p.wallA || !p.wallB) return null; 

                  const cx = p.x * 120 + 300;
                  const cy = p.z * 120 + 300;
                  
                  // Odsunięcie linii wymiarowej do wewnątrz pokoju (wizualnie o 40px)
                  const offsetVis = 40; 
                  const midX = cx + p.inDx * offsetVis;
                  const midY = cy + p.inDz * offsetVis;

                  // Rzutowanie narożników pokoju do wewnątrz, by stworzyć punkty dla linii
                  const axVis = p.wallA.x * 120 + 300 + p.inDx * offsetVis;
                  const ayVis = p.wallA.z * 120 + 300 + p.inDz * offsetVis;
                  const bxVis = p.wallB.x * 120 + 300 + p.inDx * offsetVis;
                  const byVis = p.wallB.z * 120 + 300 + p.inDz * offsetVis;

                  // Odległości fizyczne
                  const distA = Math.round(Math.sqrt((p.x - p.wallA.x)**2 + (p.z - p.wallA.z)**2) * 100);
                  const distB = Math.round(Math.sqrt((p.x - p.wallB.x)**2 + (p.z - p.wallB.z)**2) * 100);

                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Zielona przerywana odległość od ściany */}
                      <line x1={cx} y1={cy} x2={midX} y2={midY} stroke="#40c057" strokeWidth="2" strokeDasharray="4,4" />
                      
                      {/* Ciemne przerywane wymiary */}
                      <line x1={midX} y1={midY} x2={axVis} y2={ayVis} stroke="#2c3e50" strokeWidth="1.5" strokeDasharray="4,4" />
                      <line x1={midX} y1={midY} x2={bxVis} y2={byVis} stroke="#2c3e50" strokeWidth="1.5" strokeDasharray="4,4" />
                      <circle cx={midX} cy={midY} r="3" fill="#2c3e50" />
                      
                      {/* Etykiety z odległością na żywo */}
                      <g transform={`translate(${(midX + axVis)/2}, ${(midY + ayVis)/2})`}>
                        <rect x="-22" y="-12" width="44" height="24" fill="white" opacity="0.9" rx="4" />
                        <text x="0" y="1" textAnchor="middle" alignmentBaseline="middle" fontSize="12" fontWeight="bold" fill="#2c3e50">{distA} cm</text>
                      </g>
                      <g transform={`translate(${(midX + bxVis)/2}, ${(midY + byVis)/2})`}>
                        <rect x="-22" y="-12" width="44" height="24" fill="white" opacity="0.9" rx="4" />
                        <text x="0" y="1" textAnchor="middle" alignmentBaseline="middle" fontSize="12" fontWeight="bold" fill="#2c3e50">{distB} cm</text>
                      </g>

                      {/* Sama zielona kropka startu - ukrywamy ją po kliknięciu, bo pojawia się nowa z napisem */}
                      {!kitchenStart && <circle cx={cx} cy={cy} r="8" fill="#40c057" opacity="0.8" />}
                    </g>
                  );
                })()}
                
                {kitchenStart && (() => {
                  const inX = kitchenStart.inDx; 
                  const inZ = kitchenStart.inDz; 
                  
                  let walkMult = kitchenStart.isClockwise ? 1 : -1;
                  if (kitchenFlip) walkMult *= -1;
                  
                  const dirX = walkMult * kitchenStart.inDz;
                  const dirZ = walkMult * -kitchenStart.inDx;
                  
                  return (
                    <g transform={`translate(${kitchenStart.x * 120 + 300}, ${kitchenStart.z * 120 + 300})`}>
                      {/* Elegancka strzałka wskazująca kierunek budowania szafek */}
                      <line x1="0" y1="0" x2={dirX * 50} y2={dirZ * 50} stroke="#2e7d32" strokeWidth="5" strokeLinecap="round" />
                      <g transform={`translate(${dirX * 56}, ${dirZ * 56}) rotate(${Math.atan2(dirZ, dirX) * (180 / Math.PI)})`}>
                        <polygon points="-8,-8 10,0 -8,8" fill="#2e7d32" stroke="#2e7d32" strokeWidth="2" strokeLinejoin="round" />
                      </g>
                      
                      <line x1="0" y1="0" x2={inX * 30} y2={inZ * 30} stroke="#f39c12" strokeWidth="3" strokeDasharray="4,4" />
                      <circle cx="0" cy="0" r="10" fill="#2e7d32" />
                      <circle cx="0" cy="0" r="16" fill="none" stroke="#2e7d32" strokeWidth="2" opacity="0.5" />
                      
                      <rect x="-40" y="-35" width="80" height="20" fill="white" rx="4" opacity="0.9" stroke="#2e7d32" strokeWidth="1" />
                      <text x="0" y="-21" textAnchor="middle" alignmentBaseline="middle" fontSize="11" fontWeight="bold" fill="#2e7d32">Start Kuchni</text>
                    </g>
                  );
                })()}
              </svg>

            </div>
{/* ... tutaj u Ciebie kończy się </svg></div> ... */}

            {/* --- BRAKUJĄCA INORMACJA O STARCIE I PRZYCISK ODBICIA --- */}
            {wallNodes.length > 2 && wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9', textAlign: 'center', width: '100%', maxWidth: '600px', boxSizing: 'border-box' }}>
                {!kitchenStart ? (
                  <h3 style={{ color: '#0277bd', margin: 0, fontSize: '15px' }}>👆 Świetnie! Teraz najedź na narysowaną ścianę i kliknij, aby wskazać miejsce, od którego zaczną się dodawać szafki.</h3>
                ) : (
                  <button onClick={() => setKitchenFlip(!kitchenFlip)} style={{ padding: '10px 20px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                    🔄 Zmień kierunek dodawania szafek lewo/prawo
                  </button>
                )}
              </div>
            )}

            
            

            {/* Przyciski sterujące */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button onClick={() => { setWallNodes([]); setKitchenStart(null); setPreviewKitchenStart(null); }} style={{ padding: '10px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Wyczyść wszystko
              </button>
              
              {wallNodes.length > 2 && !(wallNodes[0].x === wallNodes[wallNodes.length - 1].x && wallNodes[0].z === wallNodes[wallNodes.length - 1].z) && (
                <button 
                  onClick={zamykajZOptymalizacja} 
                  style={{ padding: '10px 20px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Zamknij pomieszczenie
                </button>
              )}

              <button onClick={() => setCurrentStep(2)} style={{ padding: '10px 30px', backgroundColor: '#40c057', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(64, 192, 87, 0.3)' }}>
                {wallNodes.length > 0 ? "Gotowe, wstaw szafki ➡️" : "Pomiń rysowanie ścian ➡️"}
              </button>
            </div>

            {/* NOWOŚĆ: KLOCEK POPOUT (MODAL) NA ŚRODKU EKRANU */}
            {showStartModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxWidth: '450px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                  <h2 style={{ color: '#2c3e50', margin: '0 0 15px 0' }}>Pokój utworzony!</h2>
                  <p style={{ fontSize: '16px', color: '#34495e', lineHeight: '1.6', marginBottom: '25px' }}>
                    Świetnie! Teraz najedź myszką na narysowaną ścianę i <b>kliknij</b>, aby wskazać miejsce, od którego <b>zaczną się dodawać szafki</b>.
                  </p>
                  <button onClick={() => setShowStartModal(false)} style={{ padding: '12px 35px', backgroundColor: '#40c057', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(64, 192, 87, 0.3)' }}>
                    Zrozumiałem
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --- KROK 2: TWOJA DOTYCHCZASOWA APLIKACJA 3D --- */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            
            {/* LEWY PANEL (Ustawienia Szafek) */}
            <div style={{ width: '450px', padding: '20px', backgroundColor: '#f8f9fa', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
              {/* KOLORYSTYKA PROJEKTU */}
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
                  <h2 style={{ fontSize: '18px', margin: 0, color: '#2c3e50' }}>Kolorystyka Projektu</h2>
                  {activeCab.type !== 'puste' && (
                    <label style={{ fontSize: '11px', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={activeCab.useCustomColors} onChange={(e) => updateActiveCab({ useCustomColors: e.target.checked })} /> inna dla tej szafki
                    </label>
                  )}
                </div>
                
                {activeCab.type !== 'puste' && (
                  <>
                    {[ {l: "Fronty", v: activeCab.useCustomColors ? activeCab.fDecor : globalF, s: (v) => activeCab.useCustomColors ? updateActiveCab({fDecor: v}) : setGlobalF(v)},
                       {l: "Korpus", v: activeCab.useCustomColors ? activeCab.bDecor : globalB, s: (v) => activeCab.useCustomColors ? updateActiveCab({bDecor: v}) : setGlobalB(v)}
                    ].map((item, idx) => (
                      <div key={idx} style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Płyta {item.l}:</label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'center' }}>
                          <div style={{ width: '35px', height: '35px', borderRadius: '6px', border: '1px solid #ccc', background: DEKORY[item.v].url ? `url(${DEKORY[item.v].url})` : DEKORY[item.v].color, backgroundSize: 'cover' }} />
                          <CustomSelect value={item.v} onChange={item.s} />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showWorktopGlobal} onChange={(e) => setShowWorktopGlobal(e.target.checked)} style={{ width: '18px', height: '18px', marginRight: '8px' }} /> pokaż blaty
                  </label>
                  {showWorktopGlobal && (
                    <div style={{ marginTop: '12px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Dekor blatu:</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'center' }}>
                        <div style={{ width: '35px', height: '35px', borderRadius: '6px', border: '1px solid #ccc', background: DEKORY[worktopDecor].url ? `url(${DEKORY[worktopDecor].url})` : DEKORY[worktopDecor].color, backgroundSize: 'cover' }} />
                        <CustomSelect value={worktopDecor} onChange={setWorktopDecor} />
                      </div>
                      <label style={{ fontSize: '11px', display: 'block', marginTop: '10px' }}>Głębokość blatu: <b>{Math.round(worktopDepth*100)} cm</b></label>
                      <input type="range" min="0.4" max="1.2" step="0.01" value={worktopDepth} onChange={(e) => setWorktopDepth(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  )}
                </div>
              </div>

              <h2 style={{ fontSize: '18px', marginTop: '30px', marginBottom: '15px', color: '#2c3e50', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
                Wybierz / Dodaj szafkę
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '30px', paddingBottom: '10px' }}>
                {cabinets.map((cab, i) => (
                  <button key={cab.id} onClick={() => setActiveIdx(i)} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px', backgroundColor: i === activeIdx ? '#2e7d32' : '#fff', color: i === activeIdx ? '#fff' : '#333', border: i === activeIdx ? '1px solid #1b5e20' : '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', minWidth: '95px', alignItems: 'center' }}>
                    <MiniaturaSzafki cab={{...cab, w: 0.6, h: 0.82}} size={40} showHandles={true} />
                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize', textAlign: 'center' }}>
                      {cab.type} {Math.round(cab.w * 100)}
                    </span>
                  </button>
                ))}
                <button onClick={addCabinet} style={{ padding: '10px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Dodaj</button>
              </div>

              <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#2c3e50', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
                Edytuj wybraną szafkę
              </h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Wybierz Typ:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  {['drzwi', 'szuflady', 'hybryda', 'puste', 'naroznik'].map(t => (
                    <button key={t} onClick={() => {
                      if (t === 'naroznik' && activeCab.type !== 'naroznik') updateActiveCab({ type: t, w: 1.0, w2: 1.0 });
                      else if (t !== 'naroznik' && activeCab.type === 'naroznik') updateActiveCab({ type: t, w: 0.6 });
                      else updateActiveCab({ type: t });
                    }} style={{ width: 'calc(50% - 4px)', padding: '15px 5px', backgroundColor: activeCab.type === t ? '#eef2f3' : '#fff', border: `2px solid ${activeCab.type === t ? '#40c057' : '#ddd'}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <MiniaturaSzafki cab={{...activeCab, type: t, w: 0.6, h: 0.82}} size={45} showHandles={true} />
                      <div style={{ fontSize: '10px', marginTop: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>{t}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd' }}>
                
                <div style={{ margin: '0 0 15px 0', padding: '10px', border: '1px solid #ffd8a8', background: '#fff9db', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input type="checkbox" checked={activeCab.hasWorktop} onChange={(e) => updateActiveCab({hasWorktop: e.target.checked})} style={{ marginRight: '10px' }} /> Blat nad tą sekcją
                  </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                    <label>Szerokość sekcji {activeCab.type === 'naroznik' && '(Ramię 1)'}: <b>
                      {activeCab.type === 'naroznik' ? Math.round((activeCab.w - 0.5 + (activeCab.d2 || 0.5)) * 100) : Math.round(activeCab.w * 100)} cm
                    </b></label>
                    {activeCab.type === 'naroznik' && <span style={{ fontSize: '11px', color: '#d35400', fontWeight: 'bold' }}>Front: {Math.round((activeCab.w - 0.5)*100)} cm</span>}
                  </div>
                  <input type="range" min="0.15" max="1.5" step="0.01" 
                    value={activeCab.type === 'naroznik' ? activeCab.w - 0.5 + (activeCab.d2 || 0.5) : activeCab.w} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (activeCab.type === 'naroznik') updateActiveCab({w: val - (activeCab.d2 || 0.5) + 0.5});
                      else updateActiveCab({w: val});
                    }} 
                    style={{ width: '100%' }} 
                  />
                </div>
                
                {activeCab.type !== 'puste' && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                        <label>Głębokość {activeCab.type === 'naroznik' && '(Ramię 1)'}: <b>{Math.round(activeCab.d*100)} cm</b></label>
                      </div>
                      <input type="range" min="0.3" max="0.7" step="0.01" value={activeCab.d} onChange={(e) => updateActiveCab({d: parseFloat(e.target.value)})} style={{ width: '100%' }} />
                    </div>

                    {activeCab.type === 'naroznik' && (
                      <>
                        <div style={{ marginBottom: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                            <label>Szerokość (Ramię 2): <b>{Math.round(((activeCab.w2||0.9) - 0.5 + activeCab.d)*100)} cm</b></label>
                            <span style={{ fontSize: '11px', color: '#d35400', fontWeight: 'bold' }}>Front: {Math.round(((activeCab.w2||0.9) - 0.5)*100)} cm</span>
                          </div>
                          <input type="range" min="0.5" max="1.5" step="0.01" value={(activeCab.w2||0.9) - 0.5 + activeCab.d} onChange={(e) => updateActiveCab({w2: parseFloat(e.target.value) - activeCab.d + 0.5})} style={{ width: '100%' }} />
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                            <label>Głębokość (Ramię 2): <b>{Math.round((activeCab.d2||0.5)*100)} cm</b></label>
                          </div>
                          <input type="range" min="0.3" max="0.7" step="0.01" value={activeCab.d2 || 0.5} onChange={(e) => updateActiveCab({d2: parseFloat(e.target.value)})} style={{ width: '100%' }} />
                        </div>
                        
                        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Kierunek skrętu ciągu szafek:</label>
                          <select value={activeCab.cornerSide} onChange={(e) => updateActiveCab({cornerSide: e.target.value})} style={{ width: '100%', padding: '6px', marginTop: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                            <option value="prawy">Prawy (skręca w prawo)</option>
                            <option value="lewy">Lewy (skręca w lewo)</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div style={{ marginBottom: '20px' }}><label>Wysokość korpusu: <b>{Math.round(activeCab.h*100)} cm</b></label><input type="range" min="0.4" max="2.2" step="0.01" value={activeCab.h} onChange={(e) => updateActiveCab({h: parseFloat(e.target.value)})} style={{ width: '100%' }} /></div>

                    {activeCab.type === 'hybryda' && (
                      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f3f5', borderRadius: '10px' }}>
                        <label style={{ fontSize: '12px' }}>Układ:</label>
                        <select value={activeCab.order} onChange={(e) => updateActiveCab({order: e.target.value})} style={{ width: '100%', padding: '8px', margin: '5px 0' }}><option value="szuflady-gora">Szuflady góra</option><option value="szuflady-dol">Szuflady dół</option></select>
                        <label style={{ fontSize: '12px' }}>Podział: {activeCab.split}%</label><input type="range" min="15" max="85" value={activeCab.split} onChange={(e) => updateActiveCab({split: parseInt(e.target.value)})} style={{ width: '100%' }} />
                      </div>
                    )}

                    {activeCab.type !== 'drzwi' && activeCab.type !== 'naroznik' && (
                      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f3f5', borderRadius: '10px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Liczba szuflad: {activeCab.drawersC}</label>
                        <input type="range" min="1" max="4" value={activeCab.drawersC} onChange={(e) => { const c = parseInt(e.target.value); updateActiveCab({ drawersC: c, ratios: Array(c).fill(100/c) }); }} style={{ width: '100%' }} />
                        {(activeCab.ratios || []).map((r, i) => (
                          <div key={i} style={{ marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span>Szuflada {i+1}</span><b>{((r/100)*(activeCab.h * (activeCab.type==='hybryda' ? activeCab.split/100 : 1))*100).toFixed(1)} cm</b></div>
                            <input type="range" min="10" max="80" step="0.1" value={r} onChange={(e) => handleRatio(i, e.target.value)} style={{ width: '100%' }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {activeCab.type === 'drzwi' && (
                      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f3f5', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: '11px' }}>Drzwi:</label><select value={activeCab.doorsC} onChange={(e) => updateActiveCab({doorsC: parseInt(e.target.value)})} style={{ width: '100%' }}><option value={1}>1 Front</option><option value={2}>2 Fronty</option></select></div>
                          {activeCab.doorsC === 1 && <div style={{ flex: 1 }}><label style={{ fontSize: '11px' }}>Strona:</label><select value={activeCab.doorDirection} onChange={(e) => updateActiveCab({doorDirection: e.target.value})} style={{ width: '100%' }}><option value="left">Lewa</option><option value="right">Prawa</option></select></div>}
                        </div>
                      </div>
                    )}

                    {['drzwi', 'hybryda', 'naroznik'].includes(activeCab.type) && (
                      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '10px', border: '1px solid #90caf9' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Liczba półek w środku: {activeCab.shelvesC || 0}</label>
                        <input type="range" min="0" max="5" value={activeCab.shelvesC || 0} onChange={(e) => updateActiveCab({shelvesC: parseInt(e.target.value)})} style={{ width: '100%', marginTop: '5px' }} />
                      </div>
                    )}

                    <label style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '10px' }}>
                      <input type="checkbox" checked={activeCab.softClose} onChange={(e) => updateActiveCab({softClose: e.target.checked})} style={{ marginRight: '10px' }} /> Cichy domyk
                    </label>

                    {/* NOWA OPCJA: OBRACANIE O 180 STOPNI (Zablokowana dla narożników) */}
              {activeCab.type !== 'naroznik' && (
                <label style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '10px', color: '#d35400' }}>
                  <input type="checkbox" checked={activeCab.reverseFront || false} onChange={(e) => updateActiveCab({reverseFront: e.target.checked})} style={{ marginRight: '10px' }} /> Obróć front o 180° (Układ U / Wyspa)
                </label>
              )}

                    <div style={{ marginTop: '10px' }}><label style={{ fontSize: '12px' }}>Podstawa:</label><select value={activeCab.baseType} onChange={(e) => updateActiveCab({baseType: e.target.value})} style={{ width: '100%', padding: '5px' }}>
                      <option value="nozki_regulowane">Nóżki regulowane</option><option value="cokol">Pełna skrzynia cokołowa</option>
                    </select></div>
                  </>
                )}

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => moveActiveCab(-1)} disabled={activeIdx === 0} style={{ flex: 1, padding: '10px', backgroundColor: '#e9ecef', border: '1px solid #ced4da', borderRadius: '8px', cursor: activeIdx === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⬅️ Przesuń w lewo</button>
                  <button onClick={() => moveActiveCab(1)} disabled={activeIdx === cabinets.length - 1} style={{ flex: 1, padding: '10px', backgroundColor: '#e9ecef', border: '1px solid #ced4da', borderRadius: '8px', cursor: activeIdx === cabinets.length - 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Przesuń w prawo ➡️</button>
                </div>

                {cabinets.length > 1 && <button onClick={() => { setCabinets(cabinets.filter((_, i) => i !== activeIdx)); setActiveIdx(0); }} style={{ width: '100%', marginTop: '10px', padding: '12px', backgroundColor: '#fa5252', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Usuń szafkę</button>}
              </div>

              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#2c3e50', color: '#40c057', borderRadius: '12px', textAlign: 'center', fontSize: '28px', fontWeight: 'bold' }}>{finalPrice} zł</div>
            </div>

            {/* PRAWY PANEL (Canvas 3D) */}
            <div style={{ flex: 1 }}>
              <Canvas camera={{ position: [sceneCenter[0] - 4, 1.8, sceneCenter[2]], fov: 55 }}>
                <ambientLight intensity={0.9} /><pointLight position={[10, 10, 10]} intensity={1.5} /><directionalLight position={[-5, 5, -5]} intensity={1} />
                <Suspense fallback={null}>
                  {/* TUTAJ WSTAWIAMY NASZE ŚCIANY */}
                  <Walls3D nodes={wallNodes} />
                  {layout.map((item, index) => {
              let cab = cabinets[index];
              
              // Rozpoznajemy, czy układ buduje się w trybie odbicia lustrzanego
              const isMirrored = kitchenStart ? (!kitchenStart.isClockwise !== kitchenFlip) : false;
              
              // ZAMIAST obracania narożników o 180 stopni, system sam wymienia ich fizyczny model na lewy/prawy
              if (cab.type === 'naroznik' && isMirrored) {
                cab = { ...cab, cornerSide: cab.cornerSide === 'prawy' ? 'lewy' : 'prawy' };
              }

              const f = DEKORY[cab.useCustomColors ? cab.fDecor : globalF];
              const b = DEKORY[cab.useCustomColors ? cab.bDecor : globalB];
              
              const wtCenterZ = (cab.d / 2 + 0.03) - (worktopDepth / 2);
              
              // --- LOGIKA OBROTU ---
              let isFlipped = cab.reverseFront || false;
              const cornersBefore = cabinets.slice(0, index).filter(c => c.type === 'naroznik').length;
              
              if (cab.type === 'naroznik') {
                isFlipped = (cornersBefore === 2); // Pozwalamy TRZECIEMU narożnikowi obrócić się do środka
              } else if (cornersBefore === 2) {
                isFlipped = !isFlipped; 
              }

              return (
                <group key={cab.id} position={item.pos} rotation={[0, item.rot, 0]}>
                  {cab.type === 'naroznik' ? (
                     <group rotation={[0, isFlipped ? Math.PI : 0, 0]}>
                      <SzafkaNarozna cab={cab} dekorFront={f} dekorBody={b} />
                     </group>
                  ) : (
                     <group rotation={[0, isFlipped ? Math.PI : 0, 0]}>
                       <Szafka 
                         width={cab.w} height={cab.h} depth={cab.d} dekorFront={f} dekorBody={b} 
                         type={cab.type} baseType={cab.baseType} doorCount={cab.doorsC} 
                         doorDirection={cab.doorDirection} drawersCount={cab.drawersC} 
                         shelvesCount={cab.shelvesC} drawerRatios={cab.ratios} 
                         hybridSplit={cab.split} hybridOrder={cab.order} 
                       />
                     </group>
                  )}
                  
                  {showWorktopGlobal && cab.hasWorktop && cab.type !== 'puste' && (() => {
                     const nextCab = cabinets[index + 1];
                     let nextIsFlipped = (nextCab && nextCab.type !== 'naroznik') ? (nextCab.reverseFront || false) : false;
                     const nextCornersBefore = cabinets.slice(0, index + 1).filter(c => c.type === 'naroznik').length;
                     if (nextCornersBefore === 2 && nextCab && nextCab.type !== 'naroznik') {
                       nextIsFlipped = !nextIsFlipped;
                     }
                     return cab.type === 'naroznik' ? (
                       <group position={[0, cab.h + 0.119, 0]} rotation={[0, isFlipped ? Math.PI : 0, 0]}>
                         {/* Blat GŁÓWNY narożnika */}
                         <mesh position={[(cab.cornerSide==='prawy'?1:-1) * (worktopDepth - 0.5 - 0.03) / 2, 0, (0.5 / 2 + 0.03) - (worktopDepth / 2)]}>
                           <boxGeometry args={[cab.w + (worktopDepth - 0.5 - 0.03) + 0.001, 0.038, worktopDepth]} />
                           <PłytaMaterial 
                             dekor={DEKORY[worktopDecor]} 
                             w={cab.w + (worktopDepth - 0.5 - 0.03)} 
                             h={worktopDepth} 
                             rotate 
                             offsetX={isFlipped ? item.dist + cab.w + (cab.cornerSide === 'lewy' ? (worktopDepth - 0.5 - 0.03) : 0) - (cabinets[index - 1] ? cabinets[index - 1].w : 0.6) : item.dist} 
                             offsetY={isFlipped ? -(item.crossDist + (wtCenterZ * 2)) : item.crossDist} 
                           />
                         </mesh>
                         {/* Blat BOCZNY narożnika */}
                         <mesh 
                           position={[(cab.cornerSide==='prawy'?1:-1) * (cab.w/2 - 0.5 - 0.03 + worktopDepth/2), 0, (cab.w2||0.9)/2 + 0.015]}
                           rotation={[0, (cab.cornerSide === 'prawy' ? -Math.PI / 2 : Math.PI / 2) + (nextIsFlipped ? Math.PI : 0), 0]}
                         >
                           <boxGeometry args={[(cab.w2||0.9) - 0.5 - 0.03 + 0.001, 0.038, worktopDepth]} />
                           <PłytaMaterial 
                             dekor={DEKORY[worktopDecor]} 
                             w={(cab.w2||0.9) - 0.5 - 0.03} 
                             h={worktopDepth} 
                             rotate 
                             offsetX={nextIsFlipped ? -(item.dist + cab.w + 0.03) : (item.dist + cab.w + 0.03)} 
                             offsetY={item.crossDist + (cab.cornerSide === 'prawy' ? 0.07 : -0.07) + (nextIsFlipped ? (wtCenterZ * 2) : 0)} 
                           />
                         </mesh>
                       </group>
                     ) : (
                       <mesh position={[0, cab.h + 0.119, isFlipped ? -wtCenterZ : wtCenterZ]}>
                         <boxGeometry args={[cab.w + 0.001, 0.038, worktopDepth]} />
                         <PłytaMaterial 
                           dekor={DEKORY[worktopDecor]} 
                           w={cab.w} 
                           h={worktopDepth} 
                           rotate 
                           offsetX={isFlipped ? -item.dist : item.dist} 
                           offsetY={item.crossDist + (isFlipped ? (wtCenterZ * 2) : 0)} 
                         />
                       </mesh>
                     );
                  })()}
                </group>
              );
            })}
                </Suspense>
                <OrbitControls makeDefault target={sceneCenter} enablePan={true} />
              </Canvas>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
