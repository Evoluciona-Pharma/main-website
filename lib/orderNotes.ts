import type { WizardData } from '@/components/request/RequestWizardContext';

/** Flatten the 4-step request wizard into the order `notes` TEXT field.
 *  The API has no first-class provider/practice fields in v1. */
export function wizardToOrderNotes(data: WizardData): string {
  const lines: string[] = [];
  if (data.message.trim()) lines.push(`Message: ${data.message.trim()}`);
  if (data.hearAbout.trim()) lines.push(`Hear about: ${data.hearAbout.trim()}`);
  lines.push(`Attestation: ${data.attestation ? 'yes' : 'no'}`);
  lines.push('');

  const contact = [data.name, data.role, data.email, data.phone].filter((v) => v.trim()).join(' · ');
  if (contact) lines.push(`Contact: ${contact}`);
  if (data.license.trim() || data.licensedState) {
    lines.push(`License/NPI: ${data.license.trim()}${data.licensedState ? ` (${data.licensedState})` : ''}`);
  }

  const practice = [data.practiceName, data.practiceType].filter((v) => v.trim()).join(' · ');
  if (practice) lines.push(`Practice: ${practice}`);
  const address = [data.address, data.city, data.state, data.zip].filter((v) => v.trim()).join(', ');
  if (address) lines.push(`Address: ${address}`);
  if (data.website.trim()) lines.push(`Website: ${data.website.trim()}`);
  if (data.interests?.length) lines.push(`Interests: ${data.interests.join(', ')}`);

  return lines.join('\n').trim();
}
