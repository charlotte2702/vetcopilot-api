// Mock data mirroring the prototype (~/vetcopilot-pwa/index.html).
// Keep field names identical so the frontend can drop in fetch() calls
// without touching its rendering code.

const ANIMALS = [
  { id: 1, nm: 'Rex', sp: 'Chien', breed: 'Labrador', age: '5 ans', sex: 'M', wt: '32 kg', owner: 'M. Dupont', phone: '06 12 34 56 78', email: 'dupont@email.fr', av: 'dog',
    allergy: ['Pénicilline'],
    vacc: [{ nm: 'Rage', dt: '12/03/2026', st: 'ok' }, { nm: 'CHPL', dt: '15/01/2026', st: 'ok' }, { nm: 'Leptospirose', dt: '20/06/2026', st: 'soon' }, { nm: 'Toux du chenil', dt: '01/12/2025', st: 'late' }],
    wts: [{ m: 'Jan', v: 30 }, { m: 'Fév', v: 30.5 }, { m: 'Mar', v: 31 }, { m: 'Avr', v: 31.8 }, { m: 'Mai', v: 32 }],
    hist: [{ t: 'Gastro-entérite', d: 'Mars 2025', type: 'consultation' }, { t: 'Otite externe', d: 'Sept 2024', type: 'consultation' }, { t: 'Stérilisation', d: 'Juin 2023', type: 'surgery' }],
    chip: '250269810012345' },
  { id: 2, nm: 'Mina', sp: 'Chat', breed: 'Persan', age: '3 ans', sex: 'F', wt: '4.2 kg', owner: 'Mme Bernard', phone: '06 98 76 54 32', email: 'bernard@email.fr', av: 'cat',
    allergy: [],
    vacc: [{ nm: 'Typhus', dt: '10/02/2026', st: 'ok' }, { nm: 'Coryza', dt: '10/02/2026', st: 'ok' }, { nm: 'Leucose', dt: '15/08/2026', st: 'soon' }],
    wts: [{ m: 'Jan', v: 4.0 }, { m: 'Fév', v: 4.0 }, { m: 'Mar', v: 4.1 }, { m: 'Avr', v: 4.1 }, { m: 'Mai', v: 4.2 }],
    hist: [{ t: 'Conjonctivite', d: 'Janv 2026', type: 'consultation' }, { t: 'Détartrage', d: 'Nov 2025', type: 'surgery' }] },
  { id: 3, nm: 'Coco', sp: 'Perroquet', breed: 'Ara bleu', age: '12 ans', sex: 'M', wt: '1.1 kg', owner: 'M. Lefevre', phone: '06 45 67 89 01', email: 'lefevre@email.fr', av: 'bird',
    allergy: ['Aspirine'],
    vacc: [{ nm: 'Polyomavirus', dt: '05/04/2026', st: 'ok' }],
    wts: [{ m: 'Jan', v: 1.05 }, { m: 'Fév', v: 1.08 }, { m: 'Mar', v: 1.1 }, { m: 'Avr', v: 1.1 }, { m: 'Mai', v: 1.1 }],
    hist: [{ t: 'Infection respiratoire', d: 'Déc 2025', type: 'emergency' }, { t: 'Contrôle annuel', d: 'Mai 2025', type: 'consultation' }] },
  { id: 4, nm: 'Nuage', sp: 'Lapin', breed: 'Bélier nain', age: '2 ans', sex: 'F', wt: '1.8 kg', owner: 'Mme Moreau', phone: '06 23 45 67 89', email: 'moreau@email.fr', av: 'rabbit',
    allergy: [],
    vacc: [{ nm: 'Myxomatose', dt: '01/03/2026', st: 'ok' }, { nm: 'VHD', dt: '01/03/2026', st: 'ok' }, { nm: 'VHD rappel', dt: '01/09/2026', st: 'soon' }],
    wts: [{ m: 'Jan', v: 1.7 }, { m: 'Fév', v: 1.75 }, { m: 'Mar', v: 1.8 }, { m: 'Avr', v: 1.8 }, { m: 'Mai', v: 1.8 }],
    hist: [{ t: 'Malocclusion dentaire', d: 'Fév 2026', type: 'consultation' }, { t: 'Stérilisation', d: 'Oct 2025', type: 'surgery' }] },
  { id: 5, nm: 'Luna', sp: 'Chat', breed: 'Siamois', age: '7 ans', sex: 'F', wt: '3.8 kg', owner: 'M. Garcia', phone: '06 34 56 78 90', email: 'garcia@email.fr', av: 'cat',
    allergy: ['Lactose'],
    vacc: [{ nm: 'Typhus', dt: '20/01/2026', st: 'ok' }, { nm: 'Coryza', dt: '20/01/2026', st: 'ok' }],
    wts: [{ m: 'Jan', v: 3.9 }, { m: 'Fév', v: 3.85 }, { m: 'Mar', v: 3.8 }, { m: 'Avr', v: 3.8 }, { m: 'Mai', v: 3.8 }],
    hist: [{ t: 'Hyperthyroïdie (suivi)', d: 'Mensuel', type: 'follow-up' }, { t: 'Extraction dentaire', d: 'Août 2025', type: 'surgery' }] },
  { id: 6, nm: 'Rocky', sp: 'Chien', breed: 'Boxer', age: '4 ans', sex: 'M', wt: '28 kg', owner: 'Mme Laurent', phone: '06 56 78 90 12', email: 'laurent@email.fr', av: 'dog',
    allergy: [],
    vacc: [{ nm: 'Rage', dt: '15/02/2026', st: 'ok' }, { nm: 'CHPL', dt: '15/02/2026', st: 'ok' }],
    wts: [{ m: 'Jan', v: 27 }, { m: 'Fév', v: 27.5 }, { m: 'Mar', v: 28 }, { m: 'Avr', v: 28 }, { m: 'Mai', v: 28 }],
    hist: [{ t: 'Tumeur cutanée', d: 'Avr 2026', type: 'surgery' }, { t: 'Luxation rotule', d: 'Sept 2025', type: 'emergency' }] },
  { id: 7, nm: 'Bella', sp: 'Chien', breed: 'Golden Retriever', age: '8 ans', sex: 'F', wt: '29 kg', owner: 'M. Petit', phone: '06 67 89 01 23', email: 'petit@email.fr', av: 'dog',
    allergy: ['Ibuprofène'],
    vacc: [{ nm: 'Rage', dt: '05/01/2026', st: 'ok' }, { nm: 'CHPL', dt: '05/01/2026', st: 'ok' }, { nm: 'Piroplasmose', dt: '01/07/2026', st: 'soon' }],
    wts: [{ m: 'Jan', v: 28.5 }, { m: 'Fév', v: 29 }, { m: 'Mar', v: 29 }, { m: 'Avr', v: 29 }, { m: 'Mai', v: 29 }],
    hist: [{ t: 'Arthrose (suivi)', d: 'Trimestriel', type: 'follow-up' }, { t: 'Mammectomie', d: 'Mars 2025', type: 'surgery' }] },
  { id: 8, nm: 'Simba', sp: 'Chat', breed: 'Maine Coon', age: '4 ans', sex: 'M', wt: '7.2 kg', owner: 'Mme Dubois', phone: '06 78 90 12 34', email: 'dubois@email.fr', av: 'cat',
    allergy: [],
    vacc: [{ nm: 'Typhus', dt: '15/03/2026', st: 'ok' }, { nm: 'Coryza', dt: '15/03/2026', st: 'ok' }, { nm: 'FeLV', dt: '15/03/2026', st: 'ok' }],
    wts: [{ m: 'Jan', v: 7.0 }, { m: 'Fév', v: 7.1 }, { m: 'Mar', v: 7.1 }, { m: 'Avr', v: 7.2 }, { m: 'Mai', v: 7.2 }],
    hist: [{ t: 'Cystite', d: 'Janv 2026', type: 'emergency' }, { t: 'Vaccination annuelle', d: 'Mars 2026', type: 'vaccination' }] },
];

