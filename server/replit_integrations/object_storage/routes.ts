import type { Express } from "express";
import { randomUUID } from "crypto";

export function registerObjectStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      const objectId = randomUUID();
      const objectName = `uploads/${objectId}`;
      res.json({
        uploadURL: `/api/uploads/direct/${objectName}`,
        objectPath: `/objects/${objectName}`,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    res.status(404).json({ error: "Object not found" });
  });
}
