// Fonts the director may choose per video (installed @fontsource packages only – no new npm packages).
// Keep in sync with FONTS in worker/editz_director.py (the validator rejects anything else).
import '@fontsource-variable/inter/opsz.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/800.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/800.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/800.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/league-spartan/700.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/800.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/600-italic.css';
import '@fontsource/caveat/600.css';
import '@fontsource/permanent-marker/400.css';

/** name → CSS family stack. Condensed faces are marked so text width estimates (Python) stay honest. */
export const FONTS: Record<string, string> = {
  'Inter': "'Inter Variable', Inter, sans-serif",
  'Inter Tight': "'Inter Tight', sans-serif",
  'DM Sans': "'DM Sans', sans-serif",
  'Space Grotesk': "'Space Grotesk', sans-serif",
  'Figtree': "'Figtree', sans-serif",
  'Outfit': "'Outfit', sans-serif",
  'Montserrat': "'Montserrat', sans-serif",
  'Poppins': "'Poppins', sans-serif",
  'Archivo Black': "'Archivo Black', sans-serif",
  'Anton': "'Anton', sans-serif",
  'Bebas Neue': "'Bebas Neue', sans-serif",
  'Oswald': "'Oswald', sans-serif",
  'League Spartan': "'League Spartan', sans-serif",
  'Barlow': "'Barlow', sans-serif",
  'Instrument Serif': "'Instrument Serif', serif",
  'Playfair Display': "'Playfair Display', serif",
  'DM Serif Display': "'DM Serif Display', serif",
  'Fraunces': "'Fraunces', serif",
  'Caveat': "'Caveat', cursive",
  'Permanent Marker': "'Permanent Marker', cursive",
};

export const fontOf = (name: string | undefined, fallback: string) => (name && FONTS[name]) || fallback;
