import { Subscription, interval } from "rxjs";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrl: './home.component.css'
})
export class HomeComponent {
 private currentModelIndex = 0;
  private autoPlayInterval: any;

  constructor(private router: Router) { }


}
