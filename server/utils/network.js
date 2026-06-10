import os from 'os';

/** Возвращает локальные IPv4-адреса для подключения по LAN */
export function getLocalAddresses() {
  const addresses = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) {
        addresses.push(cfg.address);
      }
    }
  }
  return addresses;
}
