import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wrench,
  Sparkles,
  LayoutDashboard,
  PlusCircle,
  Users,
  Search,
  Printer,
  Settings,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  ChevronRight,
  X,
  Check,
  LayoutGrid,
  List,
  Columns,
  Gem,
  Scale,
  Euro,
  UserPlus,
  RefreshCw,
  ArrowLeft,
  Building2,
  Save,
  ShieldCheck,
  Menu
} from 'lucide-react';

// ============================================================================
// COSTANTI, CONFIGURAZIONI E UTILITY PER LE DATE (SENZA BUG DI TIMEZONE)
// ============================================================================

const STORAGE_KEYS = {
  CLIENTS: 'atelier_orafo_clients_v1',
  JOBS: 'atelier_orafo_jobs_v1',
  SETTINGS: 'atelier_orafo_settings_v1',
};

const DEFAULT_SETTINGS = {
  shopName: 'Atelier Orafo & Gioielleria',
  shopSubtitle: 'Laboratorio Artigianale di Oreficeria e Riparazioni',
  shopAddress: 'Via Roma 42, 29121 Piacenza (PC)',
  shopPhone: '+39 0523 000000',
  shopEmail: 'laboratorio@atelierorafo.it',
  shopVat: 'P.IVA 01234567890',
};

const PRODUCT_TYPES = [
  'Anello',
  'Collana',
  'Bracciale',
  'Orecchini',
  'Orologio',
  'Spilla',
  'Ciondolo',
  'Altro',
];

const METAL_OPTIONS = [
  'Oro 750 Giallo',
  'Oro 750 Bianco',
  'Oro 750 Rosa',
  'Oro 375',
  'Platino 950',
  'Argento 925',
  'Acciaio',
  'Altro',
];

const JOB_STATUSES = [
  { id: 'IN_ATTESA_PEZZI', label: 'In Attesa Pezzi', shortLabel: 'Attesa Pezzi', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'IN_LAVORAZIONE', label: 'In Lavorazione', shortLabel: 'In Lavorazione', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'PRONTO_RITIRO', label: 'Pronto per il Ritiro', shortLabel: 'Pronto Ritiro', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'CONSEGNATO', label: 'Consegnato', shortLabel: 'Consegnato', badgeClass: 'bg-slate-200 text-slate-600 border-slate-300' },
];

/**
 * Restituisce la data locale odierna nel formato YYYY-MM-DD senza shift UTC.
 */
function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Somma o sottrae un numero di giorni a una data YYYY-MM-DD in ora locale.
 */
