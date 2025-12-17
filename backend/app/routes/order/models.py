from pydantic import BaseModel
from enum import Enum
from typing import Union

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
    order_detail: PrintingConfig

class OrderForm(BaseModel): 
    order_id: str
    user_id: str
    data: OrderData

class OrderEstimations(BaseModel): 
    estimated_weight: float
    estimated_cost: float
