import { Component, ElementRef, HostListener, signal, ViewChild, AfterViewInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface ImgRect { top: number; left: number; width: number; height: number; }

interface WorkItem {
  id: number;
  src: string;
  caption?: string;
  tag?: string;
  top: number;
  left: number;
  width: number;
}

@Component({
  selector: 'app-homepage',
  imports: [],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements AfterViewInit, OnDestroy {
  @ViewChild('heroSection') heroSection!: ElementRef<HTMLElement>;
  @ViewChild('aboutSection') aboutSection!: ElementRef<HTMLElement>;
  @ViewChild('aboutImageSlot') aboutImageSlot!: ElementRef<HTMLElement>;
  @ViewChild('worksViewport') worksViewport!: ElementRef<HTMLElement>;
  @ViewChild('worksSection') worksSection!: ElementRef<HTMLElement>;
  @ViewChild('contactSection') contactSection!: ElementRef<HTMLElement>;

  private heroStart!: ImgRect;
  imgStyle = signal<ImgRect>({ top: 0, left: 0, width: 355, height: 516 });

  heroVisible = signal<boolean>(false);
  aboutVisible = signal<boolean>(false);
  worksVisible = signal<boolean>(false);
  contactVisible = signal<boolean>(false);

  private contactObserver?: IntersectionObserver;
  private heroObserver?: IntersectionObserver;
  private aboutObserver?: IntersectionObserver;
  private worksObserver?: IntersectionObserver;
  private resizeHandler?: () => void;

  items: WorkItem[] = [
    { id: 1,  src: 'assets/images/1.jpg', caption: 'Lorem Ipsum', tag: '01', top: 60,   left: 60,   width: 280 },
    { id: 2,  src: 'assets/images/2.jpg', caption: 'Lorem Ipsum', tag: '02', top: 380,  left: 20,   width: 160 },
    { id: 3,  src: 'assets/images/3.jpg', caption: 'Lorem Ipsum', tag: '03', top: 20,   left: 420,  width: 150 },
    { id: 4,  src: 'assets/images/4.jpg', caption: 'Lorem Ipsum', tag: '04', top: 260,  left: 340,  width: 230 },
    { id: 5,  src: 'assets/images/5.jpg', caption: 'Lorem Ipsum', tag: '05', top: 620,  left: 220,  width: 300 },
    { id: 6,  src: 'assets/images/6.jpg', caption: 'Lorem Ipsum', tag: '06', top: 90,   left: 660,  width: 190 },
    { id: 7,  src: 'assets/images/7.jpg', caption: 'Lorem Ipsum', tag: '07', top: 420,  left: 640,  width: 140 },
    { id: 8,  src: 'assets/images/8.jpg', caption: 'Lorem Ipsum', tag: '08', top: 200,  left: 880,  width: 260 },
    { id: 9,  src: 'assets/images/9.jpg', caption: 'Lorem Ipsum', tag: '09', top: 680,  left: 900,  width: 240 },
    { id: 10, src: 'assets/images/10.jpg', caption: 'Lorem Ipsum', tag: '10', top: 40,   left: 1120, width: 150 },
    { id: 11, src: 'assets/images/11.jpg', caption: 'Lorem Ipsum', tag: '11', top: 480,  left: 1180, width: 180 },
  ];

  readonly loopOffsets = [-1, 0, 1];

  panX = signal<number>(0);
  panY = signal<number>(0);
  isPanning = signal<boolean>(false);

  selectedItem = signal<WorkItem | null>(null);

  private panStart = { x: 0, y: 0 };
  private panOriginX = 0;
  private panOriginY = 0;

  private lastMoveTime = 0;
  private lastMoveX = 0;
  private lastMoveY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private momentumFrame: number | null = null;

  private dragDistance = 0;
  private wasDragging = false;
  private readonly clickThreshold = 6;

  private readonly canvasWidth = 1400;
  private readonly canvasHeight = 900;
  private readonly friction = 0.94;
  private readonly minVelocity = 0.05;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // wait until images/fonts have actually loaded before measuring layout,
    // otherwise the captured rect is wrong on slower production networks
    if (document.readyState === 'complete') {
      this.initTravelImage();
    } else {
      window.addEventListener('load', () => this.initTravelImage(), { once: true });
    }

    this.heroObserver = new IntersectionObserver(
      ([entry]) => this.heroVisible.set(entry.isIntersecting),
      { threshold: 0.2 }
    );
    this.heroObserver.observe(this.heroSection.nativeElement);

    this.aboutObserver = new IntersectionObserver(
      ([entry]) => this.aboutVisible.set(entry.isIntersecting),
      { threshold: 0.2 }
    );
    this.aboutObserver.observe(this.aboutSection.nativeElement);

    this.worksObserver = new IntersectionObserver(
      ([entry]) => this.worksVisible.set(entry.isIntersecting),
      { threshold: 0.15 }
    );
    this.worksObserver.observe(this.worksSection.nativeElement);

    this.contactObserver = new IntersectionObserver(
      ([entry]) => this.contactVisible.set(entry.isIntersecting),
      { threshold: 0.2 }
    );
    this.contactObserver.observe(this.contactSection.nativeElement);
  }

  private initTravelImage() {
    const heroSlot = document.querySelectorAll('.hero .flex > div')[0] as HTMLElement;
    if (!heroSlot) return;

    const measure = () => {
      const rect = heroSlot.getBoundingClientRect();
      this.heroStart = {
        top: rect.top + window.scrollY,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
      this.imgStyle.set({ ...this.heroStart, top: rect.top });
      this.onScroll();
    };

    measure();

    // layout can still shift after this (late-loading fonts, etc.) so
    // recalculate on resize as a safety net
    this.resizeHandler = () => measure();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    this.heroObserver?.disconnect();
    this.aboutObserver?.disconnect();
    this.worksObserver?.disconnect();
    this.contactObserver?.disconnect();
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.momentumFrame) cancelAnimationFrame(this.momentumFrame);
  }

  @HostListener('window:scroll')
  onScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.aboutSection || !this.aboutImageSlot || !this.heroStart) return;

    const aboutRect = this.aboutSection.nativeElement.getBoundingClientRect();
    const slotRect = this.aboutImageSlot.nativeElement.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const progress = Math.min(Math.max(1 - aboutRect.top / windowHeight, 0), 1);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    this.imgStyle.set({
      top: lerp(this.heroStart.top - window.scrollY, slotRect.top, progress),
      left: lerp(this.heroStart.left, slotRect.left, progress),
      width: lerp(this.heroStart.width, slotRect.width, progress),
      height: lerp(this.heroStart.height, slotRect.height, progress),
    });
  }

  private wrapX(x: number): number {
    const w = this.canvasWidth;
    let wrapped = x % w;
    if (wrapped > 0) wrapped -= w;
    return wrapped;
  }

  private clampY(y: number) {
    const viewport = this.worksViewport.nativeElement.getBoundingClientRect();
    const minY = Math.min(0, viewport.height - this.canvasHeight);
    return Math.min(0, Math.max(minY, y));
  }

  onPanStart(ev: PointerEvent) {
    if (this.momentumFrame) {
      cancelAnimationFrame(this.momentumFrame);
      this.momentumFrame = null;
    }

    const target = ev.currentTarget as HTMLElement;
    target.setPointerCapture(ev.pointerId);

    this.isPanning.set(true);
    this.panStart = { x: ev.clientX, y: ev.clientY };
    this.panOriginX = this.panX();
    this.panOriginY = this.panY();

    this.lastMoveTime = performance.now();
    this.lastMoveX = ev.clientX;
    this.lastMoveY = ev.clientY;
    this.velocityX = 0;
    this.velocityY = 0;

    this.dragDistance = 0;
    this.wasDragging = false;

    const move = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - this.panStart.x;
      const dy = moveEv.clientY - this.panStart.y;

      this.dragDistance = Math.max(this.dragDistance, Math.hypot(dx, dy));

      this.panX.set(this.wrapX(this.panOriginX + dx));
      this.panY.set(this.clampY(this.panOriginY + dy));

      const now = performance.now();
      const dt = Math.max(now - this.lastMoveTime, 1);
      this.velocityX = (moveEv.clientX - this.lastMoveX) / dt;
      this.velocityY = (moveEv.clientY - this.lastMoveY) / dt;

      this.lastMoveTime = now;
      this.lastMoveX = moveEv.clientX;
      this.lastMoveY = moveEv.clientY;
    };

    const up = (upEv: PointerEvent) => {
      target.releasePointerCapture(upEv.pointerId);
      this.isPanning.set(false);
      this.wasDragging = this.dragDistance > this.clickThreshold;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.startMomentum();

      if (!this.wasDragging) {
        const el = document.elementFromPoint(upEv.clientX, upEv.clientY);
        const figure = el?.closest('.work-item') as HTMLElement | null;
        if (figure) {
          const id = Number(figure.dataset['itemId']);
          const item = this.items.find(i => i.id === id);
          if (item) this.selectedItem.set(item);
        }
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  private startMomentum() {
    const step = () => {
      this.velocityX *= this.friction;
      this.velocityY *= this.friction;

      if (Math.abs(this.velocityX) < this.minVelocity && Math.abs(this.velocityY) < this.minVelocity) {
        this.momentumFrame = null;
        return;
      }

      const nextX = this.wrapX(this.panX() + this.velocityX * 16);
      const nextY = this.clampY(this.panY() + this.velocityY * 16);

      if (nextY === this.panY()) this.velocityY = 0;

      this.panX.set(nextX);
      this.panY.set(nextY);

      this.momentumFrame = requestAnimationFrame(step);
    };

    this.momentumFrame = requestAnimationFrame(step);
  }

  onItemClick(item: WorkItem) {
    if (this.wasDragging) return;
    this.selectedItem.set(item);
  }

  closePreview() {
    this.selectedItem.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    this.closePreview();
  }

  onCloseClick(event: MouseEvent) {
    event.stopPropagation();
    this.closePreview();
  }
}