/**
 * AfriXplore Voice Note Transcription
 * Azure AI Speech Services — batch transcription
 * Supports 7 languages: en, fr, sw, ha, pt, af, ar
 */

import axios from 'axios';
import { db } from './db/client';

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  KE: 'sw-KE', TZ: 'sw-KE', UG: 'sw-KE',
  CD: 'fr-FR', CG: 'fr-FR', CI: 'fr-FR', ML: 'fr-FR',
  GH: 'en-US', ZM: 'en-US', ZW: 'en-US',
  NG: 'ha-NG', NE: 'ha-NG',
  AO: 'pt-AO', MZ: 'pt-AO',
  NA: 'af-ZA', ZA: 'af-ZA',
  EG: 'ar-EG', MA: 'ar-EG', DZ: 'ar-EG',
};

export async function runVoiceTranscription(
  reportId: string,
  voiceNoteUrl: string,
  scoutCountry?: string
): Promise<string | null> {
  const speechKey = process.env.AZURE_SPEECH_KEY!;
  const speechRegion = process.env.AZURE_SPEECH_REGION || 'southafricanorth';

  try {
    const locale = scoutCountry
      ? COUNTRY_LANGUAGE_MAP[scoutCountry] || 'en-US'
      : 'en-US';

    const transcriptionResponse = await axios.post(
      `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions`,
      {
        contentUrls: [voiceNoteUrl],
        locale,
        displayName: `AfriXplore Report ${reportId}`,
        properties: {
          wordLevelTimestampsEnabled: false,
          punctuationMode: 'DictatedAndAutomatic',
          profanityFilterMode: 'None',
          maxSpeakerCount: 1,
        },
      },
      {
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const transcriptionId = transcriptionResponse.data.self.split('/').pop();
    let transcript: string | null = null;
    let attempts = 0;

    while (attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      attempts++;

      const statusResponse = await axios.get(
        `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/${transcriptionId}`,
        { headers: { 'Ocp-Apim-Subscription-Key': speechKey } }
      );

      const status = statusResponse.data.status;

      if (status === 'Succeeded') {
        const filesResponse = await axios.get(
          `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/${transcriptionId}/files`,
          { headers: { 'Ocp-Apim-Subscription-Key': speechKey } }
        );

        const transcriptFile = filesResponse.data.values?.find(
          (f: any) => f.kind === 'Transcription'
        );

        if (transcriptFile) {
          const contentResponse = await axios.get(transcriptFile.links.contentUrl);
          const combinedPhrases = contentResponse.data.combinedRecognizedPhrases;
          transcript = combinedPhrases?.[0]?.display || null;
        }
        break;
      } else if (status === 'Failed') {
        console.error(`Transcription failed for report ${reportId}`);
        break;
      }
    }

    if (transcript) {
      await db.query(
        `UPDATE reports SET voice_note_transcript = $1, updated_at = NOW() WHERE id = $2`,
        [transcript, reportId]
      );
      console.log(`Transcribed voice note for ${reportId}: "${transcript.slice(0, 50)}..."`);
    }

    // Cleanup transcription job
    await axios.delete(
      `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/${transcriptionId}`,
      { headers: { 'Ocp-Apim-Subscription-Key': speechKey } }
    ).catch(() => {});

    return transcript;

  } catch (error) {
    console.error(`Voice transcription error for ${reportId}:`, error);
    return null;
  }
}
