// order.model.ts

export enum FDMMaterial {
  PLA = "PLA",
  ABS = "ABS",
  PETG = "PETG",
  TPU = "TPU",
  NYLON = "NYLON",
  ASA = "ASA"
}

export enum SLAMaterial {
  STANDARD_RESIN = "Standard Resin",
  TOUGH_RESIN = "Tough Resin",
  FLEXIBLE_RESIN = "Flexible Resin",
  CASTABLE_RESIN = "Castable Resin",
  DENTAL_RESIN = "Dental Resin"
}

export enum BottomTexture {
  SMOOTH = "Smooth",
  PEI = "PEI",
  CARBON = "Carbon",
  TEXTURED = "Textured",
  GLASS = "Glass",
  SATIN = "Satin"
}

export enum Brand {
  CREALITY = "Creality",
  PRUSA = "Prusa",
  BAMBU_LAB = "Bambu Lab",
  ANYCUBIC = "Anycubic",
  ELEGOO = "Elegoo",
  FORMLABS = "Formlabs",
  ULTIMAKER = "Ultimaker",
  RAISE3D = "Raise3D"
}

export interface PrintingConfig {
  material: FDMMaterial | SLAMaterial;
  brand: Brand;
  color: string;
  layer_height: number;
  infill: number;
}

export interface FDMConfig extends PrintingConfig {
  bottom_texture: BottomTexture;
  nozzle_size: number;
}

export interface SLAConfig extends PrintingConfig {
  resin_type: string;
  uv_curing: string;
}

export enum OrderType {
  FDM = "FDM",
  SLA = "SLA"
}

export interface OrderData {
  file_id: string;
  notes: string;
  order_type: OrderType;
  order_detail: PrintingConfig;
}

export interface OrderForm {
  order_id: string;
  user_id: string;
  data: OrderData;
}

export interface OrderEstimations {
  estimated_weight: number;
  estimated_cost: number;
}