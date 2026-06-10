import { env } from '../config/env.js';
import { fileStore } from './fileStore.js';
import { mongoStore } from './mongo.js';

let store = fileStore;
let driver = 'file';

/** Подключает MongoDB или локальный JSON-файл */
export async function connectDatabase() {
  if (env.mongoUri) {
    await mongoStore.connect(env.mongoUri);
    store = mongoStore;
    driver = 'mongo';
  } else {
    await fileStore.connect();
    store = fileStore;
    driver = 'file';
  }
  return driver;
}

export function getStore() {
  return store;
}

export function getDbDriver() {
  return driver;
}
