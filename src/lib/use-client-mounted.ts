"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function useClientMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
