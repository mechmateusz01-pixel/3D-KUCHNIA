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
      // KLUCZOWA ZMIANA: Dodany MINUS przy offsetX. 
      // Obrót o 90 stopni odwraca wektory, więc musimy przesuwać słoje "do tyłu", żeby na blacie szły "do przodu"!
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

  return (
    <group position={[0, baseH, 0]}>
      <group position={[0, sideY, 0]}>
        {/* Bok główny */}
        <mesh position={[-sign * (w/2 - t/2), 0, -t/2]}>
          <boxGeometry args={[t, sideH, d - t]} />
          <PłytaMaterial dekor={dekorBody} w={d} h={sideH} />
        </mesh>
        
        {/* NAPRAWIONY BOK BOCZNY (Ramię L) - Wyrównany do tyłu szafki (+ t/2 zamiast - t/2) */}
        <mesh position={[sign * (w/2 - safeD2/2 + t/2), 0, -d/2 + safeW2 - t/2]}>
          <boxGeometry args={[safeD2 - t, sideH, t]} />
          <PłytaMaterial dekor={dekorBody} w={safeD2 - t} h={sideH} />
        </mesh>
      </group>
      
      {/* Wieńce (Dno i Góra) oraz wewnętrzne PÓŁKI */}
      {[
        t/2, // Dno
        ...Array.from({ length: cab.shelvesC || 0 }).map((_, i) => t/2 + ((h - 2*t) / ((cab.shelvesC || 0) + 1)) * (i + 1)), // Półki wyliczane dynamicznie
        h - t/2 // Góra
      ].map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          <mesh position={[sign * t/2, 0, -t/2]}><boxGeometry args={[w - t, t, d - t]} /><PłytaMaterial dekor={dekorBody} w={w} h={d} rotate /></mesh>
          <mesh position={[sign * (w/2 - safeD2/2 + t/2), 0, d/2 - t + (safeW2 - d)/2]}><boxGeometry args={[safeD2 - t, t, safeW2 - d]} /><PłytaMaterial dekor={dekorBody} w={safeD2} h={safeW2 - d} rotate /></mesh>
        </group>
      ))}

      {/* Plecy HDF */}
      <group position={[0, h/2, 0]}>
        <group position={[0, 0, -d/2 - 0.001]}><mesh position={[0, 0, 0.001]}><boxGeometry args={[w, h, 0.001]} /><meshStandardMaterial color="#f8f8f8" /></mesh><mesh position={[0, 0, -0.0005]}><boxGeometry args={[w, h, 0.002]} /><MaterialPilśni /></mesh></group>
        <group position={[sign * (w/2 + 0.001), 0, -d/2 + safeW2/2]}><mesh position={[-sign * 0.001, 0, 0]}><boxGeometry args={[0.001, h, safeW2]} /><meshStandardMaterial color="#f8f8f8" /></mesh><mesh position={[sign * 0.0005, 0, 0]}><boxGeometry args={[0.002, h, safeW2]} /><MaterialPilśni /></mesh></group>
      </group>

      <AnimatedCornerDoors w={w} d={d} w2={safeW2} d2={safeD2} h={h} t={t} gap={0.002} dekorFront={dekorFront} isRight={isRight} />

      {/* Nóżki/Cokół (Idealnie wyliczone co do milimetra z zachowaniem słojów) */}
      <group position={[0, -baseH/2, 0]}>
        
        {(() => {
          // Jeśli pełny cokół, listwa chowa się między boki (krótsza o grubość płyty)
          const isCokol = baseType === 'cokol' || baseType === 'Pełna skrzynia cokołowa';
          const cokolOffset = isCokol ? t : 0; 
          
          const recess = t + 0.05; // Cofnięcie cokołu o 5cm względem korpusu + grubość frontu
          
          // 1. LISTWA GŁÓWNA (Przód) - dodajemy 't', aby zachodziła pod kątem na listwę boczną
          const mainToeW = w - safeD2 + recess + t - cokolOffset;
          const mainToeX = -sign * (w/2 - mainToeW/2 - cokolOffset);
          const mainToeZ = d/2 - recess - t/2;

          // 2. LISTWA BOCZNA (Ramię) - wydłużona dokładnie o 'recess', żeby dobić do krawędzi
          const sideToeL = safeW2 - d + recess - cokolOffset;
          const sideToeZ = (safeW2 - recess - cokolOffset) / 2;
          const sideToeX = sign * (w/2 - safeD2 + recess + t/2);

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

        {/* Nóżki wędrują głęboko pod spód */}
        {baseType === 'nozki_regulowane' && (
          <>
            <group position={[-sign*(w/2 - 0.05), 0, -d/2 + 0.05]}><NozkaRegulowana height={baseH} /></group>
            <group position={[sign*(w/2 - 0.05), 0, -d/2 + 0.05]}><NozkaRegulowana height={baseH} /></group>
            <group position={[-sign*(w/2 - 0.05), 0, d/2 - 0.15]}><NozkaRegulowana height={baseH} /></group>
            <group position={[sign*(w/2 - safeD2 + 0.15), 0, d/2 - 0.15]}><NozkaRegulowana height={baseH} /></group>
            <group position={[sign*(w/2 - 0.05), 0, -d/2 + safeW2 - 0.15]}><NozkaRegulowana height={baseH} /></group>
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
  w2: 0.9, d2: 0.5, cornerSide: 'prawy' 
};

// --- 6. APLIKACJA GŁÓWNA ---
export default function App() {
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
    const result = [];
    const cursor = new THREE.Object3D();
    cursor.position.set(0, 0, 0);

    let runDist = 0; // Długość ciągu (dla słojów wzdłuż blatu)
    let crossDist = 0; // Przesunięcie poprzeczne (dla słojów w poprzek blatu)

    cabinets.forEach((cab) => {
      cursor.translateX(cab.w / 2);
      cursor.updateMatrixWorld();
      
      result.push({ 
        id: cab.id, 
        pos: [cursor.position.x, 0, cursor.position.z], 
        rot: cursor.rotation.y,
        dist: runDist,
        crossDist: crossDist // Zapisujemy przesunięcie poprzeczne dla tej szafki
      });

      cursor.translateX(cab.w / 2); 
      runDist += cab.w; // Wydłużamy miarkę

      if (cab.type === 'naroznik') {
        const isRight = cab.cornerSide === 'prawy';
        const safeW2 = cab.w2 || 0.9;
        const safeD2 = cab.d2 || 0.5;
        
        if (isRight) {
          cursor.translateX(-safeD2 / 2);
          cursor.translateZ(-cab.d / 2 + safeW2);
          cursor.rotateY(-Math.PI / 2);
          crossDist += 0.07; // KOREKTA: Kompensacja 7cm na rury, żeby słoje się zeszły!
        } else {
          cursor.translateX(-cab.w + safeD2 / 2);
          cursor.translateZ(-cab.d / 2 + safeW2);
          cursor.rotateY(Math.PI / 2);
          crossDist -= 0.07; 
        }
        // KOREKTA: Narożnik wydłuża odległość dokładnie o długość swojego ramienia, a nie szerokość szafki
        runDist += safeW2 - cab.d;
      }
    });
    return result;
  }, [cabinets]);

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

 return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: 'sans-serif', margin: 0, backgroundColor: '#f0f0f0' }}>
      <div style={{ width: '450px', padding: '20px', backgroundColor: '#f8f9fa', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        
        {/* 1. KOLORYSTYKA PROJEKTU (Przeniesiona na samą górę) */}
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          {/* UJEDNOLICONY NAGŁÓWEK */}
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

        {/* --- NOWY NAGŁÓWEK: WYBIERZ / DODAJ --- */}
        <h2 style={{ fontSize: '18px', marginTop: '30px', marginBottom: '15px', color: '#2c3e50', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
          Wybierz / Dodaj szafkę
        </h2>

        {/* 2. ZAKŁADKI SZAFEK */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '30px', paddingBottom: '10px' }}>
          {cabinets.map((cab, i) => (
            <button key={cab.id} onClick={() => setActiveIdx(i)} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px', backgroundColor: i === activeIdx ? '#2e7d32' : '#fff', color: i === activeIdx ? '#fff' : '#333', border: i === activeIdx ? '1px solid #1b5e20' : '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', minWidth: '95px', alignItems: 'center' }}>
              
              {/* UCHWYTY WŁĄCZONE */}
              <MiniaturaSzafki cab={{...cab, w: 0.6, h: 0.82}} size={40} showHandles={true} />
              
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize', textAlign: 'center' }}>
                {cab.type} {Math.round(cab.w * 100)}
              </span>
            </button>
          ))}
          <button onClick={addCabinet} style={{ padding: '10px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Dodaj</button>
        </div>

        {/* --- NOWY NAGŁÓWEK: EDYCJA --- */}
        <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#2c3e50', borderBottom: '2px solid #e9ecef', paddingBottom: '8px' }}>
          Edytuj wybraną szafkę
        </h2>

        {/* Reszta kodu zostaje bez zmian (Wybierz Typ itp.) */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Wybierz Typ:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {['drzwi', 'szuflady', 'hybryda', 'puste', 'naroznik'].map(t => (
              <button key={t} onClick={() => updateActiveCab({type: t})} style={{ width: 'calc(50% - 4px)', padding: '15px 5px', backgroundColor: activeCab.type === t ? '#eef2f3' : '#fff', border: `2px solid ${activeCab.type === t ? '#40c057' : '#ddd'}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

          <div style={{ marginBottom: '15px' }}><label>Szerokość sekcji {activeCab.type === 'naroznik' && '(Ramię 1)'}: <b>{Math.round(activeCab.w*100)} cm</b></label><input type="range" min="0.15" max="1.5" step="0.05" value={activeCab.w} onChange={(e) => updateActiveCab({w: parseFloat(e.target.value)})} style={{ width: '100%' }} /></div>
          
          {activeCab.type !== 'puste' && (
            <>
              <div style={{ marginBottom: '15px' }}><label>Wysokość korpusu: <b>{Math.round(activeCab.h*100)} cm</b></label><input type="range" min="0.4" max="2.2" step="0.01" value={activeCab.h} onChange={(e) => updateActiveCab({h: parseFloat(e.target.value)})} style={{ width: '100%' }} /></div>
              <div style={{ marginBottom: '20px' }}><label>Głębokość {activeCab.type === 'naroznik' && '(Ramię 1)'}: <b>{Math.round(activeCab.d*100)} cm</b></label><input type="range" min="0.3" max="0.7" step="0.01" value={activeCab.d} onChange={(e) => updateActiveCab({d: parseFloat(e.target.value)})} style={{ width: '100%' }} /></div>

              {activeCab.type === 'naroznik' && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f3f5', borderRadius: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Parametry Narożnika:</label>
                  <label style={{ fontSize: '11px' }}>Kierunek skrętu (Dla kolejnych szafek):</label>
                  <select value={activeCab.cornerSide} onChange={(e) => updateActiveCab({cornerSide: e.target.value})} style={{ width: '100%', padding: '5px', marginBottom: '10px' }}>
                    <option value="prawy">Prawy (skręca w prawo)</option>
                    <option value="lewy">Lewy (skręca w lewo)</option>
                  </select>
                  <label style={{ fontSize: '11px', display: 'block' }}>Szerokość Ramię 2: <b>{Math.round((activeCab.w2||0.9)*100)} cm</b></label>
                  <input type="range" min="0.5" max="1.5" step="0.05" value={activeCab.w2 || 0.9} onChange={(e) => updateActiveCab({w2: parseFloat(e.target.value)})} style={{ width: '100%' }} />
                  <label style={{ fontSize: '11px', display: 'block', marginTop: '10px' }}>Głębokość Ramię 2: <b>{Math.round((activeCab.d2||0.5)*100)} cm</b></label>
                  <input type="range" min="0.3" max="0.7" step="0.01" value={activeCab.d2 || 0.5} onChange={(e) => updateActiveCab({d2: parseFloat(e.target.value)})} style={{ width: '100%' }} />
                </div>
              )}

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

                    {/* Sekcja ustawień dla zwykłych DRZWI */}
              {activeCab.type === 'drzwi' && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f3f5', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '11px' }}>Drzwi:</label><select value={activeCab.doorsC} onChange={(e) => updateActiveCab({doorsC: parseInt(e.target.value)})} style={{ width: '100%' }}><option value={1}>1 Front</option><option value={2}>2 Fronty</option></select></div>
                    {activeCab.doorsC === 1 && <div style={{ flex: 1 }}><label style={{ fontSize: '11px' }}>Strona:</label><select value={activeCab.doorDirection} onChange={(e) => updateActiveCab({doorDirection: e.target.value})} style={{ width: '100%' }}><option value="left">Lewa</option><option value="right">Prawa</option></select></div>}
                  </div>
                </div>
              )}

              {/* UNIWERSALNY SUWAK PÓŁEK (Pojawia się tam, gdzie ma to sens) */}
              {['drzwi', 'hybryda', 'naroznik'].includes(activeCab.type) && (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '10px', border: '1px solid #90caf9' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Liczba półek w środku: {activeCab.shelvesC || 0}</label>
                  <input type="range" min="0" max="5" value={activeCab.shelvesC || 0} onChange={(e) => updateActiveCab({shelvesC: parseInt(e.target.value)})} style={{ width: '100%', marginTop: '5px' }} />
                </div>
              )}

              <label style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '10px' }}>
                <input type="checkbox" checked={activeCab.softClose} onChange={(e) => updateActiveCab({softClose: e.target.checked})} style={{ marginRight: '10px' }} /> Cichy domyk
              </label>

              {/* NOWA OPCJA: OBRACANIE O 180 STOPNI */}
              <label style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '10px', color: '#d35400' }}>
                <input type="checkbox" checked={activeCab.reverseFront || false} onChange={(e) => updateActiveCab({reverseFront: e.target.checked})} style={{ marginRight: '10px' }} /> Obróć front o 180° (Układ U / Wyspa)
              </label>

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

      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [3, 2.5, 4], fov: 50 }}>
          <ambientLight intensity={0.9} /><pointLight position={[10, 10, 10]} intensity={1.5} /><directionalLight position={[-5, 5, -5]} intensity={1} />
          <Suspense fallback={null}>
            {layout.map((item, index) => {
              const cab = cabinets[index];
              const f = DEKORY[cab.useCustomColors ? cab.fDecor : globalF];
              const b = DEKORY[cab.useCustomColors ? cab.bDecor : globalB];
              
              const wtCenterZ = (cab.d / 2 + 0.03) - (worktopDepth / 2);

              return (
                <group key={cab.id} position={item.pos} rotation={[0, item.rot, 0]}>
                  {cab.type === 'naroznik' ? (
                     <SzafkaNarozna cab={cab} dekorFront={f} dekorBody={b} />
                  ) : (
                     <group rotation={[0, cab.reverseFront ? Math.PI : 0, 0]}>
                       <Szafka 
                         width={cab.w} height={cab.h} depth={cab.d} dekorFront={f} dekorBody={b} 
                         type={cab.type} baseType={cab.baseType} doorCount={cab.doorsC} 
                         doorDirection={cab.doorDirection} drawersCount={cab.drawersC} 
                         shelvesCount={cab.shelvesC} drawerRatios={cab.ratios} 
                         hybridSplit={cab.split} hybridOrder={cab.order} 
                       />
                     </group>
                  )}
                  
                  {showWorktopGlobal && cab.hasWorktop && cab.type !== 'puste' && (
                     cab.type === 'naroznik' ? (
                       <group position={[0, cab.h + 0.119, 0]}>
                         {/* Blat GŁÓWNY narożnika (Wydłużony do ściany) */}
                         <mesh position={[(cab.cornerSide==='prawy'?1:-1) * (worktopDepth - cab.d - 0.03) / 2, 0, wtCenterZ]}>
                           <boxGeometry args={[cab.w + (worktopDepth - cab.d - 0.03) + 0.001, 0.038, worktopDepth]} />
                           <PłytaMaterial dekor={DEKORY[worktopDecor]} w={cab.w + (worktopDepth - cab.d - 0.03)} h={worktopDepth} rotate offsetX={item.dist} offsetY={item.crossDist} />
                         </mesh>
                         {/* Blat BOCZNY narożnika (Ujednolicony: poprawny obrót i kotwiczenie słojów na krawędzi) */}
                         <mesh 
                           position={[(cab.cornerSide==='prawy'?1:-1) * (cab.w/2 - (cab.d2||0.5) - 0.03 + worktopDepth/2), 0, (cab.w2||0.9)/2 + 0.015]}
                           rotation={[0, cab.cornerSide === 'prawy' ? -Math.PI / 2 : Math.PI / 2, 0]}
                         >
                           <boxGeometry args={[(cab.w2||0.9) - cab.d - 0.03 + 0.001, 0.038, worktopDepth]} />
                           <PłytaMaterial 
                             dekor={DEKORY[worktopDecor]} 
                             w={(cab.w2||0.9) - cab.d - 0.03} 
                             h={worktopDepth} 
                             rotate 
                             offsetX={item.dist + cab.w + 0.03} 
                             offsetY={item.crossDist + (cab.cornerSide === 'prawy' ? 0.07 : -0.07)} 
                           />
                         </mesh>
                       </group>
                     ) : (
                       <mesh position={[0, cab.h + 0.119, cab.reverseFront ? -wtCenterZ : wtCenterZ]}>
                         <boxGeometry args={[cab.w + 0.001, 0.038, worktopDepth]} />
                         {/* Blaty szafek (Fizyczny nawis + idealna kompensacja tekstury) */}
                         <PłytaMaterial 
                           dekor={DEKORY[worktopDecor]} 
                           w={cab.w} 
                           h={worktopDepth} 
                           rotate 
                           offsetX={item.dist} 
                           offsetY={item.crossDist + (cab.reverseFront ? (wtCenterZ * 2) : 0)} 
                         />
                       </mesh>
                     )
                  )}
                </group>
              );
            })}
          </Suspense>
          <OrbitControls makeDefault target={sceneCenter} enablePan={true} />
        </Canvas>
      </div>
    </div>
  );
}
