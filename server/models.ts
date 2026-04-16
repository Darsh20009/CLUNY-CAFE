import mongoose from 'mongoose';

const storeHourSchema = new mongoose.Schema({
  open: { type: String, default: '00:00' },
  close: { type: String, default: '23:59' },
  isOpen: { type: Boolean, default: true },
  isAlwaysOpen: { type: Boolean, default: true }
}, { _id: false });

const businessConfigSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, unique: true },
  tradeNameAr: String,
  tradeNameEn: String,
  activityType: { type: String, default: 'both' },
  isFoodEnabled: { type: Boolean, default: true },
  isDrinksEnabled: { type: Boolean, default: true },
  vatPercentage: { type: Number, default: 15 },
  currency: { type: String, default: 'SAR' },
  timezone: { type: String, default: 'Asia/Riyadh' },
  isEmergencyClosed: { type: Boolean, default: false },
  isMaintenanceMode: { type: Boolean, default: false },
  maintenanceReason: String,
  storeHours: {
    monday: { type: storeHourSchema, default: () => ({}) },
    tuesday: { type: storeHourSchema, default: () => ({}) },
    wednesday: { type: storeHourSchema, default: () => ({}) },
    thursday: { type: storeHourSchema, default: () => ({}) },
    friday: { type: storeHourSchema, default: () => ({}) },
    saturday: { type: storeHourSchema, default: () => ({}) },
    sunday: { type: storeHourSchema, default: () => ({}) }
  },
  socialLinks: {
    instagram: String,
    twitter: String,
    facebook: String,
    snapchat: String,
    tiktok: String,
    whatsapp: String
  },
  menuLayout: { type: String, enum: ['classic', 'cards', 'list'], default: 'classic' },
  cashierLayout: { type: String, enum: ['classic', 'pos', 'split'], default: 'classic' },
  loyaltyConfig: {
    enabled: { type: Boolean, default: true },
    pointsPerSar: { type: Number, default: 20 },
    pointsEarnedPerSar: { type: Number, default: 1 },
    minPointsForRedemption: { type: Number, default: 100 },
  },
  offersConfig: {
    firstOrderDiscount: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: 'percent', enum: ['percent', 'amount'] },
      value: { type: Number, default: 15 },
      expiresDays: { type: Number, default: 7 },
    },
    comebackDiscount: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: 'percent', enum: ['percent', 'amount'] },
      value: { type: Number, default: 10 },
      minOrders: { type: Number, default: 1 },
      maxOrders: { type: Number, default: 4 },
      expiresDays: { type: Number, default: 3 },
    },
    frequentDiscount: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: 'percent', enum: ['percent', 'amount'] },
      value: { type: Number, default: 20 },
      minOrders: { type: Number, default: 5 },
    },
    specialDrinkDiscount: {
      enabled: { type: Boolean, default: true },
      discountType: { type: String, default: 'percent', enum: ['percent', 'amount'] },
      value: { type: Number, default: 25 },
    },
    pointsRedemption: {
      enabled: { type: Boolean, default: true },
      minPoints: { type: Number, default: 100 },
    },
  },
  paymentGateway: {
    provider: { type: String, default: 'none' },
    enabledMethods: [String],
    cashEnabled: { type: Boolean, default: true },
    cashMaxDistance: { type: Number, default: 0 },
    storeLocation: {
      lat: Number,
      lng: Number,
    },
    posEnabled: { type: Boolean, default: true },
    qahwaCardEnabled: { type: Boolean, default: true },
    bankTransferEnabled: { type: Boolean, default: false },
    stcPayEnabled: { type: Boolean, default: false },
    neoleap: {
      clientId: String,
      clientSecret: String,
      merchantId: String,
      baseUrl: String,
      callbackUrl: String,
    },
    paymentTestMode: { type: Boolean, default: false },
    geidea: {
      publicKey: String,
      apiPassword: String,
      baseUrl: String,
      callbackUrl: String,
      customerEnabled: { type: Boolean, default: true },
      testMode: { type: Boolean, default: false },
      livePublicKey: String,
      liveApiPassword: String,
      testPublicKey: String,
      testApiPassword: String,
    },
    paymob: {
      apiKey: String,
      integrationId: String,
      iframeId: String,
      walletIntegrationId: String,
      hmacSecret: String,
      callbackUrl: String,
    },
  },
  serviceFee: {
    enabled: { type: Boolean, default: true },
    amount: { type: Number, default: 0.70 },
    reducedAmount: { type: Number, default: 0.35 },
    reducedThreshold: { type: Number, default: 5 },
  },
  prepTimeConfig: {
    basePrepMinutes: { type: Number, default: 10 },
    extraMinutesPerItem: { type: Number, default: 3 },
    extraItemThreshold: { type: Number, default: 2 },
  },
  updatedAt: { type: Date, default: Date.now }
});

export const BusinessConfigModel = mongoose.models.BusinessConfig || mongoose.model('BusinessConfig', businessConfigSchema);

const appointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  branchId: String,
  customerId: String,
  customerName: String,
  customerPhone: String,
  appointmentDate: Date,
  numberOfPeople: Number,
  serviceType: String, // 'table', 'event', etc.
  status: { type: String, default: 'pending' }, // 'pending', 'confirmed', 'cancelled', 'completed'
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const AppointmentModel = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
