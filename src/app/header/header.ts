import { Component, ElementRef, HostListener, signal } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isMenuOpen = signal<boolean>(false);

  navLinks = [
    { href: '#home', label: 'Home' },
    { href: '#about', label: 'About' },
    { href: '#works', label: 'Works' },
    { href: '#contact', label: 'Contact' },
  ];

  constructor(private eRef: ElementRef) {}

  toggleMenu() {
    this.isMenuOpen.update((prev) => !prev);
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }
}