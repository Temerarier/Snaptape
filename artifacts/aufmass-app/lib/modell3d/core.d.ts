import type { Model3dData, Model3dCheck } from "@workspace/db";
declare const core: {
  measurementToMess(raw: unknown): Record<string, unknown>;
  pruefen(mess: Record<string, unknown>, result: Model3dData): Model3dCheck;
};
export = core;
