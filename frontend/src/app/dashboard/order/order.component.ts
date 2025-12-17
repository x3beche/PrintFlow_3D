import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { Subscription } from 'rxjs';
import { OrderService } from './order.service';
import { 
  BottomTexture, 
  Brand, 
  FDMConfig, 
  FDMMaterial, 
  SLAMaterial,
  OrderData, 
  OrderType,
  OrderEstimations, 
  SLAConfig
} from './models';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
})
export class OrderComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;
  
  orderForm!: FormGroup;
  uploadedFile: File | null = null;
  uploadedFileName: string = '';
  estimations: OrderEstimations | null = null;

  // Enums for template
  orderTypes = Object.values(OrderType);
  fdmMaterials = Object.values(FDMMaterial);
  slaMaterials = Object.values(SLAMaterial);
  bottomTextures = Object.values(BottomTexture);
  brands = Object.values(Brand);

  // Available colors
  colors = ['Red', 'Blue', 'Yellow', 'Black', 'White', 'Green', 'Orange', 'Purple', 'Gray'];
  
  // Infill percentages
  infillOptions = [10, 15, 20, 25, 30, 50, 75, 100];
  
  // Layer heights
  layerHeights = [0.1, 0.15, 0.2, 0.25, 0.3];
  
  // Nozzle sizes
  nozzleSizes = [0.2, 0.4, 0.6, 0.8];

  // Quantities
  quantities = [1, 5, 10, 20, 50, 100];

  constructor(
    private sidebarService: SidebarStateService,
    private orderService: OrderService,
    private fb: FormBuilder
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    this.initializeForm();
  }

  initializeForm(): void {
    this.orderForm = this.fb.group({
      orderType: [OrderType.FDM, Validators.required],
      material: [FDMMaterial.PLA, Validators.required],
      brand: [Brand.BAMBU_LAB, Validators.required],
      color: ['Red', Validators.required],
      layerHeight: [0.2, Validators.required],
      infill: [20, Validators.required],
      bottomTexture: [BottomTexture.PEI, Validators.required],
      nozzleSizes: [0.4, Validators.required],
      quantity: [10, Validators.required],
      notes: ['']
    });

    // Listen to order type changes
    this.orderForm.get('orderType')?.valueChanges.subscribe(type => {
      this.onOrderTypeChange(type);
    });
  }

  onOrderTypeChange(type: OrderType): void {
    if (type === OrderType.FDM) {
      this.orderForm.patchValue({
        material: FDMMaterial.PLA,
        bottomTexture: BottomTexture.PEI
      });
    } else if (type === OrderType.SLA) {
      this.orderForm.patchValue({
        material: SLAMaterial.STANDARD_RESIN
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.uploadedFile = input.files[0];   // ✅ FIX
      this.uploadedFileName = this.uploadedFile.name;

      console.log('File selected:', this.uploadedFileName);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.uploadedFile = event.dataTransfer.files[0]; // ✅ FIX
      this.uploadedFileName = this.uploadedFile.name;

      console.log('File dropped:', this.uploadedFileName);
    }
  }

  get isFDM(): boolean {
    return this.orderForm.get('orderType')?.value === OrderType.FDM;
  }

  get isSLA(): boolean {
    return this.orderForm.get('orderType')?.value === OrderType.SLA;
  }

  calculateEstimation(): void {
    // Mock estimation - replace with actual API call
    this.estimations = {
      estimated_weight: 245.56,
      estimated_cost: 356
    };
  }

onSubmit(): void {
  if (this.orderForm.invalid) {
    console.error('Form is invalid');
    return;
  }

  if (!this.uploadedFile) {
    console.error('No file uploaded');
    return;
  }

  const formValue = this.orderForm.value;
  
  const orderData: OrderData = {
    file_id: "file_" + Date.now(), // Replace with actual file_id from upload
    notes: formValue.notes,
    order_type: formValue.orderType,
    order_detail: this.isFDM ? {
      material: formValue.material,
      brand: formValue.brand,
      color: formValue.color,
      layer_height: formValue.layerHeight,
      infill: formValue.infill,
      bottom_texture: formValue.bottomTexture,
      nozzle_size: formValue.nozzleSizes
    } as FDMConfig : {
      material: formValue.material,
      brand: formValue.brand,
      color: formValue.color,
      layer_height: formValue.layerHeight,
      infill: formValue.infill,
      resin_type: formValue.material,
      uv_curing: "Standard"
    } as SLAConfig
  };

  this.orderService.createNewOrder(orderData).subscribe({
    next: (response) => {
      console.log('Order created successfully:', response);
      // Show success message, reset form, etc.
    },
    error: (error) => {
      console.error('Error creating order:', error);
      // Show error message
    }
  });
}

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}