function addDaysISO(baseISO, days) {
  if (!baseISO || !/^\d{4}-\d{2}-\d{2}$/.test(baseISO)) {
    baseISO = getTodayISO();
  }
  const [y, m, d] = baseISO.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const ry = date.getFullYear();
  const rm = String(date.getMonth() + 1).padStart(2, '0');
  const rd = String(date.getDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

/**
 * Calcola la differenza in giorni tra una data target YYYY-MM-DD e oggi (a mezzanotte locale).
 * Negativo = nel passato (in ritardo), 0 = oggi, Positivo = giorni mancanti.
 */
function diffDaysFromToday(targetISO) {
  if (!targetISO || !/^\d{4}-\d{2}-\d{2}$/.test(targetISO)) return 0;
  const todayISO = getTodayISO();
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const [gy, gm, gd] = targetISO.split('-').map(Number);
  const todayMidnight = new Date(ty, tm - 1, td);
  const targetMidnight = new Date(gy, gm - 1, gd);
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formatta YYYY-MM-DD in formato italiano DD/MM/YYYY.
 */
function formatDateIT(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Calcola lo stato semaforico del lavoro in base allo stato e alla data stimata di consegna.
 */
function getSemaphoreInfo(job) {
  if (job.status === 'CONSEGNATO') {
    return {
      key: 'COMPLETED',
      label: 'Consegnato',
      sublabel: job.deliveredAt ? `Ritirato il ${formatDateIT(job.deliveredAt)}` : 'Completato',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      ringClass: 'ring-slate-200',
    };
  }

  const daysLeft = diffDaysFromToday(job.estimatedDeliveryDate);

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      key: 'OVERDUE',
      label: overdueDays === 1 ? 'In ritardo di 1 gg' : `In ritardo di ${overdueDays} gg`,
      sublabel: 'Scadenza superata',
      dotClass: 'bg-red-500 animate-pulse',
      badgeClass: 'bg-red-50 text-red-700 border-red-300 font-semibold',
      ringClass: 'ring-red-200',
    };
  }

  if (daysLeft <= 2) {
    let label = 'Scade tra 2 gg';
    if (daysLeft === 0) label = 'Scade oggi';
    else if (daysLeft === 1) label = 'Scade domani';
    return {
      key: 'DUE_SOON',
      label,
      sublabel: 'In scadenza imminente',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
      ringClass: 'ring-amber-200',
    };
  }

  return {
    key: 'ON_TIME',
    label: `Scade tra ${daysLeft} gg`,
    sublabel: 'In orario',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ringClass: 'ring-emerald-200',
  };
}

/**
 * Genera un codice univoco progressivo per anno e tipologia: es. RIP-2026-001 o CRE-2026-001.
 */
function generateNextJobCode(jobs, serviceType) {
  const year = new Date().getFullYear();
  const prefix = serviceType === 'CREAZIONE' ? 'CRE' : 'RIP';
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxNum = 0;

  jobs.forEach((job) => {
    const match = job.code && job.code.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  return `${prefix}-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Crea un set di dati demo realistici in italiano con tutti gli stati semaforici.
 */
function createDemoData() {
  const today = getTodayISO();
  const year = new Date().getFullYear();

  const clients = [
    {
      id: 'cli-1',
      fullName: 'Elena Visconti',
      phone: '338 4512980',
      fiscalCode: 'VSCLNE84M52G535K',
      address: 'Corso Vittorio Emanuele 18, Piacenza',
      email: 'elena.visconti@email.it',
      createdAt: addDaysISO(today, -30),
    },
    {
      id: 'cli-2',
      fullName: 'Marco Ferretti',
      phone: '347 9081123',
      fiscalCode: 'FRRMRC79C14F205Z',
      address: 'Via Cavour 54, Piacenza',
      email: 'marco.ferretti@studioferretti.it',
      createdAt: addDaysISO(today, -45),
    },
    {
      id: 'cli-3',
      fullName: 'Giulia Conti',
      phone: '329 6610432',
      fiscalCode: 'CNTGLI91D48G535P',
      address: 'Viale Dante Alighieri 102, Piacenza',
      email: 'giulia.conti91@gmail.com',
      createdAt: addDaysISO(today, -12),
    },
    {
      id: 'cli-4',
      fullName: 'Alessandro Moretti',
      phone: '335 7742091',
      fiscalCode: 'MRTLSN75H22A944W',
      address: 'Via XX Settembre 89, Piacenza',
      email: 'a.moretti@outlook.it',
      createdAt: addDaysISO(today, -8),
    },
    {
      id: 'cli-5',
      fullName: 'Chiara Lombardi',
      phone: '340 1198234',
      fiscalCode: 'LMBCHR88T61G535Y',
      address: 'Piazza Cavalli 7, Piacenza',
      email: 'chiara.lombardi@libero.it',
      createdAt: addDaysISO(today, -15),
    },
  ];

  const jobs = [
    {
      id: 'job-1',
      code: `RIP-${year}-001`,
      serviceType: 'RIPARAZIONE',
      clientId: 'cli-1',
      productType: 'Anello',
      weightGrams: '4.85',
      metal: 'Oro 750 Bianco',
      stones: 'Diamante taglio brillante 0.45 ct + 6 diamanti laterali',
      description: 'Ricostruzione di due griffe consumate, serraggio diamante centrale e rodiatura completa con lucidatura a specchio.',
      notes: 'Piccolo graffio visibile sul gambo inferiore al momento del ritiro. Incisione interna "E&L 2018" da preservare.',
      intakeDate: addDaysISO(today, -10),
      estimatedDeliveryDate: addDaysISO(today, -3), // ROSSO (in ritardo)
      estimatedPrice: '140',
      status: 'IN_LAVORAZIONE',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-2',
      code: `CRE-${year}-001`,
      serviceType: 'CREAZIONE',
      clientId: 'cli-2',
      productType: 'Anello',
      weightGrams: '5.20',
      metal: 'Oro 750 Rosa',
      stones: 'Zaffiro Blu Ceylon taglio ovale 1.10 ct',
      description: 'Creazione su misura anello solitario con castone a 4 griffe sottili e gambo a sezione tonda lucida, misura 14 italiana.',
      notes: 'Cliente ha approvato il modello in cera 3D. Preparare astuccio in velluto blu e certificato gemmologico.',
      intakeDate: addDaysISO(today, -14),
      estimatedDeliveryDate: today, // GIALLO (scade oggi)
      estimatedPrice: '1250',
      status: 'IN_LAVORAZIONE',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-3',
      code: `RIP-${year}-002`,
      serviceType: 'RIPARAZIONE',
      clientId: 'cli-3',
      productType: 'Bracciale',
      weightGrams: '11.40',
      metal: 'Oro 750 Giallo',
      stones: 'Nessuna pietra',
      description: 'Saldatura laser maglia spezzata vicino al moschettone e sostituzione molla interna della chiusura.',
      notes: 'Bracciale tipo catena rolò vuota, fare attenzione alla temperatura di saldatura.',
      intakeDate: addDaysISO(today, -4),
      estimatedDeliveryDate: addDaysISO(today, 1), // GIALLO (scade domani)
      estimatedPrice: '65',
      status: 'IN_ATTESA_PEZZI',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-4',
      code: `CRE-${year}-002`,
      serviceType: 'CREAZIONE',
      clientId: 'cli-4',
      productType: 'Collana',
      weightGrams: '6.80',
      metal: 'Platino 950',
      stones: 'Diamante taglio brillante 0.35 ct (F-VVS2)',
      description: 'Realizzazione pendente punto luce scorrevole con castone a cipollina e catenina veneziana 45 cm con anellino riduttore a 42 cm.',
      notes: 'Regalo anniversario: incidere iniziali "A.M." sulla targhetta vicino alla chiusura.',
      intakeDate: addDaysISO(today, -2),
      estimatedDeliveryDate: addDaysISO(today, 12), // VERDE (in orario)
      estimatedPrice: '1480',
      status: 'IN_LAVORAZIONE',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-5',
      code: `RIP-${year}-003`,
      serviceType: 'RIPARAZIONE',
      clientId: 'cli-5',
      productType: 'Orecchini',
      weightGrams: '7.10',
      metal: 'Argento 925',
      stones: 'Perle coltivate d\'acqua dolce 8mm (coppia)',
      description: 'Sostituzione perni piegati con farfalline rinforzate, reincollaggio perla sinistra e bagno di pulitura ultrasuoni.',
      notes: 'Orecchini consegnati senza scatola originale.',
      intakeDate: addDaysISO(today, -3),
      estimatedDeliveryDate: addDaysISO(today, 5), // VERDE (pronto per ritiro)
      estimatedPrice: '45',
      status: 'PRONTO_RITIRO',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-6',
      code: `RIP-${year}-004`,
      serviceType: 'RIPARAZIONE',
      clientId: 'cli-2',
      productType: 'Anello',
      weightGrams: '4.10',
      metal: 'Oro 750 Giallo',
      stones: 'Nessuna pietra',
      description: 'Messa a misura fede nuziale classica da misura 19 a misura 20 e lucidatura finale.',
      notes: 'Rinfrescata incisione interna con data matrimonio.',
      intakeDate: addDaysISO(today, -15),
      estimatedDeliveryDate: addDaysISO(today, -6),
      deliveredAt: addDaysISO(today, -6),
      estimatedPrice: '40',
      status: 'CONSEGNATO', // GRIGIO (consegnato)
      createdAt: new Date().toISOString(),
    },
  ];

  return { clients, jobs };
}

// ============================================================================
// COMPONENTE PRINCIPALE APP
// ============================================================================

export default function App() {
  // Stato principale con inizializzazione sicura da LocalStorage
  const [clients, setClients] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Errore lettura clienti da LocalStorage:', e);
    }
    return createDemoData().clients;
  });

  const [jobs, setJobs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Errore lettura lavori da LocalStorage:', e);
    }
    return createDemoData().jobs;
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Errore lettura impostazioni:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Navigazione e stato UI
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'new-job' | 'clients'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Stato Dashboard
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' | 'kanban'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'RIPARAZIONE' | 'CREAZIONE' | 'OVERDUE' | 'DUE_SOON' | 'CONSEGNATO'

  // Pre-compilazione cliente per "Nuova Scheda per questo Cliente"
  const [preselectedClientForNewJob, setPreselectedClientForNewJob] = useState(null);

  // Modali attive
  const [receiptJobId, setReceiptJobId] = useState(null);
  const [detailJobId, setDetailJobId] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Toast notifiche
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Salvataggio automatico su LocalStorage a ogni modifica
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    } catch (e) {
      console.error('Errore salvataggio clienti:', e);
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    } catch (e) {
      console.error('Errore salvataggio lavori:', e);
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Errore salvataggio impostazioni:', e);
    }
  }, [settings]);

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Mappa rapida clienti per ID
  const clientsById = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [clients]);

  // Lavori arricchiti con dati cliente aggiornati e stato semaforico
  const enrichedJobs = useMemo(() => {
    return jobs.map((job) => {
      const client = clientsById[job.clientId] || {
        id: job.clientId,
        fullName: job.clientNameFallback || 'Cliente rimosso',
        phone: job.clientPhoneFallback || '—',
        fiscalCode: '',
        address: '',
        email: '',
      };
      const semaphore = getSemaphoreInfo(job);
      return { ...job, client, semaphore };
    });
  }, [jobs, clientsById]);

  // KPI Dashboard
  const kpis = useMemo(() => {
    let activeCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let readyCount = 0;

    enrichedJobs.forEach((job) => {
      if (job.status !== 'CONSEGNATO') {
        activeCount++;
        if (job.semaphore.key === 'OVERDUE') overdueCount++;
        if (job.semaphore.key === 'DUE_SOON') dueSoonCount++;
        if (job.status === 'PRONTO_RITIRO') readyCount++;
      }
    });

    return { activeCount, overdueCount, dueSoonCount, readyCount };
  }, [enrichedJobs]);

  // Filtraggio e ordinamento lavori
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return enrichedJobs
      .filter((job) => {
        // Filtro pillola
        if (activeFilter === 'RIPARAZIONE' && job.serviceType !== 'RIPARAZIONE') return false;
        if (activeFilter === 'CREAZIONE' && job.serviceType !== 'CREAZIONE') return false;
        if (activeFilter === 'OVERDUE' && job.semaphore.key !== 'OVERDUE') return false;
        if (activeFilter === 'DUE_SOON' && job.semaphore.key !== 'DUE_SOON') return false;
        if (activeFilter === 'PRONTO_RITIRO' && job.status !== 'PRONTO_RITIRO') return false;
        if (activeFilter === 'CONSEGNATO' && job.status !== 'CONSEGNATO') return false;

        // Ricerca testuale
        if (q) {
          const inCode = (job.code || '').toLowerCase().includes(q);
          const inName = (job.client.fullName || '').toLowerCase().includes(q);
          const inPhone = (job.client.phone || '').toLowerCase().includes(q);
          const inDesc = (job.description || '').toLowerCase().includes(q);
          const inProduct = (job.productType || '').toLowerCase().includes(q);
          if (!inCode && !inName && !inPhone && !inDesc && !inProduct) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // I consegnati vanno in fondo, gli altri ordinati per urgenza (data consegna crescente)
        if (a.status === 'CONSEGNATO' && b.status !== 'CONSEGNATO') return 1;
        if (a.status !== 'CONSEGNATO' && b.status === 'CONSEGNATO') return -1;
        return (a.estimatedDeliveryDate || '').localeCompare(b.estimatedDeliveryDate || '');
      });
  }, [enrichedJobs, activeFilter, searchQuery]);

  // Azioni CRUD
  const handleCreateJob = (formData, selectedClientId) => {
    let finalClientId = selectedClientId;

    // Salva nuovo cliente o aggiorna esistente in rubrica
    const clientPayload = {
      fullName: formData.clientName.trim(),
      phone: formData.clientPhone.trim(),
      fiscalCode: formData.clientFiscalCode.trim().toUpperCase(),
      address: formData.clientAddress.trim(),
      email: formData.clientEmail.trim(),
    };

    if (finalClientId && clientsById[finalClientId]) {
      setClients((prev) =>
        prev.map((c) => (c.id === finalClientId ? { ...c, ...clientPayload } : c))
      );
    } else {
      // Controlla se esiste già per telefono esatto o codice fiscale esatto
      const existing = clients.find(
        (c) =>
          (clientPayload.fiscalCode && c.fiscalCode && c.fiscalCode.toUpperCase() === clientPayload.fiscalCode) ||
          (c.phone.replace(/\s+/g, '') === clientPayload.phone.replace(/\s+/g, '') &&
            c.fullName.toLowerCase() === clientPayload.fullName.toLowerCase())
      );

      if (existing) {
        finalClientId = existing.id;
        setClients((prev) =>
          prev.map((c) => (c.id === existing.id ? { ...c, ...clientPayload } : c))
        );
      } else {
        finalClientId = `cli-${Date.now()}`;
        const newClient = {
          id: finalClientId,
          ...clientPayload,
          createdAt: getTodayISO(),
        };
        setClients((prev) => [newClient, ...prev]);
      }
    }

    const newCode = generateNextJobCode(jobs, formData.serviceType);
    const newJob = {
      id: `job-${Date.now()}`,
      code: newCode,
      serviceType: formData.serviceType,
      clientId: finalClientId,
      clientNameFallback: clientPayload.fullName,
      clientPhoneFallback: clientPayload.phone,
      productType: formData.productType,
      weightGrams: formData.weightGrams,
      metal: formData.metal === 'Altro' && formData.customMetal.trim() ? formData.customMetal.trim() : formData.metal,
      stones: formData.stones.trim(),
      description: formData.description.trim(),
      notes: formData.notes.trim(),
      intakeDate: formData.intakeDate,
      estimatedDeliveryDate: formData.estimatedDeliveryDate,
      estimatedPrice: formData.estimatedPrice,
      status: 'IN_LAVORAZIONE',
      createdAt: new Date().toISOString(),
    };

    setJobs((prev) => [newJob, ...prev]);
    setPreselectedClientForNewJob(null);
    setActiveTab('dashboard');
    setReceiptJobId(newJob.id);
    showToast(`Scheda ${newCode} salvata con successo!`, 'success');
  };

  const handleUpdateJobStatus = (jobId, newStatus) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        return {
          ...job,
          status: newStatus,
          deliveredAt: newStatus === 'CONSEGNATO' ? getTodayISO() : undefined,
        };
      })
    );
    const statusLabel = JOB_STATUSES.find((s) => s.id === newStatus)?.label || newStatus;
    showToast(`Stato aggiornato a "${statusLabel}"`, 'info');
  };

  const handleUpdateJobDetails = (updatedJob) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === updatedJob.id
          ? {
              ...j,
              ...updatedJob,
              deliveredAt:
                updatedJob.status === 'CONSEGNATO'
                  ? j.deliveredAt || getTodayISO()
                  : undefined,
            }
          : j
      )
    );
    showToast(`Scheda ${updatedJob.code} aggiornata`, 'success');
  };

  const handleDeleteJob = (jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setDetailJobId(null);
    showToast(`Scheda ${job?.code || ''} eliminata`, 'info');
  };

  const handleUpdateClient = (updatedClient) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClient.id ? { ...c, ...updatedClient } : c))
    );
    showToast(`Anagrafica di ${updatedClient.fullName} aggiornata`, 'success');
  };

  const handleStartNewJobForClient = (client) => {
    setPreselectedClientForNewJob(client);
    setActiveTab('new-job');
  };

  // Backup Export / Import / Reset
  const handleExportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      clients,
      jobs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestionale-orafo-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON esportato correttamente', 'success');
  };

  const handleImportBackup = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.jobs)) {
          throw new Error('Formato file non valido');
        }
        setClients(parsed.clients);
        setJobs(parsed.jobs);
        if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        setSettingsModalOpen(false);
        showToast(`Importati ${parsed.jobs.length} lavori e ${parsed.clients.length} clienti`, 'success');
      } catch (err) {
        showToast('Errore: il file JSON selezionato non è un backup valido.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadDemoData = () => {
    const demo = createDemoData();
    setClients(demo.clients);
    setJobs(demo.jobs);
    setSettingsModalOpen(false);
    showToast('Dati dimostrativi caricati con successo', 'success');
  };

  const handleClearAllData = () => {
    setClients([]);
    setJobs([]);
    setSettingsModalOpen(false);
    showToast('Database svuotato correttamente', 'info');
  };

  const receiptJob = useMemo(
    () => enrichedJobs.find((j) => j.id === receiptJobId) || null,
    [enrichedJobs, receiptJobId]
  );

  const detailJob = useMemo(
    () => enrichedJobs.find((j) => j.id === detailJobId) || null,
    [enrichedJobs, detailJobId]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col lg:flex-row font-sans antialiased">
      {/* STILI DI STAMPA DEDICATI PER LA RICEVUTA A4 / A5 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* SIDEBAR DESKTOP / TABLET LANDSCAPE */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E8F0] z-30 no-print">
        <div className="p-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm shrink-0">
              <Gem className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 text-sm leading-tight truncate">
                {settings.shopName}
              </h1>
              <p className="text-xs text-slate-500 truncate">Gestionale Laboratorio</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => {
              setPreselectedClientForNewJob(null);
              setActiveTab('new-job');
            }}
            className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              activeTab === 'new-job'
                ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            Nuova Accettazione
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard Lavori
            </span>
            {kpis.activeCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">
                {kpis.activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'clients'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              Rubrica Clienti
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
              {clients.length}
            </span>
          </button>
        </nav>

        {/* Footer Sidebar con Impostazioni & Backup */}
        <div className="p-3 border-t border-[#E2E8F0] space-y-2">
          {kpis.overdueCount > 0 && (
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setActiveFilter('OVERDUE');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{kpis.overdueCount} {kpis.overdueCount === 1 ? 'lavoro in ritardo' : 'lavori in ritardo'}</span>
            </button>
          )}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Impostazioni & Backup
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE / TABLET PORTRAIT */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
            <Gem className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 text-sm truncate">{settings.shopName}</h1>
            <p className="text-[11px] text-slate-500">Laboratorio Orafo</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPreselectedClientForNewJob(null);
              setActiveTab('new-job');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>Nuova</span>
          </button>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="p-2 rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50"
            aria-label="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MENU DROPDOWN MOBILE */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-3 space-y-1.5 shadow-sm no-print">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'dashboard' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4" /> Dashboard Lavori
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200">{kpis.activeCount}</span>
          </button>
          <button
            onClick={() => {
              setPreselectedClientForNewJob(null);
              setActiveTab('new-job');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'new-job' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Nuova Accettazione
          </button>
          <button
            onClick={() => {
              setActiveTab('clients');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'clients' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4" /> Rubrica Clienti
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200">{clients.length}</span>
          </button>
        </div>
      )}

      {/* AREA CONTENUTO PRINCIPALE */}
      <main className="flex-1 lg:pl-64 min-w-0 no-print">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              kpis={kpis}
              jobs={filteredJobs}
              totalJobsCount={enrichedJobs.length}
              viewMode={viewMode}
              setViewMode={setViewMode}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              onStatusChange={handleUpdateJobStatus}
              onOpenDetail={(id) => setDetailJobId(id)}
              onOpenReceipt={(id) => setReceiptJobId(id)}
              onNewJob={() => {
                setPreselectedClientForNewJob(null);
                setActiveTab('new-job');
              }}
            />
          )}

          {activeTab === 'new-job' && (
            <NewJobForm
              clients={clients}
              preselectedClient={preselectedClientForNewJob}
              onSubmit={handleCreateJob}
              onCancel={() => {
                setPreselectedClientForNewJob(null);
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsDirectoryView
              clients={clients}
              jobs={enrichedJobs}
              onUpdateClient={handleUpdateClient}
              onStartNewJobForClient={handleStartNewJobForClient}
              onOpenJobDetail={(id) => setDetailJobId(id)}
              onOpenJobReceipt={(id) => setReceiptJobId(id)}
            />
          )}
        </div>
      </main>

      {/* MODALE RICEVUTA DI PRESA IN CARICO (STAMPABILE) */}
      {receiptJob && (
        <ReceiptModal
          job={receiptJob}
          settings={settings}
          onClose={() => setReceiptJobId(null)}
        />
      )}

      {/* MODALE DETTAGLIO & MODIFICA SCHEDA LAVORO */}
      {detailJob && (
        <JobDetailModal
          job={detailJob}
          onClose={() => setDetailJobId(null)}
          onSave={handleUpdateJobDetails}
          onDelete={handleDeleteJob}
          onPrintReceipt={() => {
            const id = detailJob.id;
            setDetailJobId(null);
            setReceiptJobId(id);
          }}
        />
      )}

      {/* MODALE IMPOSTAZIONI & BACKUP JSON */}
      {settingsModalOpen && (
        <SettingsModal
          settings={settings}
          onSaveSettings={(newSettings) => {
            setSettings(newSettings);
            showToast('Dati laboratorio salvati', 'success');
          }}
          onExport={handleExportBackup}
          onImport={handleImportBackup}
          onLoadDemo={handleLoadDemoData}
          onClearAll={handleClearAllData}
          onClose={() => setSettingsModalOpen(false)}
          stats={{ clientsCount: clients.length, jobsCount: jobs.length }}
        />
      )}

      {/* TOAST NOTIFICA */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : toast.type === 'info'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SEZIONE 2: DASHBOARD DI CONTROLLO & STATO LAVORI
// ============================================================================

function DashboardView({
  kpis,
  jobs,
  totalJobsCount,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
  onStatusChange,
  onOpenDetail,
  onOpenReceipt,
  onNewJob,
}) {
  const filterPills = [
    { id: 'ALL', label: 'Tutti' },
    { id: 'RIPARAZIONE', label: 'Solo Riparazioni' },
    { id: 'CREAZIONE', label: 'Solo Nuove Creazioni' },
    { id: 'OVERDUE', label: 'In Ritardo (Rossi)' },
    { id: 'DUE_SOON', label: 'In Scadenza (Gialli)' },
    { id: 'CONSEGNATO', label: 'Consegnati' },
  ];

  return (
    <div className="space-y-6">
      {/* Intestazione Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Lavori</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitoraggio in tempo reale di riparazioni, creazioni su misura e scadenze di laboratorio.
          </p>
        </div>
        <button
          onClick={onNewJob}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-amber-400" />
          Nuova Scheda Lavoro
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Totale Attivi"
          value={kpis.activeCount}
          subtitle="In laboratorio"
          icon={<LayoutDashboard className="w-5 h-5 text-slate-700" />}
          accent="border-[#E2E8F0] hover:border-slate-300"
          iconBg="bg-slate-100"
          active={activeFilter === 'ALL'}
          onClick={() => setActiveFilter('ALL')}
        />
        <KpiCard
          title="In Ritardo"
          value={kpis.overdueCount}
          subtitle="Scadenza superata"
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          accent={kpis.overdueCount > 0 ? 'border-red-200 bg-red-50/40 hover:border-red-300' : 'border-[#E2E8F0]'}
          iconBg="bg-red-100"
          valueColor={kpis.overdueCount > 0 ? 'text-red-700' : 'text-slate-900'}
          active={activeFilter === 'OVERDUE'}
          onClick={() => setActiveFilter(activeFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
        />
        <KpiCard
          title="In Scadenza"
          value={kpis.dueSoonCount}
          subtitle="Entro 48 ore"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          accent={kpis.dueSoonCount > 0 ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300' : 'border-[#E2E8F0]'}
          iconBg="bg-amber-100"
          valueColor={kpis.dueSoonCount > 0 ? 'text-amber-700' : 'text-slate-900'}
          active={activeFilter === 'DUE_SOON'}
          onClick={() => setActiveFilter(activeFilter === 'DUE_SOON' ? 'ALL' : 'DUE_SOON')}
        />
        <KpiCard
          title="Pronti per Ritiro"
          value={kpis.readyCount}
          subtitle="Da consegnare"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          accent="border-emerald-200/80 hover:border-emerald-300"
          iconBg="bg-emerald-100"
          valueColor="text-emerald-700"
          active={activeFilter === 'PRONTO_RITIRO'}
          onClick={() => setActiveFilter(activeFilter === 'PRONTO_RITIRO' ? 'ALL' : 'PRONTO_RITIRO')}
        />
      </div>

      {/* Barra Ricerca, Filtri e Selettore Vista */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Input Ricerca */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per cliente, telefono, codice (es. RIP-2026-001) o gioiello..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#E2E8F0] bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Vista: Griglia / Tabella / Kanban */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-[#E2E8F0] self-start md:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Schede
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tabella
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
        </div>

        {/* Pillole Filtro Rapido */}
        <div className="flex flex-wrap items-center gap-2">
          {filterPills.map((pill) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-[#E2E8F0] hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
          {(activeFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setActiveFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline ml-1"
            >
              Azzera filtri
            </button>
          )}
        </div>
      </div>

      {/* CONTENUTO LAVORI */}
      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Gem className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {totalJobsCount === 0 ? 'Nessuna scheda lavoro presente' : 'Nessun risultato trovato'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {totalJobsCount === 0
              ? 'Inizia registrando una nuova riparazione o una creazione su misura dal pulsante Nuova Accettazione.'
              : 'Prova a modificare i criteri di ricerca o a rimuovere i filtri attivi.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={onStatusChange}
              onOpenDetail={() => onOpenDetail(job.id)}
              onOpenReceipt={() => onOpenReceipt(job.id)}
            />
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <JobsTableView
          jobs={jobs}
          onStatusChange={onStatusChange}
          onOpenDetail={onOpenDetail}
          onOpenReceipt={onOpenReceipt}
        />
      ) : (
        <JobsKanbanView
          jobs={jobs}
          onStatusChange={onStatusChange}
          onOpenDetail={onOpenDetail}
          onOpenReceipt={onOpenReceipt}
        />
      )}
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon, accent, iconBg, valueColor = 'text-slate-900', active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border p-4 transition-all shadow-xs ${accent} ${
        active ? 'ring-2 ring-slate-900 ring-offset-1' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </button>
  );
}

function ServiceBadge({ type, compact = false }) {
  if (type === 'CREAZIONE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300/80">
        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        {compact ? 'Creazione' : 'Creazione su Misura'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-blue-700 border border-blue-200">
      <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      {compact ? 'Riparazione' : 'Riparazione'}
    </span>
  );
}

function SemaphoreBadge({ semaphore }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${semaphore.badgeClass}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${semaphore.dotClass}`} />
      {semaphore.label}
    </span>
  );
}

function JobCard({ job, onStatusChange, onOpenDetail, onOpenReceipt }) {
  const isCreation = job.serviceType === 'CREAZIONE';
  const topBorderClass = isCreation ? 'border-t-amber-500' : 'border-t-blue-600';

  return (
    <div
      className={`bg-white rounded-2xl border border-[#E2E8F0] border-t-4 ${topBorderClass} shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden`}
    >
      <div className="p-4 space-y-3.5">
        {/* Riga Superiore: Codice + Servizio + Semaforo */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {job.code}
              </span>
              <ServiceBadge type={job.serviceType} compact />
            </div>
          </div>
          <SemaphoreBadge semaphore={job.semaphore} />
        </div>

        {/* Cliente */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-base truncate">{job.client.fullName}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              {job.client.phone}
            </p>
          </div>
          {job.estimatedPrice && (
            <div className="text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Preventivo</span>
              <span className="text-sm font-bold text-slate-900">€ {Number(job.estimatedPrice).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Specifiche Gioiello */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1">
              <Gem className="w-3.5 h-3.5 text-slate-400" />
              {job.productType}
            </span>
            {job.metal && <span className="text-slate-500">• {job.metal}</span>}
            {job.weightGrams && (
              <span className="text-slate-500 flex items-center gap-0.5">
                • {job.weightGrams} g
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{job.description}</p>
        </div>

        {/* Date */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Ritiro: <strong className="text-slate-700">{formatDateIT(job.intakeDate)}</strong>
          </span>
          <span className="flex items-center gap-1">
            Consegna: <strong className="text-slate-900">{formatDateIT(job.estimatedDeliveryDate)}</strong>
          </span>
        </div>
      </div>

      {/* Footer Card: Cambio stato rapido + Azioni */}
      <div className="px-4 py-3 bg-slate-50/80 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          aria-label="Stato lavoro"
          className="flex-1 min-w-0 text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          {JOB_STATUSES.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenReceipt}
            title="Stampa Ricevuta"
            className="p-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenDetail}
            title="Dettagli e Modifica"
            className="px-2.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Dettagli
          </button>
        </div>
      </div>
    </div>
  );
}

function JobsTableView({ jobs, onStatusChange, onOpenDetail, onOpenReceipt }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-4">Codice / Servizio</th>
              <th className="py-3.5 px-4">Cliente</th>
              <th className="py-3.5 px-4">Gioiello & Lavoro</th>
              <th className="py-3.5 px-4">Consegna & Semaforo</th>
              <th className="py-3.5 px-4">Stato</th>
              <th className="py-3.5 px-4 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-sm">
            {jobs.map((job) => {
              const isCreation = job.serviceType === 'CREAZIONE';
              return (
                <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className={`py-3.5 px-4 border-l-4 ${isCreation ? 'border-l-amber-500' : 'border-l-blue-600'}`}>
                    <div className="font-mono text-xs font-bold text-slate-900">{job.code}</div>
                    <div className="mt-1">
                      <ServiceBadge type={job.serviceType} compact />
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{job.client.fullName}</div>
                    <div className="text-xs text-slate-500">{job.client.phone}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-medium text-slate-800 text-xs">
                      {job.productType} • {job.metal} {job.weightGrams ? `(${job.weightGrams} g)` : ''}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{job.description}</p>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="text-xs font-semibold text-slate-800 mb-1">
                      {formatDateIT(job.estimatedDeliveryDate)}
                    </div>
                    <SemaphoreBadge semaphore={job.semaphore} />
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={job.status}
                      onChange={(e) => onStatusChange(job.id, e.target.value)}
                      className="text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      {JOB_STATUSES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenReceipt(job.id)}
                        title="Stampa Ricevuta"
                        className="p-2 rounded-lg border border-[#E2E8F0] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onOpenDetail(job.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Dettagli
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobsKanbanView({ jobs, onStatusChange, onOpenDetail, onOpenReceipt }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {JOB_STATUSES.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.id);
        return (
          <div key={col.id} className="bg-slate-100/80 rounded-2xl border border-[#E2E8F0] p-3 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {col.label}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white border border-[#E2E8F0] text-slate-700">
                {colJobs.length}
              </span>
            </div>

            <div className="space-y-3">
              {colJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                  Nessun lavoro
                </div>
              ) : (
                colJobs.map((job) => {
                  const isCreation = job.serviceType === 'CREAZIONE';
                  return (
                    <div
                      key={job.id}
                      className={`bg-white rounded-xl border border-[#E2E8F0] border-l-4 ${
                        isCreation ? 'border-l-amber-500' : 'border-l-blue-600'
                      } p-3 shadow-xs space-y-2.5`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-bold text-slate-700">{job.code}</span>
                        <SemaphoreBadge semaphore={job.semaphore} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 truncate">{job.client.fullName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {job.productType} • {job.metal}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{job.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Scad: <strong>{formatDateIT(job.estimatedDeliveryDate)}</strong></span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenReceipt(job.id)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            title="Ricevuta"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenDetail(job.id)}
                            className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                          >
                            Apri
                          </button>
                        </div>
                      </div>
                      <select
                        value={job.status}
                        onChange={(e) => onStatusChange(job.id, e.target.value)}
                        className="w-full text-[11px] font-semibold rounded-lg border border-[#E2E8F0] bg-slate-50 px-2 py-1.5 text-slate-700"
                      >
                        {JOB_STATUSES.map((st) => (
                          <option key={st.id} value={st.id}>
                            Sposta in: {st.shortLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// SEZIONE 1: MODULO DI ACCETTAZIONE (NUOVA SCHEDA LAVORO)
// ============================================================================

function NewJobForm({ clients, preselectedClient, onSubmit, onCancel }) {
  const today = getTodayISO();

  const [serviceType, setServiceType] = useState(''); // 'RIPARAZIONE' | 'CREAZIONE'
  const [selectedClientId, setSelectedClientId] = useState(preselectedClient?.id || null);
  const [clientSearch, setClientSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    clientName: preselectedClient?.fullName || '',
    clientPhone: preselectedClient?.phone || '',
    clientFiscalCode: preselectedClient?.fiscalCode || '',
    clientAddress: preselectedClient?.address || '',
    clientEmail: preselectedClient?.email || '',
    productType: 'Anello',
    weightGrams: '',
    metal: 'Oro 750 Giallo',
    customMetal: '',
    stones: '',
    description: '',
    notes: '',
    intakeDate: today,
    estimatedDeliveryDate: '',
    estimatedPrice: '',
  });

  const [errors, setErrors] = useState({});

  // Aggiorna se cambia preselectedClient
  useEffect(() => {
    if (preselectedClient) {
      setSelectedClientId(preselectedClient.id);
      setFormData((prev) => ({
        ...prev,
        clientName: preselectedClient.fullName || '',
        clientPhone: preselectedClient.phone || '',
        clientFiscalCode: preselectedClient.fiscalCode || '',
        clientAddress: preselectedClient.address || '',
        clientEmail: preselectedClient.email || '',
      }));
    }
  }, [preselectedClient]);

  // Suggerimenti auto-completamento cliente
  const matchingClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.fiscalCode || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [clients, clientSearch]);

  const handleSelectExistingClient = (client) => {
    setSelectedClientId(client.id);
    setFormData((prev) => ({
      ...prev,
      clientName: client.fullName,
      clientPhone: client.phone,
      clientFiscalCode: client.fiscalCode || '',
      clientAddress: client.address || '',
      clientEmail: client.email || '',
    }));
    setClientSearch('');
    setShowSuggestions(false);
    setErrors((prev) => ({ ...prev, clientName: undefined, clientPhone: undefined }));
  };

  const handleUnlinkClient = () => {
    setSelectedClientId(null);
    setFormData((prev) => ({
      ...prev,
      clientName: '',
      clientPhone: '',
      clientFiscalCode: '',
      clientAddress: '',
      clientEmail: '',
    }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const applyQuickDays = (days) => {
    const calculated = addDaysISO(formData.intakeDate || today, days);
    handleChange('estimatedDeliveryDate', calculated);
  };

  const validateAndSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!serviceType) {
      newErrors.serviceType = 'Seleziona obbligatoriamente il tipo di servizio (Riparazione o Creazione su Misura).';
    }
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Il Nome e Cognome del cliente è obbligatorio.';
    }
    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'Il Numero di Telefono del cliente è obbligatorio.';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Inserisci la descrizione del lavoro da eseguire.';
    }
    if (!formData.estimatedDeliveryDate) {
      newErrors.estimatedDeliveryDate = 'La Data stimata di consegna / scadenza è obbligatoria.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorKey = Object.keys(newErrors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    onSubmit({ ...formData, serviceType }, selectedClientId);
  };

  return (
    <form onSubmit={validateAndSubmit} className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header Form */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Nuova Accettazione</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Compila la scheda lavoro per generare il codice univoco e la ricevuta per il cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Annulla
        </button>
      </div>

      {/* Riepilogo errori globale se presenti */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-300 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-bold">Attenzione: completa i campi obbligatori evidenziati in rosso</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
              {Object.values(errors).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SEZIONE 1: TIPO SERVIZIO */}
      <section
        id="field-serviceType"
        className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 ${
          errors.serviceType ? 'border-red-400 ring-2 ring-red-100' : 'border-[#E2E8F0]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Selezione Tipo Servizio <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-slate-500">Scegli la tipologia per assegnare codice e priorità visiva.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card Riparazione */}
          <button
            type="button"
            onClick={() => {
              setServiceType('RIPARAZIONE');
              setErrors((prev) => ({ ...prev, serviceType: undefined }));
            }}
            className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
              serviceType === 'RIPARAZIONE'
                ? 'border-blue-600 bg-sky-50/70 ring-4 ring-blue-100'
                : 'border-[#E2E8F0] hover:border-blue-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                serviceType === 'RIPARAZIONE' ? 'bg-blue-600 text-white' : 'bg-sky-100 text-blue-600'
              }`}
            >
              <Wrench className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">Riparazione Gioiello</span>
                {serviceType === 'RIPARAZIONE' && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Saldature, messe a misura, rodiature, sostituzione chiusure, serraggio pietre e lucidatura.
              </p>
              <span className="inline-block mt-2 text-[11px] font-mono font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                Codice: RIP-{new Date().getFullYear()}-XXX
              </span>
            </div>
          </button>

          {/* Card Creazione su Misura */}
          <button
            type="button"
            onClick={() => {
              setServiceType('CREAZIONE');
              setErrors((prev) => ({ ...prev, serviceType: undefined }));
            }}
            className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
              serviceType === 'CREAZIONE'
                ? 'border-amber-600 bg-amber-50/70 ring-4 ring-amber-100'
                : 'border-[#E2E8F0] hover:border-amber-300 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                serviceType === 'CREAZIONE' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">Creazione su Misura</span>
                {serviceType === 'CREAZIONE' && (
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Nuovo gioiello artigianale, progettazione su misura, consulenza gemme o trasformazione oro.
              </p>
              <span className="inline-block mt-2 text-[11px] font-mono font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Codice: CRE-{new Date().getFullYear()}-XXX
              </span>
            </div>
          </button>
        </div>

        {errors.serviceType && (
          <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {errors.serviceType}
          </p>
        )}
      </section>

      {/* SEZIONE 2: DATI CLIENTE */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Dati Cliente</h3>
              <p className="text-xs text-slate-500">Cerca un cliente già registrato o inserisci una nuova anagrafica.</p>
            </div>
          </div>

          {selectedClientId && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cliente collegato dalla rubrica
              <button
                type="button"
                onClick={handleUnlinkClient}
                className="ml-1 text-emerald-800 hover:text-red-600 underline"
              >
                Cambia
              </button>
            </div>
          )}
        </div>

        {/* Barra Auto-completamento Cliente */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Ricerca rapida cliente esistente (Nome, Telefono o Codice Fiscale)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={clientSearch}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Inizia a digitare per compilare i campi in un clic..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-sm"
            />
          </div>

          {showSuggestions && clientSearch.trim().length > 0 && (
            <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-[#E2E8F0] shadow-lg overflow-hidden">
              {matchingClients.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">
                  Nessun cliente trovato per "{clientSearch}". Compila i campi sotto per salvarlo automaticamente.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {matchingClients.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectExistingClient(client)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{client.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {client.phone} {client.fiscalCode ? `• CF: ${client.fiscalCode}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-blue-600">Seleziona</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Campi Anagrafici */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id="field-clientName">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome e Cognome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => handleChange('clientName', e.target.value)}
              placeholder="Es. Mario Rossi"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                errors.clientName
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-100'
                  : 'border-[#E2E8F0] focus:border-slate-400 focus:ring-slate-900/10'
              }`}
            />
            {errors.clientName && <p className="text-xs text-red-600 mt-1 font-medium">{errors.clientName}</p>}
          </div>

          <div id="field-clientPhone">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Numero di Telefono <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.clientPhone}
              onChange={(e) => handleChange('clientPhone', e.target.value)}
              placeholder="Es. 338 1234567"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                errors.clientPhone
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-100'
                  : 'border-[#E2E8F0] focus:border-slate-400 focus:ring-slate-900/10'
              }`}
            />
            {errors.clientPhone && <p className="text-xs text-red-600 mt-1 font-medium">{errors.clientPhone}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Codice Fiscale</label>
            <input
              type="text"
              value={formData.clientFiscalCode}
              onChange={(e) => handleChange('clientFiscalCode', e.target.value.toUpperCase())}
              placeholder="Es. RSSMRA80A01G535X"
              maxLength={16}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm uppercase font-mono focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Indirizzo Email</label>
            <input
              type="email"
              value={formData.clientEmail}
              onChange={(e) => handleChange('clientEmail', e.target.value)}
              placeholder="Es. mario.rossi@email.it"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Indirizzo di Residenza</label>
            <input
              type="text"
              value={formData.clientAddress}
              onChange={(e) => handleChange('clientAddress', e.target.value)}
              placeholder="Via, numero civico, città"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
      </section>

      {/* SEZIONE 3: DATI GIOIELLO & SPECIFICHE TECNICHE */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
            3
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">Dati Gioiello & Specifiche Tecniche</h3>
            <p className="text-xs text-slate-500">Dettagli di presa in carico utili al banco orafo e alla ricevuta.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipologia Prodotto</label>
            <select
              value={formData.productType}
              onChange={(e) => handleChange('productType', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            >
              {PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Metallo / Materiale</label>
            <select
              value={formData.metal}
              onChange={(e) => handleChange('metal', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            >
              {METAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Peso in grammi (g)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.weightGrams}
                onChange={(e) => handleChange('weightGrams', e.target.value)}
                placeholder="Es. 4.50"
                className="w-full px-3.5 pr-9 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                g
              </span>
            </div>
          </div>

          {formData.metal === 'Altro' && (
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Specifica altro materiale</label>
              <input
                type="text"
                value={formData.customMetal}
                onChange={(e) => handleChange('customMetal', e.target.value)}
                placeholder="Es. Palladio, Titanio, Oro 585..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400"
              />
            </div>
          )}

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Presenza Pietre / Gemme (tipologia e carati approssimativi)
            </label>
            <input
              type="text"
              value={formData.stones}
              onChange={(e) => handleChange('stones', e.target.value)}
              placeholder="Es. Diamante taglio brillante 0.30 ct, rubini laterali, perla coltivata..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="sm:col-span-3" id="field-description">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Descrizione del lavoro da eseguire <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={
                serviceType === 'CREAZIONE'
                  ? 'Specifica il progetto, misura, finitura, stile del castone e richieste del cliente...'
                  : 'Descrivi nel dettaglio la riparazione da effettuare (es. messa a misura, saldatura, rodiatura)...'
              }
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                errors.description
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-100'
                  : 'border-[#E2E8F0] focus:border-slate-400 focus:ring-slate-900/10'
              }`}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1 font-medium">{errors.description}</p>}
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Note libere aggiuntive (stato di usura al ritiro, incisioni esistenti, condizioni particolari)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Es. Graffi presenti sul gambo, incisione interna da mantenere, lasciato senza astuccio..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
      </section>

      {/* SEZIONE 4: PIANIFICAZIONE & TEMPI */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
            4
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">Pianificazione, Tempi & Preventivo</h3>
            <p className="text-xs text-slate-500">
              La data stimata attiva automaticamente il semaforo scadenze nella dashboard.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data di presa in carico</label>
            <input
              type="date"
              value={formData.intakeDate}
              onChange={(e) => handleChange('intakeDate', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400"
            />
          </div>

          <div id="field-estimatedDeliveryDate">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Data stimata di consegna <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.estimatedDeliveryDate}
              onChange={(e) => handleChange('estimatedDeliveryDate', e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 ${
                errors.estimatedDeliveryDate
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-100'
                  : 'border-[#E2E8F0] focus:border-slate-400 focus:ring-slate-900/10'
              }`}
            />
            {errors.estimatedDeliveryDate && (
              <p className="text-xs text-red-600 mt-1 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {errors.estimatedDeliveryDate}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Preventivo indicativo (€) <span className="text-slate-400 font-normal">(opzionale)</span>
            </label>
            <div className="relative">
              <Euro className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.estimatedPrice}
                onChange={(e) => handleChange('estimatedPrice', e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Pulsanti rapidi calcolo giorni */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-slate-500 mr-1">Calcolo rapido scadenza:</span>
          {[3, 7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => applyQuickDays(days)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
            >
              +{days} gg
            </button>
          ))}
        </div>
      </section>

      {/* Pulsanti Invio */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Annulla
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md transition-all"
        >
          <Save className="w-4 h-4 text-amber-400" />
          Salva Scheda e Genera Ricevuta
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// SEZIONE 3: RUBRICA CLIENTI & STORICO
// ============================================================================

function ClientsDirectoryView({
  clients,
  jobs,
  onUpdateClient,
  onStartNewJobForClient,
  onOpenJobDetail,
  onOpenJobReceipt,
}) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (!q) return true;
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.fiscalCode || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [clients, search]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const selectedClientJobs = useMemo(() => {
    if (!selectedClient) return [];
    return jobs
      .filter((j) => j.clientId === selectedClient.id)
      .sort((a, b) => (b.intakeDate || '').localeCompare(a.intakeDate || ''));
  }, [jobs, selectedClient]);

  const startEdit = () => {
    if (!selectedClient) return;
    setEditForm({ ...selectedClient });
    setIsEditing(true);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim() || !editForm.phone.trim()) return;
    onUpdateClient({
      ...editForm,
      fullName: editForm.fullName.trim(),
      phone: editForm.phone.trim(),
      fiscalCode: (editForm.fiscalCode || '').trim().toUpperCase(),
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rubrica Clienti</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Archivio anagrafico completo con storico di tutte le riparazioni e creazioni su misura.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lista Clienti */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cliente per nome, telefono o CF..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-slate-50/70 focus:bg-white focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="divide-y divide-[#E2E8F0] max-h-[620px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Nessun cliente trovato.</div>
            ) : (
              filteredClients.map((client) => {
                const clientJobs = jobs.filter((j) => j.clientId === client.id);
                const repairs = clientJobs.filter((j) => j.serviceType === 'RIPARAZIONE').length;
                const creations = clientJobs.filter((j) => j.serviceType === 'CREAZIONE').length;
                const isSelected = client.id === selectedClientId;

                return (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setIsEditing(false);
                    }}
                    className={`w-full text-left p-4 transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{client.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {client.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {repairs > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-blue-700">
                            {repairs} Rip.
                          </span>
                        )}
                        {creations > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {creations} Creaz.
                          </span>
                        )}
                        {clientJobs.length === 0 && (
                          <span className="text-[11px] text-slate-400">Nessun lavoro</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-slate-900' : 'text-slate-300'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Scheda Dettaglio Cliente */}
        <div className="lg:col-span-7 space-y-5">
          {!selectedClient ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-slate-500 text-sm">
              Seleziona un cliente dall'elenco per visualizzarne la scheda e lo storico lavori.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedClient.fullName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cliente registrato dal {formatDateIT(selectedClient.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isEditing && (
                      <button
                        onClick={startEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modifica
                      </button>
                    )}
                    <button
                      onClick={() => onStartNewJobForClient(selectedClient)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                      Nuova Scheda per questo Cliente
                    </button>
                  </div>
                </div>

                {isEditing && editForm ? (
                  <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nome e Cognome *</label>
                      <input
                        type="text"
                        required
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Telefono *</label>
                      <input
                        type="text"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Codice Fiscale</label>
                      <input
                        type="text"
                        value={editForm.fiscalCode || ''}
                        onChange={(e) => setEditForm({ ...editForm, fiscalCode: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Indirizzo</label>
                      <input
                        type="text"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-slate-600"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                      >
                        Salva Modifiche
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-sm">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{selectedClient.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{selectedClient.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono text-xs">{selectedClient.fiscalCode || 'CF non inserito'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{selectedClient.address || 'Indirizzo non inserito'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Storico Lavori Cliente */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-base">
                    Storico Gioielli & Lavori ({selectedClientJobs.length})
                  </h4>
                </div>

                {selectedClientJobs.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    Nessun lavoro registrato per questo cliente.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedClientJobs.map((job) => {
                      const isCreation = job.serviceType === 'CREAZIONE';
                      const statusObj = JOB_STATUSES.find((s) => s.id === job.status);
                      return (
                        <div
                          key={job.id}
                          className={`rounded-xl border border-[#E2E8F0] border-l-4 ${
                            isCreation ? 'border-l-amber-500' : 'border-l-blue-600'
                          } p-4 bg-slate-50/50 space-y-2`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {job.code}
                              </span>
                              <ServiceBadge type={job.serviceType} compact />
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusObj?.badgeClass}`}>
                                {statusObj?.label}
                              </span>
                            </div>
                            <SemaphoreBadge semaphore={job.semaphore} />
                          </div>

                          <div className="text-xs font-semibold text-slate-800">
                            {job.productType} • {job.metal} {job.weightGrams ? `(${job.weightGrams} g)` : ''}
                          </div>
                          <p className="text-xs text-slate-600">{job.description}</p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-500">
                            <span>
                              Presa in carico: <strong>{formatDateIT(job.intakeDate)}</strong> • Consegna:{' '}
                              <strong>{formatDateIT(job.estimatedDeliveryDate)}</strong>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onOpenJobReceipt(job.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-100 font-semibold"
                              >
                                <Printer className="w-3.5 h-3.5" /> Ricevuta
                              </button>
                              <button
                                onClick={() => onOpenJobDetail(job.id)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-100 font-semibold"
                              >
                                Dettagli
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODALE RICEVUTA DI PRESA IN CARICO (OTTIMIZZATA PER STAMPA A4/A5)
// ============================================================================

function ReceiptModal({ job, settings, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-auto">
        {/* Barra superiore modale (nascosta in stampa) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">Ricevuta di Presa in Carico — {job.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Stampa / Salva PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
              aria-label="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTENUTO STAMPABILE */}
        <div id="printable-receipt" className="p-6 sm:p-8 bg-white text-slate-900 space-y-6">
          {/* Intestazione Laboratorio */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{settings.shopName}</h2>
              <p className="text-xs text-slate-600">{settings.shopSubtitle}</p>
              <p className="text-xs text-slate-500 mt-1">
                {settings.shopAddress} • Tel: {settings.shopPhone}
              </p>
              <p className="text-xs text-slate-500">
                {settings.shopEmail} • {settings.shopVat}
              </p>
            </div>
            <div className="sm:text-right">
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Ricevuta di Presa in Carico
              </span>
              <div className="font-mono text-xl font-black text-slate-900 mt-0.5">{job.code}</div>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 rounded border border-slate-300 text-xs font-bold uppercase">
                  {job.serviceType === 'CREAZIONE' ? 'Creazione su Misura' : 'Riparazione Gioiello'}
                </span>
              </div>
            </div>
          </div>

          {/* Dati Cliente & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dati Cliente</p>
              <p className="font-bold text-sm text-slate-900">{job.client.fullName}</p>
              <p>Tel: <strong>{job.client.phone}</strong></p>
              {job.client.fiscalCode && <p>CF: <span className="font-mono">{job.client.fiscalCode}</span></p>}
              {job.client.address && <p>{job.client.address}</p>}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tempi & Preventivo</p>
              <div className="flex justify-between">
                <span className="text-slate-600">Data presa in carico:</span>
                <strong>{formatDateIT(job.intakeDate)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Consegna stimata:</span>
                <strong className="text-sm underline">{formatDateIT(job.estimatedDeliveryDate)}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-600">Preventivo indicativo:</span>
                <strong>{job.estimatedPrice ? `€ ${Number(job.estimatedPrice).toFixed(2)}` : 'Da definire'}</strong>
              </div>
            </div>
          </div>

          {/* Specifiche Oggetto */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-700 border-b border-slate-300">
              Dettagli Oggetto & Lavorazione Richiesta
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Tipologia</span>
                  <strong className="text-slate-900">{job.productType}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Metallo / Materiale</span>
                  <strong className="text-slate-900">{job.metal || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Peso rilevato</span>
                  <strong className="text-slate-900">{job.weightGrams ? `${job.weightGrams} g` : '—'}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Pietre / Gemme presenti</span>
                <p className="font-medium text-slate-900 mt-0.5">{job.stones || 'Nessuna pietra dichiarata'}</p>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Descrizione lavoro da eseguire</span>
                <p className="text-slate-900 mt-0.5 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </div>

              {job.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase">Note & Stato al ritiro</span>
                  <p className="text-slate-700 mt-0.5 italic">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Nota informativa & Firme */}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Conservare la presente ricevuta ed esibirla al momento del ritiro. La data di consegna è indicativa e può subire variazioni per esigenze tecniche di laboratorio. Il peso indicato include eventuali pietre montate.
          </p>

          <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
            <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
              Firma Operatore / Laboratorio
            </div>
            <div className="border-t border-slate-400 pt-2 text-center text-slate-600">
              Firma Cliente per accettazione
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODALE DETTAGLIO & MODIFICA SCHEDA LAVORO
// ============================================================================

function JobDetailModal({ job, onClose, onSave, onDelete, onPrintReceipt }) {
  const [form, setForm] = useState({
    productType: job.productType,
    metal: job.metal,
    weightGrams: job.weightGrams || '',
    stones: job.stones || '',
    description: job.description || '',
    notes: job.notes || '',
    intakeDate: job.intakeDate,
    estimatedDeliveryDate: job.estimatedDeliveryDate,
    estimatedPrice: job.estimatedPrice || '',
    status: job.status,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.estimatedDeliveryDate || !form.description.trim()) return;
    onSave({ ...job, ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
              {job.code}
            </span>
            <ServiceBadge type={job.serviceType} compact />
            <SemaphoreBadge semaphore={job.semaphore} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Riepilogo Cliente */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-slate-900 text-sm">{job.client.fullName}</p>
              <p className="text-xs text-slate-500">{job.client.phone} {job.client.email ? `• ${job.client.email}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={onPrintReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Printer className="w-3.5 h-3.5" /> Ristampa Ricevuta
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stato Lavorazione</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-semibold bg-white"
              >
                {JOB_STATUSES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data stimata consegna *</label>
              <input
                type="date"
                required
                value={form.estimatedDeliveryDate}
                onChange={(e) => setForm({ ...form, estimatedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tipologia</label>
              <select
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm bg-white"
              >
                {PRODUCT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Metallo / Materiale</label>
              <input
                type="text"
                value={form.metal}
                onChange={(e) => setForm({ ...form, metal: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Peso (g)</label>
              <input
                type="number"
                step="0.01"
                value={form.weightGrams}
                onChange={(e) => setForm({ ...form, weightGrams: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Preventivo (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.estimatedPrice}
                onChange={(e) => setForm({ ...form, estimatedPrice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pietre / Gemme</label>
              <input
                type="text"
                value={form.stones}
                onChange={(e) => setForm({ ...form, stones: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Descrizione Lavoro *</label>
              <textarea
                rows={3}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Note aggiuntive</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm"
              />
            </div>
          </div>

          {/* Footer Azioni con conferma eliminazione in-app */}
          <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Elimina scheda
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
                <span className="text-xs font-semibold text-red-700">Confermi eliminazione?</span>
                <button
                  type="button"
                  onClick={() => onDelete(job.id)}
                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold"
                >
                  Sì, elimina
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs text-slate-600 font-medium"
                >
                  No
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Chiudi
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODALE IMPOSTAZIONI LABORATORIO & BACKUP JSON
// ============================================================================

function SettingsModal({
  settings,
  onSaveSettings,
  onExport,
  onImport,
  onLoadDemo,
  onClearAll,
  onClose,
  stats,
}) {
  const [form, setForm] = useState({ ...settings });
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef(null);

  const handleSaveShop = (e) => {
    e.preventDefault();
    onSaveSettings(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900">Impostazioni & Backup Database</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Backup JSON */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Backup & Ripristino (LocalStorage Standalone)
              </h4>
              <span className="text-xs text-slate-500">
                {stats.jobsCount} lavori • {stats.clientsCount} clienti
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              I dati vengono salvati automaticamente sul dispositivo. Esporta periodicamente un file JSON di sicurezza per trasferire l'archivio su un altro PC o iPad.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onExport}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4 text-amber-400" />
                Esporta Backup JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                Importa Backup JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    onImport(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Intestazione Laboratorio per Ricevute */}
          <form onSubmit={handleSaveShop} className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              Intestazione Gioielleria (per Ricevute)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Gioielleria / Laboratorio</label>
                <input
                  type="text"
                  value={form.shopName}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sottotitolo</label>
                <input
                  type="text"
                  value={form.shopSubtitle}
                  onChange={(e) => setForm({ ...form, shopSubtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Indirizzo</label>
                <input
                  type="text"
                  value={form.shopAddress}
                  onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefono</label>
                <input
                  type="text"
                  value={form.shopPhone}
                  onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Partita IVA</label>
                <input
                  type="text"
                  value={form.shopVat}
                  onChange={(e) => setForm({ ...form, shopVat: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Salva Intestazione
              </button>
            </div>
          </form>

          {/* Gestione Dati Demo */}
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <h4 className="text-sm font-bold text-slate-900">Dati Dimostrativi</h4>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onLoadDemo}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Ripristina Dati Demo
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Svuota Tutto il Database
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-300">
                  <span className="text-xs font-bold text-red-700">Eliminare tutti i dati?</span>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold"
                  >
                    Conferma
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs text-slate-600"
                  >
                    Annulla
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}