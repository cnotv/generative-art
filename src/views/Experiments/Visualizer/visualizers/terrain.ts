import * as THREE from "three";
import { getAudioData, getFrequencyRanges } from "../audio";
import type { VisualizerSetup } from "../visualizer";

const config = {
  terrainWidth: 100,
  terrainDepth: 100,
  terrainRows: 32, // Number of rows (like bars)
  terrainCols: 32, // Number of columns
  maxHeight: 15,
  moveSpeed: 0.3, // Reduced speed for slower animation
  rowSpacing: 3, // Distance between rows
  audioSegments: 32, // How many audio segments for horizon
};

export const terrainVisualizer: VisualizerSetup = {
  name: "Terrain",
  song: 1,

  setup: (scene: THREE.Scene) => {
    // Create blue sky background
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    const terrainRows: THREE.Mesh[] = [];
    
    // Create multiple terrain row meshes
    for (let row = 0; row < config.terrainRows; row++) {
      const rowGeometry = new THREE.PlaneGeometry(
        config.terrainWidth,
        config.rowSpacing,
        config.terrainCols - 1,
        1 // Only 1 segment in depth for each row
      );
      
      // Rotate to be horizontal
      rowGeometry.rotateX(-Math.PI / 2);
      
      const rowMaterial = new THREE.MeshLambertMaterial({
        color: 0x8B4513, // Brown
        wireframe: false,
        side: THREE.DoubleSide,
        flatShading: true
      });
      
      const rowMesh = new THREE.Mesh(rowGeometry, rowMaterial);
      
      // Position row in Z (depth) - furthest row at back
      rowMesh.position.z = -row * config.rowSpacing;
      
      terrainRows.push(rowMesh);
      scene.add(rowMesh);
    }
    
    return { 
      terrainRows,
      offset: 0,
      audioHistory: [] as number[][] // Store previous audio data for smooth generation
    };
  },

  animate: (objects: Record<string, any>) => {
    const { terrainRows, audioHistory } = objects;
    const audioData = getAudioData();
    const frequencyRanges = getFrequencyRanges();
    const time = Date.now() * 0.001;
    
    // Move terrain forward
    objects.offset += config.moveSpeed;
    
    // Store current audio data
    audioHistory.push([...audioData]);
    if (audioHistory.length > config.terrainRows) {
      audioHistory.shift(); // Remove oldest data
    }
    
    // Update each terrain row
    terrainRows.forEach((row: THREE.Mesh, rowIndex: number) => {
      // Move row forward
      row.position.z += config.moveSpeed;
      
      // If row moves too far forward, reset it to the back and generate new heights
      if (row.position.z > config.rowSpacing) {
        row.position.z = -(config.terrainRows - 1) * config.rowSpacing;
        
        // Generate new terrain heights for this row using current audio
        const geometry = row.geometry as THREE.PlaneGeometry;
        const positions = geometry.attributes.position;
        const positionsArray = positions.array as Float32Array;
        
        // Use audio data to create horizon line heights
        for (let i = 0; i < positionsArray.length; i += 3) {
          const segmentIndex = Math.floor((i / 3) % (config.terrainCols + 1));
          
          // Map segment to audio frequency
          const audioIndex = Math.floor((segmentIndex / config.terrainCols) * audioData.length);
          const audioValue = audioData[audioIndex] || 0;
          
          // Create height based on audio + some base terrain variation
          const baseHeight = Math.sin(segmentIndex * 0.3 + time) * 2;
          const audioHeight = audioValue * config.maxHeight;
          const bassBoost = frequencyRanges.bass * 5;
          
          positionsArray[i + 1] = baseHeight + audioHeight + bassBoost;
        }
        
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
      } else {
        // For existing rows, use stored audio data if available
        const historyIndex = Math.floor(rowIndex * audioHistory.length / config.terrainRows);
        const historicalAudio = audioHistory[historyIndex] || audioData;
        
        const geometry = row.geometry as THREE.PlaneGeometry;
        const positions = geometry.attributes.position;
        const positionsArray = positions.array as Float32Array;
        
        for (let i = 0; i < positionsArray.length; i += 3) {
          const segmentIndex = Math.floor((i / 3) % (config.terrainCols + 1));
          const audioIndex = Math.floor((segmentIndex / config.terrainCols) * historicalAudio.length);
          const audioValue = historicalAudio[audioIndex] || 0;
          
          const baseHeight = Math.sin(segmentIndex * 0.3 + time + rowIndex * 0.5) * 2;
          const audioHeight = audioValue * config.maxHeight * 0.7; // Reduce for distance
          
          positionsArray[i + 1] = baseHeight + audioHeight;
        }
        
        positions.needsUpdate = true;
      }
      
      // Update material color based on distance (atmospheric perspective)
      const material = row.material as THREE.MeshLambertMaterial;
      const distanceFactor = Math.abs(row.position.z) / (config.terrainRows * config.rowSpacing);
      const fogFactor = Math.min(distanceFactor * 0.5, 0.6);
      
      // Blend brown with sky blue for distance fog
      const brown = new THREE.Color(0x8B4513);
      const skyBlue = new THREE.Color(0x87CEEB);
      material.color.copy(brown.lerp(skyBlue, fogFactor));
    });
  }
};
