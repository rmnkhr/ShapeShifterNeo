import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { ThemeService } from 'app/modules/editor/services/theme.service';
import { Animation } from 'app/modules/editor/model/timeline';
import { SpriteSerializer, SvgSerializer } from 'app/modules/editor/scripts/export';
import { FileExportService } from 'app/modules/editor/services/fileexport.service';
import * as _ from 'lodash';

const LIBRARY_BASE_URL = 'https://vectormotionkit.web.app';
const PREVIEW_FPS = 30;

interface LibraryIcon {
  readonly name: string;
  readonly url: string;
  // Populated once the .shapeshifter file has been fetched and parsed.
  vectorLayer?: VectorLayer;
  animation?: Animation;
  staticSvg?: SafeHtml;
  currentSvg?: SafeHtml;
  // Hover animation state.
  frames?: SafeHtml[];
  frameIndex?: number;
  timerId?: number;
  loadFailed?: boolean;
}

/**
 * A small popup that lists the animated icons published on
 * vectormotionkit.web.app. Hovering an icon previews its animation;
 * clicking it loads the icon into the workspace.
 */
@Component({
  standalone: false,
  selector: 'app-iconlibrarydialog',
  templateUrl: './iconlibrarydialog.component.html',
  styleUrls: ['./iconlibrarydialog.component.scss'],
})
export class IconLibraryDialogComponent implements OnInit, OnDestroy {
  icons: LibraryIcon[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    readonly dialogRef: MatDialogRef<IconLibraryDialogComponent, LibraryIcon>,
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly themeService: ThemeService,
  ) {}

  ngOnInit() {
    this.http
      .get<Array<{ file: string; name: string }>>(`${LIBRARY_BASE_URL}/samples/icons.json`)
      .subscribe({
        next: infos => {
          this.icons = infos.map(({ file, name }) => ({ name, url: LIBRARY_BASE_URL + file }));
          this.isLoading = false;
          this.icons.forEach(icon => this.loadIcon(icon));
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = `Couldn't load the icon library. Check your connection and try again.`;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  ngOnDestroy() {
    this.icons.forEach(icon => this.stopPreview(icon));
  }

  onIconClick(icon: LibraryIcon) {
    if (icon.loadFailed) {
      return;
    }
    // The workspace loads the icon by URL, so clicking works even while the
    // preview is still being fetched.
    this.dialogRef.close(icon);
  }

  startPreview(icon: LibraryIcon) {
    if (!icon.vectorLayer || !icon.animation || icon.timerId !== undefined) {
      return;
    }
    if (!icon.frames) {
      const numSteps = _.clamp(
        Math.round((icon.animation.duration / 1000) * PREVIEW_FPS),
        5,
        90,
      );
      icon.frames = SpriteSerializer.createSvgFrames(
        icon.vectorLayer,
        icon.animation,
        numSteps,
      ).map(svg => this.sanitizer.bypassSecurityTrustHtml(svg));
    }
    icon.frameIndex = 0;
    const intervalMillis = icon.animation.duration / icon.frames.length;
    icon.timerId = window.setInterval(() => {
      icon.frameIndex = (icon.frameIndex + 1) % icon.frames.length;
      icon.currentSvg = icon.frames[icon.frameIndex];
      this.changeDetectorRef.markForCheck();
    }, Math.max(intervalMillis, 1000 / 60));
  }

  stopPreview(icon: LibraryIcon) {
    if (icon.timerId !== undefined) {
      window.clearInterval(icon.timerId);
      icon.timerId = undefined;
    }
    icon.currentSvg = icon.staticSvg;
  }

  trackByFn(index: number, icon: LibraryIcon) {
    return icon.url;
  }

  private loadIcon(icon: LibraryIcon) {
    this.http.get(icon.url).subscribe({
      next: jsonObj => {
        try {
          const { vectorLayer, animation } = FileExportService.fromJSON(jsonObj);
          // Previews are recolored to a single theme-dependent color so the
          // whole library reads uniformly in both light and dark themes.
          const previewColor =
            this.themeService.getThemeType().themeType === 'dark' ? '#F4F4F5' : '#1A1B1E';
          icon.vectorLayer = LayerUtil.recolorVectorLayerPaints(vectorLayer, previewColor);
          icon.animation = animation;
          icon.staticSvg = this.sanitizer.bypassSecurityTrustHtml(
            SvgSerializer.toSvgString(icon.vectorLayer),
          );
          icon.currentSvg = icon.staticSvg;
        } catch (e) {
          icon.loadFailed = true;
        }
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        icon.loadFailed = true;
        this.changeDetectorRef.markForCheck();
      },
    });
  }
}
