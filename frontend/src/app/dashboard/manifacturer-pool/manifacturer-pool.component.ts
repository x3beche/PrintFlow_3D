import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { GraphComponent } from './graph/graph.component';
import { AdoptedTaskComponent, AdoptedTaskState} from './adopted-task/adopted-task.component';
import { NonAdoptedTaskComponent, NonAdoptedTaskState } from './non-adopted-task/non-adopted-task.component';

interface Task {
  id: string;
  date: string;
  name: string;
  image: string;
}

@Component({
  selector: 'app-manifacturer-pool',
  templateUrl: './manifacturer-pool.component.html',
  styleUrl: './manifacturer-pool.component.css'
})
export class ManifacturerPoolComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  // ✅ Continuing Tasks
  allContinuingTasks: AdoptedTaskState[] = [
    {
      id: 1,
      name: 'Serhat Yılmaz',
      date: new Date(2025, 9, 22, 15, 12), 
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 2,
      name: 'Ayşe Demir',
      date: '2025-10-22T16:45:00',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 3,
      name: 'Mehmet Öztürk',
      date: new Date(),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 4,
      name: 'Zeynep Kaya',
      date: new Date(2025, 9, 23, 9, 30),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 5,
      name: 'Ali Veli',
      date: new Date(2025, 9, 24, 10, 15),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 6,
      name: 'Fatma Yıldız',
      date: new Date(2025, 9, 25, 14, 20),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 7,
      name: 'Can Demir',
      date: new Date(2025, 9, 26, 11, 45),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 8,
      name: 'Elif Şahin',
      date: new Date(2025, 9, 27, 16, 30),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    }
  ];

  // ✅ Summary Stats - 4 tane
  summaryStats = [
    { value: 26, label: 'Non-adopted tasks' },
    { value: 42, label: 'In Progress' },
    { value: 18, label: 'Completed' },
    { value: 8, label: 'Cancelled' }
  ];

  // ✅ Available Tasks
  allAvailableTasks: NonAdoptedTaskState[] = [
    {
      id: 1,
      orderId: "#8829102",
      name: 'Serhat Yılmaz',
      date: new Date(2025, 9, 22, 15, 12), 
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 2,
      orderId: "#8829103",
      name: 'Ayşe Demir',
      date: '2025-10-22T16:45:00',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 3,
      orderId: "#8829104",
      name: 'Mehmet Öztürk',
      date: new Date(),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 4,
      orderId: "#8829105",
      name: 'Zeynep Kaya',
      date: new Date(2025, 9, 23, 9, 30),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 5,
      orderId: "#8829106",
      name: 'Ali Veli',
      date: new Date(2025, 9, 24, 10, 15),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 6,
      orderId: "#8829107",
      name: 'Fatma Yıldız',
      date: new Date(2025, 9, 25, 14, 20),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 7,
      orderId: "#8829108",
      name: 'Can Demir',
      date: new Date(2025, 9, 26, 11, 45),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 8,
      orderId: "#8829109",
      name: 'Elif Şahin',
      date: new Date(2025, 9, 27, 16, 30),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 9,
      orderId: "#8829110",
      name: 'Burak Arslan',
      date: new Date(2025, 9, 28, 13, 10),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 10,
      orderId: "#8829111",
      name: 'Selin Öz',
      date: new Date(2025, 9, 29, 15, 50),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 11,
      orderId: "#8829112",
      name: 'Emre Kara',
      date: new Date(2025, 9, 30, 12, 25),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 12,
      orderId: "#8829113",
      name: 'Deniz Aydın',
      date: new Date(2025, 10, 1, 10, 40),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    },
    {
      id: 13,
      orderId: "#8829114",
      name: 'Cem Yılmaz',
      date: new Date(2025, 10, 2, 14, 15),
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=200&auto=format&fit=crop' 
    }
  ];

  // ✅ Pagination state'leri - 3 kart göster
  continuingTasksPage = 1;
  continuingTasksPerPage = 3; // ✅ 4'ten 3'e düşürüldü
  
  availableTasksPage = 1;
  availableTasksPerPage = 3;

  constructor(
    private sidebarService: SidebarStateService,
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // ✅ Continuing Tasks Pagination
  get continuingTasks(): AdoptedTaskState[] {
    const start = (this.continuingTasksPage - 1) * this.continuingTasksPerPage;
    const end = start + this.continuingTasksPerPage;
    return this.allContinuingTasks.slice(start, end);
  }

  get continuingTasksTotalPages(): number {
    return Math.ceil(this.allContinuingTasks.length / this.continuingTasksPerPage);
  }

  getContinuingTasksPageNumbers(): number[] {
    return Array.from({ length: this.continuingTasksTotalPages }, (_, i) => i + 1);
  }

  goToContinuingTasksPage(page: number): void {
    if (page >= 1 && page <= this.continuingTasksTotalPages) {
      this.continuingTasksPage = page;
    }
  }

  previousContinuingTasksPage(): void {
    if (this.continuingTasksPage > 1) {
      this.continuingTasksPage--;
    }
  }

  nextContinuingTasksPage(): void {
    if (this.continuingTasksPage < this.continuingTasksTotalPages) {
      this.continuingTasksPage++;
    }
  }

  getContinuingTasksStartIndex(): number {
    return (this.continuingTasksPage - 1) * this.continuingTasksPerPage + 1;
  }

  getContinuingTasksEndIndex(): number {
    return Math.min(this.continuingTasksPage * this.continuingTasksPerPage, this.allContinuingTasks.length);
  }

  // ✅ Available Tasks Pagination
  get availableTasks(): NonAdoptedTaskState[] {
    const start = (this.availableTasksPage - 1) * this.availableTasksPerPage;
    const end = start + this.availableTasksPerPage;
    return this.allAvailableTasks.slice(start, end);
  }

  get availableTasksTotalPages(): number {
    return Math.ceil(this.allAvailableTasks.length / this.availableTasksPerPage);
  }

  getAvailableTasksPageNumbers(): number[] {
    return Array.from({ length: this.availableTasksTotalPages }, (_, i) => i + 1);
  }

  goToAvailableTasksPage(page: number): void {
    if (page >= 1 && page <= this.availableTasksTotalPages) {
      this.availableTasksPage = page;
    }
  }

  previousAvailableTasksPage(): void {
    if (this.availableTasksPage > 1) {
      this.availableTasksPage--;
    }
  }

  nextAvailableTasksPage(): void {
    if (this.availableTasksPage < this.availableTasksTotalPages) {
      this.availableTasksPage++;
    }
  }

  getAvailableTasksStartIndex(): number {
    return (this.availableTasksPage - 1) * this.availableTasksPerPage + 1;
  }

  getAvailableTasksEndIndex(): number {
    return Math.min(this.availableTasksPage * this.availableTasksPerPage, this.allAvailableTasks.length);
  }
}