const APTS = [
  { id: 1, t: '08:30', nm: 'Rex',   own: 'M. Dupont',    rsn: 'Contrôle diabète',         av: 'dog',    st: 'ok',   vet: 'Dr. Patrick Hayot', dur: 30 },
  { id: 2, t: '09:15', nm: 'Mina',  own: 'Mme Bernard',  rsn: 'Vaccination leucose',      av: 'cat',    st: 'ok',   vet: 'Dr. Patrick Hayot', dur: 20 },
  { id: 3, t: '10:00', nm: 'Coco',  own: 'M. Lefevre',   rsn: 'Contrôle respiratoire',    av: 'bird',   st: 'wait', vet: 'Dr. Patrick Hayot', dur: 30 },
  { id: 4, t: '10:45', nm: 'Nuage', own: 'Mme Moreau',   rsn: 'Vérification dentaire',    av: 'rabbit', st: 'ok',   vet: 'Dr. Patrick Hayot', dur: 20 },
  { id: 5, t: '11:30', nm: 'Luna',  own: 'M. Garcia',    rsn: 'Bilan thyroïdien',         av: 'cat',    st: 'urg',  vet: 'Dr. Patrick Hayot', dur: 45 },
  { id: 6, t: '14:00', nm: 'Rocky', own: 'Mme Laurent',  rsn: 'Suivi post-op tumeur',     av: 'dog',    st: 'ok',   vet: 'Dr. Arnaud Vergnangeal', dur: 30 },
  { id: 7, t: '14:45', nm: 'Bella', own: 'M. Petit',     rsn: 'Contrôle arthrose',        av: 'dog',    st: 'wait', vet: 'Dr. Arnaud Vergnangeal', dur: 30 },
  { id: 8, t: '15:30', nm: 'Simba', own: 'Mme Dubois',   rsn: 'Suivi cystite',            av: 'cat',    st: 'ok',   vet: 'Dr. Patrick Hayot', dur: 30 },
  { id: 9, t: '16:15', nm: 'Rex',   own: 'M. Dupont',    rsn: 'Échographie abdominale',   av: 'dog',    st: 'urg',  vet: 'Dr. Patrick Hayot', dur: 60 },
];

