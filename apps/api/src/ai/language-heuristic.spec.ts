import { detectConfidentLanguage } from './language-heuristic';

describe('detectConfidentLanguage', () => {
  it.each([
    ['Yardım edin', 'tr'],
    ['Çöken bina, iki kişi mahsur kaldı', 'tr'],
    ['yardim edin lutfen', 'tr'],
    ['Enkaz altındayız', 'tr'],
    ['Please help, people are trapped in the building', 'en'],
    ['We need help, emergency', 'en'],
  ])('is confident for %s', (text, expected) => {
    expect(detectConfidentLanguage(text)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['SOS'],
    ['hello'],
    ['help'],
    ['I have various variables birthday'], // Turkish markers only as substrings must not count
    ['Hilfe, wir sind eingeschlossen'],
    ['Nous avons besoin d\'aide, très urgent'],
    ['النجدة'],
    ['yardim'], // a single marker is not enough
  ])('stays unknown for %p', (text) => {
    expect(detectConfidentLanguage(text)).toBe('unknown');
  });

  it('never calls English when Turkish evidence is present', () => {
    expect(detectConfidentLanguage('please help yardim edin')).toBe('tr');
  });
});
