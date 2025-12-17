import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AdoptedTaskState {
  id: number;          
  name: string;        
  date: Date | string; 
  image: string;      
}

@Component({
  selector: 'app-adopted-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './adopted-task.component.html',
  styleUrl: './adopted-task.component.css'
})
export class AdoptedTaskComponent {
  @Input() imageSource: string = '';

  @Input() createdDate: string | Date = new Date();
  
  @Input() name: string = '';

  
}
