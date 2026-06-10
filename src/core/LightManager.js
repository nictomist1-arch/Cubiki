import * as THREE from 'three';
import { LIGHT_CONFIG } from '../config/light.js';

export class LightManager {
  constructor(scene) {
    this.scene = scene;
    this.lights = {};
  }

  createAll() {
    const hemi = LIGHT_CONFIG.hemisphere;
    const hemisphere = new THREE.HemisphereLight(
      hemi.skyColor,
      hemi.groundColor,
      hemi.intensity,
    );
    hemisphere.position.set(hemi.position.x, hemi.position.y, hemi.position.z);
    this.scene.add(hemisphere);
    this.lights.hemisphere = hemisphere;

    const mainCfg = LIGHT_CONFIG.main;
    const main = new THREE.DirectionalLight(mainCfg.color, mainCfg.intensity);
    main.position.set(mainCfg.position.x, mainCfg.position.y, mainCfg.position.z);
    if (mainCfg.castShadow) {
      main.castShadow = true;
      main.shadow.mapSize.width = mainCfg.shadowMapSize;
      main.shadow.mapSize.height = mainCfg.shadowMapSize;
      main.shadow.camera.near = 0.1;
      main.shadow.camera.far = 50;
      main.shadow.camera.left = -15;
      main.shadow.camera.right = 15;
      main.shadow.camera.top = 15;
      main.shadow.camera.bottom = -15;
    }
    this.scene.add(main);
    this.lights.main = main;

    return this.lights;
  }
}
