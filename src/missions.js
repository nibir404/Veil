// The ten operations. Mission 01 is playable in this slice; the rest are fully specified in
// docs/MISSIONS.md and surface here as archive records (which begin to contradict themselves).
export const MISSIONS = [
  { id: '01', title: 'THE CITY THAT NEVER SLEEPS', loc: 'DHAKA', theme: 'PARANOIA', playable: true,
    brief: 'Eliminate the intelligence broker known as THE CARTOGRAPHER. Old Dhaka, monsoon night. He trades in people\'s locations. He seems to already know yours.' },
  { id: '02', title: 'THE PORT', loc: 'CHATTOGRAM', theme: 'CONSPIRACY',
    brief: 'Intercept a weapons shipment at the container terminal. The containers hold no weapons — only biometric identity records. One of them is yours.' },
  { id: '03', title: 'THE GHOST FARM', loc: 'RAJSHAHI', theme: 'IDENTITY',
    brief: 'Locate a missing PROJECT JANUS scientist among the mango orchards. The villagers say you have been here before.' },
  { id: '04', title: 'THE DEAD WATER', loc: 'KHULNA · SUNDARBANS', theme: 'ISOLATION',
    brief: 'Track a rogue operative through the mangroves by boat. Your radio will begin transmitting your own voice.' },
  { id: '05', title: 'THE HOUSE OF RAIN', loc: 'SYLHET', theme: 'MEMORY',
    brief: 'Eliminate a former intelligence officer at a tea-estate mansion. He will not fight. He will show you footage of yourself, dated months ago.' },
  { id: '06', title: 'THE EMPTY VILLAGE', loc: 'RANGPUR', theme: 'ABSENCE',
    brief: 'A village where fans turn, food is warm and radios play — and nobody lives. A conditioning site. You may have been a subject.' },
  { id: '07', title: 'THE MEMORY ROOM', loc: 'MYMENSINGH', theme: 'CONDITIONING',
    brief: 'An underground archive of hundreds of rooms, each holding a person\'s memories. One of them holds yours. They do not match.' },
  { id: '08', title: 'THE LAST BOAT', loc: 'BARISHAL', theme: 'ESCAPE',
    brief: 'Extraction by launch out of the country. Passengers disappear. The boat is not carrying people. It is carrying identities.' },
  { id: '09', title: 'THE DUPLICATE', loc: 'CUMILLA', theme: 'DUALITY',
    brief: 'Another operative. Same face, same voice, same scars, same memories. He says you are the copy.' },
  { id: '10', title: 'THE VEIL', loc: 'DHAKA', theme: 'REALITY',
    brief: 'Return to a Dhaka that remembers you differently. PROJECT JANUS. Two chairs. One is empty.' },
];

// After Mission 01 the archive "updates" itself. Records the player never played are marked
// completed, with dates before Raven's recruitment.
export const CORRUPTIONS = {
  '05': 'STATUS: COMPLETED · 11.02.2026 · OPERATIVE: RAVEN',
  '04': 'STATUS: COMPLETED · 03.12.2025 · OPERATIVE: RAVEN',
  '09': 'STATUS: OPERATIVE RAVEN TERMINATED · SEE: RAVEN',
};
