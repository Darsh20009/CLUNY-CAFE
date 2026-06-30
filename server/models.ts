import mongoose from 'mongoose';

// ─── NOTE ────────────────────────────────────────────────────────────────────
// BusinessConfigModel and AppointmentModel are defined in shared/schema.ts.
// They were previously duplicated here. All consumers should import from
// @shared/schema to ensure a single schema definition is used by Mongoose.
// Re-exported here for convenience so server/index.ts can import from "./models".
// ─────────────────────────────────────────────────────────────────────────────
export { BusinessConfigModel } from '@shared/schema';

// ── Cloud Print Queue ─────────────────────────────────────────────────────────
// Stores print jobs submitted by browsers so a local print agent can pick them up.
// This model is intentionally kept here (not in shared/schema.ts) because it is
// a server-side operational concern only — the frontend never queries it directly.
const printJobSchema = new mongoose.Schema({
  data:        { type: String, required: true },      // base64 ESC/POS bytes
  printerIp:   { type: String, required: true },      // e.g. "192.168.8.77"
  printerPort: { type: Number, default: 9100 },
  status:      { type: String, default: 'pending' },  // 'pending' | 'done' | 'error'
  errorMsg:    String,
  createdAt:   { type: Date, default: Date.now, expires: 300 }, // auto-delete after 5 min
  doneAt:      Date,
});

export const PrintJobModel =
  mongoose.models.PrintJob || mongoose.model('PrintJob', printJobSchema);
