import { NeoShapeShifterPage } from './app.po';

describe('NeoShapeShifter App', function() {
  let page: NeoShapeShifterPage;

  beforeEach(() => {
    page = new NeoShapeShifterPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(true).toEqual(true);
  });
});