const NOTIFS = [
  { id: 1, type: 'urg',  title: 'Urgence — Luna',         text: 'Bilan thyroïdien anormal, consultation prioritaire',  time: 'Il y a 15 min', unread: true },
  { id: 2, type: 'apt',  title: 'Prochain RDV dans 30 min', text: 'Rex — Contrôle diabète à 09:30',                    time: 'Il y a 25 min', unread: true },
  { id: 3, type: 'cr',   title: 'CR à rédiger',            text: 'Compte rendu de Luna — Bilan thyroïdien en attente',  time: 'Il y a 1h',     unread: true },
  { id: 4, type: 'cr',   title: 'CR validé',               text: 'Compte rendu de Nuage validé par Dr. Vergnangeal',         time: 'Il y a 2h',     unread: false },
  { id: 5, type: 'vacc', title: 'Rappel vaccination',      text: 'Leptospirose de Rex prévue le 20/06',                 time: 'Hier',          unread: false },
  { id: 6, type: 'pay',  title: 'Paiement reçu',           text: 'Facture #2026-087 — Mme Bernard — 85,00 €',           time: 'Hier',          unread: false },
];

// Helper to compute total from acts
const _sum = (acts) => acts.reduce((s, a) => s + (a.qty || 1) * a.price, 0);

