export const LIGHT_CONFIG = {
  hemisphere: {
    skyColor: 0x6a7cff,
    groundColor: 0x0a0618,
    intensity: 0.45,
    position: { x: 0, y: 50, z: 0 },
    helper: {
      enabled: false,
      size: 2,
    },
  },
  main: {
    color: 0xca0533,
    intensity: 1.2,
    position: { x: 1, y: 1, z: 1 },
    castShadow: true,
    shadowMapSize: 1024,
  },
};
