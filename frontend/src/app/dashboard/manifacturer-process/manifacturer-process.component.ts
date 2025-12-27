// manifacturer-process.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { ManufacturerProcessService, OrderDetailsResponse } from './process.service';

export interface ManufacturingState {
  specs: {
    materialLabel: string;
    brand: string;
    colorName: string;
    colorHex: string | null;
    layerHeight: string;
    infill: string;
    buildPlate: string;

    // ✅ NEW (backend /manufacturer/order/{id} now returns these)
    nozzleSize?: string; // FDM only
    resinType?: string;  // SLA only
    uvCuring?: string;   // SLA only

    // ✅ NEW
    quantity: number;
  };
  file: {
    name: string;
    size: string;
    fileId: string;
  };
  customer: {
    fullName: string;
    initials: string;
    userId: string;
    notes: string;
    orderHistory: string;
  };
  order: {
    id: string;
    date: string;
    type: string;

    // ✅ NEW (optional meta)
    previewId?: string | null;
    manufacturerId?: string;
    isCancelled?: boolean;
  };
}

export interface FinalizationState {
  upload: {
    preview: string | ArrayBuffer | null;
    file: File | null;
  };
  inputs: {
    notesToCustomer: string;
    deliveryAddress: string;
  };
  costs: {
    filamentUsage: string;
    estPrice: string;
    finalPrice: string;
  };
}

export interface Step {
  id: number;
  label: string;
  date: string;
  completed: boolean;
}

