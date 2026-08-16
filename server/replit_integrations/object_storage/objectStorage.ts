import { Response } from "express";
import { randomUUID } from "crypto";
import { ObjectAclPolicy, ObjectPermission } from "./objectAcl";

export const objectStorageClient = null;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || "uploads";
  }

  async getObjectEntityUploadURL(): Promise<string> {
    throw new Error("Object storage not configured");
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return rawPath;
  }

  async uploadBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    throw new Error("Object storage not configured");
  }

  async downloadObject(objectName: string, res: Response, cacheTtlSec: number = 3600) {
    if (!res.headersSent) {
      res.status(404).json({ error: "Object storage not configured" });
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    throw new ObjectNotFoundError();
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    return rawPath;
  }

  async canAccessObjectEntity({}: {
    userId?: string;
    objectName: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return false;
  }
}
