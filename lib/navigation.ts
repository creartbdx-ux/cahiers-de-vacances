import {
  BookOpen,
  ClipboardList,
  Eye,
  FlaskConical,
  Globe,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  PaintBucket,
  Palette,
  PenLine,
  Puzzle,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  description: string
  icon: LucideIcon
}

/** Parcours public : de la découverte à la commande. */
export const publicNav: NavItem[] = [
  {
    label: 'Accueil',
    href: '/',
    description: 'Découvrez le concept des cahiers sur mesure.',
    icon: LayoutDashboard,
  },
  {
    label: 'Créer mon cahier',
    href: '/creer',
    description: 'Lancez la composition de votre cahier personnalisé.',
    icon: PenLine,
  },
  {
    label: 'Questionnaire',
    href: '/questionnaire',
    description: 'Répondez à quelques questions pour affiner vos envies.',
    icon: ClipboardList,
  },
  {
    label: 'Aperçu',
    href: '/apercu',
    description: 'Prévisualisez votre cahier avant de le commander.',
    icon: Eye,
  },
  {
    label: 'Commande',
    href: '/commande',
    description: 'Finalisez et recevez votre cahier.',
    icon: ShoppingBag,
  },
]

/** Espace d'administration : gestion du catalogue et de la fabrique de cahiers. */
export const adminNav: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    description: "Vue d'ensemble de l'activité et des raccourcis.",
    icon: LayoutDashboard,
  },
  {
    label: 'Cahiers',
    href: '/admin/cahiers',
    description: 'Gérez les cahiers générés et leurs statuts.',
    icon: BookOpen,
  },
  {
    label: 'Questionnaires',
    href: '/admin/questionnaires',
    description: 'Configurez les questions qui orientent la génération.',
    icon: ClipboardList,
  },
  {
    label: 'Jeux',
    href: '/admin/jeux',
    description: 'Administrez la bibliothèque de jeux et énigmes.',
    icon: Puzzle,
  },
  {
    label: 'Templates',
    href: '/admin/templates',
    description: 'Structurez les gabarits de mise en page des cahiers.',
    icon: LayoutTemplate,
  },
  {
    label: 'Assets',
    href: '/admin/assets',
    description: 'Centralisez les illustrations, icônes et médias.',
    icon: Image,
  },
  {
    label: 'Page Lab',
    href: '/admin/page-lab',
    description: 'Testez le moteur graphique de rendu des pages de cahier.',
    icon: FlaskConical,
  },
  {
    label: 'Univers',
    href: '/admin/univers',
    description: 'Définissez les thèmes et ambiances proposés.',
    icon: Globe,
  },
  {
    label: 'Styles graphiques',
    href: '/admin/styles',
    description: 'Gérez les directions artistiques disponibles.',
    icon: Palette,
  },
  {
    label: 'Palettes',
    href: '/admin/palettes',
    description: 'Composez les palettes de couleurs réutilisables.',
    icon: PaintBucket,
  },
]
