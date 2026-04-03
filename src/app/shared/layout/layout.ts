import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../components/sidebar/sidebar';
import { NavbarComponent } from '../components/navbar/navbar';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, NavbarComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {}