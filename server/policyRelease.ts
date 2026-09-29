import { createHash } from 'node:crypto';
import { legalPages, legalUpdated } from '../src/content/legal.js';

// Final legal review and rollout checks must precede activation.
export const policyRelease = {
  version: `${legalUpdated}-draft-1`,
  active: false,
  minimumAge: 18,
  documents: legalPages,
};
export const policyDigest = createHash('sha256').update(JSON.stringify(policyRelease)).digest('hex');
