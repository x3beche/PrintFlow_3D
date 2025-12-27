import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.css'
})
export class GraphComponent implements OnChanges {

  @Input() value: number = 0;      
  @Input() label: string = '';
  @Input() count: number = 0;  // ✅ Yeni: Adet sayısı
  @Input() reverseColor: boolean = false;

  radius = 40;
  circumference = 2 * Math.PI * this.radius;

  strokeDashoffset = 0;
  strokeColor = '#ff0000';

  ngOnChanges(changes: SimpleChanges): void {
    this.calculateProgress();
  }

  private calculateProgress() {
    let percentage = Math.min(Math.max(this.value, 0), 100);

    this.strokeDashoffset = this.circumference - (percentage / 100) * this.circumference;

    this.strokeColor = this.calculateColor(percentage);
  }

  private calculateColor(percentage: number): string {
    let hue = (percentage / 100) * 120;
    if (this.reverseColor) {
      hue = 120 - hue;
    }
    return `hsl(${hue}, 85%, 50%)`;
  }
  
}