// 18 invoices for May 2026. Dates are ISO YYYY-MM-DD for easy filtering;
// the UI formats them for display. Acts are itemized so the PDF can show
// a real invoice line table.
const INVOICES = ((() => {
  const mk = (id, date, animal, client, animalId, status, actes, vet = 'Dr. Patrick Hayot') => ({
    id, date, animal, client, animalId, status, actes, total: _sum(actes), vet,
  });
  return [
    // Today (2026-05-25)
    mk('2026-105', '2026-05-25', 'Rex',   'M. Dupont',   1, 'pending', [
      { nm: 'Consultation générale', qty: 1, price: 45 },
      { nm: 'Vaccination CHPL',      qty: 1, price: 55 },
    ]),
    mk('2026-104', '2026-05-25', 'Mina',  'Mme Bernard', 2, 'pending', [
      { nm: 'Consultation générale', qty: 1, price: 45 },
      { nm: 'Bilan sanguin',         qty: 1, price: 65 },
      { nm: 'Injection antibiotique', qty: 1, price: 25 },
    ]),
    mk('2026-103', '2026-05-25', 'Luna',  'M. Garcia',   5, 'paid', [
      { nm: 'Consultation de suivi', qty: 1, price: 35 },
      { nm: 'Bilan thyroïdien',      qty: 1, price: 95 },
    ]),
    // Yesterday (2026-05-24) — this week
    mk('2026-102', '2026-05-24', 'Bella', 'M. Petit',    7, 'paid', [
      { nm: 'Consultation gériatrique', qty: 1, price: 55 },
      { nm: 'Radio (membre antérieur)', qty: 1, price: 80 },
    ]),
    mk('2026-101', '2026-05-24', 'Rocky', 'Mme Laurent', 6, 'pending', [
      { nm: 'Consultation post-op',  qty: 1, price: 45 },
      { nm: 'Pansement chirurgical', qty: 2, price: 18 },
    ]),
    mk('2026-100', '2026-05-23', 'Simba', 'Mme Dubois',  8, 'paid', [
      { nm: 'Consultation',  qty: 1, price: 45 },
      { nm: 'Analyse urinaire (cystite)', qty: 1, price: 40 },
      { nm: 'Antibiotiques', qty: 1, price: 28 },
    ], 'Dr. Arnaud Vergnangeal'),
    // Earlier this week
    mk('2026-099', '2026-05-22', 'Coco',  'M. Lefevre',  3, 'paid', [
      { nm: 'Consultation aviaire',  qty: 1, price: 65 },
      { nm: 'Examen respiratoire',   qty: 1, price: 35 },
    ]),
    mk('2026-098', '2026-05-21', 'Nuage', 'Mme Moreau',  4, 'paid', [
      { nm: 'Consultation NAC',      qty: 1, price: 55 },
      { nm: 'Détartrage',            qty: 1, price: 120 },
    ], 'Dr. Arnaud Vergnangeal'),
    mk('2026-097', '2026-05-20', 'Rex',   'M. Dupont',   1, 'paid', [
      { nm: 'Échographie abdominale', qty: 1, price: 110 },
      { nm: 'Consultation',           qty: 1, price: 45 },
    ]),
    // Last week
    mk('2026-096', '2026-05-18', 'Mina',  'Mme Bernard', 2, 'paid', [
      { nm: 'Détartrage',            qty: 1, price: 120 },
      { nm: 'Anesthésie',            qty: 1, price: 85 },
      { nm: 'Consultation',          qty: 1, price: 45 },
    ]),
    mk('2026-095', '2026-05-16', 'Bella', 'M. Petit',    7, 'pending', [
      { nm: 'Consultation arthrose', qty: 1, price: 45 },
      { nm: 'Infiltration',          qty: 1, price: 90 },
    ]),
    mk('2026-094', '2026-05-15', 'Rocky', 'Mme Laurent', 6, 'paid', [
      { nm: 'Chirurgie (exérèse tumeur cutanée)', qty: 1, price: 250 },
      { nm: 'Anesthésie générale',  qty: 1, price: 85 },
      { nm: 'Soins post-opératoires', qty: 1, price: 45 },
    ], 'Dr. Arnaud Vergnangeal'),
    mk('2026-093', '2026-05-14', 'Luna',  'M. Garcia',   5, 'paid', [
      { nm: 'Consultation hyperthyroïdie', qty: 1, price: 45 },
      { nm: 'Bilan sanguin complet',       qty: 1, price: 75 },
    ]),
    mk('2026-092', '2026-05-13', 'Simba', 'Mme Dubois',  8, 'pending', [
      { nm: 'Consultation',           qty: 1, price: 45 },
      { nm: 'Vaccination FeLV',       qty: 1, price: 45 },
    ]),
    // Earlier in May — some overdue (>10 days unpaid)
    mk('2026-091', '2026-05-10', 'Coco',  'M. Lefevre',  3, 'overdue', [
      { nm: 'Hospitalisation 24h',    qty: 1, price: 180 },
      { nm: 'Consultation urgence',   qty: 1, price: 75 },
    ]),
    mk('2026-090', '2026-05-08', 'Nuage', 'Mme Moreau',  4, 'overdue', [
      { nm: 'Consultation dentaire',  qty: 1, price: 55 },
      { nm: 'Limage dentaire',        qty: 1, price: 85 },
    ], 'Dr. Arnaud Vergnangeal'),
    mk('2026-089', '2026-05-06', 'Rex',   'M. Dupont',   1, 'paid', [
      { nm: 'Consultation contrôle diabète', qty: 1, price: 45 },
      { nm: 'Glycémie',                       qty: 1, price: 20 },
    ]),
    mk('2026-088', '2026-05-03', 'Mina',  'Mme Bernard', 2, 'paid', [
      { nm: 'Consultation conjonctivite',     qty: 1, price: 45 },
      { nm: 'Collyre antibiotique',           qty: 1, price: 18 },
    ]),
  ];
})());

