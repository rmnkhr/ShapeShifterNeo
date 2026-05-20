import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  standalone: false,  selector: 'app-splashscreen',
  templateUrl: './splashscreen.component.html',
  styleUrls: ['./splashscreen.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplashScreenComponent {}