@Component({
  selector: 'app-manifacturer-process',
  templateUrl: './manifacturer-process.component.html',
  styleUrl: './manifacturer-process.component.css'
})
export class ManifacturerProcessComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  orderId: string = '';
  manufacturingState: ManufacturingState | null = null;
  finalizationState: FinalizationState | null = null;

  // 🆕 AYRI LOADING STATE'LERİ
  isLoading = true;                    // Sayfa ilk yüklenirken
  isStartingProduction = false;        // START PRODUCTION butonu için
  isCompletingProduction = false;      // COMPLETE PRODUCTION butonu için
  isDownloading = false;               // Download butonu için
  isLoadingImage = false;              // Finalize resmi yüklenirken
  isSubmitting = false;                // Submit butonu için

  errorMessage: string = '';
  isFinalized = false;

  activeTabName: string = 'Manufacturing';

  steps: Step[] = [];

  tabs = [
    { name: 'Manufacturing', active: true },
    { name: 'Finalization', active: false },
  ];

  constructor(
    private sidebarService: SidebarStateService,
    private route: ActivatedRoute,
    private router: Router,
    private manufacturerService: ManufacturerProcessService
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    this.route.params.subscribe(params => {
      this.orderId = params['order_id'];
      if (this.orderId) {
        this.loadOrderDetails();
      } else {
        this.errorMessage = 'Order ID not found';
        this.isLoading = false;
      }
    });
  }

  /**
   * Load order details from API
   */
  loadOrderDetails(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.manufacturerService.getOrderDetails(this.orderId).subscribe({
      next: (response: OrderDetailsResponse) => {
        if (response.success) {
          this.mapResponseToState(response);
          this.determineActiveTab();
        } else {
          this.errorMessage = 'Failed to load order details';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading order:', error);
        this.errorMessage = error.error?.detail || 'Failed to load order details';
        this.isLoading = false;
      }
    });
  }

  private mapResponseToState(response: OrderDetailsResponse): void {
    const order = response.order;

    // quantity fallback: prefer UI field, else order_raw.quantity, else 1
    const quantity =
      (order as any).quantity ??
      (response as any).order_raw?.quantity ??
      1;

    // Manufacturing State
    this.manufacturingState = {
      specs: {
        materialLabel: order.specs.materialLabel,
        brand: order.specs.brand,
        colorName: order.specs.colorName,
        colorHex: order.specs.colorHex ?? null,
        layerHeight: order.specs.layerHeight,
        infill: order.specs.infill,
        buildPlate: order.specs.buildPlate,

        // new optional fields (safe if backend doesn't send)
        nozzleSize: (order.specs as any).nozzleSize,
        resinType: (order.specs as any).resinType,
        uvCuring: (order.specs as any).uvCuring,

        quantity
      },

      file: order.file,

      customer: {
        fullName: order.customer.fullName,
        initials: order.customer.initials,
        userId: order.customer.userId,
        notes: order.customer.notes,
        orderHistory: order.customer.orderHistory
      },

      order: {
        id: order.order_id,
        date: order.orderInfo.date,
        type: order.order_type,

        // optional meta if provided
        previewId: (order as any).preview_id ?? (response as any).order_raw?.preview_id ?? null,
        manufacturerId: (order as any).manufacturer_id ?? (response as any).order_raw?.manufacturer_id,
        isCancelled: order.is_cancelled
      }
    };

    // Check if finalization exists
    if (order.finalization) {
      this.isFinalized = true;

      this.finalizationState = {
        upload: {
          preview: null,
          file: null
        },
        inputs: {
          notesToCustomer: order.finalization.notesToCustomer,
          deliveryAddress: order.finalization.deliveryAddress
        },
        costs: {
          filamentUsage: order.finalization.filamentUsage.toString(),
          estPrice: order.orderInfo.estimatedCost.toFixed(2),
          finalPrice: order.finalization.finalPrice.toString()
        }
      };

      this.loadProductImage();
    } else {
      this.isFinalized = false;

      this.finalizationState = {
        upload: {
          preview: null,
          file: null
        },
        inputs: {
          notesToCustomer: '',
          deliveryAddress: ''
        },
        costs: {
          filamentUsage: '',
          estPrice: order.orderInfo.estimatedCost.toFixed(2),
          finalPrice: ''
        }
      };
    }

    this.steps = order.steps;
  }

  /**
   * Handle image selection
   */
  onImageSelected(event: Event): void {
    if (this.isFinalized) {
      alert('Order is already finalized');
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && this.finalizationState) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('Image size should not exceed 5MB');
        return;
      }

      this.finalizationState.upload.file = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        if (this.finalizationState) {
          this.finalizationState.upload.preview = e.target?.result || null;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Determine which tab should be active based on order status
   */
  private determineActiveTab(): void {
    const producedStep = this.steps.find(s => s.label === 'Produced');

    if (producedStep && producedStep.completed) {
      this.selectTab(this.tabs[1]);
    } else {
      this.selectTab(this.tabs[0]);
    }
  }

  /**
   * Switch between tabs
   */
  selectTab(selectedTab: any): void {
    this.tabs.forEach(tab => tab.active = false);
    selectedTab.active = true;
    this.activeTabName = selectedTab.name;
  }

  /**
   * Check if production has started
   */
  isProductionStarted(): boolean {
    const startedStep = this.steps.find(s =>
      s.label === 'Started Manufacturing' ||
      s.label.toLowerCase().includes('started manufacturing')
    );
    return startedStep ? startedStep.completed : false;
  }

  /**
   * Check if production is completed
   */
  isProductionCompleted(): boolean {
    const producedStep = this.steps.find(s =>
      s.label === 'Produced' ||
      s.label.toLowerCase().includes('produced')
    );
    return producedStep ? producedStep.completed : false;
  }

  /**
   * Start production - AYRI SPINNER
   */
  startProduction(): void {
    if (this.isStartingProduction || this.isProductionStarted()) return;

    this.isStartingProduction = true;

    this.manufacturerService.startProduction(this.orderId).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadOrderDetails();
        }
        this.isStartingProduction = false;
      },
      error: (error) => {
        console.error('❌ Error starting production:', error);
        alert(error.error?.detail || 'Failed to start production');
        this.isStartingProduction = false;
      }
    });
  }

  /**
   * Complete production - AYRI SPINNER
   */
  completeProduction(): void {
    if (this.isCompletingProduction || this.isProductionCompleted()) return;

    this.isCompletingProduction = true;

    this.manufacturerService.completeProduction(this.orderId).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadOrderDetails();
          this.selectTab(this.tabs[1]);
        }
        this.isCompletingProduction = false;
      },
      error: (error) => {
        console.error('❌ Error completing production:', error);
        alert(error.error?.detail || 'Failed to complete production');
        this.isCompletingProduction = false;
      }
    });
  }

  /**
   * Download source file - AYRI SPINNER
   */
  downloadFile(): void {
    if (this.isDownloading) return;

    console.log('🔽 Starting download for order:', this.orderId);
    this.isDownloading = true;

    this.manufacturerService.downloadOrderFile(this.orderId).subscribe({
      next: (blob: Blob) => {
        console.log('✅ Blob received:', blob.size, 'bytes', blob.type);

        if (!blob || blob.size === 0) {
          console.error('❌ Empty blob received');
          alert('Received empty file');
          this.isDownloading = false;
          return;
        }

        try {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `order_${this.orderId}.stl`;
          link.style.display = 'none';

          document.body.appendChild(link);
          link.click();

          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);

          this.isDownloading = false;

        } catch (error) {
          console.error('❌ Error creating download:', error);
          alert('Failed to create download link');
          this.isDownloading = false;
        }
      },
      error: (error) => {
        console.error('❌ Download request failed:', error);

        let errorMessage = 'Failed to download file';

        if (error.status === 0) {
          errorMessage = 'Network error - Check CORS settings';
        } else if (error.status === 403) {
          errorMessage = 'Access denied';
        } else if (error.status === 404) {
          errorMessage = 'File not found';
        } else if (error.error?.detail) {
          errorMessage = error.error.detail;
        }

        alert(errorMessage);
        this.isDownloading = false;
      }
    });
  }

  /**
   * Update notes to customer
   */
  onNotesChange(event: Event): void {
    if (this.isFinalized) return;
    const textarea = event.target as HTMLTextAreaElement;
    if (this.finalizationState) {
      this.finalizationState.inputs.notesToCustomer = textarea.value;
    }
  }

  /**
   * Update delivery address
   */
  onAddressChange(event: Event): void {
    if (this.isFinalized) return;
    const textarea = event.target as HTMLTextAreaElement;
    if (this.finalizationState) {
      this.finalizationState.inputs.deliveryAddress = textarea.value;
    }
  }

  /**
   * Update filament usage
   */
  onFilamentUsageChange(event: Event): void {
    if (this.isFinalized) return;
    const input = event.target as HTMLInputElement;
    if (this.finalizationState) {
      this.finalizationState.costs.filamentUsage = input.value;
    }
  }

  /**
   * Update final price
   */
  onFinalPriceChange(event: Event): void {
    if (this.isFinalized) return;
    const input = event.target as HTMLInputElement;
    if (this.finalizationState) {
      this.finalizationState.costs.finalPrice = input.value;
    }
  }

  /**
   * Submit finalization - AYRI SPINNER
   */
  submitFinalization(): void {
    if (!this.finalizationState || this.isFinalized) return;

    if (!this.finalizationState.inputs.notesToCustomer.trim()) {
      alert('Please add notes to customer');
      return;
    }

    if (!this.finalizationState.inputs.deliveryAddress.trim()) {
      alert('Please add delivery address');
      return;
    }

    if (!this.finalizationState.costs.filamentUsage || parseFloat(this.finalizationState.costs.filamentUsage) <= 0) {
      alert('Please enter valid filament usage');
      return;
    }

    if (!this.finalizationState.costs.finalPrice || parseFloat(this.finalizationState.costs.finalPrice) <= 0) {
      alert('Please enter valid final price');
      return;
    }

    this.isSubmitting = true;

    if (this.finalizationState.upload.file) {
      this.manufacturerService.uploadProductImage(this.orderId, this.finalizationState.upload.file).subscribe({
        next: (uploadResponse) => {
          console.log('Image uploaded:', uploadResponse);
          this.submitFinalData();
        },
        error: (error) => {
          console.error('❌ Error uploading image:', error);
          alert('Failed to upload image, but continuing with finalization');
          this.submitFinalData();
        }
      });
    } else {
      this.submitFinalData();
    }
  }

  /**
   * Load existing product image from server - AYRI SPINNER
   */
  loadProductImage(): void {
    this.isLoadingImage = true;

    this.manufacturerService.getProductImage(this.orderId).subscribe({
      next: (blob: Blob) => {
        const imageUrl = URL.createObjectURL(blob);
        if (this.finalizationState) {
          this.finalizationState.upload.preview = imageUrl;
        }
        console.log('🖼️ Product image loaded');
        this.isLoadingImage = false;
      },
      error: (error) => {
        console.warn('⚠️ Could not load product image:', error.status);
        this.isLoadingImage = false;
      }
    });
  }

  /**
   * Submit final order data
   */
  private submitFinalData(): void {
    if (!this.finalizationState) return;

    const finalData = {
      notes_to_customer: this.finalizationState.inputs.notesToCustomer,
      delivery_address: this.finalizationState.inputs.deliveryAddress,
      filament_usage: parseFloat(this.finalizationState.costs.filamentUsage),
      final_price: parseFloat(this.finalizationState.costs.finalPrice)
    };

    this.manufacturerService.finalizeOrder(this.orderId, finalData).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Order finalized successfully');
          this.isFinalized = true;
          this.loadOrderDetails();
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('❌ Error finalizing order:', error);
        alert(error.error?.detail || 'Failed to finalize order');
        this.isSubmitting = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