const DIAG_RESULTS = {
  urgency: 'moderee',
  urgencyLabel: 'MODÉRÉE',
  hypotheses: [
    { nm: 'Douleur chronique liée à une affection ostéo-articulaire (suite boiterie antérieure gauche)', prob: 55, lv: 'hi',
      desc: "La boiterie antérieure gauche préexistante peut s'être aggravée ou évoluer vers une pathologie douloureuse chronique (rupture partielle du ligament croisé, OCD, dysplasie) entraînant une anorexie réactionnelle à la douleur.",
      exams: [
        'Examen clinique complet avec prise de température, palpation abdominale et évaluation de la douleur',
        'Bilan sanguin complet : NFS, biochimie (ALAT, PAL, lipase, créatinine, urée)',
        'Radiographies abdominales et thoraciques de face et profil',
        'Radiographies du membre antérieur gauche pour évaluation ostéo-articulaire',
        'Échographie abdominale si anomalie détectée sur la radiographie ou la biochimie',
        'Sérologies infectieuses selon contexte épidémiologique (leptospirose, ehrlichiose)',
      ] },
    { nm: 'Affection gastro-intestinale (gastrite, corps étranger, pancréatite)', prob: 50, lv: 'md',
      desc: "Le Golden Retriever est une race prédisposée aux ingestions de corps étrangers et à la pancréatite. L'anorexie isolée sans autre symptôme rapporté peut orienter vers une atteinte digestive débutante.",
      exams: [
        'Examen clinique complet avec palpation abdominale approfondie',
        'Bilan sanguin complet : NFS, biochimie incluant lipase spécifique canine (Spec cPL)',
        'Radiographies abdominales de face et profil',
        'Échographie abdominale',
        'Test SNAP cPL si suspicion de pancréatite',
      ] },
    { nm: 'Affection infectieuse ou inflammatoire systémique', prob: 30, lv: 'lo',
      desc: "Une infection bactérienne, virale ou une réaction inflammatoire (leptospirose, ehrlichiose selon contexte géographique) peut provoquer une anorexie comme signe avant-coureur avant l'apparition d'autres signes cliniques.",
      exams: [
        'Examen clinique complet avec prise de température',
        'Bilan sanguin complet : NFS, biochimie, CRP',
        'Analyse urinaire complète',
        'Sérologies infectieuses : leptospirose, ehrlichiose, anaplasmose',
        'Radiographies thoraciques si hyperthermie',
      ] },
  ],
};

module.exports = { ANIMALS, APTS, NOTIFS, INVOICES, DIAG_RESULTS };
