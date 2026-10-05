import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memory = new Map<string, string>();

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    memory.set(key, value);
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === "web") {
    if (memory.has(key)) return memory.get(key) ?? null;
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    memory.delete(key);
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  async getAccess() {
    return getItem("access_token");
  },
  async getRefresh() {
    return getItem("refresh_token");
  },
  async setTokens(access: string, refresh: string) {
    await setItem("access_token", access);
    await setItem("refresh_token", refresh);
  },
  async clear() {
    await deleteItem("access_token");
    await deleteItem("refresh_token");
  },
};
