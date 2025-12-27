# routes/order/models.py
from pydantic import BaseModel
from enum import Enum
from typing import Union, Dict
from datetime import datetime

class FDMMaterial(str, Enum):
    PLA = "PLA"
    ABS = "ABS"
    PETG = "PETG"
    TPU = "TPU"
    NYLON = "NYLON"
    ASA = "ASA"

class SLAMaterial(str, Enum):
    STANDARD_RESIN = "Standard Resin"
    TOUGH_RESIN = "Tough Resin"
    FLEXIBLE_RESIN = "Flexible Resin"
    CASTABLE_RESIN = "Castable Resin"
    DENTAL_RESIN = "Dental Resin"

class BottomTexture(str, Enum):
    SMOOTH = "Smooth"
    PEI = "PEI"
    CARBON = "Carbon"
    TEXTURED = "Textured"
    GLASS = "Glass"
    SATIN = "Satin"

class Brand(str, Enum):
    CREALITY = "Creality"
    PRUSA = "Prusa"
    BAMBU_LAB = "Bambu Lab"
    ANYCUBIC = "Anycubic"
    ELEGOO = "Elegoo"
    FORMLABS = "Formlabs"
    ULTIMAKER = "Ultimaker"
    RAISE3D = "Raise3D"

class PrintingConfig(BaseModel):
    material: FDMMaterial | SLAMaterial
    brand: Brand
    color: str
    layer_height: float
    infill: int

class FDMConfig(PrintingConfig):
    bottom_texture: BottomTexture
    nozzle_size: float

class SLAConfig(PrintingConfig):
    resin_type: str
    uv_curing: str

class OrderType(str, Enum):
    FDM = "FDM"
    SLA = "SLA"

class OrderData(BaseModel):
    file_id: str
    notes: str
    order_type: OrderType
    quantity: int = 1  # ✅ üst seviye
    order_detail: Union[FDMConfig, SLAConfig]  # ✅ kritik

class OrderEstimations(BaseModel):
    estimated_weight: float
    estimated_cost: float

class OrderStatus(Enum):
    ORDER_RECEIVED = "Order Received"
    ASSIGNED_TO_MANUFACTURER = "Assigned to Manufacturer"
    STARTED_MANUFACTURING = "Started Manufacturing"
    PRODUCED = "Produced"
    READY_TO_TAKE = "Ready to Take"

class OrderTimingEntry(BaseModel):
    user_id: str
    timestamp: datetime
    status: OrderStatus

class OrderTimingTable(BaseModel):
    order_received: OrderTimingEntry | None = None
    assigned_to_manufacturer: OrderTimingEntry | None = None
    started_manufacturing: OrderTimingEntry | None = None
    produced: OrderTimingEntry | None = None
    ready_to_take: OrderTimingEntry | None = None

class OrderFormMain(BaseModel):
    order_id: str
    user_id: str
    estimations: OrderEstimations
    file_id: str
    notes: str
    order_type: OrderType
    quantity: int = 1  # ✅ DB’de de sakla
    order_detail: Union[FDMConfig, SLAConfig]  # ✅ kritik (PrintingConfig olmasın)
    order_timing_table: OrderTimingTable
    preview_id: str | None = None
    manufacturer_id: str = ""
    is_cancelled: bool = False


# ==================== PRICING CONFIGURATION ====================

class PricingConfig:
    """Centralized pricing configuration for 3D printing orders"""
    
    # Material density (g/cm³)
    MATERIAL_DENSITY: Dict[str, float] = {
        "PLA": 1.24,
        "ABS": 1.04,
        "PETG": 1.27,
        "TPU": 1.21,
        "NYLON": 1.14,
        "ASA": 1.07,
        "Standard Resin": 1.15,
        "Tough Resin": 1.20,
        "Flexible Resin": 1.10,
        "Castable Resin": 1.18,
        "Dental Resin": 1.16
    }
    
    # Material price per kg (TL)
    MATERIAL_PRICE_PER_KG: Dict[str, float] = {
        "PLA": 450,
        "ABS": 500,
        "PETG": 550,
        "TPU": 800,
        "NYLON": 900,
        "ASA": 650,
        "Standard Resin": 1200,
        "Tough Resin": 1500,
        "Flexible Resin": 1600,
        "Castable Resin": 2000,
        "Dental Resin": 2500
    }
    
    # Brand multiplier
    BRAND_MULTIPLIER: Dict[str, float] = {
        "Creality": 1.0,
        "Prusa": 1.15,
        "Bambu Lab": 1.20,
        "Anycubic": 1.05,
        "Elegoo": 1.00,
        "Formlabs": 1.30,
        "Ultimaker": 1.25,
        "Raise3D": 1.20
    }
    
    # Layer height multiplier (affects print time and quality cost)
    LAYER_HEIGHT_MULTIPLIER: Dict[float, float] = {
        0.1: 1.3,   # High quality = higher cost
        0.15: 1.15,
        0.2: 1.0,   # Standard
        0.25: 0.9,
        0.3: 0.85
    }
    
    # Order type multiplier
    ORDER_TYPE_MULTIPLIER: Dict[str, float] = {
        "FDM": 1.0,
        "SLA": 1.5  # SLA is more expensive
    }
    
    # Base service fee (TL)
    SERVICE_FEE: float = 50.0
    
    @staticmethod
    def get_infill_multiplier(infill: int) -> float:
        """Calculate infill multiplier (affects material usage)"""
        return 0.3 + (infill / 100) * 0.7  # 30% base + 70% scaled by infill
    
    @staticmethod
    def calculate_price(
        volume_cm3: float,
        material: str,
        brand: str,
        order_type: str,
        infill: int,
        layer_height: float,
        quantity: int = 1
    ) -> Dict:
        """Calculate complete price estimation"""
        
        # Get pricing factors
        material_density = PricingConfig.MATERIAL_DENSITY.get(material, 1.24)
        material_price = PricingConfig.MATERIAL_PRICE_PER_KG.get(material, 450)
        brand_mult = PricingConfig.BRAND_MULTIPLIER.get(brand, 1.0)
        layer_mult = PricingConfig.LAYER_HEIGHT_MULTIPLIER.get(layer_height, 1.0)
        type_mult = PricingConfig.ORDER_TYPE_MULTIPLIER.get(order_type, 1.0)
        infill_mult = PricingConfig.get_infill_multiplier(infill)
        
        # Calculate weight
        estimated_weight = volume_cm3 * material_density * infill_mult
        
        # Calculate base cost
        base_cost = (estimated_weight / 1000) * material_price
        
        # Apply multipliers
        total_cost = base_cost * brand_mult * layer_mult * type_mult
        
        # Add service fee
        total_cost += PricingConfig.SERVICE_FEE
        
        # Apply quantity
        total_cost_with_quantity = total_cost * quantity
        estimated_weight_with_quantity = estimated_weight * quantity
        
        return {
            "estimated_weight": round(estimated_weight_with_quantity, 2),
            "estimated_cost": round(total_cost_with_quantity, 2),
            "cost_breakdown": {
                "material_cost": round(base_cost, 2),
                "brand_multiplier": brand_mult,
                "layer_height_multiplier": layer_mult,
                "order_type_multiplier": type_mult,
                "infill_multiplier": round(infill_mult, 2),
                "service_fee": PricingConfig.SERVICE_FEE,
                "quantity": quantity,
                "unit_cost": round(total_cost, 2),
                "total_cost": round(total_cost_with_quantity, 2)
            }
        }

class EstimationRequest(BaseModel):
    file_id: str
    material: str
    brand: str
    order_type: str
    infill: int
    layer_height: float
    quantity: int = 1