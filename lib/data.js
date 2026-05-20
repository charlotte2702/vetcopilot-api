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
  { id: 1, t: '08:30', nm: 'Rex',   own: 'M. Dupont',    rsn: 'Contrôle diabète',         av: 'dog',    st: 'ok',   vet: 'Dr. Martin', dur: 30 },
  { id: 2, t: '09:15', nm: 'Mina',  own: 'Mme Bernard',  rsn: 'Vaccination leucose',      av: 'cat',    st: 'ok',   vet: 'Dr. Martin', dur: 20 },
  { id: 3, t: '10:00', nm: 'Coco',  own: 'M. Lefevre',   rsn: 'Contrôle respiratoire',    av: 'bird',   st: 'wait', vet: 'Dr. Martin', dur: 30 },
  { id: 4, t: '10:45', nm: 'Nuage', own: 'Mme Moreau',   rsn: 'Vérification dentaire',    av: 'rabbit', st: 'ok',   vet: 'Dr. Martin', dur: 20 },
  { id: 5, t: '11:30', nm: 'Luna',  own: 'M. Garcia',    rsn: 'Bilan thyroïdien',         av: 'cat',    st: 'urg',  vet: 'Dr. Martin', dur: 45 },
  { id: 6, t: '14:00', nm: 'Rocky', own: 'Mme Laurent',  rsn: 'Suivi post-op tumeur',     av: 'dog',    st: 'ok',   vet: 'Dr. Durand', dur: 30 },
  { id: 7, t: '14:45', nm: 'Bella', own: 'M. Petit',     rsn: 'Contrôle arthrose',        av: 'dog',    st: 'wait', vet: 'Dr. Durand', dur: 30 },
  { id: 8, t: '15:30', nm: 'Simba', own: 'Mme Dubois',   rsn: 'Suivi cystite',            av: 'cat',    st: 'ok',   vet: 'Dr. Martin', dur: 30 },
  { id: 9, t: '16:15', nm: 'Rex',   own: 'M. Dupont',    rsn: 'Échographie abdominale',   av: 'dog',    st: 'urg',  vet: 'Dr. Martin', dur: 60 },
];

const NOTIFS = [
  { id: 1, type: 'urg',  title: 'Urgence — Luna',         text: 'Bilan thyroïdien anormal, consultation prioritaire',  time: 'Il y a 15 min', unread: true },
  { id: 2, type: 'apt',  title: 'Prochain RDV dans 30 min', text: 'Rex — Contrôle diabète à 09:30',                    time: 'Il y a 25 min', unread: true },
  { id: 3, type: 'cr',   title: 'CR à rédiger',            text: 'Compte rendu de Luna — Bilan thyroïdien en attente',  time: 'Il y a 1h',     unread: true },
  { id: 4, type: 'cr',   title: 'CR validé',               text: 'Compte rendu de Nuage validé par Dr. Durand',         time: 'Il y a 2h',     unread: false },
  { id: 5, type: 'vacc', title: 'Rappel vaccination',      text: 'Leptospirose de Rex prévue le 20/06',                 time: 'Hier',          unread: false },
  { id: 6, type: 'pay',  title: 'Paiement reçu',           text: 'Facture #2026-087 — Mme Bernard — 85,00 €',           time: 'Hier',          unread: false },
];

const INVOICES = [
  { id: '2026-087', client: 'Mme Bernard',  animal: 'Mina',  date: '12/05/2026', total: 85,     status: 'paid' },
  { id: '2026-086', client: 'M. Dupont',    animal: 'Rex',   date: '11/05/2026', total: 156.50, status: 'paid' },
  { id: '2026-085', client: 'Mme Laurent',  animal: 'Rocky', date: '10/05/2026', total: 320,    status: 'pending' },
  { id: '2026-084', client: 'M. Garcia',    animal: 'Luna',  date: '09/05/2026', total: 95,     status: 'paid' },
  { id: '2026-083', client: 'Mme Moreau',   animal: 'Nuage', date: '08/05/2026', total: 65,     status: 'overdue' },
];

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
