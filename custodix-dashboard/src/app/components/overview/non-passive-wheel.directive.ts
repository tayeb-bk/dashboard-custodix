import { Directive, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[nonPassiveWheel]'
})
export class NonPassiveWheelDirective implements AfterViewInit, OnDestroy {
  private handler = (event: WheelEvent) => {
    event.preventDefault();
  };

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.el.nativeElement.addEventListener('wheel', this.handler, { passive: false });
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('wheel', this.handler);
  }
}
