import { describe, expect, it } from 'vitest';
import type { WizardData } from '@/components/request/RequestWizardContext';
import { wizardToOrderNotes } from './orderNotes';

const base: WizardData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  license: '',
  licensedState: '',
  practiceName: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  practiceType: '',
  interests: null,
  message: '',
  hearAbout: '',
  attestation: false,
};

describe('wizardToOrderNotes', () => {
  it('always records attestation and skips empty optional fields', () => {
    expect(wizardToOrderNotes(base)).toBe('Attestation: no');
  });

  it('flattens wizard fields into a readable notes dump', () => {
    const notes = wizardToOrderNotes({
      ...base,
      name: 'Dr. Rivera',
      role: 'MD',
      email: 'dr@clinic.test',
      phone: '555-0100',
      license: 'NPI-123',
      licensedState: 'TX',
      practiceName: 'Rivera Clinic',
      practiceType: 'Med spa',
      address: '1 Main',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      website: 'https://clinic.test',
      interests: ['NAD+', 'MOTS-C'],
      message: 'Need volume pricing',
      hearAbout: 'Colleague referral',
      attestation: true,
    });

    expect(notes).toContain('Message: Need volume pricing');
    expect(notes).toContain('Hear about: Colleague referral');
    expect(notes).toContain('Attestation: yes');
    expect(notes).toContain('Contact: Dr. Rivera · MD · dr@clinic.test · 555-0100');
    expect(notes).toContain('License/NPI: NPI-123 (TX)');
    expect(notes).toContain('Practice: Rivera Clinic · Med spa');
    expect(notes).toContain('Address: 1 Main, Austin, TX, 78701');
    expect(notes).toContain('Website: https://clinic.test');
    expect(notes).toContain('Interests: NAD+, MOTS-C');
  });
});
