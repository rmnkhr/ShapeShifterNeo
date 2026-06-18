import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatOptionModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import {
  CanvasComponent,
  CanvasContainerDirective,
  CanvasLayersDirective,
  CanvasOverlayDirective,
  CanvasPaperDirective,
  CanvasRulerDirective,
} from 'app/modules/editor/components/canvas';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
  DropFilesDialogComponent,
  HotkeysDialogComponent,
} from 'app/modules/editor/components/dialogs';
import {
  LayerListTreeComponent,
  LayerTimelineComponent,
  LayerTimelineGridDirective,
  TimelineAnimationRowComponent,
} from 'app/modules/editor/components/layertimeline';
import { PlaybackComponent } from 'app/modules/editor/components/playback';
import { PropertyInputComponent } from 'app/modules/editor/components/propertyinput';
import { DropTargetDirective } from 'app/modules/editor/components/root/droptarget.directive';
import { RootComponent } from 'app/modules/editor/components/root/root.component';
import { ScrollGroupDirective } from 'app/modules/editor/components/scrollgroup/scrollgroup.directive';
import { SplashScreenComponent } from 'app/modules/editor/components/splashscreen/splashscreen.component';
import { SplitterComponent } from 'app/modules/editor/components/splitter/splitter.component';
import { ToolbarComponent } from 'app/modules/editor/components/toolbar/toolbar.component';
import { ToolPanelComponent } from 'app/modules/editor/components/toolpanel/toolpanel.component';
import { errorHandlerFactory } from 'app/modules/editor/scripts/bugsnag';
import { StoreModule } from '@ngrx/store';
import { metaReducers, reducers } from 'app/modules/editor/store';
import { environment } from 'environments/environment';

@NgModule({
  declarations: [
    CanvasComponent,
    CanvasContainerDirective,
    CanvasLayersDirective,
    CanvasOverlayDirective,
    CanvasPaperDirective,
    CanvasRulerDirective,
    ConfirmDialogComponent,
    DemoDialogComponent,
    DropFilesDialogComponent,
    HotkeysDialogComponent,
    DropTargetDirective,
    LayerListTreeComponent,
    LayerTimelineComponent,
    LayerTimelineGridDirective,
    PlaybackComponent,
    PropertyInputComponent,
    RootComponent,
    ScrollGroupDirective,
    SplashScreenComponent,
    SplitterComponent,
    TimelineAnimationRowComponent,
    ToolbarComponent,
    ToolPanelComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
    StoreModule.forRoot(reducers, { metaReducers }),
    // Angular material components.
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatOptionModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  providers: [{ provide: ErrorHandler, useFactory: errorHandlerFactory }],
  bootstrap: [RootComponent],
})
export class EditorModule {
  constructor(matIconRegistry: MatIconRegistry, private readonly sanitizer: DomSanitizer) {
    matIconRegistry
      // Logo.
      .addSvgIcon('shapeshifter', this.trustUrl('assets/shapeshifter.svg'))
      // Icons.
      .addSvgIcon('addlayer', this.trustUrl('assets/icons/addlayer.svg'))
      .addSvgIcon('autofix', this.trustUrl('assets/icons/autofix.svg'))
      .addSvgIcon('contribute', this.trustUrl('assets/icons/contribute.svg'))
      .addSvgIcon('reverse', this.trustUrl('assets/icons/reverse.svg'))
      .addSvgIcon('animation', this.trustUrl('assets/icons/animation.svg'))
      .addSvgIcon('collection', this.trustUrl('assets/icons/collection.svg'))
      .addSvgIcon('animationblock', this.trustUrl('assets/icons/animationblock.svg'))
      .addSvgIcon('mask', this.trustUrl('assets/icons/clippathlayer.svg'))
      .addSvgIcon('group', this.trustUrl('assets/icons/grouplayer.svg'))
      .addSvgIcon('path', this.trustUrl('assets/icons/pathlayer.svg'))
      .addSvgIcon('vector', this.trustUrl('assets/icons/vectorlayer.svg'))
      // Tools.
      .addSvgIcon('tool_select', this.trustUrl('assets/tools/tool_select.svg'))
      .addSvgIcon('tool_pencil', this.trustUrl('assets/tools/tool_pencil.svg'))
      .addSvgIcon('tool_vector', this.trustUrl('assets/tools/tool_vector.svg'))
      .addSvgIcon('tool_ellipse', this.trustUrl('assets/tools/tool_ellipse.svg'))
      .addSvgIcon('tool_rectangle', this.trustUrl('assets/tools/tool_rectangle.svg'))
      .addSvgIcon('tool_zoompan', this.trustUrl('assets/tools/tool_zoompan.svg'));
  }

  private trustUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
