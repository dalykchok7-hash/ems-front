import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProduitsComponent } from './produits';

describe('Produits', () => {
  let component: ProduitsComponent;
  let fixture: ComponentFixture<ProduitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProduitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProduitsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});